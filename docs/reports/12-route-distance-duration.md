# 12. 기능 추가: 이동 거리/시간 저장 + 경로 색상 지정 + "기록 정보" 표시

## 요청

- 경로 상세("이동 경로 보기") 화면에서 시작 위치와 5초 간격 경로를 잇는 연결선을 RGB(134, 229, 127) 색상으로 표시.
- 추적 시작~종료까지의 총 이동 거리(Km, 소수점 2자리)와 총 이동 시간(MM:SS)을 저장.
- 기록 상세 화면 우측 상단에 "기록 정보" 패널로 위 두 값을 표시.

## 구현

### 경로 연결선 색상
- 네이버/카카오/구글 세 어댑터의 `drawRoute()`에서 `strokeColor: '#4F46E5'` → `strokeColor: 'rgb(134, 229, 127)'`로 변경.

### 이동 거리/시간 저장
- `routes` 테이블에 `distance_meters REAL`, `duration_sec INTEGER` 컬럼 추가 (`SCHEMA_V4`, `ALTER TABLE ... ADD COLUMN`을 각각 별도 배열 원소로 — [09번 리포트](./09-track-points-migration-bug.md)에서 겪은 "배열 원소 하나에 여러 문장" 실수를 반복하지 않도록 주의). `DB_VERSION`을 4로 상향.
- `db.service.ts`에 `getRoute(routeId)`, `updateRouteStats(routeId, distanceMeters, durationSec)` 추가. `Route` 타입에 `distanceMeters`/`durationSec` 필드 추가.
- `geolocation.service.ts`: 추적 중 5초마다 저장되는 포인트마다, 직전에 저장한 포인트와의 haversine 거리를 누적(`totalDistanceMeters`) — 매번 전체 `track_points`를 다시 불러와 합산하지 않고 O(1)로 계산. 추적 종료(`stopTracking`) 시 `durationSec = (종료시각 - 시작시각)`과 함께 `db.updateRouteStats()`로 저장.
- 세 곳에 중복돼 있던 haversine 구현(`db.service.ts`, `stay-detector.ts`, 그리고 이번에 새로 필요해진 거리 누적 로직)을 `src/utils/geo.ts`의 공용 `haversineMeters()`로 통합. 같은 파일에 "00.00 Km" 형식 포맷터 `formatDistanceKm()`도 추가. `src/utils/datetime.ts`에는 "00:00"(MM:SS, 분은 60 넘어가면 그대로 3자리 이상으로 늘어남) 포맷터 `formatDurationClock()` 추가.

### "기록 정보" 패널
- `RouteDetailScreen.tsx`: 지도 영역(`position: relative`)에 절대 위치(`top:8, right:8`)로 반투명 카드를 얹어 "기록 정보" 제목과 `이동 거리 : {포맷}` / `이동 시간 : {포맷}`을 표시. 값이 없는 기존 경로(마이그레이션 이전에 저장된 경로 등)는 `-`로 표시.

## 검증

실기기에서 확인: 경로 상세 화면 우측 상단에 "기록 정보" 패널이 "이동 거리 : 00.01 Km" / "이동 시간 : 10:37" 형식으로 정상 표시됨(637초 → "10:37" 변환 정확). 마커는 출발(파란색)/도착(빨간색)으로 구분되어 표시되고, 그 사이를 잇는 연결선이 RGB(134, 229, 127) 초록색으로 렌더링됨을 확인(다만 테스트 시 실제 이동 거리가 6m 남짓으로 매우 짧아 선 자체는 화면상 매우 짧게 보임 — [13-background-tracking-not-saving.md](./13-background-tracking-not-saving.md)의 검증과 같은 세션에서 함께 확인).
