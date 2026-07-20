# Next.js 전환 계획서 (v2 — 2026-07-20 재검토)

> 대상: futurePlanner (우리 라이프 플랜 대시보드)
> 전제: 추후 공개 서비스 확장 계획 있음 → Vite를 거치지 않고 Next.js로 한 번에 전환.
> 핵심 전략: **Phase 1은 정적 내보내기(`output: 'export'`) 모드**로 현재 인프라(Firebase Hosting + Functions)를 그대로 유지하고, 공개 전환 시점(Phase 2)에만 SSR/App Hosting을 켠다.
>
> **v2 변경**: 자녀 테마·전체 로드맵(게이지·캐러셀)·설정 팝업·블러·2열 그리드·식장 썸네일 등 v1 작성 이후 추가된 기능을 반영해 디렉터리 매핑, 상태 키 목록, 작업 규모를 갱신.

---

## 0. 현재 구조 요약 (2026-07-20 기준)

| 항목 | 현재 |
|---|---|
| 프론트 | `dashboard/app.jsx` 단일 파일(**~2,750줄**) → esbuild로 `app.js` 사전 컴파일, React 18 UMD + Tailwind CDN |
| 테마 | 홈 · 부동산 · 돈 모으기 · 결혼식 · **자녀** (5개) + 전체 로드맵(테마 횡단) |
| 상태 | localStorage(`usePersist`, **23개 키**) + Firestore 실시간 동기화(compat SDK, `households/main` 단일 문서) |
| 인증 | Firebase Auth(Google) + `ALLOWED_EMAILS` 허용 목록 + **인앱 브라우저 감지·외부 열기 안내** + 팝업 차단 시 리다이렉트 폴백 |
| API | Firebase Functions 2nd gen `api`(asia-east1) — Hosting rewrites `/api/**` (리전 제약: rewrites는 서울 미지원) |
| 스케줄 | `researchDaily`(매일 06:30 KST) → Firestore `research/{topic}` 캐시. 금리=금감원 공시, 식장/정책=Claude(프롬프트 캐싱) |
| 배포 | `firebase deploy` (Hosting: `dashboard/` 정적 서빙) |
| 전역 CSS | `.masonry`(2열 그리드·홀수 마지막 전폭), 캐러셀 snap, `.money-blur`, `.privacy-on`, heart 애니메이션 |

전환해도 **바뀌지 않는 것**: Functions API·스케줄 함수·Firestore 데이터·Firebase Auth·배포 URL.

---

## Phase 1 — Next.js 정적 모드 전환 (기능 변화 없음)

목표: 코드 구조 현대화(컴포넌트 분리 + TypeScript + 진짜 Tailwind 빌드). 사용자 화면·인프라·비용 변화 없음.

### 1-1. 스캐폴딩

```
npx create-next-app@latest web --ts --tailwind --app --src-dir --eslint
```

- `next.config.ts`: `output: 'export'`, `images.unoptimized: true`(정적 모드 필수 — 식장 썸네일 등 외부 이미지는 `<img>` 유지가 간단)
- 결과물: `web/out/` → `firebase.json`의 `hosting.public`을 `web/out`으로 변경. rewrites(`/api/**` → `api` 함수)는 그대로.
- 기존 `dashboard/`는 전환 완료 검증 전까지 유지(롤백 경로).

### 1-2. 디렉터리 설계 (app.jsx 분해 매핑 — v2 갱신)

