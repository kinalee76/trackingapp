# Phase 3 — 지도 추상화 레이어 + 네이버/카카오/구글 지도 연동

**날짜**: 2026-09-18 (네이버 지도 API 키 발급 및 실제 렌더링 검증: 2026-09-19 추가)
**상태**: 완료 — 네이버 지도는 실제 API 키로 렌더링/폴리라인/재생까지 검증 완료. 카카오/구글은 키 미발급으로 여전히 미검증.

## 목표
네이버(기본)/카카오/구글 3개 지도를 설정에서 전환할 수 있는 공통 추상화 레이어를 만든다.

## 계획 대비 중요한 변경 — Google Maps를 네이티브 플러그인 대신 JS SDK로 전환

원래 계획(승인된 plan)은 Google Maps만 `@capacitor-community/google-maps` 네이티브 플러그인을 쓰고 네이버/카카오는 WebView 내 JS SDK를 쓰는 것이었다. 구현 중 해당 플러그인(`2.0.0-beta.18`)의 타입 정의를 직접 확인한 결과 **`addPolygon`/`addMarker`만 있고 `Polyline`(선) API가 없음**을 확인했다 (`node_modules/@capacitor-community/google-maps/dist/esm/definitions.d.ts` 참고). GPS 경로는 닫히지 않는 선(polyline)으로 그려야 하는데, Polygon으로 흉내 내면 마지막 점과 첫 점이 강제로 이어져 경로가 아닌 도형처럼 보이는 문제가 생긴다. 이는 Phase 4(경로 재생)의 핵심 요구사항을 net Google 어댑터가 만족시킬 수 없다는 뜻이라 실행 중 다음과 같이 방향을 바꿨다:

- **Google Maps도 네이버/카카오와 동일하게 WebView 안에서 Google Maps JavaScript API(JS SDK)를 스크립트로 로드하는 방식으로 통일**했다.
- 이 방식은 세 provider의 어댑터 구조가 완전히 동일해져 유지보수가 단순해지고, `@capacitor-community/google-maps` 네이티브 플러그인 의존성 자체를 제거할 수 있었다(설치했다가 다시 제거함).
- Google Maps JS API는 폴리라인(`google.maps.Polyline`)을 기본 지원하므로 이 문제가 없다.
- 참고로 Google의 현재 가격 정책상 Dynamic Maps(네이티브)든 Maps JavaScript API든 월 무료 크레딧이 있어, 개인 사용 목적의 낮은 호출량에서는 과금 측면 차이가 실질적으로 크지 않다고 판단했다.

## 수행한 작업

