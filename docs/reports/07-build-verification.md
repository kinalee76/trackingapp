# Phase 7 — 빌드 및 실기기 검증

**날짜**: 2026-09-19
**상태**: 완료 — 실기기(Samsung SM-S711N, Android, 실제 폰)에서 빌드/설치/추적 시작·중지까지 검증. 지도 렌더링은 API 키 미발급으로 계속 미검증.

## 목표
Android Studio/SDK를 설치하고, 실제 APK를 빌드해 실기기에 설치한 뒤, 지금까지 웹 레벨에서만 검증했던 기능들(특히 백그라운드 GPS 추적과 권한 흐름)이 실제 네이티브 환경에서 정상 동작하는지 확인한다.

## 수행한 작업

### 1. 빌드 환경 구성
- `winget install --id Google.AndroidStudio --source winget` — msstore 소스는 인증서 오류로 실패, `winget` 소스로 재시도해 성공
- Android Studio 최초 실행 시 Setup Wizard로 Android SDK, 빌드 툴, 에뮬레이터 이미지 설치 (SDK 경로: `%LOCALAPPDATA%\Android\Sdk`)
- **JDK 버전 이슈**: 시스템 JAVA_HOME(JDK 11)은 AGP 8.13(이 프로젝트가 사용)의 최소 요구사항(17+)보다 낮았고, Android Studio가 내장한 JBR(JDK 25)는 반대로 Gradle 8.14.3이 아직 지원하지 않는 버전(`Unsupported class file major version 69`)이었음. `winget install --id EclipseAdoptium.Temurin.21.JDK`로 JDK 21을 별도 설치해 `JAVA_HOME`으로 지정해 해결.
- `android/local.properties`에 `sdk.dir` 직접 기록 (환경변수 `ANDROID_HOME`을 세션에 영구 설정하지 않고, 프로젝트 로컬 설정으로 처리)
- `./gradlew.bat assembleDebug` 성공 — 6개 Capacitor 플러그인(sqlite, background-geolocation, camera, filesystem, preferences, local-notifications) 모두 정상 컴파일, `app-debug.apk` 생성 확인

### 2. 에뮬레이터 시도 → 실기기로 전환
- Android Studio Device Manager로 AVD(Pixel_8) 생성 시도했으나, 이 노트북(NVIDIA+Intel 하이브리드 그래픽)에서 Windows Hypervisor Platform을 켜고 재부팅해도 "Android Emulator hypervisor driver is not installed"로 x86_64 에뮬레이터 구동 실패. 하이브리드 GPU 환경에서 흔히 발생하는 이슈로, 추가 드라이버 설정이 필요해 보임 (이번 범위에서는 더 파고들지 않음).
- 대안으로 **실물 Android 폰(USB 디버깅)**으로 전환 — 개발자 옵션 활성화 → USB 디버깅 허용 → `adb devices`로 인식 확인 → `adb install -r`로 설치. 이후 모든 검증은 이 실기기로 진행.

### 3. 실기기에서 발견하고 수정한 버그 2건

#### 버그 1 — POST_NOTIFICATIONS 권한을 요청하지 않음 (Phase 2에서 TODO로 남겨뒀던 항목)
**증상**: 추적을 시작해도 백그라운드 추적용 지속 알림이 전혀 표시되지 않음. `adb shell dumpsys notification`으로 확인한 결과 앱의 알림 `importance=NONE`으로 완전히 차단된 상태였고, `dumpsys package`로 확인하니 `POST_NOTIFICATIONS: granted=false` — 앱이 이 권한을 요청한 적이 없었음.

**원인**: `@capacitor-community/background-geolocation`의 `requestPermissions` 옵션은 위치 권한만 요청하고, Android 13+ 필수인 `POST_NOTIFICATIONS`는 별도로 요청해야 하는데 구현이 안 되어 있었음.

**수정**: `@capacitor/local-notifications`를 설치하고, [geolocation.service.ts](../../src/services/geolocation/geolocation.service.ts)의 `startTracking()` 맨 앞에서 `LocalNotifications.requestPermissions()`를 호출하도록 추가.

**검증**: 권한을 리셋한 뒤 "추적 시작"을 누르면 알림 권한 다이얼로그가 먼저 뜨고, 허용 후 `dumpsys notification`에서 `importance=DEFAULT userSet=true`로 바뀌고 실제 `FOREGROUND_SERVICE` 알림 레코드가 정상 게시됨을 확인.

