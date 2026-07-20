# Next.js 전환 계획서

> 작성: 2026-07-20 · 대상: futurePlanner (우리 라이프 플랜 대시보드)
> 전제: 추후 공개 서비스 확장 계획 있음 → Vite를 거치지 않고 Next.js로 한 번에 전환.
> 핵심 전략: **Phase 1은 정적 내보내기(`output: 'export'`) 모드**로 현재 인프라(Firebase Hosting + Functions)를 그대로 유지하고, 공개 전환 시점(Phase 2)에만 SSR/App Hosting을 켠다.

---

## 0. 현재 구조 요약

| 항목 | 현재 |
|---|---|
| 프론트 | `dashboard/app.jsx` 단일 파일(~2,300줄) → esbuild로 `app.js` 사전 컴파일, React 18 UMD + Tailwind CDN |
| 상태 | localStorage(`usePersist`) + Firebase Firestore 실시간 동기화(compat SDK, `households/main` 단일 문서) |
| 인증 | Firebase Auth(Google) + `ALLOWED_EMAILS` 허용 목록 |
| API | Firebase Functions 2nd gen `api`(asia-east1) — Hosting rewrites `/api/**` |
| 스케줄 | `researchDaily` 함수(매일 06:30 KST) → Firestore `research/{topic}` 캐시 |
| 배포 | `firebase deploy` (Hosting: `dashboard/` 정적 서빙) |

전환해도 **바뀌지 않는 것**: Functions API·스케줄 함수·Firestore 데이터·Firebase Auth·배포 URL.

---

## Phase 1 — Next.js 정적 모드 전환 (기능 변화 없음)

목표: 코드 구조 현대화(컴포넌트 분리 + TypeScript + 진짜 Tailwind 빌드). 사용자 화면·인프라·비용 변화 없음.

### 1-1. 스캐폴딩

```
npx create-next-app@latest web --ts --tailwind --app --src-dir --eslint
```

- `next.config.ts`: `output: 'export'`, `distDir` 기본, `images.unoptimized: true`(정적 모드 필수)
- 결과물: `web/out/` → `firebase.json`의 `hosting.public`을 `web/out`으로 변경. rewrites(`/api/**` → `api` 함수)는 그대로.
- 기존 `dashboard/`는 전환 완료 검증 전까지 유지(롤백 경로).

### 1-2. 디렉터리 설계 (app.jsx 분해 매핑)

```
web/src/
├── app/
│   ├── layout.tsx              # 폰트(Pretendard·JetBrains Mono), 전역 CSS
│   ├── page.tsx                # 홈 테마
│   ├── realty/page.tsx         # 부동산 테마
│   ├── saving/page.tsx         # 돈 모으기 테마
│   └── wedding/page.tsx        # 결혼식 테마
├── components/
│   ├── ui/                     # Card, Kpi, ToneBadge, Field, Select, Toggle,
│   │                           #   Stat, ProgressBar, NumInput, TextInput, IconBtn, Icon …
│   ├── layout/                 # Sidebar, MobileNav, PillNav, Header, PrivacyToggle
│   └── shared/                 # NewsPanel, LiveUpdateBtn, RefreshBtn, MapPanel,
│                               #   CustomNotes, SourceBadge, AuthGate(Login/Denied)
├── features/
│   ├── home/                   # 자금배분, 테마요약 카드, 통합 타임라인
│   ├── realty/                 # 진단, 전략, 대출계산기, 청약탭, 매물탭, 플랜
│   ├── saving/                 # 납입트래커, 시뮬레이터, 절세가이드, 정책탭
│   └── wedding/                # 개요·예산, 체크리스트(타임라인), 식장, 박람회, 허니문
├── lib/
│   ├── format.ts               # won/wonShort/manWon(+PRIVACY 마스킹), dday
│   ├── finance.ts              # computeDiagnosis, giftTax, estimateNetAnnual, priceTierCap …
│   ├── store.ts                # usePersist + localStorage 래퍼
│   ├── cloud.ts                # Firestore 동기화 (compat → modular SDK 교체)
│   ├── api.ts                  # /api/* fetch 레이어 (loadCheongyak/loadRealty/loadNews/research)
│   └── naver-map.ts            # 지도 스크립트 로더
└── data/
    └── defaults.ts             # BANK_LOANS, WEDDING_VENUES, HONEYMOON, POLICY_BENEFITS 등 기본 데이터
```

- 화면 전부가 클라이언트 상태 기반이므로 페이지·컴포넌트 대부분 `'use client'`. Phase 1에서 서버 컴포넌트는 사실상 layout뿐 — 정상이며 의도된 것.
- 테마 전환을 라우트로 승격(`/realty` 등). 서브탭은 현행대로 localStorage 유지(`realty-tab-v1` 등 키 재사용).

### 1-3. 상태·데이터 이전 규칙 (가장 중요)

- **localStorage 키를 절대 바꾸지 않는다** — `household-inputs-v2`, `wedding-checklist-v2`, `notes-*-v1` 등 기존 키 그대로 사용해야 두 사람의 기존 입력값이 유실 없이 이어진다.
- Firestore 동기화 로직(cloud.queue/subscribe/pullOnce, `LOCAL_ONLY_KEYS`, `_by` 클라이언트ID 규약)은 동작 동일하게 포팅. SDK만 compat(`window.firebase`) → **modular(`firebase/app`, `firebase/auth`, `firebase/firestore`) npm 패키지**로 교체.
- `firebase-config.js`(gitignore)의 값은 `web/.env.local`의 `NEXT_PUBLIC_FIREBASE_*`로 이동. `ALLOWED_EMAILS`·`API_BASE`도 env로.
- SSR 아님에 유의: 정적 export도 빌드 시 프리렌더를 하므로 `localStorage`/`window` 접근은 반드시 `useEffect` 이후 또는 lazy 초기화(현행 `usePersist` 패턴 유지하되 hydration mismatch 방지용 mounted 가드 추가).

