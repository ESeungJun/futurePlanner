const { useState, useEffect, useRef, useMemo } = React;
let PRIVACY = false;
const blurWrap = (s) => PRIVACY ? /* @__PURE__ */ React.createElement("span", { className: "money-blur", "aria-hidden": "true" }, s) : s;
const wonRaw = (n) => {
  if (n === null || n === void 0 || isNaN(n)) return "-";
  const eok = Math.floor(n / 1e8);
  const man = Math.round(n % 1e8 / 1e4);
  if (eok > 0) return `${eok.toLocaleString()}\uC5B5${man > 0 ? " " + man.toLocaleString() + "\uB9CC" : ""}`;
  return `${man.toLocaleString()}\uB9CC\uC6D0`;
};
const wonShortRaw = (n) => n === null || n === void 0 ? "\uD655\uC778 \uD544\uC694" : (n / 1e8).toFixed(1) + "\uC5B5";
const won = (n) => blurWrap(wonRaw(n));
const wonShort = (n) => blurWrap(wonShortRaw(n));
const manWon = (n) => won((n || 0) * 1e4);
function dday(dateStr) {
  if (!dateStr) return null;
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 864e5);
}
function ddayText(n) {
  if (n === null) return "";
  if (n === 0) return "D-Day";
  return n > 0 ? `D-${n}` : `D+${-n}`;
}
function priceTierCap(price) {
  if (price <= 15e8) return 6e8;
  if (price <= 25e8) return 4e8;
  return 2e8;
}
function loanFromMonthlyPayment(monthlyPayment, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  if (i <= 0) return monthlyPayment * n;
  return monthlyPayment * (1 - Math.pow(1 + i, -n)) / i;
}
const GIFT_TAX_BRACKETS = [
  { upTo: 1e8, rate: 0.1, deduction: 0 },
  { upTo: 5e8, rate: 0.2, deduction: 1e7 },
  { upTo: 1e9, rate: 0.3, deduction: 6e7 },
  { upTo: 3e9, rate: 0.4, deduction: 16e7 },
  { upTo: Infinity, rate: 0.5, deduction: 46e7 }
];
function giftTax(base) {
  if (base <= 0) return 0;
  const b = GIFT_TAX_BRACKETS.find((x) => base <= x.upTo);
  return Math.max(0, base * b.rate - b.deduction);
}
const INCOME_TAX_BRACKETS = [
  { upTo: 14e6, rate: 0.06, deduction: 0 },
  { upTo: 5e7, rate: 0.15, deduction: 126e4 },
  { upTo: 88e6, rate: 0.24, deduction: 576e4 },
  { upTo: 15e7, rate: 0.35, deduction: 1544e4 },
  { upTo: 3e8, rate: 0.38, deduction: 1994e4 },
  { upTo: 5e8, rate: 0.4, deduction: 2594e4 },
  { upTo: 1e9, rate: 0.42, deduction: 3594e4 },
  { upTo: Infinity, rate: 0.45, deduction: 6594e4 }
];
function estimateNetAnnual(grossAnnualWon) {
  const g = Math.max(0, grossAnnualWon);
  const monthlyGross = g / 12;
  const npBase = Math.min(monthlyGross, 637e4);
  const np = npBase * 0.0475;
  const hi = monthlyGross * 0.03595;
  const ltci = hi * 0.1295;
  const ei = monthlyGross * 9e-3;
  const insuranceAnnual = (np + hi + ltci + ei) * 12;
  let deduction;
  if (g <= 5e6) deduction = g * 0.7;
  else if (g <= 15e6) deduction = 35e5 + (g - 5e6) * 0.4;
  else if (g <= 45e6) deduction = 75e5 + (g - 15e6) * 0.15;
  else if (g <= 1e8) deduction = 12e6 + (g - 45e6) * 0.05;
  else deduction = 1475e4 + (g - 1e8) * 0.02;
  const earnedIncomeAmount = Math.max(0, g - deduction);
  const taxBase = Math.max(0, earnedIncomeAmount - 15e5 - insuranceAnnual);
  const b = INCOME_TAX_BRACKETS.find((x) => taxBase <= x.upTo);
  let incomeTax = Math.max(0, taxBase * b.rate - b.deduction);
  let credit = incomeTax <= 13e5 ? incomeTax * 0.55 : 715e3 + (incomeTax - 13e5) * 0.3;
  let creditCap = 74e4;
  if (g > 33e6) creditCap = Math.max(66e4, 74e4 - (g - 33e6) * 8e-3);
  if (g > 7e7) creditCap = Math.max(5e5, 66e4 - (g - 7e7) * 0.5 / 100);
  credit = Math.min(credit, creditCap);
  incomeTax = Math.max(0, incomeTax - credit);
  const totalTax = incomeTax * 1.1;
  return g - insuranceAnnual - totalTax;
}
const store = {
  get(k, def) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
    cloud.queue(k, v);
  }
};
const CLIENT_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const LOCAL_ONLY_KEYS = ["active-theme-v1", "realty-tab-v1", "saving-tab-v1", "wedding-tab-v1", "kids-tab-v1", "naver-map-key", "privacy-mode-v1", "roadmap-view-v1"];
const cloud = {
  enabled: typeof window !== "undefined" && !!(window.FIREBASE_CONFIG && window.firebase),
  db: null,
  user: null,
  pending: {},
  timer: null,
  started: false,
  init() {
    if (!this.enabled || this.started) return;
    this.started = true;
    firebase.initializeApp(window.FIREBASE_CONFIG);
    this.db = firebase.firestore();
  },
  ref() {
    return this.db.collection("households").doc("main");
  },
  queue(k, v) {
    if (!this.enabled || !this.user || LOCAL_ONLY_KEYS.includes(k)) return;
    this.pending[k] = JSON.stringify(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const batch = { ...this.pending, _by: CLIENT_ID, _email: this.user && this.user.email || "", _at: (/* @__PURE__ */ new Date()).toISOString() };
      this.pending = {};
      this.ref().set(batch, { merge: true }).catch((e) => console.warn("\uD074\uB77C\uC6B0\uB4DC \uC800\uC7A5 \uC2E4\uD328:", e && e.message));
    }, 800);
  },
  // 원격 변경 → localStorage 반영 후 onRemote 콜백 (앱 리렌더)
  subscribe(onRemote) {
    if (!this.enabled || !this.user) return () => {
    };
    return this.ref().onSnapshot((snap) => {
      const d = snap.data();
      if (!d || d._by === CLIENT_ID) return;
      let changed = false;
      Object.keys(d).forEach((k) => {
        if (k.startsWith("_") || LOCAL_ONLY_KEYS.includes(k)) return;
        try {
          if (localStorage.getItem(k) !== d[k]) {
            localStorage.setItem(k, d[k]);
            changed = true;
          }
        } catch {
        }
      });
      if (changed) onRemote();
    }, (e) => console.warn("\uD074\uB77C\uC6B0\uB4DC \uC218\uC2E0 \uC624\uB958:", e && e.message));
  },
  // 첫 로그인 시: 클라우드에 있으면 내려받고, 비어 있으면 내 로컬 데이터를 올림
  async pullOnce() {
    if (!this.enabled || !this.user) return false;
    try {
      const snap = await this.ref().get();
      const d = snap.data();
      if (!d || Object.keys(d).filter((k) => !k.startsWith("_")).length === 0) {
        const up = { _by: CLIENT_ID, _email: this.user.email || "", _at: (/* @__PURE__ */ new Date()).toISOString() };
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!LOCAL_ONLY_KEYS.includes(k)) up[k] = localStorage.getItem(k);
        }
        await this.ref().set(up, { merge: true });
        return false;
      }
      let changed = false;
      Object.keys(d).forEach((k) => {
        if (k.startsWith("_") || LOCAL_ONLY_KEYS.includes(k)) return;
        try {
          if (localStorage.getItem(k) !== d[k]) {
            localStorage.setItem(k, d[k]);
            changed = true;
          }
        } catch {
        }
      });
      return changed;
    } catch (e) {
      console.warn("\uCD08\uAE30 \uB3D9\uAE30\uD654 \uC2E4\uD328:", e && e.message);
      return false;
    }
  }
};
function usePersist(key, def) {
  const [v, setV] = useState(() => store.get(key, def));
  useEffect(() => {
    store.set(key, v);
  }, [key, v]);
  return [v, setV];
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const api = (path) => (typeof window !== "undefined" && window.API_BASE || "") + path;
async function loadCheongyak() {
  try {
    const r = await fetch(api("/api/cheongyak"));
    if (r.ok) {
      const j = await r.json();
      if (j.items && j.items.length) return { source: "live", items: j.items };
    }
  } catch {
  }
  return { source: "sample", items: (window.SAMPLE_DATA || {}).cheongyak || [] };
}
async function loadRealty() {
  try {
    const r = await fetch(api("/api/naver-land"));
    if (r.ok) {
      const j = await r.json();
      if (j.items && j.items.length) return { source: "live", items: j.items };
    }
  } catch {
  }
  return { source: "sample", items: (window.SAMPLE_DATA || {}).realty || [] };
}
async function loadNews(q) {
  try {
    const r = await fetch(api(`/api/news?q=${encodeURIComponent(q)}&_=${Date.now()}`));
    if (r.ok) {
      const j = await r.json();
      if (j.items && j.items.length) return { source: "live", items: j.items };
    }
  } catch {
  }
  return { source: "sample", items: [] };
}
let naverPromise = null;
function loadNaver(key) {
  if (window.naver && window.naver.maps) return Promise.resolve();
  if (!key) return Promise.reject(new Error("no_key"));
  if (naverPromise) return naverPromise;
  naverPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
    s.onload = () => resolve();
    s.onerror = () => {
      naverPromise = null;
      reject(new Error("load_failed"));
    };
    document.head.appendChild(s);
  });
  return naverPromise;
}
const ICONS = {
  alert: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })),
  trending: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17" }), /* @__PURE__ */ React.createElement("polyline", { points: "16 7 22 7 22 13" })),
  home: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }), /* @__PURE__ */ React.createElement("polyline", { points: "9 22 9 12 15 12 15 22" })),
  calc: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "4", y: "2", width: "16", height: "20", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "6", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "14", x2: "8", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "14", x2: "12", y2: "14" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "14", x2: "16", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "18", x2: "12", y2: "18" })),
  calendar: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })),
  check2: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("polyline", { points: "9 11 12 14 22 4" }), /* @__PURE__ */ React.createElement("path", { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" })),
  building: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "4", y: "2", width: "16", height: "20", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "M9 22v-4h6v4" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "6", x2: "8", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "6", x2: "12", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "6", x2: "16", y2: "6" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "10", x2: "8", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "16", y1: "10", x2: "16", y2: "10" })),
  pin: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "10", r: "3" })),
  search: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "8" }), /* @__PURE__ */ React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
  info: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "16", x2: "12", y2: "12" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })),
  chevron: /* @__PURE__ */ React.createElement("polyline", { points: "9 18 15 12 9 6" }),
  settings: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })),
  square: /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
  grid: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3", y: "3", width: "7", height: "7" }), /* @__PURE__ */ React.createElement("rect", { x: "14", y: "3", width: "7", height: "7" }), /* @__PURE__ */ React.createElement("rect", { x: "14", y: "14", width: "7", height: "7" }), /* @__PURE__ */ React.createElement("rect", { x: "3", y: "14", width: "7", height: "7" })),
  heart: /* @__PURE__ */ React.createElement("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" }),
  piggy: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "1", y: "4", width: "22", height: "16", rx: "2" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "10", x2: "23", y2: "10" })),
  plus: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), /* @__PURE__ */ React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
  trash: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
  plane: /* @__PURE__ */ React.createElement("polygon", { points: "3 11 22 2 13 21 11 13 3 11" }),
  star: /* @__PURE__ */ React.createElement("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }),
  eye: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "3" })),
  child: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "6.5", r: "3.5" }), /* @__PURE__ */ React.createElement("path", { d: "M6 21c.6-4.2 3-6.8 6-6.8s5.4 2.6 6 6.8" })),
  eyeOff: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "1", x2: "23", y2: "23" }))
};
function Icon({ name, size = 16, className = "", fill = "none" }) {
  return /* @__PURE__ */ React.createElement("svg", { className, width: size, height: size, viewBox: "0 0 24 24", fill, stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, ICONS[name]);
}
const THEMES = [
  { id: "realty", label: "\uBD80\uB3D9\uC0B0", icon: "home", color: "#0A0A0A", desc: "\uC9C4\uB2E8 \xB7 \uC804\uB7B5 \xB7 \uB300\uCD9C \xB7 \uCCAD\uC57D \xB7 \uB9E4\uBB3C\uC9C0\uB3C4" },
  { id: "saving", label: "\uB3C8 \uBAA8\uC73C\uAE30", icon: "trending", color: "#6E6E6E", desc: "ISA \xB7 \uC5F0\uAE08\uC800\uCD95 \xB7 IRP \xB7 \uC99D\uC5EC \uC808\uC138" },
  { id: "wedding", label: "\uACB0\uD63C\uC2DD", icon: "heart", color: "#BDBDBD", desc: "\uC608\uC2DD \uBE44\uC6A9 \xB7 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \xB7 \uC2E0\uD63C\uC5EC\uD589" },
  { id: "kids", label: "\uC790\uB140", icon: "child", color: "#8F8F8F", desc: "\uC5F0\uB839\uBCC4 \uD560 \uC77C \xB7 \uAD50\uC721 \uB85C\uB4DC\uB9F5 \xB7 \uD559\uAD70" }
];
const themeOf = (id) => THEMES.find((t) => t.id === id);
const REALTY_TABS = [
  { id: "diag", label: "\uC9C4\uB2E8", icon: "alert" },
  { id: "strategy", label: "\uC804\uB7B5\xB7\uD61C\uD0DD", icon: "trending" },
  { id: "news", label: "\uD56B\uC774\uC288", icon: "search" },
  { id: "loan", label: "\uB300\uCD9C\uACC4\uC0B0\uAE30", icon: "calc" },
  { id: "cheongyak", label: "\uCCAD\uC57D\uC815\uBCF4", icon: "building" },
  { id: "realty", label: "\uB9E4\uBB3C\xB7\uC9C0\uB3C4", icon: "pin" },
  { id: "plan", label: "\uD50C\uB79C", icon: "calendar" }
];
const TARGETS = [
  { key: "sale84", label: "\uB9E4\uB9E4 \xB7 84\u33A1(34\uD3C9)", price: 26e8, note: "\uACFC\uCC9C\uC790\uC774\xB7\uC368\uBC0B \uB4F1 \uC900\uC2E0\uCD95 \uC2E4\uAC70\uB798 \uD3C9\uADE0" },
  { key: "sale59", label: "\uB9E4\uB9E4 \xB7 59\u33A1(25\uD3C9)", price: 2e9, note: "\uC13C\uD2B8\uB7F4\uD30C\uD06C \uD478\uB974\uC9C0\uC624\uC368\uBC0B \uB4F1 \uC2E4\uAC70\uB798 \uAE30\uC900" },
  { key: "sub84", label: "\uCCAD\uC57D(\uC77C\uBC18\uBD84\uC591) \xB7 84\u33A1", price: 159e7, note: "3\uAE30 \uC7AC\uAC74\uCD95 4\uB2E8\uC9C0 \uBD84\uC591\uAC00 \uCD94\uC815" },
  { key: "jeonse59", label: "\uC804\uC138 \xB7 59\u33A1 (\uB300\uC7A5\uC8FC)", price: 88e7, note: "\uC704\uBC84\uD544\uB4DC\xB7\uC790\uC774 \uB4F1 \uC2E4\uAC70\uB798 \uD3C9\uADE0" },
  { key: "jeonse59budget", label: "\uC804\uC138 \xB7 59\u33A1 (\uC808\uCDA9)", price: 64e7, note: "\uB798\uBBF8\uC548\uC288\uB974 \uB4F1 \uC5F0\uC2DD \uC788\uB294 \uB2E8\uC9C0" }
];
const STRATEGIES = [
  { title: "\uCCAD\uC57D (\uC2E0\uC0DD\uC544\xB7\uC0DD\uC560\uCD5C\uCD08\xB7\uC77C\uBC18\uACF5\uAE09)", badge: "1\uC21C\uC704", tone: "good", points: [
    "\uBD84\uC591\uAC00 \uC0C1\uD55C\uC81C\uB85C \uC2DC\uC138\uBCF4\uB2E4 8~10\uC5B5 \uC774\uC0C1 \uC800\uB834",
    "2026.6.15 \uC2E0\uC124\uB41C \uC2E0\uC0DD\uC544 \uD2B9\uACF5 \u2014 \uD63C\uC778\uAE30\uAC04 \uBB34\uAD00, \uC790\uB140 2\uC138 \uBBF8\uB9CC",
    "\uC18C\uB4DD \uCD08\uACFC \uC2DC \uC77C\uBC18\uACF5\uAE09(\uAC00\uC810\uC81C\xB7\uCD94\uCCA8\uC81C)\uC73C\uB85C \u2014 \uC18C\uB4DD\uAE30\uC900 \uC790\uCCB4\uAC00 \uC5C6\uC74C",
    "\uB2E8\uC810: \uB2F9\uCCA8 \uD655\uB960 \uBD88\uD655\uC2E4, \uC785\uC8FC\uAE4C\uC9C0 2~4\uB144 \uC18C\uC694"
  ] },
  { title: "\uB9E4\uB9E4", badge: "\uC790\uAE30\uC790\uBCF8 \uBD80\uB2F4 \uD07C", tone: "warn", points: [
    "\uC989\uC2DC \uC2E4\uC785\uC8FC, \uC6D0\uD558\uB294 \uB2E8\uC9C0\xB7\uD3C9\uD615 \uC9C1\uC811 \uC120\uD0DD \uAC00\uB2A5",
    "\uAC00\uACA9\uAD6C\uAC04 \uD558\uB4DC\uCEA1(2025.10.16 \uC2DC\uD589)\uC774 \uC18C\uB4DD\uACFC \uBB34\uAD00\uD558\uAC8C \uC801\uC6A9",
    "\uACFC\uCC9C 84\u33A1 \uAE30\uC900 \uC790\uAE30\uC790\uBCF8 20\uC5B5 \uC774\uC0C1 \uD544\uC694\uD560 \uC218 \uC788\uC74C",
    "\uB300\uC548: \uC18C\uD615 \uD3C9\uD615 \uB610\uB294 \uC7AC\uAC74\uCD95 \uB300\uAE30 \uB2E8\uC9C0\uB85C \uB208\uB192\uC774 \uC870\uC815"
  ] },
  { title: "\uC804\uC138 \u2192 \uB9E4\uB9E4/\uCCAD\uC57D \uAC08\uC544\uD0C0\uAE30", badge: "\uD604\uC7AC \uCD94\uCC9C \uACBD\uB85C", tone: "good", points: [
    "\uC790\uAE30\uC790\uBCF8 \uBD80\uB2F4\uC774 \uB0AE\uC544 \uC9C0\uAE08 \uD604\uAE08 \uADDC\uBAA8\uB85C \uC2E4\uD589 \uAC00\uB2A5",
    "\uBB34\uC8FC\uD0DD \uC0C1\uD0DC \uC720\uC9C0\uD558\uBA70 \uCCAD\uC57D \uAC00\uC810(\uBB34\uC8FC\uD0DD\uAE30\uAC04) \uACC4\uC18D \uCD95\uC801",
    "\uC804\uC138\uB300\uCD9C DSR \uBC18\uC601 \uD655\uB300 \uAC00\uB2A5\uC131 \u2014 \uAC08\uC544\uD0C0\uAE30 \uC2DC\uC810 \uB300\uCD9C\uC5EC\uB825 \uCD95\uC18C \uB9AC\uC2A4\uD06C",
    "\uC804\uC138\uAE08 \uC0C1\uC2B9\uBD84\uC740 \uC790\uC0B0 \uD615\uC131\uC5D0 \uAE30\uC5EC\uD558\uC9C0 \uC54A\uB294 \uAE30\uD68C\uBE44\uC6A9 \uACE0\uB824"
  ] }
];
const BENEFITS = [
  { title: "\uC2E0\uD63C\uD2B9\uACF5(\uBBFC\uC601) \u2014 \uC790\uC0B0\uAE30\uC900 \uACBD\uB85C", fit: "\uD574\uB2F9 \uAC00\uB2A5\uC131 \uB192\uC74C", tone: "good", body: "\uC18C\uB4DD\uAE30\uC900(160%) \uCD08\uACFC\uD574\uB3C4 \uC138\uB300 \uBD80\uB3D9\uC0B0\uAC00\uC561 3.31\uC5B5 \uC774\uD558\uBA74 \uC2E0\uCCAD \uAC00\uB2A5. \uBB34\uC8FC\uD0DD\uC778 \uB450 \uBD84\uC740 \uBD80\uB3D9\uC0B0\uAC00\uC561 0\uC6D0\uC774\uB77C \uC774 \uACBD\uB85C\uB85C \uC2E0\uCCAD \uAC00\uB2A5\uC131\uC774 \uB192\uC544\uC694.", link: "https://www.applyhome.co.kr", label: "\uCCAD\uC57D\uD648 \uBC14\uB85C\uAC00\uAE30" },
  { title: "\uCCAD\uC57D \uC77C\uBC18\uACF5\uAE09(\uAC00\uC810\uC81C\xB7\uCD94\uCCA8\uC81C)", fit: "\uC18C\uB4DD \uBB34\uAD00 \xB7 \uD575\uC2EC \uC804\uB7B5", tone: "good", body: "\uC560\uCD08\uC5D0 \uC18C\uB4DD\uAE30\uC900\uC774 \uC5C6\uC5B4\uC694. \uBB34\uC8FC\uD0DD\uAE30\uAC04\xB7\uBD80\uC591\uAC00\uC871\uC218\xB7\uD1B5\uC7A5 \uAC00\uC785\uAE30\uAC04\uC774 \uD575\uC2EC\uC774\uB77C \uD2B9\uACF5 \uC18C\uB4DD\uC694\uAC74\uACFC \uBB34\uAD00\uD558\uAC8C \uACC4\uC18D \uB3C4\uC804\uD560 \uC218 \uC788\uC5B4\uC694.", link: "https://www.applyhome.co.kr", label: "\uCCAD\uC57D\uCE98\uB9B0\uB354 \uBCF4\uAE30" },
  { title: "\uC2E0\uC0DD\uC544 \uD2B9\uBCC4\uACF5\uAE09(\uBBFC\uC601, 2026.6.15 \uC2E0\uC124)", fit: "\uC790\uB140 \uACC4\uD68D \uC2DC \uC720\uB9AC", tone: "neutral", body: "\uD63C\uC778\uAE30\uAC04 \uC694\uAC74 \uC5C6\uC774 \uB9CC 2\uC138 \uBBF8\uB9CC \uC790\uB140\uB9CC \uC788\uC73C\uBA74 \uC2E0\uCCAD \uAC00\uB2A5. \uC9C0\uAE08\uC740 \uD574\uB2F9 \uC5C6\uC9C0\uB9CC \uCD9C\uC0B0 \uC2DC\uC810\uC5D0 \uCC59\uAE30\uBA74 \uC88B\uC544\uC694.", link: "https://www.myhome.go.kr", label: "\uB9C8\uC774\uD648\uD3EC\uD138 \uC548\uB0B4" },
  { title: "\uC0DD\uC560\uCD5C\uCD08 \uCDE8\uB4DD\uC138 \uAC10\uBA74", fit: "\uACFC\uCC9C\uC5D4 \uB300\uBD80\uBD84 \uD574\uB2F9 \uC5C6\uC74C", tone: "warn", body: "12\uC5B5 \uC774\uD558 \uC8FC\uD0DD\uB9CC \uC801\uC6A9\uB418\uB294\uB370, \uACFC\uCC9C \uB9E4\uBB3C\uC740 \uB300\uBD80\uBD84 15\uC5B5\uC744 \uB118\uC5B4 \uC2E4\uC9C8\uC801\uC73C\uB85C \uC801\uC6A9\uBC1B\uAE30 \uC5B4\uB824\uC6CC\uC694.", link: "https://www.myhome.go.kr", label: "\uAD00\uB828 \uC548\uB0B4" },
  { title: "\uC2E0\uC0DD\uC544 \uD2B9\uB840 \uB514\uB524\uB3CC\xB7\uBC84\uD300\uBAA9\uB300\uCD9C", fit: "\uC18C\uB4DD\uC740 OK, \uAC00\uACA9\uC0C1\uD55C\uC5D0 \uB9C9\uD798", tone: "warn", body: "\uC18C\uB4DD\uC694\uAC74(\uB9DE\uBC8C\uC774 2\uC5B5 \uC774\uD558)\uC740 \uCDA9\uC871\uD558\uC9C0\uB9CC \uB2F4\uBCF4\uC8FC\uD0DD 6~9\uC5B5, \uC804\uC138\uBCF4\uC99D\uAE08 5\uC5B5 \uC0C1\uD55C\uC774 \uC788\uC5B4 \uACFC\uCC9C\uC5D4 \uC801\uC6A9 \uC548 \uB3FC\uC694.", link: "https://nhuf.molit.go.kr", label: "\uC8FC\uD0DD\uB3C4\uC2DC\uAE30\uAE08 \uD3EC\uD138" },
  { title: "\uBCF4\uAE08\uC790\uB9AC\uB860 \xB7 \uC77C\uBC18 \uB514\uB524\uB3CC\xB7\uBC84\uD300\uBAA9", fit: "\uACFC\uCC9C\uC5D4 \uD574\uB2F9 \uC5C6\uC74C", tone: "bad", body: "\uBCF4\uAE08\uC790\uB9AC\uB860\uC740 6\uC5B5 \uC774\uD558 \uC8FC\uD0DD\uB9CC, \uC77C\uBC18 \uB514\uB524\uB3CC\xB7\uBC84\uD300\uBAA9\uC740 \uC18C\uB4DD\uC0C1\uD55C(6~8.5\uCC9C\uB9CC\uC6D0\uB300)\uC774 \uC788\uC5B4 \uC6B0\uB9AC \uC870\uAC74\uC73C\uB85C\uB294 \uC774\uC6A9\uC774 \uC5B4\uB824\uC6CC\uC694.", link: "https://www.hf.go.kr", label: "\uD55C\uAD6D\uC8FC\uD0DD\uAE08\uC735\uACF5\uC0AC" }
];
const TIMELINE = [
  { phase: "Phase 1 \xB7 0~6\uAC1C\uC6D4", title: "\uAE30\uBC18 \uB2E4\uC9C0\uAE30", items: ["\uCCAD\uC57D\uD1B5\uC7A5 \uAC00\uC785\uAE30\uAC04\xB7\uB0A9\uC785\uD69F\uC218 \uC810\uAC80", "\uBD80\uBD80\uD569\uC0B0 \uC18C\uB4DD\uBD84\uC704 \uC815\uD655\uD788 \uACC4\uC0B0 \u2192 \uD2B9\uACF5/\uC77C\uBC18\uACF5\uAE09 \uACBD\uB85C \uD655\uC815", "\uD63C\uC778\uC2E0\uACE0\uC77C \uD655\uC815(\uD2B9\uACF5 7\uB144 \uC694\uAC74 \uAE30\uC0B0\uC810)", "\uC5F0\uAE08\uC800\uCD95\xB7IRP\xB7ISA \uACC4\uC88C \uAC1C\uC124, \uC790\uB3D9\uC774\uCCB4 \uC138\uD305"] },
  { phase: "Phase 2 \xB7 6\uAC1C\uC6D4~1.5\uB144", title: "\uC804\uC138 \uC9C4\uC785 + \uC790\uC0B0 \uCD95\uC801", items: ["\uACFC\uCC9C \uC804\uC138(59\u33A1 \uAE30\uC900 6.4\uC5B5~8.8\uC5B5\uC120) \uACC4\uC57D \uC2E4\uD589", "\uACFC\uCC9C \uC2E0\uADDC \uACF5\uAE09 \uB2E8\uC9C0 \uCCAD\uC57D \uC77C\uC815 \uC0C1\uC2DC \uBAA8\uB2C8\uD130\uB9C1", "ISA \uBAA9\uC801\uC790\uAE08 \uCD95\uC801 \uC2DC\uC791"] },
  { phase: "Phase 3 \xB7 1.5~3\uB144", title: "\uC804\uC138 \uB9CC\uAE30 \uC784\uBC15, \uC7AC\uD3C9\uAC00", items: ["\uCCAD\uC57D \uB2F9\uCCA8 \uC5EC\uBD80 \uD655\uC778, \uBBF8\uB2F9\uCCA8 \uC2DC \uB9E4\uB9E4 \uAC08\uC544\uD0C0\uAE30 \uC7AC\uAC80\uD1A0", "\uC790\uAE30\uC790\uBCF8 \uAC2D \uCD95\uC18C \uCD94\uC774 \uC810\uAC80, \uC800\uCD95 \uC18D\uB3C4 \uC7AC\uC870\uC815"] },
  { phase: "Phase 4 \xB7 3~5\uB144+", title: "\uC785\uC8FC \uBC0F \uC548\uC815\uD654", items: ["\uC785\uC8FC \uB610\uB294 \uB9E4\uB9E4 \uC2E4\uD589, \uB300\uCD9C \uC0C1\uD658\uACC4\uD68D \uD655\uC815", "\uC790\uC0B0 \uD3EC\uD2B8\uD3F4\uB9AC\uC624 \uC7AC\uC870\uC815"] }
];
const CHECKLIST_INIT = [
  { cat: "\uCCAD\uC57D \uC900\uBE44", items: ["\uCCAD\uC57D\uD1B5\uC7A5 \uAC00\uC785\uAE30\uAC04\xB7\uB0A9\uC785\uD69F\uC218 \uD655\uC778", "\uD63C\uC778\uAD00\uACC4\uC99D\uBA85\uC11C \uC900\uBE44", "\uBD80\uBD80\uD569\uC0B0 \uC18C\uB4DD\uBD84\uC704 \uC815\uD655\uD788 \uC0B0\uCD9C", "\uC790\uB140 \uACC4\uD68D \uC2DC \uC2E0\uC0DD\uC544\uD2B9\uACF5 \uC694\uAC74 \uD655\uC778"] },
  { cat: "\uB300\uCD9C/\uC790\uAE08", items: ["\uAE30\uC874 \uC2E0\uC6A9\uB300\uCD9C\xB7\uD560\uBD80 \uC815\uB9AC\uB85C DSR \uC5EC\uC720 \uD655\uBCF4", "\uC815\uCC45 \uBAA8\uAE30\uC9C0 \uC18C\uB4DD\xB7\uC790\uC0B0 \uC694\uAC74 \uD655\uC778", "\uACE0\uC815 vs \uBCC0\uB3D9\uAE08\uB9AC \uBE44\uAD50", "\uBE44\uC0C1\uC790\uAE08(\uC0DD\uD65C\uBE44 3~6\uAC1C\uC6D4\uBD84) \uBCC4\uB3C4 \uD655\uBCF4"] },
  { cat: "\uC815\uBCF4 \uBAA8\uB2C8\uD130\uB9C1", items: ["\uCCAD\uC57D\uD648 \uACFC\uCC9C \uC9C0\uC5ED \uACF5\uAE09 \uC77C\uC815 \uC54C\uB9BC \uC124\uC815", "LH\uCCAD\uC57D\uD50C\uB7EC\uC2A4 \uACF5\uACE0 \uD655\uC778", "\uADDC\uC81C\uC9C0\uC5ED \uC9C0\uC815 \uD604\uD669 \uBC18\uAE30 \uC810\uAC80", "\uB3C4\uC2DC\uADFC\uB85C\uC790 \uC6D4\uD3C9\uADE0\uC18C\uB4DD \uACE0\uC2DC \uAC31\uC2E0 \uBC18\uC601"] }
];
const BANK_LOANS = [
  { bank: "\uCF00\uC774\uBC45\uD06C", product: "\uC544\uD30C\uD2B8\uB2F4\uBCF4\uB300\uCD9C", rateMin: 4.05, rateMax: 7.5, rateType: "\uBCC0\uB3D9(\uC2E0\uC794\uC561 \uCF54\uD53D\uC2A4) \xB7 \uC8FC\uAE30\uD615 5\uB144", feature: "100% \uBE44\uB300\uBA74 \xB7 \uC804\uC790\uACC4\uC57D \uC2DC 1\uAE08\uC735\uAD8C \uBCC0\uB3D9 \uCD5C\uC800 \uC218\uC900 \xB7 \uC911\uB3C4\uC0C1\uD658\uC218\uC218\uB8CC \uBA74\uC81C", link: "https://www.kbanknow.com" },
  { bank: "\uD558\uB098\uC740\uD589", product: "\uD558\uB098\uC6D0\uD050 \uC544\uD30C\uD2B8\uB860", rateMin: 4.1, rateMax: 7, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "\uBAA8\uBC14\uC77C \uC644\uACB0\uD615 \uBE44\uB300\uBA74 \uC8FC\uB2F4\uB300 \xB7 \uC804\uC790\uC57D\uC815 \uC6B0\uB300\uAE08\uB9AC", link: "https://www.kebhana.com" },
  { bank: "KB\uAD6D\uBBFC\uC740\uD589", product: "KB\uC8FC\uD0DD\uB2F4\uBCF4\uB300\uCD9C", rateMin: 4.2, rateMax: 7.2, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4 6\uAC1C\uC6D4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "\uAE09\uC5EC\uC774\uCCB4\xB7\uCE74\uB4DC\uC2E4\uC801 \uB4F1 \uAC70\uB798\uC2E4\uC801 \uC6B0\uB300 \uCD5C\uB300 \uC57D 1%p", link: "https://obank.kbstar.com" },
  { bank: "\uC2E0\uD55C\uC740\uD589", product: "\uC2E0\uD55C\uC8FC\uD0DD\uB300\uCD9C", rateMin: 4.2, rateMax: 7.1, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4 6\uAC1C\uC6D4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "SOL \uBE44\uB300\uBA74 \uC2E0\uCCAD \uC6B0\uB300 \xB7 3\uB144 \uACBD\uACFC \uD6C4 \uC911\uB3C4\uC0C1\uD658\uC218\uC218\uB8CC \uBA74\uC81C", link: "https://bank.shinhan.com" },
  { bank: "\uC6B0\uB9AC\uC740\uD589", product: "\uC6B0\uB9ACWON\uC8FC\uD0DD\uB300\uCD9C", rateMin: 4.2, rateMax: 7.2, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4 6\uAC1C\uC6D4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "WON\uBC45\uD0B9 \uBE44\uB300\uBA74 \xB7 \uBD80\uC218\uAC70\uB798 \uC5C6\uC774\uB3C4 \uAE30\uBCF8\uAE08\uB9AC \uACBD\uC7C1\uB825", link: "https://spot.wooribank.com" },
  { bank: "NH\uB18D\uD611\uC740\uD589", product: "NH\uC8FC\uD0DD\uB2F4\uBCF4\uB300\uCD9C", rateMin: 4.3, rateMax: 7.3, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "\uC62C\uC6D0\uBC45\uD06C \uBE44\uB300\uBA74 \uC6B0\uB300 \xB7 \uAE09\uC5EC\uC774\uCCB4\xB7NH\uCE74\uB4DC \uC2E4\uC801 \uC6B0\uB300", link: "https://banking.nonghyup.com" },
  { bank: "IBK\uAE30\uC5C5\uC740\uD589", product: "IBK\uC8FC\uD0DD\uB2F4\uBCF4\uB300\uCD9C", rateMin: 4.3, rateMax: 6.8, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4) \xB7 \uD63C\uD569\uD615", feature: "i-ONE\uBC45\uD06C \uBE44\uB300\uBA74 \xB7 \uC0C1\uB300\uC801\uC73C\uB85C \uC548\uC815\uC801\uC778 \uAE08\uB9AC \uC6B4\uC6A9", link: "https://mybank.ibk.co.kr" },
  { bank: "\uCE74\uCE74\uC624\uBC45\uD06C", product: "\uC8FC\uD0DD\uB2F4\uBCF4\uB300\uCD9C", rateMin: 4.8, rateMax: 6.6, rateType: "\uBCC0\uB3D9(\uCF54\uD53D\uC2A4 6\uAC1C\uC6D4) \xB7 \uD63C\uD569\uD615 \xB7 \uC8FC\uAE30\uD615", feature: "\uCC57\uBD07 100% \uBE44\uB300\uBA74 \xB7 \uC911\uB3C4\uC0C1\uD658\uC218\uC218\uB8CC \uC804\uC561 \uBA74\uC81C", link: "https://www.kakaobank.com/products/mortgageLoan" }
];
const ACCOUNTS_DEFAULT = [
  { id: "a1", owner: "\uBCF8\uC778", type: "ISA", balance: 0, paid: 0, goal: 4e3 },
  { id: "a2", owner: "\uBC30\uC6B0\uC790", type: "ISA", balance: 0, paid: 0, goal: 4e3 },
  { id: "a3", owner: "\uBCF8\uC778", type: "\uC5F0\uAE08\uC800\uCD95", balance: 0, paid: 0, goal: 600 },
  { id: "a4", owner: "\uBC30\uC6B0\uC790", type: "\uC5F0\uAE08\uC800\uCD95", balance: 0, paid: 0, goal: 600 },
  { id: "a5", owner: "\uBCF8\uC778", type: "IRP", balance: 0, paid: 0, goal: 300 },
  { id: "a6", owner: "\uBC30\uC6B0\uC790", type: "IRP", balance: 0, paid: 0, goal: 300 }
];
const ACCOUNT_TYPES = ["ISA", "\uC5F0\uAE08\uC800\uCD95", "IRP", "\uCCAD\uC57D\uD1B5\uC7A5", "\uC608\uC801\uAE08", "\uAE30\uD0C0"];
const WEDDING_BUDGET_DEFAULT = [
  { id: "w1", name: "\uC608\uC2DD\uC7A5 \uB300\uAD00\uB8CC", budget: 1e3, spent: 0 },
  { id: "w2", name: "\uC2DD\uB300 (\uD558\uAC1D 250\uBA85 \uAE30\uC900)", budget: 2e3, spent: 0 },
  { id: "w3", name: "\uC2A4\uB4DC\uBA54 (\uC2A4\uD29C\uB514\uC624\xB7\uB4DC\uB808\uC2A4\xB7\uBA54\uC774\uD06C\uC5C5)", budget: 500, spent: 0 },
  { id: "w4", name: "\uC608\uBB3C\xB7\uC608\uBCF5", budget: 800, spent: 0 },
  { id: "w5", name: "\uC2E0\uD63C\uC5EC\uD589", budget: 1e3, spent: 0 },
  { id: "w6", name: "\uCCAD\uCCA9\uC7A5\xB7\uB2F5\uB840\uD488\xB7\uBD80\uC218\uBE44\uC6A9", budget: 200, spent: 0 }
];
const WEDDING_CHECKLIST_DEFAULT = [
  { cat: "D-12~9\uAC1C\uC6D4", items: [
    "\uC591\uAC00 \uC778\uC0AC\xB7\uC0C1\uACAC\uB840 \uC9C4\uD589, \uC608\uC2DD \uC2DC\uAE30\xB7\uADDC\uBAA8\xB7\uC608\uC0B0 \uC0C1\uD55C\uC120 \uBD80\uBD80 \uD569\uC758",
    "\uC6E8\uB529\uBD81\xB7\uB2E4\uC774\uB809\uD2B8\uACB0\uD63C\uC900\uBE44 \uC571\uC73C\uB85C \uC6E8\uB529\uD640 \uD6C4\uBCF4 \uCD94\uB9AC\uACE0 \uC8FC\uB9D0 \uD22C\uC5B4 (\uD558\uB8E8 2~3\uACF3)",
    "\uD1A0\uC694\uC77C 12~14\uC2DC \uACE8\uB4E0\uD0C0\uC784\uC740 1\uB144 \uC804\uC5D0\uB3C4 \uB9C8\uAC10 \u2014 \uB9D8\uC5D0 \uB4E0 \uD640\uC740 \uBCF4\uC99D\uC778\uC6D0\xB7\uC2DD\uB300\xB7\uD398\uC774\uBC31 \uD655\uC778 \uD6C4 \uBC14\uB85C \uAC00\uACC4\uC57D",
    "\uD50C\uB798\uB108 \uB3D9\uD589 vs \uC6CC\uD0B9(\uC9C1\uC811) \uACB0\uC815, \uC2A4\uB4DC\uBA54 \uC815\uCC30\uC81C \uACAC\uC801 3\uAC1C \uC774\uC0C1 \uBE44\uAD50",
    "\uC778\uAE30 \uBCF8\uC2DD \uC2A4\uB0C5\xB7DVD \uC5C5\uCCB4\uB294 1\uB144 \uC804 \uB9C8\uAC10 \u2014 \uD640 \uACC4\uC57D \uC9C1\uD6C4 \uB0A0\uC9DC \uAC78\uC5B4\uB450\uAE30",
    "\uACF5\uB3D9 \uC608\uC0B0 \uC2DC\uD2B8(\uB178\uC158/\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8) \uB9CC\uB4E4\uC5B4 \uACC4\uC57D\uAE08\xB7\uC794\uAE08 \uC77C\uC815 \uAE30\uB85D \uC2DC\uC791",
    "\uC2E0\uD63C\uC9D1 \uBC29\uD5A5(\uB9E4\uB9E4\xB7\uC804\uC138) \uACB0\uC815, \uD63C\uC778\uC2E0\uACE0 \uD0C0\uC774\uBC0D\uBCC4 \uB300\uCD9C \uC720\uBD88\uB9AC \uACF5\uBD80"
  ] },
  { cat: "D-9~6\uAC1C\uC6D4", items: [
    "\uC2A4\uB4DC\uBA54 \uD655\uC815 \uACC4\uC57D \u2014 \uC6D0\uBCF8\xB7\uC218\uC815\uBCF8 \uCEF7 \uC218, \uD5EC\uD37C\uBE44\xB7\uC5BC\uB9AC\uC2A4\uD0C0\uD2B8\uBE44 \uCD94\uAC00\uAE08 \uACC4\uC57D\uC11C\uC5D0 \uBA85\uC2DC",
    "\uB4DC\uB808\uC2A4 \uD22C\uC5B4(3~4\uACF3) \uD6C4 \uBCF8\uC2DD\xB7\uCD2C\uC601 \uB4DC\uB808\uC2A4 \uB77C\uC778 \uACB0\uC815 (\uD53C\uD305\uBE44 \uAC10\uC548)",
    "\uB9AC\uD5C8\uC124 \uCD2C\uC601 \uB0A0\uC9DC \uD655\uC815, \uC2E0\uB791 \uC608\uBCF5\uC740 \uB9DE\uCDA4 2~3\uAC1C\uC6D4 \uAC78\uB9AC\uB2C8 \uBBF8\uB9AC \uACC4\uC57D",
    "\uC2E0\uD63C\uC5EC\uD589 \uD56D\uACF5\xB7\uC219\uC18C \uC608\uC57D, \uC5EC\uAD8C \uC720\uD6A8\uAE30\uAC04\xB7\uBE44\uC790/ESTA \uD655\uC778",
    "\uC608\uBB3C\xB7\uC608\uB2E8\xB7\uAFB8\uBC08\uBE44 \uBC94\uC704 \uC591\uAC00 \uC870\uC728 (\uAC08\uB4F1 \uC18C\uC9C0 \uCD08\uBC18\uC5D0 \uC815\uB9AC)",
    "\uC6E8\uB529\uBC15\uB78C\uD68C\xB7\uC81C\uD734 \uC774\uBCA4\uD2B8\uB85C \uD55C\uBCF5\xB7\uC608\uBCF5\xB7\uC8FC\uC5BC\uB9AC \uACAC\uC801 \uBE44\uAD50, \uD398\uC774\uBC31 \uCC59\uAE30\uAE30",
    "\uC0AC\uD68C\uC790\xB7\uCD95\uAC00 \uC9C0\uC778/\uC804\uBB38\uC5C5\uCCB4 \uACB0\uC815, \uC9C0\uC778\uC774\uBA74 \uC774 \uC2DC\uAE30\uC5D0 \uBBF8\uB9AC \uBD80\uD0C1"
  ] },
  { cat: "D-6~3\uAC1C\uC6D4", items: [
    "\uB9AC\uD5C8\uC124 \uCD2C\uC601 \uC9C4\uD589, \uC140\uB809\xB7\uC568\uBC94 \uC218\uC815 \uAE30\uAC04(1~2\uAC1C\uC6D4) \uC5ED\uC0B0\uD574 \uC77C\uC815 \uAD00\uB9AC",
    "\uC2E0\uD63C\uC9D1 \uACC4\uC57D \u2014 \uC815\uCC45 \uB300\uCD9C\uC740 \uC2EC\uC0AC\uAE30\uAC04 \uACE0\uB824\uD574 \uC794\uAE08\uC77C \uD55C \uB2EC \uC804 \uC2E0\uCCAD",
    "\uC885\uC774 \uCCAD\uCCA9\uC7A5 \uC8FC\uBB38 + \uBAA8\uBC14\uC77C \uCCAD\uCCA9\uC7A5(\uCC38\uC11D \uC5EC\uBD80\xB7\uACC4\uC88C \uC548\uB0B4 \uAE30\uB2A5) \uC81C\uC791",
    "\uC2DD\uC804 \uC601\uC0C1(\uC131\uC7A5 \uC601\uC0C1) \uC900\uBE44, \uC6E8\uB529\uD640 \uD654\uBA74 \uADDC\uACA9\xB7\uC7AC\uC0DD \uBC29\uC2DD \uD655\uC778",
    "\uAC00\uC804\xB7\uD63C\uC218 \uBC31\uD654\uC810 \uC6E8\uB529\uD074\uB7FD/\uC81C\uD734\uB85C \uBB36\uC5B4 \uAD6C\uB9E4 \u2014 \uC0AC\uC740\uD488\xB7\uD3EC\uC778\uD2B8 \uCD5C\uB300\uD654",
    "\uBD80\uBAA8\uB2D8 \uD55C\uBCF5\xB7\uC591\uAC00 \uC5B4\uBA38\uB2C8 \uBBF8\uC6A9 \uC608\uC57D, \uD3D0\uBC31\xB7\uC774\uBC14\uC9C0 \uC5EC\uBD80 \uACB0\uC815",
    "\uCCAD\uCCA9\uC7A5 \uBAA8\uC784 \uB9AC\uC2A4\uD2B8 \uC791\uC131 \u2192 \uC608\uC0C1 \uD558\uAC1D \uC218\uC640 \uBCF4\uC99D\uC778\uC6D0 \uBE44\uAD50 \uC870\uC815"
  ] },
  { cat: "D-3~1\uAC1C\uC6D4", items: [
    "\uCCAD\uCCA9\uC7A5 \uBAA8\uC784 \uC18C\uADF8\uB8F9 \uC9C4\uD589, \uBAA8\uBC14\uC77C \uCCAD\uCCA9\uC7A5\uC740 \uB2E8\uCCB4\uBC29 \uB9D0\uACE0 \uAC1C\uBCC4 \uC5F0\uB77D",
    "\uBCF8\uC2DD \uB4DC\uB808\uC2A4 \uAC00\uBD09 \uD53C\uD305, \uB2F9\uC77C \uB4DC\uB808\uC2A4\xB7\uBD80\uCF00\xB7\uD5EC\uD37C \uC77C\uC815 \uCD5C\uC885 \uD655\uC778",
    "\uC0AC\uD68C\uC790\xB7\uCD95\uAC00\uC640 \uC2DD\uC21C \uB300\uBCF8 \uACF5\uC720, \uCD95\uAC00 MR \uC6E8\uB529\uD640\uC5D0 \uBBF8\uB9AC \uC804\uB2EC",
    "\uBCF8\uC2DD \uC2A4\uB0C5\xB7DVD \uC5C5\uCCB4\uC5D0 \uD544\uC218 \uCEF7 \uB9AC\uC2A4\uD2B8\xB7\uAC00\uC871 \uB2E8\uCCB4\uC0AC\uC9C4 \uBA85\uB2E8 \uC804\uB2EC",
    "\uC2E0\uD63C\uC5EC\uD589 \uCD5C\uC885 \uACB0\uC81C + \uC5EC\uD589\uC790\uBCF4\uD5D8\xB7\uD658\uC804\xB7eSIM \uCC98\uB9AC",
    "\uC6E8\uB529\uD640 \uCD5C\uC885 \uBBF8\uD305 \u2014 \uBCF4\uC99D\uC778\uC6D0 \uD655\uC815, \uC2DD\uC21C, \uC601\uC0C1 \uC1A1\uCD9C, \uB2F5\uB840\uD488 \uC810\uAC80",
    "\uCD95\uC758\uB300\xB7\uBA85\uBD80\xB7\uC8FC\uCC28 \uC548\uB0B4 \uB4F1 \uB2F9\uC77C \uC5ED\uD560 \uBC30\uC815"
  ] },
  { cat: "D-30\uC77C~\uB2F9\uC77C", items: [
    "\uC794\uAE08 \uD3ED\uD0C4 \uC2DC\uAE30 \u2014 \uD640\xB7\uC2A4\uB4DC\uBA54\xB7\uC2A4\uB0C5 \uC794\uAE08 \uC77C\uC815\uACFC \uACB0\uC81C\uC218\uB2E8(\uD604\uAE08\uC601\uC218\uC99D) \uCE98\uB9B0\uB354 \uC815\uB9AC",
    "\uBA54\uC774\uD06C\uC5C5 \uB9AC\uD5C8\uC124\uB85C \uB2F9\uC77C \uC2A4\uD0C0\uC77C \uD655\uC815, \uC0C8\uBCBD \uC0F5 \uB3C4\uCC29 \uB3D9\uC120 \uC2DC\uBBAC\uB808\uC774\uC158",
    "D-7\uBD80\uD130 \uC220\xB7\uC790\uADF9\uC801 \uC74C\uC2DD\xB7\uC0C8 \uD654\uC7A5\uD488 \uD14C\uC2A4\uD2B8 \uAE08\uC9C0 (\uD53C\uBD80 \uCEE8\uB514\uC158)",
    "\uC804\uB0A0 \uB4DC\uB808\uC2A4\xB7\uAD6C\uB450\xB7\uC608\uBB3C\xB7\uCD95\uC758\uB300 \uC6A9\uD488\xB7\uBE44\uC0C1 \uD30C\uC6B0\uCE58(\uD540\xB7\uC2E4\xB7\uC9C4\uD1B5\uC81C) \uD55C\uACF3\uC5D0 \uBAA8\uC73C\uAE30",
    "\uB2F9\uC77C \uD0C0\uC784\uD14C\uC774\uBE14(\uC0F5\u2192\uD640\u2192\uB300\uAE30\uC2E4\u2192\uBCF8\uC2DD\u2192\uC6D0\uD310\u2192\uD53C\uB85C\uC5F0) \uAC00\uC871\xB7\uD5EC\uD37C \uACF5\uC720",
    "\uD3EC\uD1A0\uD14C\uC774\uBE14\xB7\uBD80\uBAA8\uB2D8 \uD3B8\uC9C0 \uB4F1 \uAC10\uC131 \uC694\uC18C \uC138\uD305, \uCD95\uAC00\xB7\uC0AC\uD68C\uC790 \uCD5C\uC885 \uB9AC\uD5C8\uC124 \uD1B5\uD654",
    "\uC2E0\uD63C\uC5EC\uD589 \uCE90\uB9AC\uC5B4 \uBBF8\uB9AC \uD328\uD0B9, \uC5EC\uAD8C\xB7\uBC14\uC6B0\uCC98\xB7\uC0C1\uBE44\uC57D\uC740 \uAE30\uB0B4 \uAC00\uBC29\uC5D0"
  ] },
  { cat: "\uACB0\uD63C \uD6C4", items: [
    "\uD63C\uC778\uC2E0\uACE0\uB294 \uB300\uCD9C\xB7\uCCAD\uC57D \uC720\uBD88\uB9AC(\uC0DD\uC560\uCD5C\uCD08\xB7\uC2E0\uD63C\uD2B9\uACF5\xB7\uC2E0\uC0DD\uC544 \uD2B9\uB840) \uB530\uC838 \uC720\uB9AC\uD55C \uC2DC\uC810\uC5D0",
    "\uCD95\uC758\uAE08 \uC815\uC0B0\uD574 \uC591\uAC00\uC640 \uD22C\uBA85\uD558\uAC8C \uB098\uB204\uACE0, \uC77C\uC8FC\uC77C \uB0B4 \uD558\uAC1D \uAC10\uC0AC \uC5F0\uB77D",
    "\uBCF8\uC2DD \uC2A4\uB0C5\xB7DVD \uC6D0\uBCF8 \uC624\uBA74 \uC989\uC2DC \uD074\uB77C\uC6B0\uB4DC+\uC678\uC7A5\uD558\uB4DC \uC774\uC911 \uBC31\uC5C5",
    "\uC804\uC785\uC2E0\uACE0\xB7\uC8FC\uC18C\uC9C0 \uBCC0\uACBD \uCC98\uB9AC, \uC9C0\uC790\uCCB4 \uC2E0\uD63C\uBD80\uBD80 \uC9C0\uC6D0\uAE08\xB7\uC774\uC790 \uC9C0\uC6D0 \uC2E0\uCCAD",
    "\uBD80\uBD80 \uACF5\uB3D9 \uD1B5\uC7A5\xB7\uC0DD\uD65C\uBE44 \uADDC\uCE59\xB7\uBE44\uC0C1\uAE08 \uACC4\uC88C \uB4F1 \uC7AC\uD14C\uD06C \uAD6C\uC870 \uCCAB \uB2EC\uC5D0 \uC138\uD305",
    "\uC5F0\uB9D0\uC815\uC0B0 \uD63C\uC778 \uC138\uC561\uACF5\uC81C(1\uC778 50\uB9CC)\xB7\uACB0\uD63C \uC9C0\uCD9C \uC99D\uBE59 \uC815\uB9AC",
    "\uC5C5\uCCB4 \uD6C4\uAE30 \uC791\uC131\uC73C\uB85C \uD398\uC774\uBC31\xB7\uCD94\uAC00 \uD61C\uD0DD \uD68C\uC218"
  ] }
];
const WEDDING_TIPS = [
  "\uC2A4\uB4DC\uBA54\xB7\uC2A4\uB0C5 \uACC4\uC57D\uC11C\uC5D4 '\uAE30\uBCF8 \uD3EC\uD568 \uD56D\uBAA9'\uACFC \uCD94\uAC00\uAE08(\uD5EC\uD37C\uBE44\xB7\uC5BC\uB9AC\uC2A4\uD0C0\uD2B8\uBE44\xB7\uC6D0\uBCF8 \uAD6C\uC785\uBE44)\uC744 \uBC18\uB4DC\uC2DC \uC11C\uBA74\uC73C\uB85C \u2014 \uB2F9\uC77C \uCD94\uAC00 \uACB0\uC81C \uD3ED\uD0C4 \uC608\uBC29",
  "\uC6E8\uB529\uD640 \uBCF4\uC99D\uC778\uC6D0\uC740 \uB0AE\uCDB0 \uC7A1\uAE30 \u2014 \uCD08\uACFC\uB294 \uCD94\uAC00 \uACB0\uC81C\uD558\uBA74 \uB418\uC9C0\uB9CC \uBBF8\uB2EC\uBD84\uC740 \uADF8\uB300\uB85C \uC190\uD574",
  "\uC778\uAE30 \uBCF8\uC2DD \uC2A4\uB0C5\xB7DVD\uB294 \uC6E8\uB529\uD640\uBCF4\uB2E4 \uBA3C\uC800 \uB9C8\uAC10\uB418\uAE30\uB3C4 \u2014 \uD640 \uACC4\uC57D \uB2F9\uC77C \uBC14\uB85C \uBB38\uC758\uAC00 \uAD6D\uB8F0",
  "\uD63C\uC778\uC2E0\uACE0 \uD558\uB8E8 \uCC28\uC774\uB85C \uB300\uCD9C \uC870\uAC74\uC774 \uB2EC\uB77C\uC9C8 \uC218 \uC788\uC74C \u2014 \uC2E0\uD63C\uC9D1 \uB300\uCD9C \uC804\uB7B5 \uBA3C\uC800, \uC2E0\uACE0 \uC2DC\uC810\uC740 \uB098\uC911\uC5D0",
  "\uBAA8\uB4E0 \uACB0\uC81C\uB294 \uD398\uC774\uBC31\xB7\uC81C\uD734 \uD3EC\uC778\uD2B8\xB7\uCE74\uB4DC \uC2E4\uC801 \uACB9\uCCD0 \uCC59\uAE30\uACE0, \uD6C4\uAE30 \uD398\uC774\uBC31 \uB9C8\uAC10\uC77C\uC740 \uCE98\uB9B0\uB354\uC5D0 \uB4F1\uB85D"
];
const WEDDING_VENUES = [
  { name: "\uC544\uD3A0\uAC00\uBAA8 \uAD11\uD654\uBB38", area: "\uC885\uB85C\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "6~8.5\uB9CC", fee: "220~770\uB9CC", cap: "200~400\uBA85", note: "\uB3C4\uC2EC \uC811\uADFC\uC131 + \uAC80\uC99D\uB41C \uC2DD\uC0AC \uD004\uB9AC\uD2F0 \u2014 \uC9C1\uC7A5\uC778 \uD558\uAC1D \uC120\uD638 1\uC21C\uC704\uAE09" },
  { name: "\uC544\uD3A0\uAC00\uBAA8 \uC120\uB989", area: "\uAC15\uB0A8\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "7~9\uB9CC", fee: "500~800\uB9CC", cap: "250~450\uBA85", note: "\uAC15\uB0A8\uAD8C \uC544\uD3A0\uAC00\uBAA8 \u2014 \uC2DD\uC0AC \uD004\uB9AC\uD2F0 \uC548\uC815\uC801, \uD68C\uC0AC \uD558\uAC1D \uC811\uADFC\uC131 \uC88B\uC74C" },
  { name: "\uB354\uCEE8\uBCA4\uC158 \uBC18\uD3EC", area: "\uC11C\uCD08\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "6.5~8\uB9CC", fee: "300~600\uB9CC", cap: "250~500\uBA85", note: "\uACE0\uC18D\uD130\uBBF8\uB110 \uC9C1\uACB0 \u2014 \uAC00\uC131\uBE44\xB7\uC811\uADFC\uC131\uC73C\uB85C \uC7AC\uBC29\uBB38 \uD558\uAC1D \uD3C9 \uC88B\uC740 \uB300\uD45C \uCEE8\uBCA4\uC158" },
  { name: "\uC0C1\uB85D\uC544\uD2B8\uD640", area: "\uAC15\uB0A8\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "7.5~9.5\uB9CC", fee: "500~900\uB9CC", cap: "200~600\uBA85", note: "\uC120\uB989\uC5ED \uC778\uC811 \xB7 \uD638\uD154\uAE09 \uD640 \uCEE8\uB514\uC158 \u2014 \uACF5\uBB34\uC6D0\uC5F0\uAE08\uACF5\uB2E8 \uC6B4\uC601\uC73C\uB85C \uAC70\uD488 \uC5C6\uB294 \uAC00\uACA9" },
  { name: "\uB354\uCC44\uD50C\uC573\uCCAD\uB2F4", area: "\uAC15\uB0A8\uAD6C", type: "\uCC44\uD50C", meal: "8.5~11\uB9CC", fee: "750~980\uB9CC", cap: "250~400\uBA85", note: "12m \uC544\uCE58\uD615 \uCC9C\uACE0 \uCC44\uD50C\uD640 \u2014 \uCC44\uD50C\uC6E8\uB529 \uB300\uD45C \uBCA0\uB274, \uC608\uC57D \uACBD\uC7C1 \uCE58\uC5F4" },
  { name: "\uB354\uCC44\uD50C\uC573\uB17C\uD604", area: "\uAC15\uB0A8\uAD6C", type: "\uCC44\uD50C", meal: "8~10\uB9CC", fee: "600~850\uB9CC", cap: "200~350\uBA85", note: "\uCCAD\uB2F4 \uB300\uBE44 \uD569\uB9AC\uC801\uC778 \uCC44\uD50C \u2014 \uBC1D\uC740 \uCC44\uAD11 \uD640, \uC9C1\uC7A5\uC778 \uCEE4\uD50C \uACC4\uC57D \uB9CE\uC74C" },
  { name: "\uC18C\uB178\uD3A0\uB9AC\uCCB4 \uCEE8\uBCA4\uC158", area: "\uAC15\uB0A8\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "7.2~9.5\uB9CC", fee: "800\uB9CC", cap: "350~800\uBA85", note: "\uC0BC\uC131\uC5ED \uC9C1\uACB0 + '\uBBF8\uB140\uC640\uC57C\uC218 \uACC4\uB2E8' \uB85C\uBE44 \u2014 \uB300\uADDC\uBAA8 \uD558\uAC1D \uC218\uC6A9 \uAC15\uC810" },
  { name: "\uB8E8\uC774\uBE44\uC2A4\uCEE8\uBCA4\uC158 \uC911\uAD6C\uC810", area: "\uC911\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "8.5\uB9CC \uB0B4\uC678", fee: "850\uB9CC", cap: "200~500\uBA85", note: "\uD638\uD154\uAE09 \uC778\uD14C\uB9AC\uC5B4 \uB2E8\uB3C5\uD640 \u2014 1\uC2DC\uAC04 10\uBD84 \uC5EC\uC720 \uC608\uC2DD\uC73C\uB85C \uC778\uAE30" },
  { name: "\uC138\uBE5B\uC12C \uD50C\uB85C\uD305\uC544\uC77C\uB79C\uB4DC", area: "\uC11C\uCD08\uAD6C", type: "\uCEE8\uBCA4\uC158", meal: "6~12\uB9CC", fee: "200~500\uB9CC", cap: "100~400\uBA85", note: "\uBC18\uD3EC \uD55C\uAC15 \uC704 \uC778\uACF5\uC12C \u2014 \uD654\uC774\uD2B8 \uB3D4 + \uD55C\uAC15 \uBDF0 \uC774\uC0C9 \uBCA0\uB274, \uC57C\uC678\xB7\uB8E8\uD504\uD1B1 \uAC00\uB2A5" },
  { name: "\uB178\uBE14\uBC1C\uB80C\uD2F0 \uB300\uCE58", area: "\uAC15\uB0A8\uAD6C", type: "\uD558\uC6B0\uC2A4", meal: "10~12\uB9CC", fee: "700~1,000\uB9CC", cap: "200~400\uBA85", note: "\uD558\uC6B0\uC2A4\uC6E8\uB529 \uC785\uBB38 \uB300\uD45C \u2014 \uD638\uD154 \uB290\uB08C \uC5F0\uCD9C \uB300\uBE44 \uD569\uB9AC\uC801, \uC8FC\uB9D0 \uACE8\uB4E0\uD0C0\uC784 \uC870\uAE30 \uB9C8\uAC10" }
];
const WEDDING_EXPOS = [
  { name: "\uC81C423\uD68C \uC6E8\uB371\uC2A4 \uC6E8\uB529\uBC15\uB78C\uD68C", date: "2026-07-25 ~ 07-26", venue: "\uCF54\uC5D1\uC2A4 3\uCE35 \uCEE8\uD37C\uB7F0\uC2A4\uB8F8", url: "https://www.weddex.com/", note: "\uC608\uBE44\uBD80\uBD80 \uBB34\uB8CC\uC785\uC7A5 \xB7 \uC2A4\uB4DC\uBA54/\uC608\uBB3C/\uD5C8\uB2C8\uBB38/\uC6E8\uB529\uD640 \uC885\uD569", exact: true },
  { name: "\uC6A9\uC0B0 \uC544\uC774\uD30C\uD06C\uBAB0 \uB300\uD615 \uC6E8\uB529\uBC15\uB78C\uD68C", date: "2026-07-25 ~ 07-26", venue: "\uC6A9\uC0B0 \uC544\uC774\uD30C\uD06C\uBAB0 \uB9AC\uBE59\uD30C\uD06C 5\uCE35", url: "https://todaywedding.kr/seoul.php", note: "\uBC31\uD654\uC810 \uC5F0\uACC4\uD615 \xB7 \uC0AC\uC804\uB4F1\uB85D \uBB34\uB8CC", exact: true },
  { name: "\uD558\uC6B0\uD22C \uB300\uD615 \uC6E8\uB529\uBC15\uB78C\uD68C", date: "2026-07-25 ~ 07-26", venue: "SETEC 2\uCE35 \uC804\uC2DC\uC2E4", url: "https://todaywedding.kr/seoul.php", note: "\uC138\uD14D \uC885\uD569 \uC6E8\uB529\uBC15\uB78C\uD68C", exact: true },
  { name: "\uC6A9\uC0B0 \uC544\uC774\uD30C\uD06C \uC6E8\uB529\xB7\uD63C\uC218\uBC15\uB78C\uD68C", date: "2026-08-01 ~ 08-02", venue: "\uC6A9\uC0B0 \uC544\uC774\uD30C\uD06C\uBAB0 \uB9AC\uBE59\uD30C\uD06C 5\uCE35", url: "https://weddingfair.seoul.kr/", note: "\uC6E8\uB529\xB7\uD63C\uC218 \uB3D9\uC2DC \uAC1C\uCD5C", exact: true },
  { name: "\uC138\uD14D \uC6E8\uB529\xB7\uC6E8\uB529\uD640\xB7\uD5C8\uB2C8\uBB38 \uD398\uC5B4", date: "2026-08-08 ~ 08-09", venue: "SETEC 2\uCE35 \uC804\uC2DC\uC2E4", url: "https://weddingfair.seoul.kr/", note: "3\uAC1C \uD398\uC5B4 \uB3D9\uC2DC \uAC1C\uCD5C \xB7 \uC0AC\uC804\uB4F1\uB85D \uBB34\uB8CC", exact: true },
  { name: "\uC6E8\uB529&\uD63C\uC218 \uBC15\uB78C\uD68C (\uC138\uD14D)", date: "2026-08-22 ~ 08-23", venue: "SETEC \uC81C3\uC804\uC2DC\uC2E4", url: "https://www.setec.or.kr/front/schedule/list.do", note: "\uC138\uD14D \uACF5\uC2DD \uC804\uC2DC\uC77C\uC815 \uB4F1\uC7AC \uD655\uC815", exact: true },
  { name: "\uC7A0\uC2E4\xB7\uCCAD\uB7C9\uB9AC \uB86F\uB370\uBC31\uD654\uC810 \uC6E8\uB529\uBC15\uB78C\uD68C", date: "2026-08-22 ~ 08-23", venue: "\uB86F\uB370\uBC31\uD654\uC810 \uC7A0\uC2E4\uC810 / \uCCAD\uB7C9\uB9AC\uC810", url: "https://weddinggo.kr/seoul", note: "\uBC31\uD654\uC810 \uC5F0\uACC4\uD615", exact: true },
  { name: "\uD0A8\uD14D\uC2A4 \uC6E8\uB529\uBC15\uB78C\uD68C (\uC544\uC774\uB2C8\uC6E8\uB529)", date: "2026-09-12 ~", venue: "\uD0A8\uD14D\uC2A4 (\uC77C\uC0B0)", url: "http://iniwedding.com/event/weddingfair.html", note: "\uC77C\uC0B0\uAD8C \uB300\uD615 \uBC15\uB78C\uD68C", exact: true }
];
const EXPO_RECURRING = [
  { name: "\uC6E8\uB371\uC2A4 \uC6E8\uB529\uBC15\uB78C\uD68C", cycle: "\uAC70\uC758 \uB9E4\uC8FC \uD1A0\xB7\uC77C (\uC5F0 20\uD68C+)", venue: "\uCF54\uC5D1\uC2A4 3\uCE35 \uCEE8\uD37C\uB7F0\uC2A4\uB8F8", url: "https://www.weddex.com/" },
  { name: "\uC138\uD14D \uC6E8\uB529\xB7\uD5C8\uB2C8\uBB38 \uD398\uC5B4", cycle: "\uC6D4 1~2\uD68C \uC8FC\uB9D0", venue: "SETEC (\uD559\uC5EC\uC6B8\uC5ED)", url: "https://www.setec.or.kr/front/schedule/list.do" },
  { name: "\uC544\uC774\uB2C8\uC6E8\uB529&\uD63C\uC218\uBC15\uB78C\uD68C", cycle: "\uC6D4 1\uD68C \uB0B4\uC678 \xB7 \uCF54\uC5D1\uC2A4/aT\uC13C\uD130/\uD0A8\uD14D\uC2A4 \uC21C\uD68C", venue: "\uCF54\uC5D1\uC2A4 \xB7 aT\uC13C\uD130 \xB7 \uD0A8\uD14D\uC2A4", url: "http://iniwedding.com/event/weddingfair.html" },
  { name: "\uC6E8\uB371\uC2A4\uCF54\uB9AC\uC544 (\uCD98\uACC4/\uCD94\uACC4 \uB300\uD615)", cycle: "\uC5F0 2~4\uD68C (\uCD98\uACC4 2~3\uC6D4 \xB7 \uCD94\uACC4 6~9\uC6D4)", venue: "\uCF54\uC5D1\uC2A4 Hall B", url: "https://www.coex.co.kr/event/exhibitions-calendar/" },
  { name: "\uB2E4\uC774\uB809\uD2B8 \uACB0\uD63C\uC900\uBE44 \uC0C1\uC124 \uBC15\uB78C\uD68C", cycle: "\uB9E4\uC8FC \uD1A0\xB7\uC77C \uC0C1\uC124 (10:00~20:00)", venue: "\uAC15\uB0A8\uAD6C \uB3C4\uC0B0\uB300\uB85C 221, 8\uCE35", url: "https://todaywedding.kr/seoul.php" }
];
const HONEYMOON_DEFAULT = [
  {
    id: "h1",
    place: "\uBAB0\uB514\uBE0C",
    cost: 1200,
    season: "11~4\uC6D4 (\uAC74\uAE30)",
    note: "\uC218\uC0C1 \uD480\uBE4C\uB77C \uD734\uC591 \xB7 \uC218\uC0C1\uBE44\uD589\uAE30 \uC774\uB3D9",
    star: false,
    flight: "1\uC778 90~150\uB9CC (\uACBD\uC720)",
    days: "5\uBC15 7\uC77C",
    route: "\uC778\uCC9C \u2192 \uC2F1\uAC00\uD3EC\uB974/\uB450\uBC14\uC774 \uACBD\uC720 \u2192 \uB9D0\uB808 \u2192 \uC218\uC0C1\uBE44\uD589\uAE30\xB7\uC2A4\uD53C\uB4DC\uBCF4\uD2B8\uB85C \uB9AC\uC870\uD2B8 \uC774\uB3D9. 4\uBC15 \uC218\uC0C1\uBE4C\uB77C + 2\uBC15 \uBE44\uCE58\uBE4C\uB77C \uC870\uD569\uC774 \uAD6D\uB8F0. \uC62C\uC778\uD074\uB8E8\uC2DC\uBE0C \uCD94\uCC9C",
    booking: "\uB9AC\uC870\uD2B8\uB294 6\uAC1C\uC6D4+ \uC804 \uC5BC\uB9AC\uBC84\uB4DC\uAC00 \uAC00\uC7A5 \uC800\uB834. \uC218\uC0C1\uBE44\uD589\uAE30 \uC5F0\uACB0\uC744 \uC704\uD574 \uB9D0\uB808 \uC624\uD6C4 3\uC2DC \uC774\uC804 \uB3C4\uCC29 \uD56D\uACF5\uC73C\uB85C. \uD5C8\uB2C8\uBB38 \uD2B9\uC804(\uB514\uB108\xB7\uB370\uCF54) \uC694\uCCAD\uC740 \uC608\uC57D \uC2DC \uBBF8\uB9AC"
  },
  {
    id: "h2",
    place: "\uD558\uC640\uC774",
    cost: 1e3,
    season: "\uC5F0\uC911 (4~6\uC6D4 \uAC00\uC131\uBE44)",
    note: "\uD734\uC591 + \uAD00\uAD11 \uBC38\uB7F0\uC2A4 \xB7 \uC9C1\uD56D 8\uC2DC\uAC04",
    star: false,
    flight: "1\uC778 100~160\uB9CC (\uC9C1\uD56D)",
    days: "6\uBC15 8\uC77C",
    route: "\uC778\uCC9C \u2192 \uD638\uB180\uB8F0\uB8E8 \uC9C1\uD56D. \uC624\uC544\uD6C4 3~4\uBC15(\uC640\uC774\uD0A4\uD0A4\xB7\uB178\uC2A4\uC1FC\uC5B4\xB7\uCFE0\uC54C\uB85C\uC544\uB79C\uCE58) \u2192 \uC8FC\uB0B4\uC120\uC73C\uB85C \uB9C8\uC6B0\uC774 or \uBE45\uC544\uC77C\uB79C\uB4DC 2~3\uBC15(\uD560\uB808\uC544\uCE7C\uB77C \uC77C\uCD9C\xB7\uD654\uC0B0\uAD6D\uB9BD\uACF5\uC6D0). \uB80C\uD130\uCE74 \uD544\uC218",
    booking: "\uD56D\uACF5\uC740 4~6\uAC1C\uC6D4 \uC804 \uBC1C\uAD8C\uC774 \uC801\uC815\uAC00. 4~6\uC6D4\xB79~11\uC6D4\uC774 \uBE44\uC218\uAE30 \uAC00\uC131\uBE44 \uAD6C\uAC04. \uC778\uAE30 \uB808\uC2A4\uD1A0\uB791(\uB9C8\uB9C8\uC2A4\uD53C\uC2DC\uD558\uC6B0\uC2A4 \uB4F1)\uC740 1~2\uAC1C\uC6D4 \uC804 \uC608\uC57D"
  },
  {
    id: "h3",
    place: "\uCE78\uCFE4",
    cost: 1100,
    season: "12~4\uC6D4 (\uAC74\uAE30)",
    note: "\uC62C\uC778\uD074\uB8E8\uC2DC\uBE0C \uB9AC\uC870\uD2B8 \xB7 \uACBD\uC720 \uD544\uC218",
    star: false,
    flight: "1\uC778 150~220\uB9CC (\uACBD\uC720)",
    days: "6\uBC15 8\uC77C",
    route: "\uC778\uCC9C \u2192 \uB308\uB7EC\uC2A4/\uBA55\uC2DC\uCF54\uC2DC\uD2F0 \uACBD\uC720 \u2192 \uCE78\uCFE4. \uD638\uD154\uC874 \uC62C\uC778\uD074\uB8E8\uC2DC\uBE0C 4~5\uBC15 + \uCE58\uCCB8\uC774\uD2B8\uC0AC\xB7\uC138\uB178\uD14C \uB370\uC774\uD22C\uC5B4 1\uC77C + \uC774\uC2AC\uB77C \uBB34\uD5E4\uB808\uC2A4 \uCE74\uD0C0\uB9C8\uB780 1\uC77C",
    booking: "\uC62C\uC778\uD074\uB8E8\uC2DC\uBE0C\uB294 3~5\uAC1C\uC6D4 \uC804 \uD504\uB85C\uBAA8\uC158 \uB178\uB9AC\uAE30. \uC131\uC218\uAE30(12~4\uC6D4) \uD53C\uD558\uB824\uBA74 11\uC6D4 \uCD08 \uCD94\uCC9C. \uBBF8\uAD6D \uACBD\uC720 \uC2DC ESTA \uD544\uC218"
  },
  {
    id: "h4",
    place: "\uC774\uD0C8\uB9AC\uC544 + \uC2A4\uC704\uC2A4",
    cost: 1300,
    season: "5~6\uC6D4 \xB7 9~10\uC6D4",
    note: "\uAD00\uAD11 \uC911\uC2EC \xB7 10\uC77C \uC774\uC0C1 \uC77C\uC815 \uCD94\uCC9C \xB7 \uC774\uD0C8\uB9AC\uC544\uB9CC \uAC00\uBA74 2\uC778 \uC57D 950\uB9CC",
    star: false,
    flight: "1\uC778 90~140\uB9CC (\uC9C1\uD56D/1\uD68C \uACBD\uC720)",
    days: "9\uBC15 11\uC77C",
    route: "\uC778\uCC9C \u2192 \uB85C\uB9C8 in (2\uBC15, \uBC14\uD2F0\uCE78\xB7\uCF5C\uB85C\uC138\uC6C0) \u2192 \uD53C\uB80C\uCCB4 2\uBC15(\uD1A0\uC2A4\uCE74\uB098) \u2192 \uBCA0\uB124\uCE58\uC544 1\uBC15 \u2192 \uAE30\uCC28\uB85C \uBC00\uB77C\uB178 \uACBD\uC720 \u2192 \uC2A4\uC704\uC2A4 \uC778\uD130\uB77C\uCF04 3\uBC15(\uC735\uD504\uB77C\uC6B0\xB7\uADF8\uB9B0\uB378\uBC1C\uD2B8) \u2192 \uCDE8\uB9AC\uD788 out",
    booking: "5~6\uC6D4\xB79~10\uC6D4\uC774 \uB0A0\uC528\xB7\uAC00\uACA9 \uCD5C\uC801. \uC2A4\uC704\uC2A4 \uAE30\uCC28\uD328\uC2A4\xB7\uC735\uD504\uB77C\uC6B0 \uD2F0\uCF13\uC740 \uCD9C\uBC1C 2~3\uAC1C\uC6D4 \uC804 \uAD6C\uB9E4, \uB3C4\uC2DC \uAC04 \uC774\uB3D9\uC740 \uC720\uB808\uC77C\uBCF4\uB2E4 \uAD6C\uAC04\uAD8C \uBE44\uAD50. \uC2A4\uC704\uC2A4\uB97C \uBE7C\uACE0 \uC774\uD0C8\uB9AC\uC544\uB9CC(\uB85C\uB9C8 2\uBC15\xB7\uD53C\uB80C\uCCB4 2\uBC15\xB7\uC544\uB9D0\uD53C 2\uBC15\xB7\uBCA0\uB124\uCE58\uC544 2\uBC15, \uB85C\uB9C8 out) \uAD6C\uC131\uD558\uBA74 2\uC778 \uC57D 900~1,000\uB9CC\uC73C\uB85C 300\uB9CC\uAC00\uB7C9 \uC808\uC57D \u2014 \uC0B0\uC545\uC5F4\uCC28\xB7\uC2A4\uC704\uC2A4 \uBB3C\uAC00\uAC00 \uBE60\uC9C0\uB294 \uB300\uC2E0 \uB0A8\uBD80 \uD574\uC548\uC774 \uB4E4\uC5B4\uAC00 \uC77C\uC815\uB3C4 \uC5EC\uC720\uB85C\uC6C0"
  },
  {
    id: "h6",
    place: "\uCE90\uB098\uB2E4 (\uB85C\uD0A4+\uBC34\uCFE0\uBC84)",
    cost: 1100,
    season: "6~9\uC6D4 (\uB85C\uD0A4 \uC131\uC218\uAE30)",
    note: "\uB300\uC790\uC5F0 \uAD00\uAD11 \uC911\uC2EC \xB7 \uC9C1\uD56D 10\uC2DC\uAC04",
    star: false,
    flight: "1\uC778 110~160\uB9CC (\uC9C1\uD56D)",
    days: "7\uBC15 9\uC77C",
    route: "\uC778\uCC9C \u2192 \uBC34\uCFE0\uBC84 \uC9C1\uD56D in. \uBC34\uCFE0\uBC84 2\uBC15(\uC2A4\uD0E0\uB9AC\uD30C\uD06C\xB7\uADF8\uB79C\uBE4C\uC544\uC77C\uB79C\uB4DC\xB7\uAC1C\uC2A4\uD0C0\uC6B4) \u2192 \uAD6D\uB0B4\uC120\uC73C\uB85C \uCE98\uAC70\uB9AC \u2192 \uB80C\uD130\uCE74\uB85C \uBC34\uD504 3\uBC15(\uB808\uC774\uD06C\uB8E8\uC774\uC2A4\xB7\uBAA8\uB808\uC778\uD638\uC218\xB7\uC124\uD37C\uC0B0 \uACE4\uB3CC\uB77C) \u2192 \uC544\uC774\uC2A4\uD544\uB4DC \uD30C\uD06C\uC6E8\uC774 \uACBD\uC720 \uC7AC\uC2A4\uD37C 1\uBC15(\uCF5C\uB86C\uBE44\uC544 \uB300\uBE59\uC6D0) \u2192 \uCE98\uAC70\uB9AC or \uBC34\uCFE0\uBC84 out",
    booking: "\uB85C\uD0A4\uB294 6~9\uC6D4\uC774 \uD638\uC218 \uC0C9\xB7\uD2B8\uB808\uD0B9 \uCD5C\uC801 \u2014 \uBC34\uD504 \uC219\uC18C\uB294 4~6\uAC1C\uC6D4 \uC804 \uB9C8\uAC10\uB418\uB2C8 \uD56D\uACF5\uACFC \uAC19\uC774 \uC608\uC57D. \uBAA8\uB808\uC778\uD638\uC218\uB294 \uC154\uD2C0 \uC0AC\uC804\uC608\uC57D \uD544\uC218, \uB80C\uD130\uCE74\uB294 \uCE98\uAC70\uB9AC \uACF5\uD56D \uC218\uB839\uC774 \uB3D9\uC120 \uD6A8\uC728\uC801. eTA(\uC804\uC790\uC5EC\uD589\uD5C8\uAC00) \uBBF8\uB9AC \uC2E0\uCCAD"
  },
  {
    id: "h5",
    place: "\uBC1C\uB9AC",
    cost: 600,
    season: "4~10\uC6D4 (\uAC74\uAE30)",
    note: "\uAC00\uC131\uBE44 \uD480\uBE4C\uB77C \xB7 \uC9C1\uD56D 7\uC2DC\uAC04",
    star: false,
    flight: "1\uC778 60~90\uB9CC (\uC9C1\uD56D)",
    days: "5\uBC15 7\uC77C",
    route: "\uC778\uCC9C \u2192 \uB374\uD30C\uC0AC\uB974 \uC9C1\uD56D. \uC2A4\uBBF8\uB0D1/\uC9F1\uAD6C 2\uBC15(\uBE44\uCE58\uD074\uB7FD) \u2192 \uC6B0\uBD93 2\uBC15(\uB77C\uC774\uC2A4\uD14C\uB77C\uC2A4\xB7\uC815\uAE00 \uD480\uBE4C\uB77C) \u2192 \uC6B8\uB8E8\uC640\uB69C/\uB204\uC0AC\uB450\uC544 2\uBC15(\uC808\uBCBD \uC624\uC158\uBDF0\xB7\uC218\uC0C1\uC0AC\uC6D0). \uD504\uB77C\uC774\uBE57 \uB4DC\uB77C\uC774\uBC84 \uCC28\uD130 \uCD94\uCC9C",
    booking: "\uAC74\uAE30(4~10\uC6D4) \uC911 7~8\uC6D4 \uC131\uC218\uAE30\uB9CC \uD53C\uD558\uBA74 \uD480\uBE4C\uB77C\uAC00 30%\u2193. \uC6B0\uBD93 \uC778\uAE30 \uBE4C\uB77C\uB294 2~3\uAC1C\uC6D4 \uC804 \uB9C8\uAC10, \uACF5\uD56D \uD53D\uC5C5\uC740 \uC219\uC18C\uC5D0 \uC0AC\uC804 \uC694\uCCAD"
  }
];
const POLICY_BENEFITS = [
  { name: "\uD63C\uC778(\uACB0\uD63C) \uC138\uC561\uACF5\uC81C", target: "2024~2026\uB144 \uD63C\uC778\uC2E0\uACE0, \uC0DD\uC560 1\uD68C \xB7 \uC18C\uB4DD \uC81C\uD55C \uC5C6\uC74C", benefit: "1\uC778 50\uB9CC\uC6D0 \uC138\uC561\uACF5\uC81C \u2014 \uB9DE\uBC8C\uC774 \uAC01\uC790 \uC801\uC6A9 \uC2DC \uBD80\uBD80 \uD569\uC0B0 \uCD5C\uB300 100\uB9CC\uC6D0", fit: "good", fitText: "\uAC00\uB2A5", why: "\uC18C\uB4DD \uC81C\uD55C\uC774 \uC5C6\uC5B4 \uBD80\uBD80\uD569\uC0B0 1.5\uC5B5\uB3C4 \uC804\uC561 \uC801\uC6A9. 2026\uB144 \uB0B4 \uD63C\uC778\uC2E0\uACE0\uBD84\uAE4C\uC9C0", link: "https://www.hometax.go.kr" },
  { name: "\uD63C\uC778 \uC99D\uC5EC\uC7AC\uC0B0\uACF5\uC81C (\uACB0\uD63C\uC790\uAE08)", target: "\uD63C\uC778\uC2E0\uACE0 \uC804\uD6C4 \uAC01 2\uB144 \uB0B4 \uC9C1\uACC4\uC874\uC18D \uC99D\uC5EC", benefit: "1\uC5B5 \uCD94\uAC00\uACF5\uC81C + \uAE30\uBCF8 5\uCC9C\uB9CC = 1\uC778 1.5\uC5B5, \uC591\uAC00 \uD569\uC0B0 \uCD5C\uB300 3\uC5B5 \uBE44\uACFC\uC138", fit: "good", fitText: "\uAC00\uB2A5", why: "\uC18C\uB4DD\xB7\uC790\uC0B0 \uC694\uAC74 \uC5C6\uC74C. \uAE30\uC900\uC77C\uC740 \uD63C\uC778\uC2E0\uACE0\uC77C, \uC99D\uC5EC\uC138 \uC2E0\uACE0\uB294 \uD544\uC218", link: "https://www.nts.go.kr" },
  { name: "\uCCAD\uC57D \uACB0\uD63C \uD398\uB110\uD2F0 \uD3D0\uC9C0", target: "\uBAA8\uB4E0 (\uC608\uBE44)\uBD80\uBD80 \xB7 \uC18C\uB4DD \uBB34\uAD00", benefit: "\uBD80\uBD80 \uC911\uBCF5\uCCAD\uC57D \uD5C8\uC6A9, \uBC30\uC6B0\uC790 \uD63C\uC804 \uB2F9\uCCA8\uC774\uB825 \uBC30\uC81C, \uBC30\uC6B0\uC790 \uD1B5\uC7A5\uAE30\uAC04 50% \uD569\uC0B0(\uCD5C\uB300 3\uC810)", fit: "good", fitText: "\uAC00\uB2A5", why: "\uC18C\uB4DD \uBB34\uAD00 \u2014 \uB9DE\uBC8C\uC774 \uACE0\uC18C\uB4DD \uC2E0\uD63C\uBD80\uBD80\uC758 \uB2F9\uCCA8 \uD655\uB960\uC744 \uC2E4\uC9C8\uC801\uC73C\uB85C \uB192\uC5EC\uC8FC\uB294 \uC81C\uB3C4", link: "https://www.applyhome.co.kr" },
  { name: "ISA \uD655\uB300 \uAC1C\uD3B8", target: "19\uC138 \uC774\uC0C1 \xB7 \uC77C\uBC18\uD615\uC740 \uC18C\uB4DD \uC81C\uD55C \uC5C6\uC74C", benefit: "\uB0A9\uC785\uD55C\uB3C4 \uC5F0 4,000\uB9CC/\uCD1D 2\uC5B5, \uBE44\uACFC\uC138 500\uB9CC(\uCD08\uACFC\uBD84 9.9% \uBD84\uB9AC\uACFC\uC138)", fit: "good", fitText: "\uAC00\uB2A5", why: "\uC77C\uBC18\uD615\uC740 \uC18C\uB4DD \uBB34\uAD00 \u2014 \uBD80\uBD80 \uAC01\uC790 \uACC4\uC88C\uB85C \uD65C\uC6A9. \uAC1C\uC815 \uC2DC\uD589 \uC138\uBD80\uC0AC\uD56D\uC740 \uD655\uC778 \uD544\uC694", link: "https://www.moef.go.kr" },
  { name: "\uC2E0\uC0DD\uC544 \uD2B9\uB840 \uB514\uB524\uB3CC (\uAD6C\uC785)", target: "2\uB144 \uB0B4 \uCD9C\uC0B0 + \uB9DE\uBC8C\uC774 \uD569\uC0B0 2\uC5B5 \uC774\uD558 \xB7 \uC8FC\uD0DD 9\uC5B5/85\u33A1 \uC774\uD558", benefit: "\uCD5C\uB300 4\uC5B5(\uC0DD\uC560\uCD5C\uCD08 LTV 80%) \xB7 \uD2B9\uB840\uAE08\uB9AC 1.8~4.5% 5\uB144(\uCD9C\uC0B0\uB9C8\uB2E4 +5\uB144)", fit: "warn", fitText: "\uCD9C\uC0B0 \uC2DC \uAC00\uB2A5", why: "\uB9DE\uBC8C\uC774 \uD2B9\uB840 \uD569\uC0B0 2\uC5B5\uAE4C\uC9C0 \uD5C8\uC6A9 \u2014 \uB2E8 \uCD9C\uC0B0\uC774 \uC804\uC81C, \uC18C\uB4DD \uC0C1\uC704\uAD6C\uAC04\uC740 \uAE08\uB9AC \uC0C1\uB2E8. \uACFC\uCC9C\uC740 9\uC5B5 \uC0C1\uD55C\uC774 \uAD00\uAC74", link: "https://www.myhome.go.kr" },
  { name: "\uC2E0\uC0DD\uC544 \uD2B9\uB840 \uBC84\uD300\uBAA9 (\uC804\uC138)", target: "2\uB144 \uB0B4 \uCD9C\uC0B0 + \uB9DE\uBC8C\uC774 \uD569\uC0B0 2\uC5B5 \uC774\uD558 \xB7 \uC21C\uC790\uC0B0 3.45\uC5B5 \uC774\uD558", benefit: "\uBCF4\uC99D\uAE08 80% \uC774\uB0B4 \uCD5C\uB300 2.4\uC5B5 \xB7 1%\uB300 \uC911\uBC18~3%\uB300 \uD2B9\uB840\uAE08\uB9AC", fit: "warn", fitText: "\uCD9C\uC0B0 \uC2DC \uAC00\uB2A5", why: "\uC18C\uB4DD\uC740 \uD1B5\uACFC \uAC00\uB2A5\uD558\uB098 \uCD9C\uC0B0 \uC694\uAC74 \uD544\uC218 + \uC21C\uC790\uC0B0 \uAE30\uC900 \uD655\uC778 \uD544\uC694", link: "https://www.myhome.go.kr" },
  { name: "\uC11C\uC6B8\uC2DC \uC7A5\uAE30\uC804\uC138\u2161 (\uBBF8\uB9AC\uB0B4\uC9D1)", target: "\uD63C\uC778 7\uB144 \uB0B4 \uBB34\uC8FC\uD0DD \xB7 60\u33A1 \uCD08\uACFC\uB294 \uB9DE\uBC8C\uC774 \uC18C\uB4DD 200% \uC774\uD558", benefit: "\uC2DC\uC138\uBCF4\uB2E4 \uB0AE\uC740 \uC804\uC138\uB85C 10\uB144+ \uAC70\uC8FC, \uCD9C\uC0B0 \uC2DC \uC5F0\uC7A5\xB7\uB9E4\uC218\uCCAD\uAD6C\uAD8C", fit: "warn", fitText: "\uACBD\uACC4\uC120", why: "\uB9DE\uBC8C\uC774 200% \uAE30\uC900(2\uC778 \uC5F0 1.4~1.5\uC5B5\uB300)\uC5D0 \uAC78\uCE58\uB294 \uC18C\uB4DD \u2014 \uACF5\uACE0\uBCC4 \uAE30\uC900\uC561 \uD655\uC778 \uD544\uC218", link: "https://www.i-sh.co.kr" },
  { name: "\uCCAD\uB144\uC8FC\uD0DD\uB4DC\uB9BC \uCCAD\uC57D\uD1B5\uC7A5", target: "19~34\uC138 \uBB34\uC8FC\uD0DD \xB7 \uAC1C\uC778 \uC5F0\uC18C\uB4DD 5\uCC9C\uB9CC \uC774\uD558", benefit: "\uC6B0\uB300\uAE08\uB9AC \uCD5C\uACE0 4.5% + \uB2F9\uCCA8 \uC2DC 1.5%\uB300 \uC5F0\uACC4\uB300\uCD9C(6\uC5B5/85\u33A1 \uC774\uD558)", fit: "warn", fitText: "\uBD80\uBD84\uAC00\uB2A5", why: "\uAC1C\uC778\uC18C\uB4DD 5\uCC9C\uB9CC \uC774\uD558\uC778 \uBC30\uC6B0\uC790 \uBA85\uC758\uB85C\uB9CC \uAC00\uC785 \uAC00\uB2A5", link: "https://www.molit.go.kr/2024dreamaccount/main.jsp" },
  { name: "\uCCAD\uC57D\uD1B5\uC7A5 \uC18C\uB4DD\uACF5\uC81C", target: "\uCD1D\uAE09\uC5EC 7\uCC9C\uB9CC \uC774\uD558 + \uBB34\uC8FC\uD0DD \uC138\uB300\uC8FC", benefit: "\uC5F0 \uB0A9\uC785 300\uB9CC \uD55C\uB3C4\uC758 40%, \uCD5C\uB300 120\uB9CC \uC18C\uB4DD\uACF5\uC81C", fit: "warn", fitText: "\uBD80\uBD84\uAC00\uB2A5", why: "\uC138\uB300\uC8FC \uCD1D\uAE09\uC5EC \uAE30\uC900 \u2014 \uBD80\uBD80 \uBAA8\uB450 7\uCC9C\uB9CC \uCD08\uACFC\uBA74 \uBD88\uAC00", link: "https://www.hometax.go.kr" },
  { name: "\uCCAD\uB144\uBBF8\uB798\uC801\uAE08 (2026 \uC2E0\uC124)", target: "19~34\uC138 \xB7 \uAC1C\uC778 7,500\uB9CC + \uAC00\uAD6C \uC911\uC704 200% \uC774\uD558", benefit: "3\uB144 \uB9CC\uAE30 \xB7 \uC6D4 50\uB9CC \xB7 \uC815\uBD80\uAE30\uC5EC\uAE08 6~12% \uB9E4\uCE6D + \uBE44\uACFC\uC138", fit: "bad", fitText: "\uC18C\uB4DD \uCD08\uACFC", why: "\uBD80\uBD80\uD569\uC0B0 1.5\uC5B5\uC740 2\uC778 \uAC00\uAD6C \uC911\uC704 200%\uB97C \uCD08\uACFC\uD574 \uAC00\uAD6C\uC18C\uB4DD \uC694\uAC74 \uD0C8\uB77D", link: "https://ylaccount.kinfa.or.kr" },
  { name: "\uC2E0\uD63C\uBD80\uBD80 \uC804\uC6A9 \uB514\uB524\uB3CC\xB7\uBC84\uD300\uBAA9", target: "\uD63C\uC778 7\uB144 \uB0B4 \xB7 \uBD80\uBD80\uD569\uC0B0 7,500\uB9CC~8,500\uB9CC \uC774\uD558", benefit: "\uAD6C\uC785 \uCD5C\uB300 4\uC5B5(2%\uB300) / \uC804\uC138 \uC218\uB3C4\uAD8C \uCD5C\uB300 2.5\uC5B5(1.9~3.3%)", fit: "bad", fitText: "\uC18C\uB4DD \uCD08\uACFC", why: "\uBD80\uBD80\uD569\uC0B0 \uC18C\uB4DD \uD55C\uB3C4\uB97C \uD06C\uAC8C \uCD08\uACFC", link: "https://nhuf.molit.go.kr" },
  { name: "\uC11C\uC6B8\uC2DC \uC784\uCC28\uBCF4\uC99D\uAE08 \uC774\uC790\uC9C0\uC6D0", target: "\uD63C\uC778 7\uB144 \uB0B4 \xB7 \uBD80\uBD80\uD569\uC0B0 1.3\uC5B5 \uC774\uD558 \xB7 \uBCF4\uC99D\uAE08 7\uC5B5 \uC774\uD558", benefit: "\uB300\uCD9C \uCD5C\uB300 3\uC5B5\uC5D0 \uC5F0 1.5%+\u03B1 \uC774\uC790\uC9C0\uC6D0, \uCD5C\uC7A5 10\uB144", fit: "bad", fitText: "\uC18C\uB4DD \uCD08\uACFC", why: "\uC0C1\uD5A5\uB41C \uAE30\uC900(1.3\uC5B5)\uB3C4 \uCD08\uACFC \u2014 \uCD94\uAC00 \uC0C1\uD5A5 \uC5EC\uBD80\uB294 \uBAA8\uB2C8\uD130\uB9C1 \uAC00\uCE58 \uC788\uC74C", link: "https://housing.seoul.go.kr" }
];
const KIDS_CHECKLIST_DEFAULT = [
  { cat: "\uC784\uC2E0 \uC900\uBE44", items: [
    "\uBCF4\uAC74\uC18C \uBB34\uB8CC \uC0B0\uC804\uAC80\uC0AC (\uBD80\uBD80 \uBAA8\uB450 \u2014 \uD48D\uC9C4\xB7\uC5FD\uC0B0 \uD3EC\uD568)",
    "\uB09C\uC784\xB7\uC784\uC2E0 \uC9C0\uC6D0 \uC815\uCC45 \uD655\uC778 (\uC9C0\uC790\uCCB4\uBCC4 \uC0C1\uC774)",
    "\uC2E0\uC0DD\uC544 \uD2B9\uACF5\xB7\uC2E0\uC0DD\uC544 \uD2B9\uB840\uB300\uCD9C \uC694\uAC74 \uBBF8\uB9AC \uD655\uC778 (\uC18C\uB4DD\xB7\uC8FC\uD0DD\uAC00\uACA9 \uC0C1\uD55C)",
    "\uD0DC\uC544\uBCF4\uD5D8 \uACAC\uC801 \uBE44\uAD50 (\uC784\uC2E0 \uD655\uC778 \uC9C1\uD6C4 \uAC00\uC785\uC774 \uC870\uAC74 \uC720\uB9AC)",
    "\uCD9C\uC0B0\uD734\uAC00\xB7\uC721\uC544\uD734\uC9C1 \uC77C\uC815 \uD68C\uC0AC\uC640 \uC0AC\uC804 \uD611\uC758"
  ] },
  { cat: "\uC784\uC2E0 \uC911", items: [
    "\uC784\uC2E0\xB7\uCD9C\uC0B0 \uC9C4\uB8CC\uBE44 \uBC14\uC6B0\uCC98 \uC2E0\uCCAD (\uAD6D\uBBFC\uD589\uBCF5\uCE74\uB4DC 100\uB9CC\uC6D0)",
    "\uC0B0\uBD80\uC778\uACFC \uC815\uAE30\uAC80\uC9C4 \uC77C\uC815 \uCE98\uB9B0\uB354 \uB4F1\uB85D",
    "\uC0B0\uD6C4\uC870\uB9AC\uC6D0 \uC608\uC57D \u2014 \uC778\uAE30 \uC9C0\uC5ED\uC740 \uC784\uC2E0 \uCD08\uAE30\uC5D0 \uB9C8\uAC10",
    "\uC544\uAE30\uC6A9\uD488 \uB9AC\uC2A4\uD2B8 \uC791\uC131 (\uC911\uACE0\xB7\uBB3C\uB824\uBC1B\uAE30 \uBA3C\uC800 \uD655\uC778)",
    "\uC5B4\uB9B0\uC774\uC9D1 \uC785\uC18C\uB300\uAE30 \uB4F1\uB85D \uAC00\uB2A5 \uC5EC\uBD80 \uD655\uC778 (\uC77C\uBD80 \uC9C0\uC790\uCCB4 \uC784\uC2E0 \uC911 \uAC00\uB2A5)"
  ] },
  { cat: "\uCD9C\uC0DD ~ 6\uAC1C\uC6D4", items: [
    "\uCD9C\uC0DD\uC2E0\uACE0 (1\uAC1C\uC6D4 \uB0B4) + \uCCAB\uB9CC\uB0A8\uC774\uC6A9\uAD8C(200\uB9CC\uC6D0) \uC2E0\uCCAD",
    "\uBD80\uBAA8\uAE09\uC5EC \uC2E0\uCCAD (0\uC138 \uC6D4 100\uB9CC \xB7 1\uC138 \uC6D4 50\uB9CC)",
    "\uC544\uB3D9\uC218\uB2F9 \uC2E0\uCCAD (\uC6D4 10\uB9CC\uC6D0, \uB9CC 8\uC138\uAE4C\uC9C0)",
    "\uC608\uBC29\uC811\uC885 \uC77C\uC815 \uB4F1\uB85D (BCG\xB7B\uD615\uAC04\uC5FC \uB4F1 \u2014 \uC9C8\uBCD1\uCCAD \uC571)",
    "\uC601\uC720\uC544 \uAC74\uAC15\uAC80\uC9C4 \uC8FC\uAE30 \uB4F1\uB85D",
    "\uC5B4\uB9B0\uC774\uC9D1 \uC785\uC18C\uB300\uAE30 \uB4F1\uB85D (\uC778\uAE30 \uAD6D\uACF5\uB9BD\uC740 1~2\uB144 \uB300\uAE30)"
  ] },
  { cat: "6\uAC1C\uC6D4 ~ 3\uC138", items: [
    "\uBD80\uBAA8\uAE09\uC5EC \u2192 \uC591\uC721\uC218\uB2F9/\uBCF4\uC721\uB8CC \uC804\uD658 \uD655\uC778 (\uC5B4\uB9B0\uC774\uC9D1 \uC774\uC6A9 \uC5EC\uBD80\uC5D0 \uB530\uB77C)",
    "\uC5B4\uB9B0\uC774\uC9D1 \uC801\uC751 \uD504\uB85C\uADF8\uB7A8 \uACC4\uD68D",
    "\uC601\uC720\uC544 \uBC1C\uB2EC \uCCB4\uD06C (\uAC80\uC9C4 \uC2DC\uAE30\uB9C8\uB2E4)",
    "\uC591\uAC00 \uB3CC\uBD04\xB7\uC544\uC774\uB3CC\uBD04\uC11C\uBE44\uC2A4 \uB4F1 \uBCF4\uC721 \uACF5\uBC31 \uB300\uCC45"
  ] },
  { cat: "4~5\uC138 (\uC720\uC544)", items: [
    "\uC720\uCE58\uC6D0 vs \uC5B4\uB9B0\uC774\uC9D1 \uACB0\uC815 (\uC720\uC544\uD559\uBE44\xB7\uBCF4\uC721\uB8CC \uC9C0\uC6D0 \uBE44\uAD50)",
    "'\uCC98\uC74C\uD559\uAD50\uB85C' \uC720\uCE58\uC6D0 \uC785\uD559 \uC2E0\uCCAD (\uB9E4\uB144 11\uC6D4 \uCD94\uCCA8)",
    "\uC0AC\uAD50\uC721 \uBC29\uD5A5 \uBD80\uBD80 \uD569\uC758 (\uC2DC\uC791 \uC2DC\uAE30\xB7\uC608\uC0B0 \uC0C1\uD55C)"
  ] },
  { cat: "\uCD08\uB4F1 \uC774\uD6C4", items: [
    "\uCDE8\uD559\uD1B5\uC9C0\uC11C \uD655\uC778 (\uC785\uD559 \uC804\uD574 12\uC6D4) \uBC0F \uC608\uBE44\uC18C\uC9D1",
    "\uB298\uBD04\uD559\uAD50\xB7\uB3CC\uBD04\uAD50\uC2E4 \uC2E0\uCCAD (\uB9DE\uBC8C\uC774 \uD544\uC218 \uCCB4\uD06C)",
    "\uD559\uAD70\uC9C0 \uC774\uC0AC \uC5EC\uBD80 \uACB0\uC815 \u2014 \uB0B4 \uC9D1 \uB9C8\uB828 \uC785\uC8FC \uC2DC\uC810\uACFC \uC5F0\uACC4",
    "\uAD50\uC721\uBE44 \uC7A5\uAE30 \uC801\uB9BD \uC2DC\uC791 (\uC808\uC138\uACC4\uC88C \uD65C\uC6A9)"
  ] }
];
const KIDS_EDU = [
  { stage: "\uC5B4\uB9B0\uC774\uC9D1 (0~5\uC138)", timing: "\uC785\uC18C\uB300\uAE30 \uB4F1\uB85D: \uCD9C\uC0DD \uC9C1\uD6C4(\uBE60\uB97C\uC218\uB85D \uC720\uB9AC)", points: ["\uAD6D\uACF5\uB9BD \uC778\uAE30 \uC9C0\uC5ED 1~2\uB144 \uB300\uAE30 \u2014 \uC784\uC2E0\xB7\uCD9C\uC0B0 \uAC00\uC810 \uD65C\uC6A9", "\uBCF4\uC721\uB8CC \uC815\uBD80\uC9C0\uC6D0 (\uB9CC 0~5\uC138 \uC804\uC561 \uC218\uC900)", "\uB9DE\uBC8C\uC774\xB7\uB2E4\uC790\uB140\uB294 \uC785\uC18C \uC6B0\uC120\uC21C\uC704 \uAC00\uC810"], q: "\uC5B4\uB9B0\uC774\uC9D1 \uC785\uC18C\uB300\uAE30 \uAD6D\uACF5\uB9BD" },
  { stage: "\uC720\uCE58\uC6D0 (3~5\uC138)", timing: "'\uCC98\uC74C\uD559\uAD50\uB85C' \uB9E4\uB144 11\uC6D4 \uC2E0\uCCAD\xB7\uCD94\uCCA8", points: ["\uB204\uB9AC\uACFC\uC815 \uC720\uC544\uD559\uBE44 \uC9C0\uC6D0 (\uAD6D\uACF5\uB9BD \uBB34\uC0C1 \uC218\uC900, \uC0AC\uB9BD \uCC28\uC561 \uC790\uBD80\uB2F4)", "\uAD6D\uACF5\uB9BD \uACBD\uC7C1\uB960 \uB192\uC74C \u2014 1~3\uC9C0\uB9DD \uC804\uB7B5 \uD544\uC694", "\uBC29\uACFC\uD6C4\uACFC\uC815(\uB3CC\uBD04) \uC6B4\uC601 \uC5EC\uBD80 \uD655\uC778"], q: "\uCC98\uC74C\uD559\uAD50\uB85C \uC720\uCE58\uC6D0 \uC785\uD559" },
  { stage: "\uCD08\uB4F1\uD559\uAD50 (6\uB144)", timing: "\uCDE8\uD559\uD1B5\uC9C0\uC11C: \uC785\uD559 \uC804\uD574 12\uC6D4", points: ["\uC8FC\uC18C\uC9C0 \uAE30\uC900 \uBC30\uC815 \u2014 \uC774\uC0AC \uACC4\uD68D\uACFC \uC5F0\uACC4 \uD544\uC218", "\uB298\uBD04\uD559\uAD50 \uC804\uBA74 \uC2DC\uD589 \u2014 \uC544\uCE68\xB7\uC800\uB141 \uB3CC\uBD04", "\uC0AC\uB9BD\uCD08\uB294 11~12\uC6D4 \uBCC4\uB3C4 \uCD94\uCCA8"], q: "\uCD08\uB4F1\uD559\uAD50 \uC785\uD559 \uC900\uBE44 \uB298\uBD04\uD559\uAD50" },
  { stage: "\uC911\xB7\uACE0\uB4F1\uD559\uAD50 (6\uB144)", timing: "\uC911: \uADFC\uAC70\uB9AC \uBC30\uC815 \xB7 \uACE0: \uC720\uD615\uBCC4 \uC804\uD615", points: ["\uD559\uAD70\uC9C0 \uAC00\uCE58\uAC00 \uAC00\uC7A5 \uD06C\uAC8C \uC791\uC6A9\uD558\uB294 \uAD6C\uAC04", "\uACE0\uAD50 \uC720\uD615(\uC77C\uBC18\uACE0\xB7\uD2B9\uBAA9\uACE0\xB7\uC790\uC0AC\uACE0) \uB85C\uB4DC\uB9F5\uC740 \uC9112 \uC804\uAE4C\uC9C0 \uACB0\uC815", "\uACE0\uAD50\uD559\uC810\uC81C \uC2DC\uD589 \u2014 \uD559\uAD50\uBCC4 \uAC1C\uC124\uACFC\uBAA9 \uCC28\uC774 \uD655\uC778"], q: "\uACE0\uB4F1\uD559\uAD50 \uC785\uC2DC \uACE0\uAD50\uD559\uC810\uC81C" },
  { stage: "\uB300\uD559 (\uAD50\uC721\uBE44 \uC900\uBE44)", timing: "\uCD9C\uC0DD \uC9C1\uD6C4\uBD80\uD130 \uC7A5\uAE30 \uC801\uB9BD \uAD8C\uC7A5", points: ["4\uB144 \uAD6D\uACF5\uB9BD 3~4\uCC9C\uB9CC \xB7 \uC0AC\uB9BD 5~7\uCC9C\uB9CC \uC218\uC900(\uC0DD\uD65C\uBE44 \uBCC4\uB3C4)", "18\uB144 \uC6D4 20\uB9CC \uC801\uB9BD(\uC5F0 4%) \u2248 6,300\uB9CC \u2014 \uC2DC\uBBAC\uB808\uC774\uD130\uB85C \uACC4\uC0B0", "\uC99D\uC5EC \uACF5\uC81C(\uBBF8\uC131\uB144 10\uB144 2\uCC9C\uB9CC) \uD65C\uC6A9\uD55C \uC870\uAE30 \uC99D\uC5EC \uAC80\uD1A0"], q: "\uC790\uB140 \uAD50\uC721\uBE44 \uC900\uBE44 \uC99D\uC5EC" }
];
const SCHOOL_DISTRICTS = [
  { area: "\uACFC\uCC9C", tags: ["\uAC70\uC8FC \uC608\uC815\uC9C0", "\uC911\uC18C\uD615 \uD559\uAD70"], note: "\uD559\uC5C5 \uC131\uCDE8\uB3C4 \uB192\uACE0 \uBA74\uD559 \uBD84\uC704\uAE30 \uC870\uC6A9\uD55C \uD3B8. \uD559\uC6D0\uAC00\uB294 \uD3C9\uCD0C(15\uBD84) \uC758\uC874 \u2014 \uCD08\uB4F1\uAE4C\uC9C0\uB294 \uACFC\uCC9C, \uC911\uB4F1\uBD80\uD130 \uD3C9\uCD0C \uD559\uC6D0\uAC00 \uD65C\uC6A9\uC774 \uC77C\uBC18\uC801.", q: "\uACFC\uCC9C \uD559\uAD70 \uCD08\uB4F1\uD559\uAD50" },
  { area: "\uD3C9\uCD0C (\uC548\uC591 \uB3D9\uC548\uAD6C)", tags: ["\uC218\uB3C4\uAD8C 3\uB300 \uD559\uC6D0\uAC00"], note: "\uBC94\uACC4\xB7\uD3C9\uCD0C\uC5ED \uD559\uC6D0\uAC00 \uBC00\uC9D1. \uACFC\uCC9C\uC5D0\uC11C \uAC00\uC7A5 \uAC00\uAE4C\uC6B4 \uB300\uD615 \uD559\uC6D0\uAC00\uB85C, \uACFC\uCC9C \uAC70\uC8FC \uC2DC \uC2E4\uC9C8\uC801 \uC0AC\uAD50\uC721 \uAC70\uC810.", q: "\uD3C9\uCD0C \uD559\uC6D0\uAC00 \uD559\uAD70" },
  { area: "\uBD84\uB2F9 (\uC131\uB0A8)", tags: ["\uD559\uAD70 + \uD559\uC6D0\uAC00"], note: "\uC218\uB0B4\xB7\uC11C\uD604 \uC911\uC2EC \uD559\uAD70\uACFC \uC815\uC790\xB7\uBBF8\uAE08 \uD559\uC6D0\uAC00. \uD310\uAD50 \uC9C1\uC8FC\uADFC\uC811 \uC218\uC694\uC640 \uACB9\uCCD0 \uC9C4\uC785 \uBE44\uC6A9 \uB192\uC74C.", q: "\uBD84\uB2F9 \uD559\uAD70 \uC218\uB0B4 \uC11C\uD604" },
  { area: "\uB300\uCE58 (\uAC15\uB0A8)", tags: ["\uC804\uAD6D \uCD5C\uC0C1\uC704"], note: "\uC804\uAD6D \uCD5C\uB300 \uD559\uC6D0\uAC00. \uC911\uB4F1 \uC774\uD6C4 '\uB300\uCE58 \uC720\uD559' \uC218\uC694\uB3C4 \uB9CE\uC74C \u2014 \uAC70\uC8FC \uC804\uD658\uC740 \uAD50\uC721\uBE44\xB7\uC8FC\uAC70\uBE44 \uB3D9\uBC18 \uC0C1\uC2B9 \uAC10\uC548.", q: "\uB300\uCE58\uB3D9 \uD559\uAD70 \uD559\uC6D0\uAC00" },
  { area: "\uBAA9\uB3D9 (\uC591\uCC9C)", tags: ["\uAC15\uC11C\uAD8C \uB300\uD45C"], note: "\uBAA9\uB3D9 \uC2E0\uC2DC\uAC00\uC9C0 \uB2E8\uC9C0 \uC911\uC2EC \uD559\uAD70\xB7\uD559\uC6D0\uAC00. \uC7AC\uAC74\uCD95 \uC9C4\uD589\uC5D0 \uB530\uB77C \uB2E8\uC9C0\uBCC4 \uD3B8\uCC28.", q: "\uBAA9\uB3D9 \uD559\uAD70 \uC7AC\uAC74\uCD95" }
];
const HH_DEFAULT = {
  income1: 9700,
  income2: 6e3,
  assets: 2e4,
  monthlySave: 250,
  firstTime: true,
  targetKey: "jeonse59budget",
  rate: 6.3,
  existingDebtMonthly: 0,
  loanAmountCalc: 6e4,
  loanRateCalc: 4.5,
  loanYearsCalc: 30,
  repayType: "equal_payment",
  label1: "\uBCF8\uC778",
  label2: "\uBC30\uC6B0\uC790"
  // 커스텀 호칭 — 홈 설정에서 변경
};
const ALLOC_DEFAULT = { totalCash: 2e4, realty: 12e3, saving: 4e3, wedding: 3e3, kids: 0 };
const MILESTONES_DEFAULT = [
  { id: "m1", label: "\uACFC\uCC9C 4\uB2E8\uC9C0 \uCCAD\uC57D \uC811\uC218(\uC608\uC0C1)", date: "2026-09-14" },
  { id: "m2", label: "\uC804\uC138 \uACC4\uC57D \uBAA9\uD45C", date: "2026-12-01" }
];
function SectionHeader({ eyebrow, title, accent }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, eyebrow && /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[11px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5" }, eyebrow), /* @__PURE__ */ React.createElement("h3", { className: "text-[19px] font-bold tracking-tight text-[#0A0A0A]" }, title));
}
function Card({ children, className = "" }) {
  return /* @__PURE__ */ React.createElement("div", { className: `bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-5 ${className}` }, children);
}
function Kpi({ icon, label, value, accent = "#0A0A0A" }) {
  return /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-4 lg:p-5 flex items-center gap-3.5 border-l-4", style: { borderLeftColor: accent } }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:flex w-10 h-10 rounded-xl bg-[#F4F4F5] items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 18 })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A] mb-0.5" }, label), /* @__PURE__ */ React.createElement("div", { className: "text-[19px] lg:text-[21px] font-bold tracking-tight truncate", style: { fontVariantNumeric: "tabular-nums" } }, value)));
}
function ToneBadge({ tone, children }) {
  const map = { good: "bg-[#0A0A0A] text-white", warn: "bg-white text-[#0A0A0A] border border-[#0A0A0A]", bad: "bg-white text-[#9A9A9A] border border-dashed border-[#C9C9C9]", neutral: "bg-[#F2F2F2] text-[#525252]" };
  return /* @__PURE__ */ React.createElement("span", { className: `text-[12px] px-3 py-1 rounded-full font-semibold whitespace-nowrap ${map[tone] || map.neutral}` }, children);
}
function Field({ label, value, onChange, step = 1 }) {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      step,
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      className: "w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[16px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors",
      style: { fontVariantNumeric: "tabular-nums" }
    }
  ));
}
function Select({ label, value, onChange, options }) {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement(
    "select",
    {
      value,
      onChange: (e) => onChange(e.target.value),
      className: "w-full h-12 px-3 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    },
    options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o.value, value: o.value }, o.label))
  ));
}
function Toggle({ label, active, onClick, activeText, inactiveText }) {
  return /* @__PURE__ */ React.createElement("div", { className: "flex flex-col justify-end" }, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement("button", { onClick, className: `h-12 rounded-xl text-[15px] font-semibold border border-transparent transition-colors ${active ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#0A0A0A]"}` }, active ? activeText : inactiveText));
}
function Stat({ label, value, sub, tone }) {
  const color = tone === "warn" ? "text-[#0A0A0A]" : tone === "good" ? "text-[#0A0A0A]" : "text-[#0A0A0A]";
  return /* @__PURE__ */ React.createElement("div", { className: "py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1" }, label), /* @__PURE__ */ React.createElement("div", { className: `text-2xl font-bold ${color}`, style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, value), sub && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-1" }, sub));
}
function InfoNote({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 text-[13px] text-[#8A8A8A] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 15, className: "mt-0.5 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, children));
}
function FilterRow({ label, value, active }) {
  return /* @__PURE__ */ React.createElement("div", { className: `flex justify-between items-center px-4 py-3.5 rounded-xl ${active ? "bg-[#0A0A0A]/10 border border-[#0A0A0A]/40" : "bg-[#F7F7F7]"}` }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px]" }, label), /* @__PURE__ */ React.createElement("span", { className: `text-[16px] font-bold ${active ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}` }, value));
}
function SourceBadge({ source, error }) {
  if (error) return /* @__PURE__ */ React.createElement(ToneBadge, { tone: "bad" }, "\uC5F0\uB3D9 \uC2E4\uD328 \xB7 \uC0D8\uD50C");
  return source === "live" ? /* @__PURE__ */ React.createElement(ToneBadge, { tone: "good" }, "\uC2E4\uB370\uC774\uD130") : /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, "\uC0D8\uD50C\uB370\uC774\uD130");
}
function ProgressBar({ ratio, color = "#0A0A0A", height = 6 }) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100)));
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-full bg-[#F0F0F0] overflow-hidden", style: { height } }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full transition-all", style: { width: `${pct}%`, background: color } }));
}
function NumInput({ value, onChange, className = "" }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      className: `h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`,
      style: { fontVariantNumeric: "tabular-nums" }
    }
  );
}
function TextInput({ value, onChange, placeholder, className = "" }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      value,
      onChange: (e) => onChange(e.target.value),
      placeholder,
      className: `h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`
    }
  );
}
function IconBtn({ name, onClick, title, className = "" }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, title, className: `w-9 h-9 rounded-lg flex items-center justify-center text-[#8A8A8A] hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/5 shrink-0 ${className}` }, /* @__PURE__ */ React.createElement(Icon, { name, size: 16 }));
}
function PillNav({ tabs, tab, setTab }) {
  return /* @__PURE__ */ React.createElement("nav", { className: "sticky top-0 z-10 bg-[#F4F4F5]/95 backdrop-blur -mx-5 sm:-mx-10 px-5 sm:px-10 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 overflow-x-auto no-scrollbar" }, tabs.map((t) => {
    const active = tab === t.id;
    return /* @__PURE__ */ React.createElement("button", { key: t.id, onClick: () => setTab(t.id), className: `flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}` }, /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 14 }), t.label);
  })));
}
function RefreshBtn({ onClick, loading }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick,
      disabled: loading,
      className: "flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity shrink-0"
    },
    /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", className: loading ? "animate-spin" : "" }, /* @__PURE__ */ React.createElement("polyline", { points: "23 4 23 10 17 10" }), /* @__PURE__ */ React.createElement("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" })),
    loading ? "\uBD88\uB7EC\uC624\uB294 \uC911" : "\uC0C8\uB85C\uACE0\uCE68"
  );
}
function LiveUpdateBtn({ topic, params = "", onData }) {
  const [st, setSt] = useState({ loading: false, err: "" });
  const run = async () => {
    setSt({ loading: true, err: "" });
    try {
      const r = await fetch(api(`/api/research?topic=${topic}&force=1${params}`));
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.items || !j.items.length) throw new Error(j && j.message || "\uB9AC\uC11C\uCE58 \uC2E4\uD328 \u2014 \uC11C\uBC84 \uD0A4 \uC124\uC815 \uD655\uC778, \uC2DC\uAC04 \uCD08\uACFC\uBA74 1~2\uBD84 \uB4A4 \uB2E4\uC2DC \uC2DC\uB3C4");
      onData(j);
      setSt({ loading: false, err: "" });
    } catch (e) {
      setSt({ loading: false, err: String(e && e.message || e) });
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, st.err && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#8A8A8A] truncate max-w-[240px]", title: st.err }, st.err), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: run,
      disabled: st.loading,
      className: "flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40 shrink-0"
    },
    /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", className: st.loading ? "animate-spin" : "" }, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "8" }), /* @__PURE__ */ React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
    st.loading ? "\uC6F9 \uAC80\uC0C9\xB7\uC815\uB9AC \uC911 (1~3\uBD84)" : "\uCD5C\uC2E0 \uC815\uBCF4\uB85C \uAC31\uC2E0"
  ));
}
function NewsPanel({ query, eyebrow = "\uC2E4\uC2DC\uAC04", title }) {
  const [state, setState] = useState({ items: [], source: "sample", loading: true, at: null });
  const load = () => {
    setState((s) => ({ ...s, loading: true }));
    loadNews(query).then((r) => setState({ ...r, loading: false, at: /* @__PURE__ */ new Date() }));
  };
  useEffect(load, [query]);
  const naverUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow, title }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, state.at && !state.loading && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#8A8A8A]" }, state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), " \uAC31\uC2E0"), /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: load, loading: state.loading }))), state.source === "sample" && !state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-3" }, "\uC2E4\uC2DC\uAC04 \uB274\uC2A4\uB294 \uD504\uB85D\uC2DC \uC11C\uBC84\uAC00 \uD544\uC694\uD574\uC694. \uD130\uBBF8\uB110\uC5D0\uC11C ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded" }, "node server.js"), " \uC2E4\uD589 \uD6C4 ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded" }, "localhost:5173"), "\uC73C\uB85C \uC811\uC18D\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uC5F0\uB3D9\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("a", { href: naverUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-[14px] font-semibold underline underline-offset-4" }, '\uB124\uC774\uBC84 \uB274\uC2A4\uC5D0\uC11C "', query, '" \uBC14\uB85C \uAC80\uC0C9 ', /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 }))), state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uB274\uC2A4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\u2026")), !state.loading && state.items.length > 0 && /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F0F0F0]" }, state.items.slice(0, 10).map((n, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("a", { href: n.link, target: "_blank", rel: "noopener noreferrer", className: "block px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold leading-snug" }, n.title), /* @__PURE__ */ React.createElement("div", { className: "mt-1 flex items-center gap-2 text-[12px] text-[#8A8A8A]" }, n.source && /* @__PURE__ */ React.createElement("span", null, n.source), n.date && /* @__PURE__ */ React.createElement("span", { className: "font-mono" }, n.date)))))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("a", { href: naverUrl, target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#525252] underline underline-offset-4" }, "\uB124\uC774\uBC84 \uB274\uC2A4\uC5D0\uC11C \uB354 \uBCF4\uAE30"))));
}
function CustomNotes({ themeId, accent = "#0A0A0A" }) {
  const [notes, setNotes] = usePersist(`notes-${themeId}-v1`, []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const add = () => {
    if (!title.trim()) return;
    setNotes([...notes, { id: uid(), title: title.trim(), body: body.trim() }]);
    setTitle("");
    setBody("");
  };
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC790\uC720 \uAE30\uB85D", title: "\uCEE4\uC2A4\uD140 \uBA54\uBAA8", accent }), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, notes.map((n) => /* @__PURE__ */ React.createElement(Card, { key: n.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, n.title), n.body && /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mt-1.5 whitespace-pre-wrap" }, n.body)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => setNotes(notes.filter((x) => x.id !== n.id)) })))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-3" }, "\uC0C8 \uBA54\uBAA8 \uCD94\uAC00"), /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: title, onChange: setTitle, placeholder: "\uC81C\uBAA9 (\uC608: \uC0C1\uB2F4\uBC1B\uC740 \uC740\uD589 \uAE08\uB9AC \uBA54\uBAA8)" }), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: body,
      onChange: (e) => setBody(e.target.value),
      placeholder: "\uB0B4\uC6A9 (\uC120\uD0DD)",
      rows: 3,
      className: "w-full px-2.5 py-2 rounded-lg border border-[#E5E5E5] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/40 resize-y"
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: add, className: "w-full h-11 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5", style: { background: accent } }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 16 }), " \uCD94\uAC00\uD558\uAE30")))));
}
function SettingsModal({ open, onClose, hh, setHh }) {
  if (!open) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-5" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-black/40 backdrop-blur-sm", onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: "relative bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-6 w-full max-w-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-5" }, /* @__PURE__ */ React.createElement("h3", { className: "text-[19px] font-bold tracking-tight" }, "\uC124\uC815"), /* @__PURE__ */ React.createElement(IconBtn, { name: "plus", title: "\uB2EB\uAE30", onClick: onClose, className: "rotate-45" })), /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] mb-1" }, "\uD638\uCE6D \uC124\uC815"), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#8A8A8A] leading-relaxed mb-3" }, '"\uBCF8\uC778/\uBC30\uC6B0\uC790" \uB300\uC2E0 \uC4F8 \uC774\uB984\xB7\uC560\uCE6D\uC774\uC5D0\uC694. \uC9C4\uB2E8\xB7\uACC4\uC88C \uB4F1 \uBAA8\uB4E0 \uD654\uBA74\uC5D0 \uBC18\uC601\uB429\uB2C8\uB2E4.'), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#8A8A8A] block mb-1" }, "\uCCAB \uBC88\uC9F8"), /* @__PURE__ */ React.createElement(TextInput, { value: hh.label1 || "", onChange: (v) => setHh({ label1: v }), placeholder: "\uBCF8\uC778", className: "!h-11" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#8A8A8A] block mb-1" }, "\uB450 \uBC88\uC9F8"), /* @__PURE__ */ React.createElement(TextInput, { value: hh.label2 || "", onChange: (v) => setHh({ label2: v }), placeholder: "\uBC30\uC6B0\uC790", className: "!h-11" })))), /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold text-[14px]" }, "\uC644\uB8CC")));
}
function computeDiagnosis(s) {
  const income1 = s.income1 ?? 9700, income2 = s.income2 ?? 6e3;
  const assets = s.assets ?? 2e4, monthlySave = s.monthlySave ?? 250;
  const firstTime = s.firstTime ?? true, rate = s.rate ?? 6.3;
  const existingDebtMonthly = s.existingDebtMonthly ?? 0;
  const target = TARGETS.find((t) => t.key === (s.targetKey ?? "jeonse59budget"));
  const incomeWon = (income1 + income2) * 1e4;
  const dsrMonthlyBudget = Math.max(0, incomeWon * 0.4 / 12 - existingDebtMonthly * 1e4);
  const dsrLoan = loanFromMonthlyPayment(dsrMonthlyBudget, rate, 30);
  const ltvLoan = target.price * (firstTime ? 0.7 : 0.5);
  const tierCap = priceTierCap(target.price);
  const maxLoan = Math.min(dsrLoan, ltvLoan, tierCap);
  const bindingConstraint = maxLoan === tierCap ? "\uAC00\uACA9\uAD6C\uAC04 \uB300\uCD9C\uD55C\uB3C4" : maxLoan === ltvLoan ? "LTV" : "DSR(\uC18C\uB4DD)";
  const requiredCash = Math.max(0, target.price - maxLoan);
  const gap = requiredCash - assets * 1e4;
  const monthsToGoal = gap > 0 && monthlySave > 0 ? Math.ceil(gap / (monthlySave * 1e4)) : 0;
  return { target, dsrLoan, ltvLoan, tierCap, maxLoan, bindingConstraint, requiredCash, gap, monthsToGoal, yearsToGoal: (monthsToGoal / 12).toFixed(1) };
}
function MapPanel({ mapKey, points, height = 340 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState("idle");
  useEffect(() => {
    if (!mapKey) {
      setStatus("nokey");
      return;
    }
    let alive = true;
    loadNaver(mapKey).then(() => {
      if (!alive || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = new naver.maps.Map(ref.current, {
          center: new naver.maps.LatLng(37.4266, 126.9955),
          zoom: 13
        });
      }
      setStatus("ok");
    }).catch(() => {
      if (alive) setStatus("error");
    });
    return () => {
      alive = false;
    };
  }, [mapKey]);
  useEffect(() => {
    if (status !== "ok" || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const valid = (points || []).filter((p) => p.lat && p.lng);
    const bounds = valid.length ? new naver.maps.LatLngBounds() : null;
    valid.forEach((p) => {
      const pos = new naver.maps.LatLng(p.lat, p.lng);
      const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: p.title });
      const info = new naver.maps.InfoWindow({
        content: `<div style="padding:8px 12px;font-size:13px;max-width:220px;font-family:Pretendard,sans-serif">
          <b>${p.title}</b><br/><span style="color:#8A8A8A">${p.desc || ""}</span></div>`
      });
      naver.maps.Event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      markersRef.current.push(marker);
      if (bounds) bounds.extend(pos);
    });
    if (bounds && valid.length > 1) mapRef.current.fitBounds(bounds);
    else if (valid.length === 1) mapRef.current.setCenter(new naver.maps.LatLng(valid[0].lat, valid[0].lng));
  }, [points, status]);
  if (status === "nokey" || status === "error")
    return /* @__PURE__ */ React.createElement("div", { className: "rounded-2xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-6 text-center", style: { minHeight: height } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center justify-center h-full gap-2 text-[#8A8A8A]", style: { minHeight: height - 48 } }, /* @__PURE__ */ React.createElement(Icon, { name: "pin", size: 28 }), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-semibold text-[#525252]" }, status === "error" ? "\uC9C0\uB3C4 \uB85C\uB4DC \uC2E4\uD328" : "\uB124\uC774\uBC84 \uC9C0\uB3C4 \uD0A4\uAC00 \uD544\uC694\uD574\uC694"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] leading-relaxed max-w-xs" }, "\uC11C\uBC84 \uD658\uACBD\uBCC0\uC218 ", /* @__PURE__ */ React.createElement("b", { className: "font-mono text-[12px]" }, "NAVER_MAP_KEY"), "\uC5D0 \uB124\uC774\uBC84 \uC9C0\uB3C4 Client ID(ncpKeyId)\uB97C \uC124\uC815\uD558\uBA74 \uC9C0\uB3C4\uAC00 \uD65C\uC131\uD654\uB429\uB2C8\uB2E4. (NCP \u2192 Maps \u2192 Application\uC758 Web \uC11C\uBE44\uC2A4 URL\uC5D0 \uC774 \uC0AC\uC774\uD2B8 \uB3C4\uBA54\uC778 \uB4F1\uB85D \uD544\uC694)")));
  return /* @__PURE__ */ React.createElement("div", { ref, className: "rounded-2xl border border-[#E5E5E5] overflow-hidden", style: { height } });
}
function CheongyakTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(store.get("cheongyak-filter-v1", { region: "all", type: "all", area: "all", maxPrice: 0, hideExpired: true }));
  const load = () => {
    setState((s) => ({ ...s, loading: true }));
    loadCheongyak().then((r) => setState({ ...r, loading: false, at: /* @__PURE__ */ new Date() }));
  };
  useEffect(load, []);
  useEffect(() => store.set("cheongyak-filter-v1", f), [f]);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const regions = ["all", ...Array.from(new Set(state.items.map((i) => i.region)))];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const filtered = state.items.filter((i) => {
    if (f.region !== "all" && i.region !== f.region) return false;
    if (f.type !== "all" && !(i.types || []).includes(f.type)) return false;
    if (f.area !== "all" && !(i.areas || []).includes(Number(f.area))) return false;
    if (f.maxPrice > 0 && i.priceMin && i.priceMin > f.maxPrice * 1e4) return false;
    if (f.hideExpired && i.applyEnd && i.applyEnd < today) return false;
    return true;
  });
  const points = filtered.map((i) => ({ lat: i.lat, lng: i.lng, title: i.name, desc: `${i.region} \xB7 ${wonShortRaw(i.priceMin)}~${wonShortRaw(i.priceMax)}` }));
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC870\uAC74 \uAC80\uC0C9", title: "\uCCAD\uC57D \uC815\uBCF4" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, /* @__PURE__ */ React.createElement(SourceBadge, { source: state.source }), state.at && !state.loading && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#8A8A8A] hidden sm:inline" }, state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), " \uAC31\uC2E0"), /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: load, loading: state.loading }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-4" }, /* @__PURE__ */ React.createElement(Select, { label: "\uC9C0\uC5ED", value: f.region, onChange: set("region"), options: regions.map((r) => ({ value: r, label: r === "all" ? "\uC804\uCCB4" : r })) }), /* @__PURE__ */ React.createElement(Select, { label: "\uACF5\uAE09\uC720\uD615", value: f.type, onChange: set("type"), options: [["all", "\uC804\uCCB4"], ["\uC2E0\uD63C\uD2B9\uACF5", "\uC2E0\uD63C\uD2B9\uACF5"], ["\uC2E0\uC0DD\uC544", "\uC2E0\uC0DD\uC544"], ["\uC0DD\uC560\uCD5C\uCD08", "\uC0DD\uC560\uCD5C\uCD08"], ["\uC77C\uBC18\uACF5\uAE09", "\uC77C\uBC18\uACF5\uAE09"]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Select, { label: "\uD3C9\uD615", value: f.area, onChange: set("area"), options: [["all", "\uC804\uCCB4"], ["59", "59\u33A1"], ["74", "74\u33A1"], ["84", "84\u33A1"]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Field, { label: "\uBD84\uC591\uAC00 \uC0C1\uD55C(\uB9CC\uC6D0, 0=\uBB34\uC81C\uD55C)", value: f.maxPrice, onChange: set("maxPrice"), step: 5e3 }), /* @__PURE__ */ React.createElement(Toggle, { label: "\uC811\uC218 \uB9C8\uAC10\uB41C \uACF5\uACE0", active: f.hideExpired, onClick: () => setF((p) => ({ ...p, hideExpired: !p.hideExpired })), activeText: "\uC228\uAE30\uAE30", inactiveText: "\uBAA8\uB450 \uD45C\uC2DC" })), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[13px] text-[#8A8A8A] leading-relaxed" }, "\uC0C8\uB85C\uACE0\uCE68\uC744 \uB204\uB974\uBA74 \uCCAD\uC57D\uD648 \uCD5C\uC2E0 \uACF5\uACE0\uB97C \uB2E4\uC2DC \uBD88\uB7EC\uC640\uC694. \uC2E4\uB370\uC774\uD130\uB294 ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded" }, "node server.js"), " + ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded" }, "CHEONGYAK_KEY"), " \uC124\uC815 \uC2DC \uD65C\uC131\uD654\uB429\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start" }, /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-2 mb-6 lg:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold text-[#525252] mb-3" }, "\uAC80\uC0C9\uACB0\uACFC ", filtered.length, "\uAC74"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1" }, state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uCD5C\uC2E0 \uACF5\uACE0\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\u2026")), !state.loading && filtered.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uACF5\uACE0\uAC00 \uC5C6\uC5B4\uC694. \uD544\uD130\uB97C \uC644\uD654\uD574 \uBCF4\uC138\uC694.")), filtered.map((i) => {
    const expired = i.applyEnd && i.applyEnd < today;
    return /* @__PURE__ */ React.createElement(Card, { key: i.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, i.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-0.5" }, i.addr || i.region)), expired ? /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, "\uC811\uC218\uB9C8\uAC10") : /* @__PURE__ */ React.createElement(ToneBadge, { tone: "good" }, "\uC811\uC218\uC608\uC815")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-3" }, (i.types || []).map((t) => /* @__PURE__ */ React.createElement("span", { key: t, className: "text-[12px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A] font-semibold" }, t)), (i.areas || []).map((a) => /* @__PURE__ */ React.createElement("span", { key: a, className: "text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold" }, a, "\u33A1"))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-y-1.5 gap-x-3 text-[13px] text-[#3D3D3D]" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uBD84\uC591\uAC00 "), wonShort(i.priceMin), "~", wonShort(i.priceMax)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uACF5\uAE09 "), i.totalUnits ? i.totalUnits.toLocaleString() + "\uC138\uB300" : "-", i.specialUnits ? ` (\uD2B9\uACF5 ${i.specialUnits})` : ""), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uC811\uC218 "), i.applyStart || "-", " ~ ", i.applyEnd || "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uBC1C\uD45C "), i.announceDate || "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uC785\uC8FC "), i.moveIn || "-")), /* @__PURE__ */ React.createElement("a", { href: i.url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 mt-3 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2" }, "\uCCAD\uC57D\uD648\uC5D0\uC11C \uD655\uC778 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 })));
  }))), /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-3 lg:sticky lg:top-[70px]" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC704\uCE58", title: "\uC9C0\uB3C4\uC5D0\uC11C \uBCF4\uAE30" }), /* @__PURE__ */ React.createElement(MapPanel, { mapKey, points, height: 560 }))));
}
function RealtyListTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(store.get("realty-filter-v1", { region: "all", dealType: "all", area: "all", maxPrice: 0 }));
  const load = () => {
    setState((s) => ({ ...s, loading: true }));
    loadRealty().then((r) => setState({ ...r, loading: false, at: /* @__PURE__ */ new Date() }));
  };
  useEffect(load, []);
  useEffect(() => store.set("realty-filter-v1", f), [f]);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const regions = ["all", ...Array.from(new Set(state.items.map((i) => i.region)))];
  const filtered = state.items.filter((i) => {
    if (f.region !== "all" && i.region !== f.region) return false;
    if (f.dealType !== "all" && i.dealType !== f.dealType) return false;
    if (f.area !== "all" && Math.round(i.area) !== Number(f.area)) return false;
    if (f.maxPrice > 0 && i.price && i.price > f.maxPrice * 1e4) return false;
    return true;
  });
  const points = filtered.map((i) => ({ lat: i.lat, lng: i.lng, title: i.complex, desc: `${i.dealType} ${i.area}\u33A1 \xB7 ${i.priceText || wonRaw(i.price)}${i.rent ? "/\uC6D4 " + wonRaw(i.rent) : ""}` }));
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC870\uAC74 \uAC80\uC0C9", title: "\uBD80\uB3D9\uC0B0 \uB9E4\uBB3C" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, /* @__PURE__ */ React.createElement(SourceBadge, { source: state.source }), state.at && !state.loading && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#8A8A8A] hidden sm:inline" }, state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), " \uAC31\uC2E0"), /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: load, loading: state.loading }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" }, /* @__PURE__ */ React.createElement(Select, { label: "\uC9C0\uC5ED", value: f.region, onChange: set("region"), options: regions.map((r) => ({ value: r, label: r === "all" ? "\uC804\uCCB4" : r })) }), /* @__PURE__ */ React.createElement(Select, { label: "\uAC70\uB798\uC720\uD615", value: f.dealType, onChange: set("dealType"), options: [["all", "\uC804\uCCB4"], ["\uB9E4\uB9E4", "\uB9E4\uB9E4"], ["\uC804\uC138", "\uC804\uC138"], ["\uC6D4\uC138", "\uC6D4\uC138"]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Select, { label: "\uD3C9\uD615(\uC804\uC6A9\u33A1 \uBC18\uC62C\uB9BC)", value: f.area, onChange: set("area"), options: [["all", "\uC804\uCCB4"], ["59", "59\u33A1"], ["74", "74\u33A1"], ["84", "84\u33A1"]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Field, { label: "\uAC00\uACA9 \uC0C1\uD55C(\uB9CC\uC6D0, 0=\uBB34\uC81C\uD55C)", value: f.maxPrice, onChange: set("maxPrice"), step: 5e3 })), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[13px] text-[#8A8A8A] leading-relaxed" }, "\uB124\uC774\uBC84 \uBD80\uB3D9\uC0B0\uC740 \uACF5\uC2DD API\uAC00 \uC5C6\uC5B4 ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[12px] bg-[#F5F5F5] px-1.5 py-0.5 rounded" }, "server.js"), " \uD504\uB85D\uC2DC\uAC00 \uB300\uB9AC \uD638\uCD9C\uD574\uC694(\uAC1C\uC778 \uCC38\uACE0\uC6A9). \uD504\uB85D\uC2DC \uBBF8\uAC00\uB3D9 \uC2DC \uACFC\uCC9C \uC8FC\uC694 \uB2E8\uC9C0 \uC0D8\uD50C\uB85C \uB3D9\uC791\uD569\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start" }, /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-2 mb-6 lg:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold text-[#525252] mb-3" }, "\uAC80\uC0C9\uACB0\uACFC ", filtered.length, "\uAC74"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1" }, state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uB9E4\uBB3C\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\u2026")), !state.loading && filtered.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uB9E4\uBB3C\uC774 \uC5C6\uC5B4\uC694.")), filtered.map((i) => /* @__PURE__ */ React.createElement(Card, { key: i.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[12px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 text-[#0A0A0A] font-semibold" }, i.dealType), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, i.complex)), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-0.5" }, i.region, " ", i.addr, " \xB7 ", i.area, "\u33A1", i.built ? " \xB7 " + i.built + "\uB144" : "", i.floor ? " \xB7 " + i.floor : "")), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, i.priceText || wonShort(i.price)), i.rent > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#525252]" }, "\uC6D4 ", won(i.rent)))), (i.tags || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mt-3" }, i.tags.map((t, k) => /* @__PURE__ */ React.createElement("span", { key: k, className: "text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252]" }, t))))))), /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-3 lg:sticky lg:top-[70px]" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC704\uCE58", title: "\uC9C0\uB3C4\uC5D0\uC11C \uBCF4\uAE30" }), /* @__PURE__ */ React.createElement(MapPanel, { mapKey, points, height: 560 }))));
}
function RealtyChecklist() {
  const [state, setState] = useState(CHECKLIST_INIT.map((g) => ({ ...g, items: g.items.map((t) => ({ text: t, done: false })) })));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const doneMap = store.get("checklist-done-v2", null);
    if (doneMap) setState((prev) => prev.map((g, gi) => ({ ...g, items: g.items.map((it, ii) => ({ ...it, done: !!doneMap[`${gi}-${ii}`] })) })));
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const doneMap = {};
    state.forEach((g, gi) => g.items.forEach((it, ii) => {
      if (it.done) doneMap[`${gi}-${ii}`] = true;
    }));
    store.set("checklist-done-v2", doneMap);
  }, [ready, state]);
  const toggle = (gi, ii) => setState((prev) => {
    const next = prev.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it })) }));
    next[gi].items[ii].done = !next[gi].items[ii].done;
    return next;
  });
  const total = state.reduce((a, g) => a + g.items.length, 0);
  const done = state.reduce((a, g) => a + g.items.filter((i) => i.done).length, 0);
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC2E4\uD589 \uAD00\uB9AC", title: "\uCCB4\uD06C\uB9AC\uC2A4\uD2B8", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "\uC804\uCCB4 \uC9C4\uD589\uB960"), /* @__PURE__ */ React.createElement("span", { className: "text-[16px] font-bold text-[#0A0A0A]" }, done, " / ", total)), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, state.map((g, gi) => /* @__PURE__ */ React.createElement(Card, { key: gi }, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-3" }, g.cat), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((it, ii) => /* @__PURE__ */ React.createElement("li", { key: ii }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggle(gi, ii), className: "flex items-start gap-3 text-left w-full" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[15px] ${it.done ? "line-through text-[#8A8A8A]" : "text-[#0A0A0A]"}` }, it.text)))))))));
}
function RealtyTheme({ mapKey, hh, setHh, setTheme }) {
  const [tab, setTab] = usePersist("realty-tab-v1", "diag");
  const [newsRegion, setNewsRegion] = usePersist("news-region-v1", "\uACFC\uCC9C");
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
  const incomeWon = income * 1e4;
  const netAnnual = estimateNetAnnual(income1 * 1e4) + estimateNetAnnual(income2 * 1e4);
  const netMonthly = netAnnual / 12;
  const incomeExceedsSpecialSupply = income > 12600;
  const loanP = loanAmountCalc * 1e4, loanI = loanRateCalc / 100 / 12, loanN = loanYearsCalc * 12;
  let loanFirstMonthPay = 0, loanTotalPay = 0, loanTotalInterest = 0;
  if (loanP > 0 && loanN > 0) {
    if (repayType === "equal_payment") {
      const M = loanI > 0 ? loanP * loanI / (1 - Math.pow(1 + loanI, -loanN)) : loanP / loanN;
      loanFirstMonthPay = M;
      loanTotalPay = M * loanN;
      loanTotalInterest = loanTotalPay - loanP;
    } else {
      const principalPerMonth = loanP / loanN;
      loanFirstMonthPay = principalPerMonth + loanP * loanI;
      loanTotalInterest = loanI * loanP * (loanN + 1) / 2;
      loanTotalPay = loanP + loanTotalInterest;
    }
  }
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PillNav, { tabs: REALTY_TABS, tab, setTab }), ["diag", "strategy", "loan", "plan"].includes(tab) && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, tab === "diag" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "STEP 1", title: "\uC6B0\uB9AC \uBD80\uBD80 \uC815\uBCF4", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#8A8A8A]" }, "\uD648\uC758 \uBD80\uBD80 \uC815\uBCF4\uC640 \uC2E4\uC2DC\uAC04 \uC5F0\uB3D9"), /* @__PURE__ */ React.createElement("button", { onClick: () => setTheme && setTheme("home"), className: "text-[13px] font-semibold underline underline-offset-4" }, "\uD648\uC5D0\uC11C \uC218\uC815")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-2" }, [[`${hh.label1 || "\uBCF8\uC778"} \uC5F0\uC18C\uB4DD`, income1], [`${hh.label2 || "\uBC30\uC6B0\uC790"} \uC5F0\uC18C\uB4DD`, income2], ["\uD604\uC7AC \uC21C\uC790\uC0B0", assets], ["\uC6D4 \uC800\uCD95\uAC00\uB2A5", monthlySave], ["\uAE30\uC874 \uB300\uCD9C \uC6D4\uC0C1\uD658", existingDebtMonthly]].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, l), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, manWon(v))))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#E5E5E5] space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] text-[#525252]" }, "\uBD80\uBD80\uD569\uC0B0 \uC6D4\uC18C\uB4DD(\uC138\uC804, \uC5F0\xF712)"), /* @__PURE__ */ React.createElement("span", { className: "text-xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, won(Math.round(incomeWon / 12)))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] text-[#525252]" }, "\uBD80\uBD80\uD569\uC0B0 \uC6D4\uC18C\uB4DD(\uC138\uD6C4 \uCD94\uC815)"), /* @__PURE__ */ React.createElement("span", { className: "text-xl font-bold text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, won(Math.round(netMonthly))))), incomeExceedsSpecialSupply && /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex gap-2 text-[14px] text-[#0A0A0A] bg-[#0A0A0A]/5 rounded-xl p-3" }, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 16, className: "mt-0.5 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, "\uC18C\uB4DD \uAE30\uC900 \uC2E0\uD63C\uD2B9\uACF5(\uC6B0\uC120\xB7\uC77C\uBC18\uACF5\uAE09)\uC740 \uCD08\uACFC\uD560 \uAC00\uB2A5\uC131\uC774 \uB192\uC544\uC694. \uC790\uC0B0\uAE30\uC900 \uACBD\uB85C\uB098 \uC77C\uBC18\uACF5\uAE09\uC744 \uC911\uC2EC\uC73C\uB85C \uBCF4\uC138\uC694.")))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "STEP 2", title: "\uBAA9\uD45C \uC720\uD615 \uC120\uD0DD", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, TARGETS.map((t) => /* @__PURE__ */ React.createElement("button", { key: t.key, onClick: () => setTargetKey(t.key), className: `w-full text-left rounded-2xl border p-4 transition-colors ${targetKey === t.key ? "border-[#0A0A0A] bg-[#0A0A0A]/5" : "border-[#E5E5E5] bg-white"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-semibold" }, t.label), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-0.5" }, t.note)), /* @__PURE__ */ React.createElement("div", { className: "text-xl font-bold shrink-0", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, wonShort(t.price))))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "STEP 3", title: "\uC9C4\uB2E8 \uACB0\uACFC", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 bg-[#0A0A0A] text-white text-[15px] font-semibold" }, target.label), /* @__PURE__ */ React.createElement("div", { className: "px-5 divide-y divide-[#E5E5E5]" }, /* @__PURE__ */ React.createElement(Stat, { label: "\uBAA9\uD45C \uAC00\uACA9", value: won(target.price) }), /* @__PURE__ */ React.createElement(Stat, { label: "\uCD5C\uB300 \uB300\uCD9C\uAC00\uB2A5\uC561(\uCD94\uC815)", value: won(maxLoan), sub: `\uC81C\uC57D \uC694\uC778: ${bindingConstraint}` }), /* @__PURE__ */ React.createElement(Stat, { label: "\uD544\uC694 \uC790\uAE30\uC790\uBCF8", value: won(requiredCash) }), /* @__PURE__ */ React.createElement(Stat, { label: "\uC790\uAE30\uC790\uBCF8 \uAC2D", value: gap > 0 ? won(gap) : "\uCDA9\uC871", tone: gap > 0 ? "warn" : "good" }), /* @__PURE__ */ React.createElement(Stat, { label: "\uD604\uC7AC \uC800\uCD95 \uC18D\uB3C4\uB85C \uB2EC\uC131\uAE4C\uC9C0", value: gap > 0 ? `\uC57D ${yearsToGoal}\uB144 (${monthsToGoal}\uAC1C\uC6D4)` : "\uC989\uC2DC \uAC00\uB2A5", tone: gap > 0 ? "warn" : "good" })), gap > 0 && /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 text-[14px] text-[#525252] leading-relaxed bg-[#FAFAFA] border-t border-[#E5E5E5]" }, "2025\uB144 10\uC6D4 \uADDC\uC81C \uC774\uD6C4 \uB300\uCD9C\uD55C\uB3C4\uB294 \uAC00\uACA9\uAD6C\uAC04\uBCC4 \uD558\uB4DC\uCEA1\uC774 \uAC78\uB824 \uC788\uC5B4 \uC18C\uB4DD\uC774 \uB192\uC544\uB3C4 \uD55C\uACC4\uAC00 \uC788\uC5B4\uC694.", targetKey.startsWith("sale") ? " \uB9E4\uB9E4\uB294 \uC790\uAE30\uC790\uBCF8 \uBE44\uC911\uC774 \uC555\uB3C4\uC801\uC73C\uB85C \uCEE4\uC57C \uD574\uC11C \uCCAD\uC57D \uBCD1\uD589\uC744 \uAC15\uB825 \uCD94\uCC9C\uD574\uC694." : " \uCCAD\uC57D\uC740 \uBD84\uC591\uAC00 \uC0C1\uD55C\uC81C \uB355\uBD84\uC5D0 \uC790\uAE30\uC790\uBCF8 \uBD80\uB2F4\uC774 \uB0AE\uC9C0\uB9CC, \uB2F9\uCCA8 \uD655\uB960\uACFC \uC785\uC8FC \uC2DC\uC810\uC774 \uBD88\uD655\uC2E4\uD574\uC694.")))), tab === "strategy" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uACBD\uB85C \uBE44\uAD50", title: "\uCCAD\uC57D \xB7 \uB9E4\uB9E4 \xB7 \uC804\uC138", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, STRATEGIES.map((s, i) => /* @__PURE__ */ React.createElement(Card, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, s.title), /* @__PURE__ */ React.createElement(ToneBadge, { tone: s.tone }, s.badge)), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, s.points.map((p, j) => /* @__PURE__ */ React.createElement("li", { key: j, className: "flex gap-2 text-[15px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, p)))))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC6B0\uB9AC \uC870\uAC74 \uAE30\uC900", title: "\uD61C\uD0DD\xB7\uC81C\uB3C4 \uD65C\uC6A9 \uAC00\uB2A5 \uC5EC\uBD80", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-[14px] text-[#525252] bg-[#F7F7F7] rounded-xl p-4 leading-relaxed" }, '\uACFC\uCC9C\uC740 \uAC00\uACA9 \uC790\uCCB4\uAC00 \uB192\uC544\uC11C \uC870\uAC74\uC744 \uD1B5\uACFC\uD574\uB3C4 "\uAC00\uACA9 \uC0C1\uD55C"\uC5D0 \uB9C9\uD788\uB294 \uC81C\uB3C4\uAC00 \uB9CE\uC544\uC694. \uC2E4\uC81C\uB85C \uC5F4\uB824 \uC788\uB294 \uAC83\uACFC \uB9C9\uD788\uB294 \uAC83\uC744 \uAD6C\uBD84\uD588\uC5B4\uC694.'), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, BENEFITS.map((b, i) => /* @__PURE__ */ React.createElement(Card, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold" }, b.title), /* @__PURE__ */ React.createElement(ToneBadge, { tone: b.tone }, b.fit)), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-3" }, b.body), /* @__PURE__ */ React.createElement("a", { href: b.link, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2" }, b.label, " ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 })))))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uCCAD\uC57D \uC81C\uB3C4 \uB300\uCD9C \uADDC\uC81C \uBCC0\uACBD", eyebrow: "\uC81C\uB3C4 \uC5C5\uB370\uC774\uD2B8", title: "\uCD5C\uC2E0 \uC81C\uB3C4\xB7\uADDC\uC81C \uB274\uC2A4" })), tab === "loan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uACC4\uC0B0 \uACB0\uACFC", title: "\uB300\uCD9C \uD55C\uB3C4 3\uB2E8 \uD544\uD130", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement(FilterRow, { label: "\u2460 DSR 40% (\uC18C\uB4DD \uAE30\uBC18)", value: won(dsrLoan), active: maxLoan === dsrLoan }), /* @__PURE__ */ React.createElement(FilterRow, { label: `\u2461 LTV ${firstTime ? "70%(\uC0DD\uC560\uCD5C\uCD08)" : "50%"}`, value: won(ltvLoan), active: maxLoan === ltvLoan }), /* @__PURE__ */ React.createElement(FilterRow, { label: "\u2462 \uAC00\uACA9\uAD6C\uAC04 \uD558\uB4DC\uCEA1(2025.10.16~)", value: won(tierCap), active: maxLoan === tierCap })), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#E5E5E5] flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "\uCD5C\uC885 \uB300\uCD9C\uAC00\uB2A5\uC561"), /* @__PURE__ */ React.createElement("span", { className: "text-2xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, won(maxLoan))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC785\uB825\uAC12 \uC870\uC815", title: "\uC870\uAC74 \uBC14\uAFD4\uBCF4\uAE30", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: "\uC801\uC6A9\uAE08\uB9AC \xB7 \uC2A4\uD2B8\uB808\uC2A4 \uD3EC\uD568(%)", value: rate, onChange: setRate, step: 0.1 }), /* @__PURE__ */ React.createElement(Toggle, { label: "\uC0DD\uC560\uCD5C\uCD08 \uAD6C\uC785\uC790", active: firstTime, onClick: () => setHh({ firstTime: !firstTime }), activeText: "\uC608 (LTV 70%)", inactiveText: "\uC544\uB2C8\uC624 (LTV 50%)" })))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC9C1\uC811 \uACC4\uC0B0", title: "\uC774\uC790 \uACC4\uC0B0\uAE30", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "\uB300\uCD9C\uAE08\uC561(\uB9CC\uC6D0)", value: loanAmountCalc, onChange: setLoanAmountCalc }), /* @__PURE__ */ React.createElement(Field, { label: "\uAE08\uB9AC(%)", value: loanRateCalc, onChange: setLoanRateCalc, step: 0.1 }), /* @__PURE__ */ React.createElement(Field, { label: "\uB300\uCD9C\uAE30\uAC04(\uB144)", value: loanYearsCalc, onChange: setLoanYearsCalc }), /* @__PURE__ */ React.createElement(Toggle, { label: "\uC0C1\uD658\uBC29\uC2DD", active: repayType === "equal_payment", onClick: () => setHh({ repayType: repayType === "equal_payment" ? "equal_principal" : "equal_payment" }), activeText: "\uC6D0\uB9AC\uAE08\uADE0\uB4F1", inactiveText: "\uC6D0\uAE08\uADE0\uB4F1" })), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#E5E5E5]" }, /* @__PURE__ */ React.createElement(Stat, { label: repayType === "equal_payment" ? "\uB9E4\uB2EC \uC0C1\uD658\uC561(\uACE0\uC815)" : "\uCCAB \uB2EC \uC0C1\uD658\uC561(\uC774\uD6C4 \uC810\uC810 \uAC10\uC18C)", value: won(Math.round(loanFirstMonthPay)) }), /* @__PURE__ */ React.createElement(Stat, { label: "\uCD1D \uC774\uC790", value: won(Math.round(loanTotalInterest)), tone: "warn" }), /* @__PURE__ */ React.createElement(Stat, { label: "\uCD1D \uC0C1\uD658\uC561(\uC6D0\uAE08+\uC774\uC790)", value: won(Math.round(loanTotalPay)) })), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[13px] text-[#8A8A8A] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "\uC6D0\uB9AC\uAE08\uADE0\uB4F1"), "\uC740 \uB9E4\uB2EC \uAC19\uC740 \uAE08\uC561, ", /* @__PURE__ */ React.createElement("b", null, "\uC6D0\uAE08\uADE0\uB4F1"), "\uC740 \uC6D0\uAE08\uC744 \uB9E4\uB2EC \uB3D9\uC77C\uD558\uAC8C \uAC1A\uC544 \uC774\uC790\uAC00 \uC810\uC810 \uC904\uC5B4\uB4DC\uB294 \uB300\uC2E0 \uCD08\uBC18 \uC0C1\uD658\uC561\uC774 \uCEE4\uC694. \uCD1D \uC774\uC790\uB294 \uC6D0\uAE08\uADE0\uB4F1\uC774 \uB354 \uC801\uC5B4\uC694.")))), tab === "plan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uB85C\uB4DC\uB9F5", title: "\uB0B4\uC9D1\uB9C8\uB828 4\uB2E8\uACC4 \uD0C0\uC784\uB77C\uC778", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "relative pl-6" }, /* @__PURE__ */ React.createElement("div", { className: "absolute left-[9px] top-2 bottom-2 w-px bg-[#E5E5E5]" }), TIMELINE.map((p, idx) => /* @__PURE__ */ React.createElement("div", { key: idx, className: "mb-8 relative last:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#0A0A0A] border-2 border-white" }), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] mb-1" }, p.phase), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold mb-3", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, p.title), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, p.items.map((it, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex gap-2 text-[15px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, it))))))))), /* @__PURE__ */ React.createElement(RealtyChecklist, null))), tab === "loan" && /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: bankData.at ? `${bankData.at.slice(0, 10)} \uAC31\uC2E0 \uB370\uC774\uD130` : "2026-07 \uAE30\uC900 \xB7 \uCD94\uC815", title: "\uC740\uD589 \uC8FC\uB2F4\uB300 \uC0C1\uD488 \uBE44\uAD50", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(LiveUpdateBtn, { topic: "bankloans", onData: (j) => setBankData({ items: j.items, at: j.fetchedAt }) }))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, bankData.items.map((b) => {
    const mid = Math.round((b.rateMin + b.rateMax) / 2 * 10) / 10;
    const pay = (r) => {
      const i = r / 100 / 12, n = loanYearsCalc * 12, P = loanAmountCalc * 1e4;
      return n > 0 ? i > 0 ? P * i / (1 - Math.pow(1 + i, -n)) : P / n : 0;
    };
    const applied = loanRateCalc === mid;
    return /* @__PURE__ */ React.createElement(Card, { key: b.bank, className: "!p-4 h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, b.bank, " ", /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#8A8A8A]" }, b.product)), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A] mt-0.5" }, b.rateType)), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[15px] font-bold" }, b.rateMin.toFixed(2), "~", b.rateMax.toFixed(2), "%"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A] mt-0.5", style: { fontVariantNumeric: "tabular-nums" } }, "\uC6D4 ", won(Math.round(pay(b.rateMin))), " ~ ", won(Math.round(pay(b.rateMax)))))), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#525252] mt-1.5 leading-relaxed" }, b.feature), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mt-auto pt-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setHh({ loanRateCalc: mid }), className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${applied ? "bg-[#F0F0F0] text-[#8A8A8A]" : "bg-[#0A0A0A] text-white"}` }, applied ? "\uC801\uC6A9\uB428" : `\uD3C9\uADE0 ${mid}% \uACC4\uC0B0\uAE30\uC5D0 \uC801\uC6A9`), /* @__PURE__ */ React.createElement("a", { href: b.link, target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "\uC0C1\uD488 \uC548\uB0B4")));
  })), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "\uC6D4 \uC0C1\uD658\uC561\uC740 \uC774\uC790 \uACC4\uC0B0\uAE30 \uC870\uAC74(\uB300\uCD9C ", manWon(loanAmountCalc), " \xB7 ", loanYearsCalc, '\uB144 \xB7 \uC6D0\uB9AC\uAE08\uADE0\uB4F1) \uAE30\uC900\uC774\uC5D0\uC694. "\uC801\uC6A9"\uC744 \uB204\uB974\uBA74 \uD574\uB2F9 \uC740\uD589 \uD3C9\uADE0 \uAE08\uB9AC\uB85C \uACC4\uC0B0\uAE30\uAC00 \uBC14\uB01D\uB2C8\uB2E4. "\uCD5C\uC2E0 \uC815\uBCF4\uB85C \uAC31\uC2E0"\uC740 \uAE08\uAC10\uC6D0 \uACF5\uC2DC(\uB610\uB294 \uC6F9 \uB9AC\uC11C\uCE58) \uAE30\uC900 \u2014 \uC2E4\uC81C \uAE08\uB9AC\uB294 \uC6B0\uB300\uC870\uAC74\xB7\uC2DC\uC810\uC5D0 \uB530\uB77C \uB2EC\uB77C\uC694. LTV\uB294 \uC804 \uC740\uD589 \uACF5\uD1B5(\uADDC\uC81C\uC9C0\uC5ED 40%, \uC0DD\uC560\uCD5C\uCD08 70%) + \uAC00\uACA9\uAD6C\uAC04 \uD558\uB4DC\uCEA1.'))), tab === "news" && /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-8 lg:space-y-0" }, /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uBD80\uB3D9\uC0B0 \uADDC\uC81C \uB300\uCD9C", eyebrow: "\uC2E4\uC2DC\uAC04 \uD56B\uC774\uC288", title: "\uBD80\uB3D9\uC0B0 \uB274\uC2A4" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-4" }, ["\uACFC\uCC9C", "\uC11C\uC6B8", "\uACBD\uAE30", "\uC131\uB0A8", "\uC548\uC591", "\uC218\uC6D0", "\uC804\uAD6D"].map((r) => /* @__PURE__ */ React.createElement("button", { key: r, onClick: () => setNewsRegion(r), className: `h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${newsRegion === r ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}` }, r))), /* @__PURE__ */ React.createElement(NewsPanel, { query: `${newsRegion === "\uC804\uAD6D" ? "" : newsRegion + " "}\uCCAD\uC57D \uBD84\uC591`, eyebrow: "\uC9C0\uC5ED\uBCC4 \uCCAD\uC57D \uC18C\uC2DD", title: `${newsRegion} \uCCAD\uC57D \uB274\uC2A4` }))), tab === "cheongyak" && /* @__PURE__ */ React.createElement(CheongyakTab, { mapKey }), tab === "realty" && /* @__PURE__ */ React.createElement(RealtyListTab, { mapKey }), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "realty", accent: "#0A0A0A" })));
}
const SAVING_TABS = [
  { id: "tracker", label: "\uB0A9\uC785 \uD2B8\uB798\uCEE4", icon: "piggy" },
  { id: "sim", label: "\uC800\uCD95 \uC2DC\uBBAC\uB808\uC774\uD130", icon: "calc" },
  { id: "guide", label: "\uC808\uC138 \uAC00\uC774\uB4DC", icon: "check2" },
  { id: "policy", label: "\uC815\uCC45\xB7\uD61C\uD0DD", icon: "search" }
];
function SavingTheme({ hh }) {
  const [tab, setTab] = usePersist("saving-tab-v1", "tracker");
  const [accounts, setAccounts] = usePersist("saving-accounts-v1", ACCOUNTS_DEFAULT);
  const [gift, setGift] = usePersist("saving-gift-v1", { giftAmount: 2e4, spouseGiftUsed: 0 });
  const [sim, setSim] = usePersist("saving-sim-v1", { monthly: 250, ratePct: 4, years: 10 });
  const [policyData, setPolicyData] = usePersist("policy-data-v1", { items: POLICY_BENEFITS, at: null });
  const patch = (id, k, v) => setAccounts(accounts.map((a) => a.id === id ? { ...a, [k]: v } : a));
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalPaid = accounts.reduce((s, a) => s + (a.paid || 0), 0);
  const totalGoal = accounts.reduce((s, a) => s + (a.goal || 0), 0);
  const pensionPaid = accounts.filter((a) => a.type === "\uC5F0\uAE08\uC800\uCD95" || a.type === "IRP").reduce((s, a) => s + (a.paid || 0), 0);
  const highPay = hh.income1 > 5500 && hh.income2 > 5500;
  const refundEst = Math.min(pensionPaid, 1800) * (highPay ? 0.132 : 0.165);
  const groups = ACCOUNT_TYPES.map((t) => ({ type: t, list: accounts.filter((a) => a.type === t) })).filter((g) => g.list.length > 0);
  const addAccount = (type) => setAccounts([...accounts, { id: uid(), owner: hh.label1 || "\uBCF8\uC778", type, balance: 0, paid: 0, goal: 0 }]);
  const years = Math.min(40, Math.max(1, Number(sim.years) || 1));
  const mRate = (Number(sim.ratePct) || 0) / 100 / 12;
  const yearly = [];
  {
    let bal = 0;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = (bal + (Number(sim.monthly) || 0)) * (1 + mRate);
      yearly.push({ y, bal: Math.round(bal), principal: (Number(sim.monthly) || 0) * 12 * y });
    }
  }
  const maxBal = yearly.length ? yearly[yearly.length - 1].bal : 1;
  const spouseExemption = Math.max(0, 6e4 - gift.spouseGiftUsed);
  const giftTaxableBase = Math.max(0, gift.giftAmount * 1e4 - spouseExemption * 1e4);
  const giftTaxOwed = giftTax(giftTaxableBase);
  const incomeTotal = hh.income1 + hh.income2;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PillNav, { tabs: SAVING_TABS, tab, setTab }), tab === "tracker" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uD55C\uB208\uC5D0", title: "\uC808\uC138\uACC4\uC88C \uD604\uD669" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 divide-x divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mb-1" }, "\uCD1D \uC794\uC561"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalBalance))), /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mb-1" }, "\uC62C\uD574 \uB0A9\uC785"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalPaid))), /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mb-1" }, "\uC5F0 \uB0A9\uC785 \uBAA9\uD45C"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalGoal)))), /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[13px] text-[#525252] mb-1.5" }, /* @__PURE__ */ React.createElement("span", null, "\uBAA9\uD45C \uB2EC\uC131\uB960"), /* @__PURE__ */ React.createElement("span", { className: "font-bold", style: { fontVariantNumeric: "tabular-nums" } }, totalGoal > 0 ? Math.round(totalPaid / totalGoal * 100) : 0, "%")), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: totalGoal > 0 ? totalPaid / totalGoal : 0 }), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[13px] text-[#8A8A8A]" }, "\uC5F0\uAE08\uC800\uCD95+IRP \uB0A9\uC785 \uAE30\uC900 \uC608\uC0C1 \uC138\uC561\uACF5\uC81C \uD658\uAE09 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(Math.round(refundEst))), " ", /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px]" }, "(", highPay ? "13.2%" : "16.5%", " \xB7 \uBD80\uBD80 \uC18C\uB4DD \uC5F0\uB3D9)"))))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, groups.map((g) => {
    const gb = g.list.reduce((s, a) => s + (a.balance || 0), 0);
    const gp = g.list.reduce((s, a) => s + (a.paid || 0), 0);
    const gg = g.list.reduce((s, a) => s + (a.goal || 0), 0);
    return /* @__PURE__ */ React.createElement("section", { key: g.type }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: `${g.list.length}\uAC1C \uACC4\uC88C`, title: g.type }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 pb-3 border-b border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#8A8A8A]" }, "\uC794\uC561 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(gb)), " \xB7 \uB0A9\uC785 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(gp)), "/", manWon(gg)), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold" }, gg > 0 ? Math.round(gp / gg * 100) : 0, "%")), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, g.list.map((a) => /* @__PURE__ */ React.createElement("div", { key: a.id, className: "rounded-xl bg-[#FAFAFA] p-3.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: a.owner, onChange: (v) => patch(a.id, "owner", v), placeholder: "\uBA85\uC758", className: "!w-24 !bg-white" }), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uACC4\uC88C \uC0AD\uC81C", onClick: () => setAccounts(accounts.filter((x) => x.id !== a.id)) })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2.5 mb-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#8A8A8A] block mb-1" }, "\uC794\uC561(\uB9CC\uC6D0)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.balance, onChange: (v) => patch(a.id, "balance", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#8A8A8A] block mb-1" }, "\uC62C\uD574 \uB0A9\uC785"), /* @__PURE__ */ React.createElement(NumInput, { value: a.paid, onChange: (v) => patch(a.id, "paid", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#8A8A8A] block mb-1" }, "\uC5F0 \uBAA9\uD45C"), /* @__PURE__ */ React.createElement(NumInput, { value: a.goal, onChange: (v) => patch(a.id, "goal", v), className: "!bg-white" }))), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: a.goal > 0 ? a.paid / a.goal : 0, height: 4 })))), /* @__PURE__ */ React.createElement("button", { onClick: () => addAccount(g.type), className: "mt-3 w-full h-10 rounded-xl border border-dashed border-[#C9C9C9] text-[13px] font-semibold text-[#525252] flex items-center justify-center gap-1.5 hover:bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " ", g.type, " \uACC4\uC88C \uCD94\uAC00")));
  }), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC0C8 \uC720\uD615", title: "\uB2E4\uB978 \uACC4\uC88C \uCD94\uAC00" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, ACCOUNT_TYPES.map((t) => /* @__PURE__ */ React.createElement("button", { key: t, onClick: () => addAccount(t), className: "h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold hover:bg-[#ECECEC] flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 12 }), t))))))), tab === "sim" && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "Compound", title: "\uC6D4 \uC800\uCD95 \u2192 \uC5F0\uB3C4\uBCC4 \uC790\uC0B0" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-3 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "\uC6D4 \uB0A9\uC785(\uB9CC\uC6D0)", value: sim.monthly, onChange: (v) => setSim({ ...sim, monthly: v }), step: 10 }), /* @__PURE__ */ React.createElement(Field, { label: "\uC5F0 \uC218\uC775\uB960(%)", value: sim.ratePct, onChange: (v) => setSim({ ...sim, ratePct: v }), step: 0.5 }), /* @__PURE__ */ React.createElement(Field, { label: "\uAE30\uAC04(\uB144)", value: sim.years, onChange: (v) => setSim({ ...sim, years: v }) })), /* @__PURE__ */ React.createElement("button", { onClick: () => setSim({ ...sim, monthly: hh.monthlySave }), className: "text-[13px] font-semibold text-[#525252] underline underline-offset-4" }, "\uBD80\uB3D9\uC0B0 \uC9C4\uB2E8\uC758 \uC6D4 \uC800\uCD95\uC561(", hh.monthlySave, "\uB9CC\uC6D0) \uBD88\uB7EC\uC624\uAE30"), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[13px] text-[#8A8A8A] leading-relaxed" }, "\uC6D4\uBCF5\uB9AC \uC801\uB9BD\uC2DD \uAC00\uC815. ISA\xB7\uC5F0\uAE08\uACC4\uC88C\uC5D0 \uB123\uC73C\uBA74 \uC5EC\uAE30\uC11C \uACC4\uC0B0\uB41C \uC218\uC775\uC5D0 \uB300\uD55C \uC138\uAE08\uC744 \uC544\uB07C\uB294 \uAD6C\uC870\uC608\uC694."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "Projection", title: /* @__PURE__ */ React.createElement(React.Fragment, null, years, "\uB144 \uD6C4 ", manWon(yearly[years - 1].bal)) }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, yearly.map((r) => /* @__PURE__ */ React.createElement("div", { key: r.y, className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#8A8A8A] w-8 shrink-0 text-right" }, r.y, "\uB144"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-4 rounded-full bg-[#F0F0F0] overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#0A0A0A] relative", style: { width: `${Math.max(2, Math.round(r.bal / maxBal * 100))}%` } }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 bg-[#8A8A8A] rounded-full", style: { width: `${Math.round(r.principal / r.bal * 100)}%` } }))), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold w-24 shrink-0 text-right", style: { fontVariantNumeric: "tabular-nums" } }, manWon(r.bal))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-4 mt-4 pt-3 border-t border-[#F0F0F0] text-[12px] text-[#8A8A8A]" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#8A8A8A] inline-block" }), "\uC6D0\uAE08"), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0A] inline-block" }), "\uC6D0\uAE08+\uC218\uC775"), /* @__PURE__ */ React.createElement("span", { className: "ml-auto" }, "\uB204\uC801 \uC218\uC775 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(yearly[years - 1].bal - yearly[years - 1].principal))))))), tab === "guide" && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uACB0\uB860\uBD80\uD130", title: "\uD569\uCE60\uAE4C, \uB098\uB20C\uAE4C" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[15px] text-[#3D3D3D] leading-relaxed" }, "\uACC4\uC88C\uB97C \uBB3C\uB9AC\uC801\uC73C\uB85C \uD569\uCE60 \uD544\uC694\uB294 \uC5C6\uC5B4\uC694. ", /* @__PURE__ */ React.createElement("b", null, "\uAC01\uC790 \uBA85\uC758 \uC808\uC138\uACC4\uC88C(ISA\xB7\uC5F0\uAE08\uC800\uCD95\xB7IRP)\uB294 \uAC01\uC790 \uC720\uC9C0"), "\uD558\uACE0, ", /* @__PURE__ */ React.createElement("b", null, "\uACF5\uB3D9 \uBAA9\uD45C\uC790\uAE08\uB9CC \uBCC4\uB3C4 \uD1B5\uC7A5"), "\uC73C\uB85C \uBD84\uB9AC\uD558\uC138\uC694."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC808\uC138\uACC4\uC88C 3\uC885", title: "ISA \xB7 \uC5F0\uAE08\uC800\uCD95 \xB7 IRP" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-3" }, "\u2460 ISA \u2014 \uAC01\uC790 1\uAC1C\uC529"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 text-[15px] text-[#3D3D3D]" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uC5F0 4,000\uB9CC\uC6D0 \uD55C\uB3C4, \uCD1D 2\uC5B5\uC6D0 (\uBBF8\uB0A9\uC785\uBD84 \uC774\uC6D4)")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uBE44\uACFC\uC138 500\uB9CC\uC6D0, \uCD08\uACFC\uBD84 9.9% \uBD84\uB9AC\uACFC\uC138")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uC758\uBB34\uC720\uC9C0 3\uB144 \u2014 \uC6D0\uAE08\uC740 \uC5B8\uC81C\uB4E0 \uC778\uCD9C \uAC00\uB2A5")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uACFC\uCC9C \uBAA9\uC801\uC790\uAE08(\uCCAD\uC57D\xB7\uB9E4\uB9E4\uC6A9)\uC5D0 \uAC00\uC7A5 \uC801\uD569")))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-3" }, "\u2461 \uC5F0\uAE08\uC800\uCD95 + IRP \u2014 \uAC01\uC790 900\uB9CC\uC6D0"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 text-[15px] text-[#3D3D3D]" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uC5F0\uAE08\uC800\uCD95 600\uB9CC(\uC6D450\uB9CC) + IRP 300\uB9CC(\uC6D425\uB9CC)")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uCD1D\uAE09\uC5EC 5,500\uB9CC \uCD08\uACFC \uC2DC \uACF5\uC81C\uC728 13.2% \u2014 1\uC778 \uC57D 118.8\uB9CC \uD658\uAE09")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, "\uB9CC 55\uC138\uAE4C\uC9C0 \uBB36\uC784 \u2014 \uBAA9\uC801\uC790\uAE08\uACFC \uBCC4\uAC1C \uC811\uADFC")))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC138\uAE08 \uD3ED\uD0C4 \uC608\uBC29", title: "\uBC30\uC6B0\uC790\uAC04 \uC790\uAE08 \uC774\uB3D9 \uACC4\uC0B0\uAE30" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-4" }, "\uBC30\uC6B0\uC790 \uC99D\uC5EC\uC7AC\uC0B0\uACF5\uC81C\uB294 10\uB144\uAC04 6\uC5B5\uC6D0. \uB118\uB294 \uB9CC\uD07C\uB9CC \uC99D\uC5EC\uC138\uAC00 \uBD99\uC5B4\uC694."), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "\uC774\uCCB4 \uAC80\uD1A0 \uAE08\uC561(\uB9CC\uC6D0)", value: gift.giftAmount, onChange: (v) => setGift({ ...gift, giftAmount: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "\uCD5C\uADFC 10\uB144 \uAE30\uC0AC\uC6A9 \uACF5\uC81C(\uB9CC\uC6D0)", value: gift.spouseGiftUsed, onChange: (v) => setGift({ ...gift, spouseGiftUsed: v }) })), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement(Stat, { label: "\uC794\uC5EC \uBC30\uC6B0\uC790 \uC99D\uC5EC\uACF5\uC81C(10\uB144)", value: won(spouseExemption * 1e4) }), /* @__PURE__ */ React.createElement(Stat, { label: "\uACF5\uC81C \uCD08\uACFC \uACFC\uC138\uB300\uC0C1 \uAE08\uC561", value: won(giftTaxableBase) }), /* @__PURE__ */ React.createElement(Stat, { label: "\uC608\uC0C1 \uC99D\uC5EC\uC138", value: giftTaxOwed > 0 ? won(giftTaxOwed) : "0\uC6D0 \xB7 \uBE44\uACFC\uC138 \uBC94\uC704", tone: giftTaxOwed > 0 ? "warn" : "good" })))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC2E4\uC804 \uC218\uCE59", title: "\uC138\uAE08 \uD3ED\uD0C4 \uC608\uBC29" }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-3 text-[15px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("p", null, "\u2022 ", /* @__PURE__ */ React.createElement("b", null, "\uBD80\uBAA8\uB2D8 \uC99D\uC5EC:"), " \uD63C\uC778\uC2E0\uACE0 \uC804\uD6C4 2\uB144 \uC774\uB0B4, \uC591\uAC00 \uD569\uC0B0 \uCD5C\uB300 3\uC5B5\uC6D0\uAE4C\uC9C0 \uBE44\uACFC\uC138"), /* @__PURE__ */ React.createElement("p", null, "\u2022 ", /* @__PURE__ */ React.createElement("b", null, "\uBD80\uBAA8\uB2D8 \uBB34\uC774\uC790 \uCC28\uC785:"), " \uC57D 2\uC5B5\uC6D0\uAE4C\uC9C0 \uC99D\uC5EC\uC138 \uC5C6\uC74C \u2014 \uCC28\uC6A9\uC99D+\uC0C1\uD658\uAE30\uB85D \uD544\uC218"), /* @__PURE__ */ React.createElement("p", null, "\u2022 ", /* @__PURE__ */ React.createElement("b", null, "\uACF5\uB3D9\uBA85\uC758 \uB9E4\uB9E4:"), " \uC9C0\uBD84\uC728 = \uC2E4\uC81C \uC790\uAE08 \uBD80\uB2F4 \uBE44\uC728"), /* @__PURE__ */ React.createElement("p", null, "\u2022 ", /* @__PURE__ */ React.createElement("b", null, "\uC790\uAE08\uC870\uB2EC\uACC4\uD68D\uC11C:"), " \uD22C\uAE30\uACFC\uC5F4\uC9C0\uAD6C\uB294 \uAE08\uC561 \uBB34\uAD00 \uC804\uC6D0 \uC81C\uCD9C"))))), tab === "policy" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC6B0\uB9AC \uAE30\uC900 \uC790\uB3D9 \uD310\uC815", title: "\uC2E0\uD63C\uBD80\uBD80 \uC815\uCC45\xB7\uD61C\uD0DD \uCCB4\uD06C" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(LiveUpdateBtn, { topic: "policies", params: `&income=${incomeTotal}`, onData: (j) => setPolicyData({ items: j.items, at: j.fetchedAt }) }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "\uBD80\uBD80\uD569\uC0B0 \uC5F0\uC18C\uB4DD ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(incomeTotal)), "(\uD648\uC758 \uBD80\uBD80 \uC815\uBCF4\uC640 \uC5F0\uB3D9) \uAE30\uC900\uC73C\uB85C \uC2E4\uC81C\uB85C \uBC1B\uC744 \uC218 \uC788\uB294 \uAC83\uACFC \uB9C9\uD788\uB294 \uAC83\uC744 \uAD6C\uBD84\uD588\uC5B4\uC694. ", policyData.at ? `${policyData.at.slice(0, 10)} \uC2E4\uC2DC\uAC04 \uB9AC\uC11C\uCE58 \uAE30\uC900` : "\uAE30\uBCF8 \uB370\uC774\uD130\uB294 2026\uB144 7\uC6D4 \uB9AC\uC11C\uCE58 \uAE30\uC900", ' \u2014 "\uCD5C\uC2E0 \uC815\uBCF4\uB85C \uAC31\uC2E0"\uC744 \uB204\uB974\uBA74 \uC9C0\uAE08 \uC2DC\uC810 \uC815\uCC45\uC744 \uC6F9\uC5D0\uC11C \uB2E4\uC2DC \uC870\uC0AC\uD574\uC694.'))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, policyData.items.map((p, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold" }, p.name), /* @__PURE__ */ React.createElement(ToneBadge, { tone: p.fit }, p.fitText)), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mb-1.5" }, p.target), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-2" }, p.benefit), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3 bg-[#FAFAFA] rounded-lg px-3 py-2" }, p.why), /* @__PURE__ */ React.createElement("a", { href: p.link, target: "_blank", rel: "noopener noreferrer", className: "mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" }, "\uACF5\uC2DD \uC548\uB0B4 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 })))))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uC2E0\uD63C\uBD80\uBD80 \uC815\uCC45 \uD61C\uD0DD", eyebrow: "\uB193\uCE58\uB294 \uC815\uCC45 \uC5C6\uAC8C", title: "\uC815\uCC45 \uB274\uC2A4 \uC0C8\uB85C\uACE0\uCE68" })), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "saving" })));
}
const WEDDING_TABS = [
  { id: "overview", label: "\uAC1C\uC694\xB7\uC608\uC0B0", icon: "heart" },
  { id: "checklist", label: "\uCCB4\uD06C\uB9AC\uC2A4\uD2B8", icon: "check2" },
  { id: "venue", label: "\uC778\uAE30 \uC2DD\uC7A5", icon: "building" },
  { id: "expo", label: "\uBC15\uB78C\uD68C", icon: "calendar" },
  { id: "honeymoon", label: "\uC2E0\uD63C\uC5EC\uD589", icon: "plane" }
];
const naverSearch = (q) => `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
const naverBlog = (q) => `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(q)}`;
function HeartField() {
  const parts = useMemo(() => Array.from({ length: 14 }, () => ({
    left: (Math.random() * 96 + 2).toFixed(1),
    s: (0.5 + Math.random() * 1.1).toFixed(2),
    o: (0.08 + Math.random() * 0.22).toFixed(2),
    d: (7 + Math.random() * 9).toFixed(1) + "s",
    dl: (-Math.random() * 14).toFixed(1) + "s"
  })), []);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, parts.map((p, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: "heart-p text-white", style: { left: `${p.left}%`, "--s": p.s, "--o": p.o, "--d": p.d, "--dl": p.dl } }, /* @__PURE__ */ React.createElement(Icon, { name: "heart", size: 20, fill: "currentColor" }))));
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
      s: 12 + Math.round(Math.random() * 16)
    }));
    setBursts((b) => [...b, ...parts]);
    setTimeout(() => setBursts((b) => b.filter((p) => !parts.some((q) => q.id === p.id))), 1e3);
  };
  const [info, setInfo] = usePersist("wedding-info-v1", { date: "", venue: "" });
  const [budget, setBudget] = usePersist("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const [checklist, setChecklist] = usePersist(
    "wedding-checklist-v2",
    WEDDING_CHECKLIST_DEFAULT.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ id: uid(), text: t, done: false })) }))
  );
  const [honeymoon, setHoneymoon] = usePersist("wedding-honeymoon-v4", HONEYMOON_DEFAULT);
  const [newItem, setNewItem] = useState({ name: "", budget: 0 });
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const [newPlace, setNewPlace] = useState({ place: "", cost: 0, season: "", note: "", route: "" });
  const [venueFilter, setVenueFilter] = useState("all");
  const d = dday(info.date);
  const totalBudget = budget.reduce((s, b) => s + (b.budget || 0), 0);
  const totalSpent = budget.reduce((s, b) => s + (b.spent || 0), 0);
  const alloc = store.get("home-alloc-v1", ALLOC_DEFAULT);
  const patchBudget = (id, k, v) => setBudget(budget.map((b) => b.id === id ? { ...b, [k]: v } : b));
  const toggleTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map((it) => it.id === id ? { ...it, done: !it.done } : it) }));
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((it) => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0);
  const patchHm = (id, k, v) => setHoneymoon(honeymoon.map((h) => h.id === id ? { ...h, [k]: v } : h));
  const starHm = (id) => setHoneymoon(honeymoon.map((h) => ({ ...h, star: h.id === id ? !h.star : false })));
  const [venueList, setVenueList] = usePersist("wedding-venues-v2", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v })));
  const [venueMeta, setVenueMeta] = usePersist("wedding-venues-meta-v1", { at: null });
  const [newVenue, setNewVenue] = useState({ name: "", area: "", type: "\uD638\uD154", meal: "", fee: "", cap: "", note: "" });
  const patchVenue = (id, k, val) => setVenueList(venueList.map((x) => x.id === id ? { ...x, [k]: val } : x));
  const venueTypes = ["all", ...Array.from(new Set(venueList.map((v) => v.type)))];
  const venues = venueList.filter((v) => venueFilter === "all" || v.type === venueFilter);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PillNav, { tabs: WEDDING_TABS, tab, setTab }), tab === "overview" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { onClick: burst, className: "relative overflow-hidden rounded-3xl bg-[#0A0A0A] text-white px-6 py-12 text-center cursor-pointer select-none", title: "\uD074\uB9AD\uD574 \uBCF4\uC138\uC694 \u{1F90D}" }, /* @__PURE__ */ React.createElement(HeartField, null), bursts.map((p) => /* @__PURE__ */ React.createElement("span", { key: p.id, className: "heart-b text-white/80", style: { "--x": p.x, "--y": p.y } }, /* @__PURE__ */ React.createElement(Icon, { name: "heart", size: p.s, fill: "currentColor" }))), /* @__PURE__ */ React.createElement("div", { className: "relative font-mono text-[11px] font-medium tracking-[0.26em] uppercase text-white/45 mb-3" }, "Our Wedding Day"), /* @__PURE__ */ React.createElement("div", { className: "relative font-mono text-[56px] sm:text-[72px] leading-none font-semibold tracking-tight" }, d === null ? "D - ?" : ddayText(d)), /* @__PURE__ */ React.createElement("div", { className: "relative mt-4 text-[14px] text-white/60" }, info.date ? `${info.date}${info.venue ? " \xB7 " + info.venue : ""}` : "\uC544\uB798\uC5D0\uC11C \uC608\uC2DD\uC77C\uC744 \uC124\uC815\uD574 \uC8FC\uC138\uC694")), /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, "\uC608\uC2DD\uC77C"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: info.date,
      onChange: (e) => setInfo({ ...info, date: e.target.value }),
      className: "w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, "\uC608\uC2DD\uC7A5 (\uBBF8\uC815\uC774\uBA74 \uBE44\uC6CC\uB450\uAE30)"), /* @__PURE__ */ React.createElement(TextInput, { value: info.venue, onChange: (v) => setInfo({ ...info, venue: v }), placeholder: "\uC608: OO\uC6E8\uB529\uD640", className: "!h-12" }))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uBE44\uC6A9 \uAD00\uB9AC", title: "\uC608\uC2DD \uBE44\uC6A9 \uC608\uC0B0\uD45C" }), /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#525252]" }, "\uC9C0\uCD9C ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(totalSpent)), " / \uC608\uC0B0 ", /* @__PURE__ */ React.createElement("b", null, manWon(totalBudget))), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold" }, totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0, "%")), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: totalBudget > 0 ? totalSpent / totalBudget : 0 }), alloc.wedding > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[13px] text-[#8A8A8A]" }, "\uD648\uC5D0\uC11C \uBC30\uC815\uD55C \uACB0\uD63C \uC790\uAE08 ", /* @__PURE__ */ React.createElement("b", null, manWon(alloc.wedding)), " \uB300\uBE44 \uC608\uC0B0 ", Math.round(totalBudget / alloc.wedding * 100), "% ", totalBudget > alloc.wedding && /* @__PURE__ */ React.createElement("span", { className: "text-[#0A0A0A] font-bold underline underline-offset-2" }, "\u2014 \uBC30\uC815\uC561 \uCD08\uACFC!"))), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3 items-stretch" }, budget.map((b) => /* @__PURE__ */ React.createElement(Card, { key: b.id, className: "!p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: b.name, onChange: (v) => patchBudget(b.id, "name", v), className: "flex-1 font-semibold" }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uD56D\uBAA9 \uC0AD\uC81C", onClick: () => setBudget(budget.filter((x) => x.id !== b.id)) })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3 mt-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#8A8A8A] block mb-1" }, "\uC608\uC0B0(\uB9CC\uC6D0)"), /* @__PURE__ */ React.createElement(NumInput, { value: b.budget, onChange: (v) => patchBudget(b.id, "budget", v) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#8A8A8A] block mb-1" }, "\uC2E4\uC81C \uC9C0\uCD9C(\uB9CC\uC6D0)"), /* @__PURE__ */ React.createElement(NumInput, { value: b.spent, onChange: (v) => patchBudget(b.id, "spent", v) }))), /* @__PURE__ */ React.createElement("div", { className: "mt-2.5" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: b.budget > 0 ? b.spent / b.budget : 0, height: 4 })))), /* @__PURE__ */ React.createElement(Card, { className: "!p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-2.5" }, "\uD56D\uBAA9 \uCD94\uAC00"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newItem.name, onChange: (v) => setNewItem({ ...newItem, name: v }), placeholder: "\uD56D\uBAA9\uBA85 (\uC608: \uC6E8\uB529\uCE74)", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement(NumInput, { value: newItem.budget, onChange: (v) => setNewItem({ ...newItem, budget: v }), className: "!w-24" }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        if (!newItem.name.trim()) return;
        setBudget([...budget, { id: uid(), name: newItem.name.trim(), budget: newItem.budget, spent: 0 }]);
        setNewItem({ name: "", budget: 0 });
      },
      className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0"
    },
    "\uCD94\uAC00"
  )))))), tab === "checklist" && (() => {
    const phaseIdx = d === null ? null : Math.min(checklist.length - 1, d < 0 ? 5 : d <= 30 ? 4 : d <= 90 ? 3 : d <= 180 ? 2 : d <= 270 ? 1 : 0);
    const curGroup = phaseIdx !== null ? checklist[phaseIdx] : null;
    const curLeft = curGroup ? curGroup.items.filter((it) => !it.done).length : 0;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "2026 \uC2E4\uC804 \uD6C4\uAE30 \uAE30\uBC18", title: "\uC6E8\uB529 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8" }), curGroup ? /* @__PURE__ */ React.createElement(Card, { className: "mb-4 !border-[#0A0A0A] border" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-bold text-white bg-[#0A0A0A] px-2.5 py-1 rounded-full" }, ddayText(d)), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold" }, '\uC9C0\uAE08\uC740 "', curGroup.cat, '" \uB2E8\uACC4')), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[13px] text-[#525252]" }, curLeft > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, "\uC774 \uB2E8\uACC4\uC5D0\uC11C \uB0A8\uC740 \uD560 \uC77C ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, curLeft, "\uAC1C"), " \u2014 \uC544\uB798 \uAC80\uC815 \uD14C\uB450\uB9AC \uCE74\uB4DC\uBD80\uD130 \uCC98\uB9AC\uD558\uC138\uC694.") : "\uC774 \uB2E8\uACC4 \uD560 \uC77C\uC744 \uBAA8\uB450 \uB05D\uB0C8\uC5B4\uC694! \uB2E4\uC74C \uB2E8\uACC4\uB97C \uBBF8\uB9AC \uBCF4\uC138\uC694.")) : /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#8A8A8A]" }, "\uAC1C\uC694\xB7\uC608\uC0B0 \uD0ED\uC5D0\uC11C \uC608\uC2DD\uC77C\uC744 \uC124\uC815\uD558\uBA74 \uC9C0\uAE08 \uD574\uC57C \uD560 \uB2E8\uACC4\uB97C \uC790\uB3D9\uC73C\uB85C \uC9DA\uC5B4\uC918\uC694.")), /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "\uC804\uCCB4 \uC9C4\uD589\uB960"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 flex-1 max-w-[220px] ml-4" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: taskTotal > 0 ? taskDone / taskTotal : 0 }), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold shrink-0" }, taskDone, "/", taskTotal))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-2.5" }, "\uD560 \uC77C \uCD94\uAC00"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
      "select",
      {
        value: newTask.gi,
        onChange: (e) => setNewTask({ ...newTask, gi: e.target.value }),
        className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
      },
      checklist.map((g, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, g.cat))
    ), /* @__PURE__ */ React.createElement(TextInput, { value: newTask.text, onChange: (v) => setNewTask({ ...newTask, text: v }), placeholder: "\uC608: \uC6E8\uB529\uCE74 \uC608\uC57D", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement("button", { onClick: addTask, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "\uCD94\uAC00")))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, checklist.map((g, gi) => {
      const state = phaseIdx === null ? "none" : gi === phaseIdx ? "now" : gi < phaseIdx ? "past" : "next";
      const gLeft = g.items.filter((it) => !it.done).length;
      return /* @__PURE__ */ React.createElement("section", { key: gi }, /* @__PURE__ */ React.createElement(Card, { className: state === "now" ? "!border-[#0A0A0A] border-2" : state === "past" ? "opacity-60" : "" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("h4", { className: "font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full" }, g.cat), state === "now" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "\uC9C0\uAE08 \uD560 \uC77C"), state === "past" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#8A8A8A]" }, gLeft > 0 ? `\uC9C0\uB09C \uB2E8\uACC4 \xB7 \uBBF8\uC644\uB8CC ${gLeft}` : "\uC9C0\uB09C \uB2E8\uACC4 \xB7 \uC644\uB8CC"), state === "next" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#B0B0B0]" }, "\uB2E4\uC74C \uB2E8\uACC4")), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`\uACB0\uD63C\uC900\uBE44 ${g.cat.replace("D-", "")} \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uD6C4\uAE30`), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#8A8A8A] underline underline-offset-4 hover:text-[#0A0A0A]" }, "\uC2E4\uC81C \uD6C4\uAE30 \uAC80\uC0C9")), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-2 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleTask(gi, it.id), className: "flex items-start gap-3 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[14px] leading-relaxed ${it.done ? "line-through text-[#B0B0B0]" : "text-[#24231E]"}` }, it.text)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => removeTask(gi, it.id), className: "!w-7 !h-7 opacity-0 group-hover:opacity-100" }))))));
    })), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uD6C4\uAE30\uC5D0\uC11C \uC790\uC8FC \uB098\uC624\uB294", title: "\uC2E4\uC804 \uAFC0\uD301 5" }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("ul", { className: "grid sm:grid-cols-2 gap-x-10 gap-y-3.5" }, WEDDING_TIPS.map((t, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex gap-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-bold shrink-0 mt-0.5" }, String(i + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, t)))))));
  })(), tab === "venue" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: venueMeta.at ? `\uC11C\uC6B8 \xB7 ${venueMeta.at.slice(0, 10)} \uC2E4\uC2DC\uAC04 \uB9AC\uC11C\uCE58` : "\uC11C\uC6B8 \xB7 2025~26 \uAE30\uC900", title: "\uC778\uAE30 \uC608\uC2DD\uC7A5 \uB9AC\uC2A4\uD2B8" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4 flex-wrap" }, venueTypes.map((t) => /* @__PURE__ */ React.createElement("button", { key: t, onClick: () => setVenueFilter(t), className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${venueFilter === t ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}` }, t === "all" ? "\uC804\uCCB4" : t)), /* @__PURE__ */ React.createElement(LiveUpdateBtn, { topic: "venues", onData: (j) => {
    setVenueList(j.items.map((v, i) => ({ id: "rv" + i, img: "", ...v })));
    setVenueMeta({ at: j.fetchedAt });
  } }))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, venues.map((v) => /* @__PURE__ */ React.createElement(Card, { key: v.id, className: "h-full flex flex-col" }, v.img && /* @__PURE__ */ React.createElement("img", { src: v.img, alt: v.name, onError: (e) => {
    e.target.style.display = "none";
  }, className: "w-full h-40 object-cover rounded-xl mb-3" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, v.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-0.5" }, v.area, " \xB7 \uC218\uC6A9 ", v.cap)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, v.type), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => setVenueList(venueList.filter((x) => x.id !== v.id)), className: "!w-7 !h-7" }))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 my-3" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A]" }, "1\uC778 \uC2DD\uB300"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, v.meal)), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A]" }, "\uB300\uAD00\uB8CC(\uCD94\uC815)"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, v.fee))), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3" }, v.note), /* @__PURE__ */ React.createElement("div", { className: "mt-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("a", { href: naverSearch(v.name + " \uC6E8\uB529"), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "\uB124\uC774\uBC84 \uAC80\uC0C9"), /* @__PURE__ */ React.createElement("a", { href: `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(v.name + " \uC6E8\uB529\uD640")}`, target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4" }, "\uC0AC\uC9C4 \uAC80\uC0C9"), /* @__PURE__ */ React.createElement("a", { href: naverBlog(v.name + " \uACB0\uD63C\uC2DD \uD6C4\uAE30"), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4" }, "\uD6C4\uAE30 \uBCF4\uAE30")), /* @__PURE__ */ React.createElement(TextInput, { value: v.img || "", onChange: (val) => patchVenue(v.id, "img", val), placeholder: "\uB300\uD45C \uC0AC\uC9C4 URL \uBD99\uC5EC\uB123\uAE30 (\uC120\uD0DD)", className: "!h-8 !text-[12px]" })))), /* @__PURE__ */ React.createElement(Card, { className: "h-full flex flex-col justify-center border-dashed" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-3" }, "\uC2DD\uC7A5 \uC9C1\uC811 \uCD94\uAC00 \u2014 \uD22C\uC5B4 \uB2E4\uB140\uC628 \uACF3, \uC0C8\uB85C \uB728\uB294 \uACF3\uC744 \uAE30\uB85D\uD574 \uB9AC\uC2A4\uD2B8\uB97C \uD56D\uC0C1 \uCD5C\uC2E0\uC73C\uB85C"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.name, onChange: (v) => setNewVenue({ ...newVenue, name: v }), placeholder: "\uC2DD\uC7A5\uBA85 *" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.area, onChange: (v) => setNewVenue({ ...newVenue, area: v }), placeholder: "\uC9C0\uC5ED (\uC608: \uAC15\uB0A8\uAD6C)" }), /* @__PURE__ */ React.createElement("select", { value: newVenue.type, onChange: (e) => setNewVenue({ ...newVenue, type: e.target.value }), className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" }, ["\uD638\uD154", "\uD558\uC6B0\uC2A4", "\uCC44\uD50C", "\uCEE8\uBCA4\uC158", "\uAE30\uD0C0"].map((t) => /* @__PURE__ */ React.createElement("option", { key: t }, t))), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.cap, onChange: (v) => setNewVenue({ ...newVenue, cap: v }), placeholder: "\uC218\uC6A9 \uC778\uC6D0" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.meal, onChange: (v) => setNewVenue({ ...newVenue, meal: v }), placeholder: "1\uC778 \uC2DD\uB300" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.fee, onChange: (v) => setNewVenue({ ...newVenue, fee: v }), placeholder: "\uB300\uAD00\uB8CC" })), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.note, onChange: (v) => setNewVenue({ ...newVenue, note: v }), placeholder: "\uBA54\uBAA8", className: "mb-2.5" }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        if (!newVenue.name.trim()) return;
        setVenueList([...venueList, { id: uid(), img: "", ...newVenue, name: newVenue.name.trim() }]);
        setNewVenue({ name: "", area: "", type: "\uD638\uD154", meal: "", fee: "", cap: "", note: "" });
      },
      className: "h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 15 }),
    " \uB9AC\uC2A4\uD2B8\uC5D0 \uCD94\uAC00"
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "\uAE30\uBCF8 10\uACF3\uC740 2025~26 \uD6C4\uAE30\xB7\uBCF4\uB3C4 \uAE30\uBC18 \uB9AC\uC11C\uCE58\uC608\uC694(\uAC00\uACA9\uC740 \uCD94\uC815\uCE58). \uCE74\uB4DC \uC0AD\uC81C\xB7\uCD94\uAC00\xB7\uC0AC\uC9C4 \uB4F1\uB85D\uC774 \uBAA8\uB450 \uC800\uC7A5\uB418\uACE0 \uBD80\uBD80\uAC00 \uD568\uAED8 \uBCF4\uB294 \uBAA9\uB85D\uC5D0 \uC2E4\uC2DC\uAC04 \uBC18\uC601\uB429\uB2C8\uB2E4. \uACAC\uC801\uC740 \uD22C\uC5B4\uC5D0\uC11C \uC9C1\uC811 \uD655\uC778\uD558\uC138\uC694."))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uC6E8\uB529\uD640 \uC608\uC2DD\uC7A5", eyebrow: "\uC5C5\uACC4 \uC18C\uC2DD\uC73C\uB85C \uCD5C\uC2E0\uD654", title: "\uC6E8\uB529\uD640 \uB274\uC2A4" })), tab === "expo" && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uB2E4\uAC00\uC624\uB294 \uC77C\uC815", title: "\uACB0\uD63C \uBC15\uB78C\uD68C" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, WEDDING_EXPOS.map((e, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "!p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold leading-snug" }, e.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A] mt-1" }, e.venue), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#525252] mt-0.5" }, e.note)), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[12px] font-semibold whitespace-nowrap" }, e.date), !e.exact && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#8A8A8A]" }, "(\uC608\uC0C1)"))), /* @__PURE__ */ React.createElement("a", { href: e.url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 mt-2.5 text-[13px] font-semibold underline underline-offset-4" }, "\uC77C\uC815 \uD655\uC778\xB7\uC0AC\uC804\uB4F1\uB85D ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 }))))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "2026\uB144 7\uC6D4 \uB9AC\uC11C\uCE58 \uAE30\uC900. \uBC15\uB78C\uD68C\uB294 1~2\uAC1C\uC6D4 \uC804\uC5D0 \uD68C\uCC28\uBCC4 \uC77C\uC815\uC774 \uACF5\uAC1C\uB418\uB2C8 \uB9C1\uD06C\uC5D0\uC11C \uCD5C\uC2E0 \uC77C\uC815\uC744 \uD655\uC778\uD558\uC138\uC694."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC815\uAE30 \uAC1C\uCD5C", title: "\uC0C1\uC2DC \uCCB4\uD06C\uD560 \uBC15\uB78C\uD68C" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F0F0F0]" }, EXPO_RECURRING.map((e, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "px-5 py-3.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, e.name), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A] mt-0.5" }, e.cycle, " \xB7 ", e.venue)), /* @__PURE__ */ React.createElement("a", { href: e.url, target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold underline underline-offset-4 shrink-0" }, "\uD648\uD398\uC774\uC9C0")))))))), tab === "honeymoon" && /* @__PURE__ */ React.createElement(React.Fragment, null, (() => {
    const first = honeymoon.find((h) => h.star);
    return first ? /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#0A0A0A] text-white px-6 py-5 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, /* @__PURE__ */ React.createElement(Icon, { name: "star", size: 20, fill: "currentColor", className: "shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-white/50" }, "1\uC21C\uC704 \uD5C8\uB2C8\uBB38"), /* @__PURE__ */ React.createElement("div", { className: "text-[22px] font-bold tracking-tight truncate" }, first.place))), /* @__PURE__ */ React.createElement("button", { onClick: () => starHm(first.id), className: "text-[12px] font-semibold text-white/50 hover:text-white shrink-0" }, "1\uC21C\uC704 \uD574\uC81C")), /* @__PURE__ */ React.createElement("div", { className: "p-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-1" }, "\uCD1D \uACBD\uBE44(2\uC778 \uCD94\uC815)"), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(first.cost))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-1" }, "\uD56D\uACF5\uAD8C(\uC655\uBCF5)"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, first.flight || "-")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-1" }, "\uCD94\uCC9C \uC77C\uC815"), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, first.days || "-")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-1" }, "\uCD94\uCC9C \uC2DC\uAE30"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, first.season || "-"))), first.route && /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-4 py-3.5 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5" }, "\uCD94\uCC9C \uACBD\uB85C"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed" }, first.route)), first.booking && /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#F0F0F0] px-4 py-3.5 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#8A8A8A] mb-1.5" }, "\uC608\uC57D \uD0C0\uC774\uBC0D \uD301"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed" }, first.booking)), /* @__PURE__ */ React.createElement("div", { className: "flex gap-4" }, /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${first.place} \uC2E0\uD63C\uC5EC\uD589 \uD6C4\uAE30 \uACBD\uBE44`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "\uC2E4\uC81C \uD6C4\uAE30\xB7\uACBD\uBE44 \uAC80\uC0C9"), /* @__PURE__ */ React.createElement("a", { href: naverSearch(`${first.place} \uD56D\uACF5\uAD8C \uCD5C\uC800\uAC00`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4" }, "\uD56D\uACF5\uAD8C \uAC80\uC0C9"), /* @__PURE__ */ React.createElement("a", { href: naverSearch(`${first.place} \uD5C8\uB2C8\uBB38 \uD328\uD0A4\uC9C0`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4" }, "\uD328\uD0A4\uC9C0 \uAC80\uC0C9"))))) : /* @__PURE__ */ React.createElement(Card, { className: "mb-6 text-center !py-5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#8A8A8A]" }, "\uBCC4\uD45C(\u2605)\uB97C \uB204\uB974\uBA74 \uADF8 \uC5EC\uD589\uC9C0\uAC00 1\uC21C\uC704\uB85C \uC62C\uB77C\uC624\uACE0 \uACBD\uB85C\xB7\uBE44\uC6A9\xB7\uC608\uC57D \uD301\uC774 \uD06C\uAC8C \uD45C\uC2DC\uB3FC\uC694."));
  })(), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, honeymoon.filter((h) => !h.star).map((h) => /* @__PURE__ */ React.createElement("section", { key: h.id }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("button", { onClick: () => starHm(h.id), title: "1\uC21C\uC704\uB85C \uC124\uC815", className: h.star ? "text-[#0A0A0A]" : "text-[#D4D4D4] hover:text-[#8A8A8A]" }, /* @__PURE__ */ React.createElement(Icon, { name: "star", size: 18, fill: h.star ? "currentColor" : "none" })), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold truncate" }, h.place)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight mr-1", style: { fontVariantNumeric: "tabular-nums" } }, manWon(h.cost)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => setHoneymoon(honeymoon.filter((x) => x.id !== h.id)) }))), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[13px] text-[#525252]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\uCD94\uCC9C \uC2DC\uAE30"), " ", h.season || "-"), h.note && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[13px] text-[#8A8A8A]" }, h.note), h.route && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] tracking-[0.14em] uppercase text-[#8A8A8A] mb-1.5" }, "\uCD94\uCC9C \uACBD\uB85C"), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#3D3D3D] leading-relaxed" }, h.route)), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${h.place} \uC2E0\uD63C\uC5EC\uD589 \uD6C4\uAE30 \uACBD\uBE44`), target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 mt-3 text-[13px] font-semibold underline underline-offset-4" }, "\uC2E4\uC81C \uD6C4\uAE30\xB7\uACBD\uBE44 \uAC80\uC0C9 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 }))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC9C1\uC811 \uCD94\uAC00", title: "\uD6C4\uBCF4 \uCD94\uAC00" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5 mb-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.place, onChange: (v) => setNewPlace({ ...newPlace, place: v }), placeholder: "\uC5EC\uD589\uC9C0" }), /* @__PURE__ */ React.createElement(NumInput, { value: newPlace.cost, onChange: (v) => setNewPlace({ ...newPlace, cost: v }) }), /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.season, onChange: (v) => setNewPlace({ ...newPlace, season: v }), placeholder: "\uCD94\uCC9C \uC2DC\uAE30" }), /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.note, onChange: (v) => setNewPlace({ ...newPlace, note: v }), placeholder: "\uBA54\uBAA8" })), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: newPlace.route,
      onChange: (e) => setNewPlace({ ...newPlace, route: e.target.value }),
      placeholder: "\uCD94\uCC9C \uACBD\uB85C (\uC120\uD0DD)",
      rows: 2,
      className: "w-full px-2.5 py-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] focus:outline-none focus:bg-white focus:border-[#0A0A0A] resize-y mb-2.5"
    }
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        if (!newPlace.place.trim()) return;
        setHoneymoon([...honeymoon, { id: uid(), ...newPlace, place: newPlace.place.trim(), star: false }]);
        setNewPlace({ place: "", cost: 0, season: "", note: "", route: "" });
      },
      className: "w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 16 }),
    " \uCD94\uAC00\uD558\uAE30"
  ))))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "wedding" })));
}
const KIDS_TABS = [
  { id: "plan", label: "\uC5F0\uB839\uBCC4 \uD560 \uC77C", icon: "check2" },
  { id: "edu", label: "\uAD50\uC721 \uB85C\uB4DC\uB9F5", icon: "calendar" },
  { id: "school", label: "\uD559\uAD70\uC9C0 \uC815\uBCF4", icon: "pin" }
];
function KidsTheme() {
  const [tab, setTab] = usePersist("kids-tab-v1", "plan");
  const [checklist, setChecklist] = usePersist(
    "kids-checklist-v1",
    KIDS_CHECKLIST_DEFAULT.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ id: uid(), text: t, done: false })) }))
  );
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const toggleTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map((it) => it.id === id ? { ...it, done: !it.done } : it) }));
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((it) => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PillNav, { tabs: KIDS_TABS, tab, setTab }), tab === "plan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "\uC804\uCCB4 \uC9C4\uD589\uB960"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 flex-1 max-w-[280px] ml-4" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: taskTotal > 0 ? taskDone / taskTotal : 0 }), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold shrink-0" }, taskDone, "/", taskTotal))), /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-2.5" }, "\uD560 \uC77C \uCD94\uAC00"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value: newTask.gi,
      onChange: (e) => setNewTask({ ...newTask, gi: e.target.value }),
      className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    },
    checklist.map((g, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, g.cat))
  ), /* @__PURE__ */ React.createElement(TextInput, { value: newTask.text, onChange: (v) => setNewTask({ ...newTask, text: v }), placeholder: "\uC608: \uC0B0\uD6C4\uC870\uB9AC\uC6D0 \uD6C4\uBCF4 \uC54C\uC544\uBCF4\uAE30", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement("button", { onClick: addTask, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "\uCD94\uAC00")))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, checklist.map((g, gi) => /* @__PURE__ */ React.createElement("section", { key: gi }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 gap-2" }, /* @__PURE__ */ React.createElement("h4", { className: "font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full" }, g.cat), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${g.cat} \uC721\uC544 \uC900\uBE44 \uD6C4\uAE30`), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#8A8A8A] underline underline-offset-4 hover:text-[#0A0A0A]" }, "\uC2E4\uC81C \uD6C4\uAE30 \uAC80\uC0C9")), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-2 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleTask(gi, it.id), className: "flex items-start gap-3 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[14px] leading-relaxed ${it.done ? "line-through text-[#B0B0B0]" : "text-[#24231E]"}` }, it.text)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => removeTask(gi, it.id), className: "!w-7 !h-7 opacity-0 group-hover:opacity-100" })))))))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uCD9C\uC0B0 \uC721\uC544 \uC9C0\uC6D0 \uC815\uCC45", eyebrow: "\uB193\uCE58\uB294 \uC9C0\uC6D0 \uC5C6\uAC8C", title: "\uCD9C\uC0B0\xB7\uC721\uC544 \uC815\uCC45 \uB274\uC2A4" })), tab === "edu" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "\uC5B4\uB9B0\uC774\uC9D1\uBD80\uD130 \uB300\uD559\uAE4C\uC9C0 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, "\uAE30\uAD00\uBCC4 \uC2E0\uCCAD \uC2DC\uAE30\uC640 \uCC59\uAE38 \uAC83"), "\uC744 \uC815\uB9AC\uD588\uC5B4\uC694. \uC2DC\uAE30\xB7\uAE08\uC561\uC740 2026\uB144 \uC81C\uB3C4 \uAE30\uC900 \uB9AC\uC11C\uCE58\uB77C, \uC2E0\uCCAD \uC804 \uACF5\uC2DD \uC548\uB0B4\uB97C \uAF2D \uD655\uC778\uD558\uC138\uC694."))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch mb-6" }, KIDS_EDU.map((e, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, e.stage), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] font-semibold text-[#8A8A8A] shrink-0 mt-1" }, i + 1, "/", KIDS_EDU.length)), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] bg-[#F5F5F5] rounded-lg px-3 py-2 mb-3" }, "\u23F0 ", e.timing), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 mb-3 flex-1" }, e.points.map((p, j) => /* @__PURE__ */ React.createElement("li", { key: j, className: "flex gap-2 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#8A8A8A]" }), /* @__PURE__ */ React.createElement("span", null, p)))), /* @__PURE__ */ React.createElement("a", { href: naverSearch(e.q), target: "_blank", rel: "noopener noreferrer", className: "mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" }, "\uCD5C\uC2E0 \uC815\uBCF4 \uAC80\uC0C9 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 })))))), tab === "school" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "\uACFC\uCC9C \uAC70\uC8FC \uAE30\uC900\uC73C\uB85C \uD604\uC2E4\uC801\uC778 \uD559\uAD70\uC9C0 \uD6C4\uBCF4\uB97C \uC815\uB9AC\uD588\uC5B4\uC694. ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, "\uD559\uAD70\uC9C0 \uC774\uC0AC\uB294 \uB0B4 \uC9D1 \uB9C8\uB828 \uC785\uC8FC \uC2DC\uC810\uACFC \uBB36\uC5B4\uC11C"), " \uD310\uB2E8\uD558\uB294 \uAC8C \uBE44\uC6A9 \uBA74\uC5D0\uC11C \uC720\uB9AC\uD569\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch mb-6" }, SCHOOL_DISTRICTS.map((d, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, d.area), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 flex-wrap justify-end" }, d.tags.map((t) => /* @__PURE__ */ React.createElement(ToneBadge, { key: t, tone: t === "\uAC70\uC8FC \uC608\uC815\uC9C0" ? "good" : "neutral" }, t)))), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-3 flex-1" }, d.note), /* @__PURE__ */ React.createElement("div", { className: "mt-auto flex gap-3" }, /* @__PURE__ */ React.createElement("a", { href: naverSearch(d.q), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "\uD559\uAD70 \uAC80\uC0C9"), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${d.area} \uD559\uAD70 \uC774\uC0AC \uD6C4\uAE30`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#8A8A8A] underline underline-offset-4" }, "\uC774\uC0AC \uD6C4\uAE30"))))), /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement(InfoNote, null, "\uD559\uAD70 \uC815\uBCF4\uB294 2026\uB144 \uB9AC\uC11C\uCE58 \uAE30\uC900 \uCC38\uACE0\uC6A9\uC774\uC5D0\uC694. \uC2E4\uC81C \uBC30\uC815\xB7\uD559\uC6D0\uAC00 \uC0C1\uD669\uC740 \uC2DC\uAE30\uBCC4\uB85C \uB2EC\uB77C\uC9C0\uB2C8 \uC774\uC0AC \uACB0\uC815 \uC804 \uD604\uC7A5 \uD655\uC778\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement(NewsPanel, { query: "\uD559\uAD70 \uAD50\uC721 \uC815\uCC45", eyebrow: "\uAD50\uC721 \uB3D9\uD5A5", title: "\uD559\uAD70\xB7\uAD50\uC721 \uB274\uC2A4" })), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "kids" })));
}
function summarizeRealty() {
  const diag = computeDiagnosis(store.get("household-inputs-v2", {}));
  return diag;
}
function summarizeSaving() {
  const accounts = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT);
  return {
    totalBalance: accounts.reduce((s, a) => s + (a.balance || 0), 0),
    totalPaid: accounts.reduce((s, a) => s + (a.paid || 0), 0),
    totalGoal: accounts.reduce((s, a) => s + (a.goal || 0), 0)
  };
}
function summarizeKids() {
  const checklist = store.get("kids-checklist-v1", null);
  const total = checklist ? checklist.reduce((s, g) => s + g.items.length, 0) : KIDS_CHECKLIST_DEFAULT.reduce((s, g) => s + g.items.length, 0);
  const done = checklist ? checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0) : 0;
  const next = checklist ? (checklist.flatMap((g) => g.items).find((i) => !i.done) || {}).text : KIDS_CHECKLIST_DEFAULT[0].items[0];
  return { total, done, next: next || "\uBAA8\uB450 \uC644\uB8CC" };
}
function summarizeWedding() {
  const info = store.get("wedding-info-v1", { date: "", venue: "" });
  const budget = store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const checklist = store.get("wedding-checklist-v2", null);
  const taskTotal = checklist ? checklist.reduce((s, g) => s + g.items.length, 0) : WEDDING_CHECKLIST_DEFAULT.reduce((s, g) => s + g.items.length, 0);
  const taskDone = checklist ? checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0) : 0;
  return {
    date: info.date,
    venue: info.venue,
    d: dday(info.date),
    totalBudget: budget.reduce((s, b) => s + (b.budget || 0), 0),
    totalSpent: budget.reduce((s, b) => s + (b.spent || 0), 0),
    taskTotal,
    taskDone
  };
}
const ROADMAP_DEFAULT = [
  { title: "\uACB0\uD63C", period: "\uC9C0\uAE08 ~ \uACB0\uD63C\uC2DD", items: ["\uC0C1\uACAC\uB840\xB7\uC608\uC2DD \uC2DC\uAE30 \uD569\uC758", "\uC6E8\uB529\uD640 \uD22C\uC5B4\xB7\uAC00\uACC4\uC57D", "\uC2A4\uB4DC\uBA54\xB7\uBCF8\uC2DD \uC2A4\uB0C5 \uACC4\uC57D", "\uCCAD\uCCA9\uC7A5\xB7\uBAA8\uC784", "\uACB0\uD63C\uC2DD", "\uC2E0\uD63C\uC5EC\uD589", "\uD63C\uC778\uC2E0\uACE0 (\uB300\uCD9C \uC720\uBD88\uB9AC \uAC80\uD1A0 \uD6C4 \uC2DC\uC810 \uACB0\uC815)"] },
  { title: "\uB0B4 \uC9D1 \uB9C8\uB828", period: "\uACB0\uD63C \uD6C4 ~ \uC785\uC8FC", items: ["\uCCAB \uC804\uC138 \uACC4\uC57D (\uACFC\uCC9C 59\u33A1 \uAE30\uC900)", "\uCCAD\uC57D \uC0C1\uC2DC \uB3C4\uC804 (\uACFC\uCC9C \uC2E0\uADDC \uACF5\uAE09)", "\uC790\uAE08 \uCD95\uC801 (ISA\xB7\uC808\uC138\uACC4\uC88C)", "\uB9E4\uB9E4 \uB610\uB294 \uCCAD\uC57D \uB2F9\uCCA8", "\uC785\uC8FC\xB7\uB300\uCD9C \uC0C1\uD658\uACC4\uD68D \uD655\uC815"] },
  { title: "\uC790\uB140 \uACC4\uD68D", period: "\uC785\uC8FC \uC804\uD6C4", items: ["\uC790\uB140 \uACC4\uD68D \uBD80\uBD80 \uD569\uC758", "\uC2E0\uC0DD\uC544 \uD2B9\uACF5\xB7\uD2B9\uB840\uB300\uCD9C \uC694\uAC74 \uD655\uC778", "\uC784\uC2E0\xB7\uCD9C\uC0B0", "\uCD9C\uC0B0\xB7\uC721\uC544 \uC9C0\uC6D0 \uC815\uCC45 \uC2E0\uCCAD", "\uC5B4\uB9B0\uC774\uC9D1 \uC785\uC18C \uB300\uAE30 \uB4F1\uB85D"] }
];
const roadmapInit = () => ROADMAP_DEFAULT.map((p) => ({ id: uid(), ...p, items: p.items.map((t) => ({ id: uid(), text: t, done: false })) }));
function Roadmap() {
  const [phases, setPhases] = usePersist("roadmap-v1", roadmapInit());
  const [viewAll, setViewAll] = usePersist("roadmap-view-v1", false);
  const [drafts, setDrafts] = useState({});
  const patchPhase = (id, k, v) => setPhases(phases.map((p) => p.id === id ? { ...p, [k]: v } : p));
  const toggleItem = (pid, iid) => setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: p.items.map((it) => it.id === iid ? { ...it, done: !it.done } : it) }));
  const removeItem = (pid, iid) => setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: p.items.filter((it) => it.id !== iid) }));
  const addItem = (pid) => {
    const text = (drafts[pid] || "").trim();
    if (!text) return;
    setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: [...p.items, { id: uid(), text, done: false }] }));
    setDrafts({ ...drafts, [pid]: "" });
  };
  const addPhase = () => setPhases([...phases, { id: uid(), title: "\uC0C8 \uB2E8\uACC4", period: "", items: [] }]);
  const curIdx = phases.findIndex((p) => p.items.some((it) => !it.done));
  const phaseCard = (p, idx, swipe) => {
    const done = p.items.filter((it) => it.done).length;
    const state = curIdx === -1 ? "done" : idx < curIdx ? "done" : idx === curIdx ? "now" : "next";
    return /* @__PURE__ */ React.createElement(Card, { key: p.id, className: `${swipe ? "w-[82vw] max-w-[380px] sm:w-[360px] shrink-0 snap-center" : ""} flex flex-col ${state === "now" ? "!border-[#0A0A0A] border-2" : state === "done" ? "opacity-70" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] font-semibold tracking-[0.14em] uppercase text-[#8A8A8A]" }, "Phase ", idx + 1), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, state === "now" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "\uC9C4\uD589 \uC911"), state === "done" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#8A8A8A]" }, "\uC644\uB8CC"), state === "next" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#B0B0B0]" }, "\uC608\uC815"), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uB2E8\uACC4 \uC0AD\uC81C", onClick: () => window.confirm(`"${p.title}" \uB2E8\uACC4\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694?`) && setPhases(phases.filter((x) => x.id !== p.id)), className: "!w-7 !h-7" }))), /* @__PURE__ */ React.createElement(TextInput, { value: p.title, onChange: (v) => patchPhase(p.id, "title", v), placeholder: "\uB2E8\uACC4 \uC774\uB984", className: "!bg-transparent !px-0 !h-8 !text-[18px] font-bold" }), /* @__PURE__ */ React.createElement(TextInput, { value: p.period, onChange: (v) => patchPhase(p.id, "period", v), placeholder: "\uAE30\uAC04 (\uC608: 2026~2027)", className: "!bg-transparent !px-0 !h-6 !text-[12px] !text-[#8A8A8A] mb-2" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 mb-3" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: p.items.length ? done / p.items.length : 0, height: 5 }), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] font-semibold text-[#8A8A8A] shrink-0" }, done, "/", p.items.length)), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 mb-3 flex-1" }, p.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-1.5 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleItem(p.id, it.id), className: "flex items-start gap-2 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 16, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 16, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[13px] leading-relaxed ${it.done ? "line-through text-[#B0B0B0]" : "text-[#3D3D3D]"}` }, it.text)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => removeItem(p.id, it.id), className: "!w-6 !h-6 opacity-0 group-hover:opacity-100" })))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 mt-auto" }, /* @__PURE__ */ React.createElement(TextInput, { value: drafts[p.id] || "", onChange: (v) => setDrafts({ ...drafts, [p.id]: v }), placeholder: "\uD56D\uBAA9 \uCD94\uAC00", className: "flex-1 min-w-0 !h-9 !text-[13px]" }), /* @__PURE__ */ React.createElement("button", { onClick: () => addItem(p.id), className: "h-9 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0" }, "\uCD94\uAC00")));
  };
  const addPhaseBtn = (swipe) => /* @__PURE__ */ React.createElement("button", { key: "__add", onClick: addPhase, className: `${swipe ? "w-[60vw] max-w-[240px] sm:w-[220px] shrink-0 snap-center" : ""} rounded-2xl border border-dashed border-[#C9C9C9] text-[#8A8A8A] hover:text-[#0A0A0A] hover:border-[#0A0A0A] flex flex-col items-center justify-center gap-2 min-h-[180px] transition-colors` }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 20 }), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold" }, "\uB2E8\uACC4 \uCD94\uAC00"));
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "Life Roadmap", title: "\uC804\uCCB4 \uB85C\uB4DC\uB9F5" }), /* @__PURE__ */ React.createElement("button", { onClick: () => setViewAll(!viewAll), className: "mb-4 h-9 px-3.5 rounded-full bg-white shadow-sm text-[13px] font-semibold text-[#525252] hover:bg-[#FAFAFA] shrink-0" }, viewAll ? "\uCE74\uB4DC\uB85C \uB118\uACA8\uBCF4\uAE30" : "\uC804\uCCB4 \uB85C\uB4DC\uB9F5 \uBCF4\uAE30")), viewAll ? /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch" }, phases.map((p, i) => phaseCard(p, i, false)), addPhaseBtn(false)) : /* @__PURE__ */ React.createElement("div", { className: "flex overflow-x-auto snap-x snap-mandatory gap-4 no-scrollbar -mx-5 px-5 sm:-mx-10 sm:px-10 pb-1 items-stretch" }, phases.map((p, i) => phaseCard(p, i, true)), addPhaseBtn(true)));
}
function HomeTheme({ setTheme, hh, setHh }) {
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
  const segs = THEMES.map((t) => ({ id: t.id, label: t.label, value: alloc[t.id] || 0, color: t.color }));
  const allMs = [
    ...wedding.date ? [{ id: "__wedding", label: `\uACB0\uD63C\uC2DD${wedding.venue ? " \xB7 " + wedding.venue : ""}`, date: wedding.date, fixed: true }] : [],
    ...milestones
  ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const addMs = () => {
    if (!newMs.label.trim() || !newMs.date) return;
    setMilestones([...milestones, { id: uid(), label: newMs.label.trim(), date: newMs.date }]);
    setNewMs({ label: "", date: "" });
  };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Roadmap, null), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "piggy", label: "\uCD1D \uD604\uAE08 \uC790\uC0B0", value: manWon(alloc.totalCash), accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "calc", label: over ? "\uBC30\uBD84 \uCD08\uACFC" : "\uB0A8\uC740 \uC5EC\uC720\uC790\uAE08", value: over ? /* @__PURE__ */ React.createElement(React.Fragment, null, "-", manWon(-free)) : manWon(free), accent: "#4B4B4B" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "heart", label: "\uACB0\uD63C\uC2DD D-Day", value: wedding.d === null ? "\uBBF8\uC815" : ddayText(wedding.d), accent: "#8A8A8A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "trending", label: "\uC808\uC138\uACC4\uC88C \uC794\uC561", value: manWon(saving.totalBalance), accent: "#C6C6C6" })), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "Couple Profile", title: "\uC6B0\uB9AC \uBD80\uBD80 \uC815\uBCF4" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: `${hh.label1 || "\uBCF8\uC778"} \uC5F0\uC18C\uB4DD(\uB9CC\uC6D0)`, value: hh.income1, onChange: (v) => setHh({ income1: v }) }), /* @__PURE__ */ React.createElement(Field, { label: `${hh.label2 || "\uBC30\uC6B0\uC790"} \uC5F0\uC18C\uB4DD(\uB9CC\uC6D0)`, value: hh.income2, onChange: (v) => setHh({ income2: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "\uD604\uC7AC \uC21C\uC790\uC0B0(\uB9CC\uC6D0)", value: hh.assets, onChange: (v) => setHh({ assets: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "\uC6D4 \uC800\uCD95\uAC00\uB2A5\uC561(\uB9CC\uC6D0)", value: hh.monthlySave, onChange: (v) => setHh({ monthlySave: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "\uAE30\uC874 \uB300\uCD9C \uC6D4\uC0C1\uD658(\uB9CC\uC6D0)", value: hh.existingDebtMonthly, onChange: (v) => setHh({ existingDebtMonthly: v }) })), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#F0F0F0] flex flex-wrap items-center gap-x-8 gap-y-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#8A8A8A]" }, "\uBD80\uBD80\uD569\uC0B0 \uC6D4\uC18C\uB4DD(\uC138\uC804) ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums" } }, won(Math.round((hh.income1 + hh.income2) * 1e4 / 12)))), /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#8A8A8A]" }, "\uC138\uD6C4 \uCD94\uC815 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums" } }, won(Math.round((estimateNetAnnual(hh.income1 * 1e4) + estimateNetAnnual(hh.income2 * 1e4)) / 12)))), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#B0B0B0] lg:ml-auto" }, "\uC774 \uAC12\uC740 \uBD80\uB3D9\uC0B0 \uC9C4\uB2E8 \xB7 \uB300\uCD9C \xB7 \uC815\uCC45 \uD310\uC815 \uB4F1 \uBAA8\uB4E0 \uD0ED\uC5D0 \uC2E4\uC2DC\uAC04 \uBC18\uC601\uB429\uB2C8\uB2E4")))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "THEMES", title: "\uD14C\uB9C8\uBCC4 \uD604\uD669" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTheme("realty"), className: "w-full text-left" }, /* @__PURE__ */ React.createElement(Card, { className: "hover:border-[#0A0A0A]/50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-white", style: { background: "#0A0A0A" } }, /* @__PURE__ */ React.createElement(Icon, { name: "home", size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, "\uBD80\uB3D9\uC0B0"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A]" }, themeOf("realty").desc))), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 18, className: "text-[#8A8A8A]" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uBAA9\uD45C"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold truncate" }, realty.target.label.split(" \xB7 ")[0], " ", realty.target.label.includes("84") ? "84\u33A1" : realty.target.label.includes("59") ? "59\u33A1" : "")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uD544\uC694 \uC790\uAE30\uC790\uBCF8"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, wonShort(realty.requiredCash))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC790\uAE30\uC790\uBCF8 \uAC2D"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, realty.gap > 0 ? wonShort(realty.gap) : "\uCDA9\uC871"))))), /* @__PURE__ */ React.createElement("button", { onClick: () => setTheme("saving"), className: "w-full text-left" }, /* @__PURE__ */ React.createElement(Card, { className: "hover:border-[#0A0A0A]/50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-white", style: { background: "#6E6E6E" } }, /* @__PURE__ */ React.createElement(Icon, { name: "trending", size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, "\uB3C8 \uBAA8\uC73C\uAE30"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A]" }, themeOf("saving").desc))), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 18, className: "text-[#8A8A8A]" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC808\uC138\uACC4\uC88C \uC794\uC561"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, manWon(saving.totalBalance))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC62C\uD574 \uB0A9\uC785"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, manWon(saving.totalPaid))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC5F0 \uBAA9\uD45C \uB2EC\uC131\uB960"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold text-[#0A0A0A]" }, saving.totalGoal > 0 ? Math.round(saving.totalPaid / saving.totalGoal * 100) : 0, "%"))))), /* @__PURE__ */ React.createElement("button", { onClick: () => setTheme("wedding"), className: "w-full text-left" }, /* @__PURE__ */ React.createElement(Card, { className: "hover:border-[#0A0A0A]/50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-white", style: { background: "#BDBDBD" } }, /* @__PURE__ */ React.createElement(Icon, { name: "heart", size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, "\uACB0\uD63C\uC2DD"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A]" }, themeOf("wedding").desc))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, wedding.d !== null && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold text-white px-2.5 py-1 rounded-full bg-[#0A0A0A]" }, ddayText(wedding.d)), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 18, className: "text-[#8A8A8A]" }))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC608\uC0B0"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, manWon(wedding.totalBudget))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC9C0\uCD9C"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold text-[#0A0A0A]" }, manWon(wedding.totalSpent))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uC900\uBE44 \uC9C4\uD589\uB960"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, wedding.taskDone, "/", wedding.taskTotal))))), /* @__PURE__ */ React.createElement("button", { onClick: () => setTheme("kids"), className: "w-full text-left" }, /* @__PURE__ */ React.createElement(Card, { className: "hover:border-[#0A0A0A]/50 transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-white", style: { background: "#8F8F8F" } }, /* @__PURE__ */ React.createElement(Icon, { name: "child", size: 17 })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, "\uC790\uB140"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A]" }, themeOf("kids").desc))), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 18, className: "text-[#8A8A8A]" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uD560 \uC77C \uC9C4\uD589\uB960"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, kids.done, "/", kids.total)), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uB2EC\uC131\uB960"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, kids.total > 0 ? Math.round(kids.done / kids.total * 100) : 0, "%")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#8A8A8A] mb-0.5" }, "\uB2E4\uC74C \uD560 \uC77C"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold truncate px-1" }, kids.next))))))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "Allocation", title: "\uC790\uAE08 \uBC30\uBD84" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "p-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-[3px] h-3 mb-4" }, segs.map((s) => s.value > 0 && alloc.totalCash > 0 && /* @__PURE__ */ React.createElement("div", { key: s.id, title: `${s.label} ${pct(s.value)}%`, style: { width: `${Math.min(100, pct(s.value))}%`, background: s.color }, className: "h-full rounded-full transition-all" })), /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#F0F0F0] flex-1" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] mb-5" }, segs.map((s) => /* @__PURE__ */ React.createElement("span", { key: s.id, className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] inline-block", style: { background: s.color } }), /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, s.label), /* @__PURE__ */ React.createElement("b", { style: { fontVariantNumeric: "tabular-nums" } }, pct(s.value), "%"), /* @__PURE__ */ React.createElement("span", { className: "text-[#8A8A8A]" }, "\xB7 ", manWon(s.value)))), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] inline-block bg-[#F0F0F0] border border-[#E0E0E0]" }), /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, "\uC5EC\uC720"), /* @__PURE__ */ React.createElement("b", { style: { fontVariantNumeric: "tabular-nums" } }, Math.max(0, pct(free)), "%"))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3 pt-4 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement(Field, { label: "\uCD1D \uD604\uAE08(\uB9CC\uC6D0)", value: alloc.totalCash, onChange: (v) => setAlloc({ ...alloc, totalCash: v }), step: 1e3 }), /* @__PURE__ */ React.createElement(Field, { label: "\uBD80\uB3D9\uC0B0 \uBC30\uC815(\uB9CC\uC6D0)", value: alloc.realty, onChange: (v) => setAlloc({ ...alloc, realty: v }), step: 1e3 }), /* @__PURE__ */ React.createElement(Field, { label: "\uB3C8 \uBAA8\uC73C\uAE30 \uBC30\uC815(\uB9CC\uC6D0)", value: alloc.saving, onChange: (v) => setAlloc({ ...alloc, saving: v }), step: 500 }), /* @__PURE__ */ React.createElement(Field, { label: "\uACB0\uD63C\uC2DD \uBC30\uC815(\uB9CC\uC6D0)", value: alloc.wedding, onChange: (v) => setAlloc({ ...alloc, wedding: v }), step: 500 }), /* @__PURE__ */ React.createElement(Field, { label: "\uC790\uB140 \uBC30\uC815(\uB9CC\uC6D0)", value: alloc.kids || 0, onChange: (v) => setAlloc({ ...alloc, kids: v }), step: 500 }))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "\uC804\uCCB4 \uC77C\uC815", title: "\uD1B5\uD569 \uD0C0\uC784\uB77C\uC778" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, allMs.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A]" }, "\uB4F1\uB85D\uB41C \uC77C\uC815\uC774 \uC5C6\uC5B4\uC694. \uC544\uB798\uC5D0\uC11C \uCD94\uAC00\uD574 \uBCF4\uC138\uC694.")), allMs.map((m) => {
    const n = dday(m.date);
    const past = n !== null && n < 0;
    return /* @__PURE__ */ React.createElement(Card, { key: m.id, className: "!p-4 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: `w-2.5 h-2.5 rounded-full shrink-0 ${past ? "bg-[#D4D4D4]" : "bg-[#0A0A0A]"}` }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: `text-[15px] font-semibold truncate ${past ? "text-[#8A8A8A]" : ""}` }, m.label), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A8A8A]" }, m.date))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement("span", { className: `font-mono text-[12px] font-semibold px-2.5 py-1 rounded-full ${past ? "bg-[#F0F0F0] text-[#9A9A9A]" : "bg-[#0A0A0A] text-white"}` }, ddayText(n)), !m.fixed && /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "\uC0AD\uC81C", onClick: () => setMilestones(milestones.filter((x) => x.id !== m.id)) })));
  }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#8A8A8A] mb-2.5" }, "\uC77C\uC815 \uCD94\uAC00 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal" }, "(\uACB0\uD63C\uC2DD \uB0A0\uC9DC\uB294 \uACB0\uD63C\uC2DD \uD14C\uB9C8\uC5D0\uC11C \uC124\uC815\uD558\uBA74 \uC790\uB3D9 \uD45C\uC2DC)")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newMs.label, onChange: (v) => setNewMs({ ...newMs, label: v }), placeholder: "\uC608: \uC804\uC138 \uACC4\uC57D \uB9CC\uAE30", className: "flex-1" }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: newMs.date,
      onChange: (e) => setNewMs({ ...newMs, date: e.target.value }),
      className: "h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: addMs, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "\uCD94\uAC00")))))));
}
const NAV = [{ id: "home", label: "\uD648", icon: "grid", color: "#0A0A0A" }, ...THEMES];
function App({ user }) {
  const [theme, setTheme] = usePersist("active-theme-v1", "home");
  const [mapKey, setMapKey] = useState("");
  const [privacy, setPrivacy] = usePersist("privacy-mode-v1", false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  PRIVACY = privacy;
  const cur = NAV.find((n) => n.id === theme) || NAV[0];
  useEffect(() => {
    fetch(api("/api/config")).then((r) => r.ok ? r.json() : null).then((c) => {
      if (c && c.naverMapKey) setMapKey(c.naverMapKey);
    }).catch(() => {
    });
  }, []);
  const [hh, setHhRaw] = useState(() => ({ ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) }));
  const setHh = (patch) => setHhRaw((p) => ({ ...p, ...patch }));
  useEffect(() => {
    const t = setTimeout(() => store.set("household-inputs-v2", hh), 300);
    return () => clearTimeout(t);
  }, [hh]);
  return /* @__PURE__ */ React.createElement("div", { className: `min-h-screen bg-[#F4F4F5] text-[#0A0A0A] ${privacy ? "privacy-on" : ""}`, style: { fontFamily: "'Pretendard','Noto Sans KR',sans-serif" } }, /* @__PURE__ */ React.createElement("aside", { className: "hidden lg:flex fixed inset-y-0 left-0 w-60 bg-[#0A0A0A] text-white flex-col z-30" }, /* @__PURE__ */ React.createElement("div", { className: "px-7 pt-9 pb-10" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-white/40" }, "Life Plan \xB7 2026"), /* @__PURE__ */ React.createElement("div", { className: "text-[19px] font-bold tracking-tight mt-2" }, "\uC6B0\uB9AC \uB77C\uC774\uD504 \uD50C\uB79C")), /* @__PURE__ */ React.createElement("div", { className: "px-4 space-y-1.5 flex-1" }, NAV.map((t) => {
    const active = theme === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        onClick: () => {
          setTheme(t.id);
          window.scrollTo({ top: 0 });
        },
        className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-colors ${active ? "bg-white text-[#0A0A0A] font-bold" : "text-white/50 hover:text-white hover:bg-white/5 font-semibold"}`
      },
      /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 16 }),
      t.label
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-7" }, user && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 px-4 py-3 mb-1 rounded-xl bg-white/5" }, user.photoURL ? /* @__PURE__ */ React.createElement("img", { src: user.photoURL, referrerPolicy: "no-referrer", alt: "", className: "w-7 h-7 rounded-full shrink-0" }) : /* @__PURE__ */ React.createElement("span", { className: "w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold shrink-0" }, (user.email || "?")[0].toUpperCase()), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold truncate" }, user.displayName || user.email), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-white/35" }, "\uD074\uB77C\uC6B0\uB4DC \uB3D9\uAE30\uD654 \uC911")), /* @__PURE__ */ React.createElement("button", { onClick: () => firebase.auth().signOut(), className: "text-[11px] font-semibold text-white/40 hover:text-white shrink-0" }, "\uB85C\uADF8\uC544\uC6C3")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      className: "w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 15 }),
    "\uC124\uC815"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setPrivacy(!privacy),
      className: `w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${privacy ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: privacy ? "eyeOff" : "eye", size: 15 }),
    privacy ? "\uAE08\uC561 \uBE14\uB7EC \uD574\uC81C" : "\uAE08\uC561 \uBE14\uB7EC"
  ), /* @__PURE__ */ React.createElement("p", { className: "px-4 mt-3 text-[11px] leading-relaxed text-white/25" }, "\uCC38\uACE0\uC6A9 \uC2DC\uBBAC\uB808\uC774\uC158\uC774\uBA70 \uBC95\uB960\xB7\uC138\uBB34\xB7\uD22C\uC790 \uC790\uBB38\uC774 \uC544\uB2D9\uB2C8\uB2E4."))), /* @__PURE__ */ React.createElement("div", { className: "lg:pl-60" }, /* @__PURE__ */ React.createElement("header", { className: "px-5 pt-9 pb-1 sm:px-10" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1160px] mx-auto flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-[#8A8A8A] mb-2 lg:hidden" }, "Life Plan \xB7 2026"), /* @__PURE__ */ React.createElement("h1", { className: "text-[30px] sm:text-[34px] font-bold leading-tight tracking-tight" }, theme === "home" ? "\uC6B0\uB9AC \uB77C\uC774\uD504 \uD50C\uB79C" : cur.label === "\uBD80\uB3D9\uC0B0" ? "\uACFC\uCC9C \uB0B4 \uC9D1 \uB9C8\uB828" : cur.label), /* @__PURE__ */ React.createElement("p", { className: "mt-1.5 text-[14px] text-[#8A8A8A]" }, theme === "home" ? "\uCD1D \uC790\uAE08 \uBC30\uBD84 \xB7 \uD14C\uB9C8 \uC694\uC57D \xB7 \uD1B5\uD569 \uD0C0\uC784\uB77C\uC778" : cur.desc)), /* @__PURE__ */ React.createElement("div", { className: "lg:hidden flex items-center gap-2 shrink-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      title: "\uC124\uC815",
      className: "w-11 h-11 rounded-full flex items-center justify-center border bg-white text-[#525252] border-[#E5E5E5]"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 17 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setPrivacy(!privacy),
      title: privacy ? "\uAE08\uC561 \uBE14\uB7EC \uD574\uC81C" : "\uAE08\uC561 \uBE14\uB7EC",
      className: `w-11 h-11 rounded-full flex items-center justify-center border transition-colors ${privacy ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: privacy ? "eyeOff" : "eye", size: 17 })
  ), user && (user.photoURL ? /* @__PURE__ */ React.createElement("img", { src: user.photoURL, referrerPolicy: "no-referrer", alt: "", title: user.email + " \xB7 \uD0ED\uD558\uBA74 \uB85C\uADF8\uC544\uC6C3", onClick: () => window.confirm("\uB85C\uADF8\uC544\uC6C3\uD560\uAE4C\uC694?") && firebase.auth().signOut(), className: "w-11 h-11 rounded-full border border-[#E5E5E5] cursor-pointer" }) : /* @__PURE__ */ React.createElement("button", { onClick: () => window.confirm("\uB85C\uADF8\uC544\uC6C3\uD560\uAE4C\uC694?") && firebase.auth().signOut(), className: "w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-[13px] font-bold" }, (user.email || "?")[0].toUpperCase()))))), /* @__PURE__ */ React.createElement("main", { className: "max-w-[1160px] mx-auto px-5 sm:px-10 py-7 space-y-6" }, theme === "home" && /* @__PURE__ */ React.createElement(HomeTheme, { setTheme, hh, setHh }), theme === "realty" && /* @__PURE__ */ React.createElement(RealtyTheme, { mapKey, hh, setHh, setTheme }), theme === "saving" && /* @__PURE__ */ React.createElement(SavingTheme, { hh }), theme === "wedding" && /* @__PURE__ */ React.createElement(WeddingTheme, null), theme === "kids" && /* @__PURE__ */ React.createElement(KidsTheme, null)), /* @__PURE__ */ React.createElement("footer", { className: "text-center text-[12px] text-[#B0B0B0] pb-32 lg:pb-10 px-5 leading-relaxed" }, "\uBCF8 \uB3C4\uAD6C\uB294 \uCC38\uACE0\uC6A9 \uC2DC\uBBAC\uB808\uC774\uC158\uC774\uBA70 \uBC95\uB960\xB7\uC138\uBB34\xB7\uD22C\uC790 \uC790\uBB38\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC2E4\uD589 \uC804 \uC740\uD589\xB7\uC138\uBB34\uC0AC\xB7\uCCAD\uC57D \uC804\uBB38\uAC00 \uD655\uC778\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement("nav", { className: "lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-[#0A0A0A]/95 backdrop-blur px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]" }, NAV.map((t) => {
    const active = theme === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        title: t.label,
        onClick: () => {
          setTheme(t.id);
          window.scrollTo({ top: 0 });
        },
        className: `flex items-center gap-1.5 rounded-full transition-all duration-200 ${active ? "bg-white text-[#0A0A0A] pl-3.5 pr-4 py-2.5 text-[13px] font-bold" : "text-white/50 hover:text-white p-2.5"}`
      },
      /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 17 }),
      active && /* @__PURE__ */ React.createElement("span", { className: "whitespace-nowrap" }, t.label)
    );
  })), /* @__PURE__ */ React.createElement(SettingsModal, { open: settingsOpen, onClose: () => setSettingsOpen(false), hh, setHh }));
}
function useAuth() {
  const [auth, setAuth] = useState({ status: cloud.enabled ? "loading" : "local", user: null });
  useEffect(() => {
    if (!cloud.enabled) return;
    cloud.init();
    return firebase.auth().onAuthStateChanged(async (u) => {
      cloud.user = u;
      if (!u) {
        setAuth({ status: "signedout", user: null });
        return;
      }
      const allowed = !window.ALLOWED_EMAILS || window.ALLOWED_EMAILS.includes(u.email);
      if (!allowed) {
        setAuth({ status: "denied", user: u });
        return;
      }
      await cloud.pullOnce();
      setAuth({ status: "ok", user: u });
    });
  }, []);
  return auth;
}
function AuthShell({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-[#F4F4F5] flex items-center justify-center p-6", style: { fontFamily: "'Pretendard','Noto Sans KR',sans-serif" } }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_20px_50px_-20px_rgba(0,0,0,0.2)] p-9 w-full max-w-sm text-center" }, children));
}
function LoginScreen() {
  const [err, setErr] = useState("");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|; wv\)/i.test(ua);
  const openExternal = () => {
    const url = window.location.href;
    if (/KAKAOTALK/i.test(ua)) {
      window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
      return;
    }
    if (/android/i.test(ua)) {
      window.location.href = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {
    });
    alert("\uC8FC\uC18C\uAC00 \uBCF5\uC0AC\uB410\uC5B4\uC694. Safari(\uB610\uB294 Chrome)\uB97C \uC9C1\uC811 \uC5F4\uACE0 \uC8FC\uC18C\uCC3D\uC5D0 \uBD99\uC5EC\uB123\uC5B4 \uC811\uC18D\uD574 \uC8FC\uC138\uC694.");
  };
  const login = () => {
    setErr("");
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((e) => {
      if (e && e.code === "auth/popup-blocked") {
        firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
        return;
      }
      if (e && e.code === "auth/popup-closed-by-user") return;
      setErr(e && e.message);
    });
  };
  return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-[#8A8A8A]" }, "Life Plan \xB7 2026"), /* @__PURE__ */ React.createElement("h1", { className: "text-2xl font-bold tracking-tight mt-2 mb-1.5" }, "\uC6B0\uB9AC \uB77C\uC774\uD504 \uD50C\uB79C"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#8A8A8A] mb-7" }, "\uD5C8\uC6A9\uB41C \uACC4\uC815\uB9CC \uC811\uADFC\uD560 \uC218 \uC788\uC5B4\uC694."), inApp && /* @__PURE__ */ React.createElement("div", { className: "mb-5 text-left bg-[#F5F5F5] rounded-xl p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-1" }, "\uC9C0\uAE08 \uC571 \uC548\uC758 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uB824 \uC788\uC5B4\uC694"), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#525252] leading-relaxed mb-3" }, "\uAD6C\uAE00 \uBCF4\uC548 \uC815\uCC45\uC0C1 \uCE74\uCE74\uC624\uD1A1\xB7\uC778\uC2A4\uD0C0 \uB4F1 \uC571 \uB0B4 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uAD6C\uAE00 \uB85C\uADF8\uC778\uC774 \uCC28\uB2E8\uB429\uB2C8\uB2E4. \uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800(Safari\xB7Chrome)\uB85C \uC5F4\uBA74 \uC815\uC0C1 \uB85C\uADF8\uC778\uB3FC\uC694."), /* @__PURE__ */ React.createElement("button", { onClick: openExternal, className: "w-full h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold" }, "\uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uAE30")), /* @__PURE__ */ React.createElement("button", { onClick: login, className: "w-full h-12 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-2.5" }, /* @__PURE__ */ React.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24" }, /* @__PURE__ */ React.createElement("path", { fill: "#fff", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".7", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".5", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".85", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })), "Google\uB85C \uB85C\uADF8\uC778"), err && /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[12px] text-[#525252] bg-[#F5F5F5] rounded-lg px-3 py-2 break-all" }, err));
}
function DeniedScreen({ user }) {
  return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 22 })), /* @__PURE__ */ React.createElement("h1", { className: "text-xl font-bold tracking-tight mb-1.5" }, "\uC811\uADFC \uAD8C\uD55C\uC774 \uC5C6\uC5B4\uC694"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#8A8A8A] mb-1 break-all" }, user && user.email), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#8A8A8A] mb-6 leading-relaxed" }, "\uC774 \uACC4\uC815\uC740 \uD5C8\uC6A9 \uBAA9\uB85D\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4. \uAD00\uB9AC\uC790\uC5D0\uAC8C ", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[11px] bg-[#F5F5F5] px-1 rounded" }, "firebase-config.js"), "\uC758 ALLOWED_EMAILS \uCD94\uAC00\uB97C \uC694\uCCAD\uD558\uC138\uC694."), /* @__PURE__ */ React.createElement("button", { onClick: () => firebase.auth().signOut(), className: "w-full h-11 rounded-xl border border-[#E5E5E5] font-semibold text-[#525252]" }, "\uB2E4\uB978 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778"));
}
function Root() {
  const auth = useAuth();
  const [syncVer, setSyncVer] = useState(0);
  useEffect(() => {
    if (auth.status !== "ok") return;
    return cloud.subscribe(() => setSyncVer((v) => v + 1));
  }, [auth.status]);
  if (auth.status === "loading") return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#8A8A8A] py-6" }, "\uB85C\uADF8\uC778 \uD655\uC778 \uC911\u2026"));
  if (auth.status === "signedout") return /* @__PURE__ */ React.createElement(LoginScreen, null);
  if (auth.status === "denied") return /* @__PURE__ */ React.createElement(DeniedScreen, { user: auth.user });
  return /* @__PURE__ */ React.createElement(App, { key: syncVer, user: auth.user });
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Root, null));