```
web/src/
├── app/
│   ├── layout.tsx              # 폰트, 전역 CSS, AuthGate 래핑
│   ├── page.tsx                # 홈 (로드맵→부부정보→자금배분→테마현황→타임라인)
│   ├── realty/page.tsx
│   ├── saving/page.tsx
│   ├── wedding/page.tsx
│   └── kids/page.tsx           # ★ 자녀 테마 (v2 추가)
├── components/
│   ├── ui/                     # Card, Kpi, ToneBadge, Field, Select, Toggle, Stat,
│   │                           #   ProgressBar, NumInput, TextInput, IconBtn, Icon, InfoNote, Blur ★
│   ├── layout/                 # Sidebar, MobileNav, PillNav, Header, SettingsModal ★
│   ├── roadmap/                # ★ Roadmap(캐러셀), PhaseGauge, PhaseGaugeRow, GaugeBar
│   └── shared/                 # NewsPanel, LiveUpdateBtn, RefreshBtn, MapPanel,
│                               #   CustomNotes, SourceBadge, AuthGate(인앱 감지 포함 ★)
├── features/
│   ├── home/                   # 자금배분, 테마별현황(4카드), 통합 타임라인
│   ├── realty/                 # 진단(블러), 전략, 대출계산기(주담대 2열), 청약탭, 매물탭, 플랜
│   ├── saving/                 # 납입트래커, 시뮬레이터(트래커 연동 ★), 절세가이드, 정책탭
│   ├── wedding/                # 개요·예산, 체크리스트(타임라인 단계), 식장(썸네일 ★),
│   │                           #   박람회, 허니문(단독 코스 포함)
│   └── kids/                   # ★ 연령별 할 일, 영유아/초등/중고등/대학(KidsStageTab),
│                               #   증여 플랜(계산기), 정보·뉴스(학군+뉴스)
├── lib/
│   ├── format.ts               # won/wonShort/manWon, dday — 순수 문자열 (블러는 Blur 컴포넌트가 담당 ★)
│   ├── finance.ts              # computeDiagnosis, giftTax, estimateNetAnnual, priceTierCap, phaseCalc ★
│   ├── store.ts                # usePersist + localStorage 래퍼 (+ hydration 가드 ★)
│   ├── cloud.ts                # Firestore 동기화 (compat → modular SDK 교체)
│   ├── api.ts                  # /api/* fetch 레이어
│   └── naver-map.ts            # 지도 스크립트 싱글톤 로더
└── data/
    └── defaults.ts             # BANK_LOANS, WEDDING_VENUES(img 포함), HONEYMOON,
                                #   POLICY_BENEFITS, ROADMAP_DEFAULT, KIDS_* ★
```

- 화면 전부가 클라이언트 상태 기반 → 페이지·컴포넌트 대부분 `'use client'` (Phase 1에선 정상이며 의도된 것).
- **로드맵 데이터는 테마 횡단** — `Roadmap`(홈)과 `PhaseGauge`(부동산/결혼식/자녀 상단)가 같은 `roadmap-v2` 키를 읽음. 전환 시 컴포넌트별 `usePersist` 중복 구독 대신 **React Context(RoadmapProvider) 하나로 승격**하면 테마 간 이동 시 리렌더 일관성이 좋아짐(선택이지만 권장).
- `hh`(부부 정보)도 현재 App에서 props drilling — 같은 이유로 HouseholdContext 승격 권장.

### 1-3. 상태·데이터 이전 규칙 (가장 중요)

- **localStorage 키를 절대 바꾸지 않는다.** 현재 23개 키(2026-07-20 기준):
  - 동기화: `household-inputs-v2`, `home-alloc-v1`, `milestones-v1`, `roadmap-v2`,
    `saving-accounts-v1`, `saving-gift-v1`, `saving-sim-v1`, `policy-data-v1`, `bankloan-data-v1`,
    `wedding-info-v1`, `wedding-budget-v1`, `wedding-checklist-v2`, `wedding-venues-v3`,
    `wedding-venues-meta-v1`, `wedding-honeymoon-v5`, `kids-checklist-v1`, `kids-gift-calc-v1`,
    `news-region-v1`, `checklist-done-v2`, `cheongyak-filter-v1`, `realty-filter-v1`
  - 기기별(LOCAL_ONLY_KEYS): `active-theme-v1`, `realty-tab-v1`, `saving-tab-v1`, `wedding-tab-v1`,
    `kids-tab-v1`, `privacy-mode-v1`, `roadmap-view-v1`(잔재), `naver-map-key`(잔재)
