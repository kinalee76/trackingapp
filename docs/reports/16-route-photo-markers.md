# 16. 기능 추가: 경로 상세 화면에 촬영 위치 카메라 마커 표시

## 요청

추적 중 사진을 촬영하면 위치 정보와 함께 저장되는데(Phase 8), 그 경로의 상세("이동 경로 보기") 화면에서는 촬영 위치가 전혀 표시되지 않았음. 해당 추적 기록을 볼 때 사진이 촬영된 위치에 카메라 아이콘으로 표시해달라는 요청.

## 원인

사진 촬영 시 `place-info.service.ts`의 `savePhotoPlaceInfo()`가 `route_id`를 포함해 `place_info` 테이블(`source='photo'`)에 정상적으로 저장하고 있었음 — 즉 DB에는 위치 데이터가 이미 정확히 연결되어 있었다. 문제는 `RouteDetailScreen`이 `track_points`(경로)와 `routes`(거리/시간 통계)만 조회할 뿐, 같은 `route_id`를 가진 `place_info`를 한 번도 조회하지 않았던 것 — 화면에 표시할 데이터 자체를 가져오지 않고 있었다.

## 구현

- `db.service.ts`에 `listRoutePhotos(routeId)` 추가 — `SELECT * FROM place_info WHERE route_id = ? AND source = 'photo' ORDER BY recorded_at ASC`.
- `marker-icon.ts`에 카메라 글리프 버전의 핀 아이콘(`cameraPinIconHtml`/`cameraPinIconDataUri`) 추가 — 기존 출발/도착에 쓰던 물방울 핀과 동일한 외곽선에, 흰 원 대신 흰색 카메라 실루엣(몸체+렌즈)을 그려 넣음.
- `MapProvider.addMarker` 옵션에 `icon?: 'pin' | 'camera'`를 추가하고, 네이버/카카오/구글 세 어댑터 모두에서 `icon === 'camera'`일 때 카메라 아이콘을 사용하도록 분기.
- `RouteDetailScreen.tsx`가 경로 로드 시 `db.listRoutePhotos(routeId)`도 함께 조회해 `photos` 상태로 보관하고, 지도 갱신 이펙트에서 각 사진 위치에 보라색(`#7C3AED`) 카메라 마커를 추가.

## 검증

실기기의 실제 사용 기록(사용자가 직접 5.39km/58:08 동안 추적하며 촬영한 경로)으로 확인 — 경로 상세 화면에 보라색 카메라 마커가 도착 지점 근처, 실제 촬영 위치에 정확히 표시됨을 확인.
