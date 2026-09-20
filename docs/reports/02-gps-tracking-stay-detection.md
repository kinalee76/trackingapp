# Phase 2 — GPS 백그라운드 추적 + 체류(3분) 감지

**날짜**: 2026-09-18
**상태**: 완료 (로직/설정 레벨 — 실기기 검증은 Phase 7로 이연)

## 목표
화면이 꺼지거나 앱이 백그라운드에 있어도 GPS 경로를 계속 기록하고, 사용자가 한 곳에 3분 이상 머무르면 이를 별도의 "체류(visit)" 레코드로 저장한다.

## 수행한 작업

### 1. 패키지 설치 및 설정
- `@capacitor-community/background-geolocation@1.2.26` 설치 (무료 커뮤니티 플러그인, 사용자 결정에 따라 Transistorsoft 유료 플러그인 대신 채택)
- `capacitor.config.ts`에 `android.useLegacyBridge: true` 추가 — 이 플러그인 사용 시 필수 설정으로, 백그라운드 진입 후 약 5분 뒤 위치 업데이트가 멈추는 Capacitor 브릿지 이슈를 회피함 ([참고 이슈](https://github.com/capacitor-community/background-geolocation/issues/89))
- 플러그인 자체 `android/AndroidManifest.xml`에 다음이 이미 선언되어 있어 앱 매니페스트에 별도 추가 불필요 (Gradle 매니페스트 병합으로 자동 반영):
  - `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
  - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android 14+ 대응)
  - `POST_NOTIFICATIONS` (Android 13+ 대응, 지속 알림 표시용)
  - `BackgroundGeolocationService` (foregroundServiceType="location")
- 이 플러그인은 JS 번들을 제공하지 않고 타입 정의만 제공 (`registerPlugin` 패턴으로 직접 등록해야 함) — [geolocation.service.ts](../../src/services/geolocation/geolocation.service.ts)에서 `registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')`로 처리
- 시험적으로 `@capacitor/geolocation`도 설치했으나 이번 단계에서 실제 사용하지 않아 제거함 (필요해지면 — 예: 지도 초기 중심을 현재 위치로 맞추는 기능 — 해당 Phase에서 다시 추가)

### 2. 체류 감지 알고리즘 ([stay-detector.ts](../../src/services/geolocation/stay-detector.ts))
순수 로직(DB/플러그인 의존성 없음)으로 구현한 `StayDetector` 클래스:
- **클러스터링**: 새 GPS 포인트가 현재 클러스터 중심(centroid)으로부터 반경 이내(기본 75m)면 러닝 평균으로 centroid를 갱신하고 포인트 개수를 늘림. 히스토리 전체를 버퍼링하지 않는 O(1) 방식.
- **체류 판정**: 클러스터 시작 시각부터 경과 시간이 임계값(기본 3분)을 넘으면 `stay-started` 이벤트 발생 (이후 포인트는 `stay-updated`).
- **체류 종료**: 포인트가 반경 밖으로 나가면 즉시 종료하지 않고, 연속으로 반경 밖 포인트가 `jitterStreak`(기본 2)회 나올 때까지 대기 — GPS 노이즈로 인한 단발성 튐이 체류를 조기 종료시키는 것을 방지. 연속 이탈이 확정되면 `stay-ended`(마지막 반경 내 포인트 시각 기준 `leftAt`/`durationSec`) 이벤트 발생 후 새 클러스터 시작.
- `finalize()`: 추적을 중지할 때 진행 중인 체류를 마무리 처리.

### 3. 추적 서비스 ([geolocation.service.ts](../../src/services/geolocation/geolocation.service.ts))
- `startTracking()`: 새 `routes` 레코드 생성 → `BackgroundGeolocation.addWatcher()`로 위치 구독 시작 (10m `distanceFilter`, 백그라운드 알림 문구 포함)
- 각 위치 콜백 → `track_points`에 저장 + `StayDetector.addPoint()` 호출 → 이벤트에 따라 `visits` 레코드 생성(`stay-started`)/종료(`stay-ended`)
- `stopTracking()`: watcher 제거, 진행 중인 체류 `finalize()`로 마무리, `routes.ended_at` 기록
- `openLocationSettings()`: 권한 거부 시 OS 설정 화면으로 이동하는 헬퍼 (플러그인의 `openSettings()` 래핑)

## 설계/구현 결정과 이유
- **반경 75m / 임계 3분 / jitterStreak 2**를 기본값으로 하되 `StayDetectorOptions`로 주입 가능하게 설계 — Phase 6(설정 화면)에서 사용자가 조정할 수 있도록 하는 향후 확장을 고려함.
- 체류 종료 시각(`leftAt`)은 "마지막으로 반경 안에 있던 포인트의 시각"으로 기록 (반경을 벗어난 새 포인트의 시각이 아님) — 실제 체류 시간을 더 정확히 반영.
- DB 쓰기는 `stay-started`/`stay-ended` 시점에만 발생하고 `stay-updated`는 쓰기 없음 — 매 포인트마다 visits 테이블을 갱신하지 않아 쓰기 횟수를 최소화.

## 확인/테스트 방법과 결과
- **알고리즘 단위 검증**: `npx tsx`로 임시 스크립트를 실행하여 `StayDetector`를 격리 테스트 (스크립트는 세션 스크래치패드에 두고 프로젝트에는 포함하지 않음):
  1. 75m 반경 내에서 4분간 정지 → 3분 지점(`t=180s`)에서 `stay-started` 발생 확인 (PASS)
  2. 체류 중 GPS 튐으로 먼 지점(약 15km) 포인트가 1회만 들어왔다가 바로 복귀 → `stay-ended`가 발생하지 않음을 확인 (jitter 방어 동작, PASS)
  3. 이후 먼 지점 포인트가 2회 연속 들어옴 → `stay-ended` 발생, `durationSec`가 실제 체류 구간(300초)과 정확히 일치함을 확인 (PASS)
- **빌드/타입체크**: `npm run build` 성공
- **Capacitor 동기화**: `npx cap sync android` 성공, `@capacitor-community/background-geolocation@1.2.26`, `@capacitor-community/sqlite@8.1.1` 2개 플러그인이 정상 인식됨
- **실기기/에뮬레이터 검증 미수행**: 이 머신에 Android SDK가 설치되어 있지 않아(`ANDROID_HOME` 미설정, `adb` 없음) 실제 Gradle 빌드나 백그라운드 추적의 실기기 동작(화면 꺼짐 상태 지속성, 알림 표시, 권한 플로우)은 확인하지 못함 — **Phase 7에서 Android Studio 설치 후 반드시 재검증 필요**.

## 알려진 제약사항 / TODO
- 실기기 검증 전까지는 백그라운드 추적의 실제 지속성(제조사별 배터리 최적화 정책 등)을 보장할 수 없음.
- Android 13+ 알림 권한(`POST_NOTIFICATIONS`)의 런타임 요청 UX는 아직 구현하지 않음 — 현재는 플러그인이 `requestPermissions: true`로 위치 권한만 자동 요청하며, 알림 권한은 사용자가 시스템 다이얼로그에서 별도로 허용해야 할 수 있음 (필요 시 `@capacitor/local-notifications`의 권한 API 연동 고려, README 권고사항).
- 알림 채널 이름/아이콘/색상(`strings.xml`) 커스터마이징은 아직 하지 않음 (기본값 사용) — 필요 시 Phase 6/7에서 브랜딩과 함께 정리.
- 체류 반경/시간 임계값의 사용자 설정 UI는 Phase 6에서 구현 예정.