- Firestore 동기화 로직(cloud.queue/subscribe/pullOnce, `_by` 클라이언트ID 규약)은 동작 동일하게 포팅. SDK만 compat → **modular** npm 패키지로 교체.
- `firebase-config.js`(gitignore) 값은 `web/.env.local`의 `NEXT_PUBLIC_FIREBASE_*`로. `ALLOWED_EMAILS`·`API_BASE`도 env로.
- **Hydration 가드 필수**: 정적 export도 빌드 시 프리렌더하므로 `usePersist`는 "초기 렌더=기본값 → 마운트 후 localStorage 로드" 패턴으로 재작성(mounted 플래그). 특히 로드맵 캐러셀의 초기 스크롤 위치(`useEffect` 기반)와 `phaseCalc`의 `Date.now()`는 SSR/CSR 불일치 소지 — **게이지·D-day·현재단계 계산은 마운트 후에만 렌더**하도록 가드.

### 1-4. 스타일 전환 (v2 갱신)

- Tailwind CDN → 로컬 빌드(v4). 임의값 클래스(`text-[15px]` 등) 위주라 대부분 그대로 동작.
- 전역 CSS 이전 목록(현 index.html `<style>`): `.masonry`(2열 그리드 + `last-child:nth-child(odd)` 전폭 규칙), `.money-blur`, `.privacy-on input` 블러, heart 애니메이션(`prefers-reduced-motion` 포함), `.no-scrollbar` → `globals.css`.
- 로드맵 캐러셀은 snap 유틸(`snap-x snap-mandatory`)이라 Tailwind 기본으로 충분.
- 폰트: `next/font`(JetBrains Mono) + Pretendard CDN 유지 또는 `next/font/local`.

### 1-5. 인증 이전 (v2 추가)

- AuthGate로 분리: 로딩/로그인/거부 화면 + **인앱 브라우저(카카오톡·인스타 등) 감지 → 외부 브라우저 열기**(카카오 스킴·안드로이드 intent·iOS 주소복사) 로직 그대로 포팅.
- `signInWithPopup` 실패 시 `signInWithRedirect` 폴백 유지. modular SDK에선 `getRedirectResult` 처리 명시 필요.

### 1-6. 빌드·배포 파이프라인

```
cd web && npm run build        # → web/out
firebase deploy                 # hosting.public: web/out
```

- `dashboard/server.js`(로컬 개발 서버)는 폐기 → 로컬 개발은 `next dev` + `firebase emulators:start --only functions`(또는 next.config `rewrites`로 배포된 함수 URL 프록시 — 정적 export에선 dev 전용으로만 동작함에 유의).
- README의 esbuild 빌드 안내 삭제, 새 개발 흐름 문서화.

### 1-7. 검증 체크리스트 (v2 갱신)

