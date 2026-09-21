# 아키텍처 개요

각 Phase의 상세한 작업 기록은 [reports/00-index.md](./reports/00-index.md)를 참고. 이 문서는 코드를 처음 보는 사람이 전체 구조를 빠르게 파악하기 위한 요약이다.

## 스택
- Capacitor 하이브리드 앱 (Vite + React + TypeScript, `android/`에 네이티브 프로젝트)
- 로컬 저장: `@capacitor-community/sqlite` (네이티브는 실제 SQLite 파일, 웹 개발환경은 `jeep-sqlite`+IndexedDB 폴백)
- 위치: `@capacitor-community/background-geolocation` (추적 기록용, Android/iOS 전용) + `@capacitor/geolocation` (권한 요청, 현재 위치 1회 조회, 지도 화면의 실시간 위치 표시용 `watchPosition`)
- 지도: 네이버/카카오/구글 3개 모두 **WebView 안에서 JS SDK로 로드** (네이티브 지도 플러그인 미사용 — 이유는 [reports/03-map-providers.md](./reports/03-map-providers.md) 참고)
- 사진: `@capacitor/camera` + `@capacitor/filesystem`
- 장소명 조회: OpenStreetMap Nominatim (무료 공개 API, 인증 불필요 — [reports/08-place-info-and-live-tracking.md](./reports/08-place-info-and-live-tracking.md) 참고)
- 설정 저장: `@capacitor/preferences`
- 알림 권한: `@capacitor/local-notifications`
- 네이티브 확인 다이얼로그: `@capacitor/dialog` (Capacitor WebView에서 `window.confirm()`이 동작하지 않아 대체)

## 데이터 흐름
```
BackgroundGeolocation.addWatcher (네이티브 GPS 콜백, 5초 경과 시간으로 스스로 스로틀링 — Phase 13)
                                                     ▼
geolocation.service.ts ── insertTrackPoint ──▶ SQLite: track_points
        │                 (haversine 거리 누적 → 추적 종료 시 routes.distance_meters/duration_sec 저장, Phase 12)
        ▼
StayDetector (순수 로직, stay-detector.ts)
        │  stay-started 이벤트 (반경 내 체류 임계값 도달)
        ▼
place-info.service.ts ── 중복 위치 아니면 Nominatim 조회 후 저장 ──▶ SQLite: place_info (source='stay')

MapScreen의 "위치 저장" / "사진 촬영" 버튼
        ▼
place-info.service.ts ── (사진 촬영 시 photo.service로 파일 저장) ──▶ SQLite: place_info (source='manual'|'photo')

Geolocation.watchPosition (MapScreen, 추적 여부와 무관하게 항상 동작)
        ▼
MapProvider.setCurrentLocationMarker() — 지도에 "현재 위치" 마커 갱신
```

## DB 스키마 (schema.ts, v4)
- `routes` — 하나의 추적 세션 (시작/종료 시각, 종료 시 "YYYY-MM-DD HH:mm:ss" 형식 이름 부여, `distance_meters`/`duration_sec`는 v4에서 추가 — Phase 12)
- `track_points` — route에 속한 개별 GPS 포인트 (5초 간격으로 저장)
- `place_info` (v2 신설) — "장소 정보" 통합 테이블. `source`(`photo`/`stay`/`manual`), `lat`/`lng`, `place_label`(Nominatim 결과), `photo_uri`(nullable), `recorded_at`, `title`("날짜_시간_장소" 또는 "시간_장소")
- `visits`/`photos`/`memos` — Phase 1~5에서 쓰던 이전 스키마. Phase 8에서 `place_info`로 대체되어 더 이상 UI에서 사용하지 않지만, 마이그레이션 없이 테이블 자체는 남겨둠 (실사용 데이터 없어 안전하게 방치).

## 지도 추상화 (`src/services/map/`)
`MapProvider` 인터페이스(`init/setCenter/drawRoute/addMarker/clearMarkers/setCurrentLocationMarker/animatePlayback/destroy`)를 네이버/카카오/구글 세 어댑터가 각각 구현한다. 화면 코드는 이 인터페이스만 알고, 실제 어떤 지도 SDK가 쓰이는지는 `map-provider.factory.ts`가 설정값(`settings.service.ts`에 저장된 provider)에 따라 결정한다. API 키가 없으면 `MapProviderKeyMissingError`를 던지고, `MapView.tsx`가 이를 잡아 화면에 안내 메시지를 보여준다 (크래시 없음).

경로 재생(Phase 4)은 `route-player.ts`의 `RoutePlayer`가 담당 — React와 분리된 순수 상태 머신이라 실제 지도 SDK 없이도(가짜 `MapProvider`로) 재생/일시정지/재개 로직을 테스트할 수 있다.

