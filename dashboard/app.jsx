const { useState, useEffect, useRef, useMemo } = React;

/* ============== helpers ============== */
const won = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "-";
  const eok = Math.floor(n / 100000000);
  const man = Math.round((n % 100000000) / 10000);
  if (eok > 0) return `${eok.toLocaleString()}억${man > 0 ? " " + man.toLocaleString() + "만" : ""}`;
  return `${man.toLocaleString()}만원`;
};
const wonShort = (n) => (n === null || n === undefined ? "확인 필요" : (n / 100000000).toFixed(1) + "억");
const manWon = (n) => won((n || 0) * 10000);
const wonRaw = won, wonShortRaw = wonShort; // 하위 호환 별칭
// 부부 정보 블러 — 소득·자산 등 부부 정보에만 적용 (on=true일 때 실제 CSS blur)
function Blur({ on, children }) {
  return on ? <span className="money-blur" aria-hidden="true">{children}</span> : <>{children}</>;
}

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
const LOCAL_ONLY_KEYS = ["active-theme-v1", "realty-tab-v1", "saving-tab-v1", "wedding-tab-v1", "kids-tab-v1", "naver-map-key", "privacy-mode-v1", "roadmap-view-v1"]; // 기기별로 다른 게 자연스러운 값
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

// 로딩 중 다른 탭으로 이동해도 fetch가 끊기지 않도록 모듈 레벨에 진행 중 프로미스와 결과를 보존 —
// 돌아오면 완료된 결과를 즉시 재사용하고, 새로고침 버튼(force)일 때만 다시 요청한다.
const fetchMemo = {};
function memoLoad(key, fn, force) {
  if (force || !fetchMemo[key]) {
    fetchMemo[key] = fn().then((r) => {
      if (!r || r.source === "sample") fetchMemo[key] = null; // 샘플 폴백은 캐시하지 않음 — 다음 방문 때 라이브 재시도
      return r;
    }).catch((e) => { fetchMemo[key] = null; throw e; });
  }
  return fetchMemo[key];
}
function loadCheongyak(force) {
  return memoLoad("cheongyak", async () => {
    try {
      const r = await fetch(api("/api/cheongyak"));
      if (r.ok) { const j = await r.json(); if (j.items && j.items.length) return { source: "live", items: j.items }; }
    } catch {}
    return { source: "sample", items: (window.SAMPLE_DATA || {}).cheongyak || [] };
  }, force);
}
function loadRealty(force) {
  return memoLoad("realty", async () => {
    try {
      const r = await fetch(api("/api/realty")); // 국토부 실거래가(공식) 우선, 서버가 네이버 폴백까지 처리
      if (r.ok) { const j = await r.json(); if (j.items && j.items.length) return { source: "live", kind: j.kind, items: j.items }; }
    } catch {}
    return { source: "sample", items: (window.SAMPLE_DATA || {}).realty || [] };
  }, force);
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
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`;
    s.onload = () => resolve();
    s.onerror = () => { naverPromise = null; reject(new Error("load_failed")); };
    document.head.appendChild(s);
  });
  return naverPromise;
}

// 주소 → 좌표 (네이버 지오코더 서브모듈). 청약홈 API는 좌표를 안 주므로 카드 클릭 시 주소로 변환.
const geoCache = {};
function geocodeAddr(addr) {
  return new Promise((resolve) => {
    if (!addr || !(window.naver && naver.maps && naver.maps.Service && naver.maps.Service.geocode)) return resolve(null);
    if (geoCache[addr]) return resolve(geoCache[addr]);
    try {
      naver.maps.Service.geocode({ query: addr }, (status, res) => {
        const a = res && res.v2 && res.v2.addresses && res.v2.addresses[0];
        const c = a ? { lat: Number(a.y), lng: Number(a.x) } : null;
        if (c) geoCache[addr] = c;
        resolve(c);
      });
    } catch { resolve(null); }
  });
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
  child: <><circle cx="12" cy="6.5" r="3.5"/><path d="M6 21c.6-4.2 3-6.8 6-6.8s5.4 2.6 6 6.8"/></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
  brush: <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  wallet: <><rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></>,
};
function Icon({ name, size = 16, className = "", fill = "none" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

/* ============== themes ============== */
const THEMES = [
  { id: "realty", label: "부동산", icon: "home", color: "#0A0A0A", desc: "진단 · 전략 · 대출 · 청약 · 매물지도" },
  { id: "saving", label: "돈 모으기", icon: "trending", color: "#6E6E6E", desc: "ISA · 연금저축 · IRP · 증여 절세" },
  { id: "wedding", label: "결혼식", icon: "heart", color: "#BDBDBD", desc: "예식 비용 · 체크리스트 · 신혼여행" },
  { id: "kids", label: "자녀", icon: "child", color: "#8F8F8F", desc: "연령별 할 일 · 교육 로드맵 · 학군" },
];
const themeOf = (id) => THEMES.find(t => t.id === id);

/* ============== data constants (부동산 테마) ============== */
const REALTY_TABS = [
  { id: "overview", label: "요약", icon: "grid" },
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
  { name: "아펠가모 광화문", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTAxMjNfMTI5%2FMDAxNzM3NjMyNjg1NTA2.2okgXjzK5zsWfKCrzn5a69RrEJ_sBWIOUtGHllln60Mg.Ks29fMqvoWBdJ6cL2z7T0jBCFv464zCl0vJMf-Ga-N4g.JPEG%2F44.jpg&type=sc960_832", area: "종로구", type: "컨벤션", meal: "6~8.5만", fee: "220~770만", cap: "200~400명", note: "도심 접근성 + 검증된 식사 퀄리티 — 직장인 하객 선호 1순위급" },
  { name: "아펠가모 선릉", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxNzA4MTdfMjc5%2FMDAxNTAyOTQ0MTc2OTQ3.O1CXvhxHfz1-oaQBez24jo7WMeLVbX4def1ZXw3eVCcg.o2OfzeS0z9h4S21iWxFkiFNuMOu3d93425Cm-UyFvy0g.JPEG.daewoo7749%2F201781120442958008.jpg&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7~9만", fee: "500~800만", cap: "250~450명", note: "강남권 아펠가모 — 식사 퀄리티 안정적, 회사 하객 접근성 좋음" },
  { name: "더컨벤션 반포", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTAyMjJfMjcg%2FMDAxNzQwMjIwMjQzMjMw.MzKbjMeJwRXRm8aCYyVLWEdD8UP1eS6r5UzvyBH-XyQg.B4f0Lo0jJAVRLXgLS428NWr9YdpXP4eFYsIl7920H8Eg.JPEG%2Foutput_3039599856.jpg&type=sc960_832", area: "서초구", type: "컨벤션", meal: "6.5~8만", fee: "300~600만", cap: "250~500명", note: "고속터미널 직결 — 가성비·접근성으로 재방문 하객 평 좋은 대표 컨벤션" },
  { name: "상록아트홀", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDA3MjdfMTU2%2FMDAxNTk1ODMwMDY1MTkw.nsBAmrvVa01DS8UpimStV88ftveXv-wCPTG7YuSmczsg.pWsENB5NUnKFd0WwMU6yJHZqCN93bzluFB29cEVzSqsg.JPEG.secondphoto%2F200516_%25B9%25DA%25B0%25E6%25B9%25CC%25BD%25C5%25BA%25CE%25B4%25D4_2293.jpg&amp;type=f54_54&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7.5~9.5만", fee: "500~900만", cap: "200~600명", note: "선릉역 인접 · 호텔급 홀 컨디션 — 공무원연금공단 운영으로 거품 없는 가격" },
  { name: "더채플앳청담", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20131217_159%2Fwjdtjstnrzz_1387261489537W9t4O_JPEG%2F2013-12-17_15%253B06%253B28.jpg&type=sc960_832", area: "강남구", type: "채플", meal: "8.5~11만", fee: "750~980만", cap: "250~400명", note: "12m 아치형 천고 채플홀 — 채플웨딩 대표 베뉴, 예약 경쟁 치열" },
  { name: "더채플앳논현", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDEwMjFfNzYg%2FMDAxNjAzMjU0MTU5ODAy.HF5w3ThEFZn7LmrSpYLvB5S6QNtq6zwJRbEkBJTGJvkg.iaoDVH153EkWENUHdkmXlwVdncRQ7e4ZUC9mfbn0sxUg.PNG.jassica9411%2Fimage.png&type=sc960_832", area: "강남구", type: "채플", meal: "8~10만", fee: "600~850만", cap: "200~350명", note: "청담 대비 합리적인 채플 — 밝은 채광 홀, 직장인 커플 계약 많음" },
  { name: "소노펠리체 컨벤션", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDEyMDlfMjE5%2FMDAxNzMzNzMyMDc3NTMy.EVRl3qGgxYcfO-ujsUJ2HAnmFap35ceP9PG-JsgHNWog.BoeoeEYz6T038EUQ1zQXzCIAePfDkt6_VmtYf9wE0_Mg.JPEG%2Fheart-ged753d154_6400202251.jpg&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7.2~9.5만", fee: "800만", cap: "350~800명", note: "삼성역 직결 + '미녀와야수 계단' 로비 — 대규모 하객 수용 강점" },
  { name: "루이비스컨벤션 중구점", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MDVfMjIw%2FMDAxNzU0MzU4NjMzMzgz.6ykx-yHafIoaN9nFHIE5ltdnEhq_cNDtT-j2EN0Zcd8g.auLAT8pDvSwO7MC3oyGrN-PuSHAnCcaNp3ylxttle1Qg.JPEG%2Fsection1%25A3%25DF06.jpg&type=sc960_832", area: "중구", type: "컨벤션", meal: "8.5만 내외", fee: "850만", cap: "200~500명", note: "호텔급 인테리어 단독홀 — 1시간 10분 여유 예식으로 인기" },
  { name: "세빛섬 플로팅아일랜드", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fcafefiles.naver.net%2F20150214_154%2Ffloatingi_1423882231612Eq88k_JPEG%2FIMG_8653.JPG&type=sc960_832", area: "서초구", type: "컨벤션", meal: "6~12만", fee: "200~500만", cap: "100~400명", note: "반포 한강 위 인공섬 — 화이트 돔 + 한강 뷰 이색 베뉴, 야외·루프톱 가능" },
  { name: "노블발렌티 대치", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMDJfMTIy%2FMDAxNjA0MzAzNDcxNDM4.Y3XjKyKUFdCnMx76E6-DQutMxxfU7MQqhvPba_PT0e8g.zlEC5Jr-2dZ7AiGW714PLrdf_O4UgFCJ3Vwh2EK0g_8g.JPEG.nazgreling%2FIMG00310.jpg&type=sc960_832", area: "강남구", type: "하우스", meal: "10~12만", fee: "700~1,000만", cap: "200~400명", note: "하우스웨딩 입문 대표 — 호텔 느낌 연출 대비 합리적, 주말 골든타임 조기 마감" },
];
// 식장 썸네일 — 사진 URL이 없으면 유형별 그라데이션 플레이스홀더 표시
const VENUE_THUMB = {
  호텔: "linear-gradient(135deg,#2E2E2E,#5A5A5A)",
  하우스: "linear-gradient(135deg,#6E6E6E,#9C9C9C)",
  채플: "linear-gradient(135deg,#8C8C8C,#C4C4C4)",
  컨벤션: "linear-gradient(135deg,#474747,#7A7A7A)",
  기타: "linear-gradient(135deg,#808080,#ABABAB)",
};

// 스드메(스튜디오·드레스·메이크업) 인기 업체 — 시작 리스트는 대표 업체 일부 예시.
// 가격은 시즌·구성마다 크게 달라 "최신 정보로 갱신"(웹 리서치) 또는 견적 상담으로 확인.
// 대표 사진은 네이버 검색 썸네일(컨셉 참고용) — 로드 실패 시 자동으로 플레이스홀더 표시
const WEDDING_VENDORS = {
  studio: { label: "인기 스튜디오", topic: "studios", q: "웨딩 스튜디오", items: [
    { name: "어도러블 스냅", area: "서울", price: "견적 상담", note: "필름·빈티지 무드의 화제 스냅팀 — 인스타 팔로워 9만+ (@adorable_snap)", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDEyMjlfMTg3%2FMDAxNzM1NDg0MjI2MTAz.kKRMriOqo9SHccadzn0_q_ULrtf_8EW3Q1BAx0TEHucg.PJueGNSvoFuc9Nv14f5cX-QrSAqXy32QQM-Fr-CWdmUg.JPEG%2F3472562348789846328_20240419153500016.JPG&type=sc960_832" },
    { name: "리저브하우스", area: "강남권", price: "견적 상담", note: "화보 감성 웨딩 촬영 — 인스타에서 유명 (@reserve_studio)", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA2MDFfMjA1%2FMDAxNjIyNDgzNzkxMzA3.39EXG4vPS_QpXk5GQG1kJSebMdxlPxB9Wc1k5aSYQMMg.EYmkDhMWVfY4Dj3smZEtPNEkWo9lqvCD15sRBMP1LKUg.JPEG.jaejae0120%2FKakaoTalk_20210515_101526614_23.jpg&type=sc960_832" },
    { name: "디하우스스튜디오", area: "서울", price: "견적 상담", note: "'공간이 무드를 만든다' — 자연 채광·야외 정원, 인스타 감성 (@d_haus_st)", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDEwMDJfMzMg%2FMDAxNzI3ODM2MzExNjkx.CWraq7NBnPWBbufj0panTRH_PycIbY6Muw9ZS91x1Mog.ewQj3Bbzv40ug6H2poDVDLAfvWtkTlydAty74JD7Wzog.JPEG%2F%25B5%25F0%25C7%25CF%25BF%25EC%25BD%25BA_06.jpg&type=sc960_832" },
    { name: "아르센스튜디오", area: "서울", price: "견적 상담", note: "밝고 자연스러운 인스타 감성 스냅 (@arsen__studio)", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA4MDRfMTMx%2FMDAxNjkxMTE3MjE3ODI2.3ilwbIK1jnpx-XHOKbVvUE2jGcHmS5ONju7Wf1-3pCcg.B9_Wda4vB3BRi48iVhP-3sVVupfR1OudTFRXLgQLqvQg.JPEG.wedding2022%2F%25BE%25C6%25B8%25A3%25BC%25BE_%25BD%25BA%25C6%25A9%25B5%25F0%25BF%25C0_%25C8%25AD%25BA%25B8_101.jpg&type=sc960_832" },
    { name: "노트르씬", area: "서울", price: "견적 상담", note: "잡지 화보식 디렉팅 — 인스타·스레드 조회수 13만 화제 (@notre_scene)", img: "" },
    { name: "원규스튜디오", area: "강남권", price: "견적 상담", note: "연예인 웨딩화보로 유명한 프리미엄 인물 중심 스튜디오 — 예약 경쟁 치열", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzAxMTFfODIg%2FMDAxNjczNDQ1OTc5MTA3.r15JUPBCQcLufVmc8JIfJbXe1BGP03OcSVx4yaDWHB0g.3hTKY1FqORoKYcLaCvEHqGj2wfitix8f6YBTm7qPzVgg.JPEG.thegreendirecting%2FIMG_4422.JPG&type=sc960_832" },
    { name: "피아스튜디오", area: "서울", price: "견적 상담", note: "유행을 덜 타는 스타일 — 시간이 지나도 촌스럽지 않은 컷으로 인기", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDAyMTVfMTgy%2FMDAxNzA3OTU4NjUzMDk2.pLA0GhuBt0iVvcKK2O6qVi7WaXyusj3wE6Y66QTiv6Qg.hVOuaBkknYaxoI5wLSAZydYBPOYSCh1BXdY9PM6WQOYg.JPEG.the_grain%2Fthumb-259d2478335df71ae328731fc4a5e032_1672893829_3436_835x1169.jpg&type=sc960_832" },
    { name: "더브라이드", area: "서울", price: "견적 상담", note: "웨딩 전용 세트 — 한옥·야외 등 배경 다양, 배경 중심 대표 스튜디오", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTAzMDdfMTAx%2FMDAxNjE1MDkwMjcxNDU2.XzuLev7CPHsfASQSmfv0-ZW0p5oZ0aiS2dPhs2jZacUg.ySDDIliy1kkIZUp5BL9fLVS6RjvpR1MhzQmAFIwkUG4g.PNG.rachelwedding%2F%25BD%25BA%25C5%25A9%25B8%25B0%25BC%25A6_2021-03-07_%25BF%25C0%25C8%25C4_12.34.52.png&type=sc960_832" },
    { name: "바시움스튜디오", area: "서울", price: "견적 상담", note: "깔끔하고 심플한 인물 위주 촬영 — 군더더기 없는 스타일 선호 커플에 인기", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDEwMjBfMTc2%2FMDAxNjAzMTk1MDE0NTk2.9TGI-72OsnaO4s2-gB5lZhktJ5Tfz8P3o9cNSORF_4Ig.8DacduuPh5nXsJy0n6H78xBabWk2_Lp1dct9dKwuwCYg.JPEG.le_wedding%2FIMG_8606.JPG&type=sc960_832" },
    { name: "타주스튜디오", area: "강남권", price: "견적 상담", note: "밝고 자연스러운 분위기 — 스드메 패키지 단골 구성", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA5MjZfMTgy%2FMDAxNjY0MTczMDM1Mzk1.A1BxIIFwb407UiH-Kr2JfBBjEmZVhbecmHbzqdmlYZQg.SRSwQwIpqwiCqCi15choPCJXCv-cSKWArkWyhorsjVQg.JPEG.milkclean%2FLCW_1089-2.jpg&type=sc960_832" },
  ]},
  dress: { label: "인기 드레스", topic: "dresses", q: "웨딩드레스", items: [
    { name: "로자스포사", area: "청담", price: "견적 상담", note: "국내 대표 프리미엄 드레스 브랜드 — 클래식·볼륨 라인 강점", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA4MDhfNjAg%2FMDAxNjI4NDAyMzk3MTk1.Nz3hqbfZguHQBVz-Sav_xVB2vVV6WFtqgl_5KA7xxfog.fgdV_b-jKBgGWUM4WFcgluqAN62GTTrrDhot-Vi9ghYg.JPEG.deblanc17%2FKakaoTalk_20210808_095354626_%25281%2529.jpg&type=sc960_832" },
    { name: "제시카로렌", area: "청담", price: "견적 상담", note: "모던·미니멀 실루엣으로 인기 — 피팅 예약 조기 마감", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDAyMTNfMTUz%2FMDAxNzA3ODMyOTA5OTcy.Gw7l2yrF8e209n9t5qzWG3o3gwhPURTVUrilG7x7rSUg.CNdOubEKEeRhmdc-ZpVrp4hv3ZRl-ggBvmNTCWjsqGQg.PNG.netpage%2F20240213225849.png&type=sc960_832" },
    { name: "브라이드메르시", area: "청담", price: "견적 상담", note: "합리적 가격대의 감성 드레스로 후기 많은 샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA4MTRfMjI5%2FMDAxNjkxOTg5ODYzNzYw.dcUX9E24cAO01hBnAOMex89KSd0s0Fl7M0-wNwZ1T-sg.24Iu3C5YidwYE5A5VSoeIrwQqQLN_DUQQSVhb3xDU5Ug.JPEG.modern_franc%2FKakaoTalk_20230714_163703565_16.jpg&type=sc960_832" },
    { name: "로즈로사", area: "청담", price: "견적 상담", note: "사랑스럽고 로맨틱한 스타일 전문 드레스샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjRfMjUy%2FMDAxNjUzMzUxMjAzNDU3.fdpxQxqx2OY5btZjsUU12AOrTtw70qQYpBrzuWbJM4Ig.Li1WvCsbklLHjlMzestTppg15c0UN5xWAsUQagNVX6Qg.JPEG.smile_0117%2FIMG_1271.JPG&type=sc960_832" },
    { name: "에스메랄다", area: "강남권", price: "견적 상담", note: "스드메 패키지 단골 구성 — 다양한 라인 보유", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxOTEyMTJfMjEw%2FMDAxNTc2MTQzNTg3Mjc4.PewT_yT8yWAUsqSYkUbfmQw4BYo_AXEEtYNU8kyCEOUg.I8spYM5osSTvj3FHfAPiF8qgGqzVs2rFsTwBgJdpqRwg.JPEG.kwonhsp%2FCHIMAMANDA-C.jpg&type=sc960_832" },
    { name: "마틴드세븐", area: "강남권", price: "견적 상담", note: "화려한 비즈·레이스 디테일 — 패키지 인기 드레스샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDlfMjk4%2FMDAxNjE3OTUxMjI2Njkz.IrtwOOSbpwyvVD66S1sT6cS49o6PKwault94IRaVlKog.PJANvQ-MLIYtAmBkqTPXtAKPECQ2Y-6_-IguahHrMYMg.JPEG.with_iwedding%2F%25B8%25B6%25C6%25BE%25B5%25E510_%25282%2529.JPG&type=sc960_832" },
    { name: "메종레브", area: "청담", price: "견적 상담", note: "오뜨꾸튀르·럭셔리 맞춤 — 1:1 컨설팅과 프라이빗 피팅룸", img: "" },
    { name: "플로렌스", area: "청담", price: "견적 상담", note: "고급 실크·자수 디테일 — 신부 체형을 살리는 디자인", img: "" },
  ]},
  makeup: { label: "인기 메이크업", topic: "makeup", q: "웨딩 메이크업", items: [
    { name: "겐그레아 (CENCHREA)", area: "청담", price: "견적 상담", note: "리정 등 아티스트가 찾는 개성·세련 웨딩룩 — 인스타에서 화제", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA1MjBfNjgg%2FMDAxNjIxNDkxODcxMDUy.s7-_8OI3dm8bGmp8Z7dy9jttdFwTgERE32Oqznnf5H8g.ygvRqlgnFFuToIVBqbPcC7vxCIH_fxWMDS0ZkoT4zH4g.JPEG.gpwlsrhdwn03%2F13.jpg&type=sc960_832" },
    { name: "알루 (ALUU)", area: "청담", price: "견적 상담", note: "몽환적이고 감성적인 연출 — 인스타 감성 메이크업 대표 샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA1MTdfOTUg%2FMDAxNjIxMjE0Nzc3NDk2.i7aCWWqPwQFjGX99YcprczGmuB9YnsZkoP-ggrJm_iUg.U8hKgFkXlXrtClFZXID-UXeX_4jG23pMtpi48rh-s6og.JPEG.subinlee96%2FDSC04917.JPG&type=sc960_832" },
    { name: "조이187", area: "청담", price: "견적 상담", note: "감각적·트렌디한 스타일링 — 인스타에서 인기, 개성 있는 웨딩 선호층 추천", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA2MTNfMTU3%2FMDAxNjIzNTk0NTQ1MTM3.ibVKr9Gw9H4jimLk2qMBWTBala_ufKKNB5SGzVLVzEcg.iQ0u2QsHe0al1KOGtWxgFtOP3VpR10ejedNYl1eExNUg.JPEG.jhj9437%2Fjoy187_2021_%25BF%25FE%25B5%25F9%25C8%25AD%25BA%25B8_7_.jpg.jpg&type=sc960_832" },
    { name: "밈 (MIMM)", area: "강남권", price: "견적 상담", note: "섬세한 피부 표현과 입체감 — 도시적이고 세련된 무드, 인스타 감성", img: "" },
    { name: "애브뉴준오", area: "청담", price: "견적 상담", note: "자연스러운 스타일링으로 유명 — 준오 계열 웨딩 대표 샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA3MjdfNjYg%2FMDAxNzUzNTk0NjE4Mjky.ytH76qFzwCAVl3xV-yby82KfS3SmDqh6i0P2o5GRmDAg.8_BAkUkCUFb0uiMAW21l1ldnvH5PhxIQlSQva2u7Kn4g.JPEG%2FIMG%25A3%25DF7653.JPG&type=sc960_832" },
    { name: "김청경 헤어페이스", area: "청담", price: "견적 상담", note: "단아하고 고급스러운 스타일 — 얼굴형 맞춤 커스터마이징", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA5MjBfMjA0%2FMDAxNjk1MTc3Njk0OTYw.fr5qgsuzaV2_xOSMeXPuJnQOPgtY26_By7bFx6x2vpsg.RgoHEDz6cYKdLdv0sDHgfhBYMFZVHcTlPWE9E9-5SmIg.PNG.duer_%2Fimage.png&type=sc960_832" },
    { name: "정샘물 인스피레이션", area: "청담", price: "견적 상담", note: "내추럴 피부 표현의 대명사 — 신부 메이크업 대표 샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5472%2F2020%2F02%2F04%2F0000045293_001_20200204150021670.jpg&type=sc960_832" },
    { name: "김활란 뮤제네프", area: "청담", price: "견적 상담", note: "전통의 웨딩 헤어·메이크업 명가 — 우아한 스타일", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxODA4MTBfMTI4%2FMDAxNTMzODk0MzQ4OTI5.pjLizJ1Q4lZq0iUMm-8uS8JrCI9hukcLLQ4I6MK9eN4g.yDqjXcj1rnglUq9kWiSXF3pCkwXbFU-OJ95Tf5AZkcIg.JPEG.planner_jyj%2F16.jpg&type=sc960_832" },
    { name: "제니하우스 청담", area: "청담", price: "견적 상담", note: "연예인 단골 토탈 뷰티 살롱 — 지점·디자이너별 편차 확인", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA0MTBfMjQ2%2FMDAxNzc1ODEyMzY1OTEx.CsjVOYcjTdNrQxBzQCjR6X2CXFOhKitJn_Qfmg8eE9kg.pOoihFJSasKiZzwAI8rvV9ds57lE6dQYJY2B51caO8Eg.PNG%2Fimage.png&type=sc960_832" },
    { name: "순수 (SOONSOO)", area: "청담", price: "견적 상담", note: "세련된 헤어 스타일링으로 인기 — 본식 새벽 타임 조기 마감", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDA3MTVfMjQ1%2FMDAxNTk0ODE4ODUxNTk3.mvksOBKJxCLYlnFKV3lnkR6YqK_OwbQhz8Blsy8qLWog.WMKBg1TmP4rcWmcxsSbHGNqqqOSkxLoQC-s807QpvfEg.JPEG.donggeon222%2FIMG_7887.JPG&type=sc960_832" },
  ]},
};
// 스드메 썸네일 — 사진 URL이 없으면 종류별 그라데이션 플레이스홀더 표시
const VENDOR_THUMB = {
  studio: "linear-gradient(135deg,#2E2E2E,#5A5A5A)",
  dress: "linear-gradient(135deg,#8C8C8C,#C4C4C4)",
  makeup: "linear-gradient(135deg,#6E6E6E,#9C9C9C)",
};

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
  { id: "h7", place: "이탈리아 단독", cost: 950, season: "5~6월 · 9~10월", note: "관광+미식 집중 · 스위스 대비 -350만", star: false, flight: "1인 90~140만 (직항/1회 경유)", days: "8박 10일",
    route: "인천 → 로마 in (2박, 바티칸·콜로세움) → 피렌체 2박(우피치·토스카나 근교) → 아말피/포지타노 2박(해안 드라이브) → 베네치아 2박(곤돌라·부라노) → 로마 or 베네치아 out",
    booking: "5~6월·9~10월이 날씨·가격 최적, 7~8월 남부는 폭염·성수기라 비추. 도시 간 고속열차(이탈로/트렌이탈리아)는 조기 발권 시 반값. 아말피 숙소는 3~4개월 전 마감" },
  { id: "h8", place: "스위스 단독", cost: 1250, season: "6~9월 (하이킹 최적)", note: "대자연 집중 · 물가 높음 주의", star: false, flight: "1인 110~150만 (취리히 직항)", days: "7박 9일",
    route: "인천 → 취리히 in → 루체른 1박(카펠교·리기산) → 인터라켄/그린델발트 3박(융프라우요흐·피르스트) → 체르마트 2박(고르너그라트·마테호른) → 몬트뢰 or 취리히 1박 out",
    booking: "스위스 트래블패스는 출발 전 온라인 구매(산악열차 25~50% 할인). 융프라우 VIP패스는 한국 여행사 특가 비교. 물가가 높아 조식 포함(하프보드) 숙소가 유리, 산악 일정은 날씨 보고 전날 확정" },
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

/* ============== data constants (자녀 테마) ============== */
// 2026 제도 기준 리서치 — 시기·금액은 변경될 수 있으니 신청 전 공식 안내 확인
const KIDS_CHECKLIST_DEFAULT = [
  { cat: "임신 준비", items: [
    "보건소 무료 산전검사 (부부 모두 — 풍진·엽산 포함)",
    "난임·임신 지원 정책 확인 (지자체별 상이)",
    "신생아 특공·신생아 특례대출 요건 미리 확인 (소득·주택가격 상한)",
    "태아보험 견적 비교 (임신 확인 직후 가입이 조건 유리)",
    "출산휴가·육아휴직 일정 회사와 사전 협의" ] },
  { cat: "임신 중", items: [
    "임신·출산 진료비 바우처 신청 (국민행복카드 100만원)",
    "산부인과 정기검진 일정 캘린더 등록",
    "산후조리원 예약 — 인기 지역은 임신 초기에 마감",
    "아기용품 리스트 작성 (중고·물려받기 먼저 확인)",
    "어린이집 입소대기 등록 가능 여부 확인 (일부 지자체 임신 중 가능)" ] },
  { cat: "출생 ~ 6개월", items: [
    "출생신고 (1개월 내) + 첫만남이용권(200만원) 신청",
    "부모급여 신청 (0세 월 100만 · 1세 월 50만)",
    "아동수당 신청 (월 10만원, 만 8세까지)",
    "예방접종 일정 등록 (BCG·B형간염 등 — 질병청 앱)",
    "영유아 건강검진 주기 등록",
    "어린이집 입소대기 등록 (인기 국공립은 1~2년 대기)" ] },
  { cat: "6개월 ~ 3세", items: [
    "부모급여 → 양육수당/보육료 전환 확인 (어린이집 이용 여부에 따라)",
    "어린이집 적응 프로그램 계획",
    "영유아 발달 체크 (검진 시기마다)",
    "양가 돌봄·아이돌봄서비스 등 보육 공백 대책" ] },
  { cat: "4~5세 (유아)", items: [
    "유치원 vs 어린이집 결정 (유아학비·보육료 지원 비교)",
    "'처음학교로' 유치원 입학 신청 (매년 11월 추첨)",
    "사교육 방향 부부 합의 (시작 시기·예산 상한)" ] },
  { cat: "초등 이후", items: [
    "취학통지서 확인 (입학 전해 12월) 및 예비소집",
    "늘봄학교·돌봄교실 신청 (맞벌이 필수 체크)",
    "학군지 이사 여부 결정 — 내 집 마련 입주 시점과 연계",
    "교육비 장기 적립 시작 (절세계좌 활용)" ] },
];
// 연령·학령별 상세 로드맵 — 탭별로 나눠서 표시
const KIDS_EDU_STAGES = {
  infant: { label: "영유아 (0~5세)", intro: "출생 직후 서류·수당부터 취학 준비까지 — 영유아기는 신청 시기를 놓치면 손해가 큰 구간이에요.", cards: [
    { age: "0~12개월", timing: "출생 직후 서류·수당 신청 러시", points: ["출생신고(1개월 내) + 첫만남이용권 200만원", "부모급여 월 100만(0세) · 아동수당 월 10만 동시 신청", "예방접종 스케줄 등록 (4주 내 BCG·B형간염 2차)", "영유아 건강검진 1차(14~35일)부터 주기 관리", "어린이집 입소대기 등록 — 국공립은 1~2년 대기"], q: "신생아 지원금 신청 순서" },
    { age: "1~2세", timing: "가정보육 vs 어린이집 결정", points: ["부모급여 1세 월 50만 → 이후 양육수당/보육료 전환", "3월 입소가 대부분 — 전해 11~12월에 대기 확정 연락", "어린이집 적응 기간(1~2주) 부모 일정 확보", "18~24개월 언어 발달 체크 (영유아검진 문진 활용)"], q: "어린이집 첫 입소 적응" },
    { age: "3~4세 (유아 전환)", timing: "유치원 전환 검토 시작", points: ["누리과정 지원 시작(만 3세) — 유아학비/보육료 비교", "어린이집 유아반 vs 유치원: 교육과정·하원시간·방학 비교", "'처음학교로' 일정 미리 파악 (매년 11월 신청·추첨)", "가정학습 방향 부부 합의 (한글·수 놀이 수준)"], q: "유치원 어린이집 차이 선택" },
    { age: "5세 (취학 전)", timing: "초등 준비의 해", points: ["유치원 방과후과정(돌봄) 유지 여부 확인", "취학 전 건강검진 — 시력·치과·언어", "초등 학군 확정 — 이사한다면 입학 전해 여름까지", "등하교 연습 등 기초 생활습관 만들기"], q: "예비 초등학생 준비" },
  ]},
  elementary: { label: "초등 (6년)", intro: "저학년은 돌봄 공백 대책, 고학년은 중등 대비가 핵심이에요. 학군지 이사의 실질 마지노선도 이 구간입니다.", cards: [
    { age: "예비 초등 (입학 전 겨울)", timing: "취학통지서: 입학 전해 12월", points: ["취학통지서 수령·예비소집 참석", "늘봄학교·돌봄교실 신청 — 맞벌이 필수 체크", "방과후학교 프로그램 미리 확인", "입학 준비물·생활 루틴 세팅"], q: "초등학교 입학 준비물 예비소집" },
    { age: "1~2학년", timing: "돌봄 공백 대책이 최우선", points: ["늘봄학교(아침·저녁)로 하교 공백 커버", "독서 습관 등 기초 학습습관 형성", "사교육은 예체능 위주로 가볍게", "부모 참여 행사(공개수업·상담) 일정 관리"], q: "초등 저학년 늘봄학교 후기" },
    { age: "3~4학년", timing: "교과 학습이 시작되는 구간", points: ["수학 격차가 벌어지기 시작 — 기초 연산 점검", "영어 노출 확대 (학원 vs 홈스쿨 결정)", "과천 거주 시 평촌 학원가 접근성 체감 시작", "진로 탐색 활동·독서 확장"], q: "초등 3학년 수학 영어 학습" },
    { age: "5~6학년", timing: "중등 대비 + 학군 결정 마지노선", points: ["수학 선행 여부·속도 부부 합의", "중학교 배정(근거리) 확인 — 학군지 이사면 중1 배정 전까지", "자기주도 학습 습관 완성", "예비 중1 겨울 계획 (자유학기 이해)"], q: "초등 고학년 중등 대비" },
  ]},
  secondary: { label: "중·고등 (6년)", intro: "내신·입시 체계가 계속 바뀌는 구간이라, 시기마다 최신 제도를 확인하는 게 중요해요.", cards: [
    { age: "중1", timing: "자유학기제 — 시험 부담 없는 탐색기", points: ["자유학기(시험 없음) 동안 진로 탐색 집중", "내신 산출 방식·수행평가 구조 이해", "고교 유형(일반고/특목·자사고) 정보 수집 시작"], q: "중1 자유학기제 활용" },
    { age: "중2~3", timing: "고교 선택 결정 구간", points: ["지필고사 시작 — 내신 관리 본격화", "고교 유형 결정: 일반고 vs 특목·자사고 (통학거리 포함)", "고교학점제 개설과목 학교별 비교", "고입 전형 일정(11~12월) 체크"], q: "고등학교 선택 특목고 일반고" },
    { age: "고1", timing: "고교학점제 과목 선택이 입시 방향", points: ["진로 연계 과목 선택 전략 (선택과목이 대입과 직결)", "내신 + 학교생활기록부 관리 시작", "수시/정시 방향 1차 판단"], q: "고교학점제 과목 선택" },
    { age: "고2~3", timing: "대입 전형 확정·실행", points: ["수시(학종·교과) vs 정시 전략 확정", "수능 대비 로드맵·모의고사 관리", "전형료·컨설팅·재수 가능성까지 예산 계획"], q: "대입 수시 정시 전략" },
  ]},
  college: { label: "대학·교육비", intro: "교육비는 닥쳐서 마련하면 늦어요 — 출생 직후부터 증여 공제와 장기 적립을 묶어 준비하는 게 핵심입니다.", cards: [
    { age: "출생~10세 (적립기)", timing: "복리 효과가 가장 큰 구간", points: ["월 20만 적립(연 4%) 18년 ≈ 6,300만 — 저축 시뮬레이터로 계산", "미성년 증여 공제 1차 활용 (10년간 2,000만 비과세)", "자녀 명의 계좌 개설 + 증여세 신고(공제 내라도 신고 권장)"], q: "자녀 증여 계좌 적립" },
    { age: "10~15세 (증액기)", timing: "증여 공제 2회차 개시", points: ["10년 경과 후 추가 2,000만 증여 가능", "적립 포트폴리오 중간 점검·리밸런싱", "사교육비와 장기 적립의 균형 재조정"], q: "미성년 자녀 증여 2천만원" },
    { age: "15~19세 (확정기)", timing: "목표액·부족분 확정", points: ["목표: 국공립 4년 3~4천만 vs 사립 5~7천만 (생활비 별도)", "사교육 피크(고교) 예산과 대학 자금 분리 관리", "수시 전형료·입학금 등 일시 지출 대비"], q: "대학 등록금 4년 비용" },
    { age: "대학 재학", timing: "장학·대출 제도 활용", points: ["국가장학금(소득구간별) 매 학기 신청", "학자금 대출 vs 자체 자금 비교", "등록금 분할 납부 제도 활용 가능"], q: "국가장학금 소득분위" },
  ]},
};

const SCHOOL_DISTRICTS = [
  { area: "과천", tags: ["거주 예정지", "중소형 학군"], note: "학업 성취도 높고 면학 분위기 조용한 편. 학원가는 평촌(15분) 의존 — 초등까지는 과천, 중등부터 평촌 학원가 활용이 일반적.", q: "과천 학군 초등학교" },
  { area: "평촌 (안양 동안구)", tags: ["수도권 3대 학원가"], note: "범계·평촌역 학원가 밀집. 과천에서 가장 가까운 대형 학원가로, 과천 거주 시 실질적 사교육 거점.", q: "평촌 학원가 학군" },
  { area: "분당 (성남)", tags: ["학군 + 학원가"], note: "수내·서현 중심 학군과 정자·미금 학원가. 판교 직주근접 수요와 겹쳐 진입 비용 높음.", q: "분당 학군 수내 서현" },
  { area: "대치 (강남)", tags: ["전국 최상위"], note: "전국 최대 학원가. 중등 이후 '대치 유학' 수요도 많음 — 거주 전환은 교육비·주거비 동반 상승 감안.", q: "대치동 학군 학원가" },
  { area: "목동 (양천)", tags: ["강서권 대표"], note: "목동 신시가지 단지 중심 학군·학원가. 재건축 진행에 따라 단지별 편차.", q: "목동 학군 재건축" },
];

/* ============== 공유 가구(household) 상태 — 모든 테마에 일괄 반영 ============== */
const HH_DEFAULT = {
  income1: 9700, income2: 6000, assets: 20000, monthlySave: 250,
  firstTime: true, targetKey: "jeonse59budget", rate: 6.3, existingDebtMonthly: 0,
  loanAmountCalc: 60000, loanRateCalc: 4.5, loanYearsCalc: 30, repayType: "equal_payment",
  label1: "본인", label2: "배우자", // 커스텀 호칭 — 홈 설정에서 변경
};

/* ============== data constants (홈) ============== */
const ALLOC_DEFAULT = { totalCash: 20000, realty: 12000, saving: 4000, wedding: 3000, kids: 0 };
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
function Card({ children, className = "", ...rest }) {
  return <div {...rest} className={`bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-5 ${className}`}>{children}</div>;
}
// 원격 이미지 썸네일 — 네이버 썸네일은 원본 글 삭제 등으로 깨질 수 있어 실패 시 플레이스홀더로 전환
function ThumbImg({ src, alt, fallback }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) return fallback;
  return <img src={src} alt={alt} onError={() => setBroken(true)} className="w-full h-full object-cover" />;
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
          {[...state.items] // 최신 기사가 항상 위로 — 발행 시각(ts) 우선, 없으면 날짜 기준 내림차순
            .sort((a, b) => String(b.ts || b.date || "").localeCompare(String(a.ts || a.date || "")))
            .slice(0, 10).map((n, i) => (<li key={i}>
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="block px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
              <div className="text-[14px] font-semibold leading-snug">{n.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-[#8A8A8A]">
                {n.source && <span>{n.source}</span>}
                {(n.ts || n.date) && <span className="font-mono">{n.ts
                  ? new Date(n.ts).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
                  : n.date}</span>}
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

/* ============== 설정 팝업 (호칭 등) ============== */
function SettingsModal({ open, onClose, hh, setHh }) {
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-5">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-6 w-full max-w-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[19px] font-bold tracking-tight">설정</h3>
        <IconBtn name="plus" title="닫기" onClick={onClose} className="rotate-45" />
      </div>
      <div className="mb-6">
        <div className="text-[13px] font-semibold text-[#0A0A0A] mb-1">호칭 설정</div>
        <p className="text-[12px] text-[#8A8A8A] leading-relaxed mb-3">"본인/배우자" 대신 쓸 이름·애칭이에요. 진단·계좌 등 모든 화면에 반영됩니다.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className="text-[12px] text-[#8A8A8A] block mb-1">첫 번째</label><TextInput value={hh.label1 || ""} onChange={v => setHh({ label1: v })} placeholder="본인" className="!h-11" /></div>
          <div><label className="text-[12px] text-[#8A8A8A] block mb-1">두 번째</label><TextInput value={hh.label2 || ""} onChange={v => setHh({ label2: v })} placeholder="배우자" className="!h-11" /></div>
        </div>
      </div>
      <button onClick={onClose} className="w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold text-[14px]">완료</button>
    </div>
  </div>);
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
// 정보창은 HTML 문자열로 들어가므로 외부 API(청약홈·네이버) 데이터는 반드시 이스케이프
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function MapPanel({ mapKey, points, height = 340, focus }) {
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
    markersRef.current.forEach(m => m.marker.setMap(null));
    markersRef.current = [];
    if (tmpRef.current) { tmpRef.current.info.close(); tmpRef.current.marker.setMap(null); tmpRef.current = null; } // 지오코딩 임시 마커도 정리
    const valid = (points || []).filter(p => p.lat && p.lng);
    const bounds = valid.length ? new naver.maps.LatLngBounds() : null;
    valid.forEach(p => {
      const pos = new naver.maps.LatLng(p.lat, p.lng);
      const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: p.title });
      const info = new naver.maps.InfoWindow({
        content: `<div style="padding:8px 12px;font-size:13px;max-width:220px;font-family:Pretendard,sans-serif">
          <b>${escHtml(p.title)}</b><br/><span style="color:#8A8A8A">${escHtml(p.desc || "")}</span></div>`,
      });
      naver.maps.Event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      markersRef.current.push({ marker, info, key: p.id != null ? String(p.id) : `${p.lat},${p.lng}` });
      if (bounds) bounds.extend(pos);
    });
    if (bounds && valid.length > 1) mapRef.current.fitBounds(bounds);
    else if (valid.length === 1) mapRef.current.setCenter(new naver.maps.LatLng(valid[0].lat, valid[0].lng));
  }, [points, status]);

  // 리스트에서 매물을 누르면 해당 위치로 부드럽게 이동 + 정보창 오픈
  const tmpRef = useRef(null); // 좌표가 지오코딩으로 온 경우(기존 마커 없음)의 임시 마커
  useEffect(() => {
    if (status !== "ok" || !mapRef.current || !focus || !focus.lat || !focus.lng) return;
    const pos = new naver.maps.LatLng(focus.lat, focus.lng);
    mapRef.current.morph(pos, Math.max(mapRef.current.getZoom(), 15));
    if (tmpRef.current) { tmpRef.current.info.close(); tmpRef.current.marker.setMap(null); tmpRef.current = null; }
    const fkey = focus.id != null ? String(focus.id) : `${focus.lat},${focus.lng}`;
    const hit = markersRef.current.find(m => m.key === fkey);
    if (hit) { hit.info.open(mapRef.current, hit.marker); return; }
    const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: focus.title || "" });
    const info = new naver.maps.InfoWindow({
      content: `<div style="padding:8px 12px;font-size:13px;max-width:220px;font-family:Pretendard,sans-serif">
        <b>${escHtml(focus.title || "")}</b><br/><span style="color:#8A8A8A">${escHtml(focus.desc || "")}</span></div>`,
    });
    info.open(mapRef.current, marker);
    tmpRef.current = { marker, info };
  }, [focus, status]);

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
  const [sel, setSel] = useState(null); // 리스트에서 선택한 공고 — 지도 포커스
  const mapSecRef = useRef(null);
  const focusOn = async (i) => {
    let lat = i.lat, lng = i.lng;
    if (!lat || !lng) { // 청약홈 API는 좌표 미제공 — 주소로 지오코딩
      const c = await geocodeAddr(i.addr || `${i.region} ${i.name}`);
      if (!c) return;
      lat = c.lat; lng = c.lng;
    }
    setSel({ id: i.id, lat, lng, title: i.name, desc: `${i.region} · ${wonShortRaw(i.priceMin)}~${wonShortRaw(i.priceMax)}`, at: Date.now() }); // at: 같은 카드 재클릭도 다시 이동
    if (window.innerWidth < 1024 && mapSecRef.current) mapSecRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const load = (force) => {
    setState(s => ({ ...s, loading: true }));
    loadCheongyak(force).then(r => setState({ ...r, loading: false, at: new Date() }));
  };
  useEffect(() => load(false), []);
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
  const points = useMemo(() => filtered.map(i => ({ id: i.id, lat: i.lat, lng: i.lng, title: i.name, desc: `${i.region} · ${wonShortRaw(i.priceMin)}~${wonShortRaw(i.priceMax)}` })), [state.items, f, today]); // 지도 팝업(HTML 문자열) — 시장 공개가라 블러 제외

  return (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <SectionHeader eyebrow="조건 검색" title="청약 정보" />
          <div className="flex items-center gap-2 mb-4">
            <SourceBadge source={state.source} />
            {state.at && !state.loading && <span className="font-mono text-[11px] text-[#8A8A8A] hidden sm:inline">{state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</span>}
            <RefreshBtn onClick={() => load(true)} loading={state.loading} />
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
        <div className="text-[14px] font-semibold text-[#525252] mb-3">검색결과 {filtered.length}건 <span className="font-normal text-[#8A8A8A]">· 카드를 누르면 지도가 그 위치로 이동해요</span></div>
        <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          {state.loading && <Card><div className="text-[14px] text-[#8A8A8A]">최신 공고를 불러오는 중…</div></Card>}
          {!state.loading && filtered.length === 0 && <Card><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 공고가 없어요. 필터를 완화해 보세요.</div></Card>}
          {filtered.map(i => {
            const expired = i.applyEnd && i.applyEnd < today;
            return (<Card key={i.id} onClick={() => focusOn(i)} className={`cursor-pointer transition-colors ${sel && sel.id === i.id ? "!border-[#0A0A0A] border" : "hover:border-[#0A0A0A]/40"}`}>
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
              <a href={i.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 mt-3 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2">청약홈에서 확인 <Icon name="chevron" size={13} /></a>
            </Card>);
          })}
        </div>
      </section>

      <section ref={mapSecRef} className="lg:col-span-3 lg:sticky lg:top-[70px] scroll-mt-16">
        <SectionHeader eyebrow="위치" title="지도에서 보기" />
        <MapPanel mapKey={mapKey} points={points} height={560} focus={sel} />
      </section>
    </div>
  </>);
}

/* ============== Realty tab ============== */
function RealtyListTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(store.get("realty-filter-v1", { region: "all", dealType: "all", area: "all", maxPrice: 0, bldg: "all" }));
  const [sel, setSel] = useState(null); // 리스트에서 선택한 매물 — 지도 포커스
  const mapSecRef = useRef(null);
  const focusOn = async (i) => {
    let lat = i.lat, lng = i.lng;
    if (!lat || !lng) {
      const c = await geocodeAddr(i.addr || `${i.region} ${i.complex}`);
      if (!c) return;
      lat = c.lat; lng = c.lng;
    }
    setSel({ id: i.id, lat, lng, title: i.complex, desc: `${i.dealType} ${i.area}㎡`, at: Date.now() }); // at: 같은 카드 재클릭도 다시 이동
    if (window.innerWidth < 1024 && mapSecRef.current) mapSecRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const load = (force) => {
    setState(s => ({ ...s, loading: true }));
    loadRealty(force).then(r => setState({ ...r, loading: false, at: new Date() }));
  };
  useEffect(() => load(false), []);
  useEffect(() => store.set("realty-filter-v1", f), [f]);
  const set = (k) => (v) => setF(prev => ({ ...prev, [k]: v }));

  const regions = ["all", ...Array.from(new Set(state.items.map(i => i.region)))];
  const filtered = state.items.filter(i => {
    if (f.region !== "all" && i.region !== f.region) return false;
    if (f.dealType !== "all" && i.dealType !== f.dealType) return false;
    if ((f.bldg || "all") !== "all" && (i.bldg || "apt") !== f.bldg) return false;
    if (f.area !== "all" && Math.round(i.area) !== Number(f.area)) return false;
    if (f.maxPrice > 0 && i.price && i.price > f.maxPrice * 10000) return false;
    return true;
  });
  const points = useMemo(() => filtered.map(i => ({ id: i.id, lat: i.lat, lng: i.lng, title: i.complex, desc: `${i.dealType} ${i.area}㎡ · ${i.priceText || wonRaw(i.price)}${i.rent ? "/월 " + wonRaw(i.rent) : ""}` })), [state.items, f]); // 지도 팝업 — 시장 공개가라 블러 제외

  return (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 mb-4">
          <SectionHeader eyebrow="조건 검색" title="부동산 매물" />
          <div className="flex items-center gap-2 mb-4">
            <SourceBadge source={state.source} />
            {state.at && !state.loading && <span className="font-mono text-[11px] text-[#8A8A8A] hidden sm:inline">{state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신</span>}
            <RefreshBtn onClick={() => load(true)} loading={state.loading} />
          </div>
        </div>
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Select label="지역" value={f.region} onChange={set("region")} options={regions.map(r => ({ value: r, label: r === "all" ? "전체" : r }))} />
            <Select label="주택유형" value={f.bldg || "all"} onChange={set("bldg")} options={[["all","전체"],["apt","아파트"],["villa","빌라(연립·다세대)"]].map(([v,l])=>({value:v,label:l}))} />
            <Select label="거래유형" value={f.dealType} onChange={set("dealType")} options={[["all","전체"],["매매","매매"],["전세","전세"],["월세","월세"]].map(([v,l])=>({value:v,label:l}))} />
            <Select label="평형(전용㎡ 반올림)" value={f.area} onChange={set("area")} options={[["all","전체"],["59","59㎡"],["74","74㎡"],["84","84㎡"]].map(([v,l])=>({value:v,label:l}))} />
            <Field label="가격 상한(만원, 0=무제한)" value={f.maxPrice} onChange={set("maxPrice")} step={5000} />
          </div>
          <p className="mt-4 text-[13px] text-[#8A8A8A] leading-relaxed">실데이터는 <b>국토부 실거래가(공식 API)</b> 최근 3개월 — 아파트와 빌라(연립·다세대)의 매매·전월세 실제 체결가예요. data.go.kr에서 실거래가 API 활용신청이 안 되어 있으면 과천 샘플로 동작합니다.</p>
        </Card>
      </section>

    <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      <section className="lg:col-span-2 mb-6 lg:mb-0">
        <div className="text-[14px] font-semibold text-[#525252] mb-3">검색결과 {filtered.length}건 <span className="font-normal text-[#8A8A8A]">· 카드를 누르면 지도가 그 위치로 이동해요</span></div>
        <div className="space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
          {state.loading && <Card><div className="text-[14px] text-[#8A8A8A]">매물을 불러오는 중…</div></Card>}
          {!state.loading && filtered.length === 0 && <Card><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 매물이 없어요.</div></Card>}
          {filtered.map(i => (<Card key={i.id} onClick={() => focusOn(i)} className={`cursor-pointer transition-colors ${sel && sel.id === i.id ? "!border-[#0A0A0A] border" : "hover:border-[#0A0A0A]/40"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A] font-semibold">{i.dealType}</span>
                  {i.bldg === "villa" && <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold">빌라</span>}
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

      <section ref={mapSecRef} className="lg:col-span-3 lg:sticky lg:top-[70px] scroll-mt-16">
        <SectionHeader eyebrow="위치" title="지도에서 보기" />
        <MapPanel mapKey={mapKey} points={points} height={560} focus={sel} />
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

/* ============== 부동산 플랜 — 진단과 연동된 실행형 플랜 ============== */
function RealtyPlanTab({ hh, diag, setTab, privacy }) {
  const [done, setDone] = usePersist("plan-timeline-done-v1", {});
  const toggle = (k) => setDone({ ...done, [k]: !done[k] });
  const flat = TIMELINE.flatMap((p, pi) => p.items.map((it, ii) => ({ key: `${pi}-${ii}`, phase: p.title, text: it })));
  const next = flat.find(x => !done[x.key]);
  const doneCnt = flat.filter(x => done[x.key]).length;

  const { target, gap, monthsToGoal, requiredCash, maxLoan } = diag;
  const eta = (() => {
    if (gap <= 0 || !monthsToGoal) return null;
    const dt = new Date(); dt.setMonth(dt.getMonth() + monthsToGoal);
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
  })();
  const boostMonths = gap > 0 && hh.monthlySave > 0
    ? monthsToGoal - Math.ceil(gap / ((hh.monthlySave + 50) * 10000)) : 0;

  return (<>
    <section>
      <SectionHeader eyebrow="Our Plan" title="우리 플랜 브리핑" accent="#0A0A0A" />
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-4 bg-[#0A0A0A] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/50 mb-0.5">현재 목표 — 진단 탭과 실시간 연동</div>
            <div className="text-[16px] font-bold truncate">{target.label}</div>
          </div>
          <div className="font-mono text-[18px] font-bold shrink-0">{wonShort(target.price)}</div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">최대 대출가능</div><div className="text-[13px] font-bold"><Blur on={privacy}>{wonShort(maxLoan)}</Blur></div></div>
            <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">필요 자기자본</div><div className="text-[13px] font-bold"><Blur on={privacy}>{wonShort(requiredCash)}</Blur></div></div>
            <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">달성 예상</div><div className="text-[13px] font-bold">{gap <= 0 ? "지금 가능" : eta || "-"}</div></div>
          </div>
          {next ? (<div className="rounded-xl border border-[#0A0A0A] px-4 py-3.5 mb-3">
            <div className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1">Next Action · {next.phase}</div>
            <div className="flex items-start gap-2.5">
              <button onClick={() => toggle(next.key)} title="완료 처리" className="mt-0.5 shrink-0 text-[#C9C9C9] hover:text-[#0A0A0A]"><Icon name="square" size={17} /></button>
              <span className="text-[15px] font-semibold leading-relaxed">{next.text}</span>
            </div>
          </div>) : (<div className="rounded-xl bg-[#FAFAFA] px-4 py-3.5 mb-3 text-[14px] text-[#525252]">타임라인의 할 일을 모두 끝냈어요 🎉 아래에 단계를 직접 추가하거나 체크리스트를 이어가세요.</div>)}
          {gap > 0 && boostMonths > 0 && (<p className="text-[13px] text-[#525252] leading-relaxed mb-4 bg-[#FAFAFA] rounded-lg px-3 py-2.5">월 저축을 <b>{hh.monthlySave}만 → {hh.monthlySave + 50}만</b>으로 늘리면 목표 달성이 약 <b className="text-[#0A0A0A]">{boostMonths}개월</b> 빨라져요. 저축 여력은 돈 모으기 테마에서 점검하세요.</p>)}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTab("cheongyak")} className="h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold">청약 공고 확인</button>
            <button onClick={() => setTab("diag")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">목표·진단 조정</button>
            <button onClick={() => setTab("loan")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">대출 계산</button>
          </div>
        </div>
      </Card>
    </section>
    <section>
      <div className="flex items-end justify-between gap-3 mb-4">
        <SectionHeader eyebrow="로드맵" title="내집마련 4단계 타임라인" accent="#0A0A0A" />
        <span className="mb-4 font-mono text-[12px] font-semibold text-[#8A8A8A] shrink-0">{doneCnt}/{flat.length} 완료</span>
      </div>
      <Card>
      <div className="relative pl-6">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-[#E5E5E5]" />
        {TIMELINE.map((p, pi) => {
          const keys = p.items.map((_, ii) => `${pi}-${ii}`);
          const pd = keys.filter(k => done[k]).length;
          const isCur = next && next.key.startsWith(`${pi}-`);
          const isDone = pd === keys.length;
          return (<div key={pi} className="mb-8 relative last:mb-0">
            <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white ${isDone ? "bg-[#C9C9C9]" : "bg-[#0A0A0A]"}`} />
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[13px] font-semibold text-[#0A0A0A]">{p.phase}</span>
              {isCur && <span className="text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full">진행 중</span>}
              <span className="ml-auto font-mono text-[11px] text-[#8A8A8A]">{pd}/{keys.length}</span>
            </div>
            <div className={`text-lg font-bold mb-2 ${isDone ? "text-[#B0B0B0] line-through" : ""}`} style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{p.title}</div>
            <div className="mb-3"><ProgressBar ratio={keys.length ? pd / keys.length : 0} height={4} /></div>
            <ul className="space-y-2">{p.items.map((it, ii) => { const k = `${pi}-${ii}`; return (
              <li key={ii}><button onClick={() => toggle(k)} className="flex items-start gap-2 text-left w-full">
                {done[k] ? <Icon name="check2" size={16} className="mt-0.5 shrink-0 text-[#0A0A0A]" /> : <Icon name="square" size={16} className="mt-0.5 shrink-0 text-[#C9C9C9]" />}
                <span className={`text-[15px] leading-relaxed ${done[k] ? "line-through text-[#B0B0B0]" : "text-[#3D3D3D]"}`}>{it}</span>
              </button></li>); })}
            </ul>
          </div>);
        })}
      </div>
      </Card>
    </section>
  </>);
}

/* ============== 부동산 요약 대시보드 — 테마 첫 화면 ============== */
function RealtyOverview({ diag, hh, setTab, privacy }) {
  const [done] = usePersist("plan-timeline-done-v1", {});
  const flat = TIMELINE.flatMap((p, pi) => p.items.map((it, ii) => ({ key: `${pi}-${ii}`, phase: p.title, text: it })));
  const next = flat.find(x => !done[x.key]);
  const doneCnt = flat.filter(x => done[x.key]).length;
  const { target, maxLoan, requiredCash, gap, monthsToGoal, bindingConstraint } = diag;
  const eta = (() => {
    if (gap <= 0 || !monthsToGoal) return "지금 가능";
    const dt = new Date(); dt.setMonth(dt.getMonth() + monthsToGoal);
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
  })();
  return (<>
    <section className="mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi icon="home" label="현재 목표" value={wonShort(target.price)} />
        <Kpi icon="calc" label="최대 대출가능" value={<Blur on={privacy}>{wonShort(maxLoan)}</Blur>} accent="#525252" />
        <Kpi icon="piggy" label="필요 자기자본" value={<Blur on={privacy}>{wonShort(requiredCash)}</Blur>} accent="#8A8A8A" />
        <Kpi icon="calendar" label="달성 예상" value={eta} accent="#B0B0B0" />
      </div>
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#8A8A8A]">플랜 진행률 · 한도 결정 요인: {bindingConstraint}</span>
          <span className="font-mono text-[12px] font-semibold text-[#8A8A8A]">{doneCnt}/{flat.length} 완료</span>
        </div>
        <ProgressBar ratio={flat.length ? doneCnt / flat.length : 0} />
        {next && (<div className="mt-4 rounded-xl border border-[#0A0A0A] px-4 py-3">
          <div className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1">Next Action · {next.phase}</div>
          <div className="text-[15px] font-semibold leading-relaxed">{next.text}</div>
        </div>)}
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => setTab("diag")} className="h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold">목표·진단 조정</button>
          <button onClick={() => setTab("cheongyak")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">청약 공고</button>
          <button onClick={() => setTab("plan")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">플랜 전체 보기</button>
        </div>
      </Card>
    </section>
  </>);
}

/* ============== 테마: 부동산 ============== */
function RealtyTheme({ mapKey, hh, setHh, setTheme, privacy }) {
  const [tab, setTab] = usePersist("realty-tab-v1", "overview");
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
    <PhaseGauge themeId="realty" />
    <PillNav tabs={REALTY_TABS} tab={tab} setTab={setTab} />

    {tab === "overview" && <RealtyOverview diag={diag} hh={hh} setTab={setTab} privacy={privacy} />}

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
                <div className="text-[14px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}><Blur on={privacy}>{manWon(v)}</Blur></div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#E5E5E5] space-y-3">
            <div className="flex justify-between items-center"><span className="text-[15px] text-[#525252]">부부합산 월소득(세전, 연÷12)</span><span className="text-xl font-bold" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}><Blur on={privacy}>{won(Math.round(incomeWon / 12))}</Blur></span></div>
            <div className="flex justify-between items-center"><span className="text-[15px] text-[#525252]">부부합산 월소득(세후 추정)</span><span className="text-xl font-bold text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}><Blur on={privacy}>{won(Math.round(netMonthly))}</Blur></span></div>
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
    <RealtyPlanTab hh={hh} diag={diag} setTab={setTab} privacy={privacy} />
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
  { id: "overview", label: "요약", icon: "grid" },
  { id: "tracker", label: "납입 트래커", icon: "piggy" },
  { id: "sim", label: "저축 시뮬레이터", icon: "calc" },
  { id: "guide", label: "절세 가이드", icon: "check2" },
  { id: "policy", label: "정책·혜택", icon: "search" },
];

function SavingTheme({ hh, privacy }) {
  const [tab, setTab] = usePersist("saving-tab-v1", "overview");
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

  // 저축 시뮬레이터: 시작 원금 + 월복리 적립식 미래가치 (납입 트래커 연동 가능)
  const years = Math.min(40, Math.max(1, Number(sim.years) || 1));
  const mRate = (Number(sim.ratePct) || 0) / 100 / 12;
  const simInitial = Number(sim.initial) || 0;
  const trackerMonthly = Math.round(totalGoal / 12); // 연 납입 목표 → 월 환산
  const yearly = [];
  { let bal = simInitial;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = (bal + (Number(sim.monthly) || 0)) * (1 + mRate);
      yearly.push({ y, bal: Math.round(bal), principal: simInitial + (Number(sim.monthly) || 0) * 12 * y });
    } }
  const maxBal = yearly.length ? yearly[yearly.length - 1].bal : 1;

  const spouseExemption = Math.max(0, 60000 - gift.spouseGiftUsed);
  const giftTaxableBase = Math.max(0, gift.giftAmount * 10000 - spouseExemption * 10000);
  const giftTaxOwed = giftTax(giftTaxableBase);
  const incomeTotal = hh.income1 + hh.income2;

  return (<>
    <PillNav tabs={SAVING_TABS} tab={tab} setTab={setTab} />

    {tab === "overview" && (<>
      <section className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi icon="piggy" label="절세계좌 총 잔액" value={<Blur on={privacy}>{manWon(totalBalance)}</Blur>} />
          <Kpi icon="trending" label="올해 납입" value={<Blur on={privacy}>{manWon(totalPaid)}</Blur>} accent="#525252" />
          <Kpi icon="check2" label="연 목표 달성률" value={`${totalGoal > 0 ? Math.round(totalPaid / totalGoal * 100) : 0}%`} accent="#8A8A8A" />
          <Kpi icon="calc" label="예상 세액공제 환급" value={<Blur on={privacy}>{manWon(Math.round(refundEst))}</Blur>} accent="#B0B0B0" />
        </div>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-[#8A8A8A]">연 납입 목표 진행률</span>
            <span className="font-mono text-[12px] font-semibold text-[#8A8A8A]"><Blur on={privacy}>{manWon(totalPaid)} / {manWon(totalGoal)}</Blur></span>
          </div>
          <ProgressBar ratio={totalGoal > 0 ? Math.min(1, totalPaid / totalGoal) : 0} />
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-[#FAFAFA] rounded-xl px-4 py-3">
              <div className="text-[11px] text-[#8A8A8A] mb-0.5">{years}년 뒤 예상 자산 (시뮬레이터 · 월 {sim.monthly}만 · 연 {sim.ratePct}%)</div>
              <div className="text-[16px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}><Blur on={privacy}>{won(yearly.length ? yearly[yearly.length - 1].bal * 10000 : 0)}</Blur></div>
            </div>
            <div className="bg-[#FAFAFA] rounded-xl px-4 py-3">
              <div className="text-[11px] text-[#8A8A8A] mb-0.5">우리 부부가 받을 수 있는 정책</div>
              <div className="text-[16px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{(policyData.items || []).filter(p => p.fit === "good").length}개 <span className="text-[12px] font-semibold text-[#8A8A8A]">/ 전체 {(policyData.items || []).length}개</span></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => setTab("tracker")} className="h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold">납입 트래커</button>
            <button onClick={() => setTab("sim")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">시뮬레이터</button>
            <button onClick={() => setTab("policy")} className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">정책·혜택</button>
          </div>
        </Card>
      </section>
    </>)}

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Field label="시작 원금(만원)" value={sim.initial || 0} onChange={v => setSim({ ...sim, initial: v })} step={100} />
            <Field label="월 납입(만원)" value={sim.monthly} onChange={v => setSim({ ...sim, monthly: v })} step={10} />
            <Field label="연 수익률(%)" value={sim.ratePct} onChange={v => setSim({ ...sim, ratePct: v })} step={0.5} />
            <Field label="기간(년)" value={sim.years} onChange={v => setSim({ ...sim, years: v })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSim({ ...sim, initial: totalBalance, monthly: trackerMonthly })}
              className="h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold">
              납입 트래커 연동 — 시작 {totalBalance.toLocaleString()}만 · 월 {trackerMonthly.toLocaleString()}만
            </button>
            <button onClick={() => setSim({ ...sim, monthly: hh.monthlySave })}
              className="h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]">
              진단의 월 저축액({hh.monthlySave}만) 불러오기
            </button>
          </div>
          <p className="mt-3 text-[13px] text-[#8A8A8A] leading-relaxed">트래커 연동은 <b>절세계좌 총 잔액을 시작 원금</b>으로, <b>연 납입 목표÷12를 월 납입</b>으로 가져와요. 월복리 적립식 가정 — ISA·연금계좌에 넣으면 계산된 수익에 대한 세금을 아끼는 구조예요.</p>
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="Projection" title={<>{years}년 후 {manWon(yearly[years - 1].bal)}</>} />
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
  { id: "vendors", label: "식장·스드메", icon: "building" },
  { id: "guests", label: "하객 리스트", icon: "users" },
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

// 리서치 결과 병합 — 직접 추가한 업체와 등록해 둔 사진 URL은 보존, 서버 썸네일은 새 항목에 채움
function mergeVendorResearch(prev, items, idPrefix, isCustom) {
  const imgByName = {}; (prev || []).forEach(x => { if (x.img) imgByName[x.name] = x.img; });
  const fresh = (items || []).map((v, i) => ({ id: idPrefix + i, ...v, img: imgByName[v.name] || v.img || "" }));
  return [...fresh, ...(prev || []).filter(x => isCustom(x) && !fresh.some(fv => fv.name === x.name))];
}

// 스드메(스튜디오/드레스/메이크업) 공통 탭 — 리스트 관리 + 지역 필터 + 실시간 리서치
function WeddingVendorTab({ kind }) {
  const def = WEDDING_VENDORS[kind];
  const listKey = `wedding-vendor-${kind}-v4`, metaKey = `wedding-vendor-${kind}-meta-v1`;
  const defaultList = def.items.map((v, i) => ({ id: kind + i, ...v }));
  const [list, setList] = usePersist(listKey, defaultList); // v4: 스튜디오·메이크업을 인스타 유명 업체 중심으로 재구성
  const [meta, setMeta] = usePersist(metaKey, { at: null });
  const [area, setArea] = useState("");
  const [nv, setNv] = useState({ name: "", area: "", price: "", note: "" });
  const patchVendor = (id, k, val) => setList(list.map(x => x.id === id ? { ...x, [k]: val } : x));
  const shown = list.filter(v => !area.trim() || `${v.area || ""} ${v.name || ""}`.includes(area.trim()));
  return (<section className="mb-6">
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <SectionHeader eyebrow={meta.at ? `${meta.at.slice(0, 10)} 실시간 리서치` : "시작 리스트 · 대표 업체 예시"} title={def.label} />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <TextInput value={area} onChange={setArea} placeholder="지역·업체명 필터" className="!w-36 !h-9 !bg-white shadow-sm" />
        <LiveUpdateBtn topic={def.topic} params={`&area=${encodeURIComponent(area.trim())}`}
          onData={j => {
            // store에 직접 기록 — 갱신 중 다른 탭으로 이동해도(언마운트) 결과가 저장되도록
            const isCustom = (x) => x.custom || !(String(x.id).startsWith(kind) || String(x.id).startsWith("r" + kind));
            const merged = mergeVendorResearch(store.get(listKey, defaultList), j.items, "r" + kind, isCustom);
            store.set(listKey, merged); store.set(metaKey, { at: j.fetchedAt });
            setList(merged); setMeta({ at: j.fetchedAt });
          }} />
      </div>
    </div>
    {shown.length === 0 && <Card className="mb-4"><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 업체가 없어요. 필터를 지우거나 아래에서 직접 추가해 보세요.</div></Card>}
    <div className="grid lg:grid-cols-2 gap-4 items-stretch">
      {shown.map(v => (<Card key={v.id} className="h-full flex flex-col">
        <div className="w-full h-36 rounded-xl mb-3 overflow-hidden">
          <ThumbImg src={v.img} alt={v.name} fallback={
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white" style={{ background: VENDOR_THUMB[kind] }}>
              <span className="text-[30px] font-bold opacity-90">{(v.name || "?")[0]}</span>
              <span className="text-[11px] font-semibold tracking-[0.24em] opacity-70">{def.label.replace("인기 ", "")}</span>
            </div>} />
        </div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="text-[16px] font-bold">{v.name}</div>
            <div className="text-[13px] text-[#8A8A8A] mt-0.5">{v.area}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono text-[13px] font-bold">{v.price}</span>
            <IconBtn name="trash" title="삭제" onClick={() => setList(list.filter(x => x.id !== v.id))} className="!w-7 !h-7" />
          </div>
        </div>
        <p className="text-[13px] text-[#525252] leading-relaxed mb-3 flex-1">{v.note}</p>
        <div className="mt-auto">
          <div className="flex gap-3 mb-2.5">
            <a href={naverSearch(`${v.name} ${def.q}`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold underline underline-offset-4">네이버 검색</a>
            <a href={naverBlog(`${v.name} ${def.q} 후기 가격`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">후기·견적 보기</a>
          </div>
          <TextInput value={v.img || ""} onChange={val => patchVendor(v.id, "img", val)} placeholder="대표 사진 URL 붙여넣기 (선택)" className="!h-8 !text-[12px]" />
        </div>
      </Card>))}
      <Card className="h-full flex flex-col justify-center border-dashed">
        <div className="text-[13px] font-semibold text-[#8A8A8A] mb-3">직접 추가 — 박람회·후기에서 알게 된 업체를 기록해 부부가 함께 비교하세요</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <TextInput value={nv.name} onChange={v => setNv({ ...nv, name: v })} placeholder="업체명 *" />
          <TextInput value={nv.area} onChange={v => setNv({ ...nv, area: v })} placeholder="지역 (예: 청담)" />
          <TextInput value={nv.price} onChange={v => setNv({ ...nv, price: v })} placeholder="가격대 (예: 180만~)" />
          <TextInput value={nv.note} onChange={v => setNv({ ...nv, note: v })} placeholder="메모" />
        </div>
        <button onClick={() => { if (!nv.name.trim()) return; setList([...list, { id: uid(), img: "", custom: true, ...nv, name: nv.name.trim() }]); setNv({ name: "", area: "", price: "", note: "" }); }}
          className="h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"><Icon name="plus" size={15} /> 리스트에 추가</button>
      </Card>
    </div>
    <div className="mt-3"><InfoNote>시작 리스트는 대표 업체 일부 예시이고, 대표 사진은 네이버 검색 썸네일(컨셉 참고용)이에요. 가격은 시즌·구성별 편차가 커서 견적 상담이 정확해요. "최신 정보로 갱신"을 누르면 지금 인기 업체를 웹에서 다시 조사해요 — 직접 추가한 업체와 등록한 사진은 갱신해도 유지됩니다.</InfoNote></div>
  </section>);
}

// 하객 측별 카드 — GuestListTab 내부에 정의하면 타이핑마다 리마운트되어 입력 포커스가 풀리므로 최상위에 둔다
function GuestSideCard({ title, list, nv, setNv, onAdd, onToggle, onRemove }) {
  return (<Card className="h-full">
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-[15px] font-bold">{title}</h4>
      <span className="font-mono text-[12px] font-semibold text-[#8A8A8A]">{list.length}명 · 청모 {list.filter(g => g.chungmo).length}명</span>
    </div>
    <div className="flex gap-2 mb-4">
      <TextInput value={nv.name} onChange={v => setNv({ ...nv, name: v })} placeholder="이름 *" className="flex-1" />
      <TextInput value={nv.rel} onChange={v => setNv({ ...nv, rel: v })} placeholder="관계 (예: 친구·회사)" className="flex-1" />
      <button onClick={onAdd} className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0 flex items-center gap-1"><Icon name="plus" size={13} /> 추가</button>
    </div>
    {list.length === 0 && <div className="text-[13px] text-[#8A8A8A] py-4 text-center">아직 없어요 — 위에서 하객을 추가해 보세요.</div>}
    <ul className="divide-y divide-[#F5F5F5]">
      {list.map(g => (<li key={g.id} className="flex items-center gap-3 py-2.5">
        <span className="text-[14px] font-semibold flex-1 min-w-0 truncate">{g.name}</span>
        <span className="text-[13px] text-[#8A8A8A] shrink-0">{g.rel || "-"}</span>
        <button onClick={() => onToggle(g.id)} title="청첩장 모임 참석 여부"
          className={`h-7 px-2.5 rounded-full text-[11px] font-bold shrink-0 transition-colors ${g.chungmo ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#8A8A8A] hover:bg-[#E5E5E5]"}`}>청모</button>
        <IconBtn name="trash" title="삭제" onClick={() => onRemove(g.id)} className="!w-7 !h-7 shrink-0" />
      </li>))}
    </ul>
  </Card>);
}

// 하객 초대 리스트 — 신랑/신부 측 각각 이름·관계·청모(청첩장 모임) 여부 기록
function GuestListTab() {
  const [guests, setGuests] = usePersist("wedding-guests-v1", []);
  const [nvH, setNvH] = useState({ name: "", rel: "" });
  const [nvW, setNvW] = useState({ name: "", rel: "" });
  const add = (side, nv, setNv) => {
    if (!nv.name.trim()) return;
    setGuests([...guests, { id: uid(), side, name: nv.name.trim(), rel: nv.rel.trim(), chungmo: false }]);
    setNv({ name: "", rel: "" });
  };
  const toggle = (id) => setGuests(guests.map(g => g.id === id ? { ...g, chungmo: !g.chungmo } : g));
  const remove = (id) => setGuests(guests.filter(g => g.id !== id));
  const bySide = (s) => guests.filter(g => g.side === s);
  const chungmoCnt = guests.filter(g => g.chungmo).length;

  return (<>
    <section className="mb-6">
      <SectionHeader eyebrow="Guest List" title="하객 초대 리스트" />
      <Card className="!p-0 overflow-hidden mb-4">
        <div className="grid grid-cols-4 divide-x divide-[#F0F0F0] text-center">
          <div className="p-4"><div className="text-[12px] text-[#8A8A8A] mb-1">총 하객</div><div className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{guests.length}명</div></div>
          <div className="p-4"><div className="text-[12px] text-[#8A8A8A] mb-1">신랑측</div><div className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{bySide("h").length}명</div></div>
          <div className="p-4"><div className="text-[12px] text-[#8A8A8A] mb-1">신부측</div><div className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{bySide("w").length}명</div></div>
          <div className="p-4"><div className="text-[12px] text-[#8A8A8A] mb-1">청모 참석</div><div className="text-lg font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{chungmoCnt}명</div></div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <GuestSideCard title="🤵 신랑측" list={bySide("h")} nv={nvH} setNv={setNvH}
          onAdd={() => add("h", nvH, setNvH)} onToggle={toggle} onRemove={remove} />
        <GuestSideCard title="👰 신부측" list={bySide("w")} nv={nvW} setNv={setNvW}
          onAdd={() => add("w", nvW, setNvW)} onToggle={toggle} onRemove={remove} />
      </div>
      <div className="mt-3"><InfoNote>"청모" 배지를 누르면 청첩장 모임 참석 여부가 토글돼요. 리스트는 저장되어 부부가 함께 보는 목록에 반영됩니다. 예상 식대 계산은 개요·예산 탭의 하객 수와 함께 활용하세요.</InfoNote></div>
    </section>
  </>);
}

function WeddingTheme() {
  const [tabRaw, setTab] = usePersist("wedding-tab-v1", "overview");
  const tab = ["venue", "studio", "dress", "makeup"].includes(tabRaw) ? "vendors" : tabRaw; // 구버전 탭 id 마이그레이션
  const [seg, setSeg] = usePersist("wedding-vendor-seg-v1", ["studio", "dress", "makeup"].includes(tabRaw) ? tabRaw : "venue"); // 식장·스드메 통합 탭 내부 세그먼트
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
  const [honeymoon, setHoneymoon] = usePersist("wedding-honeymoon-v5", HONEYMOON_DEFAULT); // v5: 이탈리아·스위스 단독 코스 추가
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
  const [venueList, setVenueList] = usePersist("wedding-venues-v3", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v }))); // v3: 식장별 대표 사진(네이버 썸네일) 기본 탑재
  const [venueMeta, setVenueMeta] = usePersist("wedding-venues-meta-v1", { at: null });
  const [newVenue, setNewVenue] = useState({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" });
  const patchVenue = (id, k, val) => setVenueList(venueList.map(x => x.id === id ? { ...x, [k]: val } : x));
  const venueTypes = ["all", ...Array.from(new Set(venueList.map(v => v.type)))];
  // 원하는 테마(유형)·위치·가격대로 검색 — 리스트 즉시 필터 + 외부 검색·실시간 리서치에도 같은 조건 적용
  const [vSearch, setVSearch] = usePersist("wedding-venue-search-v1", { area: "", maxMeal: 0 });
  const mealMinOf = (v) => { const m = String(v.meal || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const venues = venueList.filter(v =>
    (venueFilter === "all" || v.type === venueFilter)
    && (!vSearch.area.trim() || `${v.area || ""} ${v.name || ""}`.includes(vSearch.area.trim()))
    && (!(vSearch.maxMeal > 0) || mealMinOf(v) === null || mealMinOf(v) <= vSearch.maxMeal));
  const venueQuery = [vSearch.area.trim() || "서울", venueFilter === "all" ? "" : venueFilter, "웨딩홀", vSearch.maxMeal > 0 ? `식대 ${vSearch.maxMeal}만원대` : ""].filter(Boolean).join(" ");

  return (<>
    <PhaseGauge themeId="wedding" />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Kpi icon="check2" label="체크리스트 진행" value={`${taskDone}/${taskTotal}`} />
          <Kpi icon="piggy" label="예산 집행률" value={`${Math.round(totalSpent / Math.max(1, totalBudget) * 100)}%`} accent="#525252" />
          <Kpi icon="users" label="하객 리스트" value={`${store.get("wedding-guests-v1", []).length}명`} accent="#8A8A8A" />
          <Kpi icon="building" label="식장 후보" value={`${venueList.length}곳`} accent="#B0B0B0" />
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
      return (<>
      <section className="mb-6">
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

      <div className="masonry">
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
      </div>

      <section>
        <SectionHeader eyebrow="후기에서 자주 나오는" title="실전 꿀팁 5" />
        <Card className="bg-[#FAFAFA]">
          <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-3.5">
            {WEDDING_TIPS.map((t, i) => (<li key={i} className="flex gap-2.5 text-[14px] text-[#3D3D3D] leading-relaxed">
              <span className="font-mono text-[12px] font-bold shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span><span>{t}</span>
            </li>))}
          </ul>
        </Card>
      </section>
    </>); })()}

    {tab === "vendors" && (<div className="mb-5 flex items-center gap-1.5 flex-wrap">
      {[["venue", "🏛 식장"], ["studio", "📸 스튜디오"], ["dress", "👗 드레스"], ["makeup", "💄 메이크업"]].map(([id, label]) => (
        <button key={id} onClick={() => setSeg(id)}
          className={`h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${seg === id ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`}>{label}</button>
      ))}
    </div>)}

    {tab === "vendors" && seg === "venue" && (<>
      <section className="mb-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <SectionHeader eyebrow={venueMeta.at ? `서울 · ${venueMeta.at.slice(0, 10)} 실시간 리서치` : "서울 · 2025~26 기준"} title="인기 예식장 리스트" />
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {venueTypes.map(t => (<button key={t} onClick={() => setVenueFilter(t)} className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${venueFilter === t ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}`}>{t === "all" ? "전체" : t}</button>))}
            <LiveUpdateBtn topic="venues" params={`&vtype=${encodeURIComponent(venueFilter === "all" ? "" : venueFilter)}&area=${encodeURIComponent(vSearch.area.trim())}&maxMeal=${vSearch.maxMeal || 0}`}
              onData={j => {
                // store에 직접 기록 — 갱신 중 다른 탭으로 이동해도(언마운트) 결과가 저장되도록
                const isCustom = (x) => x.custom || !/^r?v\d+$/.test(String(x.id));
                const merged = mergeVendorResearch(store.get("wedding-venues-v3", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v }))), j.items, "rv", isCustom);
                store.set("wedding-venues-v3", merged); store.set("wedding-venues-meta-v1", { at: j.fetchedAt });
                setVenueList(merged); setVenueMeta({ at: j.fetchedAt });
              }} />
          </div>
        </div>
        <Card className="mb-4">
          <div className="text-[13px] font-semibold text-[#8A8A8A] mb-3">원하는 조건으로 검색 — 테마(유형)는 위 필터로, 위치·가격대는 아래에 입력하면 리스트가 바로 좁혀져요</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div><label className="text-[12px] text-[#8A8A8A] block mb-1">위치 (지역·식장명)</label><TextInput value={vSearch.area} onChange={v => setVSearch({ ...vSearch, area: v })} placeholder="예: 강남구, 반포" /></div>
            <div><label className="text-[12px] text-[#8A8A8A] block mb-1">1인 식대 상한(만원, 0=무제한)</label><NumInput value={vSearch.maxMeal} onChange={v => setVSearch({ ...vSearch, maxMeal: v })} /></div>
            <a href={naverSearch(venueQuery)} target="_blank" rel="noopener noreferrer"
              className="h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"><Icon name="search" size={14} /> 이 조건으로 네이버 검색</a>
            <button onClick={() => { setVSearch({ area: "", maxMeal: 0 }); setVenueFilter("all"); }}
              className="h-10 rounded-lg border border-[#E5E5E5] text-[13px] font-semibold text-[#8A8A8A] hover:text-[#0A0A0A]">조건 초기화</button>
          </div>
          <p className="mt-3 text-[12px] text-[#8A8A8A] leading-relaxed">"최신 정보로 갱신"을 누르면 지금 설정한 테마·위치·가격대 조건으로 웹을 다시 조사해요. 조건에 맞는 식장이 리스트에 없으면 네이버 검색으로 후보를 찾아 아래 "식장 직접 추가"에 기록하세요.</p>
        </Card>
        {venues.length === 0 && <Card className="mb-4"><div className="text-[14px] text-[#8A8A8A]">조건에 맞는 식장이 없어요. 가격대를 올리거나 위치를 비워보세요.</div></Card>}
        <div className="grid lg:grid-cols-2 gap-4 items-stretch">
          {venues.map(v => (<Card key={v.id} className="h-full flex flex-col">
            <div className="w-full h-36 rounded-xl mb-3 overflow-hidden">
              <ThumbImg src={v.img} alt={v.name} fallback={
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white" style={{ background: VENUE_THUMB[v.type] || VENUE_THUMB.기타 }}>
                  <span className="text-[30px] font-bold opacity-90">{(v.name || "?")[0]}</span>
                  <span className="text-[11px] font-semibold tracking-[0.24em] opacity-70">{v.type}</span>
                </div>} />
            </div>
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
            <button onClick={() => { if (!newVenue.name.trim()) return; setVenueList([...venueList, { id: uid(), img: "", custom: true, ...newVenue, name: newVenue.name.trim() }]); setNewVenue({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" }); }}
              className="h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"><Icon name="plus" size={15} /> 리스트에 추가</button>
          </Card>
        </div>
        <div className="mt-3"><InfoNote>기본 10곳은 2025~26 후기·보도 기반 리서치예요(가격은 추정치). 카드 삭제·추가·사진 등록이 모두 저장되고 부부가 함께 보는 목록에 실시간 반영됩니다. 견적은 투어에서 직접 확인하세요.</InfoNote></div>
      </section>
      <NewsPanel query="웨딩홀 예식장" eyebrow="업계 소식으로 최신화" title="웨딩홀 뉴스" />
    </>)}

    {tab === "vendors" && seg === "studio" && <WeddingVendorTab kind="studio" />}
    {tab === "vendors" && seg === "dress" && <WeddingVendorTab kind="dress" />}
    {tab === "vendors" && seg === "makeup" && <WeddingVendorTab kind="makeup" />}

    {tab === "guests" && <GuestListTab />}

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

/* ============== 테마: 자녀 ============== */
const KIDS_TABS = [
  { id: "plan", label: "연령별 할 일", icon: "check2" },
  { id: "infant", label: "영유아", icon: "child" },
  { id: "elementary", label: "초등", icon: "calendar" },
  { id: "secondary", label: "중·고등", icon: "building" },
  { id: "college", label: "대학·교육비", icon: "calc" },
  { id: "gift", label: "증여 플랜", icon: "piggy" },
  { id: "info", label: "정보·뉴스", icon: "search" },
];

// 연령별 상세 탭 공통 렌더러
function KidsStageTab({ stage }) {
  return (<>
    <section className="mb-6">
      <Card><p className="text-[14px] text-[#525252] leading-relaxed">{stage.intro} <span className="text-[#B0B0B0]">시기·금액은 2026년 제도 기준 리서치 — 신청 전 공식 안내를 확인하세요.</span></p></Card>
    </section>
    <div className="masonry mb-6">
      {stage.cards.map((e, i) => (<Card key={i} className="h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="text-[16px] font-bold">{e.age}</div>
          <span className="font-mono text-[11px] font-semibold text-[#8A8A8A] shrink-0 mt-1">{i + 1}/{stage.cards.length}</span>
        </div>
        <div className="text-[13px] font-semibold text-[#0A0A0A] bg-[#F5F5F5] rounded-lg px-3 py-2 mb-3">⏰ {e.timing}</div>
        <ul className="space-y-2 mb-3 flex-1">
          {e.points.map((pt, j) => (<li key={j} className="flex gap-2 text-[14px] text-[#3D3D3D] leading-relaxed">
            <Icon name="chevron" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span>{pt}</span>
          </li>))}
        </ul>
        <a href={naverSearch(e.q)} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4">최신 정보 검색 <Icon name="chevron" size={12} /></a>
      </Card>))}
    </div>
  </>);
}

function KidsTheme() {
  const [tab, setTab] = usePersist("kids-tab-v1", "plan");
  const [checklist, setChecklist] = usePersist("kids-checklist-v1",
    KIDS_CHECKLIST_DEFAULT.map(g => ({ cat: g.cat, items: g.items.map(t => ({ id: uid(), text: t, done: false })) })));
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const [giftCalc, setGiftCalc] = usePersist("kids-gift-calc-v1", { amount: 2000, adult: false, used: 0 });

  const toggleTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map(it => it.id === id ? { ...it, done: !it.done } : it) }));
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter(it => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist.reduce((s, g) => s + g.items.filter(i => i.done).length, 0);

  return (<>
    <PhaseGauge themeId="kids" />
    <PillNav tabs={KIDS_TABS} tab={tab} setTab={setTab} />

    {tab === "plan" && (<>
      <section className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <Kpi icon="check2" label="전체 진행률" value={`${taskTotal > 0 ? Math.round(taskDone / taskTotal * 100) : 0}%`} />
          <Kpi icon="calendar" label="완료한 할 일" value={`${taskDone} / ${taskTotal}`} accent="#525252" />
          <Kpi icon="child" label="다음 할 일" value={<span className="text-[14px] leading-snug">{(checklist.flatMap(g => g.items).find(i => !i.done) || { text: "모두 완료 🎉" }).text}</span>} accent="#8A8A8A" />
        </div>
        <Card className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">전체 진행률</span>
          <div className="flex items-center gap-3 flex-1 max-w-[280px] ml-4">
            <ProgressBar ratio={taskTotal > 0 ? taskDone / taskTotal : 0} />
            <span className="font-mono text-[14px] font-bold shrink-0">{taskDone}/{taskTotal}</span>
          </div>
        </Card>
        <Card className="mt-3">
          <div className="text-[13px] font-semibold text-[#8A8A8A] mb-2.5">할 일 추가</div>
          <div className="flex gap-2">
            <select value={newTask.gi} onChange={e => setNewTask({ ...newTask, gi: e.target.value })}
              className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
              {checklist.map((g, i) => <option key={i} value={i}>{g.cat}</option>)}
            </select>
            <TextInput value={newTask.text} onChange={v => setNewTask({ ...newTask, text: v })} placeholder="예: 산후조리원 후보 알아보기" className="flex-1 min-w-0" />
            <button onClick={addTask} className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0">추가</button>
          </div>
        </Card>
      </section>
      <div className="masonry">
        {checklist.map((g, gi) => (<section key={gi}>
          <Card>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h4 className="font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full">{g.cat}</h4>
              <a href={naverBlog(`${g.cat} 육아 준비 후기`)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[#8A8A8A] underline underline-offset-4 hover:text-[#0A0A0A]">실제 후기 검색</a>
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
        </section>))}
      </div>
    </>)}

    {tab === "infant" && <KidsStageTab stage={KIDS_EDU_STAGES.infant} />}
    {tab === "elementary" && <KidsStageTab stage={KIDS_EDU_STAGES.elementary} />}
    {tab === "secondary" && <KidsStageTab stage={KIDS_EDU_STAGES.secondary} />}
    {tab === "college" && <KidsStageTab stage={KIDS_EDU_STAGES.college} />}

    {tab === "gift" && (() => {
      const limit = giftCalc.adult ? 5000 : 2000; // 10년 공제 한도(만원)
      const remaining = Math.max(0, limit - (Number(giftCalc.used) || 0));
      const taxable = Math.max(0, ((Number(giftCalc.amount) || 0) - remaining) * 10000);
      const tax = giftTax(taxable);
      return (<>
      <section className="mb-6">
        <Card><p className="text-[14px] text-[#525252] leading-relaxed">자녀 증여는 <b className="text-[#0A0A0A]">10년 단위 공제(미성년 2,000만 · 성인 5,000만)</b>를 최대한 일찍, 여러 번 쓰는 게 핵심이에요. 공제 범위 안이라도 <b className="text-[#0A0A0A]">신고는 해두는 것</b>이 취득가액 입증·자금출처 대비에 유리합니다. (세부 판단은 세무사 확인 권장)</p></Card>
      </section>
      <div className="masonry mb-6">
        <Card>
          <h4 className="text-[15px] font-bold mb-3">표준 증여 타임라인 — 총 1.4억 비과세</h4>
          <div className="space-y-3">
            {[
              ["출생 직후", "2,000만", "복리 기간 극대화 — 지수·우량주로 장기 방치가 정석"],
              ["만 10세", "2,000만", "10년 경과로 공제 리셋 — 2회차 증여"],
              ["만 20세", "5,000만", "성인 공제로 상향 — ISA·연금저축 개설 가능해짐"],
              ["만 30세", "5,000만", "결혼 시엔 혼인 증여공제 1억이 별도로 추가"],
            ].map(([when, amt, note], i) => (<div key={i} className="flex items-start gap-3">
              <span className="font-mono text-[11px] font-bold bg-[#F0F0F0] rounded-full px-2.5 py-1 shrink-0 w-20 text-center">{when}</span>
              <div className="min-w-0"><b className="text-[14px]">{amt}</b><p className="text-[13px] text-[#525252] leading-relaxed">{note}</p></div>
            </div>))}
          </div>
        </Card>
        <Card>
          <h4 className="text-[15px] font-bold mb-3">어디에 넣어줄까</h4>
          <ul className="space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed">
            <li className="flex gap-2"><Icon name="chevron" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>미성년 주식계좌 (1순위)</b> — 증여 후 발생한 수익엔 증여세가 안 붙어요. 지수 ETF·우량주 장기 보유가 정석. 단, 부모가 잦은 매매를 하면 차명계좌·추가증여로 볼 여지가 있으니 사고 묵히기.</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>청약통장</b> — 미성년도 가입 가능하지만 성인 전 인정은 최대 2년/24회라 <b>만 17세 무렵 가입이 효율적</b>. 월 10만원 자동이체.</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>연금저축</b> — 만 19세부터(무소득도 가입 가능, 세액공제는 소득 필요). 성인 증여분(20세 5,000만)의 장기 운용처로 적합.</span></li>
            <li className="flex gap-2"><Icon name="chevron" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>ISA</b> — 만 19세 이상(15세+ 근로소득자 예외)이라 <b>미성년기엔 개설 불가</b>. 성인 이후 절세 운용처.</span></li>
          </ul>
        </Card>
        <Card>
          <h4 className="text-[15px] font-bold mb-3">주의사항</h4>
          <ul className="space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed">
            <li className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>신고 기한 3개월</b> — 증여일이 속한 달 말일부터 3개월 내 홈택스 신고. 공제 내라도 신고해야 이후 수익의 원본 입증이 깔끔해요.</span></li>
            <li className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>유기정기금 활용</b> — "매월 ○만원씩 ○년" 약정 증여는 미래분이 할인 평가돼 같은 공제로 더 많이 넣을 수 있어요(예: 미성년 2,000만 공제로 월 18만×10년 수준).</span></li>
            <li className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>증여는 반환 불가</b> — 자녀 돈이에요. 급할 때 꺼내 쓰면 반환·재증여 문제가 생깁니다.</span></li>
            <li className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>세대생략 할증</b> — 조부모→손주 증여는 산출세액의 30% 할증(미성년+20억 초과분 40%).</span></li>
            <li className="flex gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0 text-[#8A8A8A]" /><span><b>교육비·용돈과 구분</b> — 통상적인 부양·교육비는 증여가 아니지만, 저축·투자로 쌓이면 증여로 봅니다.</span></li>
          </ul>
        </Card>
        <Card>
          <h4 className="text-[15px] font-bold mb-1">자녀 증여세 계산기</h4>
          <p className="text-[13px] text-[#8A8A8A] mb-4">직계존속 → 자녀 기준 (10년 합산)</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Field label="증여액(만원)" value={giftCalc.amount} onChange={v => setGiftCalc({ ...giftCalc, amount: v })} step={500} />
            <Field label="10년 내 기증여(만원)" value={giftCalc.used} onChange={v => setGiftCalc({ ...giftCalc, used: v })} step={500} />
            <Toggle label="자녀 나이" active={!giftCalc.adult} onClick={() => setGiftCalc({ ...giftCalc, adult: !giftCalc.adult })} activeText="미성년 (2천만)" inactiveText="성인 (5천만)" />
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            <Stat label="잔여 공제" value={won(remaining * 10000)} />
            <Stat label="공제 초과 과세대상" value={won(taxable)} />
            <Stat label="예상 증여세" value={tax > 0 ? won(tax) : "0원 · 비과세 범위"} tone={tax > 0 ? "warn" : "good"} />
          </div>
        </Card>
      </div>
      </>);
    })()}

    {tab === "info" && (<>
      <section className="mb-6">
        <SectionHeader eyebrow="School District" title="학군지 정보" />
        <Card className="mb-4"><p className="text-[14px] text-[#525252] leading-relaxed">과천 거주 기준으로 현실적인 학군지 후보를 정리했어요. <b className="text-[#0A0A0A]">학군지 이사는 내 집 마련 입주 시점과 묶어서</b> 판단하는 게 비용 면에서 유리합니다.</p></Card>
        <div className="masonry">
          {SCHOOL_DISTRICTS.map((d, i) => (<Card key={i} className="h-full flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-[16px] font-bold">{d.area}</div>
              <div className="flex gap-1 flex-wrap justify-end">{d.tags.map(t => <ToneBadge key={t} tone={t === "거주 예정지" ? "good" : "neutral"}>{t}</ToneBadge>)}</div>
            </div>
            <p className="text-[14px] text-[#3D3D3D] leading-relaxed mb-3 flex-1">{d.note}</p>
            <div className="mt-auto flex gap-3">
              <a href={naverSearch(d.q)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold underline underline-offset-4">학군 검색</a>
              <a href={naverBlog(`${d.area} 학군 이사 후기`)} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4">이사 후기</a>
            </div>
          </Card>))}
        </div>
        <div className="mt-3"><InfoNote>학군 정보는 2026년 리서치 기준 참고용이에요. 실제 배정·학원가 상황은 시기별로 달라지니 이사 결정 전 현장 확인을 권장합니다.</InfoNote></div>
      </section>
      <div className="masonry">
        <NewsPanel query="출산 육아 지원 정책" eyebrow="놓치는 지원 없게" title="출산·육아 정책 뉴스" />
        <NewsPanel query="학군 교육 정책" eyebrow="교육 동향" title="학군·교육 뉴스" />
      </div>
    </>)}

    <div className="masonry"><CustomNotes themeId="kids" /></div>
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
function summarizeKids() {
  const checklist = store.get("kids-checklist-v1", null);
  const total = checklist ? checklist.reduce((s, g) => s + g.items.length, 0) : KIDS_CHECKLIST_DEFAULT.reduce((s, g) => s + g.items.length, 0);
  const done = checklist ? checklist.reduce((s, g) => s + g.items.filter(i => i.done).length, 0) : 0;
  const next = checklist ? (checklist.flatMap(g => g.items).find(i => !i.done) || {}).text : KIDS_CHECKLIST_DEFAULT[0].items[0];
  return { total, done, next: next || "모두 완료" };
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

/* ============== 전체 로드맵 (게이지) ============== */
// Phase별 목표 기간 대비 시간 진행(마커)과 체크 진행(채움)을 한 게이지에 표시.
// themeId가 있는 단계는 해당 테마 화면 상단에도 같은 게이지로 노출된다.
const ROADMAP_DEFAULT = [
  { title: "결혼", themeId: "wedding", start: "2026-07-01", end: "2027-10-31", items: ["상견례·예식 시기 합의", "웨딩홀 투어·가계약", "스드메·본식 스냅 계약", "청첩장·모임", "결혼식", "신혼여행", "혼인신고 (대출 유불리 검토 후)"] },
  { title: "내 집 마련", themeId: "realty", start: "2027-01-01", end: "2030-12-31", items: ["첫 전세 계약 (과천 59㎡ 기준)", "청약 상시 도전 (과천 신규 공급)", "자금 축적 (ISA·절세계좌)", "매매 또는 청약 당첨", "입주·대출 상환계획 확정"] },
  { title: "자녀 계획", themeId: "kids", start: "2028-01-01", end: "2032-12-31", items: ["자녀 계획 부부 합의", "신생아 특공·특례대출 요건 확인", "임신·출산", "출산·육아 지원 정책 신청", "어린이집 입소 대기 등록"] },
];
const roadmapInit = () => ROADMAP_DEFAULT.map(p => ({ id: uid(), ...p, items: p.items.map(t => ({ id: uid(), text: t, done: false })) }));

function phaseCalc(p) {
  const total = p.items.length;
  const done = p.items.filter(it => it.done).length;
  const now = Date.now();
  const st = p.start ? new Date(p.start + "T00:00:00").getTime() : null;
  const en = p.end ? new Date(p.end + "T23:59:59").getTime() : null;
  const timeR = st && en && en > st ? Math.max(0, Math.min(1, (now - st) / (en - st))) : null;
  const doneR = total ? done / total : 0;
  const status = st && now < st ? "next" : en && now > en ? "past" : "now";
  const behind = timeR != null && doneR < timeR - 0.08; // 시간 진행보다 체크가 늦으면 경고
  return { total, done, timeR, doneR, status, behind };
}

function GaugeBar({ doneR, timeR, height = 12 }) {
  return (<div className="relative rounded-full bg-[#ECECEC]" style={{ height }}>
    <div className="h-full rounded-full bg-[#0A0A0A] transition-all" style={{ width: `${Math.round(doneR * 100)}%` }} />
    {timeR != null && (<div className="absolute w-[2px] bg-[#0A0A0A]" style={{ left: `calc(${Math.round(timeR * 100)}% - 1px)`, top: -4, bottom: -4 }}>
      <span className="absolute -top-[15px] left-1/2 -translate-x-1/2 font-mono text-[9px] font-semibold text-[#8A8A8A] whitespace-nowrap">오늘</span>
    </div>)}
  </div>);
}

function PhaseGaugeRow({ p, readonly, onToggleNext, children }) {
  const { total, done, timeR, doneR, status, behind } = phaseCalc(p);
  const next = p.items.find(it => !it.done);
  return (<>
    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[15px] font-bold truncate">{p.title}</span>
        {status === "now" && <span className="text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full shrink-0">진행 중</span>}
        {status === "next" && <span className="text-[10px] font-semibold text-[#B0B0B0] shrink-0">예정</span>}
        {status === "past" && <span className="text-[10px] font-semibold text-[#8A8A8A] shrink-0">{doneR >= 1 ? "완료" : "기간 지남"}</span>}
      </div>
      <span className="font-mono text-[11px] text-[#8A8A8A] shrink-0">{p.start || "미정"} ~ {p.end || "미정"} · {done}/{total}</span>
    </div>
    <div className="pt-4"><GaugeBar doneR={doneR} timeR={timeR} /></div>
    <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
      <div className="text-[12px] text-[#525252] min-w-0">
        {next ? (<span className="flex items-center gap-1.5">
          {!readonly && onToggleNext && <button onClick={onToggleNext} title="완료 처리" className="shrink-0 text-[#C9C9C9] hover:text-[#0A0A0A]"><Icon name="square" size={14} /></button>}
          지금 할 일: <b className="text-[#0A0A0A] truncate">{next.text}</b>
        </span>) : <span>이 단계 할 일을 모두 끝냈어요 🎉</span>}
      </div>
      <span className={`text-[11px] font-semibold shrink-0 ${behind ? "text-[#0A0A0A] underline underline-offset-2" : "text-[#8A8A8A]"}`}>
        {timeR != null ? `시간 ${Math.round(timeR * 100)}% · ` : ""}체크 {Math.round(doneR * 100)}%{status === "now" ? (behind ? " — 일정보다 늦어요" : " — 순항 중") : ""}
      </span>
    </div>
    {children}
  </>);
}

function Roadmap() {
  const [phases, setPhases] = usePersist("roadmap-v2", roadmapInit());
  const [openId, setOpenId] = useState(null); // 펼쳐서 편집 중인 phase
  const [drafts, setDrafts] = useState({});
  const [showDone, setShowDone] = useState(false); // 완료 단계 표시 여부
  const scrollRef = useRef(null);
  const [idx, setIdx] = useState(0);

  const isDone = (p) => p.items.length > 0 && p.items.every(it => it.done);
  const visible = showDone ? phases : phases.filter(p => !isDone(p));
  const hiddenCount = phases.filter(isDone).length;

  const scrollTo = (i) => {
    const el = scrollRef.current;
    if (!el) return;
    const n = Math.max(0, Math.min(visible.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  useEffect(() => { // 최초 진입 시 '진행 중' 단계로 이동
    const el = scrollRef.current;
    if (!el) return;
    const cur = visible.findIndex(p => phaseCalc(p).status === "now" && p.items.some(it => !it.done));
    if (cur > 0) { el.scrollTo({ left: cur * el.clientWidth }); setIdx(cur); }
  }, []);

  const patchPhase = (id, k, v) => setPhases(phases.map(p => p.id === id ? { ...p, [k]: v } : p));
  const toggleItem = (pid, iid) => setPhases(phases.map(p => p.id !== pid ? p : { ...p, items: p.items.map(it => it.id === iid ? { ...it, done: !it.done } : it) }));
  const removeItem = (pid, iid) => setPhases(phases.map(p => p.id !== pid ? p : { ...p, items: p.items.filter(it => it.id !== iid) }));
  const addItem = (pid) => {
    const text = (drafts[pid] || "").trim();
    if (!text) return;
    setPhases(phases.map(p => p.id !== pid ? p : { ...p, items: [...p.items, { id: uid(), text, done: false }] }));
    setDrafts({ ...drafts, [pid]: "" });
  };
  const addPhase = () => {
    const id = uid();
    setPhases([...phases, { id, title: "새 단계", start: "", end: "", items: [] }]);
    setOpenId(id);
    setTimeout(() => scrollTo(visible.length), 50); // 새 단계로 이동
  };

  return (<section>
    <div className="flex items-end justify-between gap-3 mb-4">
      <SectionHeader eyebrow="Life Roadmap" title="전체 로드맵" />
      <div className="mb-4 flex items-center gap-1.5 shrink-0">
        {hiddenCount > 0 && (<button onClick={() => { setShowDone(!showDone); setIdx(0); if (scrollRef.current) scrollRef.current.scrollTo({ left: 0 }); }}
          className="h-8 px-3 rounded-full bg-white shadow-sm text-[12px] font-semibold text-[#8A8A8A] hover:text-[#0A0A0A]">
          {showDone ? "완료 숨기기" : `완료 ${hiddenCount}개 보기`}
        </button>)}
        <button onClick={() => scrollTo(idx - 1)} disabled={idx <= 0}
          className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] disabled:opacity-30">
          <Icon name="chevron" size={14} className="rotate-180" />
        </button>
        <button onClick={() => scrollTo(idx + 1)} disabled={idx >= visible.length - 1}
          className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] disabled:opacity-30">
          <Icon name="chevron" size={14} />
        </button>
        <button onClick={addPhase} title="단계 추가"
          className="w-8 h-8 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center hover:opacity-80">
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>

    {visible.length === 0 && (<Card className="text-center !py-8"><span className="text-[14px] text-[#8A8A8A]">모든 단계를 완료했어요 🎉 "완료 {hiddenCount}개 보기"로 지난 단계를 볼 수 있어요.</span></Card>)}

    <div ref={scrollRef} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
      {visible.map((p) => {
        const phaseNo = phases.findIndex(x => x.id === p.id) + 1;
        return (<div key={p.id} className="w-full shrink-0 snap-center min-w-0">
        <Card className="!py-4">
          <div className="flex items-start gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#8A8A8A] mt-1 shrink-0 w-14">Phase {phaseNo}</span>
            <div className="flex-1 min-w-0">
              <PhaseGaugeRow p={p} onToggleNext={() => { const n = p.items.find(it => !it.done); if (n) toggleItem(p.id, n.id); }} />
            </div>
            <button onClick={() => setOpenId(openId === p.id ? null : p.id)} title="자세히·편집"
              className={`shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors ${openId === p.id ? "bg-[#0A0A0A] text-white" : "text-[#8A8A8A] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"}`}>
              {openId === p.id ? "닫기" : "편집"}
            </button>
          </div>
          {openId === p.id && (<div className="mt-4 pt-4 border-t border-[#F0F0F0] lg:pl-16">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              <div className="col-span-2"><label className="text-[11px] text-[#8A8A8A] block mb-1">단계 이름</label><TextInput value={p.title} onChange={v => patchPhase(p.id, "title", v)} /></div>
              <div><label className="text-[11px] text-[#8A8A8A] block mb-1">시작일</label><input type="date" value={p.start || ""} onChange={e => patchPhase(p.id, "start", e.target.value)} className="w-full h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" /></div>
              <div><label className="text-[11px] text-[#8A8A8A] block mb-1">목표일</label><input type="date" value={p.end || ""} onChange={e => patchPhase(p.id, "end", e.target.value)} className="w-full h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" /></div>
            </div>
            <ul className="space-y-2 mb-3">
              {p.items.map(it => (<li key={it.id} className="flex items-start gap-1.5 group">
                <button onClick={() => toggleItem(p.id, it.id)} className="flex items-start gap-2 text-left flex-1">
                  {it.done ? <Icon name="check2" size={16} className="mt-0.5 shrink-0 text-[#0A0A0A]" /> : <Icon name="square" size={16} className="mt-0.5 shrink-0 text-[#C9C9C9]" />}
                  <span className={`text-[13px] leading-relaxed ${it.done ? "line-through text-[#B0B0B0]" : "text-[#3D3D3D]"}`}>{it.text}</span>
                </button>
                <IconBtn name="trash" title="삭제" onClick={() => removeItem(p.id, it.id)} className="!w-6 !h-6 opacity-0 group-hover:opacity-100" />
              </li>))}
            </ul>
            <div className="flex gap-1.5">
              <TextInput value={drafts[p.id] || ""} onChange={v => setDrafts({ ...drafts, [p.id]: v })} placeholder="항목 추가" className="flex-1 min-w-0 !h-9 !text-[13px]" />
              <button onClick={() => addItem(p.id)} className="h-9 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0">추가</button>
              <button onClick={() => window.confirm(`"${p.title}" 단계를 삭제할까요?`) && setPhases(phases.filter(x => x.id !== p.id))} className="h-9 px-3 rounded-lg border border-[#E5E5E5] text-[13px] font-semibold text-[#8A8A8A] hover:text-[#0A0A0A] shrink-0">단계 삭제</button>
            </div>
          </div>)}
        </Card>
      </div>); })}
    </div>

    {visible.length > 1 && (<div className="flex items-center justify-center gap-1.5 mt-3">
      {visible.map((p, i) => (<button key={p.id} onClick={() => scrollTo(i)} title={p.title}
        className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-[#0A0A0A]" : "w-1.5 bg-[#C9C9C9] hover:bg-[#8A8A8A]"}`} />))}
    </div>)}

  </section>);
}

// 각 테마 상단 게이지 — 홈 로드맵과 같은 데이터(roadmap-v2)를 읽어 해당 단계만 표시
function PhaseGauge({ themeId }) {
  const [phases] = usePersist("roadmap-v2", roadmapInit());
  const p = phases.find(x => x.themeId === themeId);
  if (!p) return null;
  return (<Card className="mb-6 !py-4"><PhaseGaugeRow p={p} readonly /></Card>);
}

/* ============== 테마: 홈 ============== */
function HomeTheme({ setTheme, hh, setHh, privacy }) {
  const [alloc, setAlloc] = usePersist("home-alloc-v1", ALLOC_DEFAULT);
  const [milestones, setMilestones] = usePersist("milestones-v1", MILESTONES_DEFAULT);
  const [newMs, setNewMs] = useState({ label: "", date: "" });

  const realty = computeDiagnosis(hh);
  const saving = summarizeSaving();
  const wedding = summarizeWedding();
  const kids = summarizeKids();

  const allocated = alloc.realty + alloc.saving + alloc.wedding + (alloc.kids || 0);
  const free = alloc.totalCash - allocated;
  const over = free < 0;
  const pct = (v) => alloc.totalCash > 0 ? Math.round(v / alloc.totalCash * 100) : 0;
  const segs = THEMES.map(t => ({ id: t.id, label: t.label, value: alloc[t.id] || 0, color: t.color }));

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
    <Roadmap />

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
      <Kpi icon="piggy" label="총 현금 자산" value={<Blur on={privacy}>{manWon(alloc.totalCash)}</Blur>} accent="#0A0A0A" />
      <Kpi icon="calc" label={over ? "배분 초과" : "남은 여유자금"} value={<Blur on={privacy}>{over ? <>-{manWon(-free)}</> : manWon(free)}</Blur>} accent="#4B4B4B" />
      <Kpi icon="heart" label="결혼식 D-Day" value={wedding.d === null ? "미정" : ddayText(wedding.d)} accent="#8A8A8A" />
      <Kpi icon="trending" label="절세계좌 잔액" value={<Blur on={privacy}>{manWon(saving.totalBalance)}</Blur>} accent="#C6C6C6" />
    </div>

    <section>
      <SectionHeader eyebrow="Couple Profile" title="우리 부부 정보" />
      <Card className={privacy ? "privacy-on" : ""}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label={`${hh.label1 || "본인"} 연소득(만원)`} value={hh.income1} onChange={v => setHh({ income1: v })} />
          <Field label={`${hh.label2 || "배우자"} 연소득(만원)`} value={hh.income2} onChange={v => setHh({ income2: v })} />
          <Field label="현재 순자산(만원)" value={hh.assets} onChange={v => setHh({ assets: v })} />
          <Field label="월 저축가능액(만원)" value={hh.monthlySave} onChange={v => setHh({ monthlySave: v })} />
          <Field label="기존 대출 월상환(만원)" value={hh.existingDebtMonthly} onChange={v => setHh({ existingDebtMonthly: v })} />
        </div>
        <div className="mt-4 pt-4 border-t border-[#F0F0F0] flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-[14px] text-[#8A8A8A]">부부합산 월소득(세전) <b className="text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums" }}><Blur on={privacy}>{won(Math.round((hh.income1 + hh.income2) * 10000 / 12))}</Blur></b></span>
          <span className="text-[14px] text-[#8A8A8A]">세후 추정 <b className="text-[#0A0A0A]" style={{ fontVariantNumeric: "tabular-nums" }}><Blur on={privacy}>{won(Math.round((estimateNetAnnual(hh.income1 * 10000) + estimateNetAnnual(hh.income2 * 10000)) / 12))}</Blur></b></span>
          <span className="text-[12px] text-[#B0B0B0] lg:ml-auto">이 값은 부동산 진단 · 대출 · 정책 판정 등 모든 탭에 실시간 반영됩니다</span>
        </div>
      </Card>
    </section>

    <section>
      <SectionHeader eyebrow="Allocation" title="자금 배분" />
      <Card className={privacy ? "privacy-on" : ""}>
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
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{pct(s.value)}%</b><span className="text-[#8A8A8A]">· <Blur on={privacy}>{manWon(s.value)}</Blur></span>
            </span>))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] inline-block bg-[#F0F0F0] border border-[#E0E0E0]" />
              <span className="text-[#525252]">여유</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{Math.max(0, pct(free))}%</b>
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-4 border-t border-[#F0F0F0]">
            <Field label="총 현금(만원)" value={alloc.totalCash} onChange={v => setAlloc({ ...alloc, totalCash: v })} step={1000} />
            <Field label="부동산 배정(만원)" value={alloc.realty} onChange={v => setAlloc({ ...alloc, realty: v })} step={1000} />
            <Field label="돈 모으기 배정(만원)" value={alloc.saving} onChange={v => setAlloc({ ...alloc, saving: v })} step={500} />
            <Field label="결혼식 배정(만원)" value={alloc.wedding} onChange={v => setAlloc({ ...alloc, wedding: v })} step={500} />
            <Field label="자녀 배정(만원)" value={alloc.kids || 0} onChange={v => setAlloc({ ...alloc, kids: v })} step={500} />
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
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">필요 자기자본</div><div className="text-[13px] font-bold"><Blur on={privacy}>{wonShort(realty.requiredCash)}</Blur></div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">자기자본 갭</div><div className="text-[13px] font-bold"><Blur on={privacy}>{realty.gap > 0 ? wonShort(realty.gap) : "충족"}</Blur></div></div>
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
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">절세계좌 잔액</div><div className="text-[13px] font-bold"><Blur on={privacy}>{manWon(saving.totalBalance)}</Blur></div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">올해 납입</div><div className="text-[13px] font-bold"><Blur on={privacy}>{manWon(saving.totalPaid)}</Blur></div></div>
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
        {/* 자녀 */}
        <button onClick={() => setTheme("kids")} className="w-full text-left">
          <Card className="hover:border-[#0A0A0A]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: "#8F8F8F" }}><Icon name="child" size={17} /></span>
                <div><div className="text-[16px] font-bold">자녀</div><div className="text-[12px] text-[#8A8A8A]">{themeOf("kids").desc}</div></div>
              </div>
              <Icon name="chevron" size={18} className="text-[#8A8A8A]" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">할 일 진행률</div><div className="text-[13px] font-bold">{kids.done}/{kids.total}</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">달성률</div><div className="text-[13px] font-bold">{kids.total > 0 ? Math.round(kids.done / kids.total * 100) : 0}%</div></div>
              <div className="bg-[#F7F7F7] rounded-xl py-2.5 px-1"><div className="text-[11px] text-[#8A8A8A] mb-0.5">다음 할 일</div><div className="text-[13px] font-bold truncate px-1">{kids.next}</div></div>
            </div>
          </Card>
        </button>
      </div>
    </section>

    <section>
      <SectionHeader eyebrow="전체 일정" title="통합 타임라인" />
      <div className="grid sm:grid-cols-2 gap-3 items-start">
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
        <Card className="sm:col-span-2">
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
  </>);
}