- [ ] 구글 로그인 + ALLOWED_EMAILS 게이트 + 인앱 브라우저 안내 동작
- [ ] 기존 기기에서 localStorage 데이터 23개 키 전부 유실 없음 (특히 roadmap-v2 체크 상태)
- [ ] Firestore 양방향 동기화 (한쪽 수정 → 다른 기기 반영)
- [ ] /api/* 5종 라이브 + 리서치 캐시 응답
- [ ] 로드맵: 캐러셀 스와이프/화살표/도트, 완료 숨김, '오늘' 마커 위치, 테마별 PhaseGauge 동기화
- [ ] 블러 토글: 부부정보·KPI·자금배분·테마현황 자산치 + 입력칸 블러
- [ ] 식장 썸네일(외부 이미지) 로드 + URL 교체 입력
- [ ] 증여 계산기·저축 시뮬레이터(트래커 연동) 계산값 일치
- [ ] 네이버 지도 로딩(중복 로드 없음), 모바일 하단 네비·1열 레이아웃
- [ ] hydration 경고 0건 (콘솔 확인)

**예상 규모(v2)**: 기능이 v1 대비 ~40% 늘어 **집중 작업 2~3일**. 리스크는 여전히 낮음(기능 추가 없음 + `dashboard/` 롤백 경로 유지). 권장 이전 순서: `lib/`(순수 함수, 테스트 용이) → ui 컴포넌트 → roadmap → 홈 → 자녀 → 결혼식 → 돈모으기 → 부동산(지도 포함, 가장 마지막).

---

## Phase 2 — 공개 서비스 전환 (시점 확정 후)

Phase 1 구조를 그대로 두고 인프라·데이터 모델만 확장한다.

1. **호스팅 전환**: `output: 'export'` 제거 → Firebase **App Hosting**(GitHub 연동 자동 배포, Cloud Run 기반 SSR). Functions의 프록시 로직은 Route Handler(`app/api/*/route.ts`)로 흡수 가능 — 단 `researchDaily` 스케줄은 Cloud Functions/Scheduler 유지.
2. **멀티테넌트 데이터 모델**: `households/main` 단일 문서 → `households/{id}` + 멤버십 + 보안 규칙 재작성, 초대 코드 온보딩. **localStorage-우선 구조를 Firestore-우선으로 뒤집는 작업**이 Phase 2 최대 공수(현재는 localStorage가 원본, 클라우드가 미러).
3. **인증 확장**: 허용 목록 제거 → 일반 가입, 카카오 로그인 검토(인앱 브라우저 이슈도 카카오 로그인 채택 시 완화).
4. **공개 페이지**: 랜딩(서버 컴포넌트, SEO/OG), 소개·요금. 로그인 후 영역은 기존 클라이언트 컴포넌트 그대로.
5. **운영 준비**: 리서치 API rate limit·사용자별 쿼터(현재 전역 캐시 구조라 사용자 증가에도 LLM 비용은 고정 — 유지), 에러 트래킹, 애널리틱스, 약관/개인정보처리방침.
6. **콘텐츠 법적 검토**: 식장 썸네일(네이버 CDN 핫링크)은 개인용은 무방하나 **공개 서비스에선 교체 필수** — 제휴/공식 제공 이미지 또는 사용자 업로드로 전환.

---

## 리스크 및 주의사항 (v2 갱신)

| 리스크 | 대응 |
|---|---|
| localStorage 키 변경으로 기존 데이터 유실 | 키 동결(1-3). 전환 후 첫 접속 검증 전까지 `dashboard/` 백업 유지 |
| Hydration mismatch (Date.now 기반 게이지·D-day·캐러셀 초기 스크롤) | 마운트 가드 일괄 적용, 날짜 계산 컴포넌트는 CSR 전용 렌더 |
| 네이버 지도 스크립트 중복 로드 | `naverPromise` 싱글톤 유지, `next/script` 사용 |
| 외부 이미지(pstatic 썸네일) 차단·소실 | `<img>` + onError 플레이스홀더 폴백이 이미 있음 — 그대로 이전. `next/image`는 쓰지 않음(unoptimized라 이점 없음) |
| Tailwind v4 클래스 차이 | 임의값 위주라 영향 적음. 시각 회귀 육안 점검(특히 게이지 마커 위치) |
| compat → modular SDK 차이 | onSnapshot/merge 세만틱 동일. `signInWithRedirect` 결과 처리만 명시 추가 |
| 같은 usePersist 키 다중 구독(Roadmap/PhaseGauge) | Context 승격으로 단일 소스화(권장) 또는 현행 유지(탭당 1개 마운트라 실害 없음) |

## 진행 순서 제안

1. Phase 1 착수 결정 → `web/` 스캐폴딩 + `lib/` + `data/defaults.ts` 이전(순수 코드, 리스크 0)
2. ui/roadmap 공통 컴포넌트 → 홈 → 자녀 → 결혼식 → 돈모으기 → 부동산(지도) 순 이전
3. 1-7 체크리스트 전 항목 통과 후 `firebase.json` 전환 배포, `dashboard/`는 한 주 뒤 삭제
4. 공개 서비스 확정 시 Phase 2 착수 (멀티테넌트 설계는 별도 계획서로 상세화)