## 체류 감지 알고리즘 (`stay-detector.ts`)
롤링 센트로이드 + 반경 방식. 새 포인트가 현재 클러스터 반경(기본 3m — Phase 8에서 75m→3m로 변경) 안이면 센트로이드를 갱신하고, 클러스터 시작 후 경과 시간이 임계값(기본 5분 — Phase 8에서 3분→5분으로 변경)을 넘으면 `stay-started`를 낸다. 반경 밖 포인트가 연속 2회 나와야 `stay-ended`로 확정. `stay-started` 시점에 `place-info.service.ts`가 중복(같은 위치에 이미 저장된 `stay` 레코드) 여부를 확인 후 Nominatim으로 장소명을 조회해 저장한다. 자세한 내용은 [reports/02-gps-tracking-stay-detection.md](./reports/02-gps-tracking-stay-detection.md), [reports/08-place-info-and-live-tracking.md](./reports/08-place-info-and-live-tracking.md).

## 화면 구조 (`src/screens/`, `src/App.tsx`)
하단 탭 4개:
- **지도** — 실시간 위치 마커, 추적 시작/중지, 위치 저장(수동), 사진 촬영(추적 중일 때만 활성화)
- **기록** — `RecordsTab`이 `RouteListScreen`(목록, `<` 뒤로가기, "삭제" 버튼으로 체크박스 다중 선택+`Dialog.confirm` 삭제) ↔ `RouteDetailScreen`(지도+재생 컨트롤, "닫기") 전환을 관리
- **장소 정보** — `PlaceInfoTab`이 `PlaceInfoListScreen`(목록, `<` 뒤로가기) ↔ `PlaceInfoDetailScreen`(사진/위치정보/장소/날짜시간 순서, `<` 뒤로가기) 전환을 관리
- **설정** — 지도 provider, 체류 감지 반경/시간

각 목록의 "뒤로가기"는 App.tsx가 지도 탭으로 이동시키는 콜백. 별도 라우터 라이브러리 없이 `useState`로 전환. `App.tsx`가 마운트 시 `db.initDb()`를 한 번 호출해, 지도 탭(DB를 쓰는 다른 화면을 거치지 않고도 "위치 저장" 등을 바로 쓸 수 있는 화면)에서도 DB가 준비되어 있도록 보장한다. 각 탭 콘텐츠는 `<ErrorBoundary key={tab}>`로 감싸져 있어(Phase 14), 화면이 렌더링/언마운트 중 예외를 던져도 앱 전체가 빈 화면으로 죽지 않고 복구 UI를 보여준다.

## 알려진 미해결 이슈
- **웹 개발 환경 전용**: `jeep-sqlite`가 새로고침 직후 간헐적으로 데이터를 비어있는 것처럼 보여주는 타이밍 이슈가 있음 ([reports/05-visit-photos-memos.md](./reports/05-visit-photos-memos.md)). 실기기 테스트에서는 재현되지 않아 네이티브 SQLite와 무관한 웹 전용 이슈로 확인됨.
- **카카오/구글 지도 렌더링 미검증** — 네이버 지도는 API 키 발급 후 실제 렌더링/폴리라인/재생까지 검증 완료. 카카오/구글은 아직 키를 발급받지 않아 미검증 ([reports/03-map-providers.md](./reports/03-map-providers.md)).
- **반경 10m 내 건물/문화재/정류장 등 카테고리별 장소 정보 미구현** — Nominatim은 주소/도로명 수준만 제공. 카테고리별 POI가 필요하면 별도 백엔드 + 네이버/카카오 지역검색 API 연동이 필요 ([reports/08-place-info-and-live-tracking.md](./reports/08-place-info-and-live-tracking.md)).
- **3m 체류/중복감지 반경이 실제 GPS 정확도보다 타이트함** — 사용자가 명시한 값을 그대로 구현했으나, 실사용 시 중복 감지가 기대만큼 안 잡힐 수 있음.
- **네이버 지도 인증이 간헐적으로 실패함** — 같은 API 키로도 성공/실패가 오가는 것을 관찰함(원인 미확인: NCP 트래픽 제한/서비스 URL 제약/네트워크 추정). Phase 14에서 이 상태여도 앱이 크래시하지 않도록는 고쳤지만, 지도 자체가 안 보이는 근본 원인은 미해결 ([reports/14-white-screen-crash.md](./reports/14-white-screen-crash.md)).

## 실기기 검증에서 발견/수정한 버그
**Phase 7** (자세히: [reports/07-build-verification.md](./reports/07-build-verification.md)):
1. `POST_NOTIFICATIONS` 권한을 요청하지 않아 백그라운드 추적 알림이 표시되지 않던 문제 — `@capacitor/local-notifications`로 명시적 요청 추가.
2. 위치 권한을 처음 승인하는 콜드 스타트 시점에, 권한 전파가 끝나기 전에 포그라운드 서비스가 시작되어 `SecurityException`이 발생하고 JS에는 전달되지 않아 "추적 중"으로 잘못 표시되던 레이스 컨디션 — `@capacitor/geolocation`으로 권한을 먼저 명시적으로 요청/대기한 뒤 `addWatcher(requestPermissions: false)`를 호출하도록 수정.
3. Vite 기본 템플릿의 `body { display: flex; place-items: center }` 때문에 화면이 전체를 못 채우던 문제 — `html/body/#root`에 `width/height: 100%` 명시로 수정.

