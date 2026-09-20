# Phase 1 — 로컬 데이터 저장소 (SQLite)

**날짜**: 2026-09-18
**상태**: 완료

## 목표
경로(route), GPS 포인트(track_points), 체류(visits), 사진(photos), 메모(memos)를 로컬에 구조적으로 저장할 SQLite 스키마와 CRUD 서비스 레이어를 구축한다.

## 수행한 작업

### 1. 패키지 설치
- `@capacitor-community/sqlite@8.1.1` — 네이티브(Android)에서는 SQLite를 직접 사용, 웹에서는 `jeep-sqlite`(sql.js + IndexedDB) 기반 폴백 사용
- `jeep-sqlite@2.8.0` — 브라우저 개발용 웹 컴포넌트 폴백
- `sql.js@1.11.0` (정확히 고정, `--save-exact`) — 아래 "트러블슈팅" 참고

### 2. 스키마 설계 ([schema.ts](../../src/services/db/schema.ts))
- `routes`: 경로 세션 (id, started_at, ended_at, name)
- `track_points`: GPS 포인트 (route_id FK, lat, lng, altitude, accuracy, speed, recorded_at) — `route_id`, `recorded_at` 인덱스
- `visits`: 체류 기록 (route_id FK nullable, centroid_lat/lng, arrived_at, left_at, duration_sec) — `route_id`, `arrived_at` 인덱스
- `photos`: 체류에 연결된 사진 (visit_id FK, file_uri, taken_at, created_at)
- `memos`: 체류에 연결된 메모 (visit_id FK, text, updated_at)
- 버전 관리는 `addUpgradeStatement` 패턴 사용 (`DB_VERSION` 상수를 올리고 새 upgrade 문을 추가하는 방식으로 향후 마이그레이션)

### 3. 서비스 레이어 ([db.service.ts](../../src/services/db/db.service.ts))
- `initDb()` / `closeDb()`: 연결 생성·오픈 (웹에서는 `<jeep-sqlite>` 엘리먼트 자동 주입 + `initWebStore()` 호출)
- Routes: `createRoute`, `endRoute`, `listRoutes`, `getRoutePoints`
- Track points: `insertTrackPoint`
- Visits: `createVisit`, `closeVisit`, `listVisits`, `getVisit`
- Photos: `addPhoto`, `listPhotosForVisit`
- Memos: `upsertMemo`, `getMemoForVisit`
- snake_case(DB) ↔ camelCase(TS) 매핑 함수 포함
- 타입 정의는 [types.ts](../../src/services/db/types.ts)

### 4. 웹 개발환경 설정
- `src/main.tsx`에 `jeep-sqlite/loader`의 `defineCustomElements(window)` 등록 (네이티브에서는 no-op)
- `public/assets/sql-wasm.wasm` 배치 — jeep-sqlite가 기본적으로 `/assets/sql-wasm.wasm` 경로에서 wasm을 로드하기 때문에 필요

## 트러블슈팅 (중요 — 향후 참고용)

**증상**: 브라우저에서 `initWebStore()` 호출 시 `LinkError: WebAssembly.instantiate(): Import #34 "a" "I": function import requires a callable` 발생.

**원인**: `jeep-sqlite@2.8.0`는 내부적으로 `sql.js@^1.11.0`의 JS glue 코드를 번들링하고 있는데, npm이 의존성 트리를 dedup하면서 최신 호환 버전인 `sql.js@1.14.2`를 최상위에 끌어올렸음. 이때 `node_modules/sql.js/dist/sql-wasm.wasm`은 1.14.2 버전인데, jeep-sqlite 번들 안의 JS glue는 1.11.0 기준으로 컴파일되어 있어 wasm↔JS 임포트 시그니처가 맞지 않아 LinkError 발생. (semver 범위상 유효하지만 sql.js는 minor 버전 간에도 wasm ABI가 달라질 수 있음)

**해결**: `npm install sql.js@1.11.0 --save-exact` 로 최상위 `sql.js`를 jeep-sqlite가 기대하는 버전으로 고정 → `node_modules/sql.js/dist/sql-wasm.wasm`을 다시 `public/assets/sql-wasm.wasm`으로 복사 → 정상 동작.

**향후 주의사항**: `npm update` 등으로 `sql.js`가 다시 최신 버전으로 올라가면 이 문제가 재발할 수 있다. `package.json`에 `sql.js`가 정확히 `1.11.0`으로 고정(`"sql.js": "1.11.0"`, 캐럿 없음)되어 있는지 확인할 것. jeep-sqlite를 업그레이드할 때는 그 버전이 요구하는 sql.js 버전도 함께 맞춰야 한다.

## 확인/테스트 방법과 결과
- `npm run build` (tsc + vite build) — 성공
- 브라우저 수동 통합 테스트: `App.tsx`에 임시 스모크 테스트 코드를 추가해 `npm run dev`로 실행 후 Claude 내장 브라우저로 접속, 콘솔 로그 확인:
  - `[phase1-smoke-test] OK { routeId: 1, points: Array(1), visitId: 1, memo: {...} }`
  - `createRoute` → `insertTrackPoint` → `getRoutePoints` → `createVisit` → `upsertMemo` → `getMemoForVisit` 전체 흐름이 실제로 IndexedDB 기반 SQLite에 저장/조회됨을 확인
  - 테스트 코드는 확인 후 `App.tsx`에서 제거함 (실제 화면은 Phase 6에서 구성)
- 네이티브 Android(`@capacitor-community/sqlite`의 실제 SQLite 구현)에서의 동작은 아직 검증하지 않음 — Phase 7 실기기 검증에서 확인 필요.

## 추가 수정 (Phase 4에서 발견)

Phase 4 작업 중, 브라우저 새로고침 후 이전에 저장한 데이터가 사라지는 문제를 발견했다. 원인은 `<jeep-sqlite>` 엘리먼트에 `autoSave` 속성을 설정하지 않아 DB가 메모리에만 존재하고 IndexedDB에 실제로 저장되지 않았기 때문. `ensureWebStore()`에서 엘리먼트 생성 시 `el.setAttribute('autoSave', 'true')`를 추가해 해결. 네이티브 Android(실제 SQLite 파일 시스템 저장)에는 영향 없는, 웹 개발 폴백에만 해당하는 이슈였음. 자세한 내용은 [04-route-replay.md](./04-route-replay.md) 참고.

## 알려진 제약사항 / TODO
- 암호화(SQLCipher) 미적용 — MVP는 평문 저장. 필요 시 `createConnection`의 `encrypted`/`mode` 인자와 `setEncryptionSecret`을 사용해 추가 가능.
- 네이티브 Android 실제 SQLite 동작 검증은 Phase 7로 이연.
- `sql.js` 버전이 향후 업그레이드 시 다시 어긋날 수 있으므로, 의존성 업데이트 시 이 레포트의 트러블슈팅 섹션을 먼저 확인할 것.
