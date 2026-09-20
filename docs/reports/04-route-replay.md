# Phase 4 — 경로 재생(Replay) 기능

**날짜**: 2026-09-18
**상태**: 완료 (재생 제어 로직 검증 완료, 실제 지도 위 애니메이션은 API 키 발급 후 재검증 필요)

## 목표
저장된 경로(`track_points`)를 지도에 폴리라인으로 그리고, 재생/일시정지/처음부터/속도 조절이 가능한 재생 컨트롤을 구현한다.

## 수행한 작업

### 1. 재생 컨트롤러 분리 ([route-player.ts](../../src/services/map/route-player.ts))
`RoutePlayer` 클래스로 재생 상태(현재 인덱스, 재생 중 여부, 전체 포인트 수)와 제어 로직(재생/일시정지/처음부터/속도 변경)을 React와 분리했다. `StayDetector`(Phase 2)와 같은 이유: Capacitor나 DOM 없이도 순수 로직만 검증할 수 있게 하기 위함.
- `setMap(map)`: 사용 중인 `MapProvider`를 주입 (지도가 아직 준비 안 됐으면 null)
- `setPoints(points)`: 새 경로 포인트를 설정하고 즉시 `drawRoute()`로 전체 경로선을 그림
- `play()`: 현재 인덱스부터 남은 포인트만 잘라 `MapProvider.animatePlayback()`에 넘김 — 그래서 일시정지 후 재생을 누르면 처음부터가 아니라 멈춘 지점부터 이어짐
- `pause()`: 진행 중인 `PlaybackHandle.stop()` 호출, 인덱스는 유지
- `restart()`: 인덱스를 0으로 되돌리고 다시 재생
- `setSpeed(stepMs)`: 재생 중이면 그 자리에서 멈추고 새 속도로 재개

### 2. 화면 구성 ([RouteReplayScreen.tsx](../../src/screens/RouteReplayScreen.tsx))
- 저장된 경로 목록(`db.listRoutes()`)을 드롭다운으로 표시, 선택 시 해당 경로의 `track_points`를 불러와 `RoutePlayer.setPoints()`에 전달
- 재생/일시정지/처음부터 버튼, 속도 버튼(0.5x/1x/2x/4x → `stepMs` 400/200/100/50)
- 진행률 텍스트(`index / total`)
- 하단에 [MapView](../../src/components/MapView.tsx) — `onReady` 콜백으로 실제 지도 인스턴스를 `RoutePlayer.setMap()`에 연결
- `App.tsx`에 "실시간 지도" / "경로 재생" 두 탭짜리 임시 상단 네비게이션 추가 (Phase 6에서 정식 탭 내비게이션으로 대체 예정)

## 트러블슈팅: 웹 개발 폴백에서 데이터가 새로고침 후 사라짐 (중요 — Phase 1 관련)

**증상**: 브라우저(`npm run dev`)에서 경로를 저장한 뒤 페이지를 새로고침하면 "저장된 경로 없음"으로 표시됨 — 방금 저장한 데이터가 사라짐.

**원인**: [db.service.ts](../../src/services/db/db.service.ts)의 `ensureWebStore()`가 `<jeep-sqlite>` 엘리먼트를 생성할 때 `autoSave` 속성을 설정하지 않았음. jeep-sqlite는 `autoSave="true"`가 없으면 DB를 메모리에서만 관리하고 IndexedDB에 실제로 쓰지 않는다 — 따라서 SQL 쿼리 자체는 같은 페이지 로드 안에서는 정상 동작하지만(Phase 1 검증이 이 케이스였음), 페이지를 새로고침하면 메모리가 초기화되어 데이터가 사라진 것처럼 보임.

**해결**: 엘리먼트 생성 시 `el.setAttribute('autoSave', 'true')` 추가.

**영향 범위**: 이 문제는 **웹 브라우저 개발 폴백에만 해당** — 네이티브 Android에서는 `@capacitor-community/sqlite`가 실제 파일 시스템에 SQLite DB를 저장하므로 영향 없음. 하지만 앞으로 웹에서 개발/검증할 때는 이 속성이 반드시 필요.

