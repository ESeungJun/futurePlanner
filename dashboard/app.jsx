const { useState, useEffect, useRef, useMemo } = React;

/* ============== helpers ============== */
// 금액 블러 모드 — App이 렌더 시점에 갱신하는 모듈 변수. 켜져 있으면 모든 금액 포맷터가 마스킹을 반환한다.
let PRIVACY = false;
const MASK = "●●●●";
const won = (n) => {
  if (PRIVACY) return MASK;
  if (n === null || n === undefined || isNaN(n)) return "-";
  const eok = Math.floor(n / 100000000);
  const man = Math.round((n % 100000000) / 10000);
  if (eok > 0) return `${eok.toLocaleString()}억${man > 0 ? " " + man.toLocaleString() + "만" : ""}`;
  return `${man.toLocaleString()}만원`;
};
const wonShort = (n) => (PRIVACY ? MASK : n === null || n === undefined ? "확인 필요" : (n / 100000000).toFixed(1) + "억");
const manWon = (n) => won((n || 0) * 10000);

function dday(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function ddayText(n) {
  if (n === null) return "";
  if (n === 0) return "D-Day";
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

function priceTierCap(price) {
  if (price <= 1_500_000_000) return 600_000_000;
  if (price <= 2_500_000_000) return 400_000_000;
  return 200_000_000;
}
function loanFromMonthlyPayment(monthlyPayment, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  if (i <= 0) return monthlyPayment * n;
  return monthlyPayment * (1 - Math.pow(1 + i, -n)) / i;
}
const GIFT_TAX_BRACKETS = [
  { upTo: 100_000_000, rate: 0.10, deduction: 0 },
  { upTo: 500_000_000, rate: 0.20, deduction: 10_000_000 },
  { upTo: 1_000_000_000, rate: 0.30, deduction: 60_000_000 },
  { upTo: 3_000_000_000, rate: 0.40, deduction: 160_000_000 },
  { upTo: Infinity, rate: 0.50, deduction: 460_000_000 },
];
function giftTax(base) {
  if (base <= 0) return 0;
  const b = GIFT_TAX_BRACKETS.find(x => base <= x.upTo);
  return Math.max(0, base * b.rate - b.deduction);
}
const INCOME_TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity, rate: 0.45, deduction: 65_940_000 },
];
function estimateNetAnnual(grossAnnualWon) {
  const g = Math.max(0, grossAnnualWon);
  const monthlyGross = g / 12;
  const npBase = Math.min(monthlyGross, 6_370_000);
  const np = npBase * 0.0475;
  const hi = monthlyGross * 0.03595;
  const ltci = hi * 0.1295;
  const ei = monthlyGross * 0.009;
  const insuranceAnnual = (np + hi + ltci + ei) * 12;
  let deduction;
  if (g <= 5_000_000) deduction = g * 0.7;
  else if (g <= 15_000_000) deduction = 3_500_000 + (g - 5_000_000) * 0.4;
  else if (g <= 45_000_000) deduction = 7_500_000 + (g - 15_000_000) * 0.15;
  else if (g <= 100_000_000) deduction = 12_000_000 + (g - 45_000_000) * 0.05;
  else deduction = 14_750_000 + (g - 100_000_000) * 0.02;
  const earnedIncomeAmount = Math.max(0, g - deduction);
  const taxBase = Math.max(0, earnedIncomeAmount - 1_500_000 - insuranceAnnual);
  const b = INCOME_TAX_BRACKETS.find(x => taxBase <= x.upTo);
  let incomeTax = Math.max(0, taxBase * b.rate - b.deduction);
  let credit = incomeTax <= 1_300_000 ? incomeTax * 0.55 : 715_000 + (incomeTax - 1_300_000) * 0.3;
  let creditCap = 740_000;
  if (g > 33_000_000) creditCap = Math.max(660_000, 740_000 - (g - 33_000_000) * 0.008);
  if (g > 70_000_000) creditCap = Math.max(500_000, 660_000 - (g - 70_000_000) * 0.5 / 100);
  credit = Math.min(credit, creditCap);
  incomeTax = Math.max(0, incomeTax - credit);
  const totalTax = incomeTax * 1.1;
  return g - insuranceAnnual - totalTax;
}

/* ============== localStorage ============== */
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    cloud.queue(k, v); // 로그인 상태면 Firestore에도 동기화
  },
};

/* ============== Firebase 클라우드 동기화 (선택 — firebase-config.js 있으면 활성) ============== */
const CLIENT_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const LOCAL_ONLY_KEYS = ["active-theme-v1", "realty-tab-v1", "saving-tab-v1", "wedding-tab-v1", "naver-map-key", "privacy-mode-v1"]; // 기기별로 다른 게 자연스러운 값
const cloud = {
  enabled: typeof window !== "undefined" && !!(window.FIREBASE_CONFIG && window.firebase),
  db: null, user: null, pending: {}, timer: null, started: false,
  init() {
    if (!this.enabled || this.started) return;
    this.started = true;
    firebase.initializeApp(window.FIREBASE_CONFIG);
    this.db = firebase.firestore();
  },
  ref() { return this.db.collection("households").doc("main"); },
  queue(k, v) {
    if (!this.enabled || !this.user || LOCAL_ONLY_KEYS.includes(k)) return;
    this.pending[k] = JSON.stringify(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const batch = { ...this.pending, _by: CLIENT_ID, _email: (this.user && this.user.email) || "", _at: new Date().toISOString() };
      this.pending = {};
      this.ref().set(batch, { merge: true }).catch(e => console.warn("클라우드 저장 실패:", e && e.message));
    }, 800);
  },
  // 원격 변경 → localStorage 반영 후 onRemote 콜백 (앱 리렌더)
  subscribe(onRemote) {
    if (!this.enabled || !this.user) return () => {};
    return this.ref().onSnapshot(snap => {
      const d = snap.data();
      if (!d || d._by === CLIENT_ID) return;
      let changed = false;
      Object.keys(d).forEach(k => {
        if (k.startsWith("_") || LOCAL_ONLY_KEYS.includes(k)) return;
        try { if (localStorage.getItem(k) !== d[k]) { localStorage.setItem(k, d[k]); changed = true; } } catch {}
      });
      if (changed) onRemote();
    }, e => console.warn("클라우드 수신 오류:", e && e.message));
  },
  // 첫 로그인 시: 클라우드에 있으면 내려받고, 비어 있으면 내 로컬 데이터를 올림
  async pullOnce() {
    if (!this.enabled || !this.user) return false;
    try {
      const snap = await this.ref().get();
      const d = snap.data();
      if (!d || Object.keys(d).filter(k => !k.startsWith("_")).length === 0) {
        const up = { _by: CLIENT_ID, _email: this.user.email || "", _at: new Date().toISOString() };
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!LOCAL_ONLY_KEYS.includes(k)) up[k] = localStorage.getItem(k);
        }
        await this.ref().set(up, { merge: true });
        return false;
      }
      let changed = false;
      Object.keys(d).forEach(k => {
        if (k.startsWith("_") || LOCAL_ONLY_KEYS.includes(k)) return;
        try { if (localStorage.getItem(k) !== d[k]) { localStorage.setItem(k, d[k]); changed = true; } } catch {}
      });
      return changed;
    } catch (e) { console.warn("초기 동기화 실패:", e && e.message); return false; }
  },
};
function usePersist(key, def) {
  const [v, setV] = useState(() => store.get(key, def));
  useEffect(() => { store.set(key, v); }, [key, v]);
  return [v, setV];
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ============== data fetch layer (live proxy → sample fallback) ============== */
// 정적 호스팅(Firebase Hosting)에서는 API 서버가 따로 필요함.
// firebase-config.js에서 window.API_BASE = "https://<앱이름>.onrender.com" 지정.
const api = (path) => ((typeof window !== "undefined" && window.API_BASE) || "") + path;

async function loadCheongyak() {
  try {
    const r = await fetch(api("/api/cheongyak"));
    if (r.ok) { const j = await r.json(); if (j.items && j.items.length) return { source: "live", items: j.items }; }
  } catch {}
  return { source: "sample", items: (window.SAMPLE_DATA || {}).cheongyak || [] };
}
async function loadRealty() {
  try {
    const r = await fetch(api("/api/naver-land"));
    if (r.ok) { const j = await r.json(); if (j.items && j.items.length) return { source: "live", items: j.items }; }
  } catch {}
  return { source: "sample", items: (window.SAMPLE_DATA || {}).realty || [] };
}

async function loadNews(q) {
  try {
    const r = await fetch(api(`/api/news?q=${encodeURIComponent(q)}&_=${Date.now()}`));
    if (r.ok) { const j = await r.json(); if (j.items && j.items.length) return { source: "live", items: j.items }; }
  } catch {}
  return { source: "sample", items: [] };
}

/* ============== Naver Maps loader ============== */
let naverPromise = null;
function loadNaver(key) {
  if (window.naver && window.naver.maps) return Promise.resolve();
  if (!key) return Promise.reject(new Error("no_key"));
  if (naverPromise) return naverPromise;
  naverPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
    s.onload = () => resolve();
    s.onerror = () => { naverPromise = null; reject(new Error("load_failed")); };
    document.head.appendChild(s);
  });
  return naverPromise;
}