/* ============== main app (테마 라우터) ============== */
/* ============== 테마: 가계부 ============== */
const LEDGER_CATS = [
  ["food", "🍚 식비"], ["cafe", "☕ 카페·간식"], ["transport", "🚗 교통·차량"], ["shopping", "🛍 쇼핑"],
  ["living", "🧺 생활·마트"], ["culture", "🎬 문화·여가"], ["medical", "💊 의료·건강"], ["event", "💌 경조사·선물"],
  ["house", "🏠 주거·통신"], ["etc", "📦 기타"],
];
const LEDGER_INCOME_CATS = [
  ["salary", "💼 급여"], ["bonus", "🎁 상여·보너스"], ["side", "💡 부수입"], ["invest", "📈 금융수입"], ["etcin", "📦 기타수입"],
];
const ledgerCatLabel = (id) => ((LEDGER_CATS.find(c => c[0] === id) || LEDGER_INCOME_CATS.find(c => c[0] === id)) || ["", "📦 기타"])[1];
const isIncomeEntry = (e) => e.type === "in";
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const wonComma = (n) => (Number(n) || 0).toLocaleString() + "원";
const wonCell = (n) => n >= 10000 ? (Math.round(n / 1000) / 10) + "만" : n >= 1000 ? Math.round(n / 1000) + "천" : String(n);