**Phase 8** (자세히: [reports/08-place-info-and-live-tracking.md](./reports/08-place-info-and-live-tracking.md)):
4. 지도 탭(기본 화면)에서 DB를 초기화하는 화면을 거치지 않아 "위치 저장"이 실패 — App.tsx 최상위에서 `db.initDb()` 선호출.
5. Capacitor Android WebView에서 `window.confirm()`이 항상 무시됨 — `@capacitor/dialog`의 `Dialog.confirm()`으로 교체.
6. 네이티브 `file://` 사진 경로를 `<img>`에 직접 써서 이미지가 안 보임 — `Capacitor.convertFileSrc()` 적용.

**Phase 9** (자세히: [reports/09-track-points-migration-bug.md](./reports/09-track-points-migration-bug.md)):
7. **[치명적]** `@capacitor-community/sqlite`의 Android 마이그레이션 `statements` 배열에 세미콜론으로 연결된 멀티스테이트먼트 문자열을 통째로 넣으면, 안드로이드의 `execSQL()`이 첫 문장만 실행하고 나머지를 조용히 버림 — `track_points`/`visits`/`photos`/`memos` 테이블이 기기에 한 번도 생성되지 않았던 원인. 배열 원소를 SQL 문 하나당 하나로 재작성하고, 기존에 손상된 기기를 복구하는 자가 치유 마이그레이션(`SCHEMA_V3`, `IF NOT EXISTS`로 안전)을 추가해 해결.
8. `RouteDetailScreen`에서 지도(`MapProvider`)와 포인트 로딩이 서로 다른 시점에 준비되면 지도가 초기 기본 좌표에 머무르던 문제 — 둘 다 `useState`로 관리하고 `useEffect([map, points])`로 통합해 해결.

**Phase 16** (자세히: [reports/16-route-photo-markers.md](./reports/16-route-photo-markers.md)):
- 경로 상세 화면이 `track_points`/`routes`만 조회하고 같은 route_id의 `place_info`(사진)는 조회하지 않아, 추적 중 촬영한 사진 위치가 지도에 전혀 표시되지 않던 문제 — `db.listRoutePhotos(routeId)`를 추가해 조회하고, 보라색 카메라 아이콘 마커(`marker-icon.ts`의 `cameraPinIconHtml`/`cameraPinIconDataUri`, `MapProvider.addMarker`의 `icon: 'camera'` 옵션)로 표시.

**Phase 14** (자세히: [reports/14-white-screen-crash.md](./reports/14-white-screen-crash.md)):
- 지도 API 키 인증이 실패한 상태에서 지도 화면을 떠날 때(`MapProvider.destroy()`가 Naver SDK의 마커에 `.setMap(null)` 호출) SDK 내부에서 예외가 발생, React의 언마운트 커밋 단계로 전파되어 앱 전체가 빈 화면으로 죽는 크래시 — 세 지도 어댑터의 SDK 호출을 try/catch(`safeCall`)로 감싸 근본 원인을 제거하고, `src/ErrorBoundary.tsx`로 앱 전체에 방어선을 추가.

**Phase 10** (자세히: [reports/10-route-path-not-visible.md](./reports/10-route-path-not-visible.md)):
9. 경로 상세 화면이 시작 위치에 고정 줌(16)으로만 카메라를 맞춰, 실제 이동 거리가 화면 폭(약 300m)을 넘으면 경로 나머지 구간과 종료 위치가 화면 밖으로 벗어나 "위치 하나만 기록된 것처럼" 보이던 문제 — `MapProvider`에 `fitBounds(points)`를 추가해 항상 전체 경로가 화면에 들어오도록 수정.

**Phase 11** (자세히: [reports/11-departure-arrival-markers.md](./reports/11-departure-arrival-markers.md)):
- 경로 상세 화면의 시작/종료 마커를 "출발"(파란색)/"도착"(빨간색)으로 색상 구분. `MapProvider.addMarker`에 `color` 옵션을 추가하고, `src/services/map/marker-icon.ts`의 공용 SVG 헬퍼로 세 지도 SDK 모두 동일한 모양의 마커를 그림.

**Phase 12** (자세히: [reports/12-route-distance-duration.md](./reports/12-route-distance-duration.md)):
- 경로 연결선 색상을 RGB(134, 229, 127)로 변경.
- `routes` 테이블에 `distance_meters`/`duration_sec` 추가(`SCHEMA_V4`), 추적 중 5초 포인트마다 haversine 거리를 누적해 추적 종료 시 총 이동 거리/시간을 저장. 세 곳에 중복돼 있던 haversine 구현을 `src/utils/geo.ts`로 통합.
- 경로 상세 화면 우측 상단에 "기록 정보"(이동 거리/이동 시간) 패널 추가.

**Phase 13** (자세히: [reports/13-background-tracking-not-saving.md](./reports/13-background-tracking-not-saving.md)):
- 앱이 백그라운드로 가면 위치가 더 이상 저장되지 않던 문제 — 저장 트리거가 JS `setInterval`(백그라운드에서 스로틀링/정지될 수 있음)이었던 것을, 네이티브 위치 콜백에서 직접 저장(경과 시간으로 5초 간격 유지)하도록 변경.
