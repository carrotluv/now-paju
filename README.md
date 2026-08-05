# 지금 파주 (NOW PAJU)

파주시 주요 지점의 실시간 인파를 보여주는 지도 서비스.
경기도 실시간 방문소비 현황지도(KT 통신 기반, 5분 주기) 공개 데이터를 프록시로 받아 표시한다.

## 구조

- `public/_worker.js` — Pages 고급 모드 워커. `/api/*` 는 경기도 API 프록시(파주 필터, 엣지 캐시 2~30분), 그 외는 정적 자산 서빙
  - `GET /api/summary` — 파주 관측 지점 목록(ID·혼잡 라벨·좌표)
  - `GET /api/spot/{id}` — 지점 상세(24시간 추이·성별·연령)
- `public/index.html` — 앱 전체(지도·리스트·E/I 모드). 외부 의존성은 Leaflet·CARTO 타일·Pretendard(CDN)뿐.

## 배포

Cloudflare Pages — GitHub 저장소 연결 후 push마다 자동 배포. 주소: https://now-paju.pages.dev
(빌드 명령 없음, 출력 디렉터리 `public` — `wrangler.jsonc`의 `pages_build_output_dir` 참조)

`_worker.js`가 출력 디렉터리 안에 있으므로, Git 연결이 막힐 때는 대시보드에서 `public` 폴더를
직접 업로드(Direct Upload)해도 API 프록시까지 그대로 동작한다.

## 참고

- 상류 상세 API는 `interestRegionId`(숫자) 기반이며, ID는 `/api/summary`가 목록에서 동적으로 해석한다(지점 개편 대응).
- 관측망에 없는 추가 지점(율곡수목원·율곡습지공원·파주시청·벽초지수목원·감악산·농업기술센터)은 위치·CCTV 자리만 표시된다.
- CCTV 영상·도로 소통 정보는 국가교통정보센터(ITS) 개방 API 연동 예정.
