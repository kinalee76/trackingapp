# Phase 8 — 실시간 위치 표시, 5초 간격 추적, 경로 목록/상세 화면, "장소 정보" 기능

**날짜**: 2026-09-20
**상태**: 완료 — 실기기에서 전체 흐름 검증 완료 (버그 4건 발견 및 수정)

## 목표
사용자가 대화로 직접 지정한 아래 요구사항을 구현한다:
1. 지도에 현재 위치를 실시간으로 표시하고 이동 시마다 갱신
2. 추적 시작 후 5초마다 위치를 저장, 추적 종료 시 경로를 날짜+시간 이름으로 저장
3. 경로 목록 화면 → 선택 시 "이동 경로 보기" 화면(지도에 경로 표시) → 닫기 시 목록으로, 목록에서 `<`로 이전 화면으로
4. "장소 정보" 개념 신설: 추적 중 사진 촬영 시 날짜/시간/위치/사진/장소(반경 10m 내 정보)를 저장하고 "시간_장소"를 제목으로 사용
5. 기존 체류 감지(반경 3m, 5분)를 "장소 정보" 저장으로 통합, 동일 위치는 중복 저장하지 않음
6. 신규 "위치 저장" 기능: 수동으로 현재 위치를 저장, 이미 저장된 위치면 새로 추가할지 확인 후 저장
7. "장소 정보" 목록/상세 화면 (목록은 날짜_시간 제목, 상세는 사진→위치정보→장소→날짜/시간 순서, `<` 뒤로가기)

## 사전 확인 (사용자와 논의)
"반경 10m 내 중요한 건물/문화재/버스정류장/거리명 등 하나의 정보"를 실제로 가져오려면 장소 검색 API가 필요한데, 이런 카테고리별 POI 검색은 보통 서버 인증(시크릿 키) 방식이라 백엔드가 없는 이 앱 구조에서는 브라우저/WebView에서 안전하게 직접 호출할 수 없다는 점을 사용자에게 설명하고, 대안으로 **무료 오픈 API인 OpenStreetMap Nominatim**(서버 없이 클라이언트에서 바로 호출 가능, 인증키 불필요)으로 도로명/동 이름 수준의 "장소" 정보를 가져오는 방식을 선택함. 건물명·문화재·정류장까지 세분화된 카테고리는 제공하지 않음 — 아래 "알려진 제약사항" 참고.

## 주요 설계 결정

### DB 스키마 v2 — `place_info` 테이블 신설
기존 `visits`/`photos`/`memos` 테이블은 그대로 남겨두고(마이그레이션 없이, 사용하지 않는 상태로 방치 — 아직 실사용자 데이터가 없어 안전), 새로운 통합 테이블 `place_info`를 추가:
- `source`: `'photo' | 'stay' | 'manual'`
- `lat`, `lng`, `place_label`(Nominatim 결과), `photo_uri`(nullable), `recorded_at`, `title`

메모(memo) 기능은 사용자가 재정의한 "장소 정보" 상세 화면 구성(사진/위치정보/장소/날짜시간)에 포함되지 않아 이번 화면에서는 제외함 — 기존 `memos` 테이블 자체는 삭제하지 않았으므로 필요 시 후속 작업으로 복원 가능.

### 경로 목록/상세 분리, 장소 정보 목록/상세 분리
[VisitListScreen.tsx](../../src/screens/VisitListScreen.tsx)/[VisitDetailScreen.tsx](../../src/screens/VisitDetailScreen.tsx)를 삭제하고, 기존 `RouteReplayScreen.tsx`(드롭다운+지도 한 화면)를 [RouteListScreen.tsx](../../src/screens/RouteListScreen.tsx) + [RouteDetailScreen.tsx](../../src/screens/RouteDetailScreen.tsx)로 분리. "장소 정보"도 동일한 목록/상세 패턴으로 [PlaceInfoListScreen.tsx](../../src/screens/PlaceInfoListScreen.tsx) + [PlaceInfoDetailScreen.tsx](../../src/screens/PlaceInfoDetailScreen.tsx)를 신설. 각 탭의 목록↔상세 전환은 [RecordsTab.tsx](../../src/screens/RecordsTab.tsx)/[PlaceInfoTab.tsx](../../src/screens/PlaceInfoTab.tsx)라는 얇은 래퍼가 내부 상태로 관리하고, 목록의 `onBack`은 App.tsx가 지도 탭으로 이동시키는 콜백을 전달. 하단 탭은 지도/기록/**장소 정보**/설정으로 재편(기존 "체류 기록" 탭을 대체).

