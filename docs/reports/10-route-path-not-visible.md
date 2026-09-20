# 10. 버그 수정: 이동 경로가 지도에 연결되어 표시되지 않던 문제

## 증상

사용자 리포트: "추적 시작 → 5초 간격 저장 → 추적 종료 → 기록에서 항목 선택" 흐름은 정상 동작하지만, "이동 경로 보기" 화면에서 **시간 순서로 이어진 전체 경로가 아니라 위치 하나(최종 위치)만 보인다.**

## 원인

`RouteDetailScreen`이 지도를 준비시킬 때 항상 다음과 같이 처리하고 있었다:

```ts
map.setCenter(points[0]);       // 시작 위치로 카메라 이동
// zoom은 MapView 초기화 시 고정값 16
```

포인트를 잇는 폴리라인 자체(`drawRoute`)는 Phase 4부터 정상적으로 그려지고 있었지만, **카메라는 항상 시작 위치 좌표에 고정 줌 레벨(16, 대략 300m 폭)로만 이동**했다. 실제 이동 거리가 이 범위를 넘어서면(도보로 몇 백 미터만 이동해도 쉽게 발생) 경로의 나머지 구간과 종료 위치가 화면 밖으로 벗어나, 사용자 입장에서는 "경로가 연결되어 안 보이고 위치 하나만 있다"로 보이게 된다.

Phase 9에서 진행한 실기기 검증(추적 시작 → 35초 대기 → 종료)은 휴대폰을 책상 위에 고정한 채 진행되어 모든 포인트가 사실상 같은 좌표였고, 그 결과로는 이 문제가 드러나지 않았다 — 이번에 사용자가 실제 이동을 포함한 시나리오로 재확인하며 발견됨.

## 수정

- `MapProvider` 인터페이스(`src/services/map/map-provider.interface.ts`)에 `fitBounds(points: LatLng[]): void`를 추가 — 주어진 모든 포인트가 한 화면에 들어오도록 카메라를 이동/줌 조정한다.
- 네이버(`naver.maps.LatLngBounds` + `map.fitBounds()`), 카카오(`kakao.maps.LatLngBounds` + `map.setBounds()`), 구글(`google.maps.LatLngBounds` + `map.fitBounds()`) 세 어댑터 모두에 구현 추가. 포인트가 1개뿐이면 기존 `setCenter`로 폴백.
- `RouteDetailScreen.tsx`: `map.setCenter(points[0])` 호출을 `map.fitBounds(points)`로 교체. 이제 경로 길이와 무관하게 전체 경로(시작~종료 마커 + 폴리라인)가 항상 화면에 들어온다.

## 검증

실제로 걸어서 테스트하기 어려운 상황이라, 기기의 SQLite DB 파일을 직접 조작해 검증했다:

1. `adb exec-out "run-as com.naddle.trackingapp cat .../trackingappSQLite.db"`로 실행 중인 앱의 DB를 로컬로 pull (일반 `adb shell ... > file` 방식은 개행 변환으로 파일이 깨져 `database disk image is malformed` 오류가 났음 — `exec-out`을 써야 바이너리가 안전하게 보존됨).
2. 로컬 `sqlite3.exe`로 약 1km 거리(위도/경도 각각 0.0063°/0.0081° 이동, 5초 간격 10개 지점)를 이동하는 가짜 경로("2026-09-20 테스트경로(이동)")를 `routes`/`track_points`에 직접 INSERT.
3. `adb push` + `run-as ... cp`로 수정된 DB를 다시 기기에 반영, 앱 강제 종료 후 재시작.
4. 기록 목록에서 해당 테스트 경로를 열어 확인: **지도가 자동으로 300m 축척까지 줌아웃되어, 시작 마커와 종료 마커, 그리고 그 사이를 잇는 폴리라인 전체가 한 화면에 모두 표시됨.** 재생 버튼도 0/10 → 10/10까지 정상 재생 확인.
5. 검증에 사용한 테스트 경로는 Phase 9에서 구현한 삭제 기능으로 정리(선택 모드 → 체크 → "진짜 삭제할꺼야?" → 응) — 삭제 기능도 함께 재검증됨.

결과: `fitBounds` 도입으로 문제가 완전히 해결됨을 확인.