### 1. 각 지도 SDK 로딩 방식 확인 (웹 검색으로 최신 문서 확인)
- **네이버**: `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=YOUR_CLIENT_ID` — 예전 문서의 `ncpClientId` 파라미터는 `ncpKeyId`로 변경됨 (2024년경 NCP 정책 변경, [NAVER Maps API v3 공식 튜토리얼](https://navermaps.github.io/maps.js.en/docs/tutorial-2-Getting-Started.html)에서 확인)
- **카카오**: `https://dapi.kakao.com/v2/maps/sdk.js?appkey=APP_KEY&autoload=false` + `kakao.maps.load(callback)`으로 초기화 시점 제어
- **구글**: `https://maps.googleapis.com/maps/api/js?key=API_KEY`

### 2. 공통 추상화 레이어
- [map-provider.interface.ts](../../src/services/map/map-provider.interface.ts): `MapProvider` 인터페이스(`init`, `setCenter`, `drawRoute`, `addMarker`, `clearMarkers`, `animatePlayback`, `destroy`) + `MapProviderKeyMissingError`
- [script-loader.ts](../../src/services/map/script-loader.ts): `<script>` 태그를 URL당 한 번만 로드하는 헬퍼 (중복 로드 방지, Promise 캐싱)
- [playback.ts](../../src/services/map/playback.ts): 포인트 배열을 타이머로 순회하며 콜백을 호출하는 재생 로직 — 세 어댑터가 공유 (Phase 4 경로 재생에서 그대로 사용)
- [map-config.ts](../../src/services/map/map-config.ts): `import.meta.env.VITE_*` 로 각 provider의 API 키를 읽어옴, 기본 provider는 `naver`

### 3. Provider 어댑터
- [naver-map.provider.ts](../../src/services/map/providers/naver-map.provider.ts)
- [kakao-map.provider.ts](../../src/services/map/providers/kakao-map.provider.ts) — 카카오의 줌 레벨(`level`)은 네이버/구글과 반대 방향(숫자가 작을수록 확대)이라는 점을 주석으로 명시. 세 provider 간 zoom 값의 완전한 의미 일치는 이번 범위에서 다루지 않음(TODO).
- [google-map.provider.ts](../../src/services/map/providers/google-map.provider.ts)
- [map-provider.factory.ts](../../src/services/map/map-provider.factory.ts): `createMapProvider(key)` 팩토리

### 4. 설정 저장
- `@capacitor/preferences` 설치, [settings.service.ts](../../src/services/settings/settings.service.ts): 선택된 지도 provider를 key-value로 저장/조회 (`getMapProvider`/`setMapProvider`, 기본값 `naver`). SQLite가 아니라 Preferences를 쓴 이유: 단순 설정 값 하나를 위해 SQL 스키마를 늘리는 것보다 가볍고 적합.

### 5. 화면 구성 (임시 — Phase 6에서 정식 내비게이션으로 대체 예정)
- [MapView.tsx](../../src/components/MapView.tsx): 선택된 provider로 지도를 그리는 재사용 가능한 React 컴포넌트. API 키가 없으면 `MapProviderKeyMissingError`를 잡아 화면에 안내 메시지를 오버레이로 표시 (크래시 대신 우아한 처리).
- [MapScreen.tsx](../../src/screens/MapScreen.tsx): 3개 버튼으로 provider를 전환하는 화면. `App.tsx`에서 최상위로 렌더링하도록 교체 (기존 Vite 템플릿 데모 제거).

### 6. 환경변수 / 문서
- `.env.example` 생성 — 3개 키의 발급처와 변수명을 안내
- `.gitignore`에 `.env`, `.env.*` 추가 (`.env.example`만 예외로 추적)

## 확인/테스트 방법과 결과
- `npm run build` — 성공
- 브라우저(Claude 내장 브라우저)로 `npm run dev` 실행 후 실제 클릭 테스트:
  - 네이버 → 카카오 → 구글 전환 시 각각 `"{provider}" 지도를 표시하려면 API 키가 필요합니다...` 안내 메시지가 정확히 표시됨 (스크린샷으로 확인, 크래시 없음)
  - 카카오 선택 후 새로고침 → 선택 상태가 유지됨 (`@capacitor/preferences` 웹 폴백을 통한 저장/조회 확인)
- **실제 지도 렌더링(타일 로딩, 마커, 폴리라인)은 API 키가 없어 검증하지 못함** — 사용자가 키를 발급받아 `.env`에 채워 넣은 뒤 재검증 필요.

## 네이버 지도 API 키 발급 및 검증 (2026-09-19 추가)

사용자가 NAVER Cloud Platform 콘솔(https://console.ncloud.com)에서 직접 로그인 → Maps → Application 등록으로 `trackingapp`이라는 이름의 새 Application을 만들고 Client ID(`31d4jia6qy`)를 발급받았다. 계정 로그인/가입, Application 등록은 사용자가 직접 진행했고(계정·결제 정보 입력은 대행하지 않음), 등록 값은 다음과 같이 설정:
- API 선택: Dynamic Map (+ 기존에 켜져 있던 Directions/Geocoding 계열도 함께 체크됨 — 미사용이라 문제 없음)
- Web 서비스 URL: `http://localhost:5173` (개발 중 브라우저 테스트용), `https://localhost` (Capacitor Android WebView가 실제로 요청하는 origin)
- Android 앱 패키지 이름: `com.naddle.trackingapp`

발급받은 Client ID를 프로젝트 루트의 `.env`에 `VITE_NAVER_MAP_CLIENT_ID=31d4jia6qy`로 설정 (`.env`는 `.gitignore`에 의해 커밋되지 않음).

**검증 결과**: `npm run dev`로 재확인한 결과, 지도 화면 탭에서 서울 시청 주변 지역이 실제 타일로 정상 렌더링됨. 이어서 "기록" 탭에서 합성 경로(15개 포인트)를 삽입해 확인한 결과 (1) 실제 지도 위에 폴리라인이 정확한 경로로 그려짐, (2) 재생 버튼을 눌러 마커가 경로를 따라 애니메이션되고 마지막 포인트(15/15)에서 정상적으로 멈춤을 확인. Phase 3~4에서 API 키 부재로 미검증 상태였던 항목이 모두 해소됨.

## 알려진 제약사항 / TODO
- **카카오/구글 API 키는 아직 미발급** — 필요 시 아래 절차로 발급 후 `.env`의 나머지 두 항목을 채우면 됨:
  1. 카카오: Kakao Developers 콘솔 → 애플리케이션 등록 → JavaScript 키 발급 → 플랫폼에 사이트 도메인 등록 필요
  2. 구글: Google Cloud Console → Maps JavaScript API 활성화 → API 키 발급 → (권장) HTTP 리퍼러 제한 설정
- 세 provider 간 zoom 값 의미가 다름(카카오만 역방향) — 화면에서 넘기는 zoom 기본값만 각 어댑터에 하드코딩되어 있고, 완전한 상호 변환은 하지 않음.
- Google Maps는 구식 `google.maps.Marker`를 사용 (최신 `AdvancedMarkerElement`는 Map ID 설정이 추가로 필요해 MVP 범위에서 보류 — 지금 방식도 계속 지원됨).
- 지도 화면은 Phase 6에서 실제 내비게이션(지도/기록/체류/설정 탭)으로 재구성될 예정이며, 현재의 provider 전환 버튼 UI는 그 전까지의 임시 UI.