### 실시간 위치 표시와 추적 기록을 분리된 두 watcher로 처리
[MapScreen.tsx](../../src/screens/MapScreen.tsx)는 화면이 떠 있는 동안 `@capacitor/geolocation`의 `watchPosition`으로 항상 현재 위치 마커를 갱신(추적 on/off와 무관, "위치 저장"·"사진 촬영"과도 별개). 실제 경로 기록은 여전히 [geolocation.service.ts](../../src/services/geolocation/geolocation.service.ts)의 `BackgroundGeolocation` watcher가 맡음 — 두 watcher가 동시에 GPS를 사용하는 배터리 비용이 있으나, "추적 여부와 무관하게 항상 현재 위치를 보여준다"는 요구를 가장 단순하게 만족하는 방법으로 판단.

### 5초 간격 저장 (거리 기반 → 시간 기반으로 변경)
`distanceFilter: 10` → `distanceFilter: 0`으로 바꿔 OS가 주는 모든 위치 업데이트를 받고, 그 중 가장 최근 값을 `setInterval(..., 5000)`로 5초마다 하나씩 저장하도록 변경. GPS 업데이트 자체가 5초보다 뜨문뜨문 오는 경우 같은 포인트가 중복 저장될 수 있음(추후 개선 여지, 큰 문제는 아님).

### 지도 추상화에 "현재 위치 마커" 추가
[map-provider.interface.ts](../../src/services/map/map-provider.interface.ts)에 `setCurrentLocationMarker(position)`를 추가하고 네이버/카카오/구글 세 어댑터 모두에 구현 (기존 `animatePlayback`의 재생 마커와 동일한 "한 번 생성, 이후 위치만 갱신" 패턴).

### 체류 감지 → "장소 정보" 통합, 중복 방지
[place-info.service.ts](../../src/services/place-info/place-info.service.ts)의 `saveStayPlaceInfo()`가 `stay-started` 이벤트 때 호출되며, 같은 `source='stay'`로 저장된 기존 위치가 지정 반경(설정된 체류 반경, 기본 3m) 내에 있으면 저장을 건너뜀 — "한번 저장한 위치는 다시 저장하지 않음" 요구 구현. 거리 비교는 `db.service.ts`의 `findNearbyPlaceInfo()`가 해버사인 공식으로 계산(개인용 앱 규모에서는 전체 스캔으로 충분).

### 기본값 변경
[settings.service.ts](../../src/services/settings/settings.service.ts)의 체류 감지 기본값을 반경 75m/3분 → **3m/5분**으로 사용자 지정값에 맞춰 변경(설정 화면에서 계속 조정 가능).

## 실기기 테스트 중 발견하고 수정한 버그 4건

### 버그 1 — 지도 화면(기본 탭)에서 DB 미초기화로 "위치 저장" 실패
**증상**: 앱을 켜고 바로 "위치 저장"을 누르면 `"위치 저장 실패: DB not initialized — call initDb() first"` 오류.
**원인**: `db.initDb()`를 호출하는 화면(기록/장소 정보 탭 등)을 한 번도 거치지 않고 기본 탭(지도)에서 곧바로 DB 관련 동작을 시도하면 DB 연결이 없었음.
**수정**: [App.tsx](../../src/App.tsx) 최상위에서 앱 시작 시 한 번 `db.initDb()`를 호출하도록 추가.

### 버그 2 — Capacitor Android WebView에서 `window.confirm()`이 항상 무시됨
**증상**: "위치 저장"이 중복 위치를 감지했는데도 확인 다이얼로그 없이 조용히 아무 동작도 하지 않음(취소된 것처럼 동작).
**원인**: Capacitor의 기본 WebChromeClient가 `onJsConfirm`을 구현하지 않아, `window.confirm()`이 다이얼로그를 띄우지 않고 즉시 `false`를 반환함 — Capacitor 앱에서 잘 알려진 제약.
**수정**: `@capacitor/dialog` 플러그인 설치, `Dialog.confirm({title, message})`로 교체 — 실기기에서 실제 네이티브 확인창(제목/본문/CANCEL/OK)이 정상적으로 뜨는 것을 확인.

