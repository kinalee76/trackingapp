# Phase 0 — 프로젝트 스캐폴딩

**날짜**: 2026-09-18
**상태**: 완료

## 목표
GPS 경로 추적 안드로이드 앱을 만들기 위한 Capacitor 하이브리드 프로젝트의 기본 골격을 구성한다.

## 수행한 작업

### 1. Node.js 버전 업그레이드 (선행 작업)
- 시작 시 시스템 Node.js가 v18.14.1이었으나, 최신 Capacitor CLI(v8 계열)와 최신 Vite 툴체인이 Node 22 이상을 요구하여 초기화가 차단됨.
- 사용자가 `winget install OpenJS.NodeJS.LTS`로 Node.js를 v24.19.0으로 업그레이드.
- 업그레이드 후 `node_modules`, `package-lock.json`을 삭제하고 재설치하여 이전 버전 기준으로 설치된 패키지 잔재 제거.

### 2. 프론트엔드 스캐폴딩
- `npm create vite@5 . -- --template react-ts` 로 Vite + React + TypeScript 템플릿 생성
  - 최신 `create-vite`(v9)는 Node 20.19+/22.12+ 를 요구해 실패했으므로 Node 18 시점에는 `create-vite@5`로 우회했었고, 이후 Node 업그레이드로 이 문제는 해소됨. (참고용 기록)
  - 대상 폴더가 비어있지 않다는 프롬프트를 피하기 위해 임시 하위 폴더(`app-scaffold-tmp`)에 생성 후 루트로 이동.
- `package.json`의 `name` 필드를 `app-scaffold-tmp` → `trackingapp`으로 수정.

### 3. Capacitor 설정
- 설치 패키지: `@capacitor/core`, `@capacitor/android` (dependencies), `@capacitor/cli` (devDependencies) — 버전 `^8.5.2`.
- `npx cap init "TrackingApp" "com.naddle.trackingapp" --web-dir=dist` 로 `capacitor.config.ts` 생성.
  - App ID: `com.naddle.trackingapp`
  - App Name: `TrackingApp`
  - webDir: `dist` (Vite 빌드 출력 경로)
- `npm run build` 로 웹 빌드 산출물 생성 후 `npx cap add android` 로 네이티브 Android 프로젝트(`android/`) 생성 및 웹 자산 동기화.

### 4. 폴더 구조
- `src/services/` — DB, 위치추적, 지도 어댑터 등 비즈니스 로직 모듈 (다음 Phase부터 채움)
- `src/screens/` — 화면 단위 컴포넌트
- `src/components/` — 재사용 UI 컴포넌트
- `docs/reports/` — 본 레포트 등 단계별 작업 기록
- `docs/architecture.md` — (다음 단계에서 생성 예정) DB 스키마·지도 추상화 등 아키텍처 상세 문서

### 5. npm 스크립트 추가
`package.json`에 아래 스크립트 추가:
- `cap:sync`: 웹 빌드 후 `npx cap sync android` 실행 — 이후 각 Phase에서 네이티브 코드/플러그인 변경 시 반복 사용
- `cap:open:android`: Android Studio로 네이티브 프로젝트 열기

## 설계/구현 결정과 이유
- **App ID**를 `com.naddle.trackingapp`으로 정함 (사용자 이메일 도메인 `naddle.net` 기반의 역도메인 표기 — 추후 실제 배포 시 원하는 도메인으로 변경 가능).
- Vite 5(레거시)로 시작했으나 Node 22+ 확보 후에도 버전을 굳이 6/7로 올리지 않고 5.4.x 유지 — Capacitor/Android 빌드 안정성이 검증된 조합을 우선하고, 이후 단계에서 문제 없으면 업그레이드 검토.

## 확인/테스트 방법과 결과
- `npm run build` — 성공 (tsc 빌드 + Vite 빌드, `dist/` 산출물 생성 확인)
- `npx cap add android` — 성공 (`android/` 디렉터리 생성, Gradle 동기화 성공 로그 확인)
- 실제 APK 빌드/에뮬레이터 실행은 아직 수행하지 않음 (Phase 7에서 종합 검증 예정)

## 알려진 제약사항 / TODO
- Android Studio / Android SDK가 이 머신에 설치되어 있는지는 아직 확인하지 않음 — 실제 기기/에뮬레이터 실행 시점(Phase 2 이후 또는 Phase 7)에 확인 필요.
- Git 저장소가 아직 초기화되어 있지 않음 (`.git` 없음) — 버전 관리 시작 여부는 사용자와 별도 확인 필요.
- `npm audit` 상 취약점(4 moderate, 1 high) 존재 — 대부분 devDependency(eslint 계열) 관련으로 런타임에는 영향 없을 것으로 보이나, 추후 한 번 점검 권장.
