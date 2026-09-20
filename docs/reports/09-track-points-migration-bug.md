# 09. 치명적 버그: 다중 SQL 문 마이그레이션 무시 + 기록 삭제 기능

## 배경

실기기 테스트 중 "기록에서 항목을 선택하면 지도가 서울시청(기본값)에 그대로 있고 0/0 포인트만 보인다"는 버그 리포트를 받았다. 처음에는 `RouteDetailScreen`이 지도가 준비되기 전에 카메라를 이동시키려다 실패하는 타이밍 문제로 의심했으나(그 부분도 실제로 고쳐야 했다), 근본 원인은 훨씬 심각했다: **`track_points` 테이블 자체가 기기에 존재하지 않았다.**

## 원인 분석

1. `adb logcat`으로 위치 저장/조회 시점의 로그를 확인 → `no such table: track_points`.
2. `adb shell run-as com.naddle.trackingapp cat .../trackingappSQLite.db`로 기기의 실제 DB 파일을 꺼내 로컬에서 `sql.js`(Node)로 열어봄 → `routes`, `place_info` 두 테이블만 존재. `track_points`, `visits`, `photos`, `memos`는 아예 생성된 적이 없었음.
3. `@capacitor-community/sqlite`의 Android 네이티브 소스(`Database.java`, `execute()`)를 확인:
   ```java
   for (String cmd : statements) {
       // ...
       _db.execSQL(nCmd);
   }
   ```
   `statements` 배열의 각 원소를 그대로 `execSQL()`에 전달한다. **Android의 `SQLiteDatabase.execSQL()`은 세미콜론으로 구분된 여러 문장이 들어와도 첫 번째 문장만 실행하고 나머지는 조용히 버린다** — 별도 파싱/분리 없음, 에러도 없음.
4. 기존 `schema.ts`는 `SCHEMA_V1`/`SCHEMA_V2`를 각각 **하나의 배열에 담긴, 세미콜론으로 연결된 거대한 문자열 하나**로 정의하고 있었다. 즉 `addUpgradeStatement`에 넘긴 `statements` 배열이 원소 1개짜리였고, 그 원소 안에 `CREATE TABLE routes ...; CREATE TABLE track_points ...; ...` 식으로 여러 문장이 들어있었던 것.
5. 결과: 마이그레이션이 "성공"으로 기록되며(에러 없이 `execSQL` 호출 자체는 정상 반환) `user_version`은 올라가지만, 실제로는 각 스키마의 **첫 번째 문장만** 실행됨 — v1에서는 `routes`만, v2에서는 `place_info`만.

## 수정

- `src/services/db/schema.ts`: `SCHEMA_V1`/`SCHEMA_V2`를 **개별 SQL 문 하나당 배열 원소 하나**가 되도록 전면 재작성.
- 이미 이 버그가 있는 상태로 `user_version`이 1 또는 2까지 올라간 기기를 복구하기 위해, v1+v2의 전체 문장을 그대로 다시 실행하는 `SCHEMA_V3`를 추가하고 `DB_VERSION`을 3으로 올림. 모든 문장이 `CREATE TABLE/INDEX IF NOT EXISTS`라 이미 존재하는 테이블에는 안전하게 no-op, 누락된 테이블은 이 시점에 생성됨 (자가 치유 마이그레이션).
- `src/services/db/db.service.ts`의 `addUpgradeStatement` 호출에 `{ toVersion: 3, statements: SCHEMA_V3 }` 항목 추가.

## 검증

1. 재빌드 → `npx cap sync android` → `gradlew assembleDebug` → `adb install -r`.
2. `adb logcat`에서 `UtilsUpgrade.onUpgrade: from 2 to 3` 로그 확인, 이후 SQL 에러 없음.
3. DB 파일을 다시 pull하여 `sql.js`로 열어 `sqlite_master`를 조회 → `routes, sqlite_sequence, place_info, track_points, visits, photos, memos` 7개 테이블 모두 존재, `PRAGMA user_version` = 3 확인.
4. 실사용 시나리오 재현: "추적 시작" → 35초 대기(5초 간격이므로 포인트 6~7개 기대) → "추적 종료" → 기록 탭에서 방금 만든 경로 선택 → **지도가 실제 마지막 위치(수원시 매탄동 인근)로 정확히 이동하고 시작 위치 마커가 표시됨, 총 19개 포인트 확인 (`0/19`)**. 버그 완전히 해결.

## 부수 수정: `RouteDetailScreen` 지도 중심 이동

버그 조사 과정에서 별도로 발견한 문제: `RouteDetailScreen`이 지도(`MapProvider`)와 포인트 데이터를 각각 다른 `useState`로 관리하면서, 어느 쪽이 먼저 준비되는지에 따라 지도가 초기 기본 좌표(서울시청)에 머무른 채 실제 경로 위치로 이동하지 못하는 경우가 있었다. `map`과 `points`를 모두 `useState`로 바꾸고 `useEffect([map, points])`로 두 값 중 무엇이 늦게 준비되어도 정확히 한 번 카메라 이동 + 시작/종료 마커 표시가 실행되도록 수정. 포인트가 0개인 경로에는 "이 경로에는 저장된 위치가 없습니다" 안내 문구를 추가.

## 신규 기능: 기록 목록 다중 선택 삭제

사용자 요청으로 `RouteListScreen`에 삭제 기능 추가:
- 평상시 헤더: `<`(뒤로가기) + "기록" 제목 + "삭제" 버튼(경로가 없으면 비활성화).
- "삭제" 클릭 → 선택 모드 진입: 헤더가 "삭제"/"취소" 버튼으로 바뀌고 각 항목 앞에 체크박스 표시.
- 체크박스로 1개 이상 선택 후 "삭제" 클릭 → `@capacitor/dialog`의 `Dialog.confirm()`으로 "진짜 삭제할꺼야?" (응/아니) 확인.
  - "응" → `db.deleteRoutes(선택된 id들)` 호출(경로별 `DELETE FROM routes WHERE id = ?`, `track_points`는 `ON DELETE CASCADE`로 함께 삭제되고 `place_info`는 `route_id`가 NULL로 남음) → 목록 새로고침 → 선택 모드 종료.
  - "아니" → 다이얼로그만 닫히고 선택 상태 유지.
- 실기기에서 위 전체 플로우(선택 모드 진입 → 체크 → 확인 다이얼로그 → 응 → 항목 삭제 및 목록 갱신) 정상 동작 확인.

## 교훈 / 참고사항

- `@capacitor-community/sqlite`의 마이그레이션 `statements` 배열은 **반드시 SQL 문 하나당 배열 원소 하나**로 작성해야 한다. 세미콜론 구분 멀티스테이트먼트 문자열을 통째로 넣으면 안드로이드에서는 조용히 첫 문장만 실행되고, 에러도 없이 `user_version`만 올라가 버려서 발견하기 매우 어렵다.
- 이런 종류의 "조용한 실패"는 앱 UI 레벨의 증상(지도가 안 뜬다)만 보고는 원인을 짐작하기 어려웠고, `adb logcat` + 기기에서 직접 DB 파일을 꺼내 스키마를 확인하는 것이 결정적이었다.