### 1-4. 스타일 전환

- Tailwind CDN → 로컬 빌드(v4). 현재 클래스는 유틸리티 위주라 대부분 그대로 동작.
- 커스텀 CSS(index.html의 `.masonry`, heart 애니메이션, `.privacy-on` 블러) → `globals.css`로 이동.
- 폰트: Google Fonts link → `next/font` (JetBrains Mono), Pretendard는 CDN 유지 또는 `next/font/local`.

### 1-5. 빌드·배포 파이프라인

```
cd web && npm run build        # → web/out
firebase deploy                 # hosting.public: web/out
```

- `dashboard/server.js`(로컬 개발 서버)는 폐기 → 로컬 개발은 `next dev` + `firebase emulators:start --only functions`(또는 next.config rewrites로 함수 URL 프록시).
- README의 esbuild 빌드 안내 삭제, 새 개발 흐름 문서화.

### 1-6. 검증 체크리스트

- [ ] 구글 로그인 + ALLOWED_EMAILS 게이트 동작
- [ ] 기존 기기에서 접속 시 localStorage 데이터(입력값·체크리스트·메모) 그대로 보임
- [ ] Firestore 양방향 동기화(한쪽 수정 → 다른 기기 반영)
- [ ] /api/* 5종(청약·매물·뉴스·설정·리서치) 라이브 동작
- [ ] 네이버 지도 로딩(도메인 등록 확인)
- [ ] 금액 블러 토글, 커스텀 호칭, 체크리스트 현재 단계 강조
- [ ] 모바일(하단 네비·1열 레이아웃) 확인
- [ ] Lighthouse 성능이 현행 이상 (CDN 스크립트 제거로 개선 기대)

**예상 규모**: 순수 구조 이전으로 집중 작업 1~2일. 리스크는 낮음(기능 추가 없음 + `dashboard/` 롤백 경로 유지).

---

## Phase 2 — 공개 서비스 전환 (시점 확정 후)

Phase 1 구조를 그대로 두고 인프라·데이터 모델만 확장한다.

1. **호스팅 전환**: `output: 'export'` 제거 → Firebase **App Hosting**(GitHub 연동 자동 배포, Cloud Run 기반 SSR). Functions의 프록시 로직은 Next.js Route Handler(`app/api/*/route.ts`)로 흡수 가능 — 단 `researchDaily` 스케줄은 Cloud Functions/Scheduler에 유지.
2. **멀티테넌트 데이터 모델**: Firestore `households/main` 단일 문서 → `households/{householdId}` + 멤버십(`members: [uid]`) + 보안 규칙 재작성. 초대 코드로 배우자 연결하는 온보딩 플로우.
3. **인증 확장**: ALLOWED_EMAILS 허용 목록 제거 → 일반 가입. 이메일/카카오 로그인 추가 검토.
4. **공개 페이지**: 랜딩(서버 컴포넌트, SEO 메타·OG 태그), 요금/소개 페이지. 로그인 후 영역은 기존 클라이언트 컴포넌트 그대로.
5. **운영 준비**: API 사용량 보호(리서치 호출 rate limit·사용자별 쿼터), 에러 트래킹(Sentry), 애널리틱스, 이용약관/개인정보처리방침.
6. **비용 재검토**: 사용자 수 증가 시 청약홈/금감원 API 일일 한도, Claude 리서치는 전역 캐시 공유 구조라 사용자 수와 무관하게 유지 가능.

---

## 리스크 및 주의사항

| 리스크 | 대응 |
|---|---|
| localStorage 키 변경으로 기존 데이터 유실 | 키 동결 원칙(1-3). 전환 후 첫 접속에서 데이터 확인 전까지 `dashboard/` 백업 유지 |
| 정적 export에서 hydration mismatch | `usePersist` 초기값을 SSR-safe하게(마운트 후 로드), `suppressHydrationWarning` 최소 사용 |
| 네이버 지도 스크립트가 Next 환경에서 중복 로드 | 현행 `naverPromise` 싱글톤 패턴 유지, `next/script` 사용 |
| Tailwind v4 클래스 차이 | 임의값(`text-[15px]` 등) 위주라 영향 적음. 전환 후 시각 회귀 육안 점검 |
| compat → modular SDK 동작 차이 | onSnapshot/merge 세만틱 동일. 오프라인 캐시 옵션만 명시적으로 설정 |

## 진행 순서 제안

1. Phase 1 착수 결정 → `web/` 스캐폴딩 + `lib/`(순수 함수)부터 이전(테스트 쉬움)
2. UI 공통 컴포넌트 → 테마별 feature 순서로 이전 (홈 → 결혼식 → 돈모으기 → 부동산)
3. 전 항목 검증 후 `firebase.json` 전환 배포, `dashboard/`는 한 주 뒤 삭제
4. 공개 서비스 확정 시 Phase 2 착수 (별도 계획서로 상세화)
