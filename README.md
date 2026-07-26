# Future Planner — 신혼부부 라이프 플랜 대시보드

결혼 준비부터 내집마련까지, 부부가 함께 쓰는 통합 플래너.
청약·부동산 실거래가·대출 시뮬레이션·절세·결혼식 준비·가계부를 한 화면에서 관리하고, 매일 아침 신규 청약·LH 공고를 웹 푸시로 받아본다.

**Live**: https://planner-aa15f.web.app (구글 로그인 + 허용 계정만 접근)

## 주요 기능

| 테마 | 내용 |
|---|---|
| 🏠 홈 | 총 현금·여유자금·결혼 D-day KPI, 자금 배분 게이지, 통합 타임라인 |
| 🏢 부동산 | 소득·자산 진단, DSR/LTV 대출계산기, 청약 정보 + 일정 캘린더, LH·장기전세·공공주택 공고, 국토부 실거래가 지도(아파트·빌라 매매/전월세), 용어·절차 가이드 |
| 💰 돈 모으기 | 계좌별 납입 트래커, 저축 시뮬레이터, ISA·연금 절세 가이드, 증여세 플랜, 2026 신혼부부 정책 자동 판정 |
| 💍 결혼식 | 예산·체크리스트·하객 리스트, 식장·스드메 AI 리서치(Gemini + 네이버 검색 실존 검증) |
| 📒 가계부 | 달력 기입, 고정 수입·지출 자동 기입, 카테고리 예산·전월비, CSV 내보내기 |
| 🔔 공고 알림 | 매일 08:30 신규 청약·LH 공고·마감 임박 웹 푸시 (FCM, iOS는 PWA 설치 후 지원) |

## 아키텍처

```
Firebase Hosting (dashboard/)  ──rewrites /api/**──▶  Cloud Functions v2 (functions/, asia-east1)
  React (esbuild 사전컴파일)                             ├─ api            공공 API 프록시·리서치·푸시 등록
  Firestore 실시간 동기화                                ├─ notifyDaily    매일 08:30 공고 푸시
  FCM 서비스 워커                                        └─ researchDaily  매일 06:30 리서치 캐시
```

- **데이터 소스**: 청약홈·국토부 실거래가·LH(data.go.kr), 금감원 금융상품한눈에, 네이버 지도/검색, Gemini(무료 티어)
- **비밀키 관리**: 서버 전용 키는 **Firebase Secret Manager**(`firebase functions:secrets:set <KEY>`), 클라이언트 노출 공개 키(지도 Client ID, FCM VAPID 공개키)만 `functions/.env`
- **인증/보안**: 구글 로그인 + 허용 이메일 화이트리스트, Firestore 보안 규칙으로 데이터 보호 (`dashboard/firebase-config.example.js` 상단 규칙 참고)

## 디렉터리

```
dashboard/   프론트엔드 (app.jsx 소스 → app.js 컴파일 산출물) + 로컬 개발 서버(server.js)
functions/   Cloud Functions v2 (Node 22) — API 프록시·스케줄러·푸시
firebase.json / .firebaserc   Hosting rewrites·Functions 설정
```

## 시작하기

```bash
# 로컬 실행 (Node 18+) — 샘플 데이터로도 동작, 키 넣으면 실데이터
cd dashboard && node server.js        # http://localhost:5173

# 프론트 수정 시 재컴파일 (app.jsx → app.js)
npx esbuild app.jsx --jsx=transform --loader:.jsx=jsx --charset=utf8 --outfile=app.js

# 배포 (프론트 + API)
firebase deploy
```

키 발급처·환경변수 상세는 [dashboard/README.md](dashboard/README.md) 참고.

## 브랜치 전략 (git flow)

| 브랜치 | 역할 |
|---|---|
| `main` | 배포 브랜치 — 여기 머지되면 `firebase deploy` |
| `develop` | 통합 브랜치 — 기능 개발의 베이스 |
| `feature/*` | 기능 개발 (`develop`에서 분기 → `develop`으로 머지) |
| `hotfix/*` | 운영 긴급 수정 (`main`에서 분기 → `main`·`develop` 양쪽 머지) |

```bash
git checkout develop && git pull
git checkout -b feature/새기능
# 작업 후
git push -u origin feature/새기능   # → develop 대상 PR
```

## 주의

- 이 레포는 public입니다 — 시크릿은 절대 커밋하지 마세요 (`functions/.env`, `functions/.secret.local`, `dashboard/firebase-config.js`는 gitignore 대상).
- 금액·제도 수치는 2026 상반기 공개자료 기반 추정치이며, 네이버 부동산 연동은 비공식 API라 차단될 수 있습니다. 개인 참고용으로만 사용하세요.