/* ============== icons ============== */
const ICONS = {
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  trending: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  calc: <><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  check2: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  chevron: <polyline points="9 18 15 12 9 6"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  square: <rect x="3" y="3" width="18" height="18" rx="2"/>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  piggy: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  plane: <polygon points="3 11 22 2 13 21 11 13 3 11"/>,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
};
function Icon({ name, size = 16, className = "", fill = "none" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

/* ============== themes ============== */
const THEMES = [
  { id: "realty", label: "부동산", icon: "home", color: "#0A0A0A", desc: "진단 · 전략 · 대출 · 청약 · 매물지도" },
  { id: "saving", label: "돈 모으기", icon: "trending", color: "#6E6E6E", desc: "ISA · 연금저축 · IRP · 증여 절세" },
  { id: "wedding", label: "결혼식", icon: "heart", color: "#BDBDBD", desc: "예식 비용 · 체크리스트 · 신혼여행" },
];
const themeOf = (id) => THEMES.find(t => t.id === id);

/* ============== data constants (부동산 테마) ============== */
const REALTY_TABS = [
  { id: "diag", label: "진단", icon: "alert" },
  { id: "strategy", label: "전략·혜택", icon: "trending" },
  { id: "news", label: "핫이슈", icon: "search" },
  { id: "loan", label: "대출계산기", icon: "calc" },
  { id: "cheongyak", label: "청약정보", icon: "building" },
  { id: "realty", label: "매물·지도", icon: "pin" },
  { id: "plan", label: "플랜", icon: "calendar" },
];
const TARGETS = [
  { key: "sale84", label: "매매 · 84㎡(34평)", price: 2_600_000_000, note: "과천자이·써밋 등 준신축 실거래 평균" },
  { key: "sale59", label: "매매 · 59㎡(25평)", price: 2_000_000_000, note: "센트럴파크 푸르지오써밋 등 실거래 기준" },
  { key: "sub84", label: "청약(일반분양) · 84㎡", price: 1_590_000_000, note: "3기 재건축 4단지 분양가 추정" },
  { key: "jeonse59", label: "전세 · 59㎡ (대장주)", price: 880_000_000, note: "위버필드·자이 등 실거래 평균" },
  { key: "jeonse59budget", label: "전세 · 59㎡ (절충)", price: 640_000_000, note: "래미안슈르 등 연식 있는 단지" },
];
const STRATEGIES = [
  { title: "청약 (신생아·생애최초·일반공급)", badge: "1순위", tone: "good", points: [
    "분양가 상한제로 시세보다 8~10억 이상 저렴",
    "2026.6.15 신설된 신생아 특공 — 혼인기간 무관, 자녀 2세 미만",
    "소득 초과 시 일반공급(가점제·추첨제)으로 — 소득기준 자체가 없음",
    "단점: 당첨 확률 불확실, 입주까지 2~4년 소요" ] },
  { title: "매매", badge: "자기자본 부담 큼", tone: "warn", points: [
    "즉시 실입주, 원하는 단지·평형 직접 선택 가능",
    "가격구간 하드캡(2025.10.16 시행)이 소득과 무관하게 적용",
    "과천 84㎡ 기준 자기자본 20억 이상 필요할 수 있음",
    "대안: 소형 평형 또는 재건축 대기 단지로 눈높이 조정" ] },
  { title: "전세 → 매매/청약 갈아타기", badge: "현재 추천 경로", tone: "good", points: [
    "자기자본 부담이 낮아 지금 현금 규모로 실행 가능",
    "무주택 상태 유지하며 청약 가점(무주택기간) 계속 축적",
    "전세대출 DSR 반영 확대 가능성 — 갈아타기 시점 대출여력 축소 리스크",
    "전세금 상승분은 자산 형성에 기여하지 않는 기회비용 고려" ] },
];
const BENEFITS = [
  { title: "신혼특공(민영) — 자산기준 경로", fit: "해당 가능성 높음", tone: "good", body: "소득기준(160%) 초과해도 세대 부동산가액 3.31억 이하면 신청 가능. 무주택인 두 분은 부동산가액 0원이라 이 경로로 신청 가능성이 높아요.", link: "https://www.applyhome.co.kr", label: "청약홈 바로가기" },
  { title: "청약 일반공급(가점제·추첨제)", fit: "소득 무관 · 핵심 전략", tone: "good", body: "애초에 소득기준이 없어요. 무주택기간·부양가족수·통장 가입기간이 핵심이라 특공 소득요건과 무관하게 계속 도전할 수 있어요.", link: "https://www.applyhome.co.kr", label: "청약캘린더 보기" },
  { title: "신생아 특별공급(민영, 2026.6.15 신설)", fit: "자녀 계획 시 유리", tone: "neutral", body: "혼인기간 요건 없이 만 2세 미만 자녀만 있으면 신청 가능. 지금은 해당 없지만 출산 시점에 챙기면 좋아요.", link: "https://www.myhome.go.kr", label: "마이홈포털 안내" },
  { title: "생애최초 취득세 감면", fit: "과천엔 대부분 해당 없음", tone: "warn", body: "12억 이하 주택만 적용되는데, 과천 매물은 대부분 15억을 넘어 실질적으로 적용받기 어려워요.", link: "https://www.myhome.go.kr", label: "관련 안내" },
  { title: "신생아 특례 디딤돌·버팀목대출", fit: "소득은 OK, 가격상한에 막힘", tone: "warn", body: "소득요건(맞벌이 2억 이하)은 충족하지만 담보주택 6~9억, 전세보증금 5억 상한이 있어 과천엔 적용 안 돼요.", link: "https://nhuf.molit.go.kr", label: "주택도시기금 포털" },
  { title: "보금자리론 · 일반 디딤돌·버팀목", fit: "과천엔 해당 없음", tone: "bad", body: "보금자리론은 6억 이하 주택만, 일반 디딤돌·버팀목은 소득상한(6~8.5천만원대)이 있어 우리 조건으로는 이용이 어려워요.", link: "https://www.hf.go.kr", label: "한국주택금융공사" },
];
const TIMELINE = [
  { phase: "Phase 1 · 0~6개월", title: "기반 다지기", items: ["청약통장 가입기간·납입횟수 점검","부부합산 소득분위 정확히 계산 → 특공/일반공급 경로 확정","혼인신고일 확정(특공 7년 요건 기산점)","연금저축·IRP·ISA 계좌 개설, 자동이체 세팅"] },
  { phase: "Phase 2 · 6개월~1.5년", title: "전세 진입 + 자산 축적", items: ["과천 전세(59㎡ 기준 6.4억~8.8억선) 계약 실행","과천 신규 공급 단지 청약 일정 상시 모니터링","ISA 목적자금 축적 시작"] },
  { phase: "Phase 3 · 1.5~3년", title: "전세 만기 임박, 재평가", items: ["청약 당첨 여부 확인, 미당첨 시 매매 갈아타기 재검토","자기자본 갭 축소 추이 점검, 저축 속도 재조정"] },
  { phase: "Phase 4 · 3~5년+", title: "입주 및 안정화", items: ["입주 또는 매매 실행, 대출 상환계획 확정","자산 포트폴리오 재조정"] },
];
const CHECKLIST_INIT = [
  { cat: "청약 준비", items: ["청약통장 가입기간·납입횟수 확인","혼인관계증명서 준비","부부합산 소득분위 정확히 산출","자녀 계획 시 신생아특공 요건 확인"] },
  { cat: "대출/자금", items: ["기존 신용대출·할부 정리로 DSR 여유 확보","정책 모기지 소득·자산 요건 확인","고정 vs 변동금리 비교","비상자금(생활비 3~6개월분) 별도 확보"] },
  { cat: "정보 모니터링", items: ["청약홈 과천 지역 공급 일정 알림 설정","LH청약플러스 공고 확인","규제지역 지정 현황 반기 점검","도시근로자 월평균소득 고시 갱신 반영"] },
];

// 은행 주담대 대표 상품 (2026-07 보도·공시 기반 리서치 — 추정 범위, 실제는 우대조건별 상이)
const BANK_LOANS = [
  { bank: "케이뱅크", product: "아파트담보대출", rateMin: 4.05, rateMax: 7.5, rateType: "변동(신잔액 코픽스) · 주기형 5년", feature: "100% 비대면 · 전자계약 시 1금융권 변동 최저 수준 · 중도상환수수료 면제", link: "https://www.kbanknow.com" },
  { bank: "하나은행", product: "하나원큐 아파트론", rateMin: 4.1, rateMax: 7.0, rateType: "변동(코픽스) · 혼합형 · 주기형", feature: "모바일 완결형 비대면 주담대 · 전자약정 우대금리", link: "https://www.kebhana.com" },
  { bank: "KB국민은행", product: "KB주택담보대출", rateMin: 4.2, rateMax: 7.2, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "급여이체·카드실적 등 거래실적 우대 최대 약 1%p", link: "https://obank.kbstar.com" },
  { bank: "신한은행", product: "신한주택대출", rateMin: 4.2, rateMax: 7.1, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "SOL 비대면 신청 우대 · 3년 경과 후 중도상환수수료 면제", link: "https://bank.shinhan.com" },
  { bank: "우리은행", product: "우리WON주택대출", rateMin: 4.2, rateMax: 7.2, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "WON뱅킹 비대면 · 부수거래 없이도 기본금리 경쟁력", link: "https://spot.wooribank.com" },
  { bank: "NH농협은행", product: "NH주택담보대출", rateMin: 4.3, rateMax: 7.3, rateType: "변동(코픽스) · 혼합형 · 주기형", feature: "올원뱅크 비대면 우대 · 급여이체·NH카드 실적 우대", link: "https://banking.nonghyup.com" },
  { bank: "IBK기업은행", product: "IBK주택담보대출", rateMin: 4.3, rateMax: 6.8, rateType: "변동(코픽스) · 혼합형", feature: "i-ONE뱅크 비대면 · 상대적으로 안정적인 금리 운용", link: "https://mybank.ibk.co.kr" },
  { bank: "카카오뱅크", product: "주택담보대출", rateMin: 4.8, rateMax: 6.6, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "챗봇 100% 비대면 · 중도상환수수료 전액 면제", link: "https://www.kakaobank.com/products/mortgageLoan" },
];

/* ============== data constants (돈 모으기 테마) ============== */
const ACCOUNTS_DEFAULT = [
  { id: "a1", owner: "본인", type: "ISA", balance: 0, paid: 0, goal: 4000 },
  { id: "a2", owner: "배우자", type: "ISA", balance: 0, paid: 0, goal: 4000 },
  { id: "a3", owner: "본인", type: "연금저축", balance: 0, paid: 0, goal: 600 },
  { id: "a4", owner: "배우자", type: "연금저축", balance: 0, paid: 0, goal: 600 },
  { id: "a5", owner: "본인", type: "IRP", balance: 0, paid: 0, goal: 300 },
  { id: "a6", owner: "배우자", type: "IRP", balance: 0, paid: 0, goal: 300 },
];
const ACCOUNT_TYPES = ["ISA", "연금저축", "IRP", "청약통장", "예적금", "기타"];

/* ============== data constants (결혼식 테마) ============== */
const WEDDING_BUDGET_DEFAULT = [
  { id: "w1", name: "예식장 대관료", budget: 1000, spent: 0 },
  { id: "w2", name: "식대 (하객 250명 기준)", budget: 2000, spent: 0 },
  { id: "w3", name: "스드메 (스튜디오·드레스·메이크업)", budget: 500, spent: 0 },
  { id: "w4", name: "예물·예복", budget: 800, spent: 0 },
  { id: "w5", name: "신혼여행", budget: 1000, spent: 0 },
  { id: "w6", name: "청첩장·답례품·부수비용", budget: 200, spent: 0 },
];
// 2026 실제 준비 후기 기반 체크리스트 (블로그·카페 리서치, 2026-07 기준)
const WEDDING_CHECKLIST_DEFAULT = [
  { cat: "D-12~9개월", items: [
    "양가 인사·상견례 진행, 예식 시기·규모·예산 상한선 부부 합의",
    "웨딩북·다이렉트결혼준비 앱으로 웨딩홀 후보 추리고 주말 투어 (하루 2~3곳)",
    "토요일 12~14시 골든타임은 1년 전에도 마감 — 맘에 든 홀은 보증인원·식대·페이백 확인 후 바로 가계약",
    "플래너 동행 vs 워킹(직접) 결정, 스드메 정찰제 견적 3개 이상 비교",
    "인기 본식 스냅·DVD 업체는 1년 전 마감 — 홀 계약 직후 날짜 걸어두기",
    "공동 예산 시트(노션/스프레드시트) 만들어 계약금·잔금 일정 기록 시작",
    "신혼집 방향(매매·전세) 결정, 혼인신고 타이밍별 대출 유불리 공부" ] },
  { cat: "D-9~6개월", items: [
    "스드메 확정 계약 — 원본·수정본 컷 수, 헬퍼비·얼리스타트비 추가금 계약서에 명시",
    "드레스 투어(3~4곳) 후 본식·촬영 드레스 라인 결정 (피팅비 감안)",
    "리허설 촬영 날짜 확정, 신랑 예복은 맞춤 2~3개월 걸리니 미리 계약",
    "신혼여행 항공·숙소 예약, 여권 유효기간·비자/ESTA 확인",
    "예물·예단·꾸밈비 범위 양가 조율 (갈등 소지 초반에 정리)",
    "웨딩박람회·제휴 이벤트로 한복·예복·주얼리 견적 비교, 페이백 챙기기",
    "사회자·축가 지인/전문업체 결정, 지인이면 이 시기에 미리 부탁" ] },
  { cat: "D-6~3개월", items: [
    "리허설 촬영 진행, 셀렉·앨범 수정 기간(1~2개월) 역산해 일정 관리",
    "신혼집 계약 — 정책 대출은 심사기간 고려해 잔금일 한 달 전 신청",
    "종이 청첩장 주문 + 모바일 청첩장(참석 여부·계좌 안내 기능) 제작",
    "식전 영상(성장 영상) 준비, 웨딩홀 화면 규격·재생 방식 확인",
    "가전·혼수 백화점 웨딩클럽/제휴로 묶어 구매 — 사은품·포인트 최대화",
    "부모님 한복·양가 어머니 미용 예약, 폐백·이바지 여부 결정",
    "청첩장 모임 리스트 작성 → 예상 하객 수와 보증인원 비교 조정" ] },
  { cat: "D-3~1개월", items: [
    "청첩장 모임 소그룹 진행, 모바일 청첩장은 단체방 말고 개별 연락",
    "본식 드레스 가봉 피팅, 당일 드레스·부케·헬퍼 일정 최종 확인",
    "사회자·축가와 식순 대본 공유, 축가 MR 웨딩홀에 미리 전달",
    "본식 스냅·DVD 업체에 필수 컷 리스트·가족 단체사진 명단 전달",
    "신혼여행 최종 결제 + 여행자보험·환전·eSIM 처리",
    "웨딩홀 최종 미팅 — 보증인원 확정, 식순, 영상 송출, 답례품 점검",
    "축의대·명부·주차 안내 등 당일 역할 배정" ] },
  { cat: "D-30일~당일", items: [
    "잔금 폭탄 시기 — 홀·스드메·스냅 잔금 일정과 결제수단(현금영수증) 캘린더 정리",
    "메이크업 리허설로 당일 스타일 확정, 새벽 샵 도착 동선 시뮬레이션",
    "D-7부터 술·자극적 음식·새 화장품 테스트 금지 (피부 컨디션)",
    "전날 드레스·구두·예물·축의대 용품·비상 파우치(핀·실·진통제) 한곳에 모으기",
    "당일 타임테이블(샵→홀→대기실→본식→원판→피로연) 가족·헬퍼 공유",
    "포토테이블·부모님 편지 등 감성 요소 세팅, 축가·사회자 최종 리허설 통화",
    "신혼여행 캐리어 미리 패킹, 여권·바우처·상비약은 기내 가방에" ] },
  { cat: "결혼 후", items: [
    "혼인신고는 대출·청약 유불리(생애최초·신혼특공·신생아 특례) 따져 유리한 시점에",
    "축의금 정산해 양가와 투명하게 나누고, 일주일 내 하객 감사 연락",
    "본식 스냅·DVD 원본 오면 즉시 클라우드+외장하드 이중 백업",
    "전입신고·주소지 변경 처리, 지자체 신혼부부 지원금·이자 지원 신청",
    "부부 공동 통장·생활비 규칙·비상금 계좌 등 재테크 구조 첫 달에 세팅",
    "연말정산 혼인 세액공제(1인 50만)·결혼 지출 증빙 정리",
    "업체 후기 작성으로 페이백·추가 혜택 회수" ] },
];
const WEDDING_TIPS = [
  "스드메·스냅 계약서엔 '기본 포함 항목'과 추가금(헬퍼비·얼리스타트비·원본 구입비)을 반드시 서면으로 — 당일 추가 결제 폭탄 예방",
  "웨딩홀 보증인원은 낮춰 잡기 — 초과는 추가 결제하면 되지만 미달분은 그대로 손해",
  "인기 본식 스냅·DVD는 웨딩홀보다 먼저 마감되기도 — 홀 계약 당일 바로 문의가 국룰",
  "혼인신고 하루 차이로 대출 조건이 달라질 수 있음 — 신혼집 대출 전략 먼저, 신고 시점은 나중에",
  "모든 결제는 페이백·제휴 포인트·카드 실적 겹쳐 챙기고, 후기 페이백 마감일은 캘린더에 등록",
];
// 서울 인기 예식장 — 평범한 직장인 커플이 실제로 많이 계약하는 중위 가격대 위주
// (2025~26 후기·보도 기반 리서치, 가격은 추정치. 특급호텔 등 초고가 베뉴는 제외)
const WEDDING_VENUES = [
  { name: "아펠가모 광화문", area: "종로구", type: "컨벤션", meal: "6~8.5만", fee: "220~770만", cap: "200~400명", note: "도심 접근성 + 검증된 식사 퀄리티 — 직장인 하객 선호 1순위급" },
  { name: "아펠가모 선릉", area: "강남구", type: "컨벤션", meal: "7~9만", fee: "500~800만", cap: "250~450명", note: "강남권 아펠가모 — 식사 퀄리티 안정적, 회사 하객 접근성 좋음" },
  { name: "더컨벤션 반포", area: "서초구", type: "컨벤션", meal: "6.5~8만", fee: "300~600만", cap: "250~500명", note: "고속터미널 직결 — 가성비·접근성으로 재방문 하객 평 좋은 대표 컨벤션" },
  { name: "상록아트홀", area: "강남구", type: "컨벤션", meal: "7.5~9.5만", fee: "500~900만", cap: "200~600명", note: "선릉역 인접 · 호텔급 홀 컨디션 — 공무원연금공단 운영으로 거품 없는 가격" },
  { name: "더채플앳청담", area: "강남구", type: "채플", meal: "8.5~11만", fee: "750~980만", cap: "250~400명", note: "12m 아치형 천고 채플홀 — 채플웨딩 대표 베뉴, 예약 경쟁 치열" },
  { name: "더채플앳논현", area: "강남구", type: "채플", meal: "8~10만", fee: "600~850만", cap: "200~350명", note: "청담 대비 합리적인 채플 — 밝은 채광 홀, 직장인 커플 계약 많음" },
  { name: "소노펠리체 컨벤션", area: "강남구", type: "컨벤션", meal: "7.2~9.5만", fee: "800만", cap: "350~800명", note: "삼성역 직결 + '미녀와야수 계단' 로비 — 대규모 하객 수용 강점" },
  { name: "루이비스컨벤션 중구점", area: "중구", type: "컨벤션", meal: "8.5만 내외", fee: "850만", cap: "200~500명", note: "호텔급 인테리어 단독홀 — 1시간 10분 여유 예식으로 인기" },
  { name: "세빛섬 플로팅아일랜드", area: "서초구", type: "컨벤션", meal: "6~12만", fee: "200~500만", cap: "100~400명", note: "반포 한강 위 인공섬 — 화이트 돔 + 한강 뷰 이색 베뉴, 야외·루프톱 가능" },
  { name: "노블발렌티 대치", area: "강남구", type: "하우스", meal: "10~12만", fee: "700~1,000만", cap: "200~400명", note: "하우스웨딩 입문 대표 — 호텔 느낌 연출 대비 합리적, 주말 골든타임 조기 마감" },
];
// 결혼 박람회 (2026-07 리서치 기준 — 최신 일정은 링크에서 확인)
const WEDDING_EXPOS = [
  { name: "제423회 웨덱스 웨딩박람회", date: "2026-07-25 ~ 07-26", venue: "코엑스 3층 컨퍼런스룸", url: "https://www.weddex.com/", note: "예비부부 무료입장 · 스드메/예물/허니문/웨딩홀 종합", exact: true },
  { name: "용산 아이파크몰 대형 웨딩박람회", date: "2026-07-25 ~ 07-26", venue: "용산 아이파크몰 리빙파크 5층", url: "https://todaywedding.kr/seoul.php", note: "백화점 연계형 · 사전등록 무료", exact: true },
  { name: "하우투 대형 웨딩박람회", date: "2026-07-25 ~ 07-26", venue: "SETEC 2층 전시실", url: "https://todaywedding.kr/seoul.php", note: "세텍 종합 웨딩박람회", exact: true },
  { name: "용산 아이파크 웨딩·혼수박람회", date: "2026-08-01 ~ 08-02", venue: "용산 아이파크몰 리빙파크 5층", url: "https://weddingfair.seoul.kr/", note: "웨딩·혼수 동시 개최", exact: true },
  { name: "세텍 웨딩·웨딩홀·허니문 페어", date: "2026-08-08 ~ 08-09", venue: "SETEC 2층 전시실", url: "https://weddingfair.seoul.kr/", note: "3개 페어 동시 개최 · 사전등록 무료", exact: true },
  { name: "웨딩&혼수 박람회 (세텍)", date: "2026-08-22 ~ 08-23", venue: "SETEC 제3전시실", url: "https://www.setec.or.kr/front/schedule/list.do", note: "세텍 공식 전시일정 등재 확정", exact: true },
  { name: "잠실·청량리 롯데백화점 웨딩박람회", date: "2026-08-22 ~ 08-23", venue: "롯데백화점 잠실점 / 청량리점", url: "https://weddinggo.kr/seoul", note: "백화점 연계형", exact: true },
  { name: "킨텍스 웨딩박람회 (아이니웨딩)", date: "2026-09-12 ~", venue: "킨텍스 (일산)", url: "http://iniwedding.com/event/weddingfair.html", note: "일산권 대형 박람회", exact: true },
];
const EXPO_RECURRING = [
  { name: "웨덱스 웨딩박람회", cycle: "거의 매주 토·일 (연 20회+)", venue: "코엑스 3층 컨퍼런스룸", url: "https://www.weddex.com/" },
  { name: "세텍 웨딩·허니문 페어", cycle: "월 1~2회 주말", venue: "SETEC (학여울역)", url: "https://www.setec.or.kr/front/schedule/list.do" },
  { name: "아이니웨딩&혼수박람회", cycle: "월 1회 내외 · 코엑스/aT센터/킨텍스 순회", venue: "코엑스 · aT센터 · 킨텍스", url: "http://iniwedding.com/event/weddingfair.html" },
  { name: "웨덱스코리아 (춘계/추계 대형)", cycle: "연 2~4회 (춘계 2~3월 · 추계 6~9월)", venue: "코엑스 Hall B", url: "https://www.coex.co.kr/event/exhibitions-calendar/" },
  { name: "다이렉트 결혼준비 상설 박람회", cycle: "매주 토·일 상설 (10:00~20:00)", venue: "강남구 도산대로 221, 8층", url: "https://todaywedding.kr/seoul.php" },
];
const HONEYMOON_DEFAULT = [
  { id: "h1", place: "몰디브", cost: 1200, season: "11~4월 (건기)", note: "수상 풀빌라 휴양 · 수상비행기 이동", star: false, flight: "1인 90~150만 (경유)", days: "5박 7일",
    route: "인천 → 싱가포르/두바이 경유 → 말레 → 수상비행기·스피드보트로 리조트 이동. 4박 수상빌라 + 2박 비치빌라 조합이 국룰. 올인클루시브 추천",
    booking: "리조트는 6개월+ 전 얼리버드가 가장 저렴. 수상비행기 연결을 위해 말레 오후 3시 이전 도착 항공으로. 허니문 특전(디너·데코) 요청은 예약 시 미리" },
  { id: "h2", place: "하와이", cost: 1000, season: "연중 (4~6월 가성비)", note: "휴양 + 관광 밸런스 · 직항 8시간", star: false, flight: "1인 100~160만 (직항)", days: "6박 8일",
    route: "인천 → 호놀룰루 직항. 오아후 3~4박(와이키키·노스쇼어·쿠알로아랜치) → 주내선으로 마우이 or 빅아일랜드 2~3박(할레아칼라 일출·화산국립공원). 렌터카 필수",
    booking: "항공은 4~6개월 전 발권이 적정가. 4~6월·9~11월이 비수기 가성비 구간. 인기 레스토랑(마마스피시하우스 등)은 1~2개월 전 예약" },
  { id: "h3", place: "칸쿤", cost: 1100, season: "12~4월 (건기)", note: "올인클루시브 리조트 · 경유 필수", star: false, flight: "1인 150~220만 (경유)", days: "6박 8일",
    route: "인천 → 댈러스/멕시코시티 경유 → 칸쿤. 호텔존 올인클루시브 4~5박 + 치첸이트사·세노테 데이투어 1일 + 이슬라 무헤레스 카타마란 1일",
    booking: "올인클루시브는 3~5개월 전 프로모션 노리기. 성수기(12~4월) 피하려면 11월 초 추천. 미국 경유 시 ESTA 필수" },
  { id: "h4", place: "이탈리아 + 스위스", cost: 1300, season: "5~6월 · 9~10월", note: "관광 중심 · 10일 이상 일정 추천 · 이탈리아만 가면 2인 약 950만", star: false, flight: "1인 90~140만 (직항/1회 경유)", days: "9박 11일",
    route: "인천 → 로마 in (2박, 바티칸·콜로세움) → 피렌체 2박(토스카나) → 베네치아 1박 → 기차로 밀라노 경유 → 스위스 인터라켄 3박(융프라우·그린델발트) → 취리히 out",
    booking: "5~6월·9~10월이 날씨·가격 최적. 스위스 기차패스·융프라우 티켓은 출발 2~3개월 전 구매, 도시 간 이동은 유레일보다 구간권 비교. 스위스를 빼고 이탈리아만(로마 2박·피렌체 2박·아말피 2박·베네치아 2박, 로마 out) 구성하면 2인 약 900~1,000만으로 300만가량 절약 — 산악열차·스위스 물가가 빠지는 대신 남부 해안이 들어가 일정도 여유로움" },
  { id: "h6", place: "캐나다 (로키+밴쿠버)", cost: 1100, season: "6~9월 (로키 성수기)", note: "대자연 관광 중심 · 직항 10시간", star: false, flight: "1인 110~160만 (직항)", days: "7박 9일",
    route: "인천 → 밴쿠버 직항 in. 밴쿠버 2박(스탠리파크·그랜빌아일랜드·개스타운) → 국내선으로 캘거리 → 렌터카로 밴프 3박(레이크루이스·모레인호수·설퍼산 곤돌라) → 아이스필드 파크웨이 경유 재스퍼 1박(콜롬비아 대빙원) → 캘거리 or 밴쿠버 out",
    booking: "로키는 6~9월이 호수 색·트레킹 최적 — 밴프 숙소는 4~6개월 전 마감되니 항공과 같이 예약. 모레인호수는 셔틀 사전예약 필수, 렌터카는 캘거리 공항 수령이 동선 효율적. eTA(전자여행허가) 미리 신청" },
  { id: "h5", place: "발리", cost: 600, season: "4~10월 (건기)", note: "가성비 풀빌라 · 직항 7시간", star: false, flight: "1인 60~90만 (직항)", days: "5박 7일",
    route: "인천 → 덴파사르 직항. 스미냑/짱구 2박(비치클럽) → 우붓 2박(라이스테라스·정글 풀빌라) → 울루와뚜/누사두아 2박(절벽 오션뷰·수상사원). 프라이빗 드라이버 차터 추천",
    booking: "건기(4~10월) 중 7~8월 성수기만 피하면 풀빌라가 30%↓. 우붓 인기 빌라는 2~3개월 전 마감, 공항 픽업은 숙소에 사전 요청" },
];
// 신혼부부 저축·세제·주거 정책 (2026-07 리서치 기준)
const POLICY_BENEFITS = [
  { name: "혼인(결혼) 세액공제", target: "2024~2026년 혼인신고, 생애 1회 · 소득 제한 없음", benefit: "1인 50만원 세액공제 — 맞벌이 각자 적용 시 부부 합산 최대 100만원", fit: "good", fitText: "가능", why: "소득 제한이 없어 부부합산 1.5억도 전액 적용. 2026년 내 혼인신고분까지", link: "https://www.hometax.go.kr" },
  { name: "혼인 증여재산공제 (결혼자금)", target: "혼인신고 전후 각 2년 내 직계존속 증여", benefit: "1억 추가공제 + 기본 5천만 = 1인 1.5억, 양가 합산 최대 3억 비과세", fit: "good", fitText: "가능", why: "소득·자산 요건 없음. 기준일은 혼인신고일, 증여세 신고는 필수", link: "https://www.nts.go.kr" },
  { name: "청약 결혼 페널티 폐지", target: "모든 (예비)부부 · 소득 무관", benefit: "부부 중복청약 허용, 배우자 혼전 당첨이력 배제, 배우자 통장기간 50% 합산(최대 3점)", fit: "good", fitText: "가능", why: "소득 무관 — 맞벌이 고소득 신혼부부의 당첨 확률을 실질적으로 높여주는 제도", link: "https://www.applyhome.co.kr" },
  { name: "ISA 확대 개편", target: "19세 이상 · 일반형은 소득 제한 없음", benefit: "납입한도 연 4,000만/총 2억, 비과세 500만(초과분 9.9% 분리과세)", fit: "good", fitText: "가능", why: "일반형은 소득 무관 — 부부 각자 계좌로 활용. 개정 시행 세부사항은 확인 필요", link: "https://www.moef.go.kr" },
  { name: "신생아 특례 디딤돌 (구입)", target: "2년 내 출산 + 맞벌이 합산 2억 이하 · 주택 9억/85㎡ 이하", benefit: "최대 4억(생애최초 LTV 80%) · 특례금리 1.8~4.5% 5년(출산마다 +5년)", fit: "warn", fitText: "출산 시 가능", why: "맞벌이 특례 합산 2억까지 허용 — 단 출산이 전제, 소득 상위구간은 금리 상단. 과천은 9억 상한이 관건", link: "https://www.myhome.go.kr" },
  { name: "신생아 특례 버팀목 (전세)", target: "2년 내 출산 + 맞벌이 합산 2억 이하 · 순자산 3.45억 이하", benefit: "보증금 80% 이내 최대 2.4억 · 1%대 중반~3%대 특례금리", fit: "warn", fitText: "출산 시 가능", why: "소득은 통과 가능하나 출산 요건 필수 + 순자산 기준 확인 필요", link: "https://www.myhome.go.kr" },
  { name: "서울시 장기전세Ⅱ (미리내집)", target: "혼인 7년 내 무주택 · 60㎡ 초과는 맞벌이 소득 200% 이하", benefit: "시세보다 낮은 전세로 10년+ 거주, 출산 시 연장·매수청구권", fit: "warn", fitText: "경계선", why: "맞벌이 200% 기준(2인 연 1.4~1.5억대)에 걸치는 소득 — 공고별 기준액 확인 필수", link: "https://www.i-sh.co.kr" },
  { name: "청년주택드림 청약통장", target: "19~34세 무주택 · 개인 연소득 5천만 이하", benefit: "우대금리 최고 4.5% + 당첨 시 1.5%대 연계대출(6억/85㎡ 이하)", fit: "warn", fitText: "부분가능", why: "개인소득 5천만 이하인 배우자 명의로만 가입 가능", link: "https://www.molit.go.kr/2024dreamaccount/main.jsp" },
  { name: "청약통장 소득공제", target: "총급여 7천만 이하 + 무주택 세대주", benefit: "연 납입 300만 한도의 40%, 최대 120만 소득공제", fit: "warn", fitText: "부분가능", why: "세대주 총급여 기준 — 부부 모두 7천만 초과면 불가", link: "https://www.hometax.go.kr" },
  { name: "청년미래적금 (2026 신설)", target: "19~34세 · 개인 7,500만 + 가구 중위 200% 이하", benefit: "3년 만기 · 월 50만 · 정부기여금 6~12% 매칭 + 비과세", fit: "bad", fitText: "소득 초과", why: "부부합산 1.5억은 2인 가구 중위 200%를 초과해 가구소득 요건 탈락", link: "https://ylaccount.kinfa.or.kr" },
  { name: "신혼부부 전용 디딤돌·버팀목", target: "혼인 7년 내 · 부부합산 7,500만~8,500만 이하", benefit: "구입 최대 4억(2%대) / 전세 수도권 최대 2.5억(1.9~3.3%)", fit: "bad", fitText: "소득 초과", why: "부부합산 소득 한도를 크게 초과", link: "https://nhuf.molit.go.kr" },
  { name: "서울시 임차보증금 이자지원", target: "혼인 7년 내 · 부부합산 1.3억 이하 · 보증금 7억 이하", benefit: "대출 최대 3억에 연 1.5%+α 이자지원, 최장 10년", fit: "bad", fitText: "소득 초과", why: "상향된 기준(1.3억)도 초과 — 추가 상향 여부는 모니터링 가치 있음", link: "https://housing.seoul.go.kr" },
];

/* ============== 공유 가구(household) 상태 — 모든 테마에 일괄 반영 ============== */
const HH_DEFAULT = {
  income1: 9700, income2: 6000, assets: 20000, monthlySave: 250,
  firstTime: true, targetKey: "jeonse59budget", rate: 6.3, existingDebtMonthly: 0,
  loanAmountCalc: 60000, loanRateCalc: 4.5, loanYearsCalc: 30, repayType: "equal_payment",
  label1: "본인", label2: "배우자", // 커스텀 호칭 — 홈 설정에서 변경
};

/* ============== data constants (홈) ============== */
const ALLOC_DEFAULT = { totalCash: 20000, realty: 12000, saving: 4000, wedding: 3000 };
const MILESTONES_DEFAULT = [
  { id: "m1", label: "과천 4단지 청약 접수(예상)", date: "2026-09-14" },
  { id: "m2", label: "전세 계약 목표", date: "2026-12-01" },
];

/* ============== building blocks ============== */
function SectionHeader({ eyebrow, title, accent }) {
  return (<div className="mb-4">
    {eyebrow && <div className="font-mono text-[11px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5">{eyebrow}</div>}
    <h3 className="text-[19px] font-bold tracking-tight text-[#0A0A0A]">{title}</h3>
  </div>);
}
function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-5 ${className}`}>{children}</div>;
}
function Kpi({ icon, label, value, accent = "#0A0A0A" }) {
  return (<div className="bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-4 lg:p-5 flex items-center gap-3.5 border-l-4" style={{ borderLeftColor: accent }}>
    <span className="hidden sm:flex w-10 h-10 rounded-xl bg-[#F4F4F5] items-center justify-center shrink-0"><Icon name={icon} size={18} /></span>
    <div className="min-w-0">
      <div className="text-[12px] text-[#8A8A8A] mb-0.5">{label}</div>
      <div className="text-[19px] lg:text-[21px] font-bold tracking-tight truncate" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  </div>);
}
function ToneBadge({ tone, children }) {
  const map = { good: "bg-[#0A0A0A] text-white", warn: "bg-white text-[#0A0A0A] border border-[#0A0A0A]", bad: "bg-white text-[#9A9A9A] border border-dashed border-[#C9C9C9]", neutral: "bg-[#F2F2F2] text-[#525252]" };
  return <span className={`text-[12px] px-3 py-1 rounded-full font-semibold whitespace-nowrap ${map[tone] || map.neutral}`}>{children}</span>;
}
function Field({ label, value, onChange, step = 1 }) {
  return (<div>
    <label className="text-[14px] text-[#525252] block mb-1.5 font-medium">{label}</label>
    <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[16px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors" style={{ fontVariantNumeric: "tabular-nums" }} />
  </div>);
}
function Select({ label, value, onChange, options }) {
  return (<div>
    <label className="text-[14px] text-[#525252] block mb-1.5 font-medium">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-3 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>);
}
function Toggle({ label, active, onClick, activeText, inactiveText }) {
  return (<div className="flex flex-col justify-end">
    <label className="text-[14px] text-[#525252] mb-1.5 font-medium">{label}</label>
    <button onClick={onClick} className={`h-12 rounded-xl text-[15px] font-semibold border border-transparent transition-colors ${active ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#0A0A0A]"}`}>
      {active ? activeText : inactiveText}
    </button>
  </div>);
}
function Stat({ label, value, sub, tone }) {
  const color = tone === "warn" ? "text-[#0A0A0A]" : tone === "good" ? "text-[#0A0A0A]" : "text-[#0A0A0A]";
  return (<div className="py-3">
    <div className="text-[14px] text-[#525252] mb-1">{label}</div>
    <div className={`text-2xl font-bold ${color}`} style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
    {sub && <div className="text-[13px] text-[#8A8A8A] mt-1">{sub}</div>}
  </div>);
}
function InfoNote({ children }) {
  return (<div className="flex gap-2 text-[13px] text-[#8A8A8A] leading-relaxed">
    <Icon name="info" size={15} className="mt-0.5 shrink-0" /><span>{children}</span>
  </div>);
}
function FilterRow({ label, value, active }) {
  return (<div className={`flex justify-between items-center px-4 py-3.5 rounded-xl ${active ? "bg-[#0A0A0A]/10 border border-[#0A0A0A]/40" : "bg-[#F7F7F7]"}`}>
    <span className="text-[15px]">{label}</span>
    <span className={`text-[16px] font-bold ${active ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>{value}</span>
  </div>);
}
function SourceBadge({ source, error }) {
  if (error) return <ToneBadge tone="bad">연동 실패 · 샘플</ToneBadge>;
  return source === "live" ? <ToneBadge tone="good">실데이터</ToneBadge> : <ToneBadge tone="neutral">샘플데이터</ToneBadge>;
}
function ProgressBar({ ratio, color = "#0A0A0A", height = 6 }) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100)));
  return (<div className="rounded-full bg-[#F0F0F0] overflow-hidden" style={{ height }}>
    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
  </div>);
}
function NumInput({ value, onChange, className = "" }) {
  return <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
    className={`h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`} style={{ fontVariantNumeric: "tabular-nums" }} />;
}
function TextInput({ value, onChange, placeholder, className = "" }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={`h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`} />;
}
function IconBtn({ name, onClick, title, className = "" }) {
  return <button onClick={onClick} title={title} className={`w-9 h-9 rounded-lg flex items-center justify-center text-[#8A8A8A] hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/5 shrink-0 ${className}`}><Icon name={name} size={16} /></button>;
}

/* ============== 서브탭 내비 (테마 공통) ============== */
function PillNav({ tabs, tab, setTab }) {
  return (<nav className="sticky top-0 z-10 bg-[#F4F4F5]/95 backdrop-blur -mx-5 sm:-mx-10 px-5 sm:px-10 py-3">
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      {tabs.map(t => { const active = tab === t.id; return (
        <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`}>
          <Icon name={t.icon} size={14} />{t.label}
        </button>); })}
    </div>
  </nav>);
}

/* ============== 뉴스 패널 (프록시 → 폴백: 검색 링크) ============== */
function RefreshBtn({ onClick, loading }) {
  return (<button onClick={onClick} disabled={loading}
    className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity shrink-0">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
    {loading ? "불러오는 중" : "새로고침"}
  </button>);
}
// 실시간 리서치 버튼 — 서버(/api/research)가 최신 데이터를 만들어 옴
// (금리=금감원 공시 API, 식장/정책=Claude 웹검색. 60초 초과로 실패해도 서버는 계속
//  실행되어 캐시를 남기므로, 1~2분 뒤 다시 누르면 결과를 받는다)
function LiveUpdateBtn({ topic, params = "", onData }) {
  const [st, setSt] = useState({ loading: false, err: "" });
  const run = async () => {
    setSt({ loading: true, err: "" });
    try {
      const r = await fetch(api(`/api/research?topic=${topic}&force=1${params}`));
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.items || !j.items.length) throw new Error((j && j.message) || "리서치 실패 — 서버 키 설정 확인, 시간 초과면 1~2분 뒤 다시 시도");
      onData(j);
      setSt({ loading: false, err: "" });
    } catch (e) {
      setSt({ loading: false, err: String((e && e.message) || e) });
    }
  };
  return (<div className="flex items-center gap-2 min-w-0">
    {st.err && <span className="text-[11px] text-[#8A8A8A] truncate max-w-[240px]" title={st.err}>{st.err}</span>}
    <button onClick={run} disabled={st.loading}
      className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40 shrink-0">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={st.loading ? "animate-spin" : ""}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      {st.loading ? "웹 검색·정리 중 (1~3분)" : "최신 정보로 갱신"}
    </button>
  </div>);
}

function NewsPanel({ query, eyebrow = "실시간", title }) {
  const [state, setState] = useState({ items: [], source: "sample", loading: true, at: null });
  const load = () => {
    setState(s => ({ ...s, loading: true }));
    loadNews(query).then(r => setState({ ...r, loading: false, at: new Date() }));
  };
  useEffect(load, [query]);
  const naverUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
  return (<section>
    <div className="flex items-end justify-between gap-3 mb-4">
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="flex items-center gap-2 mb-4">
        {state.at && !state.loading && <span className="font-mono text-[11px] text-[#8A8A8A]">{state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</span>}
        <RefreshBtn onClick={load} loading={state.loading} />
      </div>
    </div>
    {state.source === "sample" && !state.loading && (
      <Card>
        <p className="text-[14px] text-[#525252] leading-relaxed mb-3">실시간 뉴스는 프록시 서버가 필요해요. 터미널에서 <code className="font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded">node server.js</code> 실행 후 <code className="font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded">localhost:5173</code>으로 접속하면 자동으로 연동됩니다.</p>
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-semibold underline underline-offset-4">네이버 뉴스에서 "{query}" 바로 검색 <Icon name="chevron" size={13} /></a>
      </Card>
    )}
    {state.loading && <Card><div className="text-[14px] text-[#8A8A8A]">뉴스를 불러오는 중…</div></Card>}
    {!state.loading && state.items.length > 0 && (
      <Card className="!p-0 overflow-hidden">
        <ul className="divide-y divide-[#F0F0F0]">
          {state.items.slice(0, 10).map((n, i) => (<li key={i}>
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="block px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
              <div className="text-[14px] font-semibold leading-snug">{n.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-[#8A8A8A]">
                {n.source && <span>{n.source}</span>}
                {n.date && <span className="font-mono">{n.date}</span>}
              </div>
            </a>
          </li>))}
        </ul>
        <div className="px-5 py-3 border-t border-[#F0F0F0]">
          <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#525252] underline underline-offset-4">네이버 뉴스에서 더 보기</a>
        </div>
      </Card>
    )}
  </section>);
}

/* ============== 커스텀 메모 (테마 공통) ============== */
function CustomNotes({ themeId, accent = "#0A0A0A" }) {
  const [notes, setNotes] = usePersist(`notes-${themeId}-v1`, []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const add = () => {
    if (!title.trim()) return;
    setNotes([...notes, { id: uid(), title: title.trim(), body: body.trim() }]);
    setTitle(""); setBody("");
  };
  return (<section>
    <SectionHeader eyebrow="자유 기록" title="커스텀 메모" accent={accent} />
    <div className="space-y-3">
      {notes.map(n => (<Card key={n.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-bold">{n.title}</div>
            {n.body && <p className="text-[14px] text-[#525252] leading-relaxed mt-1.5 whitespace-pre-wrap">{n.body}</p>}
          </div>
          <IconBtn name="trash" title="삭제" onClick={() => setNotes(notes.filter(x => x.id !== n.id))} />
        </div>
      </Card>))}
      <Card>
        <div className="text-[13px] font-semibold text-[#8A8A8A] mb-3">새 메모 추가</div>
        <div className="space-y-2.5">
          <TextInput value={title} onChange={setTitle} placeholder="제목 (예: 상담받은 은행 금리 메모)" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="내용 (선택)" rows={3}
            className="w-full px-2.5 py-2 rounded-lg border border-[#E5E5E5] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/40 resize-y" />
          <button onClick={add} className="w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5" style={{ background: accent }}>
            <Icon name="plus" size={16} /> 추가하기
          </button>
        </div>
      </Card>
    </div>
  </section>);
}

/* ============== 진단 공통 계산 ============== */
function computeDiagnosis(s) {
  const income1 = s.income1 ?? 9700, income2 = s.income2 ?? 6000;
  const assets = s.assets ?? 20000, monthlySave = s.monthlySave ?? 250;
  const firstTime = s.firstTime ?? true, rate = s.rate ?? 6.3;
  const existingDebtMonthly = s.existingDebtMonthly ?? 0;
  const target = TARGETS.find(t => t.key === (s.targetKey ?? "jeonse59budget"));
  const incomeWon = (income1 + income2) * 10000;
  const dsrMonthlyBudget = Math.max(0, (incomeWon * 0.4) / 12 - existingDebtMonthly * 10000);
  const dsrLoan = loanFromMonthlyPayment(dsrMonthlyBudget, rate, 30);
  const ltvLoan = target.price * (firstTime ? 0.7 : 0.5);
  const tierCap = priceTierCap(target.price);
  const maxLoan = Math.min(dsrLoan, ltvLoan, tierCap);
  const bindingConstraint = maxLoan === tierCap ? "가격구간 대출한도" : maxLoan === ltvLoan ? "LTV" : "DSR(소득)";
  const requiredCash = Math.max(0, target.price - maxLoan);
  const gap = requiredCash - assets * 10000;
  const monthsToGoal = gap > 0 && monthlySave > 0 ? Math.ceil(gap / (monthlySave * 10000)) : 0;
  return { target, dsrLoan, ltvLoan, tierCap, maxLoan, bindingConstraint, requiredCash, gap, monthsToGoal, yearsToGoal: (monthsToGoal / 12).toFixed(1) };
}

/* ============== Naver Map panel ============== */
function MapPanel({ mapKey, points, height = 340 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState("idle"); // idle|ok|nokey|error

  useEffect(() => {
    if (!mapKey) { setStatus("nokey"); return; }
    let alive = true;
    loadNaver(mapKey).then(() => {
      if (!alive || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = new naver.maps.Map(ref.current, {
          center: new naver.maps.LatLng(37.4266, 126.9955), zoom: 13,
        });
      }
      setStatus("ok");
    }).catch(() => { if (alive) setStatus("error"); });
    return () => { alive = false; };
  }, [mapKey]);

  useEffect(() => {
    if (status !== "ok" || !mapRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const valid = (points || []).filter(p => p.lat && p.lng);
    const bounds = valid.length ? new naver.maps.LatLngBounds() : null;
    valid.forEach(p => {
      const pos = new naver.maps.LatLng(p.lat, p.lng);
      const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: p.title });
      const info = new naver.maps.InfoWindow({
        content: `<div style="padding:8px 12px;font-size:13px;max-width:220px;font-family:Pretendard,sans-serif">
          <b>${p.title}</b><br/><span style="color:#8A8A8A">${p.desc || ""}</span></div>`,
      });
      naver.maps.Event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      markersRef.current.push(marker);
      if (bounds) bounds.extend(pos);
    });
    if (bounds && valid.length > 1) mapRef.current.fitBounds(bounds);
    else if (valid.length === 1) mapRef.current.setCenter(new naver.maps.LatLng(valid[0].lat, valid[0].lng));
  }, [points, status]);

  if (status === "nokey" || status === "error")
    return (<div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-6 text-center" style={{ minHeight: height }}>
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[#8A8A8A]" style={{ minHeight: height - 48 }}>
        <Icon name="pin" size={28} />
        <div className="text-[15px] font-semibold text-[#525252]">{status === "error" ? "지도 로드 실패" : "네이버 지도 키가 필요해요"}</div>
        <div className="text-[13px] leading-relaxed max-w-xs">서버 환경변수 <b className="font-mono text-[12px]">NAVER_MAP_KEY</b>에 네이버 지도 Client ID(ncpKeyId)를 설정하면 지도가 활성화됩니다. (NCP → Maps → Application의 Web 서비스 URL에 이 사이트 도메인 등록 필요)</div>
      </div>
    </div>);

  return <div ref={ref} className="rounded-2xl border border-[#E5E5E5] overflow-hidden" style={{ height }} />;
}

/* ============== Cheongyak tab ============== */
function CheongyakTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(store.get("cheongyak-filter-v1", { region: "all", type: "all", area: "all", maxPrice: 0, hideExpired: true }));
  const load = () => {
    setState(s => ({ ...s, loading: true }));
    loadCheongyak().then(r => setState({ ...r, loading: false, at: new Date() }));
  };
  useEffect(load, []);
  useEffect(() => store.set("cheongyak-filter-v1", f), [f]);
  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));

  const regions = ["all", ...Array.from(new Set(state.items.map(i => i.region)))];
  const today = new Date().toISOString().slice(0, 10);
  const filtered = state.items.filter(i => {
    if (f.region !== "all" && i.region !== f.region) return false;
    if (f.type !== "all" && !(i.types || []).includes(f.type)) return false;
    if (f.area !== "all" && !(i.areas || []).includes(Number(f.area))) return false;
    if (f.maxPrice > 0 && i.priceMin && i.priceMin > f.maxPrice * 10000) return false;
    if (f.hideExpired && i.applyEnd && i.applyEnd < today) return false;
    return true;
  });
  const points = filtered.map(i => ({ lat: i.lat, lng: i.lng, title: i.name, desc: `${i.region} · ${wonShort(i.priceMin)}~${wonShort(i.priceMax)}` }));

  return (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <SectionHeader eyebrow="조건 검색" title="청약 정보" />
          <div className="flex items-center gap-2 mb-4">
            <SourceBadge source={state.source} />
            {state.at && !state.loading && <span className="font-mono text-[11px] text-[#8A8A8A] hidden sm:inline">{state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</span>}
            <RefreshBtn onClick={load} loading={state.loading} />
          </div>
        </div>
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Select label="지역" value={f.region} onChange={set("region")} options={regions.map(r => ({ value: r, label: r === "all" ? "전체" : r }))} />
            <Select label="공급유형" value={f.type} onChange={set("type")} options={[["all","전체"],["신혼특공","신혼특공"],["신생아","신생아"],["생애최초","생애최초"],["일반공급","일반공급"]].map(([v,l])=>({value:v,label:l}))} />
            <Select label="평형" value={f.area} onChange={set("area")} options={[["all","전체"],["59","59㎡"],["74","74㎡"],["84","84㎡"]].map(([v,l])=>({value:v,label:l}))} />
            <Field label="분양가 상한(만원, 0=무제한)" value={f.maxPrice} onChange={set("maxPrice")} step={5000} />
            <Toggle label="접수 마감된 공고" active={f.hideExpired} onClick={() => setF(p => ({ ...p, hideExpired: !p.hideExpired }))} activeText="숨기기" inactiveText="모두 표시" />
          </div>
          <p className="mt-4 text-[13px] text-[#8A8A8A] leading-relaxed">새로고침을 누르면 청약홈 최신 공고를 다시 불러와요. 실데이터는 <code className="font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded">node server.js</code> + <code className="font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded">CHEONGYAK_KEY</code> 설정 시 활성화됩니다.</p>
        </Card>
      </section>

    <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      <section className="lg:col-span-2 mb-6 lg:mb-0">
        <div className="text-[14px] font-semibold text-[#525252] mb-3">검색결과 {filtered.length}건</div>
        <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          {state.loading && <Card><div className="text-[14px] text-[#8A8A8A]">최신 공고를 불러오는 중…</div></Card>}
          {!state.loading && filtered.length === 0 && <Card><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 공고가 없어요. 필터를 완화해 보세요.</div></Card>}
          {filtered.map(i => {
            const expired = i.applyEnd && i.applyEnd < today;
            return (<Card key={i.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-[16px] font-bold">{i.name}</div>
                  <div className="text-[13px] text-[#8A8A8A] mt-0.5">{i.addr || i.region}</div>
                </div>
                {expired ? <ToneBadge tone="neutral">접수마감</ToneBadge> : <ToneBadge tone="good">접수예정</ToneBadge>}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(i.types || []).map(t => <span key={t} className="text-[12px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A] font-semibold">{t}</span>)}
                {(i.areas || []).map(a => <span key={a} className="text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold">{a}㎡</span>)}
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[13px] text-[#3D3D3D]">
                <div><span className="text-[#8A8A8A]">분양가 </span>{wonShort(i.priceMin)}~{wonShort(i.priceMax)}</div>
                <div><span className="text-[#8A8A8A]">공급 </span>{i.totalUnits ? i.totalUnits.toLocaleString() + "세대" : "-"}{i.specialUnits ? ` (특공 ${i.specialUnits})` : ""}</div>
                <div><span className="text-[#8A8A8A]">접수 </span>{i.applyStart || "-"} ~ {i.applyEnd || "-"}</div>
                <div><span className="text-[#8A8A8A]">발표 </span>{i.announceDate || "-"}</div>
                <div><span className="text-[#8A8A8A]">입주 </span>{i.moveIn || "-"}</div>
              </div>
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2">청약홈에서 확인 <Icon name="chevron" size={13} /></a>
            </Card>);
          })}
        </div>
      </section>

      <section className="lg:col-span-3 lg:sticky lg:top-[70px]">
        <SectionHeader eyebrow="위치" title="지도에서 보기" />
        <MapPanel mapKey={mapKey} points={points} height={560} />
      </section>
    </div>
  </>);
}

/* ============== Realty tab ============== */
function RealtyListTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(store.get("realty-filter-v1", { region: "all", dealType: "all", area: "all", maxPrice: 0 }));
  const load = () => {
    setState(s => ({ ...s, loading: true }));
    loadRealty().then(r => setState({ ...r, loading: false, at: new Date() }));
  };
  useEffect(load, []);
  useEffect(() => store.set("realty-filter-v1", f), [f]);
  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));

  const regions = ["all", ...Array.from(new Set(state.items.map(i => i.region)))];
  const filtered = state.items.filter(i => {
    if (f.region !== "all" && i.region !== f.region) return false;
    if (f.dealType !== "all" && i.dealType !== f.dealType) return false;
    if (f.area !== "all" && Math.round(i.area) !== Number(f.area)) return false;
    if (f.maxPrice > 0 && i.price && i.price > f.maxPrice * 10000) return false;
    return true;
  });
  const points = filtered.map(i => ({ lat: i.lat, lng: i.lng, title: i.complex, desc: `${i.dealType} ${i.area}㎡ · ${i.priceText || won(i.price)}${i.rent ? "/월 " + won(i.rent) : ""}` }));

  return (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <SectionHeader eyebrow="조건 검색" title="부동산 매물" />
          <div className="flex items-center gap-2 mb-4">
            <SourceBadge source={state.source} />
            {state.at && !state.loading && <span className="font-mono text-[11px] text-[#8A8A8A] hidden sm:inline">{state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</span>}
            <RefreshBtn onClick={load} loading={state.loading} />
          </div>
        </div>
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Select label="지역" value={f.region} onChange={set("region")} options={regions.map(r => ({ value: r, label: r === "all" ? "전체" : r }))} />
            <Select label="거래유형" value={f.dealType} onChange={set("dealType")} options={[["all","전체"],["매매","매매"],["전세","전세"],["월세","월세"]].map(([v,l])=>({value:v,label:l}))} />
            <Select label="평형(전용㎡ 반올림)" value={f.area} onChange={set("area")} options={[["all","전체"],["59","59㎡"],["74","74㎡"],["84","84㎡"]].map(([v,l])=>({value:v,label:l}))} />
            <Field label="가격 상한(만원, 0=무제한)" value={f.maxPrice} onChange={set("maxPrice")} step={5000} />
          </div>
          <p className="mt-4 text-[13px] text-[#8A8A8A] leading-relaxed">네이버 부동산은 공식 API가 없어 <code className="font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded">server.js</code> 프록시가 대리 호출해요(개인 참고용). 프록시 미가동 시 과천 주요 단지 샘플로 동작합니다.</p>
        </Card>
      </section>

    <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      <section className="lg:col-span-2 mb-6 lg:mb-0">
        <div className="text-[14px] font-semibold text-[#525252] mb-3">검색결과 {filtered.length}건</div>
        <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          {state.loading && <Card><div className="text-[14px] text-[#8A8A8A]">매물을 불러오는 중…</div></Card>}
          {!state.loading && filtered.length === 0 && <Card><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 매물이 없어요.</div></Card>}
          {filtered.map(i => (<Card key={i.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A] font-semibold">{i.dealType}</span>
                  <div className="text-[16px] font-bold">{i.complex}</div>
                </div>
                <div className="text-[13px] text-[#8A8A8A] mt-0.5">{i.region} {i.addr} · {i.area}㎡{i.built ? " · " + i.built + "년" : ""}{i.floor ? " · " + i.floor : ""}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{i.priceText || wonShort(i.price)}</div>
                {i.rent > 0 && <div className="text-[13px] text-[#525252]">월 {won(i.rent)}</div>}
              </div>
            </div>
            {(i.tags || []).length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{i.tags.map((t, k) => <span key={k} className="text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252]">{t}</span>)}</div>}
          </Card>))}
        </div>
      </section>

      <section className="lg:col-span-3 lg:sticky lg:top-[70px]">
        <SectionHeader eyebrow="위치" title="지도에서 보기" />
        <MapPanel mapKey={mapKey} points={points} height={560} />
      </section>
    </div>
  </>);
}

/* ============== 부동산 체크리스트 ============== */
function RealtyChecklist() {
  const [state, setState] = useState(CHECKLIST_INIT.map(g => ({ ...g, items: g.items.map(t => ({ text: t, done: false })) })));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const doneMap = store.get("checklist-done-v2", null);
    if (doneMap) setState(prev => prev.map((g, gi) => ({ ...g, items: g.items.map((it, ii) => ({ ...it, done: !!doneMap[`${gi}-${ii}`] })) })));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const doneMap = {};
    state.forEach((g, gi) => g.items.forEach((it, ii) => { if (it.done) doneMap[`${gi}-${ii}`] = true; }));
    store.set("checklist-done-v2", doneMap);
  }, [ready, state]);
  const toggle = (gi, ii) => setState(prev => { const next = prev.map(g => ({ ...g, items: g.items.map(it => ({ ...it })) })); next[gi].items[ii].done = !next[gi].items[ii].done; return next; });
  const total = state.reduce((a, g) => a + g.items.length, 0);
  const done = state.reduce((a, g) => a + g.items.filter(i => i.done).length, 0);
  return (<section>
    <SectionHeader eyebrow="실행 관리" title="체크리스트" accent="#0A0A0A" />
    <Card className="flex items-center justify-between mb-4">
      <span className="text-[15px] font-semibold">전체 진행률</span>
      <span className="text-[16px] font-bold text-[#0A0A0A]">{done} / {total}</span>
    </Card>
    <div className="space-y-4">
      {state.map((g, gi) => (<Card key={gi}>
        <h4 className="text-[13px] font-semibold text-[#8A8A8A] mb-3">{g.cat}</h4>
        <ul className="space-y-3">
          {g.items.map((it, ii) => (<li key={ii}>
            <button onClick={() => toggle(gi, ii)} className="flex items-start gap-3 text-left w-full">
              {it.done ? <Icon name="check2" size={19} className="mt-0.5 shrink-0 text-[#0A0A0A]" /> : <Icon name="square" size={19} className="mt-0.5 shrink-0 text-[#8A8A8A]" />}
              <span className={`text-[15px] ${it.done ? "line-through text-[#8A8A8A]" : "text-[#0A0A0A]"}`}>{it.text}</span>
            </button>
          </li>))}
        </ul>
      </Card>))}
    </div>
  </section>);
}

/* ============== 테마: 부동산 ============== */
function RealtyTheme({ mapKey, hh, setHh, setTheme }) {
  const [tab, setTab] = usePersist("realty-tab-v1", "diag");
  const [newsRegion, setNewsRegion] = usePersist("news-region-v1", "과천");
  const [bankData, setBankData] = usePersist("bankloan-data-v1", { items: BANK_LOANS, at: null });

  const { income1, income2, assets, monthlySave, firstTime, targetKey, rate, existingDebtMonthly, loanAmountCalc, loanRateCalc, loanYearsCalc, repayType } = hh;
  const setTargetKey = (v) => setHh({ targetKey: v });
  const setRate = (v) => setHh({ rate: v });
  const setLoanAmountCalc = (v) => setHh({ loanAmountCalc: v });
  const setLoanRateCalc = (v) => setHh({ loanRateCalc: v });
  const setLoanYearsCalc = (v) => setHh({ loanYearsCalc: v });

  const diag = computeDiagnosis({ income1, income2, assets, monthlySave, firstTime, targetKey, rate, existingDebtMonthly });
  const { target, dsrLoan, ltvLoan, tierCap, maxLoan, bindingConstraint, requiredCash, gap, monthsToGoal, yearsToGoal } = diag;
  const income = income1 + income2;
  const incomeWon = income * 10000;
  const netAnnual = estimateNetAnnual(income1 * 10000) + estimateNetAnnual(income2 * 10000);
  const netMonthly = netAnnual / 12;
  const incomeExceedsSpecialSupply = income > 12600;

  const loanP = loanAmountCalc * 10000, loanI = loanRateCalc / 100 / 12, loanN = loanYearsCalc * 12;
  let loanFirstMonthPay = 0, loanTotalPay = 0, loanTotalInterest = 0;
  if (loanP > 0 && loanN > 0) {
    if (repayType === "equal_payment") {
      const M = loanI > 0 ? loanP * loanI / (1 - Math.pow(1 + loanI, -loanN)) : loanP / loanN;
      loanFirstMonthPay = M; loanTotalPay = M * loanN; loanTotalInterest = loanTotalPay - loanP;
    } else {
      const principalPerMonth = loanP / loanN;
      loanFirstMonthPay = principalPerMonth + loanP * loanI;
      loanTotalInterest = loanI * loanP * (loanN + 1) / 2;
      loanTotalPay = loanP + loanTotalInterest;
    }
  }

  return (<>
    <PillNav tabs={REALTY_TABS} tab={tab} setTab={setTab} />

    {["diag", "strategy", "loan", "plan"].includes(tab) && (<div className="masonry">

    {tab === "diag" && (<>
      <section>
        <SectionHeader eyebrow="STEP 1" title="우리 부부 정보" accent="#0A0A0A" />
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-[#8A8A8A]">홈의 부부 정보와 실시간 연동</span>
            <button onClick={() => setTheme && setTheme("home")} className="text-[13px] font-semibold underline underline-offset-4">홈에서 수정</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {[[`${hh.label1 || "본인"} 연소득`, income1], [`${hh.label2 || "배우자"} 연소득`, income2], ["현재 순자산", assets], ["월 저축가능", monthlySave], ["기존 대출 월상환", existingDebtMonthly]].map(([l, v]) => (
              <div key={l} className="bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                <div className="text-[11px] text-[#8A8A8A] mb-0.5">{l}</div>
                <div className="text-[14px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(v)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#E5E5E5] space-y-3">
            <div className="flex justify-between items-center"><span className="text-[15px] text-[#525252]">부부합산 월소득(세전, 연÷12)</span><span className="text-xl font-bold" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{won(Math.round(incomeWon / 12))}</span></div>
            <div className="flex justify-between items-center"><span className="text-[15px] text-[#525252]">부부합산 월소득(세후 추정)</span><span className="text-xl font-bold text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{won(Math.round(netMonthly))}</span></div>
          </div>
          {incomeExceedsSpecialSupply && (<div className="mt-4 flex gap-2 text-[14px] text-[#0A0A0A] bg-[#0A0A0A]/5 rounded-xl p-3"><Icon name="info" size={16} className="mt-0.5 shrink-0" /><span>소득 기준 신혼특공(우선·일반공급)은 초과할 가능성이 높아요. 자산기준 경로나 일반공급을 중심으로 보세요.</span></div>)}
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="STEP 2" title="목표 유형 선택" accent="#0A0A0A" />
        <div className="space-y-3">
          {TARGETS.map(t => (<button key={t.key} onClick={() => setTargetKey(t.key)} className={`w-full text-left rounded-2xl border p-4 transition-colors ${targetKey === t.key ? "border-[#0A0A0A] bg-[#0A0A0A]/5" : "border-[#E5E5E5] bg-white"}`}>
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-[15px] font-semibold">{t.label}</div><div className="text-[13px] text-[#8A8A8A] mt-0.5">{t.note}</div></div>
              <div className="text-xl font-bold shrink-0" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{wonShort(t.price)}</div>
            </div>
          </button>))}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="STEP 3" title="진단 결과" accent="#0A0A0A" />
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-4 bg-[#0A0A0A] text-white text-[15px] font-semibold">{target.label}</div>
          <div className="px-5 divide-y divide-[#E5E5E5]">
            <Stat label="목표 가격" value={won(target.price)} />
            <Stat label="최대 대출가능액(추정)" value={won(maxLoan)} sub={`제약 요인: ${bindingConstraint}`} />
            <Stat label="필요 자기자본" value={won(requiredCash)} />
            <Stat label="자기자본 갭" value={gap > 0 ? won(gap) : "충족"} tone={gap > 0 ? "warn" : "good"} />
            <Stat label="현재 저축 속도로 달성까지" value={gap > 0 ? `약 ${yearsToGoal}년 (${monthsToGoal}개월)` : "즉시 가능"} tone={gap > 0 ? "warn" : "good"} />
          </div>
          {gap > 0 && (<div className="px-5 py-4 text-[14px] text-[#525252] leading-relaxed bg-[#FAFAFA] border-t border-[#E5E5E5]">2025년 10월 규제 이후 대출한도는 가격구간별 하드캡이 걸려 있어 소득이 높아도 한계가 있어요.{targetKey.startsWith("sale") ? " 매매는 자기자본 비중이 압도적으로 커야 해서 청약 병행을 강력 추천해요." : " 청약은 분양가 상한제 덕분에 자기자본 부담이 낮지만, 당첨 확률과 입주 시점이 불확실해요."}</div>)}
        </Card>
      </section>
    </>)}

    {tab === "strategy" && (<>
      <section>
        <SectionHeader eyebrow="경로 비교" title="청약 · 매매 · 전세" accent="#0A0A0A" />
        <div className="space-y-4">{STRATEGIES.map((s, i) => (<Card key={i}>
          <div className="flex items-center justify-between gap-3 mb-3"><h4 className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{s.title}</h4><ToneBadge tone={s.tone}>{s.badge}</ToneBadge></div>
          <ul className="space-y-2">{s.points.map((p, j) => (<li key={j} className="flex gap-2 text-[15px] text-[#3D3D3D] leading-relaxed"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>{p}</span></li>))}</ul>
        </Card>))}</div>
      </section>
      <section>
        <SectionHeader eyebrow="우리 조건 기준" title="혜택·제도 활용 가능 여부" accent="#0A0A0A" />
        <div className="mb-4 text-[14px] text-[#525252] bg-[#F7F7F7] rounded-xl p-4 leading-relaxed">과천은 가격 자체가 높아서 조건을 통과해도 "가격 상한"에 막히는 제도가 많아요. 실제로 열려 있는 것과 막히는 것을 구분했어요.</div>
        <div className="space-y-4">{BENEFITS.map((b, i) => (<Card key={i}>
          <div className="flex items-center justify-between gap-3 mb-2.5"><h4 className="text-[15px] font-bold">{b.title}</h4><ToneBadge tone={b.tone}>{b.fit}</ToneBadge></div>
          <p className="text-[14px] text-[#3D3D3D] leading-relaxed mb-3">{b.body}</p>
          <a href={b.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2">{b.label} <Icon name="chevron" size={13} /></a>
        </Card>))}</div>
      </section>
      <NewsPanel query="청약 제도 대출 규제 변경" eyebrow="제도 업데이트" title="최신 제도·규제 뉴스" />
    </>)}

    {tab === "loan" && (<>
      <section>
        <SectionHeader eyebrow="계산 결과" title="대출 한도 3단 필터" accent="#0A0A0A" />
        <Card>
          <div className="space-y-3">
            <FilterRow label="① DSR 40% (소득 기반)" value={won(dsrLoan)} active={maxLoan === dsrLoan} />
            <FilterRow label={`② LTV ${firstTime ? "70%(생애최초)" : "50%"}`} value={won(ltvLoan)} active={maxLoan === ltvLoan} />
            <FilterRow label="③ 가격구간 하드캡(2025.10.16~)" value={won(tierCap)} active={maxLoan === tierCap} />
          </div>
          <div className="mt-4 pt-4 border-t border-[#E5E5E5] flex justify-between items-center"><span className="text-[15px] font-semibold">최종 대출가능액</span><span className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{won(maxLoan)}</span></div>
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="입력값 조정" title="조건 바꿔보기" accent="#0A0A0A" />
        <Card><div className="grid grid-cols-2 gap-4">
          <Field label="적용금리 · 스트레스 포함(%)" value={rate} onChange={setRate} step={0.1} />
          <Toggle label="생애최초 구입자" active={firstTime} onClick={() => setHh({ firstTime: !firstTime })} activeText="예 (LTV 70%)" inactiveText="아니오 (LTV 50%)" />
        </div></Card>
      </section>
      <section>
        <SectionHeader eyebrow="직접 계산" title="이자 계산기" accent="#0A0A0A" />
        <Card>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="대출금액(만원)" value={loanAmountCalc} onChange={setLoanAmountCalc} />
            <Field label="금리(%)" value={loanRateCalc} onChange={setLoanRateCalc} step={0.1} />
            <Field label="대출기간(년)" value={loanYearsCalc} onChange={setLoanYearsCalc} />
            <Toggle label="상환방식" active={repayType === "equal_payment"} onClick={() => setHh({ repayType: repayType === "equal_payment" ? "equal_principal" : "equal_payment" })} activeText="원리금균등" inactiveText="원금균등" />
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            <Stat label={repayType === "equal_payment" ? "매달 상환액(고정)" : "첫 달 상환액(이후 점점 감소)"} value={won(Math.round(loanFirstMonthPay))} />
            <Stat label="총 이자" value={won(Math.round(loanTotalInterest))} tone="warn" />
            <Stat label="총 상환액(원금+이자)" value={won(Math.round(loanTotalPay))} />
          </div>
          <p className="mt-3 text-[13px] text-[#8A8A8A] leading-relaxed"><b>원리금균등</b>은 매달 같은 금액, <b>원금균등</b>은 원금을 매달 동일하게 갚아 이자가 점점 줄어드는 대신 초반 상환액이 커요. 총 이자는 원금균등이 더 적어요.</p>
        </Card>
      </section>
    </>)}

    {tab === "plan" && (<>
    <section>
      <SectionHeader eyebrow="로드맵" title="내집마련 4단계 타임라인" accent="#0A0A0A" />
      <Card>
      <div className="relative pl-6">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#E5E5E5]" />
        {TIMELINE.map((p, idx) => (<div key={idx} className="mb-8 relative last:mb-0">
          <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#0A0A0A] border-2 border-white" />
          <div className="text-[13px] font-semibold text-[#0A0A0A] mb-1">{p.phase}</div>
          <div className="text-lg font-bold mb-3" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{p.title}</div>
          <ul className="space-y-2">{p.items.map((it, i) => (<li key={i} className="flex gap-2 text-[15px] text-[#3D3D3D] leading-relaxed"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>{it}</span></li>))}</ul>
        </div>))}
      </div>
      </Card>
    </section>
    <RealtyChecklist />
    </>)}
    </div>)}

    {tab === "loan" && (<section>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <SectionHeader eyebrow={bankData.at ? `${bankData.at.slice(0, 10)} 갱신 데이터` : "2026-07 기준 · 추정"} title="은행 주담대 상품 비교" accent="#0A0A0A" />
        <div className="mb-4"><LiveUpdateBtn topic="bankloans" onData={j => setBankData({ items: j.items, at: j.fetchedAt })} /></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-stretch">
        {bankData.items.map(b => {
          const mid = Math.round((b.rateMin + b.rateMax) / 2 * 10) / 10;
          const pay = (r) => { const i = r / 100 / 12, n = loanYearsCalc * 12, P = loanAmountCalc * 10000; return n > 0 ? (i > 0 ? P * i / (1 - Math.pow(1 + i, -n)) : P / n) : 0; };
          const applied = loanRateCalc === mid;
          return (<Card key={b.bank} className="!p-4 h-full flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold">{b.bank} <span className="text-[13px] font-semibold text-[#8A8A8A]">{b.product}</span></div>
                <div className="text-[12px] text-[#8A8A8A] mt-0.5">{b.rateType}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[15px] font-bold">{b.rateMin.toFixed(2)}~{b.rateMax.toFixed(2)}%</div>
                <div className="text-[12px] text-[#8A8A8A] mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>월 {won(Math.round(pay(b.rateMin)))} ~ {won(Math.round(pay(b.rateMax)))}</div>
              </div>
            </div>
            <div className="text-[13px] text-[#525252] mt-1.5 leading-relaxed">{b.feature}</div>
            <div className="flex items-center gap-3 mt-auto pt-3">
              <button onClick={() => setHh({ loanRateCalc: mid })} className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${applied ? "bg-[#F0F0F0] text-[#8A8A8A]" : "bg-[#0A0A0A] text-white"}`}>{applied ? "적용됨" : `평균 ${mid}% 계산기에 적용`}</button>
              <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[#525252] underline underline-offset-4">상품 안내</a>
            </div>
          </Card>);
        })}
      </div>
      <div className="mt-3"><InfoNote>월 상환액은 이자 계산기 조건(대출 {manWon(loanAmountCalc)} · {loanYearsCalc}년 · 원리금균등) 기준이에요. "적용"을 누르면 해당 은행 평균 금리로 계산기가 바뀝니다. "최신 정보로 갱신"은 금감원 공시(또는 웹 리서치) 기준 — 실제 금리는 우대조건·시점에 따라 달라요. LTV는 전 은행 공통(규제지역 40%, 생애최초 70%) + 가격구간 하드캡.</InfoNote></div>
    </section>)}

    {tab === "news" && (<div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-8 lg:space-y-0">
      <NewsPanel query="부동산 규제 대출" eyebrow="실시간 핫이슈" title="부동산 뉴스" />
      <div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["과천", "서울", "경기", "성남", "안양", "수원", "전국"].map(r => (
            <button key={r} onClick={() => setNewsRegion(r)} className={`h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${newsRegion === r ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`}>{r}</button>
          ))}
        </div>
        <NewsPanel query={`${newsRegion === "전국" ? "" : newsRegion + " "}청약 분양`} eyebrow="지역별 청약 소식" title={`${newsRegion} 청약 뉴스`} />
      </div>
    </div>)}

    {tab === "cheongyak" && <CheongyakTab mapKey={mapKey} />}
    {tab === "realty" && <RealtyListTab mapKey={mapKey} />}

    {/* 커스텀 메모 — 어떤 탭에서든 항상 페이지 최하단 */}
    <div className="masonry"><CustomNotes themeId="realty" accent="#0A0A0A" /></div>
  </>);
}

/* ============== 테마: 돈 모으기 ============== */
const SAVING_TABS = [
  { id: "tracker", label: "납입 트래커", icon: "piggy" },
  { id: "sim", label: "저축 시뮬레이터", icon: "calc" },
  { id: "guide", label: "절세 가이드", icon: "check2" },
  { id: "policy", label: "정책·혜택", icon: "search" },
];

function SavingTheme({ hh }) {
  const [tab, setTab] = usePersist("saving-tab-v1", "tracker");
  const [accounts, setAccounts] = usePersist("saving-accounts-v1", ACCOUNTS_DEFAULT);
  const [gift, setGift] = usePersist("saving-gift-v1", { giftAmount: 20000, spouseGiftUsed: 0 });
  const [sim, setSim] = usePersist("saving-sim-v1", { monthly: 250, ratePct: 4, years: 10 });
  const [policyData, setPolicyData] = usePersist("policy-data-v1", { items: POLICY_BENEFITS, at: null });

  const patch = (id, k, v) => setAccounts(accounts.map(a => a.id === id ? { ...a, [k]: v } : a));
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalPaid = accounts.reduce((s, a) => s + (a.paid || 0), 0);
  const totalGoal = accounts.reduce((s, a) => s + (a.goal || 0), 0);
  const pensionPaid = accounts.filter(a => a.type === "연금저축" || a.type === "IRP").reduce((s, a) => s + (a.paid || 0), 0);
  const highPay = (hh.income1 > 5500) && (hh.income2 > 5500); // 총급여 5,500만 초과 시 13.2%
  const refundEst = Math.min(pensionPaid, 1800) * (highPay ? 0.132 : 0.165);

  // 계좌 유형별 그룹
  const groups = ACCOUNT_TYPES.map(t => ({ type: t, list: accounts.filter(a => a.type === t) })).filter(g => g.list.length > 0);
  const addAccount = (type) => setAccounts([...accounts, { id: uid(), owner: hh.label1 || "본인", type, balance: 0, paid: 0, goal: 0 }]);

  // 저축 시뮬레이터: 월복리 적립식 미래가치
  const years = Math.min(40, Math.max(1, Number(sim.years) || 1));
  const mRate = (Number(sim.ratePct) || 0) / 100 / 12;
  const yearly = [];
  { let bal = 0;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = (bal + (Number(sim.monthly) || 0)) * (1 + mRate);
      yearly.push({ y, bal: Math.round(bal), principal: (Number(sim.monthly) || 0) * 12 * y });
    } }
  const maxBal = yearly.length ? yearly[yearly.length - 1].bal : 1;

  const spouseExemption = Math.max(0, 60000 - gift.spouseGiftUsed);
  const giftTaxableBase = Math.max(0, gift.giftAmount * 10000 - spouseExemption * 10000);
  const giftTaxOwed = giftTax(giftTaxableBase);
  const incomeTotal = hh.income1 + hh.income2;

  return (<>
    <PillNav tabs={SAVING_TABS} tab={tab} setTab={setTab} />

    {tab === "tracker" && (<>
      <section className="mb-6">
        <SectionHeader eyebrow="한눈에" title="절세계좌 현황" />
        <Card className="!p-0 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-[#F0F0F0]">
            <div className="p-4 text-center"><div className="text-[13px] text-[#8A8A8A] mb-1">총 잔액</div><div className="text-lg font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(totalBalance)}</div></div>
            <div className="p-4 text-center"><div className="text-[13px] text-[#8A8A8A] mb-1">올해 납입</div><div className="text-lg font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(totalPaid)}</div></div>
            <div className="p-4 text-center"><div className="text-[13px] text-[#8A8A8A] mb-1">연 납입 목표</div><div className="text-lg font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(totalGoal)}</div></div>
          </div>
          <div className="px-5 pb-4">
            <div className="flex justify-between text-[13px] text-[#525252] mb-1.5"><span>목표 달성률</span><span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{totalGoal > 0 ? Math.round(totalPaid / totalGoal * 100) : 0}%</span></div>
            <ProgressBar ratio={totalGoal > 0 ? totalPaid / totalGoal : 0} />
            <div className="mt-3 text-[13px] text-[#8A8A8A]">연금저축+IRP 납입 기준 예상 세액공제 환급 <b className="text-[#0A0A0A]">{manWon(Math.round(refundEst))}</b> <span className="font-mono text-[11px]">({highPay ? "13.2%" : "16.5%"} · 부부 소득 연동)</span></div>
          </div>
        </Card>
      </section>

      <div className="masonry">
      {groups.map(g => {
        const gb = g.list.reduce((s, a) => s + (a.balance || 0), 0);
        const gp = g.list.reduce((s, a) => s + (a.paid || 0), 0);
        const gg = g.list.reduce((s, a) => s + (a.goal || 0), 0);
        return (<section key={g.type}>
          <SectionHeader eyebrow={`${g.list.length}개 계좌`} title={g.type} />
          <Card>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#F0F0F0]">
              <span className="text-[13px] text-[#8A8A8A]">잔액 <b className="text-[#0A0A0A]">{manWon(gb)}</b> · 납입 <b className="text-[#0A0A0A]">{manWon(gp)}</b>/{manWon(gg)}</span>
              <span className="font-mono text-[12px] font-semibold">{gg > 0 ? Math.round(gp / gg * 100) : 0}%</span>
            </div>
            <div className="space-y-4">
              {g.list.map(a => (<div key={a.id} className="rounded-xl bg-[#FAFAFA] p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <TextInput value={a.owner} onChange={v => patch(a.id, "owner", v)} placeholder="명의" className="!w-24 !bg-white" />
                  <div className="flex-1" />
                  <IconBtn name="trash" title="계좌 삭제" onClick={() => setAccounts(accounts.filter(x => x.id !== a.id))} />
                </div>
                <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                  <div><label className="text-[11px] text-[#8A8A8A] block mb-1">잔액(만원)</label><NumInput value={a.balance} onChange={v => patch(a.id, "balance", v)} className="!bg-white" /></div>
                  <div><label className="text-[11px] text-[#8A8A8A] block mb-1">올해 납입</label><NumInput value={a.paid} onChange={v => patch(a.id, "paid", v)} className="!bg-white" /></div>
                  <div><label className="text-[11px] text-[#8A8A8A] block mb-1">연 목표</label><NumInput value={a.goal} onChange={v => patch(a.id, "goal", v)} className="!bg-white" /></div>
                </div>
                <ProgressBar ratio={a.goal > 0 ? a.paid / a.goal : 0} height={4} />
              </div>))}
            </div>
            <button onClick={() => addAccount(g.type)} className="mt-3 w-full h-10 rounded-xl border border-dashed border-[#C9C9C9] text-[13px] font-semibold text-[#525252] flex items-center justify-center gap-1.5 hover:bg-[#FAFAFA]">
              <Icon name="plus" size={14} /> {g.type} 계좌 추가
            </button>
          </Card>
        </section>);
      })}

      <section>
        <SectionHeader eyebrow="새 유형" title="다른 계좌 추가" />
        <Card>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map(t => (<button key={t} onClick={() => addAccount(t)} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold hover:bg-[#ECECEC] flex items-center gap-1"><Icon name="plus" size={12} />{t}</button>))}
          </div>
        </Card>
      </section>
      </div>
    </>)}

    {tab === "sim" && (<div className="masonry">
      <section>
        <SectionHeader eyebrow="Compound" title="월 저축 → 연도별 자산" />
        <Card>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Field label="월 납입(만원)" value={sim.monthly} onChange={v => setSim({ ...sim, monthly: v })} step={10} />
            <Field label="연 수익률(%)" value={sim.ratePct} onChange={v => setSim({ ...sim, ratePct: v })} step={0.5} />
            <Field label="기간(년)" value={sim.years} onChange={v => setSim({ ...sim, years: v })} />
          </div>
          <button onClick={() => setSim({ ...sim, monthly: hh.monthlySave })} className="text-[13px] font-semibold text-[#525252] underline underline-offset-4">부동산 진단의 월 저축액({hh.monthlySave}만원) 불러오기</button>
          <p className="mt-3 text-[13px] text-[#8A8A8A] leading-relaxed">월복리 적립식 가정. ISA·연금계좌에 넣으면 여기서 계산된 수익에 대한 세금을 아끼는 구조예요.</p>
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="Projection" title={`${years}년 후 ${manWon(yearly[years - 1].bal)}`} />
        <Card>
          <div className="space-y-2.5">
            {yearly.map(r => (<div key={r.y} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-[#8A8A8A] w-8 shrink-0 text-right">{r.y}년</span>
              <div className="flex-1 h-4 rounded-full bg-[#F0F0F0] overflow-hidden">
                <div className="h-full rounded-full bg-[#0A0A0A] relative" style={{ width: `${Math.max(2, Math.round(r.bal / maxBal * 100))}%` }}>
                  <div className="absolute inset-y-0 left-0 bg-[#8A8A8A] rounded-full" style={{ width: `${Math.round(r.principal / r.bal * 100)}%` }} />
                </div>
              </div>
              <span className="font-mono text-[12px] font-semibold w-24 shrink-0 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(r.bal)}</span>
            </div>))}
          </div>
          <div className="flex gap-4 mt-4 pt-3 border-t border-[#F0F0F0] text-[12px] text-[#8A8A8A]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#8A8A8A] inline-block" />원금</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0A] inline-block" />원금+수익</span>
            <span className="ml-auto">누적 수익 <b className="text-[#0A0A0A]">{manWon(yearly[years - 1].bal - yearly[years - 1].principal)}</b></span>
          </div>
        </Card>
      </section>
    </div>)}

    {tab === "guide" && (<div className="masonry">
      <section>
        <SectionHeader eyebrow="결론부터" title="합칠까, 나눌까" />
        <Card><p className="text-[15px] text-[#3D3D3D] leading-relaxed">계좌를 물리적으로 합칠 필요는 없어요. <b>각자 명의 절세계좌(ISA·연금저축·IRP)는 각자 유지</b>하고, <b>공동 목표자금만 별도 통장</b>으로 분리하세요.</p></Card>
      </section>
      <section>
        <SectionHeader eyebrow="절세계좌 3종" title="ISA · 연금저축 · IRP" />
        <div className="space-y-4">
          <Card><h4 className="text-[15px] font-bold mb-3">① ISA — 각자 1개씩</h4><ul className="space-y-2 text-[15px] text-[#3D3D3D]">
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>연 4,000만원 한도, 총 2억원 (미납입분 이월)</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>비과세 500만원, 초과분 9.9% 분리과세</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>의무유지 3년 — 원금은 언제든 인출 가능</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>과천 목적자금(청약·매매용)에 가장 적합</span></li>
          </ul></Card>
          <Card><h4 className="text-[15px] font-bold mb-3">② 연금저축 + IRP — 각자 900만원</h4><ul className="space-y-2 text-[15px] text-[#3D3D3D]">
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>연금저축 600만(월50만) + IRP 300만(월25만)</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>총급여 5,500만 초과 시 공제율 13.2% — 1인 약 118.8만 환급</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={16} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>만 55세까지 묶임 — 목적자금과 별개 접근</span></li>
          </ul></Card>
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="세금 폭탄 예방" title="배우자간 자금 이동 계산기" />
        <Card>
          <p className="text-[14px] text-[#525252] leading-relaxed mb-4">배우자 증여재산공제는 10년간 6억원. 넘는 만큼만 증여세가 붙어요.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="이체 검토 금액(만원)" value={gift.giftAmount} onChange={v => setGift({ ...gift, giftAmount: v })} />
            <Field label="최근 10년 기사용 공제(만원)" value={gift.spouseGiftUsed} onChange={v => setGift({ ...gift, spouseGiftUsed: v })} />
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            <Stat label="잔여 배우자 증여공제(10년)" value={won(spouseExemption * 10000)} />
            <Stat label="공제 초과 과세대상 금액" value={won(giftTaxableBase)} />
            <Stat label="예상 증여세" value={giftTaxOwed > 0 ? won(giftTaxOwed) : "0원 · 비과세 범위"} tone={giftTaxOwed > 0 ? "warn" : "good"} />
          </div>
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="실전 수칙" title="세금 폭탄 예방" />
        <Card className="bg-[#FAFAFA]"><div className="space-y-3 text-[15px] text-[#3D3D3D] leading-relaxed">
          <p>• <b>부모님 증여:</b> 혼인신고 전후 2년 이내, 양가 합산 최대 3억원까지 비과세</p>
          <p>• <b>부모님 무이자 차입:</b> 약 2억원까지 증여세 없음 — 차용증+상환기록 필수</p>
          <p>• <b>공동명의 매매:</b> 지분율 = 실제 자금 부담 비율</p>
          <p>• <b>자금조달계획서:</b> 투기과열지구는 금액 무관 전원 제출</p>
        </div></Card>
      </section>
    </div>)}

    {tab === "policy" && (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <SectionHeader eyebrow="우리 기준 자동 판정" title="신혼부부 정책·혜택 체크" />
          <div className="mb-4"><LiveUpdateBtn topic="policies" params={`&income=${incomeTotal}`} onData={j => setPolicyData({ items: j.items, at: j.fetchedAt })} /></div>
        </div>
        <Card>
          <p className="text-[14px] text-[#525252] leading-relaxed">부부합산 연소득 <b className="text-[#0A0A0A]">{manWon(incomeTotal)}</b>(홈의 부부 정보와 연동) 기준으로 실제로 받을 수 있는 것과 막히는 것을 구분했어요. {policyData.at ? `${policyData.at.slice(0, 10)} 실시간 리서치 기준` : "기본 데이터는 2026년 7월 리서치 기준"} — "최신 정보로 갱신"을 누르면 지금 시점 정책을 웹에서 다시 조사해요.</p>
        </Card>
      </section>
      <section className="mb-6">
        <div className="grid lg:grid-cols-2 gap-4 items-stretch">
          {policyData.items.map((p, i) => (<Card key={i} className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-2.5"><h4 className="text-[15px] font-bold">{p.name}</h4><ToneBadge tone={p.fit}>{p.fitText}</ToneBadge></div>
            <div className="text-[13px] text-[#8A8A8A] mb-1.5">{p.target}</div>
            <p className="text-[14px] text-[#3D3D3D] leading-relaxed mb-2">{p.benefit}</p>
            <p className="text-[13px] text-[#525252] leading-relaxed mb-3 bg-[#FAFAFA] rounded-lg px-3 py-2">{p.why}</p>
            <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">공식 안내 <Icon name="chevron" size={12} /></a>
          </Card>))}
        </div>
      </section>
      <NewsPanel query="신혼부부 정책 혜택" eyebrow="놓치는 정책 없게" title="정책 뉴스 새로고침" />
    </>)}

    <div className="masonry"><CustomNotes themeId="saving" /></div>
  </>);
}

/* ============== 테마: 결혼식 ============== */
const WEDDING_TABS = [
  { id: "overview", label: "개요·예산", icon: "heart" },
  { id: "checklist", label: "체크리스트", icon: "check2" },
  { id: "venue", label: "인기 식장", icon: "building" },
  { id: "expo", label: "박람회", icon: "calendar" },
  { id: "honeymoon", label: "신혼여행", icon: "plane" },
];
const naverSearch = (q) => `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
const naverBlog = (q) => `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(q)}`;

// 떠다니는 하트 (결혼식 히어로 배경 — reduced-motion 시 자동 비활성)
function HeartField() {
  const parts = useMemo(() => Array.from({ length: 14 }, () => ({
    left: (Math.random() * 96 + 2).toFixed(1),
    s: (0.5 + Math.random() * 1.1).toFixed(2),
    o: (0.08 + Math.random() * 0.22).toFixed(2),
    d: (7 + Math.random() * 9).toFixed(1) + "s",
    dl: (-Math.random() * 14).toFixed(1) + "s",
  })), []);
  return (<>{parts.map((p, i) => (
    <span key={i} className="heart-p text-white" style={{ left: `${p.left}%`, "--s": p.s, "--o": p.o, "--d": p.d, "--dl": p.dl }}>
      <Icon name="heart" size={20} fill="currentColor" />
    </span>))}</>);
}

function WeddingTheme() {
  const [tab, setTab] = usePersist("wedding-tab-v1", "overview");
  const [bursts, setBursts] = useState([]);
  const burst = () => {
    const stamp = uid();
    const parts = Array.from({ length: 12 }, (_, i) => ({
      id: stamp + i,
      x: (Math.random() * 280 - 140).toFixed(0) + "px",
      y: (Math.random() * -200 - 40).toFixed(0) + "px",
      s: 12 + Math.round(Math.random() * 16),
    }));
    setBursts(b => [...b, ...parts]);
    setTimeout(() => setBursts(b => b.filter(p => !parts.some(q => q.id === p.id))), 1000);
  };
  const [info, setInfo] = usePersist("wedding-info-v1", { date: "", venue: "" });
  const [budget, setBudget] = usePersist("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const [checklist, setChecklist] = usePersist("wedding-checklist-v2",
    WEDDING_CHECKLIST_DEFAULT.map(g => ({ cat: g.cat, items: g.items.map(t => ({ id: uid(), text: t, done: false })) })));
  const [honeymoon, setHoneymoon] = usePersist("wedding-honeymoon-v4", HONEYMOON_DEFAULT); // v4: 캐나다 추가 + 이탈리아 단독 비용
  const [newItem, setNewItem] = useState({ name: "", budget: 0 });
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const [newPlace, setNewPlace] = useState({ place: "", cost: 0, season: "", note: "", route: "" });
  const [venueFilter, setVenueFilter] = useState("all");

  const d = dday(info.date);
  const totalBudget = budget.reduce((s, b) => s + (b.budget || 0), 0);
  const totalSpent = budget.reduce((s, b) => s + (b.spent || 0), 0);
  const alloc = store.get("home-alloc-v1", ALLOC_DEFAULT);
  const patchBudget = (id, k, v) => setBudget(budget.map(b => b.id === id ? { ...b, [k]: v } : b));

  const toggleTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map(it => it.id === id ? { ...it, done: !it.done } : it) }));
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter(it => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist.reduce((s, g) => s + g.items.filter(i => i.done).length, 0);

  const patchHm = (id, k, v) => setHoneymoon(honeymoon.map(h => h.id === id ? { ...h, [k]: v } : h));
  const starHm = (id) => setHoneymoon(honeymoon.map(h => ({ ...h, star: h.id === id ? !h.star : false }))); // 1순위는 하나만
  const [venueList, setVenueList] = usePersist("wedding-venues-v2", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v }))); // v2: 초고가 베뉴 제외, 직장인 중위 가격대 위주
  const [venueMeta, setVenueMeta] = usePersist("wedding-venues-meta-v1", { at: null });
  const [newVenue, setNewVenue] = useState({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" });
  const patchVenue = (id, k, val) => setVenueList(venueList.map(x => x.id === id ? { ...x, [k]: val } : x));
  const venueTypes = ["all", ...Array.from(new Set(venueList.map(v => v.type)))];
  const venues = venueList.filter(v => venueFilter === "all" || v.type === venueFilter);

  return (<>
    <PillNav tabs={WEDDING_TABS} tab={tab} setTab={setTab} />

    {tab === "overview" && (<>
      <section className="mb-6">
        <div onClick={burst} className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] text-white px-6 py-12 text-center cursor-pointer select-none" title="클릭해 보세요 🤍">
          <HeartField />
          {bursts.map(p => (<span key={p.id} className="heart-b text-white/80" style={{ "--x": p.x, "--y": p.y }}><Icon name="heart" size={p.s} fill="currentColor" /></span>))}
          <div className="relative font-mono text-[11px] font-medium tracking-[0.26em] uppercase text-white/45 mb-3">Our Wedding Day</div>
          <div className="relative font-mono text-[56px] sm:text-[72px] leading-none font-semibold tracking-tight">{d === null ? "D - ?" : ddayText(d)}</div>
          <div className="relative mt-4 text-[14px] text-white/60">{info.date ? `${info.date}${info.venue ? " · " + info.venue : ""}` : "아래에서 예식일을 설정해 주세요"}</div>
        </div>
        <Card className="mt-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[14px] text-[#525252] block mb-1.5 font-medium">예식일</label>
              <input type="date" value={info.date} onChange={e => setInfo({ ...info, date: e.target.value })}
                className="w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors" />
            </div>
            <div>
              <label className="text-[14px] text-[#525252] block mb-1.5 font-medium">예식장 (미정이면 비워두기)</label>
              <TextInput value={info.venue} onChange={v => setInfo({ ...info, venue: v })} placeholder="예: OO웨딩홀" className="!h-12" />
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader eyebrow="비용 관리" title="예식 비용 예산표" />
        <Card className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[14px] text-[#525252]">지출 <b className="text-[#0A0A0A]">{manWon(totalSpent)}</b> / 예산 <b>{manWon(totalBudget)}</b></span>
            <span className="font-mono text-[14px] font-bold">{totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0}%</span>
          </div>
          <ProgressBar ratio={totalBudget > 0 ? totalSpent / totalBudget : 0} />
          {alloc.wedding > 0 && <div className="mt-3 text-[13px] text-[#8A8A8A]">홈에서 배정한 결혼 자금 <b>{manWon(alloc.wedding)}</b> 대비 예산 {Math.round(totalBudget / alloc.wedding * 100)}% {totalBudget > alloc.wedding && <span className="text-[#0A0A0A] font-bold underline underline-offset-2">— 배정액 초과!</span>}</div>}
        </Card>
        <div className="grid sm:grid-cols-2 gap-3 items-stretch">
          {budget.map(b => (<Card key={b.id} className="!p-4">
            <div className="flex items-center gap-2">
              <TextInput value={b.name} onChange={v => patchBudget(b.id, "name", v)} className="flex-1 font-semibold" />
              <IconBtn name="trash" title="항목 삭제" onClick={() => setBudget(budget.filter(x => x.id !== b.id))} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div><label className="text-[12px] text-[#8A8A8A] block mb-1">예산(만원)</label><NumInput value={b.budget} onChange={v => patchBudget(b.id, "budget", v)} /></div>
              <div><label className="text-[12px] text-[#8A8A8A] block mb-1">실제 지출(만원)</label><NumInput value={b.spent} onChange={v => patchBudget(b.id, "spent", v)} /></div>
            </div>
            <div className="mt-2.5"><ProgressBar ratio={b.budget > 0 ? b.spent / b.budget : 0} height={4} /></div>
          </Card>))}
          <Card className="!p-4">
            <div className="text-[13px] font-semibold text-[#8A8A8A] mb-2.5">항목 추가</div>
            <div className="flex gap-2">
              <TextInput value={newItem.name} onChange={v => setNewItem({ ...newItem, name: v })} placeholder="항목명 (예: 웨딩카)" className="flex-1 min-w-0" />
              <NumInput value={newItem.budget} onChange={v => setNewItem({ ...newItem, budget: v })} className="!w-24" />
              <button onClick={() => { if (!newItem.name.trim()) return; setBudget([...budget, { id: uid(), name: newItem.name.trim(), budget: newItem.budget, spent: 0 }]); setNewItem({ name: "", budget: 0 }); }}
                className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0">추가</button>
            </div>
          </Card>
        </div>
      </section>
    </>)}

    {tab === "checklist" && (() => {
      // 예식일 기준 현재 단계 — 그룹 순서는 타임라인(D-12~9개월 → … → 결혼 후) 고정
      const phaseIdx = d === null ? null
        : Math.min(checklist.length - 1, d < 0 ? 5 : d <= 30 ? 4 : d <= 90 ? 3 : d <= 180 ? 2 : d <= 270 ? 1 : 0);
      const curGroup = phaseIdx !== null ? checklist[phaseIdx] : null;
      const curLeft = curGroup ? curGroup.items.filter(it => !it.done).length : 0;
      return (<div className="masonry">
      <section>
        <SectionHeader eyebrow="2026 실전 후기 기반" title="웨딩 체크리스트" />
        {curGroup ? (
          <Card className="mb-4 !border-[#0A0A0A] border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[12px] font-bold text-white bg-[#0A0A0A] px-2.5 py-1 rounded-full">{ddayText(d)}</span>
              <span className="text-[15px] font-bold">지금은 "{curGroup.cat}" 단계</span>
            </div>
            <div className="mt-2 text-[13px] text-[#525252]">{curLeft > 0 ? <>이 단계에서 남은 할 일 <b className="text-[#0A0A0A]">{curLeft}개</b> — 아래 검정 테두리 카드부터 처리하세요.</> : "이 단계 할 일을 모두 끝냈어요! 다음 단계를 미리 보세요."}</div>
          </Card>
        ) : (
          <Card className="mb-4"><span className="text-[13px] text-[#8A8A8A]">개요·예산 탭에서 예식일을 설정하면 지금 해야 할 단계를 자동으로 짚어줘요.</span></Card>
        )}
        <Card className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-semibold">전체 진행률</span>
          <div className="flex items-center gap-3 flex-1 max-w-[220px] ml-4">
            <ProgressBar ratio={taskTotal > 0 ? taskDone / taskTotal : 0} />
            <span className="font-mono text-[14px] font-bold shrink-0">{taskDone}/{taskTotal}</span>
          </div>
        </Card>
        <Card>
          <div className="text-[13px] font-semibold text-[#8A8A8A] mb-2.5">할 일 추가</div>
          <div className="flex gap-2">
            <select value={newTask.gi} onChange={e => setNewTask({ ...newTask, gi: e.target.value })}
              className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
              {checklist.map((g, i) => <option key={i} value={i}>{g.cat}</option>)}
            </select>
            <TextInput value={newTask.text} onChange={v => setNewTask({ ...newTask, text: v })} placeholder="예: 웨딩카 예약" className="flex-1 min-w-0" />
            <button onClick={addTask} className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0">추가</button>
          </div>
        </Card>
      </section>

      {checklist.map((g, gi) => {
        const state = phaseIdx === null ? "none" : gi === phaseIdx ? "now" : gi < phaseIdx ? "past" : "next";
        const gLeft = g.items.filter(it => !it.done).length;
        return (<section key={gi}>
        <Card className={state === "now" ? "!border-[#0A0A0A] border-2" : state === "past" ? "opacity-60" : ""}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <h4 className="font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full">{g.cat}</h4>
              {state === "now" && <span className="text-[11px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full">지금 할 일</span>}
              {state === "past" && <span className="text-[11px] font-semibold text-[#8A8A8A]">{gLeft > 0 ? `지난 단계 · 미완료 ${gLeft}` : "지난 단계 · 완료"}</span>}
              {state === "next" && <span className="text-[11px] font-semibold text-[#B0B0B0]">다음 단계</span>}
            </div>
            <a href={naverBlog(`결혼준비 ${g.cat.replace("D-", "")} 체크리스트 후기`)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[#8A8A8A] underline underline-offset-4 hover:text-[#0A0A0A]">실제 후기 검색</a>
          </div>
          <ul className="space-y-3">
            {g.items.map(it => (<li key={it.id} className="flex items-start gap-2 group">
              <button onClick={() => toggleTask(gi, it.id)} className="flex items-start gap-3 text-left flex-1">
                {it.done ? <Icon name="check2" size={19} className="mt-0.5 shrink-0 text-[#0A0A0A]" /> : <Icon name="square" size={19} className="mt-0.5 shrink-0 text-[#C9C9C9]" />}
                <span className={`text-[14px] leading-relaxed ${it.done ? "line-through text-[#B0B0B0]" : "text-[#24231E]"}`}>{it.text}</span>
              </button>
              <IconBtn name="trash" title="삭제" onClick={() => removeTask(gi, it.id)} className="!w-7 !h-7 opacity-0 group-hover:opacity-100" />
            </li>))}
          </ul>
        </Card>
      </section>); })}

      <section>
        <SectionHeader eyebrow="후기에서 자주 나오는" title="실전 꿀팁 5" />
        <Card className="bg-[#FAFAFA]">
          <ul className="space-y-3">
            {WEDDING_TIPS.map((t, i) => (<li key={i} className="flex gap-2.5 text-[14px] text-[#3D3D3D] leading-relaxed">
              <span className="font-mono text-[12px] font-bold shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span><span>{t}</span>
            </li>))}
          </ul>
        </Card>
      </section>
    </div>); })()}

    {tab === "venue" && (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <SectionHeader eyebrow={venueMeta.at ? `서울 · ${venueMeta.at.slice(0, 10)} 실시간 리서치` : "서울 · 2025~26 기준"} title="인기 예식장 리스트" />
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {venueTypes.map(t => (<button key={t} onClick={() => setVenueFilter(t)} className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${venueFilter === t ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}`}>{t === "all" ? "전체" : t}</button>))}
            <LiveUpdateBtn topic="venues" onData={j => { setVenueList(j.items.map((v, i) => ({ id: "rv" + i, img: "", ...v }))); setVenueMeta({ at: j.fetchedAt }); }} />
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4 items-stretch">
          {venues.map(v => (<Card key={v.id} className="h-full flex flex-col">
            {v.img && <img src={v.img} alt={v.name} onError={(e) => { e.target.style.display = "none"; }} className="w-full h-40 object-cover rounded-xl mb-3" />}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-[16px] font-bold">{v.name}</div>
                <div className="text-[13px] text-[#8A8A8A] mt-0.5">{v.area} · 수용 {v.cap}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <ToneBadge tone="neutral">{v.type}</ToneBadge>
                <IconBtn name="trash" title="삭제" onClick={() => setVenueList(venueList.filter(x => x.id !== v.id))} className="!w-7 !h-7" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-[#FAFAFA] rounded-xl px-3 py-2.5"><div className="text-[11px] text-[#8A8A8A]">1인 식대</div><div className="text-[14px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{v.meal}</div></div>
              <div className="bg-[#FAFAFA] rounded-xl px-3 py-2.5"><div className="text-[11px] text-[#8A8A8A]">대관료(추정)</div><div className="text-[14px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{v.fee}</div></div>
            </div>
            <p className="text-[13px] text-[#525252] leading-relaxed mb-3">{v.note}</p>
            <div className="mt-auto">
              <div className="flex gap-3 mb-2.5">
                <a href={naverSearch(v.name + " 웨딩")} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold underline underline-offset-4">네이버 검색</a>
                <a href={`https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(v.name + " 웨딩홀")}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">사진 검색</a>
                <a href={naverBlog(v.name + " 결혼식 후기")} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">후기 보기</a>
              </div>
              <TextInput value={v.img || ""} onChange={val => patchVenue(v.id, "img", val)} placeholder="대표 사진 URL 붙여넣기 (선택)" className="!h-8 !text-[12px]" />
            </div>
          </Card>))}
          <Card className="h-full flex flex-col justify-center border-dashed">
            <div className="text-[13px] font-semibold text-[#8A8A8A] mb-3">식장 직접 추가 — 투어 다녀온 곳, 새로 뜨는 곳을 기록해 리스트를 항상 최신으로</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <TextInput value={newVenue.name} onChange={v => setNewVenue({ ...newVenue, name: v })} placeholder="식장명 *" />
              <TextInput value={newVenue.area} onChange={v => setNewVenue({ ...newVenue, area: v })} placeholder="지역 (예: 강남구)" />
              <select value={newVenue.type} onChange={e => setNewVenue({ ...newVenue, type: e.target.value })} className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
                {["호텔", "하우스", "채플", "컨벤션", "기타"].map(t => <option key={t}>{t}</option>)}
              </select>
              <TextInput value={newVenue.cap} onChange={v => setNewVenue({ ...newVenue, cap: v })} placeholder="수용 인원" />
              <TextInput value={newVenue.meal} onChange={v => setNewVenue({ ...newVenue, meal: v })} placeholder="1인 식대" />
              <TextInput value={newVenue.fee} onChange={v => setNewVenue({ ...newVenue, fee: v })} placeholder="대관료" />
            </div>
            <TextInput value={newVenue.note} onChange={v => setNewVenue({ ...newVenue, note: v })} placeholder="메모" className="mb-2.5" />
            <button onClick={() => { if (!newVenue.name.trim()) return; setVenueList([...venueList, { id: uid(), img: "", ...newVenue, name: newVenue.name.trim() }]); setNewVenue({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" }); }}
              className="h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"><Icon name="plus" size={15} /> 리스트에 추가</button>
          </Card>
        </div>
        <div className="mt-3"><InfoNote>기본 10곳은 2025~26 후기·보도 기반 리서치예요(가격은 추정치). 카드 삭제·추가·사진 등록이 모두 저장되고 부부가 함께 보는 목록에 실시간 반영됩니다. 견적은 투어에서 직접 확인하세요.</InfoNote></div>
      </section>
      <NewsPanel query="웨딩홀 예식장" eyebrow="업계 소식으로 최신화" title="웨딩홀 뉴스" />
    </>)}

    {tab === "expo" && (<div className="masonry">
      <section>
        <SectionHeader eyebrow="다가오는 일정" title="결혼 박람회" />
        <div className="space-y-3">
          {WEDDING_EXPOS.map((e, i) => (<Card key={i} className="!p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-snug">{e.name}</div>
                <div className="text-[13px] text-[#8A8A8A] mt-1">{e.venue}</div>
                <div className="text-[13px] text-[#525252] mt-0.5">{e.note}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[12px] font-semibold whitespace-nowrap">{e.date}</div>
                {!e.exact && <span className="text-[11px] text-[#8A8A8A]">(예상)</span>}
              </div>
            </div>
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2.5 text-[13px] font-semibold underline underline-offset-4">일정 확인·사전등록 <Icon name="chevron" size={12} /></a>
          </Card>))}
        </div>
        <div className="mt-3"><InfoNote>2026년 7월 리서치 기준. 박람회는 1~2개월 전에 회차별 일정이 공개되니 링크에서 최신 일정을 확인하세요.</InfoNote></div>
      </section>
      <section>
        <SectionHeader eyebrow="정기 개최" title="상시 체크할 박람회" />
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-[#F0F0F0]">
            {EXPO_RECURRING.map((e, i) => (<li key={i} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-bold">{e.name}</div>
                  <div className="text-[12px] text-[#8A8A8A] mt-0.5">{e.cycle} · {e.venue}</div>
                </div>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold underline underline-offset-4 shrink-0">홈페이지</a>
              </div>
            </li>))}
          </ul>
        </Card>
      </section>
    </div>)}

    {tab === "honeymoon" && (<>
      {(() => { const first = honeymoon.find(h => h.star); return first ? (
        <section className="mb-6">
          <Card className="!p-0 overflow-hidden">
            <div className="bg-[#0A0A0A] text-white px-6 py-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon name="star" size={20} fill="currentColor" className="shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-white/50">1순위 허니문</div>
                  <div className="text-[22px] font-bold tracking-tight truncate">{first.place}</div>
                </div>
              </div>
              <button onClick={() => starHm(first.id)} className="text-[12px] font-semibold text-white/50 hover:text-white shrink-0">1순위 해제</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
                <div className="bg-[#FAFAFA] rounded-xl px-4 py-3"><div className="text-[11px] text-[#8A8A8A] mb-1">총 경비(2인 추정)</div><div className="text-[16px] font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(first.cost)}</div></div>
                <div className="bg-[#FAFAFA] rounded-xl px-4 py-3"><div className="text-[11px] text-[#8A8A8A] mb-1">항공권(왕복)</div><div className="text-[14px] font-bold">{first.flight || "-"}</div></div>
                <div className="bg-[#FAFAFA] rounded-xl px-4 py-3"><div className="text-[11px] text-[#8A8A8A] mb-1">추천 일정</div><div className="text-[16px] font-bold">{first.days || "-"}</div></div>
                <div className="bg-[#FAFAFA] rounded-xl px-4 py-3"><div className="text-[11px] text-[#8A8A8A] mb-1">추천 시기</div><div className="text-[14px] font-bold">{first.season || "-"}</div></div>
              </div>
              {first.route && (<div className="rounded-xl bg-[#FAFAFA] px-4 py-3.5 mb-3">
                <div className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5">추천 경로</div>
                <p className="text-[14px] text-[#3D3D3D] leading-relaxed">{first.route}</p>
              </div>)}
              {first.booking && (<div className="rounded-xl border border-[#F0F0F0] px-4 py-3.5 mb-4">
                <div className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5">예약 타이밍 팁</div>
                <p className="text-[14px] text-[#3D3D3D] leading-relaxed">{first.booking}</p>
              </div>)}
              <div className="flex gap-4">
                <a href={naverBlog(`${first.place} 신혼여행 후기 경비`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold underline underline-offset-4">실제 후기·경비 검색</a>
                <a href={naverSearch(`${first.place} 항공권 최저가`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">항공권 검색</a>
                <a href={naverSearch(`${first.place} 허니문 패키지`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">패키지 검색</a>
              </div>
            </div>
          </Card>
        </section>) : (
        <Card className="mb-6 text-center !py-5"><span className="text-[14px] text-[#8A8A8A]">별표(★)를 누르면 그 여행지가 1순위로 올라오고 경로·비용·예약 팁이 크게 표시돼요.</span></Card>); })()}
      <div className="masonry">
      {honeymoon.filter(h => !h.star).map(h => (<section key={h.id}>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => starHm(h.id)} title="1순위로 설정" className={h.star ? "text-[#0A0A0A]" : "text-[#D4D4D4] hover:text-[#8A8A8A]"}>
                <Icon name="star" size={18} fill={h.star ? "currentColor" : "none"} />
              </button>
              <div className="text-[16px] font-bold truncate">{h.place}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="text-lg font-bold tracking-tight mr-1" style={{ fontVariantNumeric: "tabular-nums" }}>{manWon(h.cost)}</div>
              <IconBtn name="trash" title="삭제" onClick={() => setHoneymoon(honeymoon.filter(x => x.id !== h.id))} />
            </div>
          </div>
          <div className="mt-1.5 text-[13px] text-[#525252]"><span className="text-[#8A8A8A]">추천 시기</span> {h.season || "-"}</div>
          {h.note && <div className="mt-1 text-[13px] text-[#8A8A8A]">{h.note}</div>}
          {h.route && (<div className="mt-3 rounded-xl bg-[#FAFAFA] px-4 py-3">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#8A8A8A] mb-1.5">추천 경로</div>
            <p className="text-[13px] text-[#3D3D3D] leading-relaxed">{h.route}</p>
          </div>)}
          <a href={naverBlog(`${h.place} 신혼여행 후기 경비`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-[13px] font-semibold underline underline-offset-4">실제 후기·경비 검색 <Icon name="chevron" size={12} /></a>
        </Card>
      </section>))}
      <section>
        <SectionHeader eyebrow="직접 추가" title="후보 추가" />
        <Card>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <TextInput value={newPlace.place} onChange={v => setNewPlace({ ...newPlace, place: v })} placeholder="여행지" />
            <NumInput value={newPlace.cost} onChange={v => setNewPlace({ ...newPlace, cost: v })} />
            <TextInput value={newPlace.season} onChange={v => setNewPlace({ ...newPlace, season: v })} placeholder="추천 시기" />
            <TextInput value={newPlace.note} onChange={v => setNewPlace({ ...newPlace, note: v })} placeholder="메모" />
          </div>
          <textarea value={newPlace.route} onChange={e => setNewPlace({ ...newPlace, route: e.target.value })} placeholder="추천 경로 (선택)" rows={2}
            className="w-full px-2.5 py-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] focus:outline-none focus:bg-white focus:border-[#0A0A0A] resize-y mb-2.5" />
          <button onClick={() => { if (!newPlace.place.trim()) return; setHoneymoon([...honeymoon, { id: uid(), ...newPlace, place: newPlace.place.trim(), star: false }]); setNewPlace({ place: "", cost: 0, season: "", note: "", route: "" }); }}
            className="w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"><Icon name="plus" size={16} /> 추가하기</button>
        </Card>
      </section>
      </div>
    </>)}

    <div className="masonry"><CustomNotes themeId="wedding" /></div>
  </>);
}

/* ============== 홈: 요약 계산 ============== */
function summarizeRealty() {
  const diag = computeDiagnosis(store.get("household-inputs-v2", {}));
  return diag;
}
function summarizeSaving() {
  const accounts = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT);
  return {
    totalBalance: accounts.reduce((s, a) => s + (a.balance || 0), 0),
    totalPaid: accounts.reduce((s, a) => s + (a.paid || 0), 0),
    totalGoal: accounts.reduce((s, a) => s + (a.goal || 0), 0),
  };
}
function summarizeWedding() {
  const info = store.get("wedding-info-v1", { date: "", venue: "" });
  const budget = store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const checklist = store.get("wedding-checklist-v2", null);
  const taskTotal = checklist ? checklist.reduce((s, g) => s + g.items.length, 0) : WEDDING_CHECKLIST_DEFAULT.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist ? checklist.reduce((s, g) => s + g.items.filter(i => i.done).length, 0) : 0;
  return {
    date: info.date, venue: info.venue, d: dday(info.date),
    totalBudget: budget.reduce((s, b) => s + (b.budget || 0), 0),
    totalSpent: budget.reduce((s, b) => s + (b.spent || 0), 0),
    taskTotal, taskDone,
  };
}

/* ============== 테마: 홈 ============== */
function HomeTheme({ setTheme, hh, setHh }) {
  const [alloc, setAlloc] = usePersist("home-alloc-v1", ALLOC_DEFAULT);
  const [milestones, setMilestones] = usePersist("milestones-v1", MILESTONES_DEFAULT);
  const [newMs, setNewMs] = useState({ label: "", date: "" });

  const realty = computeDiagnosis(hh);
  const saving = summarizeSaving();
  const wedding = summarizeWedding();

  const allocated = alloc.realty + alloc.saving + alloc.wedding;
  const free = alloc.totalCash - allocated;
  const over = free < 0;
  const pct = (v) => alloc.totalCash > 0 ? Math.round(v / alloc.totalCash * 100) : 0;
  const segs = THEMES.map(t => ({ id: t.id, label: t.label, value: alloc[t.id], color: t.color }));

  const allMs = [
    ...(wedding.date ? [{ id: "__wedding", label: `결혼식${wedding.venue ? " · " + wedding.venue : ""}`, date: wedding.date, fixed: true }] : []),
    ...milestones,
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const addMs = () => {
    if (!newMs.label.trim() || !newMs.date) return;
    setMilestones([...milestones, { id: uid(), label: newMs.label.trim(), date: newMs.date }]);
    setNewMs({ label: "", date: "" });
  };

  return (<>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
      <Kpi icon="piggy" label="총 현금 자산" value={manWon(alloc.totalCash)} accent="#0A0A0A" />
      <Kpi icon="calc" label={over ? "배분 초과" : "남은 여유자금"} value={over ? "-" + manWon(-free) : manWon(free)} accent="#4B4B4B" />
      <Kpi icon="heart" label="결혼식 D-Day" value={wedding.d === null ? "미정" : ddayText(wedding.d)} accent="#8A8A8A" />
      <Kpi icon="trending" label="절세계좌 잔액" value={manWon(saving.totalBalance)} accent="#C6C6C6" />
    </div>

    <section>
      <SectionHeader eyebrow="Couple Profile" title="우리 부부 정보" />
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-[#F0F0F0]">
          <span className="text-[13px] font-semibold text-[#8A8A8A]">호칭 설정</span>
          <TextInput value={hh.label1 || ""} onChange={v => setHh({ label1: v })} placeholder="본인" className="!w-28" />
          <TextInput value={hh.label2 || ""} onChange={v => setHh({ label2: v })} placeholder="배우자" className="!w-28" />
          <span className="text-[12px] text-[#B0B0B0]">"본인/배우자" 대신 쓸 이름·애칭 — 모든 화면에 반영돼요</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label={`${hh.label1 || "본인"} 연소득(만원)`} value={hh.income1} onChange={v => setHh({ income1: v })} />
          <Field label={`${hh.label2 || "배우자"} 연소득(만원)`} value={hh.income2} onChange={v => setHh({ income2: v })} />
          <Field label="현재 순자산(만원)" value={hh.assets} onChange={v => setHh({ assets: v })} />
          <Field label="월 저축가능액(만원)" value={hh.monthlySave} onChange={v => setHh({ monthlySave: v })} />
          <Field label="기존 대출 월상환(만원)" value={hh.existingDebtMonthly} onChange={v => setHh({ existingDebtMonthly: v })} />
        </div>
        <div className="mt-4 pt-4 border-t border-[#F0F0F0] flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[14px] text-[#8A8A8A]">부부합산 월소득(세전) <b className="text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums" }}>{won(Math.round((hh.income1 + hh.income2) * 10000 / 12))}</b></span>
          <span className="text-[14px] text-[#8A8A8A]">세후 추정 <b className="text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums" }}>{won(Math.round((estimateNetAnnual(hh.income1 * 10000) + estimateNetAnnual(hh.income2 * 10000)) / 12))}</b></span>
          <span className="text-[12px] text-[#B0B0B0] lg:ml-auto">이 값은 부동산 진단 · 대출 · 정책 판정 등 모든 탭에 실시간 반영됩니다</span>
        </div>
      </Card>
    </section>

    <div className="masonry">
    <section>
      <SectionHeader eyebrow="Allocation" title="자금 배분" />
      <Card>
        <div className="p-0">
          <div className="flex gap-[3px] h-3 mb-4">
            {segs.map(s => s.value > 0 && alloc.totalCash > 0 && (
              <div key={s.id} title={`${s.label} ${pct(s.value)}%`} style={{ width: `${Math.min(100, pct(s.value))}%`, background: s.color }} className="h-full rounded-full transition-all" />
            ))}
            <div className="h-full rounded-full bg-[#F0F0F0] flex-1" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] mb-5">
            {segs.map(s => (<span key={s.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: s.color }} />
              <span className="text-[#525252]">{s.label}</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{pct(s.value)}%</b><span className="text-[#8A8A8A]">· {manWon(s.value)}</span>
            </span>))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] inline-block bg-[#F0F0F0] border border-[#E0E0E0]" />
              <span className="text-[#525252]">여유</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{Math.max(0, pct(free))}%</b>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#F0F0F0]">
            <Field label="총 현금(만원)" value={alloc.totalCash} onChange={v => setAlloc({ ...alloc, totalCash: v })} step={1000} />
            <Field label="부동산 배정(만원)" value={alloc.realty} onChange={v => setAlloc({ ...alloc, realty: v })} step={1000} />
            <Field label="돈 모으기 배정(만원)" value={alloc.saving} onChange={v => setAlloc({ ...alloc, saving: v })} step={500} />
            <Field label="결혼식 배정(만원)" value={alloc.wedding} onChange={v => setAlloc({ ...alloc, wedding: v })} step={500} />
          </div>
        </div>
      </Card>
    </section>

    <section>
      <SectionHeader eyebrow="THEMES" title="테마별 현황" />
      <div className="space-y-3">
        {/* 부동산 */}
        <button onClick={() => setTheme("realty")} className="w-full text-left">
          <Card className="hover:border-[#0A0A0A]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "#0A0A0A" }}><Icon name="home" size={17} /></span>
                <div><div className="text-[16px] font-bold">부동산</div><div className="text-[12px] text-[#8A8A8A]">{themeOf("realty").desc}</div></div>
              </div>
              <Icon name="chevron" size={18} className="text-[#8A8A8A]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">목표</div><div className="text-[13px] font-bold truncate">{realty.target.label.split(" · ")[0]} {realty.target.label.includes("84") ? "84㎡" : realty.target.label.includes("59") ? "59㎡" : ""}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">필요 자기자본</div><div className="text-[13px] font-bold">{wonShort(realty.requiredCash)}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">자기자본 갭</div><div className={`text-[13px] font-bold ${realty.gap > 0 ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>{realty.gap > 0 ? wonShort(realty.gap) : "충족"}</div></div>
            </div>
          </Card>
        </button>
        {/* 돈 모으기 */}
        <button onClick={() => setTheme("saving")} className="w-full text-left">
          <Card className="hover:border-[#0A0A0A]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "#6E6E6E" }}><Icon name="trending" size={17} /></span>
                <div><div className="text-[16px] font-bold">돈 모으기</div><div className="text-[12px] text-[#8A8A8A]">{themeOf("saving").desc}</div></div>
              </div>
              <Icon name="chevron" size={18} className="text-[#8A8A8A]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">절세계좌 잔액</div><div className="text-[13px] font-bold">{manWon(saving.totalBalance)}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">올해 납입</div><div className="text-[13px] font-bold">{manWon(saving.totalPaid)}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">연 목표 달성률</div><div className="text-[13px] font-bold text-[#0A0A0A]">{saving.totalGoal > 0 ? Math.round(saving.totalPaid / saving.totalGoal * 100) : 0}%</div></div>
            </div>
          </Card>
        </button>
        {/* 결혼식 */}
        <button onClick={() => setTheme("wedding")} className="w-full text-left">
          <Card className="hover:border-[#0A0A0A]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "#BDBDBD" }}><Icon name="heart" size={17} /></span>
                <div><div className="text-[16px] font-bold">결혼식</div><div className="text-[12px] text-[#8A8A8A]">{themeOf("wedding").desc}</div></div>
              </div>
              <div className="flex items-center gap-2">
                {wedding.d !== null && <span className="font-mono text-[12px] font-semibold text-white px-2.5 py-1 rounded-full bg-[#0A0A0A]">{ddayText(wedding.d)}</span>}
                <Icon name="chevron" size={18} className="text-[#8A8A8A]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">예산</div><div className="text-[13px] font-bold">{manWon(wedding.totalBudget)}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">지출</div><div className="text-[13px] font-bold text-[#0A0A0A]">{manWon(wedding.totalSpent)}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">준비 진행률</div><div className="text-[13px] font-bold">{wedding.taskDone}/{wedding.taskTotal}</div></div>
            </div>
          </Card>
        </button>
      </div>
    </section>

    <section>
      <SectionHeader eyebrow="전체 일정" title="통합 타임라인" />
      <div className="space-y-3">
        {allMs.length === 0 && <Card><div className="text-[14px] text-[#8A8A8A]">등록된 일정이 없어요. 아래에서 추가해 보세요.</div></Card>}
        {allMs.map(m => {
          const n = dday(m.date);
          const past = n !== null && n < 0;
          return (<Card key={m.id} className="!p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${past ? "bg-[#D4D4D4]" : "bg-[#0A0A0A]"}`} />
              <div className="min-w-0">
                <div className={`text-[15px] font-semibold truncate ${past ? "text-[#8A8A8A]" : ""}`}>{m.label}</div>
                <div className="text-[13px] text-[#8A8A8A]">{m.date}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`font-mono text-[12px] font-semibold px-2.5 py-1 rounded-full ${past ? "bg-[#F0F0F0] text-[#9A9A9A]" : "bg-[#0A0A0A] text-white"}`}>{ddayText(n)}</span>
              {!m.fixed && <IconBtn name="trash" title="삭제" onClick={() => setMilestones(milestones.filter(x => x.id !== m.id))} />}
            </div>
          </Card>);
        })}
        <Card>
          <div className="text-[13px] font-semibold text-[#8A8A8A] mb-2.5">일정 추가 <span className="font-normal">(결혼식 날짜는 결혼식 테마에서 설정하면 자동 표시)</span></div>
          <div className="flex gap-2">
            <TextInput value={newMs.label} onChange={v => setNewMs({ ...newMs, label: v })} placeholder="예: 전세 계약 만기" className="flex-1" />
            <input type="date" value={newMs.date} onChange={e => setNewMs({ ...newMs, date: e.target.value })}
              className="h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors" />
            <button onClick={addMs} className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0">추가</button>
          </div>
        </Card>
      </div>
    </section>
    </div>
  </>);
}

/* ============== main app (테마 라우터) ============== */
const NAV = [{ id: "home", label: "홈", icon: "grid", color: "#0A0A0A" }, ...THEMES];

function App({ user }) {
  const [theme, setTheme] = usePersist("active-theme-v1", "home");
  const [mapKey, setMapKey] = useState("");
  const [privacy, setPrivacy] = usePersist("privacy-mode-v1", false); // 금액 블러 (기기별)
  PRIVACY = privacy; // 렌더 전에 갱신 — 이후 그려지는 모든 금액 포맷터에 반영
  const cur = NAV.find(n => n.id === theme) || NAV[0];

  // 네이버 지도 키는 서버 env(NAVER_MAP_KEY) 단일 소스 — /api/config로 받아옴
  useEffect(() => {
    fetch(api("/api/config")).then(r => (r.ok ? r.json() : null)).then(c => {
      if (c && c.naverMapKey) setMapKey(c.naverMapKey);
    }).catch(() => {});
  }, []);

  // 부부 소득·자산 공유 상태 — 어디서 바꾸든 모든 테마에 반영
  const [hh, setHhRaw] = useState(() => ({ ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) }));
  const setHh = (patch) => setHhRaw(p => ({ ...p, ...patch }));
  useEffect(() => {
    const t = setTimeout(() => store.set("household-inputs-v2", hh), 300);
    return () => clearTimeout(t);
  }, [hh]);

  return (<div className={`min-h-screen bg-[#F4F4F5] text-[#0A0A0A] ${privacy ? "privacy-on" : ""}`} style={{ fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-[#0A0A0A] text-white flex-col z-30">
      <div className="px-7 pt-9 pb-10">
        <div className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-white/40">Life Plan · 2026</div>
        <div className="text-[19px] font-bold tracking-tight mt-2">우리 라이프 플랜</div>
      </div>
      <div className="px-4 space-y-1.5 flex-1">
        {NAV.map(t => { const active = theme === t.id; return (
          <button key={t.id} onClick={() => { setTheme(t.id); window.scrollTo({ top: 0 }); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-colors ${active ? "bg-white text-[#0A0A0A] font-bold" : "text-white/50 hover:text-white hover:bg-white/5 font-semibold"}`}>
            <Icon name={t.icon} size={16} />{t.label}
          </button>); })}
      </div>
      <div className="px-4 pb-7">
        <button onClick={() => setPrivacy(!privacy)}
          className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${privacy ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
          <Icon name={privacy ? "eyeOff" : "eye"} size={15} />{privacy ? "금액 블러 해제" : "금액 블러"}
        </button>
        {user && (<div className="flex items-center gap-2.5 px-4 py-3 mb-1 rounded-xl bg-white/5">
          {user.photoURL
            ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" className="w-7 h-7 rounded-full shrink-0" />
            : <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold shrink-0">{(user.email || "?")[0].toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate">{user.displayName || user.email}</div>
            <div className="text-[10px] text-white/35">클라우드 동기화 중</div>
          </div>
          <button onClick={() => firebase.auth().signOut()} className="text-[11px] font-semibold text-white/40 hover:text-white shrink-0">로그아웃</button>
        </div>)}
        <p className="px-4 mt-3 text-[11px] leading-relaxed text-white/25">참고용 시뮬레이션이며 법률·세무·투자 자문이 아닙니다.</p>
      </div>
    </aside>

    <div className="lg:pl-60">
      <header className="px-5 pt-9 pb-1 sm:px-10">
        <div className="max-w-[1160px] mx-auto flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-[#8A8A8A] mb-2 lg:hidden">Life Plan · 2026</div>
            <h1 className="text-[30px] sm:text-[34px] font-bold leading-tight tracking-tight">{theme === "home" ? "우리 라이프 플랜" : cur.label === "부동산" ? "과천 내 집 마련" : cur.label}</h1>
            <p className="mt-1.5 text-[14px] text-[#8A8A8A]">{theme === "home" ? "총 자금 배분 · 테마 요약 · 통합 타임라인" : cur.desc}</p>
          </div>
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <button onClick={() => setPrivacy(!privacy)} title={privacy ? "금액 블러 해제" : "금액 블러"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-colors ${privacy ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"}`}>
              <Icon name={privacy ? "eyeOff" : "eye"} size={17} />
            </button>
            {user && (user.photoURL
              ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" title={user.email + " · 탭하면 로그아웃"} onClick={() => window.confirm("로그아웃할까요?") && firebase.auth().signOut()} className="w-11 h-11 rounded-full border border-[#E5E5E5] cursor-pointer" />
              : <button onClick={() => window.confirm("로그아웃할까요?") && firebase.auth().signOut()} className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-[13px] font-bold">{(user.email || "?")[0].toUpperCase()}</button>)}
          </div>
        </div>
      </header>

      <main className="max-w-[1160px] mx-auto px-5 sm:px-10 py-7 space-y-6">
        {theme === "home" && <HomeTheme setTheme={setTheme} hh={hh} setHh={setHh} />}
        {theme === "realty" && <RealtyTheme mapKey={mapKey} hh={hh} setHh={setHh} setTheme={setTheme} />}
        {theme === "saving" && <SavingTheme hh={hh} />}
        {theme === "wedding" && <WeddingTheme />}
      </main>

      <footer className="text-center text-[12px] text-[#B0B0B0] pb-32 lg:pb-10 px-5 leading-relaxed">본 도구는 참고용 시뮬레이션이며 법률·세무·투자 자문이 아닙니다. 실행 전 은행·세무사·청약 전문가 확인을 권장합니다.</footer>
    </div>

    <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-[#0A0A0A]/95 backdrop-blur px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      {NAV.map(t => { const active = theme === t.id; return (
        <button key={t.id} title={t.label} onClick={() => { setTheme(t.id); window.scrollTo({ top: 0 }); }}
          className={`flex items-center gap-1.5 rounded-full transition-all duration-200 ${active ? "bg-white text-[#0A0A0A] pl-3.5 pr-4 py-2.5 text-[13px] font-bold" : "text-white/50 hover:text-white p-2.5"}`}>
          <Icon name={t.icon} size={17} />{active && <span className="whitespace-nowrap">{t.label}</span>}
        </button>); })}
    </nav>
  </div>);
}

/* ============== 인증 게이트 (Firebase 설정 시에만 활성) ============== */
function useAuth() {
  const [auth, setAuth] = useState({ status: cloud.enabled ? "loading" : "local", user: null });
  useEffect(() => {
    if (!cloud.enabled) return;
    cloud.init();
    return firebase.auth().onAuthStateChanged(async (u) => {
      cloud.user = u;
      if (!u) { setAuth({ status: "signedout", user: null }); return; }
      const allowed = !window.ALLOWED_EMAILS || window.ALLOWED_EMAILS.includes(u.email);
      if (!allowed) { setAuth({ status: "denied", user: u }); return; }
      await cloud.pullOnce();
      setAuth({ status: "ok", user: u });
    });
  }, []);
  return auth;
}
function AuthShell({ children }) {
  return (<div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-6" style={{ fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
    <div className="bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-20px_rgba(0,0,0,0.2)] p-9 w-full max-w-sm text-center">
      {children}
    </div>
  </div>);
}
function LoginScreen() {
  const [err, setErr] = useState("");
  const login = () => {
    setErr("");
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => setErr(e && e.message));
  };
  return (<AuthShell>
    <div className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-[#8A8A8A]">Life Plan · 2026</div>
    <h1 className="text-2xl font-bold tracking-tight mt-2 mb-1.5">우리 라이프 플랜</h1>
    <p className="text-[14px] text-[#8A8A8A] mb-7">허용된 계정만 접근할 수 있어요.</p>
    <button onClick={login} className="w-full h-12 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-2.5">
      <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" opacity=".7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" opacity=".5" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" opacity=".85" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Google로 로그인
    </button>
    {err && <p className="mt-4 text-[12px] text-[#525252] bg-[#F5F5F5] rounded-lg px-3 py-2 break-all">{err}</p>}
  </AuthShell>);
}
function DeniedScreen({ user }) {
  return (<AuthShell>
    <div className="w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mx-auto mb-4"><Icon name="alert" size={22} /></div>
    <h1 className="text-xl font-bold tracking-tight mb-1.5">접근 권한이 없어요</h1>
    <p className="text-[14px] text-[#8A8A8A] mb-1 break-all">{user && user.email}</p>
    <p className="text-[13px] text-[#8A8A8A] mb-6 leading-relaxed">이 계정은 허용 목록에 없습니다. 관리자에게 <code className="font-mono text-[11px] bg-[#F5F5F5] px-1 rounded">firebase-config.js</code>의 ALLOWED_EMAILS 추가를 요청하세요.</p>
    <button onClick={() => firebase.auth().signOut()} className="w-full h-11 rounded-xl border border-[#E5E5E5] font-semibold text-[#525252]">다른 계정으로 로그인</button>
  </AuthShell>);
}
function Root() {
  const auth = useAuth();
  const [syncVer, setSyncVer] = useState(0);
  useEffect(() => {
    if (auth.status !== "ok") return;
    return cloud.subscribe(() => setSyncVer(v => v + 1)); // 상대방이 바꾸면 최신값으로 다시 그림
  }, [auth.status]);
  if (auth.status === "loading") return (<AuthShell><div className="text-[14px] text-[#8A8A8A] py-6">로그인 확인 중…</div></AuthShell>);
  if (auth.status === "signedout") return <LoginScreen />;
  if (auth.status === "denied") return <DeniedScreen user={auth.user} />;
  return <App key={syncVer} user={auth.user} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