function LedgerTheme({ privacy }) {
  const today = new Date();
  const [entries, setEntries] = usePersist("ledger-entries-v1", []); // {id, date:"YYYY-MM-DD", amount(원), cat, memo, type?("in"=수입, 없으면 지출), fixedId?}
  const [fixed, setFixed] = usePersist("ledger-fixed-v1", []); // 고정 항목: {id, memo, amount(원), cat, day(1~31), type?}
  const [budget, setBudget] = usePersist("ledger-budget-v1", {}); // 카테고리별 월 예산(원)
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selDay, setSelDay] = useState(ymd(today.getFullYear(), today.getMonth(), today.getDate()));
  const [nv, setNv] = useState({ amount: "", cat: "food", memo: "", type: "exp" });
  const [nf, setNf] = useState({ memo: "", amount: "", cat: "house", day: "1", type: "exp" });

  // 고정지출 자동 기입 — 이번 달에 아직 없는 항목만 생성 (fixedId+월 기준으로 멱등, 새 달 첫 방문 시 자동)
  const nowKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (!fixed.length) return;
    const missing = fixed.filter(f => !entries.some(e => e.fixedId === f.id && (e.date || "").startsWith(nowKey)));
    if (!missing.length) return;
    const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    setEntries([...entries, ...missing.map(f => ({
      id: uid(), fixedId: f.id, date: ymd(today.getFullYear(), today.getMonth(), Math.min(Math.max(1, Number(f.day) || 1), dim)),
      amount: Number(f.amount) || 0, cat: f.cat, memo: f.memo, at: Date.now(),
      ...(f.type === "in" ? { type: "in" } : {}),
    }))]);
  }, [fixed, entries]);
  const addFixed = () => {
    const amount = Number(String(nf.amount).replace(/[^0-9]/g, ""));
    if (!amount || !nf.memo.trim()) return;
    setFixed([...fixed, { id: uid(), memo: nf.memo.trim(), amount, cat: nf.cat, day: Math.min(31, Math.max(1, Number(nf.day) || 1)), ...(nf.type === "in" ? { type: "in" } : {}) }]);
    setNf({ memo: "", amount: "", cat: nf.cat, day: nf.day, type: nf.type });
  };

  const moveMonth = (d) => setCur(({ y, m }) => {
    const dt = new Date(y, m + d, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const monthKey = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
  const monthEntries = entries.filter(e => (e.date || "").startsWith(monthKey));
  const monthExpEntries = monthEntries.filter(e => !isIncomeEntry(e));
  const byDay = {};
  monthExpEntries.forEach(e => { const d = Number(e.date.slice(8, 10)); byDay[d] = (byDay[d] || 0) + (Number(e.amount) || 0); });
  const monthExp = monthExpEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthInc = monthEntries.filter(isIncomeEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthTotal = monthExp; // 지출 기준 (달력·비중 계산용)
  const daysPassed = (cur.y === today.getFullYear() && cur.m === today.getMonth()) ? today.getDate() : new Date(cur.y, cur.m + 1, 0).getDate();
  const catTotals = LEDGER_CATS.map(([id, label]) => ({ id, label, sum: monthExpEntries.filter(e => e.cat === id).reduce((s, e) => s + (Number(e.amount) || 0), 0) }))
    .filter(c => c.sum > 0).sort((a, b) => b.sum - a.sum);
  const topCat = catTotals[0];
  const totalBudget = Object.values(budget).reduce((s, v) => s + (Number(v) || 0), 0); // 월 총 예산

  // 전월 대비 (지출)
  const prevDt = new Date(cur.y, cur.m - 1, 1);
  const prevKey = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, "0")}`;
  const prevExp = entries.filter(e => (e.date || "").startsWith(prevKey) && !isIncomeEntry(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // 최근 6개월 월별 지출 합계 — 소비 추이
  const recentMonths = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(cur.y, cur.m - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    recentMonths.push({ key, label: `${dt.getMonth() + 1}월`, sum: entries.filter(e => (e.date || "").startsWith(key) && !isIncomeEntry(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0) });
  }
  const maxMonth = Math.max(1, ...recentMonths.map(m => m.sum));

  // 월말 정산용 CSV 내보내기 (엑셀 호환 BOM)
  const exportCsv = () => {
    const rows = [["날짜", "유형", "카테고리", "메모", "금액(원)"],
      ...monthEntries.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(e =>
        [e.date, isIncomeEntry(e) ? "수입" : "지출", ledgerCatLabel(e.cat).replace(/^\S+\s/, ""), String(e.memo || "").replace(/"/g, '""'), e.amount])];
    const csv = "\ufeff" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `가계부_${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const firstDow = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const dayEntries = entries.filter(e => e.date === selDay).sort((a, b) => (b.at || 0) - (a.at || 0));
  const addEntry = () => {
    const amount = Number(String(nv.amount).replace(/[^0-9]/g, ""));
    if (!amount) return;
    setEntries([...entries, { id: uid(), date: selDay, amount, cat: nv.cat, memo: nv.memo.trim(), at: Date.now(), ...(nv.type === "in" ? { type: "in" } : {}) }]);
    setNv({ amount: "", cat: nv.cat, memo: "", type: nv.type });
  };
  const isToday = (d) => cur.y === today.getFullYear() && cur.m === today.getMonth() && d === today.getDate();

  return (<>
    <section className="mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon="wallet" label={`${cur.m + 1}월 지출`} value={<Blur on={privacy}>{wonComma(monthExp)}</Blur>} />
        <Kpi icon="trending" label={`${cur.m + 1}월 수입`} value={<Blur on={privacy}>{monthInc > 0 ? "+" + wonComma(monthInc) : "0원"}</Blur>} accent="#525252" />
        <Kpi icon="calc" label="수지 (수입−지출)" value={<Blur on={privacy}>{(monthInc - monthExp >= 0 ? "+" : "−") + wonComma(Math.abs(monthInc - monthExp))}</Blur>} accent="#8A8A8A" />
        <Kpi icon="check2" label={totalBudget > 0 ? "예산 남음" : "일평균 지출"} value={<Blur on={privacy}>{totalBudget > 0
          ? (monthExp > totalBudget ? "−" : "") + wonComma(Math.abs(totalBudget - monthExp))
          : wonComma(Math.round(monthExp / Math.max(1, daysPassed)))}</Blur>} accent={totalBudget > 0 && monthExp > totalBudget ? "#C96A6A" : "#B0B0B0"} />
      </div>
    </section>

    <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">
      <section className="lg:col-span-3 mb-6 lg:mb-0">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => moveMonth(-1)} className="w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center"><Icon name="chevron" size={16} className="rotate-180" /></button>
            <div className="text-[17px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{cur.y}년 {cur.m + 1}월</div>
            <div className="flex items-center gap-1">
              <button onClick={exportCsv} title="이 달 내역 CSV로 내보내기 (엑셀 호환)" className="h-9 px-2.5 rounded-lg hover:bg-[#F5F5F5] text-[12px] font-bold text-[#8A8A8A]">CSV</button>
              <button onClick={() => moveMonth(1)} className="w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center"><Icon name="chevron" size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[#8A8A8A] mb-2">
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => <div key={d} className={i === 0 ? "text-[#C96A6A]" : ""}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={"e" + i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1, key = ymd(cur.y, cur.m, d), sel = selDay === key;
              return (<button key={d} onClick={() => setSelDay(key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${sel ? "bg-[#0A0A0A] text-white" : isToday(d) ? "bg-[#F0F0F0] hover:bg-[#E5E5E5]" : "hover:bg-[#F5F5F5]"}`}>
                <span className={`text-[13px] font-semibold ${!sel && new Date(cur.y, cur.m, d).getDay() === 0 ? "text-[#C96A6A]" : ""}`}>{d}</span>
                {byDay[d] ? <span className={`text-[10px] font-mono font-semibold ${sel ? "text-white/70" : "text-[#8A8A8A]"} ${privacy ? "money-blur" : ""}`}>{wonCell(byDay[d])}</span> : <span className="text-[10px]"> </span>}
              </button>);
            })}
          </div>
        </Card>
      </section>

      <section className="lg:col-span-2">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[15px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{Number(selDay.slice(5, 7))}월 {Number(selDay.slice(8, 10))}일</h4>
            <span className="font-mono text-[13px] font-bold"><Blur on={privacy}>{wonComma(dayEntries.filter(e => !isIncomeEntry(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0))}{(() => { const inc = dayEntries.filter(isIncomeEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0); return inc > 0 ? ` · +${wonComma(inc)}` : ""; })()}</Blur></span>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex gap-1.5">
              {[["exp", "지출"], ["in", "수입"]].map(([t, l]) => (
                <button key={t} onClick={() => setNv({ ...nv, type: t, cat: t === "in" ? "salary" : "food" })}
                  className={`h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${nv.type === t ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#8A8A8A] hover:bg-[#E5E5E5]"}`}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={nv.amount} onChange={v => setNv({ ...nv, amount: v.replace(/[^0-9]/g, "") })} placeholder="금액(원) *" />
              <select value={nv.cat} onChange={e => setNv({ ...nv, cat: e.target.value })}
                className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
                {(nv.type === "in" ? LEDGER_INCOME_CATS : LEDGER_CATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <TextInput value={nv.memo} onChange={v => setNv({ ...nv, memo: v })} placeholder="메모 (예: 점심 · 장보기)" className="flex-1" />
              <button onClick={addEntry} className="h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0 flex items-center gap-1"><Icon name="plus" size={13} /> 기입</button>
            </div>
          </div>
          {dayEntries.length === 0 && <div className="text-[13px] text-[#8A8A8A] py-3 text-center">이 날의 기록이 없어요.</div>}
          <ul className="divide-y divide-[#F5F5F5]">
            {dayEntries.map(e => (<li key={e.id} className="flex items-center gap-2.5 py-2.5">
              <span className="text-[13px] shrink-0">{ledgerCatLabel(e.cat)}</span>
              <span className="text-[13px] text-[#8A8A8A] flex-1 min-w-0 truncate">{e.fixedId ? "🔁 " : ""}{e.memo || "-"}</span>
              <span className="font-mono text-[13px] font-bold shrink-0"><Blur on={privacy}>{isIncomeEntry(e) ? "+" : ""}{wonComma(e.amount)}</Blur></span>
              <IconBtn name="trash" title="삭제" onClick={() => setEntries(entries.filter(x => x.id !== e.id))} className="!w-7 !h-7 shrink-0" />
            </li>))}
          </ul>
        </Card>
      </section>
    </div>

    <section className="mt-6">
      <SectionHeader eyebrow="매달 자동 기입" title="고정 수입·지출 (월세·구독·월급 등)" />
      <Card>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-2">
          <select value={nf.type} onChange={e => { const t = e.target.value; setNf({ ...nf, type: t, cat: t === "in" ? "salary" : "house" }); }}
            className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
            <option value="exp">지출</option><option value="in">수입</option>
          </select>
          <TextInput value={nf.memo} onChange={v => setNf({ ...nf, memo: v })} placeholder="항목명 * (예: 월세·월급)" />
          <TextInput value={nf.amount} onChange={v => setNf({ ...nf, amount: v.replace(/[^0-9]/g, "") })} placeholder="금액(원) *" />
          <select value={nf.cat} onChange={e => setNf({ ...nf, cat: e.target.value })}
            className="h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]">
            {(nf.type === "in" ? LEDGER_INCOME_CATS : LEDGER_CATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-[#8A8A8A] shrink-0">매월</span>
            <TextInput value={nf.day} onChange={v => setNf({ ...nf, day: v.replace(/[^0-9]/g, "") })} placeholder="1" className="!w-14 text-center" />
            <span className="text-[13px] text-[#8A8A8A] shrink-0">일</span>
          </div>
          <button onClick={addFixed} className="h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold flex items-center justify-center gap-1"><Icon name="plus" size={13} /> 고정지출 등록</button>
        </div>
        {fixed.length === 0 && <div className="text-[13px] text-[#8A8A8A] py-3 text-center">등록된 고정지출이 없어요 — 월세·구독료·통신비 등을 등록하면 매달 자동으로 기입돼요.</div>}
        <ul className="divide-y divide-[#F5F5F5]">
          {fixed.map(f => (<li key={f.id} className="flex items-center gap-2.5 py-2.5">
            <span className="font-mono text-[12px] font-semibold text-[#8A8A8A] shrink-0 w-16">매월 {f.day}일</span>
            <span className="text-[13px] shrink-0">{ledgerCatLabel(f.cat)}</span>
            <span className="text-[14px] font-semibold flex-1 min-w-0 truncate">🔁 {f.memo}</span>
            <span className="font-mono text-[13px] font-bold shrink-0"><Blur on={privacy}>{f.type === "in" ? "+" : ""}{wonComma(f.amount)}</Blur></span>
            <IconBtn name="trash" title="고정지출 해제 (이미 기입된 내역은 유지)" onClick={() => setFixed(fixed.filter(x => x.id !== f.id))} className="!w-7 !h-7 shrink-0" />
          </li>))}
        </ul>
        {fixed.length > 0 && <p className="mt-3 text-[12px] text-[#8A8A8A] leading-relaxed">등록하면 이번 달분이 바로 기입되고, 매달 첫 방문 때 그 달 지정일로 자동 기입돼요(🔁 표시). 해제해도 이미 기입된 내역은 남아요.</p>}
      </Card>
    </section>

    <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start mt-6">
      <section className="mb-6 lg:mb-0">
        <div className="flex items-end justify-between gap-3">
          <SectionHeader eyebrow="소비 패턴" title={`${cur.m + 1}월 카테고리별 지출`} />
          <button onClick={() => setBudgetEdit(!budgetEdit)}
            className={`mb-4 h-8 px-3 rounded-full text-[12px] font-bold shrink-0 transition-colors ${budgetEdit ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`}>
            {budgetEdit ? "설정 완료" : "예산 설정"}</button>
        </div>
        <Card>
          <div className="text-[13px] text-[#8A8A8A] mb-3">지난달 <Blur on={privacy}>{wonComma(prevExp)}</Blur> → 이번달 <Blur on={privacy}>{wonComma(monthExp)}</Blur>
            {prevExp > 0 && <b className={`ml-1 ${monthExp > prevExp ? "text-[#C96A6A]" : "text-[#2E7D5B]"}`}>({monthExp >= prevExp ? "+" : ""}{Math.round((monthExp - prevExp) / prevExp * 100)}%)</b>}
          </div>
          {budgetEdit ? (<>
            <div className="text-[12px] text-[#8A8A8A] mb-2">카테고리별 월 예산(원)을 입력하세요 — 0이면 예산 없음. 합계가 KPI의 "예산 남음"이 돼요.</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {LEDGER_CATS.map(([id, label]) => (<div key={id} className="flex items-center gap-2">
                <span className="text-[13px] w-24 shrink-0">{label}</span>
                <TextInput value={budget[id] ? String(budget[id]) : ""} onChange={v => setBudget({ ...budget, [id]: Number(v.replace(/[^0-9]/g, "")) || 0 })} placeholder="월 예산(원)" className="!h-8 !text-[12px]" />
              </div>))}
            </div>
          </>) : (<>
            {catTotals.length === 0 && <div className="text-[13px] text-[#8A8A8A] py-3 text-center">이 달의 기록이 아직 없어요 — 달력에서 날짜를 눌러 기입해 보세요.</div>}
            <div className="space-y-3">
              {catTotals.map(c => {
                const b = Number(budget[c.id]) || 0, over = b > 0 && c.sum > b;
                return (<div key={c.id}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-semibold">{c.label}{over && <span className="ml-1.5 text-[11px] font-bold text-[#C96A6A]">⚠️ 예산 초과</span>}</span>
                    <span className="font-mono text-[#525252]"><Blur on={privacy}>{wonComma(c.sum)}</Blur> <span className="text-[#B0B0B0]">{b > 0 ? <>/ <Blur on={privacy}>{wonComma(b)}</Blur></> : `(${Math.round(c.sum / Math.max(1, monthTotal) * 100)}%)`}</span></span>
                  </div>
                  <ProgressBar ratio={b > 0 ? Math.min(1, c.sum / b) : c.sum / Math.max(1, monthTotal)} color={over ? "#C96A6A" : "#0A0A0A"} height={5} />
                </div>);
              })}
            </div>
          </>)}
        </Card>
      </section>
      <section>
        <SectionHeader eyebrow="추이" title="최근 6개월 지출" />
        <Card>
          <div className="flex items-end gap-2 h-36 mb-2">
            {recentMonths.map(m => (<div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <span className={`font-mono text-[10px] text-[#8A8A8A] ${privacy ? "money-blur" : ""}`}>{m.sum > 0 ? wonCell(m.sum) : ""}</span>
              <div className="w-full rounded-t-md bg-[#0A0A0A] transition-all" style={{ height: `${Math.max(m.sum > 0 ? 6 : 2, Math.round(m.sum / maxMonth * 100))}%`, opacity: m.key === monthKey ? 1 : 0.35 }} />
              <span className="text-[11px] font-semibold text-[#8A8A8A]">{m.label}</span>
            </div>))}
          </div>
          <p className="text-[12px] text-[#8A8A8A] leading-relaxed">기록은 자동 저장되고, 로그인 시 부부가 함께 보는 가계부로 동기화돼요.</p>
        </Card>
      </section>
    </div>

    <div className="masonry mt-6"><CustomNotes themeId="ledger" /></div>
  </>);
}

const NAV = [{ id: "home", label: "홈", icon: "grid", color: "#0A0A0A" }, ...THEMES, { id: "ledger", label: "가계부", icon: "wallet", color: "#5A5A5A", desc: "달력 가계부 · 일별 기입 · 소비 패턴 분석" }];

function App({ user }) {
  const [theme, setTheme] = usePersist("active-theme-v1", "home");
  const [mapKey, setMapKey] = useState("");
  const [privacy, setPrivacy] = usePersist("privacy-mode-v1", false); // 부부 정보 블러 (기기별)
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  return (<div className="min-h-screen bg-[#F4F4F5] text-[#0A0A0A]" style={{ fontFamily: "'Pretendard','Noto Sans KR',sans-serif" }}>
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
        <button onClick={() => setPrivacy(!privacy)} title="소득·자산 등 부부 정보 블러"
          className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${privacy ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
          <Icon name={privacy ? "eyeOff" : "eye"} size={15} />{privacy ? "블러 해제" : "금액 블러"}
        </button>
        <button onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors">
          <Icon name="settings" size={15} />설정
        </button>
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
            <button onClick={() => setPrivacy(!privacy)} title="부부 정보 블러"
              className={`w-11 h-11 rounded-full flex items-center justify-center border ${privacy ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"}`}>
              <Icon name={privacy ? "eyeOff" : "eye"} size={17} />
            </button>
            <button onClick={() => setSettingsOpen(true)} title="설정"
              className="w-11 h-11 rounded-full flex items-center justify-center border bg-white text-[#525252] border-[#E5E5E5]">
              <Icon name="settings" size={17} />
            </button>
            {user && (user.photoURL
              ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" title={user.email + " · 탭하면 로그아웃"} onClick={() => window.confirm("로그아웃할까요?") && firebase.auth().signOut()} className="w-11 h-11 rounded-full border border-[#E5E5E5] cursor-pointer" />
              : <button onClick={() => window.confirm("로그아웃할까요?") && firebase.auth().signOut()} className="w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-[13px] font-bold">{(user.email || "?")[0].toUpperCase()}</button>)}
          </div>
        </div>
      </header>

      <main className="max-w-[1160px] mx-auto px-5 sm:px-10 py-7 space-y-6">
        {theme === "home" && <HomeTheme setTheme={setTheme} hh={hh} setHh={setHh} privacy={privacy} />}
        {theme === "realty" && <RealtyTheme mapKey={mapKey} hh={hh} setHh={setHh} setTheme={setTheme} privacy={privacy} />}
        {theme === "saving" && <SavingTheme hh={hh} privacy={privacy} />}
        {theme === "wedding" && <WeddingTheme />}
        {theme === "kids" && <KidsTheme />}
        {theme === "ledger" && <LedgerTheme privacy={privacy} />}
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

    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} hh={hh} setHh={setHh} />
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
  // 카카오톡·인스타 등 인앱 브라우저는 Google OAuth가 차단됨(403 disallowed_useragent) — 감지해서 외부 브라우저 안내
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|; wv\)/i.test(ua);
  const openExternal = () => {
    const url = window.location.href;
    if (/KAKAOTALK/i.test(ua)) { window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url); return; }
    if (/android/i.test(ua)) { window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`; return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    alert("주소가 복사됐어요. Safari(또는 Chrome)를 직접 열고 주소창에 붙여넣어 접속해 주세요.");
  };
  const login = () => {
    setErr("");
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => {
      if (e && e.code === "auth/popup-blocked") { firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider()); return; }
      if (e && e.code === "auth/popup-closed-by-user") return;
      setErr(e && e.message);
    });
  };
  return (<AuthShell>
    <div className="font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-[#8A8A8A]">Life Plan · 2026</div>
    <h1 className="text-2xl font-bold tracking-tight mt-2 mb-1.5">우리 라이프 플랜</h1>
    <p className="text-[14px] text-[#8A8A8A] mb-7">허용된 계정만 접근할 수 있어요.</p>
    {inApp && (<div className="mb-5 text-left bg-[#F5F5F5] rounded-xl p-4">
      <div className="text-[13px] font-bold mb-1">지금 앱 안의 브라우저로 열려 있어요</div>
      <p className="text-[12px] text-[#525252] leading-relaxed mb-3">구글 보안 정책상 카카오톡·인스타 등 앱 내 브라우저에서는 구글 로그인이 차단됩니다. 외부 브라우저(Safari·Chrome)로 열면 정상 로그인돼요.</p>
      <button onClick={openExternal} className="w-full h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold">외부 브라우저로 열기</button>
    </div>)}
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
