# 구현 단계 인덱스

전체 계획: 프로젝트 루트 밖의 계획 파일(대화에서 승인된 계획) 참고. 이 문서는 각 Phase의 진행 상태와 레포트 링크를 모아둔다.

2026-09-20 하루 동안 진행된 Phase 9~14 작업을 시간순으로 정리한 종합 일지: [15-session-log-2026-09-20.md](./15-session-log-2026-09-20.md)

| Phase | 내용 | 상태 | 레포트 |
|---|---|---|---|
| 0 | 프로젝트 스캐폴딩 (Vite+React+TS, Capacitor, Android 플랫폼) | 완료 | [00-project-setup.md](./00-project-setup.md) |
| 1 | 로컬 데이터 저장소 (SQLite 스키마/서비스) | 완료 | [01-local-storage.md](./01-local-storage.md) |
| 2 | GPS 백그라운드 추적 + 체류(3분) 감지 | 완료 (실기기 검증은 Phase 7로 이연) | [02-gps-tracking-stay-detection.md](./02-gps-tracking-stay-detection.md) |
| 3 | 지도 추상화 레이어 + 네이버/카카오/구글 지도 연동 | 완료 (네이버는 실제 키로 렌더링 검증 완료, 카카오/구글은 키 미발급) | [03-map-providers.md](./03-map-providers.md) |
| 4 | 경로 재생(Replay) 기능 | 완료 (네이버 지도 기준 실제 폴리라인/재생 애니메이션 검증 완료) | [04-route-replay.md](./04-route-replay.md) |
| 5 | 체류 상세 화면: 사진 + 메모 (Phase 8에서 "장소 정보"로 대체됨) | 완료 (웹 폴백 새로고침 레이스 이슈는 미해결) | [05-visit-photos-memos.md](./05-visit-photos-memos.md) |
| 6 | 설정 화면 통합 + 내비게이션 | 완료 (Phase 8에서 탭 구성 일부 변경) | [06-settings-navigation.md](./06-settings-navigation.md) |
| 7 | 빌드 및 실기기 검증 | 완료 (실기기 검증, 지도 렌더링은 API 키 발급 후 재확인 필요) | [07-build-verification.md](./07-build-verification.md) |
| 8 | 실시간 위치 표시, 5초 간격 추적, 경로 목록/상세, "장소 정보" 기능 | 완료 (실기기 검증, 버그 4건 발견·수정) | [08-place-info-and-live-tracking.md](./08-place-info-and-live-tracking.md) |
| 9 | 치명적 버그 수정: 다중 SQL 문 마이그레이션 무시 (track_points 등 미생성) + 기록 목록 삭제 기능 | 완료 (실기기 검증) | [09-track-points-migration-bug.md](./09-track-points-migration-bug.md) |
| 10 | 버그 수정: 이동 경로 상세 화면에서 전체 경로가 화면에 안 들어오던 문제 (fitBounds 도입) | 완료 (실기기 검증, DB 직접 주입으로 1km 경로 테스트) | [10-route-path-not-visible.md](./10-route-path-not-visible.md) |
| 11 | 기능 추가: 출발(파란색)/도착(빨간색) 마커 색상 구분 | 완료 (네이버 실기기 검증, 카카오/구글은 키 미발급으로 미검증) | [11-departure-arrival-markers.md](./11-departure-arrival-markers.md) |
| 12 | 기능 추가: 이동 거리/시간 저장 + 경로선 색상(RGB 134,229,127) + "기록 정보" 패널 | 완료 (실기기 검증) | [12-route-distance-duration.md](./12-route-distance-duration.md) |
| 13 | 버그 수정: 앱을 백그라운드로 보내면 위치가 저장되지 않던 문제 (JS 타이머 → 네이티브 콜백 직접 저장) | 완료 (11분 백그라운드 실기기 검증, 114개 포인트 균등 저장 확인). 검증 중 발견한 크래시는 Phase 14에서 재현·수정 | [13-background-tracking-not-saving.md](./13-background-tracking-not-saving.md) |
| 14 | 버그 수정: 지도 인증 실패 후 화면 전환 시 흰 화면 크래시 (재현 확보 후 수정) | 완료 (강제 재현 절차로 확인, 수정 후 재현 안 됨을 재검증) | [14-white-screen-crash.md](./14-white-screen-crash.md) |
| 15 | 작업 일지: Phase 9~14 시간순 종합 정리 | 완료 | [15-session-log-2026-09-20.md](./15-session-log-2026-09-20.md) |
| 16 | 기능 추가: 경로 상세 화면에 촬영 위치 카메라 마커 표시 | 완료 (실사용 기록으로 실기기 검증) | [16-route-photo-markers.md](./16-route-photo-markers.md) |
| 17 | 기능 추가: 경로 재생 마커를 뛰어가는 강아지 아이콘으로 교체 | 완료 (실기기에서 아이콘 렌더링·경로 이동 확인) | [17-running-dog-playback-marker.md](./17-running-dog-playback-marker.md) |

## 알려진 미해결 이슈
- 네이버 지도 인증이 간헐적으로 실패("네이버 지도 Open API 인증이 실패했습니다")하는 경우가 있음(같은 API 키로도 성공/실패가 오감). 원인 미확인(NCP 트래픽 제한/서비스 URL 제약/네트워크 추정). Phase 14 수정으로 이 상태에서도 앱이 크래시하지는 않지만, 지도 자체가 안 보이는 문제는 별개로 남아있음.

## 향후 확장 후보 (범위 밖, 참고용)
- 갤러리 자동 EXIF 스캔으로 사진 자동 매칭
- SQLite 암호화 (SQLCipher)
- 클라우드 백업/동기화
- 백그라운드 추적을 유료 Transistorsoft 플러그인으로 교체 (배터리/안정성 이슈 발생 시)
- 반경 10m 내 건물/문화재/정류장 등 카테고리별 POI 검색 (별도 백엔드 + 네이버/카카오 지역검색 API 필요)
- 메모(memo) 기능을 "장소 정보" 상세 화면에 재도입
