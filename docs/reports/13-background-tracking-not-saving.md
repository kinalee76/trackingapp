# 13. 버그 수정: 앱을 백그라운드로 보내면 위치가 저장되지 않던 문제

## 증상

사용자 리포트: "앱이 백그라운드에 있더라도, 서비스가 유지되면서 위치 정보를 계속 저장할 수 있도록 수정해주세요. 백그라운드로 앱을 숨기니까 그 동안 위치 정보를 저장 안 하는군요."

## 원인

`geolocation.service.ts`의 기존 구조:

```ts
BackgroundGeolocation.addWatcher(options, (location) => {
  if (location) latestLocation = location;   // 콜백은 그냥 캐시만 갱신
});

saveIntervalHandle = setInterval(() => {
  if (latestLocation) void handleLocation(latestLocation);  // 5초마다 캐시를 DB에 기록
}, 5000);
```

네이티브 포그라운드 서비스(`@capacitor-community/background-geolocation`, `foregroundServiceType="location"`)는 앱이 백그라운드에 있어도 계속 위치 콜백을 JS로 전달하도록 설계되어 있다 — 이 부분은 정상 동작. 하지만 실제로 DB에 저장하는 트리거는 그 콜백이 아니라 **별도의 JS `setInterval`**이었다. WebView(및 대부분의 최신 브라우저 엔진)는 페이지가 보이지 않는 상태(hidden/background)가 되면 절전을 위해 JS 타이머(`setInterval`/`setTimeout`)를 스로틀링하거나 사실상 정지시키는 경우가 흔하다 — 네이티브 포그라운드 서비스가 프로세스를 살려두고 위치 콜백을 계속 전달해도, 그 콜백이 하는 일이 "캐시 갱신"뿐이고 실제 저장은 지연/정지된 타이머에 의존하고 있었으므로, 앱이 화면에서 사라지는 순간부터 `track_points` insert가 멈췄다.

## 수정

`src/services/geolocation/geolocation.service.ts`:
- 별도 `setInterval` 기반 5초 샘플링을 완전히 제거.
- `BackgroundGeolocation.addWatcher`의 네이티브 콜백에서 **직접** `handleLocation()`을 호출하도록 변경.
- 5초 간격이라는 요구사항은 `handleLocation()` 내부에서 `lastSavedAt` 기준 경과 시간 체크(`recordedAt - lastSavedAt < 5000`이면 스킵)로 구현 — GPS 칩이 더 자주(보통 1Hz) 콜백을 줄 수 있으므로 필요.
- 결과적으로 저장 트리거가 "JS 타이머가 언제 다음에 깨어나는가"가 아니라 "네이티브가 언제 다음 위치를 콜백하는가"에 좌우되게 됨 — 포그라운드 서비스가 살아있는 한 앱이 백그라운드에 있어도 계속 저장됨.

## 참고: OS 레벨 배터리 최적화

이번 수정은 WebView 타이머 스로틀링 문제를 해결하지만, 제조사별 배터리 최적화(예: 삼성의 "절전 모드에서 앱 최적화", MIUI의 자동 시작 제한 등)가 앱 프로세스 자체를 강제 종료하는 경우까지는 코드로 막을 수 없다. 장시간 백그라운드 추적이 필요하면 사용자가 설정에서 이 앱을 배터리 최적화 대상에서 제외해야 할 수 있음 — 기존에도 `openLocationSettings()`로 위치 설정 화면 진입은 지원하고 있으나, 배터리 최적화 예외 안내 UI는 범위 밖(향후 확장 후보).

## 검증

실기기에서 재현: "추적 시작" → 홈 버튼으로 앱을 백그라운드로 보냄 → 약 11분 방치 → 앱을 다시 포그라운드로 → "추적 중지". 이후 기기의 SQLite 파일을 직접 pull하여 확인(`adb exec-out "run-as ... cat .../trackingappSQLite.db"` → 로컬 `sqlite3.exe`로 조회):

```
routes: id=104, distance_meters=6.23, duration_sec=637
track_points: count=114, 1분 단위로 10~11개씩 균등하게 분포 (0~10분 버킷 전부에 포인트 존재)
```

11분(660초) 내내 약 5초 간격으로 포인트가 끊김 없이 저장됐음을 확인 — 이전에는 앱을 백그라운드로 보내는 즉시 저장이 멈췄던 것과 대조적. 앱 UI(경로 상세 화면의 "기록 정보" 패널)에서도 "이동 거리 : 00.01 Km / 이동 시간 : 10:37"로 정상 표시됨을 확인(사용자가 실제로 이동하지 않고 책상에 둔 채 테스트했기 때문에 거리는 GPS 잡음 수준인 6m 정도).

## 검증 중 발견한 별개의 이슈 (미해결, 후속 조치 필요)

위 11분 백그라운드 테스트 후 앱을 포그라운드로 복귀시키고 "추적 중지" → 기록 탭으로 전환하는 시점에 앱이 흰 화면으로 멈추는 크래시가 1회 발생했다 (`Uncaught TypeError: Cannot read properties of null (reading 'isArray')`, react-dom 프로덕션 번들 내부에서 발생). SQLite 데이터는 전혀 손상되지 않았고(같은 경로의 포인트/통계 모두 정상 저장됨), 앱을 강제 종료 후 재시작하면 정상 복구됨. 이후 짧은 추적 시작→중지→기록 탭 전환을 반복 시도했으나 재현되지 않았다.

발생 시점의 정황(11분간 배터리 10%대로 소모, 그 시간 내내 네이버 지도가 인증 실패 배너를 계속 표시하며 재시도했을 가능성, 화면 전환 시점의 SurfaceFlinger 프레임레이트 전환 로그와 겹침)으로 미루어, 장시간 백그라운드 + 리소스 압박이 겹친 상황에서 발생하는 드문 WebView/React 내부 이슈로 추정되나 확정하지 못했다. 이번 요청(백그라운드 추적 유지)과는 별개의 문제이며 재현 방법을 아직 확보하지 못해 이번 라운드에서는 수정하지 못함 — 후속 과제로 남김.
