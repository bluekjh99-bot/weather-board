# 현장 일정 날씨판

오늘 현장 일정과 지역별 날씨를 한 화면에서 보고, 날씨 때문에 주의 · 중지를 검토할 일정을 표시합니다. (교육용 가상 데이터)

## 여는 법
- 내 PC : `index.html` 더블클릭
- 인터넷 : (배포 후 Vercel 주소를 여기에 적기)

## Supabase · KMA API
1. Supabase SQL Editor 에서 `setup.sql` 을 직접 실행합니다. 기존 일정은 삭제하지 않습니다.
2. `config.js` 두 줄에 Supabase 프로젝트 URL 과 공개용 Publishable/anon 키를 넣습니다. `service_role` 또는 Secret 키는 사용하지 않습니다.
3. Vercel 환경변수 `KMA_KEY` 에 공공데이터포털 기상청 일반 인증키를 설정하고 배포합니다.
4. `/api/kma?region=대전` 을 열면 해당 지역 일정과 오늘 날씨, 일정별 판단이 JSON 으로 나옵니다. 지역은 세종 · 대전 · 태안 · 보령입니다.

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조 |
| style.css | 디자인 |
| logic.js | 판단 규칙 |
| app.js | 화면 동작 |
| PRD.md | 무엇을 · 왜 만드는지 |
| CLAUDE.md | AI가 지킬 작업 규칙 |
| setup.sql | Supabase 표 · 제약 · 권한 설정 (SQL Editor 에서 실행) |
| api/kma.js | Vercel 지역 일정 · 날씨 API |
| .gitignore | GitHub에 올리지 않을 파일 목록 |