### 버그 3 — "장소 정보" 상세 화면에서 사진이 안 보임
**증상**: 사진을 찍어 저장한 "장소 정보"를 열면 "사진" 항목이 완전히 빈 칸으로 표시됨 ("사진 없음" 문구도 안 뜸 — `photoUri`는 있는데 `<img>`가 렌더링되지 않음).
**원인**: 네이티브 `file://` 경로를 WebView의 `<img src>`에 직접 넣으면 Android WebView 보안 정책상 로드되지 않음. `Capacitor.convertFileSrc()`로 변환한 URI를 써야 함.
**수정**: [PlaceInfoDetailScreen.tsx](../../src/screens/PlaceInfoDetailScreen.tsx)에서 이미지 렌더링 시 `Capacitor.convertFileSrc(item.photoUri)` 적용.

### 참고 — 버그는 아니지만 실사용 시 체감될 수 있는 특성
반경 3m 체류/중복감지 기준은 사용자가 명시한 값 그대로 구현했지만, 일반적인 폰 GPS 정확도(수 미터~십수 미터 오차)를 고려하면 "같은 자리"라도 연속된 GPS 픽스가 3m 이내로 잡히지 않는 경우가 흔함. 실기기 테스트에서도 같은 곳에 서서 "위치 저장"을 두 번 연속 눌렀을 때 첫 번째는 중복으로 안 잡히고 새 항목이 생성됐고, 세 번째 시도에서야 중복이 잡혀 확인창이 떴음. 값 자체는 요청하신 대로 두었으니, 실사용 중 중복이 잘 안 잡힌다 싶으면 설정 화면에서 반경을 조금 늘리는 것을 고려해볼 수 있음.

## 실기기 검증 (Samsung SM-S711N)
아래 흐름을 실제 기기에서 전부 눌러보며 확인:
1. 앱 콜드 스타트 → 지도 탭에 실제 GPS 위치(수원 매탄동 인근)가 파란 점으로 정확히 표시됨
2. "위치 저장" → 버튼이 "저장 중..."으로 바뀌었다가 완료 → "장소 정보" 목록에 `날짜_시간_장소` 형식으로 항목 추가, 상세 화면에 사진 없음/GPS좌표/장소명(Nominatim이 실제로 준 도로명)/날짜시간이 순서대로 표시됨
3. 같은 자리에서 "위치 저장" 재시도 → 위 버그 2/버그 1을 발견·수정 후, 최종적으로 중복 감지 시 네이티브 확인 다이얼로그가 정상 표시되고 CANCEL 시 추가되지 않음을 확인
4. "추적 시작" → "사진 촬영"(추적 중일 때만 활성화됨을 확인) → 실제 기기 카메라 앱이 열리고 촬영·확인 → 앱으로 복귀 후 "장소 정보" 목록에 `시간_장소` 형식(날짜 없이 시간만, 스펙대로)으로 새 항목 추가, 상세 화면에서 사진이 정상적으로 보임(버그 3 수정 후)
5. "추적 중지" → "기록" 목록에 해당 경로가 `YYYY-MM-DD HH:mm:ss` 형식 이름으로 저장됨을 확인 (기존 이름 없는 경로들은 계속 기본 `toLocaleString()` 형식으로 표시되어 구분됨)
6. "기록" 목록에서 항목 선택 → "이동 경로 보기" 화면(지도+재생 컨트롤) → "닫기" → 목록으로 복귀 확인 (Phase 4에서 이미 만든 재생 로직 재사용, 화면 분리만 새로 함)
7. DB 마이그레이션(v1→v2)이 기존에 실기기에 있던 Phase 7 테스트 데이터(routes 등)를 보존한 채로 정상 적용됨을 확인

## 알려진 제약사항 / TODO
- 반경 10m 내 "중요한 건물/문화재/버스정류장" 카테고리별 POI는 제공하지 않음(Nominatim은 주소/도로명 중심) — 필요 시 별도 백엔드를 두고 네이버/카카오 지역검색 API를 서버에서 호출하는 방식으로 후속 확장 가능.
- 메모(memo) 기능은 이번 "장소 정보" 화면에 포함하지 않음 (기존 DB 테이블은 유지, UI만 제외).
- 실시간 위치 표시(watchPosition)와 추적 기록(BackgroundGeolocation)이 별도의 GPS 구독을 유지해 배터리 소모가 다소 늘어날 수 있음.
- 5초 저장 간격은 OS의 실제 위치 업데이트 빈도에 따라 약간 들쭉날쭉할 수 있음(최소 간격 보장이지 정확히 5.000초 주기는 아님).
- Nominatim 공개 서버는 초당 1회 수준의 가벼운 개인 사용에 적합하며 SLA가 없음 — 대량/상용 트래픽에는 부적합.