## 확인/테스트 방법과 결과

### 순수 로직 검증 (`npx tsx`, 실제 지도 SDK 없이 `FakeMapProvider` 스텁 사용)
[playback.ts](../../src/services/map/playback.ts)의 `runPlayback`을 그대로 사용하는 가짜 `MapProvider`를 만들어 `RoutePlayer`를 테스트 (스크립트는 세션 스크래치패드에 두고 프로젝트에는 포함하지 않음):
1. `setPoints(5개)` → `drawRoute`가 5개 포인트로 정확히 1회 호출됨 (PASS)
2. 전체 재생 → 끝까지 진행 후 `index=5, playing=false`로 정상 종료 (PASS)
3. 재생 중 `pause()` → 중간 인덱스(예: 1)에서 정확히 멈춤, `playing=false` (PASS)
4. 멈춘 지점에서 `play()` 재개 → 남은 포인트 수(`5 - 1 = 4`)만큼만 `animatePlayback`에 전달됨을 확인 — 처음부터 다시 그리지 않고 정확히 이어서 재생됨 (PASS)
5. 재개된 재생이 다시 끝까지 진행되어 `index=5`로 종료 (PASS)

### 화면 통합 테스트 (Claude 내장 브라우저, `npm run dev`)
1. 브라우저 콘솔에서 `db.service.ts`를 동적 import해 20개 포인트짜리 합성 경로(`phase4-synthetic-walk`)를 직접 DB에 삽입
2. 페이지 새로고침 후 "경로 재생" 탭에서 해당 경로가 드롭다운에 나타나고 `0 / 20`으로 정확히 표시됨 확인 (위 트러블슈팅 수정 후)
3. "재생" 버튼 클릭 — 지도 API 키가 없어 `MapProvider`가 준비되지 않은 상태(`map === null`)에서도 `RoutePlayer.play()`가 안전하게 아무 동작도 하지 않고(크래시 없음) `0 / 20`을 유지함을 확인 — 방어 로직(`if (!this.map ...) return`)이 실제 화면에서도 의도대로 동작
4. 콘솔 에러 없음 확인

### 추가 검증 (2026-09-19, 네이버 지도 API 키 발급 후)
네이버 지도 API 키를 발급받아 `.env`에 설정한 뒤 재확인 — 실제 지도(서울 시청 일대) 위에 15개 포인트짜리 합성 경로의 폴리라인이 정확히 그려졌고, "재생" 클릭 시 마커가 경로를 따라 애니메이션되어 마지막 포인트(15/15)에서 정상적으로 멈추는 것을 육안으로 확인했다. 자세한 내용은 [03-map-providers.md](./03-map-providers.md)의 "네이버 지도 API 키 발급 및 검증" 섹션 참고. (카카오/구글은 키 미발급으로 여전히 미검증.)

## 추가 발견 (Phase 5에서 조사)

Phase 5 작업 중, 이 autoSave 수정 이후에도 새로고침 시 데이터가 간헐적으로 안 보이는 현상이 남아있음을 발견하고 추가로 조사했다. 근본 원인과 추가 완화 조치는 [05-visit-photos-memos.md](./05-visit-photos-memos.md)의 트러블슈팅 섹션 참고 — 완전히 해결되지는 않은 웹 전용 타이밍 이슈로 남아있다.

## 알려진 제약사항 / TODO
- 재생 중 사용자가 경로를 다른 것으로 바꾸면 `setPoints()`가 자동으로 `pause()`를 호출하지만, 이 전환이 매끄러운지는 실제 지도에서 아직 확인하지 못함.
- 현재 재생 속도(0.5x~4x)는 `stepMs` 간격만 조절하며, 실제 GPS 기록 간격(수 초~수십 초)과 무관하게 균등한 간격으로 재생됨 — 포인트 간 실제 시간 차이를 반영한 "실시간 비율" 재생은 이번 범위에 포함하지 않음 (필요하면 후속 개선 과제).
- 임시 상단 탭 내비게이션은 Phase 6에서 정리됨.