#### 버그 2 — 콜드 스타트 시 위치 권한 승인과 포그라운드 서비스 시작 사이의 레이스 컨디션 (신규 발견)
**증상**: 앱을 처음 설치하고 "추적 시작"을 누르면 — 즉 위치 권한을 이 세션에서 처음 요청/승인하는 바로 그 순간 — 화면은 "추적 중"으로 정상 표시되지만, 실제로는 추적이 시작되지 않은 상태였음.

**원인**: `adb logcat`에서 다음 예외를 발견:
```
E Capacitor: Failed to foreground service
E Capacitor: java.lang.SecurityException: Starting FGS with type location ... requires permissions:
  allOf=true [FOREGROUND_SERVICE_LOCATION] any of [ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION]
  and the app must be in the eligible state/exemptions
  at BackgroundGeolocationService$LocalBinder.addWatcher(...)
```
`addWatcher`의 `requestPermissions: true` 옵션은 권한을 요청하는 것과 포그라운드 서비스를 시작하는 것을 거의 동시에 처리하는데, 기기에서 위치 권한을 **이번에 처음** 승인하는 경우 Android OS가 그 승인을 완전히 전파하기 전에 서비스 시작을 시도해 `SecurityException`이 발생함. 이 예외는 플러그인 네이티브 코드에서 로그로만 남고 **JS 쪽 Promise에는 전달되지 않아**, 앱은 마치 추적이 성공적으로 시작된 것처럼 "추적 중" 상태를 그대로 보여줌 — 사용자는 실제로는 아무것도 추적되지 않는데도 정상 작동 중이라고 오인하게 되는 조용한 실패였음.

**수정**: `@capacitor/geolocation`(Phase 2에서 "당장 안 쓴다"고 제거했던 것을 다시 설치)의 `Geolocation.requestPermissions()`를 `addWatcher` 호출 **전에** 별도로 호출해 권한 승인이 완전히 끝난 뒤에만 다음 단계로 진행하도록 변경하고, `addWatcher`에는 `requestPermissions: false`를 넘겨 플러그인 자체의 (레이스가 있는) 내부 권한 요청 경로를 타지 않도록 함.

**검증**: 앱을 완전히 삭제(`adb uninstall`) 후 재설치해 진짜 콜드 스타트 상태를 재현 → "추적 시작" → 알림 권한 다이얼로그 → 위치 권한 처리 → `logcat`에 `SecurityException`/`Failed to foreground service` 없음 확인 → `dumpsys notification`에서 알림이 정상 게시됨(`importance=DEFAULT userSet=true`) 확인 → "추적 중지"까지 정상 종료(`removeWatcher` 호출, FATAL 없음) 확인.

## 확인/테스트 방법과 결과 (실기기, Samsung SM-S711N)
1. `adb install -r app-debug.apk` → 설치 성공
2. 앱 최초 실행 → 하단 탭(지도/기록/체류 기록/설정) 정상 렌더링, Phase 6 UI가 실제로 반영됨을 스크린샷으로 확인
   - **주의**: 최초 설치 시 `npm run cap:sync`를 다시 안 하고 이전 `dist/`로 빌드된 APK를 설치해 Phase 5 시점 UI가 뜨는 실수가 있었음 — `cap sync` 재실행 후 재빌드로 해결. **앞으로 네이티브 빌드 전에는 항상 `npm run cap:sync`(또는 `cap:sync` 스크립트)를 먼저 실행할 것.**
3. "추적 시작" → 알림 권한 다이얼로그 → 허용 → 위치 권한 다이얼로그(정확한 위치/대략적인 위치, 앱 사용 중에만 허용 등) → 허용 → "추적 중" 상태로 전환, 상태바에 위치 아이콘 표시 확인
4. 위 두 버그를 발견 → 수정 → 재빌드 → 완전 재설치 후 콜드 스타트 재현 → 정상 동작 확인 (위 "버그 2" 검증 항목)
5. "추적 중지" → 정상 종료, 크래시 없음
6. 지도 화면: API 키가 없어 "API 키가 필요합니다" 안내 문구가 실기기에서도 Phase 3~6과 동일하게 정상적으로 표시됨 (크래시 없음)
7. `adb logcat`으로 오늘 날짜(09-19) 세션 전체에서 우리 앱 관련 `FATAL EXCEPTION` 없음을 확인

