# 11. 기능 추가: 출발/도착 마커 색상 구분

## 요청

사용자 요청: 기록 상세(이동 경로 보기) 화면에서 시작/종료 위치를 "출발"/"도착"으로 표시하고, 출발은 파란색, 도착은 빨간색으로 구분되어야 함.

## 구현

- `MapProvider.addMarker`의 옵션에 `color?: string`을 추가 (`src/services/map/map-provider.interface.ts`). 생략 시 각 SDK의 기본 마커로 폴백되어 기존 호출부(현재는 `RouteDetailScreen`이 유일)와 호환.
- `src/services/map/marker-icon.ts` 신설: 세 지도 SDK가 동일하게 생긴 마커를 그리도록, 색 하나를 받아 흰 원이 박힌 물방울(pin) 모양 SVG를 만드는 공용 헬퍼(`pinIconHtml`/`pinIconDataUri`)를 정의.
- 네이버: `naver.maps.Marker`의 `icon.content`에 SVG를 인라인 HTML로 전달.
- 카카오: `kakao.maps.MarkerImage`에 SVG를 data URI로 전달.
- 구글: `google.maps.Marker`의 `icon.url`에 동일한 data URI 전달.
- `RouteDetailScreen.tsx`: 마커 타이틀을 "시작 위치"/"종료 위치" → "출발"(`#2563EB`, 파란색)/"도착"(`#DC2626`, 빨간색)으로 변경.

## 검증

DB에 직접 주입한 다지점 테스트 경로([10-route-path-not-visible.md](./10-route-path-not-visible.md)와 동일한 방식)로 확인: 경로 상세 화면에서 출발 지점에 **파란 물방울 마커**, 도착 지점에 **빨간 물방울 마커**가 정상적으로 표시됨(네이버 지도 기준). 확인 후 테스트 경로는 삭제 기능으로 정리함.

카카오/구글 어댑터는 동일한 공용 SVG 헬퍼를 사용하므로 로직상 동일하게 동작해야 하나, 두 지도는 API 키 미발급으로 실제 렌더링 검증은 아직 진행하지 못함 (기존 [03-map-providers.md](./03-map-providers.md)에서 언급된 제약과 동일).
