# 14. 버그 수정: 지도 인증 실패 후 화면 전환 시 흰 화면 크래시

## 증상

Phase 13 백그라운드 추적 검증 중, 11분간 백그라운드로 둔 뒤 추적을 중지하고 지도(기록) 탭으로 전환하는 순간 앱이 완전히 빈 화면(흰/검은 화면)으로 멈추는 크래시가 1회 발생했다. 데이터는 손상되지 않았고 앱 강제 종료 후 재시작하면 정상화됐지만, 짧은 재현 시도(수초짜리 추적 시작→중지→탭 전환, 3분 백그라운드)로는 재현되지 않아 원인 불명 상태로 남아 있었다.

## 재현 절차

1. `main.tsx`에 `window.addEventListener('error'/'unhandledrejection', ...)`를 추가해 `event.error.stack` 전체를 `console.error`로 남기도록 함 — Capacitor의 콘솔 브리지는 실패한 줄/컬럼만 보고하고 스택은 주지 않아, 미니파이된 번들에서 원인을 특정하기 부족했음.
2. `vite build --minify false`로 비압축 빌드를 만들어 실제 함수/파일명이 보이는 스택을 얻음.
3. Naver 지도 API 키를 의도적으로 깨뜨려(`VITE_NAVER_MAP_CLIENT_ID=invalid-test-key-xxx`) "네이버 지도 Open API 인증이 실패했습니다" 상태를 **항상** 재현되게 만듦 (기존에는 이 상태가 간헐적으로만 나타나 재현이 불안정했음).
4. 추적 시작 → 지도 화면에서 위치 마커가 한 번이라도 갱신되도록 몇 초 대기(인증 실패한 지도 위에 `currentLocationMarker`가 생성됨) → 추적 중지 → 기록 탭으로 전환.
5. 재현됨. `adb logcat`에서 전체 스택 확인:
   ```
   TypeError: Cannot read properties of null (reading 'capitalize')
       at x.Marker.get (naver maps.js)
       at x.Marker.setMap (naver maps.js)
       at NaverMapProvider.destroy (index-*.js)
       at [React 커밋/effect-cleanup 내부 함수들]
   ```

## 원인

Naver 지도 API 키 인증이 실패하면 `naver.maps.Map` 생성자 호출 자체는 에러 없이 반환되지만(비동기로 인증 실패를 감지해 배너만 그림), 그 지도 객체의 내부 상태는 정상적으로 초기화되지 않은 채로 남는다. 이 상태의 지도에 붙어 있는 마커에 `.setMap(null)`을 호출하면 **Naver SDK 자신의 코드 내부**에서 `null.capitalize`/`null.isArray` 같은 예외가 던져진다.

`MapView.tsx`는 언마운트 시(탭을 전환해 지도 화면이 사라질 때) `MapProvider.destroy()`를 호출하고, `NaverMapProvider.destroy()`는 `currentLocationMarker`(지도 화면에 항상 떠 있는 "현재 위치" 파란 점) 등에 `.setMap(null)`을 호출한다. 이 호출이 SDK 내부에서 예외를 던지면, 그 호출 지점이 **React가 컴포넌트를 언마운트하며 effect cleanup을 실행하는 커밋 단계 안**이기 때문에, 아무도 잡지 않은 예외가 React의 커밋 루프까지 전파된다. 이 앱에는 에러 바운더리가 없었으므로 React는 기본 동작대로 전체 트리를 언마운트해버려 — 화면이 완전히 비게 된다.

11분 백그라운드 세션에서만 재현되고 짧은 테스트에서는 안 됐던 이유: 짧은 테스트 때는 인증 실패가 우연히 발생하지 않았거나(네이버 API 키 인증 실패가 간헐적이었음), `currentLocationMarker`가 생성될 만큼 GPS 콜백을 못 받았을 가능성이 큼. 인증 실패 상태를 강제로 고정하자 몇 초 만에 안정적으로 재현됐다.

## 수정

1. **직접 원인 제거**: `naver-map.provider.ts`(및 동일 위험을 가진 `kakao-map.provider.ts`, `google-map.provider.ts`)의 `destroy()`/`clearMarkers()`/`drawRoute()`/`animatePlayback()`에서 SDK로 들어가는 모든 `.setMap(null)`/`.destroy()` 호출을 `safeCall()` 헬퍼로 감싸 try/catch — 제3자 지도 SDK가 깨진 상태에서 정리(cleanup) 중 예외를 던져도 앱에 전파되지 않고 `console.warn`으로만 남긴다.
2. **방어선 추가**: `src/ErrorBoundary.tsx`를 신설해 `App.tsx`의 각 탭 콘텐츠를 감싸도록 함(`<ErrorBoundary key={tab}>`). 이번 원인과 무관하게 앞으로 어떤 화면이 렌더링/커밋 중 예외를 던지더라도, 전체 앱이 빈 화면으로 죽는 대신 "문제가 발생했습니다 / 다시 시도" 화면이 뜨고, 탭을 다시 전환하면 새로 마운트되어 복구된다.
3. `main.tsx`의 전역 `error`/`unhandledrejection` 리스너는 진단에 유용해 그대로 유지 — 앞으로 비슷한 크래시가 발생하면 `adb logcat`에서 바로 전체 스택을 확인할 수 있다.

## 검증

동일한 강제 인증 실패 조건(`invalid-test-key-xxx`) + 비압축 빌드로 재현 절차를 다시 실행: 추적 중 지도 화면에서 위치 마커가 갱신된 뒤 기록 탭으로 전환 → **더 이상 크래시하지 않고 정상적으로 목록이 표시됨**. `adb logcat`에서 다음 로그로 안전장치가 실제로 작동했음을 확인:
```
W Capacitor/Console: ... [NaverMapProvider] ignored error from Naver SDK during cleanup TypeError: Cannot read properties of null (reading 'isArray')
```
이후 실제 Naver API 키로 복원하고 프로덕션(압축) 빌드로 재빌드/재설치, 정상 동작 확인.

## 참고: 네이버 지도 인증 실패 자체는 별개의 미해결 이슈

이번 세션 중 실제 키(`31d4jia6qy`)로도 "네이버 지도 Open API 인증이 실패했습니다"가 간헐적으로 나타났다(같은 세션에서도 성공/실패가 오갔음). 원인은 확인하지 못함 — NCP 콘솔의 트래픽 제한, 등록된 서비스 URL/패키지 서명 제약, 또는 네트워크 문제일 수 있음. 이번 크래시 수정으로 인증이 실패해도 앱이 죽지는 않게 됐지만, 인증 실패 자체(지도가 안 보이는 문제)는 별개로 남아있는 과제다.