## 버그 3 — 화면이 전체를 채우지 못함 (2026-09-20 발견/수정)

**증상**: 실기기에서 지도가 화면 왼쪽 절반 정도까지만 그려지고 나머지는 빈 배경으로 남음. 다른 탭들도 마찬가지로 화면 오른쪽이 비어 보임.

**원인**: Vite 기본 템플릿에서 그대로 남아있던 [index.css](../../src/index.css)의 `body { display: flex; place-items: center; ... }` 규칙 때문. 이 규칙은 원래 템플릿의 가운데 정렬된 데모 콘텐츠용인데, `#root`가 flex 컨테이너 안에서 가운데 정렬되면서 자기 콘텐츠 크기만큼만(즉 내부 요소들의 auto width) 차지하고 화면 전체 너비로 늘어나지 않았음. `App.tsx`의 최상위 div가 `height: 100vh`는 지정했지만 너비는 부모의 flex 정렬에 의해 제한되고 있었던 것.

**수정**: `html, body, #root`에 `width: 100%; height: 100%; margin: 0`을 명시하고, `body`의 `display: flex; place-items: center` 제거.

**검증**: 브라우저(모바일 뷰포트 375×812)와 실기기 양쪽에서 재빌드 후 지도가 화면 전체를 정상적으로 채우는 것을 확인.

## 지도 API 키 발급 후 실기기 재확인 (2026-09-19 추가)
네이버 지도 API 키 발급([03-map-providers.md](./03-map-providers.md) 참고) 후 `npm run cap:sync` → `assembleDebug` → `adb install -r`로 실기기에 재설치해 확인한 결과, 경복궁·광화문·서울역 일대가 실제 지도 타일로 정상 렌더링됨을 확인했다. 이것으로 Phase 3/4에서 남아있던 "지도 실제 렌더링 미검증" 항목이 실기기 수준에서도 해소됨.

## 미검증 항목 (후속 확인 필요)
- **카카오/구글 지도 렌더링** — 아직 키 미발급 ([03-map-providers.md](./03-map-providers.md) 참고)
- **실제 이동 중 GPS 경로 기록 및 3분 체류 감지** — 이번 세션에서는 폰을 들고 실제로 이동하지 않았으므로, 알고리즘 자체는 Phase 2에서 단위 테스트로 검증했지만 실기기·실제 이동 상황에서의 동작은 아직 확인하지 못함
- **사진 촬영 → 영구 저장 → DB 연동** 전체 흐름의 실기기 확인 (Phase 5에서 웹으로만 부분 검증)
- **화면이 꺼진 채 장시간 백그라운드 상태에서도 추적이 끊기지 않는지** — 이번 검증은 앱이 포그라운드에 있는 상태에서만 진행함
- Android Studio Device Manager로 에뮬레이터를 만들 경우, 이 특정 노트북(NVIDIA+Intel 하이브리드 GPU)에서는 하드웨어 가속 드라이버 문제로 실행이 안 되는 것으로 확인됨 — 에뮬레이터가 필요한 경우 별도 드라이버/BIOS 설정 조사가 필요.
- 웹 개발 폴백(jeep-sqlite)의 새로고침 레이스 이슈([05-visit-photos-memos.md](./05-visit-photos-memos.md))는 네이티브 SQLite와 무관한 구조이므로 이번 실기기 테스트로는 재현되지 않음 — 애초에 웹 전용 이슈였음이 간접적으로 뒷받침됨.

## 알려진 제약사항 / TODO
- 위 "미검증 항목"을 채우려면: (1) 지도 API 키 발급, (2) 실제로 폰을 들고 걸어서 경로/체류 기록이 쌓이는지 확인, (3) 화면을 끄고 몇 분~몇 시간 방치한 뒤 추적이 유지되는지 확인 — 이 순서로 진행하는 것을 추천.
- 네이티브 빌드 워크플로우 메모: `npm run build` → `npm run cap:sync` (web + android 동기화) → `cd android && ./gradlew.bat assembleDebug` (JDK 21 필요, `JAVA_HOME` 환경변수로 지정) → `adb install -r app-debug.apk`.
