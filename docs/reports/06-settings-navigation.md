# Phase 6 — 설정 화면 통합 + 전체 UX 연결

**날짜**: 2026-09-19
**상태**: 완료

## 목표
지도 공급자 전환, 추적 on/off, 체류 감지 임계값(반경/시간)을 하나의 설정 화면으로 모으고, 지금까지 임시로 상단 버튼으로 연결해 두었던 화면들을 정식 하단 탭 내비게이션(지도/기록/체류 기록/설정)으로 정리한다.

## 수행한 작업

### 1. 설정 저장 확장 ([settings.service.ts](../../src/services/settings/settings.service.ts))
기존 지도 provider 설정에 더해 다음을 `@capacitor/preferences`로 저장:
- `settings.stayRadiusMeters` — 체류 판정 반경 (기본 75m)
- `settings.stayMinDurationMin` — 체류 판정 최소 시간, 분 단위 (기본 3분)

### 2. 설정 화면 ([SettingsScreen.tsx](../../src/screens/SettingsScreen.tsx))
- 지도 공급자 3버튼 선택 (Phase 3에서 `MapScreen`에 있던 것을 이곳으로 이동)
- 체류 반경/최소 시간 숫자 입력 + 저장 버튼 ("저장됨" 일시 표시로 피드백)
- 저장된 값은 [geolocation.service.ts](../../src/services/geolocation/geolocation.service.ts)의 `startTracking()`이 매번 추적 시작 시점에 읽어서 `StayDetector`에 주입하도록 연결 (Phase 2에서 하드코딩되어 있던 기본값을 설정 가능하게 변경)

### 3. 지도 화면 정리 ([MapScreen.tsx](../../src/screens/MapScreen.tsx))
- 지도 공급자 선택 버튼 제거 (설정으로 이동), 대신 "추적 시작/중지" 버튼과 상태 텍스트 추가
- `geolocation.service`의 `startTracking()`/`stopTracking()`/`isTracking()`을 호출하며, 실패 시 에러 메시지를 화면에 표시 (크래시 대신 우아한 처리 — Phase 3의 지도 에러 처리와 동일한 패턴)

### 4. 정식 하단 탭 내비게이션 ([App.tsx](../../src/App.tsx))
Phase 3~5에서 임시로 얹어뒀던 상단 버튼 전환을 걷어내고, 4개 탭(지도/기록/체류 기록/설정)의 하단 내비게이션 바로 교체. 별도 라우터 라이브러리 없이 내부 상태(`useState<Tab>`)로 화면을 전환 — 화면 수가 4개로 고정되어 있고 딥링크/브라우저 히스토리가 필요 없는 하이브리드 앱 특성상 라우터 도입은 과함(불필요한 추상화)이라 판단.

## 확인/테스트 방법과 결과
- `npm run build` — 성공
- 브라우저(Claude 내장 브라우저)로 검증:
  - 하단 탭 4개(지도/기록/체류 기록/설정) 정상 렌더링, 탭 전환 정상 동작
  - 설정 화면에서 반경/시간 입력값 변경 → 저장 → 다른 탭으로 이동했다가 설정으로 돌아와도 입력값(100m/5분)이 유지됨 확인 (Preferences 저장/조회 정상)
  - 설정에서 지도 공급자를 "카카오맵"으로 변경 → "지도" 탭으로 이동 시 실제로 카카오 provider로 전환되어 렌더링됨 확인 (설정 → 지도 화면 간 연동 정상)
  - "추적 시작" 버튼 클릭 시 크래시 없음. 별도로 `BackgroundGeolocation.addWatcher()`를 웹에서 직접 호출해 `"BackgroundGeolocation" plugin is not implemented on web` (`code: UNIMPLEMENTED`) 에러가 정상적으로 catch 가능한 형태로 발생함을 확인 — 이 플러그인은 애초에 Android/iOS 전용이라 웹에서 동작하지 않는 것이 설계상 정상이며, `MapScreen`의 try/catch가 이를 화면에 에러 메시지로 표시하도록 되어 있음.
  - **참고**: UI에서 직접 "추적 시작"을 눌렀을 때 에러 메시지가 화면에 안 뜨는 현상을 발견했는데, 원인을 추적한 결과 `startTracking()` 내부에서 제일 먼저 호출하는 `db.initDb()`가 Phase 5에서 문서화한 그 웹 전용 jeep-sqlite 레이스에 걸려 멈춰있었기 때문으로 확인됨 (BackgroundGeolocation 호출까지 도달하지 못함) — Phase 6에서 새로 생긴 문제가 아니라 기존에 알려진 이슈의 재현.
- **미검증**: 실제 Android 기기에서 "추적 시작" → 위치 권한 요청 → 백그라운드 알림 표시 → 지도에 실제 타일 렌더링까지 이어지는 전체 흐름은 API 키와 실기기가 필요해 Phase 7로 이연.

## 알려진 제약사항 / TODO
- 지도 화면에 현재 위치를 실시간으로 마커로 표시하는 기능은 아직 없음 (추적 on/off 상태와 텍스트 안내만 제공) — 후속 개선 과제로 남김.
- 체류 반경/시간 설정은 "다음 추적 시작부터" 적용되며, 추적 도중 값을 바꿔도 즉시 반영되지 않음 (의도된 단순화).
- Phase 5에서 발견한 jeep-sqlite 웹 폴백 레이스 컨디션은 여전히 미해결 상태이며, 이 화면들의 초기 로딩에도 동일하게 영향을 줄 수 있음.
