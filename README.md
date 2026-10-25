# 옷깃 MVP

## 바로가기

| 화면 | 주소 |
| --- | --- |
| 웹앱 | https://otgit-mvp.devmeet-mvp.workers.dev |
| 원본 시안 | https://otgit-mvp.devmeet-mvp.workers.dev/prototype.html |

Cloudflare Workers에 배포되어 있어 누구나 열 수 있습니다. 데이터는 Cloudflare D1에 저장되고, 프로필 사진도 D1의 `photos` 표에 저장됩니다.

원본 `otgit-prototype/local.html`의 따뜻한 밝은 톤과 추천 → 상세 → 좋아요 → 매칭 → 첫 대화 흐름을 기반으로 만든 웹앱입니다. 원본 시안은 `/prototype.html`에서 보존합니다.

## 실제 동작

- 이메일/비밀번호 가입·로그인, HttpOnly 쿠키 세션, PBKDF2 비밀번호 해시
- 4단계 프로필 작성·수정, 지역/나이 추천 조건 저장
- 사진 리사이즈 업로드 및 R2 영구 저장
- D1 데이터베이스에 계정·좋아요·추천·메시지·신고·차단 저장
- 하루 최대 3명, 추천 목록 고정 및 일일 좋아요 3회 제한(서버/DB에서 검사)
- 서로 좋아요를 보낸 계정만 대화 가능, 5초 간격 새 메시지 확인
- 보낸/받은 좋아요와 대화 목록, 신고 기록, 양방향 차단 및 차단 해제
- 가상 인물을 사용하는 화면 둘러보기는 실제 계정·메시지와 구분되며 서버에 전송하지 않음

## 실행 및 검사

Node.js 22.13 이상에서 외부 패키지 설치 없이 동작합니다.

```sh
npm run build
npm test
npm run validate
npm start
```

로컬 주소: `http://localhost:8771`, 또는 `PORT=8772 npm start`.
로컬 SQLite 및 사진은 `.local/`에 저장되고 Git에서 제외됩니다. 로컬 DB와 배포 DB는 독립적입니다. `/local.html`도 앱 첫 화면으로 연결됩니다.

## 배포

Cloudflare Workers에 배포합니다. 설정은 `wrangler.jsonc`에 있고, 데이터베이스는 D1(`DB`)을 씁니다. R2 대신 사진을 D1 `photos` 표에 저장하며, 이 연결은 `scripts/build-cloudflare.mjs`가 Cloudflare용 빌드에서 넣습니다. HTML·CSS·JS는 Worker 안에 넣어 보안 헤더를 유지하고, 이미지와 글꼴은 Cloudflare 정적 파일로 보냅니다.

```sh
npx wrangler login
npm run db:migrate   # drizzle/ 마이그레이션을 원격 D1에 적용
npm run deploy
```

## 현재 경계

카카오 로그인·GitHub OAuth·회사 이메일 수신 인증·사진 운영자 심사는 아직 연결하지 않았습니다. 외부 서비스 키 없이 인증 완료를 가장하지 않으며, 개발자 역할은 본인 입력 정보입니다. 이메일 수신 확인·비밀번호 찾기·계정 삭제 UI도 제공하지 않습니다. 가입자가 없으면 가짜 추천 대신 대기 화면이 표시됩니다. 신고는 DB에 실제 기록되지만 운영자 알림·심사 도구는 없습니다.

추천·좋아요의 날짜 경계는 한국 시간 자정입니다. 이미 배정된 당일 추천은 조건 변경 후에도 유지되며, 새 조건은 다음 추천부터 반영됩니다. 대화는 최근 200개 메시지를 불러옵니다. MVP 운영 전에는 외부 인증, 운영자 검토, 이용약관·개인정보 처리 체계, 계정 복구·삭제 기능을 완성해야 합니다.

## 검증

`tests/flows.test.mjs`는 동일 Worker를 실제 SQLite에 연결해 가입/중복/나이 검증, 로그인 재사용, CSRF 차단, 추천 고정, 중복 좋아요, 일일 한도, 상호 매칭, 메시지 수신, 권한 없는 대화, 신고 영속 저장, 양방향 차단, 로그아웃 및 에셋 응답을 검증합니다. 실제 외부 OAuth 또는 운영자 검토를 시연하지 않습니다.
