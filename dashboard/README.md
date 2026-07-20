# 우리 라이프 플랜 — 통합 대시보드

테마 기반 통합 대시보드. 홈에서 총 현금과 테마별 자금 배분을 관리하고, 각 테마의 서브탭에서 상세 기능을 사용한다.
**부부 소득·자산(진단 입력값)은 전역 공유 상태** — 어디서 바꾸든 모든 테마(진단·대출·정책 판정·시뮬레이터·홈 요약)에 즉시 반영된다.

## 테마 구성
- **홈** — KPI(총 현금·여유자금·결혼 D-day·절세계좌 잔액) · 자금 배분 게이지 · 테마 요약 카드 · 통합 타임라인
- **부동산** — 진단 / 전략·혜택(+제도 뉴스) / **핫이슈(실시간 부동산 뉴스, 새로고침)** / 대출계산기 / 청약정보(**새로고침으로 최신 공고**, 하단 대형 지도) / 매물·지도(하단 대형 지도) / 플랜(타임라인+체크리스트 통합)
- **돈 모으기** — 납입 트래커(**계좌 유형별 그룹**, 소계·달성률) / **저축 시뮬레이터(월 납입 → 연도별 자산, 월복리)** / 절세 가이드(ISA·연금·IRP, 증여 계산기) / **정책·혜택(2026 신혼부부 정책 14종, 우리 소득 기준 자동 판정 + 정책 뉴스)**
- **결혼식** — 개요·예산(D-day, 예산표) / 체크리스트(**2026 실제 후기 기반 6단계 + 단계별 후기 검색 링크 + 꿀팁**) / **인기 식장(서울 10곳, 유형 필터, 식대·대관료)** / **박람회(다가오는 일정 + 정기 박람회)** / 신혼여행(**여행지별 추천 경로** + 후기 검색)
- 모든 테마에 커스텀 메모. 로컬 저장 + (Firebase 설정 시) 클라우드 동기화.

## 공유·배포 (Firebase)
`firebase-config.example.js`를 `firebase-config.js`로 복사해 값을 채우면:
- **구글 로그인** 필수 + `ALLOWED_EMAILS` 목록에 있는 계정만 접근
- 모든 설정·입력값이 **Firestore**(`households/main`)에 실시간 동기화 → 부부가 함께 사용 가능
- 실제 보안은 Firestore 규칙으로 강제(example 파일 상단 주석의 규칙 참고). 파일이 없으면 로그인 없는 로컬 모드.

### 배포 구성 — Firebase 단일 배포 (기본)
Hosting rewrites가 `/api/**`를 **Cloud Functions(2nd gen, `functions/` 폴더)**로 라우팅하므로 별도 API 서버가 필요 없습니다.
프론트와 API가 같은 도메인 → `API_BASE`는 빈 값 그대로, CORS 없음.

1. **(최초 1회)** Firebase 콘솔에서 프로젝트를 **Blaze 요금제**로 업그레이드 (Functions 필수 조건. 무료 할당량이 커서 이 규모는 사실상 0원)
2. `functions/.env.example`을 `functions/.env`로 복사해 키 입력 (`CHEONGYAK_KEY`, `NAVER_MAP_KEY`, `FSS_KEY`, `ANTHROPIC_API_KEY`)
3. `cd functions && npm install` (최초 1회)
4. `firebase deploy` → `https://planner-aa15f.web.app` (프론트+API 동시 배포)
5. Firebase 콘솔 → Authentication → 승인된 도메인에 배포 도메인 추가, NCP 콘솔 → Maps → Web 서비스 URL에도 추가

**리서치 자동 갱신**: `researchDaily` 스케줄 함수가 매일 06:30(KST) 식장/정책/금리를 미리 조사해 Firestore(`research/{topic}`)에 캐시합니다. 화면의 "최신 정보로 갱신" 버튼은 대부분 캐시를 즉시 받고, 강제 갱신이 60초(Hosting 타임아웃)를 넘기면 실패로 보여도 서버가 캐시를 남기므로 1~2분 뒤 다시 누르면 됩니다.

**은행 금리는 LLM이 아니라 금감원 공시**: `FSS_KEY`가 있으면 bankloans 토픽은 [금융상품 한눈에](https://finlife.fss.or.kr) 공시 API의 실제 공시값을 반환합니다(없으면 Claude 리서치로 폴백).

네이버 지도 키는 화면 설정이 아니라 **서버 env(`NAVER_MAP_KEY`) 단일 소스**로 관리됩니다.

## 뉴스 연동
`/api/news?q=검색어` — 구글뉴스 RSS 사용(키 불필요). 프록시 미가동 시 화면에서 네이버 뉴스 검색 링크로 폴백.

## 실행 방법

### A. 그냥 보기 (샘플데이터)
```
open index.html          # macOS
```
더블클릭으로 바로 열림. 청약/매물은 `data/samples.js`의 과천 예시로 동작.
지도는 ⚙️ 설정에 네이버 지도 키를 넣으면 활성화됩니다.

### B. 실데이터 연동 (프록시)
브라우저에서 청약홈/네이버 부동산 API를 직접 부르면 CORS로 막히므로 프록시를 씁니다. (Node 18+)
```
node server.js                      # http://localhost:5173
CHEONGYAK_KEY=발급키 node server.js   # 청약 실데이터까지 활성화
```
프록시가 응답하면 화면 배지가 **실데이터**로 바뀌고, 실패하면 자동으로 **샘플**로 폴백합니다.

## 필요한 키 발급

| 기능 | 발급처 | 넣는 곳 |
|---|---|---|
| 네이버 지도 | [NCP 콘솔](https://console.ncloud.com) → Maps → Application 등록 → **Client ID(ncpKeyId)** | 화면 ⚙️ 설정 (localStorage 저장) |
| 청약 정보 | [공공데이터포털](https://data.go.kr) → 「한국부동산원_청약홈 APT 분양정보 조회」 활용신청 → **serviceKey(decoded)** | `CHEONGYAK_KEY` 환경변수 |
| 은행 주담대 금리 | [금감원 금융상품한눈에](https://finlife.fss.or.kr) → 오픈API → **인증키 신청** (무료, 즉시발급) | `FSS_KEY` 환경변수 |
| 식장/정책 리서치 | [console.anthropic.com](https://console.anthropic.com) → API 키 (선택) | `ANTHROPIC_API_KEY` 환경변수 |
| 네이버 매물 | 공식 API 없음 (프록시가 비공식 내부 API 대리 호출) | 없음 |

환경변수 위치: 로컬 개발은 `dashboard/.env.product`, Firebase 배포는 `functions/.env` (둘 다 gitignore).

- 네이버 지도 키는 콘솔에서 **웹 서비스 URL**에 `http://localhost:5173` 및 사용할 도메인을 등록해야 동작합니다.

## 주의
- 네이버 부동산 크롤링은 **비공식**이며 서비스 약관/차단 정책에 영향받습니다. 개인 참고용으로만 사용하세요.
- 모든 금액·제도 수치는 2026 상반기 공개자료 기반 **추정치**입니다.

## 코드 수정 & 빌드
UI 로직은 **`app.jsx`(소스)** 에 있고, 브라우저는 이를 컴파일한 **`app.js`** 를 로드합니다.
(브라우저 내 Babel 방식은 대용량 코드에서 자동 런타임 `import` 주입 문제가 있어 사전컴파일로 전환했습니다.)

`app.jsx`를 수정하면 다시 컴파일하세요:
```
npx esbuild app.jsx --jsx=transform --loader:.jsx=jsx --outfile=app.js
```
- `--jsx=transform` → JSX를 전역 `React.createElement`로 변환(별도 import 불필요, UMD React 사용).

## 데이터 갱신
- 청약/매물 샘플: `data/samples.js`
- 재무 전략 원천: 상위 폴더 `과천_신혼부부_재무설계_총정리.md`
