const { useState, useEffect, useRef, useMemo } = React;
const won = (n) => {
  if (n === null || n === void 0 || isNaN(n)) return "-";
  const a = Math.abs(n), dec = Math.round(a / 1e3) / 10;
  if (a >= 1e4 && a < 1e6 && dec % 1 !== 0) return `${n < 0 ? "-" : ""}${dec}만원`;
  const manTotal = Math.round(a / 1e4);
  const sign = n < 0 && manTotal > 0 ? "-" : "";
  const eok = Math.floor(manTotal / 1e4), man = manTotal % 1e4;
  if (eok > 0) return `${sign}${eok.toLocaleString()}억${man > 0 ? " " + man.toLocaleString() + "만" : ""}원`;
  return `${sign}${man.toLocaleString()}만원`;
};
[[199996e3, "2억원"], [-15e7, "-1억 5,000만원"], [12345e4, "1억 2,345만원"], [9999e4, "9,999만원"], [0, "0만원"], [-4999, "0만원"], [75e3, "7.5만원"], [555e3, "55.5만원"], [8e4, "8만원"]].forEach(([n, want]) => {
  const got = won(n);
  if (got !== want) console.error(`won(${n}) = "${got}" — 기대값 "${want}"`);
});
const wonShort = (n) => {
  if (n === null || n === void 0 || isNaN(n)) return "확인 필요";
  const man = Math.round(n / 1e4);
  if (Math.abs(man) >= 1e4) return (n / 1e8).toFixed(1) + "억";
  return man !== 0 && man % 1e3 === 0 ? `${man / 1e3}천만원` : won(n);
};
[[6e7, "6천만원"], [55e6, "5,500만원"], [64e7, "6.4억"], [-5e7, "-5천만원"], [99996e3, "1.0억"]].forEach(([n, want]) => {
  if (wonShort(n) !== want) console.error(`wonShort(${n}) = "${wonShort(n)}" — 기대값 "${want}"`);
});
const manWon = (n) => won((n || 0) * 1e4);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
function Blur({ on, children }) {
  return on ? /* @__PURE__ */ React.createElement("span", { className: "money-blur", "aria-hidden": "true" }, children) : /* @__PURE__ */ React.createElement(React.Fragment, null, children);
}
function todayYmd(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const safeUrl = (u) => /^(https?:\/\/|\/api\/vg-img\?p=)/i.test(String(u || "")) ? String(u) : null;
function stableKey(...parts) {
  const s = parts.join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const normYmdStr = (s) => {
  const m = String(s || "").match(/(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
  if (!m) return "";
  const out = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const d = /* @__PURE__ */ new Date(out + "T00:00:00");
  return !isNaN(d) && d.getMonth() + 1 === +m[2] && d.getDate() === +m[3] ? out : "";
};
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
  return tierOf(policy().loan.mortgage.hardCaps, price, "upToWon").capWon;
}
function loanFromMonthlyPayment(monthlyPayment, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const n = years * 12;
  if (i <= 0) return monthlyPayment * n;
  return monthlyPayment * (1 - Math.pow(1 + i, -n)) / i;
}
const POLICY_OVERRIDES_KEY = "policy-overrides-v1";
const getPath = (obj, path) => path.split(".").reduce((o, k) => o == null ? void 0 : o[k], obj);
function setPath(obj, path, value) {
  const ks = String(path).split(".");
  let o = obj;
  const own = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
  if (ks.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) return false;
  for (let i = 0; i < ks.length - 1; i++) {
    if (!own(o, ks[i]) || o[ks[i]] == null || typeof o[ks[i]] !== "object") return false;
    o = o[ks[i]];
  }
  if (!own(o, ks[ks.length - 1])) return false;
  o[ks[ks.length - 1]] = value;
  return true;
}
let policyCache = { raw: void 0, val: null };
function policy() {
  let raw = null;
  try {
    raw = localStorage.getItem(POLICY_OVERRIDES_KEY);
  } catch {
  }
  if (policyCache.val && raw === policyCache.raw) return policyCache.val;
  const val = JSON.parse(JSON.stringify(window.POLICY_DEFAULT || {}));
  let ov = {};
  try {
    ov = JSON.parse(raw) || {};
  } catch {
  }
  Object.entries(ov).forEach(([path, o]) => {
    if (o && "value" in o) setPath(val, path, o.value);
  });
  policyCache = { raw, val };
  return val;
}
const tierOf = (tiers, x, key = "upTo", inclusive = true) => tiers.find((t) => t[key] == null || (inclusive ? x <= t[key] : x < t[key])) || tiers[tiers.length - 1];
function subTier(incs, base, pr, ge, each) {
  const lim = (pct) => Math.floor(base * pct / 100);
  const sum = incs.reduce((a, b) => a + (Number(b) || 0), 0), dual = incs.filter((v) => v > 0).length > 1, top = Math.max(0, ...incs.map((v) => Number(v) || 0));
  const eachBlocks = (pct) => dual && pct != null && top > lim(pct);
  let eachOver = null, eachTier = null;
  const out = (tier, pct) => ({ tier, pct, eachOver, eachTier, eachLim: eachOver != null ? lim(eachOver) : null });
  if (sum <= lim(pr)) {
    if (!eachBlocks(each && each.priority)) return out("우선공급", pr);
    eachOver = each.priority;
    eachTier = "우선공급";
  }
  if (sum <= lim(ge)) {
    if (!eachBlocks(each && each.general)) return out("일반공급", ge);
    eachOver = each.general;
    eachTier = "일반공급";
  }
  return out("추첨", ge);
}
const SPECIAL_ONCE_TEXT = "특공 당첨은 원칙적으로 세대당 한 번이에요. 예외: 혼인신고 전에 당첨됐어도 신혼특공은 한 번 더 넣을 수 있고, 2024.6.19 이후 태어난 자녀가 있으면 한 번 더 넣을 수 있어요.";
const subEachWhy = (r, mw) => r.eachOver != null ? `한 사람 소득이 기준의 ${r.eachOver}%(월 ${mw(r.eachLim)})를 넘어 ${r.eachTier}은 안 돼요.` : "";
const soloFirstHomeOk = (v, limWon, S1, propertyWon, capWon) => v > 0 && (v <= limWon || !!S1.lotteryOverIncomeWithPropertyCap && propertyWon <= capWon);
const annuityPayment = (P, ratePct, years) => {
  const i = ratePct / 100 / 12, n = years * 12;
  return n > 0 ? i > 0 ? P * i / (1 - Math.pow(1 + i, -n)) : P / n : 0;
};
const brokerFee = (tiers, p) => {
  const t = tierOf(tiers, p, "upToWon", false);
  return Math.round(t.capWon ? Math.min(p * t.rate, t.capWon) : p * t.rate);
};
function closingCost(dealType, price, firstTime) {
  const C = policy().closing, move = C.moveCostWon;
  const p = Number(price) || 0;
  if (!(p > 0)) return { tax: 0, broker: 0, move: 0, total: 0 };
  if (dealType === "전세" || dealType === "월세") {
    const broker2 = brokerFee(C.brokerLease, p);
    return { tax: 0, broker: broker2, move, total: broker2 + move };
  }
  const T = C.acqTax;
  const taxRate = p <= T.lowMaxWon ? T.lowRate : p <= T.highMinWon ? (p / 1e8 * 2 / 3 - 3) / 100 : T.highRate;
  let tax = Math.round(p * taxRate * (1 + T.eduSurcharge));
  if (firstTime && p <= C.firstTimeRelief.maxPriceWon) tax = Math.max(0, tax - C.firstTimeRelief.amountWon);
  const broker = dealType === "청약" ? 0 : brokerFee(C.brokerSale, p);
  return { tax, broker, move, total: tax + broker + move };
}
(() => {
  const a = closingCost("매매", 6e8, false), b = closingCost("매매", 9e8, false), c = closingCost("청약", 6e8, true);
  if (a.tax !== 66e5 || b.tax !== 297e5 || c.broker !== 0 || c.tax !== 46e5) console.error("closingCost 실패", a, b, c);
})();
const pyeongText = (m2) => {
  const a = Number(m2);
  return a > 0 ? `${(a / 3.3058).toFixed(1).replace(/\.0$/, "")}평(${Math.round(a * 10) / 10}㎡)` : "";
};
function estimateFinancing({ dealType, price, rent = 0, hh }) {
  const s = { ...HH_DEFAULT, ...hh || {} };
  const incomeMan = (Number(s.income1) || 0) + (Number(s.income2) || 0);
  const equityMan = s.equity != null ? Number(s.equity) || 0 : realtyEquityMan(s);
  const assetsWon = equityMan * 1e4;
  const extra = closingCost(dealType, Number(price) || 0, s.firstTime);
  const P = policy().loan;
  const dealKey = dealType === "청약" ? "매매" : dealType;
  const i1 = Number(s.income1) || 0, i2 = Number(s.income2) || 0;
  const programs = P.programs.filter((p) => p.deal === dealKey).map((p) => {
    const cap = p.incomeMaxSingle && !(i1 > 0 && i2 > 0) ? p.incomeMaxSingle : p.incomeMax;
    const okPerson = !p.perPersonMax || Math.max(i1, i2) <= p.perPersonMax;
    const soloPath = !(incomeMan <= cap) && p.anyPersonMax && i1 > 0 && i2 > 0 && Math.min(i1, i2) <= p.anyPersonMax && (!p.anyPersonFrom || todayYmd() >= p.anyPersonFrom);
    const okIncome = incomeMan <= cap && okPerson || soloPath, okPrice = price <= p.priceMax;
    return {
      name: p.name,
      eligible: okIncome && okPrice,
      limit: p.limit,
      cond: p.cond,
      reason: !okPerson ? `한 사람 연소득 ${manWon(Math.max(i1, i2))}이 1인 상한 ${manWon(p.perPersonMax)}보다 ${manWon(Math.max(i1, i2) - p.perPersonMax)} 많아요` : !okIncome ? `부부 연소득 합산 ${manWon(incomeMan)}이 기준 ${manWon(cap)}${cap !== p.incomeMax ? "(외벌이 기준)" : ""}보다 ${manWon(incomeMan - cap)} 많아요` : !okPrice ? `${p.deal === "매매" ? "집값" : "보증금"} ${wonShort(price)}이 상한 ${wonShort(p.priceMax)}보다 ${wonShort(price - p.priceMax)} 많아요` : soloPath ? `부부 합산은 기준을 넘지만, 연소득 ${manWon(Math.min(i1, i2))}인 배우자 혼자 대출받으면 신청할 수 있어요(한도는 그 사람 소득으로 심사)` : p.cond
    };
  });
  if (dealType === "전세" || dealType === "월세") {
    const deposit = Number(price) || 0;
    const ratioLoan = deposit * P.jeonse.ratio;
    const maxLoan2 = Math.max(0, Math.min(ratioLoan, P.jeonse.capWon));
    const binding2 = deposit > P.jeonse.publicGuaranteeMaxWon ? `${wonShort(P.jeonse.publicGuaranteeMaxWon)} 초과 — HF·HUG 불가, SGI 민간보증` : ratioLoan > P.jeonse.capWon ? "보증 한도" : `보증금 ${Math.round(P.jeonse.ratio * 100)}%`;
    const requiredCash2 = Math.max(0, deposit - maxLoan2);
    const monthly = maxLoan2 * (s.loanRateCalc / 100) / 12 + (Number(rent) || 0);
    return {
      dealType,
      maxLoan: maxLoan2,
      binding: binding2,
      requiredCash: requiredCash2,
      extra,
      equityWon: assetsWon,
      gap: requiredCash2 + extra.total - assetsWon,
      monthly,
      programs,
      loanLabel: dealType === "월세" ? "보증금 대출" : "전세대출",
      monthlyLabel: dealType === "월세" ? `월세 + 대출이자(${r2(s.loanRateCalc)}%)` : `월 이자(${r2(s.loanRateCalc)}%)`
    };
  }
  const dsrMonthly = Math.max(0, incomeMan * 1e4 * P.mortgage.dsr / 12 - (Number(s.existingDebtMonthly) || 0) * 1e4);
  const dsrLoan = loanFromMonthlyPayment(dsrMonthly, s.rate, P.mortgage.years);
  const ltvLoan = price * (s.firstTime ? P.mortgage.ltvFirst : P.mortgage.ltvRegular);
  const tierCap = priceTierCap(price);
  const maxLoan = Math.max(0, Math.min(dsrLoan, ltvLoan, tierCap));
  const binding = maxLoan === tierCap ? "가격구간 대출한도" : maxLoan === ltvLoan ? "LTV" : "DSR(소득)";
  const requiredCash = Math.max(0, price - maxLoan);
  return {
    dealType,
    maxLoan,
    binding,
    requiredCash,
    extra,
    equityWon: assetsWon,
    gap: requiredCash + extra.total - assetsWon,
    monthly: annuityPayment(maxLoan, s.loanRateCalc, P.mortgage.years),
    programs,
    loanLabel: dealType === "청약" ? "잔금 주담대" : "주담대",
    monthlyLabel: `월 상환(원리금균등 ${P.mortgage.years}년·${r2(s.loanRateCalc)}%)`,
    dsrLoan,
    ltvLoan,
    tierCap
  };
}
function giftTax(base) {
  if (base <= 0) return 0;
  const G = policy().gift, b = tierOf(G.brackets, base);
  return Math.max(0, base * b.rate - b.deduction) * (1 - G.filingCredit);
}
function earnedTaxBase(g) {
  const monthlyGross = g / 12;
  const W = policy().payroll;
  const np = Math.min(monthlyGross, W.npCapMonthlyWon) * W.npRate;
  const hi = monthlyGross * W.hiRate;
  const ltci = hi * W.ltciRatio;
  const ei = monthlyGross * W.eiRate;
  const insuranceAnnual = (np + hi + ltci + ei) * 12;
  let deduction;
  if (g <= 5e6) deduction = g * 0.7;
  else if (g <= 15e6) deduction = 35e5 + (g - 5e6) * 0.4;
  else if (g <= 45e6) deduction = 75e5 + (g - 15e6) * 0.15;
  else if (g <= 1e8) deduction = 12e6 + (g - 45e6) * 0.05;
  else deduction = 1475e4 + (g - 1e8) * 0.02;
  deduction = Math.min(deduction, 2e7);
  const earnedIncomeAmount = Math.max(0, g - deduction);
  const taxBase = Math.max(0, earnedIncomeAmount - 15e5 - insuranceAnnual);
  return { insuranceAnnual, taxBase };
}
function finalTaxFromBase(g, taxBase) {
  const IT = policy().incomeTax, b = tierOf(IT.brackets, taxBase);
  let incomeTax = Math.max(0, taxBase * b.rate - b.deduction);
  let credit = incomeTax <= 13e5 ? incomeTax * 0.55 : 715e3 + (incomeTax - 13e5) * 0.3;
  let creditCap = 0;
  IT.creditCaps.forEach((t) => {
    if (g > t.overWon || t.overWon === 0) creditCap = Math.max(t.min, t.base - (g - t.overWon) * t.slope);
  });
  credit = Math.min(credit, creditCap);
  incomeTax = Math.max(0, incomeTax - credit);
  return incomeTax * 1.1;
}
const marginalTaxRate = (grossAnnualWon) => {
  const g = Math.max(0, grossAnnualWon);
  const { taxBase } = earnedTaxBase(g);
  if (taxBase <= 0) return 0;
  const step = Math.min(1e6, taxBase);
  return (finalTaxFromBase(g, taxBase) - finalTaxFromBase(g, taxBase - step)) / step;
};
function estimateNetAnnual(grossAnnualWon) {
  const g = Math.max(0, grossAnnualWon);
  const { insuranceAnnual, taxBase } = earnedTaxBase(g);
  return g - insuranceAnnual - finalTaxFromBase(g, taxBase);
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
    let json;
    try {
      json = JSON.stringify(v);
      if (localStorage.getItem(k) === json) return false;
    } catch {
    }
    let urgent = false, fresh = true;
    try {
      fresh = localStorage.getItem(k) == null;
    } catch {
    }
    if (isMergeById(k)) {
      try {
        const prev = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(prev) && Array.isArray(v)) {
          const now = new Set(v.map((it) => it && it.id));
          const gone = prev.filter((it) => it && it.id != null && !now.has(it.id)).map((it) => it.id);
          tombs.add(k, gone, [...now]);
          urgent = gone.length > 0;
        }
      } catch {
      }
    }
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
    }
    cloud.queue(k, v, urgent, fresh);
    return true;
  }
};
const CLIENT_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const LOCAL_ONLY_KEYS = [
  "active-theme-v1",
  "realty-tab-v1",
  "saving-tab-v1",
  "wedding-tab-v1",
  "kids-tab-v1",
  "naver-map-key",
  "privacy-mode-v1",
  "push-token-v1",
  "realty-diag-seg-v1",
  "realty-loan-kind-v1",
  "realty-strat-seg-v1",
  "realty-apply-seg-v1",
  "wedding-vendor-seg-v1",
  "news-region-v1",
  "sync-marks-v1",
  "map-key-v1",
  "sync-tombs-v1",
  "sync-pending-v1",
  "advisor-notice-seen-v1",
  "advisor-brief-seen-v1",
  // 오늘 브리핑을 이 기기에서 봤는지 — 상대 기기가 보면 내 빨간 점이 꺼지면 안 된다
  // 검색 필터도 기기별 — 동기화하면 탭을 여는 것만으로 상대 기기의 저장 필터를 덮어쓴다 (REMOTE_EVT 구독도 없음)
  "cheongyak-filter-v1",
  "realty-filter-v1"
];
const syncable = (k) => typeof k === "string" && /-v\d+$/.test(k) && !LOCAL_ONLY_KEYS.includes(k);
const REMOTE_EVT = "cloud-remote-key";
const notifyRemoteKey = (k) => {
  try {
    window.dispatchEvent(new CustomEvent(REMOTE_EVT, { detail: k }));
  } catch {
  }
};
const PERSIST_EVT = "persist-local-key";
const CLOUD_STATUS_EVT = "cloud-status";
const DOC_SIZE_WARN_BYTES = 700 * 1024;
const MERGE_BY_ID_KEYS = [
  "ledger-entries-v1",
  "wedding-guests-v1",
  "ledger-fixed-v1",
  "saving-accounts-v1",
  "milestones-v1",
  "advisor-chat-v1",
  "advisor-skills-v1",
  "wedding-venue-tour-v1",
  "realty-watchlist-v1",
  "stock-holdings-v1",
  "wedding-mood-picks-v1",
  "wedding-mood-vendors-v1",
  "wedding-custom-events-v1",
  "wedding-refs-v1"
];
const isMergeById = (k) => MERGE_BY_ID_KEYS.includes(k) || /^notes-[a-z]+-v\d+$/.test(k);
const SYNC_MARKS_KEY = "sync-marks-v1";
const syncMarks = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_MARKS_KEY)) || {};
    } catch {
      return {};
    }
  },
  get(k) {
    return Number(this.read()[k] || 0);
  },
  // at: 업로드 "직렬화 시점" — ack 시점으로 찍으면 업로드 중에 만든 항목의 at이 마크보다 과거가 되어
  // 다음 병합에서 상대의 삭제로 오판되어 사라진다.
  set(keys, at) {
    const m = this.read(), t = at || Date.now();
    keys.forEach((k) => {
      m[k] = t;
    });
    try {
      localStorage.setItem(SYNC_MARKS_KEY, JSON.stringify(m));
    } catch {
    }
  }
};
const TOMBS_KEY = "sync-tombs-v1";
const TOMB_TTL = 30 * 864e5;
const tombs = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(TOMBS_KEY)) || {};
    } catch {
      return {};
    }
  },
  get(k) {
    return this.read()[k] || {};
  },
  // alive: 지금 목록에 다시 있는 id — 같은 id로 되살린 항목(확정 해제 후 재확정 등)은 툼스톤에서 뺀다
  add(k, ids, alive = []) {
    const all = this.read(), now = Date.now(), m = { ...all[k] || {} };
    const back = alive.filter((id) => id in m);
    if (!ids.length && !back.length) return;
    ids.forEach((id) => {
      m[id] = now;
    });
    back.forEach((id) => {
      delete m[id];
    });
    Object.keys(m).forEach((id) => {
      if (now - m[id] > TOMB_TTL) delete m[id];
    });
    all[k] = m;
    try {
      localStorage.setItem(TOMBS_KEY, JSON.stringify(all));
    } catch {
    }
  }
};
const UNSENT_KEY = "sync-pending-v1";
const unsent = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(UNSENT_KEY)) || {};
    } catch {
      return {};
    }
  },
  write(m) {
    try {
      localStorage.setItem(UNSENT_KEY, JSON.stringify(m));
    } catch {
    }
  },
  add(k) {
    const m = this.read();
    if (!m[k]) {
      m[k] = 1;
      this.write(m);
    }
  },
  remove(keys) {
    const m = this.read();
    keys.forEach((k) => {
      delete m[k];
    });
    this.write(m);
  }
};
const itemVer = (it) => Number(it && (it.u || it.at) || 0);
const TOMB_SKEW_MS = 2 * 6e4;
function mergeByIdArrays(mine, theirs, sinceMs, tombMap) {
  const mineById = new Map(mine.filter((it) => it && typeof it === "object" && it.id != null).map((it) => [it.id, it]));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  theirs.forEach((r) => {
    seen.add(r.id);
    const l = mineById.get(r.id);
    if (l) out.push(itemVer(l) > itemVer(r) ? l : r);
    else if (!tombMap[r.id] || itemVer(r) > tombMap[r.id] + TOMB_SKEW_MS) out.push(r);
  });
  mine.forEach((l) => {
    if (l && l.id != null && !seen.has(l.id) && Number(l.at || 0) > sinceMs) out.push(l);
  });
  return out;
}
function mergeByIdJson(localJson, remoteJson, sinceMs, k) {
  try {
    const mine = JSON.parse(localJson), theirs = JSON.parse(remoteJson);
    if (!Array.isArray(mine) || !Array.isArray(theirs)) return remoteJson;
    if (theirs.some((it) => !it || typeof it !== "object" || it.id == null)) return remoteJson;
    const merged = JSON.stringify(mergeByIdArrays(mine, theirs, sinceMs, tombs.get(k)));
    return merged === JSON.stringify(theirs) ? remoteJson : merged;
  } catch {
    return remoteJson;
  }
}
function applyRemoteValue(k, remoteJson) {
  const localJson = localStorage.getItem(k);
  if (localJson === remoteJson) return false;
  let next = remoteJson;
  if (isMergeById(k)) {
    if (localJson != null) {
      next = mergeByIdJson(localJson, remoteJson, syncMarks.get(k), k);
      if (next !== remoteJson) {
        try {
          cloud.queue(k, JSON.parse(next));
        } catch {
        }
      } else syncMarks.set([k]);
    } else {
      syncMarks.set([k]);
    }
  }
  if (next === localJson) return false;
  try {
    localStorage.setItem(k, next);
  } catch {
    return false;
  }
  notifyRemoteKey(k);
  return true;
}
function mergePendingRemote(k, remoteJson) {
  try {
    const mine = JSON.parse(localStorage.getItem(k)), theirs = JSON.parse(remoteJson);
    if (!Array.isArray(mine) || !Array.isArray(theirs)) return false;
    if (theirs.some((it) => !it || typeof it !== "object" || it.id == null)) return false;
    const merged = mergeByIdArrays(mine, theirs, syncMarks.get(k), tombs.get(k));
    const json = JSON.stringify(merged);
    if (json === localStorage.getItem(k)) return false;
    localStorage.setItem(k, json);
    cloud.queue(k, merged);
    notifyRemoteKey(k);
    return true;
  } catch {
    return false;
  }
}
function signOutAndWipe(pushDone) {
  if (cloud.enabled && !cloud.hydrated) {
    alert("아직 클라우드 동기화가 완료되지 않아, 지금 로그아웃하면 이 기기의 최근 기록이 사라질 수 있어요.\n잠시 후(새로고침으로 동기화 확인 후) 다시 시도해 주세요.");
    return;
  }
  clearTimeout(cloud.timer);
  const unsent2 = cloud.pending;
  if (cloud.enabled && Object.keys(unsent2).length) {
    cloud.pending = {};
    cloud.ref().set({ ...unsent2, _by: CLIENT_ID, _email: cloud.user && cloud.user.email || "", _at: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true }).then(() => signOutAndWipe(pushDone), () => {
      cloud.pending = { ...unsent2, ...cloud.pending };
      alert("저장되지 않은 변경을 올리지 못했어요. 네트워크를 확인하고 다시 로그아웃해 주세요.");
    });
    return;
  }
  const pushToken = store.get("push-token-v1", "");
  if (pushToken && !pushDone) {
    const req = authFetch("/api/push-register", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ token: pushToken, remove: true }) }).catch(() => {
    });
    Promise.race([req, new Promise((r) => setTimeout(r, 3e3))]).then(() => signOutAndWipe(true));
    return;
  }
  cloud.pending = {};
  cloud.preHydration = {};
  cloud.user = null;
  cloud.hydrated = false;
  try {
    Object.keys(localStorage).filter((k) => syncable(k) || k === "push-token-v1" || k === UNSENT_KEY).forEach((k) => localStorage.removeItem(k));
  } catch {
  }
  const done = () => {
    try {
      location.reload();
    } catch {
    }
  };
  try {
    firebase.auth().signOut().then(done, done);
  } catch {
    done();
  }
}
const cloud = {
  enabled: typeof window !== "undefined" && !!(window.FIREBASE_CONFIG && window.firebase),
  db: null,
  user: null,
  pending: {},
  timer: null,
  started: false,
  // 클라우드 상태를 성공적으로 읽어온 뒤에만 업로드를 허용한다.
  // usePersist는 마운트 시 무조건 store.set을 호출하므로, 읽기가 실패한 채 앱이 뜨면
  // 기본값이 그대로 올라가 부부 데이터를 덮어쓴다(상대 기기까지 전파).
  hydrated: false,
  init() {
    if (!this.enabled || this.started) return;
    this.started = true;
    firebase.initializeApp(window.FIREBASE_CONFIG);
    this.db = firebase.firestore();
    const now = () => {
      if (Object.keys(this.pending).length) {
        clearTimeout(this.timer);
        this.flush();
      }
    };
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") now();
    });
  },
  ref() {
    return this.db.collection("households").doc("main");
  },
  urgentFlush: false,
  // hydration 전 변경 키 — 동기화 완료 후 현재 로컬 값을 올린다. "u" = 기존 값을 고친 것(로컬 우선), "d" = 마운트 기본값(원격 우선)
  preHydration: {},
  queue(k, v, urgent, fresh) {
    if (!this.enabled || !this.user || !syncable(k)) return;
    if (!fresh) unsent.add(k);
    if (!this.hydrated) {
      this.preHydration[k] = this.preHydration[k] === "u" || !fresh ? "u" : "d";
      return;
    }
    this.pending[k] = JSON.stringify(v);
    this.urgentFlush = this.urgentFlush || !!urgent;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.urgentFlush ? 80 : 800);
  },
  retries: 0,
  // 연속 실패 횟수 — 지수 백오프(5s→10s→20s… 최대 5분)
  status: { error: null, permanent: false, sizeBytes: 0 },
  // Root 상단 배너용 (CLOUD_STATUS_EVT 로 알림)
  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    try {
      window.dispatchEvent(new CustomEvent(CLOUD_STATUS_EVT));
    } catch {
    }
  },
  // 문서 전체 크기의 근사치(UTF-8 바이트) — 동기화 대상 키 전부가 households/main 한 문서에 들어가므로
  // localStorage 의 해당 키들을 합산하면 된다. 문서 분리는 별도 작업, 여기서는 700KB 초과 경고만 낸다.
  approxDocBytes() {
    let n = 0;
    try {
      const enc = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!syncable(k)) continue;
        const v = localStorage.getItem(k) || "";
        n += (enc ? enc.encode(v).length : v.length) + k.length + 32;
      }
    } catch {
    }
    return n;
  },
  flush() {
    this.urgentFlush = false;
    const keys = Object.keys(this.pending);
    if (!keys.length) return;
    const sentAt = Date.now();
    const sent = this.pending;
    this.pending = {};
    const batch = { ...sent, _by: CLIENT_ID, _email: this.user && this.user.email || "", _at: (/* @__PURE__ */ new Date()).toISOString() };
    this.ref().set(batch, { merge: true }).then(() => {
      syncMarks.set(keys, sentAt);
      unsent.remove(keys.filter((k) => !(k in this.pending)));
      this.retries = 0;
      const sizeBytes = this.approxDocBytes();
      if (this.status.error || sizeBytes !== this.status.sizeBytes) this.setStatus({ error: null, permanent: false, sizeBytes });
    }).catch((e) => {
      const code = String(e && e.code || "");
      this.pending = { ...sent, ...this.pending };
      this.retries += 1;
      clearTimeout(this.timer);
      const permanent = /permission-denied|invalid-argument/.test(code);
      this.setStatus({ error: code || "unknown", permanent, sizeBytes: this.approxDocBytes() });
      if (permanent) {
        console.error("클라우드 저장 실패(영구) — 재시도 중단:", code, e && e.message);
        return;
      }
      const delay = Math.min(5e3 * 2 ** (this.retries - 1), 5 * 60 * 1e3);
      console.warn(`클라우드 저장 실패 — ${Math.round(delay / 1e3)}초 후 재시도(${this.retries}회):`, code, e && e.message);
      this.timer = setTimeout(() => this.flush(), delay);
    });
  },
  // hydration 완료 후: 그 전에 사용자가 만진 키의 "현재 로컬 값"(원격 병합 반영본)을 업로드
  flushPreHydration() {
    const keys = Object.keys(this.preHydration);
    this.preHydration = {};
    keys.forEach((k) => {
      try {
        const v = localStorage.getItem(k);
        if (v != null) this.queue(k, JSON.parse(v));
      } catch {
      }
    });
  },
  // 원격 변경 → localStorage 반영 후 onRemote 콜백 (앱 리렌더)
  subscribe(onRemote) {
    if (!this.enabled || !this.user) return () => {
    };
    return this.ref().onSnapshot((snap) => {
      const d = snap.data();
      if (!d) return;
      if (!this.hydrated) {
        if (snap.metadata && snap.metadata.fromCache) return;
        if (this.hydrate(d)) onRemote();
        return;
      }
      let changed = false;
      Object.keys(d).forEach((k) => {
        if (!syncable(k)) return;
        if (k in this.pending) {
          if (isMergeById(k) && mergePendingRemote(k, d[k])) changed = true;
          return;
        }
        if (applyRemoteValue(k, d[k])) changed = true;
      });
      if (changed) onRemote();
    }, (e) => console.warn("클라우드 수신 오류:", e && e.message));
  },
  // 원격 문서 d를 로컬에 반영하고 쓰기를 연다 — pullOnce와 subscribe(첫 pullOnce 실패 세션)가 같이 쓴다.
  // 로컬 우선 키: 못 올린 키(지난 실행 포함)·동기화 전에 고친 키 — 원격 옛 값으로 덮지 않고 로컬을 올린다(병합 키는 합친다).
  hydrate(d) {
    Object.keys(unsent.read()).forEach((k) => {
      this.preHydration[k] = "u";
    });
    this.hydrated = true;
    let changed = false;
    Object.keys(d).forEach((k) => {
      if (!syncable(k)) return;
      if ((k in this.pending || this.preHydration[k] === "u") && localStorage.getItem(k) != null) {
        if (isMergeById(k) && mergePendingRemote(k, d[k])) changed = true;
        return;
      }
      if (applyRemoteValue(k, d[k])) changed = true;
    });
    this.flushPreHydration();
    this.setStatus({ sizeBytes: this.approxDocBytes() });
    return changed;
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
          if (syncable(k)) up[k] = localStorage.getItem(k);
        }
        await this.ref().set(up, { merge: true });
        syncMarks.set(Object.keys(up).filter((k) => !k.startsWith("_")));
        unsent.remove(Object.keys(up));
        this.hydrated = true;
        this.flushPreHydration();
        this.setStatus({ sizeBytes: this.approxDocBytes() });
        return false;
      }
      return this.hydrate(d);
    } catch (e) {
      console.warn("초기 동기화 실패:", e && e.message);
      return false;
    }
  }
};
function usePersist(key, def) {
  const [v, setV] = useState(() => store.get(key, def));
  const self = useRef(false);
  useEffect(() => {
    if (store.set(key, v)) {
      self.current = true;
      try {
        window.dispatchEvent(new CustomEvent(PERSIST_EVT, { detail: key }));
      } catch {
      }
      self.current = false;
    }
  }, [key, v]);
  useEffect(() => {
    const h = (e) => {
      if (e.detail === key && !self.current) setV(store.get(key, def));
    };
    window.addEventListener(REMOTE_EVT, h);
    window.addEventListener(PERSIST_EVT, h);
    return () => {
      window.removeEventListener(REMOTE_EVT, h);
      window.removeEventListener(PERSIST_EVT, h);
    };
  }, [key]);
  return [v, setV];
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const api = (path) => (typeof window !== "undefined" && window.API_BASE || "") + path;
const forceUrl = (path, force) => force ? `${path}${path.includes("?") ? "&" : "?"}force=1&_=${Date.now()}` : path;
const forceInit = (force) => force ? { cache: "no-store" } : void 0;
const fetchApi = (path, force) => fetch(api(forceUrl(path, force)), forceInit(force));
async function authFetch(path, init = {}) {
  const headers = { ...init.headers || {} };
  try {
    const u = window.firebase && firebase.auth && firebase.auth().currentUser;
    if (u) headers.Authorization = "Bearer " + await u.getIdToken();
  } catch {
  }
  return fetch(api(path), { ...init, headers });
}
const authFetchApi = (path, force) => authFetch(forceUrl(path, force), forceInit(force));
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
const fetchMemo = {};
function memoLoad(key, fn, force) {
  if (force || !fetchMemo[key]) {
    fetchMemo[key] = fn().then((r) => {
      if (!r || r.source === "sample") fetchMemo[key] = null;
      return r;
    }).catch((e) => {
      fetchMemo[key] = null;
      throw e;
    });
  }
  return fetchMemo[key];
}
function loadCheongyak(force) {
  return memoLoad("cheongyak", async () => {
    try {
      const r = await authFetchApi("/api/cheongyak", force);
      if (r.ok) {
        const j = await r.json();
        if (j.items && j.items.length) return { source: "live", items: j.items };
      }
    } catch {
    }
    return { source: "sample", items: (window.SAMPLE_DATA || {}).cheongyak || [] };
  }, force);
}
async function loadNews(q) {
  try {
    const r = await authFetch(`/api/news?q=${encodeURIComponent(q)}&_=${Date.now()}`);
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
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder`;
    s.onload = () => resolve();
    s.onerror = () => {
      naverPromise = null;
      reject(new Error("load_failed"));
    };
    document.head.appendChild(s);
  });
  return naverPromise;
}
const geoCache = {};
async function naverGeocoderReady() {
  for (let i = 0; i < 20; i++) {
    if (window.naver && naver.maps && naver.maps.Service && naver.maps.Service.geocode) return true;
    if (!(window.naver && naver.maps)) return false;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
let naverGeocodeDenied = false;
async function geocodeNaverOnce(q) {
  if (!q || naverGeocodeDenied || !await naverGeocoderReady()) return null;
  return new Promise((resolve) => {
    try {
      naver.maps.Service.geocode({ query: q }, (status, res) => {
        if (status === 500 || status === 401 || status === 403) {
          naverGeocodeDenied = true;
          console.warn("naver_geocode_denied:", status, "— NCP 콘솔 Application에서 Geocoding을 켜야 해요");
        }
        const a = res && res.v2 && res.v2.addresses && res.v2.addresses[0];
        resolve(a ? { lat: Number(a.y), lng: Number(a.x) } : null);
      });
    } catch {
      resolve(null);
    }
  });
}
function geoVariants(q) {
  const out = [];
  const push = (v, approx) => {
    v = String(v || "").replace(/\s+/g, " ").trim();
    if (v && !out.some((x) => x.q === v)) out.push({ q: v, approx });
  };
  push(q, false);
  const noBunji = q.replace(/(\d+[\d-]*)\s*번지.*$/, "$1");
  push(noBunji, false);
  push(q.replace(/\s*(?:일원|번지|외\s*\d+\s*필지|공공주택지구|도시개발|택지개발|지구\s*내).*$/, ""), true);
  push(noBunji.replace(/\s+\d[\d-]*\s*$/, ""), true);
  const gu = q.match(/^\S+(?:특별시|광역시|특별자치시|특별자치도|도|시)\s+\S+?(?:시|군|구)(?:\s+\S+?(?:구|군))?/);
  if (gu) push(gu[0], true);
  return out;
}
async function geocodeAddr(addr) {
  const q = String(addr || "").trim();
  if (!q) return null;
  if (geoCache[q]) return geoCache[q];
  const vs = geoVariants(q);
  for (const v of vs) {
    const c = await geocodeNaverOnce(v.q);
    if (c) {
      const out = { ...c, approx: v.approx };
      if (!v.approx) geoCache[q] = out;
      return out;
    }
  }
  try {
    const r = await authFetch(`/api/geocode?q=${encodeURIComponent(q)}`);
    if (r.ok) {
      const c = await r.json();
      if (c && c.lat) return { lat: c.lat, lng: c.lng, approx: true };
    }
  } catch {
  }
  console.warn("geocode_failed:", q);
  return null;
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
  camera: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "13", r: "4" })),
  brush: /* @__PURE__ */ React.createElement("path", { d: "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" }),
  eyeOff: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }), /* @__PURE__ */ React.createElement("line", { x1: "1", y1: "1", x2: "23", y2: "23" })),
  users: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), /* @__PURE__ */ React.createElement("circle", { cx: "9", cy: "7", r: "4" }), /* @__PURE__ */ React.createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }), /* @__PURE__ */ React.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
  bell: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }), /* @__PURE__ */ React.createElement("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })),
  wallet: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "5", width: "20", height: "15", rx: "2" }), /* @__PURE__ */ React.createElement("path", { d: "M2 10h20" }), /* @__PURE__ */ React.createElement("circle", { cx: "17", cy: "15", r: "1.5" })),
  news: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M2 6v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "9", x2: "12", y2: "9" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "13", x2: "18", y2: "13" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "17", x2: "14", y2: "17" }), /* @__PURE__ */ React.createElement("rect", { x: "15", y: "8", width: "3", height: "2" })),
  chat: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "10", x2: "16", y2: "10" }), /* @__PURE__ */ React.createElement("line", { x1: "8", y1: "14", x2: "13", y2: "14" })),
  sparkle: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" }), /* @__PURE__ */ React.createElement("path", { d: "M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" })),
  x: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), /* @__PURE__ */ React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })),
  send: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M22 2L11 13" }), /* @__PURE__ */ React.createElement("path", { d: "M22 2l-7 20-4-9-9-4z" })),
  target: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "9" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "5" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "12", r: "1" }))
};
function Icon({ name, size = 16, className = "", fill = "none" }) {
  return /* @__PURE__ */ React.createElement("svg", { className, width: size, height: size, viewBox: "0 0 24 24", fill, stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, ICONS[name]);
}
const THEMES = [
  { id: "realty", label: "부동산", icon: "home", color: "#0A0A0A", desc: "진단 · 전략 · 대출 · 청약" },
  { id: "saving", label: "돈 모으기", icon: "trending", color: "#6E6E6E", desc: "가계부 · ISA · 연금저축 · IRP · 증여 절세" },
  { id: "wedding", label: "결혼식", icon: "heart", color: "#BDBDBD", desc: "예식 비용 · 체크리스트 · 신혼여행" },
  { id: "kids", hidden: true, label: "자녀", icon: "child", color: "#8F8F8F", desc: "연령별 할 일 · 교육 로드맵 · 학군" }
];
const themeOf = (id) => THEMES.find((t) => t.id === id);
const REALTY_TABS = [
  { id: "diag", label: "진단·대출", icon: "alert" },
  { id: "watch", label: "관심 매물", icon: "pin" },
  { id: "apply", label: "청약·공공", icon: "building" },
  { id: "strategy", label: "전략·정보", icon: "trending" },
  { id: "plan", label: "플랜", icon: "calendar" }
];
function SegRow({ options, value, onChange }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mb-5 flex items-center gap-1.5 flex-wrap" }, options.map(([id, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: id,
      onClick: () => onChange(id),
      className: `h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${value === id ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`
    },
    label
  )));
}
const TARGETS = [
  { key: "sale84", label: "매매 · 84㎡(34평)", price: 26e8, note: "과천자이·써밋 등 준신축 실거래 평균" },
  { key: "sale59", label: "매매 · 59㎡(25평)", price: 2e9, note: "센트럴파크 푸르지오써밋 등 실거래 기준" },
  { key: "sub84", label: "청약(일반분양) · 84㎡", price: 222e7, note: "과천 재건축 신규 분양 가정 — 4단지(2024.10 분양) 84㎡ 22.2~22.6억 기준" },
  { key: "jeonse59", label: "전세 · 59㎡ (대장주)", price: 88e7, note: "위버필드·자이 등 실거래 평균" },
  { key: "jeonse59budget", label: "전세 · 59㎡ (절충)", price: 64e7, note: "래미안슈르 등 연식 있는 단지" }
];
const STRATEGIES = [
  { title: "청약 (신생아·생애최초·일반공급)", badge: "1순위", tone: "good", points: [
    "공공택지(지식정보타운·과천지구·주암)는 분양가상한제가 적용돼 시세보다 크게 싸요. 재건축(민간택지)은 상한제가 없고 HUG 분양가 심사 수준으로 정해져요.",
    "민영 신생아 특공이 2026.6.15에 생겼어요(공공은 2024.3부터). 혼인 기간은 안 따져요. 모집공고일 기준 만 2세 미만 자녀(태아·입양 포함)가 있고, 무주택·1순위여야 해요. 투기과열지구에서는 세대주만 1순위예요.",
    "투기과열지구(정부가 지정한 과열 지역, 과천 포함)에서 59㎡ 이하 일반공급은 60%를 추첨제(가점과 무관하게 추첨)로 뽑아요. 가점이 낮은 신혼부부에게 현실적인 경로예요. 당첨되면 10년간 다시 당첨될 수 없어요.",
    "소득이 특공 기준을 넘으면 일반공급으로 가요. 일반공급은 소득 기준이 없고, 가점제(무주택기간·부양가족·통장 기간 점수 순)와 추첨제로 뽑아요.",
    "단점: 당첨 여부를 알 수 없고, 입주까지 2~4년 걸려요."
  ] },
  { title: "매매", badge: "자기자본 부담 큼", tone: "warn", points: [
    "바로 입주할 수 있고, 원하는 단지·평형을 직접 고를 수 있어요.",
    "하드캡(집값 구간별 주담대 최대 한도, 2025.10.16 시행)은 소득과 관계없이 적용돼요.",
    "과천 84㎡는 자기자본(대출 없이 우리 돈으로 내는 금액)이 20억 이상 필요할 수 있어요.",
    "대안: 작은 평형이나 재건축을 기다리는 단지로 눈높이를 조정해요."
  ] },
  { title: "전세 → 매매/청약 갈아타기", badge: "현재 추천 경로", tone: "good", points: [
    "필요한 자기자본이 적어 지금 가진 현금으로 할 수 있어요.",
    "무주택 상태를 유지하니 청약 가점(무주택기간)이 계속 쌓여요.",
    "지금(2026.9)은 집이 있는 사람이 수도권·규제지역에서 받는 전세대출만 이자가 DSR(연소득 대비 연간 대출 상환액 비율)에 들어가요. 정부는 무주택자까지 단계적으로 넓히는 걸 검토 중이라, 그러면 갈아탈 때 대출 한도가 줄어요.",
    "전세금이 올라도 우리 자산이 늘지는 않는다는 점(기회비용)을 고려해요."
  ] }
];
const BENEFITS = [
  { title: "신혼특공(민영) — 자산기준 경로", fit: "해당 가능성 높음", tone: "good", body: "부부 월소득이 기준(도시근로자 월평균소득의 160%)을 넘어도, 세대 부동산 가액 합계가 3.31억 이하면 추첨 물량(특공 물량 중 소득을 보지 않고 추첨하는 몫)에 신청할 수 있어요. 두 분은 무주택이라 부동산 가액이 0원이에요. 맞벌이라도 한 사람 소득이 기준의 140%를 넘으면 안 돼요.", link: "https://www.applyhome.co.kr", label: "청약홈 바로가기" },
  { title: "청약 일반공급(가점제·추첨제)", fit: "소득 무관 · 핵심 전략", tone: "good", body: "일반공급은 소득 기준이 없어요. 가점제는 무주택기간·부양가족 수·통장 가입기간 점수가 높은 순으로, 추첨제는 점수와 관계없이 추첨으로 뽑아요. 특공 소득 기준과 상관없이 계속 도전할 수 있어요.", link: "https://www.applyhome.co.kr", label: "청약캘린더 보기" },
  { title: "신생아 특별공급(민영, 2026.6.15 신설)", fit: "자녀 계획 시 유리", tone: "neutral", body: "민영 신생아 특공이 2026.6.15에 생겼어요(공공은 2024.3부터). 혼인 기간은 안 따져요. 모집공고일 기준 만 2세 미만 자녀(태아·입양 포함)가 있고, 무주택·1순위여야 해요. 투기과열지구에서는 세대주만 1순위예요. 지금은 해당하지 않지만 임신하거나 출산하면 챙겨요.", link: "https://www.myhome.go.kr", label: "마이홈포털 안내" },
  { title: "생애최초 취득세 감면", fit: "과천엔 대부분 해당 없음", tone: "warn", body: "12억 이하 주택은 최대 200만(60㎡·수도권 6억 이하 소형은 300만) 감면돼요. 2028.12.31까지 산 집이 대상이에요. 과천 매물은 대부분 15억을 넘어 받기 어려워요.", link: "https://www.myhome.go.kr", label: "관련 안내" },
  { title: "신생아 특례 디딤돌·버팀목대출", fit: "소득은 OK, 가격상한에 막힘", tone: "warn", body: "소득 요건(맞벌이 부부 연소득 합산 2억 이하, 한 사람 소득 1.3억 이하)은 맞아요. 하지만 집값 9억 이하·전세보증금 5억 이하(보증금 5억은 수도권 기준)인 집만 되어서 과천에는 쓰기 어려워요.", link: "https://nhuf.molit.go.kr", label: "주택도시기금 포털" },
  { title: "보금자리론 · 일반 디딤돌·버팀목", fit: "과천엔 해당 없음", tone: "bad", body: "보금자리론은 6억 이하 주택만 돼요. 일반 디딤돌·버팀목은 부부 연소득 합산 상한이 5천만(일반 버팀목)~8,500만(신혼 디딤돌)이라 우리 조건으로는 쓰기 어려워요.", link: "https://www.hf.go.kr", label: "한국주택금융공사" }
];
const TIMELINE = [
  { phase: "Phase 1 · 0~6개월", title: "기반 다지기", items: ["청약통장 가입기간·납입횟수 점검", "부부합산 소득분위 정확히 계산 → 특공/일반공급 경로 확정", "혼인신고일 확정(특공 7년 요건 기산점)", "연금저축·IRP·ISA 계좌 개설, 자동이체 세팅"] },
  { phase: "Phase 2 · 6개월~1.5년", title: "전세 진입 + 자산 축적", items: ["과천 전세(59㎡ 기준 6.4억~8.8억선) 계약 실행", "과천 신규 공급 단지 청약 일정 상시 모니터링", "ISA 목적자금 축적 시작"] },
  { phase: "Phase 3 · 1.5~3년", title: "전세 만기 임박, 재평가", items: ["청약 당첨 여부 확인, 미당첨 시 매매 갈아타기 재검토", "자기자본 갭 축소 추이 점검, 저축 속도 재조정"] },
  { phase: "Phase 4 · 3~5년+", title: "입주 및 안정화", items: ["입주 또는 매매 실행, 대출 상환계획 확정", "자산 포트폴리오 재조정"] }
];
const CHECKLIST_INIT = [
  { cat: "청약 준비", items: ["청약통장 가입기간·납입횟수 확인", "혼인관계증명서 준비", "부부합산 소득분위 정확히 산출", "자녀 계획 시 신생아특공 요건 확인", "통장 기간이 긴 쪽을 세대주로 정리 (투기과열 1순위는 세대주만)", "청약통장 월 25만으로 납입액 상향 (공공분양 납입인정금액 순)"] },
  { cat: "대출/자금", items: ["기존 신용대출·할부 정리로 DSR 여유 확보", "정책 모기지 소득·자산 요건 확인", "고정 vs 변동금리 비교", "비상자금(생활비 3~6개월분) 별도 확보"] },
  { cat: "정보 모니터링", items: ["청약홈 과천 지역 공급 일정 알림 설정", "LH청약플러스 공고 확인", "규제지역 지정 현황 반기 점검", "토지거래허가구역 연장 여부 확인 (현재 2026.12.31까지)", "도시근로자 월평균소득 고시 갱신 반영"] }
];
const CHECK_NOTES = {
  "토지거래허가구역 연장 여부 확인 (현재 2026.12.31까지)": "서울·경기 12곳 2026.12.31, 동탄구·기흥구·구리 2027.12.31까지예요."
};
const BANK_LOANS = [
  { bank: "케이뱅크", product: "아파트담보대출", rateMin: 4.05, rateMax: 7.5, rateType: "변동(신잔액 코픽스) · 주기형 5년", feature: "100% 비대면 · 전자계약 시 1금융권 변동 최저 수준 · 중도상환수수료 면제", link: "https://www.kbanknow.com" },
  { bank: "하나은행", product: "하나원큐 아파트론", rateMin: 4.1, rateMax: 7, rateType: "변동(코픽스) · 혼합형 · 주기형", feature: "모바일 완결형 비대면 주담대 · 전자약정 우대금리", link: "https://www.kebhana.com" },
  { bank: "KB국민은행", product: "KB주택담보대출", rateMin: 4.2, rateMax: 7.2, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "급여이체·카드실적 등 거래실적 우대 최대 약 1%p", link: "https://obank.kbstar.com" },
  { bank: "신한은행", product: "신한주택대출", rateMin: 4.2, rateMax: 7.1, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "SOL 비대면 신청 우대 · 3년 경과 후 중도상환수수료 면제", link: "https://bank.shinhan.com" },
  { bank: "우리은행", product: "우리WON주택대출", rateMin: 4.2, rateMax: 7.2, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "WON뱅킹 비대면 · 부수거래 없이도 기본금리 경쟁력", link: "https://spot.wooribank.com" },
  { bank: "NH농협은행", product: "NH주택담보대출", rateMin: 4.3, rateMax: 7.3, rateType: "변동(코픽스) · 혼합형 · 주기형", feature: "올원뱅크 비대면 우대 · 급여이체·NH카드 실적 우대", link: "https://banking.nonghyup.com" },
  { bank: "IBK기업은행", product: "IBK주택담보대출", rateMin: 4.3, rateMax: 6.8, rateType: "변동(코픽스) · 혼합형", feature: "i-ONE뱅크 비대면 · 상대적으로 안정적인 금리 운용", link: "https://mybank.ibk.co.kr" },
  { bank: "카카오뱅크", product: "주택담보대출", rateMin: 4.8, rateMax: 6.6, rateType: "변동(코픽스 6개월) · 혼합형 · 주기형", feature: "챗봇 100% 비대면 · 중도상환수수료 전액 면제", link: "https://www.kakaobank.com/products/mortgageLoan" }
];
const ACCOUNTS_DEFAULT = [
  { id: "a1", owner: "본인", type: "ISA", balance: 0, paid: 0, goal: 2e3 },
  { id: "a2", owner: "배우자", type: "ISA", balance: 0, paid: 0, goal: 2e3 },
  { id: "a3", owner: "본인", type: "연금저축", balance: 0, paid: 0, goal: 600 },
  { id: "a4", owner: "배우자", type: "연금저축", balance: 0, paid: 0, goal: 600 },
  { id: "a5", owner: "본인", type: "IRP", balance: 0, paid: 0, goal: 300 },
  { id: "a6", owner: "배우자", type: "IRP", balance: 0, paid: 0, goal: 300 }
];
const ACCOUNT_TYPES = ["ISA", "연금저축", "IRP", "청약통장", "예적금", "기타"];
const WEDDING_HALL_CAT = "예식장";
const WEDDING_BUDGET_DEFAULT = [
  { id: "wb1", cat: "상견례·양가", sub: "상견례", name: "상견례 식사(6~8인)", budget: 60, note: "인당 5~10만, 평균 7~8만. 한정식 룸" },
  { id: "wb2", cat: "상견례·양가", sub: "상견례", name: "양가 인사선물", budget: 40, note: "양가 합산 20~40만+" },
  { id: "wb3", cat: "상견례·양가", sub: "상견례", name: "첫인사 방문 선물", budget: 20, note: "과일·한우·건강식품 등. 추정" },
  { id: "wb4", cat: "상견례·양가", sub: "혼주 준비", name: "혼주 한복(2인)", budget: 80, note: "대여 60~80, 맞춤 대여 50~70/벌, 구매 150+" },
  { id: "wb5", cat: "상견례·양가", sub: "혼주 준비", name: "혼주 정장(2인)", budget: 100, note: "70~200. 아버님 양복" },
  { id: "wb6", cat: "상견례·양가", sub: "혼주 준비", name: "혼주 헤어메이크업(4인)", budget: 45, note: "35~80. 양가 어머님 위주" },
  { id: "wb7", cat: "상견례·양가", sub: "혼주 준비", name: "형제·자매 헤어메이크업", budget: 30, note: "후기 기준 약 30" },
  { id: "wb8", cat: "상견례·양가", sub: "혼주 준비", name: "양가 아버님 넥타이·구두 등", budget: 20, note: "자주 누락되는 항목. 추정" },
  { id: "wb9", cat: "예식장", sub: "기본", name: "대관료", budget: 550, note: "소비자원 2025 서울(강남 외) 중간값 — 전국 300, 강남 690" },
  { id: "wb10", cat: "예식장", sub: "기본", name: "식대(보증 200명)", budget: 1400, note: "인당 7만 가정(서울 식장 6~12만) — 전국 중간값 5.8만, 강남 8.5만" },
  { id: "wb11", cat: "예식장", sub: "기본", name: "보증인원 초과 식대", budget: 100, note: "초과분 인당 식대 추가. 추정" },
  { id: "wb12", cat: "예식장", sub: "옵션·연출", name: "생화 꽃장식 업그레이드", budget: 225, note: "소비자원 중간값(소비자원 월별 조사값 — 조사 월 확인 필요). 조화면 0~50" },
  { id: "wb13", cat: "예식장", sub: "옵션·연출", name: "주류·음료 추가", budget: 50, note: "홀마다 포함 여부 다름. 추정" },
  { id: "wb14", cat: "예식장", sub: "옵션·연출", name: "연출비(특수효과·조명)", budget: 30, note: "드라이아이스·버블 등. 추정" },
  { id: "wb15", cat: "예식장", sub: "옵션·연출", name: "폐백실 이용료", budget: 30, note: "홀 옵션. 추정" },
  { id: "wb16", cat: "예식장", sub: "소품·영상", name: "식전·성장영상 제작", budget: 15, note: "셀프면 0, 업체 10~30. 추정" },
  { id: "wb17", cat: "예식장", sub: "소품·영상", name: "포토테이블 액자·소품", budget: 10, note: "액자 인화·꽃·장식. 추정" },
  { id: "wb18", cat: "예식장", sub: "소품·영상", name: "방명록·웰컴보드·서명판", budget: 10, note: "소품. 후기 10만 전후" },
  { id: "wb19", cat: "스드메", sub: "기본 패키지", name: "스튜디오 촬영", budget: 135, note: "소비자원 중간값, 개별 150~250" },
  { id: "wb20", cat: "스드메", sub: "기본 패키지", name: "드레스(촬영+본식)", budget: 155, note: "소비자원 중간값(4벌 기준)" },
  { id: "wb21", cat: "스드메", sub: "기본 패키지", name: "메이크업(촬영+본식)", budget: 76, note: "소비자원 중간값, 원장급 추가" },
  { id: "wb22", cat: "스드메", sub: "추가금", name: "드레스 라인 추가금", budget: 80, note: "프리미엄 0~50, 수입 100~200+" },
  { id: "wb23", cat: "스드메", sub: "추가금", name: "드레스 피팅비(샵 투어)", budget: 15, note: "샵당 5~7만. 지정계약 시 생략" },
  { id: "wb24", cat: "스드메", sub: "추가금", name: "촬영 원본 파일", budget: 22, note: "소비자원 중간값(소비자원 월별 조사값 — 조사 월 확인 필요), 20~50" },
  { id: "wb25", cat: "스드메", sub: "추가금", name: "수정본 추가 리터칭", budget: 15, note: "장당 1~3만. 추정" },
  { id: "wb26", cat: "스드메", sub: "옵션", name: "앨범·액자 업그레이드", budget: 30, note: "페이지·액자 추가. 추정" },
  { id: "wb27", cat: "스드메", sub: "추가금", name: "작가·실장 지정비", budget: 20, note: "대표/실장 지정 10~33. 추정" },
  { id: "wb28", cat: "스드메", sub: "추가금", name: "얼리스타트비", budget: 10, note: "8시 이전 시작 5~20" },
  { id: "wb29", cat: "스드메", sub: "추가금", name: "헤어 변형비", budget: 20, note: "촬영·본식 변형 10~30, 과하면 60+" },
  { id: "wb30", cat: "스드메", sub: "추가금", name: "촬영일 드레스 헬퍼비", budget: 20, note: "본식과 별도 청구하는 곳 있음" },
  { id: "wb31", cat: "스드메", sub: "옵션", name: "2부(애프터) 드레스", budget: 38, note: "후기 38만, 30~60" },
  { id: "wb32", cat: "스드메", sub: "옵션", name: "퍼스트웨어(새 드레스)", budget: 200, note: "소비자원 중간값(소비자원 월별 조사값 — 조사 월 확인 필요). 선택 시만" },
  { id: "wb33", cat: "스드메", sub: "옵션", name: "신부 웨딩슈즈·액세서리", budget: 20, note: "샵 포함 여부 확인. 추정" },
  { id: "wb34", cat: "스냅·영상", sub: "본식 기록", name: "본식스냅", budget: 150, note: "65~200, 2인 데이터형 120~150" },
  { id: "wb35", cat: "스냅·영상", sub: "본식 기록", name: "본식 DVD·영상", budget: 50, note: "1인2캠 30~50, 프리미엄 100+" },
  { id: "wb36", cat: "스냅·영상", sub: "본식 기록", name: "아이폰스냅", budget: 25, note: "18~30. 후기 다수" },
  { id: "wb37", cat: "스냅·영상", sub: "본식 기록", name: "추가 촬영자(서브작가)", budget: 50, note: "업체 견적 기준 1인 50" },
  { id: "wb38", cat: "스냅·영상", sub: "추가 촬영", name: "야외·셀프웨딩촬영", budget: 70, note: "30~150, 스튜디오 대체 가능. 추정" },
  { id: "wb39", cat: "스냅·영상", sub: "추가 촬영", name: "가봉스냅", budget: 20, note: "10~30. 추정" },
  { id: "wb40", cat: "스냅·영상", sub: "추가 촬영", name: "폐백 촬영", budget: 20, note: "스냅 옵션. 추정" },
  { id: "wb41", cat: "스냅·영상", sub: "본식 기록", name: "본식 앨범 추가", budget: 20, note: "데이터형이면 생략. 추정" },
  { id: "wb42", cat: "예물·예복", sub: "예물", name: "웨딩밴드(커플)", budget: 200, note: "100~350, 브랜드 500~800" },
  { id: "wb43", cat: "예물·예복", sub: "예물", name: "예물 다이아 반지", budget: 300, note: "랩다이아면 대폭 저렴. 추정" },
  { id: "wb44", cat: "예물·예복", sub: "예물", name: "예물 시계", budget: 300, note: "생략 추세. 브랜드별 편차 큼. 추정" },
  { id: "wb45", cat: "예물·예복", sub: "예물", name: "예물 가방", budget: 300, note: "명품백. 생략 추세. 추정" },
  { id: "wb46", cat: "예물·예복", sub: "프러포즈", name: "프러포즈(호텔·꽃)", budget: 50, note: "호텔 1박+이벤트. 추정" },
  { id: "wb47", cat: "예물·예복", sub: "예복", name: "신랑 예복(맞춤정장)", budget: 100, note: "국내원단 80, 이태리 100, 영국 180+" },
  { id: "wb48", cat: "예물·예복", sub: "예복", name: "신랑 구두·셔츠·타이", budget: 20, note: "구두 3~20. 후기" },
  { id: "wb49", cat: "예물·예복", sub: "예복", name: "신랑신부 한복", budget: 40, note: "대여 기준, 혼주 묶음 할인. 추정" },
  { id: "wb50", cat: "예물·예복", sub: "예물", name: "리세팅·수선비", budget: 20, note: "기존 반지 리세팅·사이즈. 추정" },
  { id: "wb51", cat: "예단·폐백·이바지·함", sub: "예단", name: "현금 예단", budget: 700, note: "300~1000. 듀오 2026 예단 평균 1030" },
  { id: "wb52", cat: "예단·폐백·이바지·함", sub: "예단", name: "현물 예단(이불·반상기·수저)", budget: 150, note: "간소화 추세. 추정" },
  { id: "wb53", cat: "예단·폐백·이바지·함", sub: "예단", name: "꾸밈비·봉채비(예단 답례)", budget: 300, note: "예단 일부 반환 관행. 추정" },
  { id: "wb54", cat: "예단·폐백·이바지·함", sub: "폐백·이바지", name: "이바지 음식", budget: 70, note: "52만~. 듀오 이바지 평균 155" },
  { id: "wb55", cat: "예단·폐백·이바지·함", sub: "폐백·이바지", name: "폐백 음식", budget: 50, note: "30~68, 양 따라 150까지" },
  { id: "wb56", cat: "예단·폐백·이바지·함", sub: "폐백·이바지", name: "폐백 수모비·의상 대여", budget: 40, note: "폐백 총액 100~200 중 일부. 추정" },
  { id: "wb57", cat: "예단·폐백·이바지·함", sub: "함", name: "함 구성품·봉채떡", budget: 50, note: "생략 많음. 추정" },
  { id: "wb58", cat: "예단·폐백·이바지·함", sub: "함", name: "함진아비 수고비", budget: 20, note: "친구 사례·식사. 추정" },
  { id: "wb59", cat: "청첩장·답례", sub: "청첩장", name: "종이 청첩장 인쇄", budget: 20, note: "장당 500~1500원, 200~300장" },
  { id: "wb60", cat: "청첩장·답례", sub: "청첩장", name: "모바일 청첩장", budget: 2, note: "무료~2만" },
  { id: "wb61", cat: "청첩장·답례", sub: "청첩장", name: "청첩장 발송(우편·퀵)", budget: 10, note: "추정" },
  { id: "wb62", cat: "청첩장·답례", sub: "청첩장", name: "청첩장 모임 식사", budget: 200, note: "인당 4.7만. 후기 200~500" },
  { id: "wb63", cat: "청첩장·답례", sub: "답례", name: "하객 답례품", budget: 100, note: "개당 3천~1만(떡·핸드크림). 추정" },
  { id: "wb64", cat: "청첩장·답례", sub: "식 진행 사례", name: "사회자 사례비", budget: 25, note: "친구 10~30, 전문 15~35" },
  { id: "wb65", cat: "청첩장·답례", sub: "식 진행 사례", name: "축가 사례비", budget: 20, note: "친구 10~20, 전문가수 30~100+" },
  { id: "wb66", cat: "청첩장·답례", sub: "식 진행 사례", name: "축의대 도우미 사례", budget: 20, note: "1인 5~10만 x2. 추정" },
  { id: "wb67", cat: "청첩장·답례", sub: "식 진행 사례", name: "주례 사례비", budget: 30, note: "주례 없는 결혼 증가. 추정" },
  { id: "wb68", cat: "청첩장·답례", sub: "답례", name: "신행 후 지인 답례 식사", budget: 50, note: "도움 준 친구 대접. 추정" },
  { id: "wb69", cat: "청첩장·답례", sub: "답례", name: "직장 답례(떡·간식)", budget: 20, note: "추정" },
  { id: "wb70", cat: "본식 당일 부대비용", sub: "신부 준비", name: "본식 헬퍼비", budget: 25, note: "20~25, 당일 현금" },
  { id: "wb71", cat: "본식 당일 부대비용", sub: "신부 준비", name: "부케", budget: 15, note: "생화 10~30. 후기 15" },
  { id: "wb72", cat: "본식 당일 부대비용", sub: "신부 준비", name: "부토니에·혼주 코사지", budget: 10, note: "추정" },
  { id: "wb73", cat: "본식 당일 부대비용", sub: "이동·숙박", name: "웨딩카", budget: 30, note: "5~10시간 코스 20~50. 추정" },
  { id: "wb74", cat: "본식 당일 부대비용", sub: "이동·숙박", name: "하객 대절버스", budget: 60, note: "45인승 30~50/대, 후기 167" },
  { id: "wb75", cat: "본식 당일 부대비용", sub: "이동·숙박", name: "원거리 하객 교통·숙박", budget: 30, note: "추정" },
  { id: "wb76", cat: "본식 당일 부대비용", sub: "신부 준비", name: "신부대기실 간식·음료", budget: 5, note: "추정" },
  { id: "wb77", cat: "본식 당일 부대비용", sub: "현금 준비", name: "스태프 수고비(현금 봉투)", budget: 10, note: "홀·헬퍼 팁 관행. 추정" },
  { id: "wb78", cat: "본식 당일 부대비용", sub: "이동·숙박", name: "예식 당일 호텔 숙박", budget: 40, note: "첫날밤·짐 보관. 추정" },
  { id: "wb79", cat: "본식 당일 부대비용", sub: "현금 준비", name: "당일 예비 현금", budget: 30, note: "잔금·추가금 대비. 추정" },
  { id: "wb80", cat: "신혼여행", sub: "항공·숙소", name: "항공권", budget: 300, note: "몰디브 약 300, 동남아 100대" },
  { id: "wb81", cat: "신혼여행", sub: "항공·숙소", name: "숙소(리조트)", budget: 350, note: "몰디브 450, 태국 200대. 후기" },
  { id: "wb82", cat: "신혼여행", sub: "현지 경비", name: "현지 식사·투어", budget: 150, note: "올인클 여부 따라 편차" },
  { id: "wb83", cat: "신혼여행", sub: "여행 준비", name: "보험·로밍·환전 수수료", budget: 5, note: "추정" },
  { id: "wb84", cat: "신혼여행", sub: "여행 준비", name: "여행 준비물(수영복·캐리어)", budget: 30, note: "추정" },
  { id: "wb85", cat: "신혼여행", sub: "현지 경비", name: "면세쇼핑·양가 선물", budget: 50, note: "추정. 듀오 신행 평균 763" },
  { id: "wb86", cat: "혼수", sub: "가전", name: "대형가전(냉장고·세탁·TV·에어컨)", budget: 800, note: "400~1200" },
  { id: "wb87", cat: "혼수", sub: "가전", name: "소형가전(청소기·주방)", budget: 200, note: "로봇청소기 100대 포함" },
  { id: "wb88", cat: "혼수", sub: "가구·생활", name: "가구(침대·소파·식탁·옷장)", budget: 600, note: "300~1000, 침대 필수 97.5%" },
  { id: "wb89", cat: "혼수", sub: "가구·생활", name: "침구·커튼", budget: 80, note: "추정" },
  { id: "wb90", cat: "혼수", sub: "가구·생활", name: "주방·생활용품", budget: 100, note: "50~150" },
  { id: "wb91", cat: "혼수", sub: "입주", name: "인테리어·부분시공", budget: 300, note: "100~500" },
  { id: "wb92", cat: "혼수", sub: "입주", name: "이사비", budget: 100, note: "50~250" },
  { id: "wb93", cat: "혼수", sub: "입주", name: "입주청소", budget: 30, note: "평당 1~1.5만, 24평 24~36" },
  { id: "wb94", cat: "혼수", sub: "입주", name: "집들이", budget: 30, note: "양가·지인 여러 차례. 추정" },
  { id: "wb95", cat: "뷰티·기타", sub: "관리", name: "신부 피부관리 패키지", budget: 100, note: "회당 평균 8.5만 x 10회+. 추정" },
  { id: "wb96", cat: "뷰티·기타", sub: "관리", name: "웨딩 시술(보톡스·리프팅)", budget: 50, note: "추정" },
  { id: "wb97", cat: "뷰티·기타", sub: "관리", name: "신랑 피부관리", budget: 30, note: "추정" },
  { id: "wb98", cat: "뷰티·기타", sub: "관리", name: "다이어트·PT", budget: 100, note: "회당 5~7만 x 20회. 추정" },
  { id: "wb99", cat: "뷰티·기타", sub: "관리", name: "네일·속눈썹·왁싱", budget: 15, note: "추정" },
  { id: "wb100", cat: "뷰티·기타", sub: "관리", name: "치아 미백", budget: 30, note: "추정" },
  { id: "wb101", cat: "뷰티·기타", sub: "기타", name: "브라이덜샤워", budget: 50, note: "호텔방·소품·식사. 추정" },
  { id: "wb102", cat: "뷰티·기타", sub: "기타", name: "혼전 건강검진", budget: 30, note: "추정" },
  { id: "wb103", cat: "뷰티·기타", sub: "기타", name: "웨딩플래너·동행 비용", budget: 50, note: "무료~100. 다이렉트면 0. 추정" }
];
const WEDDING_BUDGET_EST = {};
WEDDING_BUDGET_DEFAULT.forEach((b) => {
  WEDDING_BUDGET_EST[b.id] = b.budget;
  b.budget = 0;
});
const MAN_UNIT = { 억: 1e4, 천만: 1e3, 천원: 0.1, 천: 1e3, 만: 1, 원: 1 / 1e4 };
const MAN_AMT = "(\\d+(?:\\.\\d+)?)\\s*(억|천만|천원|천|만|원)?(?:\\s*(\\d+(?:\\.\\d+)?)\\s*(천만|천|만))?";
const MAN_RE = new RegExp(`${MAN_AMT}\\s*(?:~\\s*${MAN_AMT})?`, "g");
function manWonRaw(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const t = String(v || "").replace(/,/g, "");
  if (/무료/.test(t) && !/\d/.test(t)) return 0;
  const all = [...t.matchAll(MAN_RE)];
  const m = all.find((x) => x[2] || x[6]) || all[0];
  if (!m) return null;
  const amt = (n, u, n2, u2, other) => parseFloat(n) * MAN_UNIT[u || other || "만"] + (n2 && u === "억" ? parseFloat(n2) * MAN_UNIT[u2] : 0);
  const lo = amt(m[1], m[2], m[3], m[4], m[6]), hi = m[5] ? amt(m[5], m[6], m[7], m[8], m[2]) : lo;
  return (lo + hi) / 2;
}
function parseManWon(v) {
  const n = manWonRaw(v);
  return n == null ? null : Math.round(n * 10) / 10;
}
[
  ["220~770만", 495],
  ["본식스냅 230만", 230],
  ["1인 7만", 7],
  ["2부 38만", 38],
  ["1.2억", 12e3],
  ["6.5만~", 6.5],
  ["견적 상담", null],
  ["6~8.5만", 7.3],
  [1200, 1200],
  ["800만~1.2억", 6400],
  ["5천만", 5e3],
  ["3억 5천만", 35e3]
].forEach(([i, want]) => {
  if (parseManWon(i) !== want) console.error(`parseManWon(${i}) = ${parseManWon(i)} — 기대값 ${want}`);
});
const VENUE_TOUR_GROUPS = [
  { title: "접근성", fields: [
    { k: "subwayStation", label: "지하철 — 역", type: "text", ph: "예: 고속터미널역" },
    { k: "subwayMin", label: "지하철 — 역에서 도보", type: "num", unit: "분" },
    { k: "busStop", label: "버스 — 정류장", type: "text", ph: "예: 반포역 정류장" },
    { k: "busMin", label: "버스 — 정류장에서 도보", type: "num", unit: "분" },
    { k: "parkingCars", label: "주차 대수(승용차)", type: "num", unit: "대 가능", check: { k: "parkingExtra", label: "여유 주차장 여부" } },
    { k: "guestParkMin", label: "하객 무료주차", type: "num", unit: "분" },
    { k: "hostParkCars", label: "혼주 무료주차 — 대수", type: "num", unit: "대" },
    { k: "hostParkMin", label: "혼주 무료주차 — 시간", type: "num", unit: "분" }
  ] },
  { title: "기본 조건", fields: [
    { k: "slots", label: "예약 가능 시간", type: "text", ph: "예: 토 11:00 / 13:00 / 15:30" },
    { k: "hallType", label: "홀 개수", type: "choice", options: ["단독", "복수"] },
    { k: "hallCount", label: "홀 개수(복수일 때)", type: "num", unit: "개" },
    { k: "interval", label: "식 간격", type: "num", unit: "분" },
    { k: "mood", label: "분위기", type: "choice", options: ["밝음", "어두움", "기타"] },
    { k: "aisle", label: "버진로드", type: "choice", options: ["짧음", "보통", "긺"] },
    { k: "seats", label: "좌석수(하객)", type: "num", unit: "석" },
    { k: "maxGuests", label: "최대 하객 수용 인원", type: "num", unit: "명" },
    { k: "atm", label: "ATM기 여부 & 위치", type: "text" },
    { k: "photoTable", label: "포토테이블 액자 & 꽃장식", type: "text" },
    { k: "video", label: "식전 영상 / 식중 영상 가능 여부", type: "choice", options: ["가능", "불가"], check: { k: "videoCheck", label: "스크린 크기 / 영상 재생 여부" } },
    { k: "photoBooth", label: "포토부스 설치 가능 여부", type: "choice", options: ["가능", "불가"], check: { k: "photoBoothBy", label: "웨딩홀 제휴 or 개인" } }
  ] },
  { title: "대기실 — 혼주", fields: [
    { k: "hostRoom", label: "혼주 대기실", type: "choice", options: ["있음", "없음"] },
    { k: "hostRoomSize", label: "크기", type: "choice", options: ["큼", "보통", "작음"] },
    { k: "hostStorage", label: "짐보관", type: "text" },
    { k: "hostHairMakeup", label: "헤어메이크업(헤메)", type: "choice", options: ["있음", "없음"] },
    { k: "hostHmFemale", label: "헤메 — 여자", type: "num", unit: "원" },
    { k: "hostHmMale", label: "헤메 — 남자", type: "num", unit: "원" }
  ] },
  { title: "대기실 — 신부", fields: [
    { k: "brideRoom", label: "신부 대기실", type: "choice", options: ["있음", "없음"] },
    { k: "brideRoomSize", label: "크기", type: "choice", options: ["큼", "보통", "작음"] },
    { k: "brideRoomMood", label: "분위기", type: "text" },
    { k: "brideRoomSizeNote", label: "크기 메모", type: "text" },
    { k: "brideFlower", label: "꽃장식", type: "choice", options: ["있음", "없음"] },
    { k: "brideEntrance", label: "입장 동선", type: "choice", options: ["좋음", "보통", "짧음"] }
  ] },
  { title: "식사", fields: [
    { k: "mealStyle", label: "형태", type: "choice", options: ["뷔페", "코스"] },
    { k: "mealFloor", label: "위치", type: "choice", options: ["지상", "지하"] },
    { k: "mealRoomSize", label: "크기", type: "choice", options: ["넓음", "좁음"] },
    { k: "mealSeats", label: "좌석수", type: "num", unit: "석" },
    { k: "hostMeal", label: "혼주 식대", type: "choice", options: ["포함", "별도"], check: { k: "hostMealPlace", label: "별도 장소가 있는지 확인" } },
    { k: "hostMealSeats", label: "혼주 식사석", type: "num", unit: "석" },
    { k: "hostMealTime", label: "혼주 식사시간", type: "num", unit: "분" },
    { k: "guarantee", label: "보증인원", type: "num", unit: "명" },
    { k: "guaranteeChange", label: "보증인원 변경", type: "choice", options: ["가능", "불가능"] },
    { k: "drinks", label: "음주류", type: "choice", options: ["포함", "별도"] },
    { k: "giftKind", label: "답례품 — 종류", type: "text" },
    { k: "giftExchange", label: "답례품 — 교환 여부", type: "text" },
    { k: "tasting", label: "무료 시식 인원", type: "num", unit: "명" }
  ] },
  { title: "비용", fields: [
    { k: "feeMan", label: "대관료", type: "num", unit: "만원", check: { k: "offSeason", label: "비수기 할인 여부" } },
    { k: "depositMan", label: "계약금", type: "num", unit: "만원" },
    { k: "flowerMan", label: "꽃장식", type: "num", unit: "만원" },
    { k: "mealWon", label: "식대(1인)", type: "num", unit: "원" },
    { k: "payBenefit", label: "결제 혜택 — 카드 / 현금 / 부가세", type: "text", check: { k: "localCurrency", label: "지역화폐 사용 여부" } },
    { k: "penalty", label: "위약금", type: "text", check: { k: "refundUntil", label: "언제까지 100% 환불인지 (기준: 예식 150일 전까지 전액 환급)" } },
    { k: "settlement", label: "최종 정산", type: "text" }
  ] }
];
const VENUE_TOUR_KEYS = VENUE_TOUR_GROUPS.flatMap((g) => g.fields.flatMap((f) => [f.k, ...f.check ? [f.check.k] : []]));
const VENUE_TOUR_KEY = "wedding-venue-tour-v1";
const tourId = (name) => `tour:${name}`;
const tourNum = (v, won2) => {
  const s = String(v ?? "").trim(), n = s ? manWonRaw(s) : null;
  return n == null ? null : won2 && /[억천만원]/.test(s) ? Math.round(n * 1e4) : n;
};
const tourFilled = (t) => t ? VENUE_TOUR_KEYS.filter((k) => String((t.f || {})[k] ?? "").trim()).length : 0;
const TOUR_MUST = [["penalty", "위약금"], ["refundUntil", "100% 환불 기한"], ["guarantee", "보증인원"], ["guaranteeChange", "보증인원 변경 가능 여부"], ["mealWon", "식대"], ["feeMan", "대관료"]];
const tourMissing = (t) => TOUR_MUST.filter(([k]) => !String((t && t.f || {})[k] ?? "").trim()).map(([, l]) => l);
function TourField({ f, value, onChange }) {
  const id = React.useId();
  if (f.type === "choice") return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, f.label), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, f.options.map((o) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: o,
      type: "button",
      onClick: () => onChange(value === o ? "" : o),
      "aria-pressed": value === o,
      className: `h-9 px-3 rounded-full text-[13px] font-semibold transition-colors ${value === o ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#525252]"}`
    },
    o
  ))));
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: id, className: "text-[12px] text-[#6B6B6B] block mb-1" }, f.label), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      id,
      type: "text",
      inputMode: f.type === "num" ? "decimal" : void 0,
      value: value || "",
      onChange: (e) => onChange(e.target.value),
      placeholder: f.ph || "",
      className: "h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    }
  ), f.unit && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B] shrink-0" }, f.unit)));
}
function VenueTourSheet({ venue, tours, setTours, onClose }) {
  const cur = tours.find((t) => t.id === tourId(venue.name));
  const f = cur && cur.f || {};
  const set = (k, v) => {
    const now = Date.now();
    const next = cur ? tours.map((t) => t.id === cur.id ? { ...t, f: { ...t.f, [k]: v }, u: now } : t) : [...tours, { id: tourId(venue.name), venue: venue.name, at: now, u: now, f: { [k]: v } }];
    setTours(next);
  };
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const total = VENUE_TOUR_KEYS.length, filled = tourFilled(cur);
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5", role: "dialog", "aria-label": `${venue.name} 투어 체크리스트` }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-black/40", onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: "relative bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]", style: { paddingBottom: "env(safe-area-inset-bottom)" } }, /* @__PURE__ */ React.createElement("div", { className: "sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-5 pb-3 border-b border-[#F0F0F0] flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "웨딩홀 투어 체크리스트"), /* @__PURE__ */ React.createElement("div", { className: "text-[18px] font-bold truncate" }, venue.name)), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-semibold text-[#525252] shrink-0", style: { fontVariantNumeric: "tabular-nums" } }, filled, "/", total, " 채움"), /* @__PURE__ */ React.createElement(IconBtn, { name: "x", title: "닫기", onClick: onClose })), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 space-y-6" }, VENUE_TOUR_GROUPS.map((g) => /* @__PURE__ */ React.createElement("section", { key: g.title }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold mb-3" }, g.title), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-x-4 gap-y-3" }, g.fields.map((fd) => /* @__PURE__ */ React.createElement(React.Fragment, { key: fd.k }, /* @__PURE__ */ React.createElement(TourField, { f: fd, value: f[fd.k], onChange: (v) => set(fd.k, v) }), fd.check && /* @__PURE__ */ React.createElement(TourField, { f: { k: fd.check.k, label: `확인 · ${fd.check.label}`, type: "text" }, value: f[fd.check.k], onChange: (v) => set(fd.check.k, v) })))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold mb-2" }, "메모"), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: f.memo || "",
      onChange: (e) => set("memo", e.target.value),
      rows: 3,
      placeholder: "투어하며 느낀 점, 상담 실장 이름, 추가 견적 등",
      "aria-label": "투어 메모",
      className: "w-full rounded-lg bg-[#F5F5F5] border border-transparent px-2.5 py-2 text-[14px] leading-relaxed focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    }
  )), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] leading-relaxed" }, "입력하면 바로 저장되고 부부가 함께 봐요. 이 식장을 확정하면 대관료·식대(1인 × 보증인원)·꽃장식이 예산표에 반영돼요.")), /* @__PURE__ */ React.createElement("div", { className: "sticky bottom-0 bg-white px-5 py-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold text-[14px]" }, "완료"))));
}
const TOUR_COMPARE_ROWS = [
  ["feeMan", "대관료", "만원"],
  ["mealWon", "식대(1인)", "원"],
  ["guarantee", "보증인원", "명"],
  ["guaranteeChange", "보증인원 변경", ""],
  ["depositMan", "계약금", "만원"],
  ["flowerMan", "꽃장식", "만원"],
  ["hostMeal", "혼주 식대", ""],
  ["drinks", "음주류", ""],
  ["maxGuests", "최대 수용", "명"],
  ["interval", "식 간격", "분"],
  ["hallType", "홀", ""],
  ["mood", "분위기", ""],
  ["aisle", "버진로드", ""],
  ["parkingCars", "주차", "대"],
  ["guestParkMin", "하객 무료주차", "분"],
  ["subwayMin", "지하철 도보", "분"],
  ["mealStyle", "식사 형태", ""],
  ["penalty", "위약금", ""],
  ["refundUntil", "100% 환불 기한", ""],
  ["offSeason", "비수기 할인", ""]
];
function VenueTourCompare({ tours, venueNames, confirmedName, onOpen }) {
  const [sameN, setSameN] = useState("");
  const list = tours.filter((t) => venueNames.includes(t.venue) && tourFilled(t) > 0);
  if (list.length === 0) return null;
  const n = tourNum(sameN);
  const estimate = (t) => {
    const fee = tourNum(t.f.feeMan), meal = tourNum(t.f.mealWon, true), g = n || tourNum(t.f.guarantee), fl = tourNum(t.f.flowerMan);
    if (fee == null && (meal == null || g == null)) return null;
    return Math.round((fee || 0) + (meal != null && g != null ? meal * g / 1e4 : 0) + (fl || 0));
  };
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "투어 다녀온 곳", title: "식장 비교" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-[13px] min-w-[520px]", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "border-b border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("th", { className: "sticky left-0 bg-white px-4 py-3 text-left text-[#6B6B6B] font-semibold" }, "항목"), list.map((t) => /* @__PURE__ */ React.createElement("th", { key: t.id, className: "px-3 py-3 text-left font-bold whitespace-nowrap" }, /* @__PURE__ */ React.createElement("button", { onClick: () => onOpen(t.venue), className: "underline underline-offset-4" }, t.venue), t.venue === confirmedName && /* @__PURE__ */ React.createElement("span", { className: "ml-1 text-[10px] text-white bg-[#0A0A0A] rounded-full px-1.5 py-0.5" }, "확정"))))), /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", { className: "border-b border-[#F7F7F7] bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("td", { className: "sticky left-0 bg-[#FAFAFA] px-4 py-2.5 font-bold" }, "예상 합계", n ? ` (${n}명)` : ""), list.map((t) => {
    const e = estimate(t);
    return /* @__PURE__ */ React.createElement("td", { key: t.id, className: "px-3 py-2.5 font-bold" }, e == null ? "—" : manWon(e));
  })), TOUR_COMPARE_ROWS.map(([k, label, unit]) => /* @__PURE__ */ React.createElement("tr", { key: k, className: "border-b border-[#F7F7F7]" }, /* @__PURE__ */ React.createElement("td", { className: "sticky left-0 bg-white px-4 py-2 text-[#525252] whitespace-nowrap" }, label), list.map((t) => {
    const v = String(t.f[k] ?? "").trim();
    const n2 = unit && tourNum(v, unit === "원");
    return /* @__PURE__ */ React.createElement("td", { key: t.id, className: "px-3 py-2" }, !v ? /* @__PURE__ */ React.createElement("span", { className: "text-[#B4B4B4]" }, "—") : unit === "원" && n2 != null ? `${n2.toLocaleString("ko-KR")}원` : unit === "만원" && n2 != null ? manWon(n2) : `${v}${unit && n2 != null ? unit : ""}`);
  })))))), /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border-t border-[#F0F0F0] text-[12px] text-[#6B6B6B] flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", null, "예상 합계 = 대관료 + 식대 × ", n ? `${n}명` : "보증인원", " + 꽃장식."), /* @__PURE__ */ React.createElement("label", { className: "inline-flex items-center gap-1.5" }, "같은 인원으로 환산 ", /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      inputMode: "numeric",
      value: sameN,
      onChange: (e) => setSameN(e.target.value),
      placeholder: "예: 250",
      "aria-label": "환산 인원",
      className: "h-8 w-20 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    }
  ), "명"), /* @__PURE__ */ React.createElement("span", null, "식장 이름을 누르면 체크리스트가 열려요."))));
}
const paysSum = (dt) => (dt && dt.pays || []).reduce((s, p) => s + (Number(p.amt) || 0), 0);
const detailTotal = (dt) => {
  if (!dt) return null;
  const s = paysSum(dt);
  return s > 0 ? s : dt.totalSet || Number(dt.total) > 0 ? Number(dt.total) || 0 : null;
};
const paidOf = (dt) => (dt && dt.pays || []).filter((p) => p.paid).reduce((s, p) => s + (Number(p.amt) || 0), 0);
const VENDOR_BUDGET_KINDS = ["studio", "dress", "makeup", "bsnap", "snap", "sdress", "ssuit", "sbouquet", "bsuit", "biphone", "bdvd", "planner", "invite", "ring"];
function weddingBudgetLinks({ confirmed, venueList, honeymoon, heads, tours = [], details = {} }) {
  const out = [];
  const cv = confirmed.venue, v = cv && venueList.find((x) => x.name === cv.name);
  const tf = (cv && tours.find((t) => t.id === tourId(cv.name)) || {}).f || {};
  const tGuar = tourNum(tf.guarantee), tMealWon = tourNum(tf.mealWon, true), tFee = tourNum(tf.feeMan), tFlower = tourNum(tf.flowerMan);
  const guests = tGuar > 0 ? tGuar : heads > 0 ? heads : 200;
  const meal = tMealWon != null ? tMealWon / 1e4 : v ? parseManWon(v.meal) : null;
  const mealText = tMealWon != null ? `${+(tMealWon / 1e4).toFixed(2)}만원` : v && v.meal;
  out.push({ key: "venue-fee", defId: "wb9", cat: "예식장", on: !!cv, src: cv && cv.name, value: tFee != null ? tFee : v ? parseManWon(v.fee) : null, label: cv ? `식장 확정 · ${cv.name}${tFee != null ? " · 투어 견적" : ""}` : "" });
  out.push({
    key: "venue-meal",
    defId: "wb10",
    cat: "예식장",
    on: !!cv,
    src: cv && cv.name,
    value: meal == null ? null : Math.round(meal * guests),
    name: cv && meal != null ? `식대 (${guests}명 × ${mealText})` : null,
    label: cv ? `식장 확정 · ${cv.name}${tGuar > 0 ? " · 보증인원" : heads > 0 ? " · 하객 리스트 인원" : " · 하객 200명 가정"}` : ""
  });
  out.push({ key: "venue-flower", defId: "wb12", cat: "예식장", sub: "옵션·연출", on: !!cv && tFlower != null, src: cv && cv.name, value: tFlower, label: cv ? `식장 확정 · ${cv.name} · 투어 견적` : "" });
  const dv = cv && details[`venue|${cv.name}`];
  if (dv) out.filter((l) => l.key.startsWith("venue-")).forEach((l) => {
    l.venuePaid = paidOf(dv);
  });
  [
    ["studio", "wb19", "스드메", "스튜디오"],
    ["dress", "wb20", "스드메", "드레스"],
    ["makeup", "wb21", "스드메", "메이크업"],
    ["bsnap", "wb34", "스냅·영상", "본식 스냅"],
    ["snap", "wb38", "스냅·영상", "제주 스냅"],
    ["sdress", null, "스냅·영상", "제주 스냅 드레스·헤메", "제주 스냅 드레스·헤메"],
    ["ssuit", null, "스냅·영상", "제주 스냅 양복", "제주 스냅 양복"],
    ["sbouquet", null, "스냅·영상", "제주 스냅 부케", "제주 스냅 부케"],
    ["bsuit", "wb47", "예물·예복", "본식 양복"],
    ["biphone", "wb36", "스냅·영상", "본식 아이폰 스냅"],
    ["bdvd", "wb35", "스냅·영상", "본식 DVD"],
    ["planner", "wb103", "뷰티·기타", "플래너"],
    ["invite", "wb59", "청첩장·답례", "청첩장"],
    ["ring", "wb42", "예물·예복", "결혼반지"]
  ].forEach(([k, id, cat, word, newName]) => {
    const c = confirmed[k], dt = c && details[`${k}|${c.name}`], total = detailTotal(dt);
    out.push({
      key: k,
      defId: id,
      cat,
      sub: id ? void 0 : "추가 촬영",
      on: !!c,
      src: c && c.name,
      value: total != null ? total : c ? parseManWon(c.price) : null,
      name: !id && c ? newName : null,
      label: c ? `${word} 확정 · ${c.name}${total != null ? " · 총 금액" : ""}` : "",
      own: true,
      ...dt ? { paidAmt: paidOf(dt) } : {}
    });
  });
  const hm = honeymoon.find((h) => h.star);
  out.push({
    key: "honeymoon",
    defId: null,
    cat: "신혼여행",
    sub: "항공·숙소",
    on: !!hm,
    src: hm && hm.id,
    value: hm ? parseManWon(hm.cost) : null,
    name: hm ? `1순위 신혼여행 · ${hm.place}${hm.days ? ` (${hm.days})` : ""}` : null,
    label: hm ? "신혼여행 ★1순위 총액 (항공·숙소·현지 경비)" : "",
    replaces: ["wb80", "wb81", "wb82"]
  });
  return out;
}
function applyWeddingBudgetLinks(budget, applied, links) {
  let next = budget, nextApplied = applied;
  const untouched = (b) => {
    const d = WEDDING_BUDGET_DEFAULT.find((x) => x.id === b.id);
    return d && b.name === d.name && Number(b.budget) === d.budget && !(b.spent > 0);
  };
  links.forEach((l) => {
    const sig = JSON.stringify([l.on, l.value, l.name, l.label, l.paidAmt]);
    const prev = typeof applied[l.key] === "object" ? applied[l.key] : { sig: applied[l.key] };
    if (prev.sig === sig) return;
    nextApplied = { ...nextApplied, [l.key]: { sig, value: l.value, src: l.src } };
    const cur = next.find((b) => b.link === l.key) || l.defId && next.find((b) => b.id === l.defId) || next.find((b) => b.id === "link-" + l.key);
    const userEdited = !l.own && cur && l.on && prev.src === l.src && prev.value != null && Number(cur.budget) !== prev.value;
    if (!l.on) {
      if (cur && cur.link === l.key) next = next.map((b) => b === cur ? { ...b, link: void 0, linkLabel: void 0, ...b.paidAmt != null ? { paidAmt: void 0, paid: false } : {} } : b);
      return;
    }
    const amt = l.value != null && !userEdited ? l.value : cur ? Number(cur.budget) || 0 : l.value || 0;
    const patch = {
      link: l.key,
      linkLabel: l.value == null ? `${l.label} · 가격 미정, 업체 화면에 낼 돈을 적어요` : l.label,
      ...l.value != null && !userEdited ? { budget: l.value } : {},
      ...l.name && !userEdited ? { name: l.name } : {},
      ...l.paidAmt !== void 0 ? { paidAmt: l.paidAmt, paid: amt > 0 && l.paidAmt >= amt } : {}
    };
    if (cur) next = next.map((b) => b === cur ? { ...b, ...patch } : b);
    else {
      if (l.replaces) next = next.filter((b) => !(l.replaces.includes(b.id) && untouched(b)));
      next = [...next, { id: "link-" + l.key, cat: l.cat, sub: l.sub || "기타", name: l.name || l.label, budget: 0, note: "", ...patch }];
    }
  });
  const vl = links.find((l) => l.venuePaid !== void 0);
  if (vl) {
    let left = vl.venuePaid;
    ["venue-fee", "venue-meal", "venue-flower"].forEach((k) => {
      const b = next.find((x) => x.link === k);
      if (!b) return;
      const amt = Number(b.budget) || 0, a = Math.min(left, amt);
      left -= a;
      const paid = amt > 0 && a >= amt;
      if (b.paidAmt !== a || !!b.paid !== paid) next = next.map((x) => x === b ? { ...x, paidAmt: a, paid } : x);
    });
  }
  return { budget: next, applied: nextApplied };
}
(() => {
  const links = weddingBudgetLinks({ confirmed: { bsnap: { name: "노마하우스", price: "본식스냅 230만" } }, venueList: [], honeymoon: [{ id: "h1", place: "몰디브", cost: 1200, star: true }], heads: 0 });
  const r1 = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, links);
  const snap = r1.budget.find((b) => b.id === "wb34"), hm = r1.budget.find((b) => b.link === "honeymoon");
  if (!(snap.budget === 230 && hm && hm.budget === 1200 && !r1.budget.some((b) => b.id === "wb80"))) console.error("applyWeddingBudgetLinks: 반영 실패", r1);
  const edited = r1.budget.map((b) => b.id === "wb34" ? { ...b, budget: 999 } : b);
  if (applyWeddingBudgetLinks(edited, r1.applied, links).budget.find((b) => b.id === "wb34").budget !== 999) console.error("applyWeddingBudgetLinks: 사용자 수정값을 덮음");
  const off = applyWeddingBudgetLinks(r1.budget, r1.applied, weddingBudgetLinks({ confirmed: {}, venueList: [], honeymoon: [{ id: "h1", place: "몰디브", cost: 1200, star: false }], heads: 0 }));
  const again = applyWeddingBudgetLinks(off.budget, off.applied, links).budget;
  if (again.filter((b) => b.id === "link-honeymoon").length !== 1) console.error("applyWeddingBudgetLinks: 재연동 시 id 중복");
  const venue = { confirmed: { venue: { name: "A홀" } }, venueList: [{ name: "A홀", meal: "7만", fee: "300만" }], honeymoon: [] };
  const v1 = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, weddingBudgetLinks({ ...venue, heads: 0 }));
  const quoted = v1.budget.map((b) => b.id === "wb10" ? { ...b, budget: 1500 } : b);
  if (applyWeddingBudgetLinks(quoted, v1.applied, weddingBudgetLinks({ ...venue, heads: 250 })).budget.find((b) => b.id === "wb10").budget !== 1500) console.error("applyWeddingBudgetLinks: 하객 수 변화가 견적 식대를 덮음");
  const dl = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, weddingBudgetLinks({
    confirmed: { snap: { name: "기억", price: "100만" }, sdress: { name: "캄포", price: "문의" } },
    venueList: [],
    honeymoon: [],
    heads: 0,
    details: { "snap|기억": { total: 110 }, "sdress|캄포": { total: 40 } }
  })).budget;
  if (!(dl.find((b) => b.id === "wb38").budget === 110 && dl.find((b) => b.id === "link-sdress").budget === 40 && dl.find((b) => b.id === "wb34").budget === 0)) console.error("weddingBudgetLinks: 세부 사항 금액·스냅 분리 실패", dl);
  const own = (det) => weddingBudgetLinks({ confirmed: { snap: { name: "기억", price: "100만" } }, venueList: [], honeymoon: [], heads: 0, details: { "snap|기억": det } });
  const o1 = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, own({ total: 110, pays: [{ amt: 30, paid: true }, { amt: 80, paid: false }] }));
  const o2 = applyWeddingBudgetLinks(o1.budget.map((b) => b.id === "wb38" ? { ...b, budget: 999 } : b), o1.applied, own({ total: 120, pays: [{ amt: 120, paid: true }] })).budget.find((b) => b.id === "wb38");
  const w1 = o1.budget.find((b) => b.id === "wb38");
  if (!(w1.budget === 110 && w1.paidAmt === 30 && !w1.paid && o2.budget === 120 && o2.paid && weddingMoney({ wedding: 0 }, [w1]).paid === 30)) console.error("weddingBudgetLinks: 세부 사항이 주인인 연동 실패", w1, o2);
  const vv = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, weddingBudgetLinks({
    confirmed: { venue: { name: "A홀" } },
    venueList: [{ name: "A홀", meal: "7만", fee: "300만" }],
    honeymoon: [],
    heads: 100,
    details: { "venue|A홀": { pays: [{ amt: 400, paid: true }] } }
  })).budget;
  if (!(vv.find((b) => b.id === "wb9").paid && vv.find((b) => b.id === "wb10").paidAmt === 100)) console.error("weddingBudgetLinks: 식장 낸 돈 나누기 실패", vv);
  const vLinks = (paid) => weddingBudgetLinks({ confirmed: { venue: { name: "A홀" } }, venueList: [{ name: "A홀", meal: "7만", fee: "300만" }], honeymoon: [], heads: 100, details: { "venue|A홀": { pays: [{ amt: paid, paid: true }] } } });
  const v0 = applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, vLinks(0));
  const v2 = applyWeddingBudgetLinks(v0.budget.map((b) => b.id === "wb9" ? { ...b, budget: 500 } : b), v0.applied, vLinks(500)).budget;
  if (!(v2.find((b) => b.id === "wb9").paid && v2.find((b) => b.id === "wb9").budget === 500 && v2.find((b) => b.id === "wb10").paidAmt === 0)) console.error("weddingBudgetLinks: 고친 식장 금액으로 나누기 실패", v2);
  if (applyWeddingBudgetLinks(WEDDING_BUDGET_DEFAULT, {}, own({ total: 0, totalSet: true })).budget.find((b) => b.id === "wb38").budget !== 0) console.error("weddingBudgetLinks: 0원 계약 금액이 확정 가격으로 돌아감");
})();
function budgetToDetails(budget, confirmed, details, only) {
  let out = details;
  [...VENDOR_BUDGET_KINDS, "venue"].filter((k) => (!only || k === only) && confirmed[k] && confirmed[k].name).forEach((k) => {
    const rows = budget.filter((b) => k === "venue" ? String(b.link || "").startsWith("venue-") : b.link === k);
    if (!rows.length) return;
    const key = `${k}|${confirmed[k].name}`, cur = out[key] || vendorDetailSeed(k);
    const est = (b) => WEDDING_BUDGET_EST[b.id] != null && (Number(b.budget) === 0 || Number(b.budget) === WEDDING_BUDGET_EST[b.id]);
    const amt = rows.every(est) ? 0 : rows.reduce((s, b) => s + (Number(b.budget) || 0), 0), paidRows = rows.filter((b) => b.paid).reduce((s, b) => s + (Number(b.budget) || 0), 0);
    const next = { ...cur };
    if (k !== "venue" && !(Number(cur.total) > 0) && amt > 0) next.total = amt;
    if (paidRows > 0 && !(paidOf(cur) > 0)) next.pays = [{ id: uid(), label: "예산표에서 지불로 표시한 돈", amt: paidRows, date: "", paid: true }, ...(cur.pays || []).filter((p) => Number(p.amt) > 0 || p.date)];
    if (next.total !== cur.total || next.pays !== cur.pays) out = { ...out, [key]: { ...next, u: Date.now() } };
  });
  return out;
}
function migrateSnapBudgetLink(budget, applied) {
  const b = budget.find((x) => x.id === "wb34" && x.link === "snap");
  if (!b) return { budget, applied };
  const prev = applied.snap && typeof applied.snap === "object" ? applied.snap : null, d = WEDDING_BUDGET_DEFAULT.find((x) => x.id === "wb34");
  const reset = prev && prev.value != null && Number(b.budget) === prev.value;
  const { snap, ...rest } = applied;
  const movePaid = reset && b.paid;
  return { budget: budget.map((x) => x === b ? { ...x, link: void 0, linkLabel: void 0, ...reset ? { budget: d.budget, name: d.name } : {}, ...movePaid ? { paid: false } : {} } : movePaid && x.id === "wb38" ? { ...x, paid: true } : x), applied: rest };
}
(() => {
  const old = WEDDING_BUDGET_DEFAULT.map((b) => b.id === "wb34" ? { ...b, budget: 100, link: "snap", linkLabel: "스냅 확정 · 기억" } : b);
  const m = migrateSnapBudgetLink(old, { snap: { sig: "x", value: 100, src: "기억" } });
  const r = applyWeddingBudgetLinks(m.budget, m.applied, weddingBudgetLinks({ confirmed: { snap: { name: "기억", price: "100만" } }, venueList: [], honeymoon: [], heads: 0 }));
  const w34 = r.budget.find((b) => b.id === "wb34"), w38 = r.budget.find((b) => b.id === "wb38");
  if (!(w34.budget === 0 && !w34.link && w38.link === "snap" && w38.budget === 100 && migrateSnapBudgetLink(r.budget, r.applied).budget === r.budget)) console.error("migrateSnapBudgetLink 실패", r);
  const pm = migrateSnapBudgetLink(old.map((b) => b.id === "wb34" ? { ...b, paid: true } : b), { snap: { sig: "x", value: 100, src: "기억" } }).budget;
  if (!(!pm.find((b) => b.id === "wb34").paid && pm.find((b) => b.id === "wb38").paid)) console.error("migrateSnapBudgetLink: 지불 표시를 옮기지 못함", pm);
})();
const budgetSub = (b) => b.sub || "기타";
const WEDDING_BUDGET_SUB = { ...Object.fromEntries(WEDDING_BUDGET_DEFAULT.map((b) => [b.id, b.sub])), "link-honeymoon": "항공·숙소" };
function normalizeWeddingBudget(list) {
  let changed = false;
  const out = list.map((b) => {
    if (!("spent" in b) && (b.sub || !WEDDING_BUDGET_SUB[b.id])) return b;
    changed = true;
    const { spent, ...rest } = b;
    return { ...rest, ...Number(spent) > 0 ? { budget: Number(spent) } : {}, ...!b.sub && WEDDING_BUDGET_SUB[b.id] ? { sub: WEDDING_BUDGET_SUB[b.id] } : {} };
  });
  return changed ? out : list;
}
(() => {
  const once = normalizeWeddingBudget([{ id: "wb9", cat: "예식장", name: "대관료", budget: 300, spent: 450 }, { id: "x", cat: "기타", name: "a", budget: 5 }]);
  if (!(once[0].budget === 450 && once[0].sub === "기본" && !("spent" in once[0]) && normalizeWeddingBudget(once) === once)) console.error("normalizeWeddingBudget 실패", once);
})();
const WEDDING_BUDGET_V1 = { w1: ["예식장 대관료", 1e3, "예식장"], w2: ["식대 (하객 250명 기준)", 2e3, "예식장"], w3: ["스드메 (스튜디오·드레스·메이크업)", 500, "스드메"], w4: ["예물·예복", 800, "예물·예복"], w5: ["신혼여행", 1e3, "신혼여행"], w6: ["청첩장·답례품·부수비용", 200, "청첩장·답례"] };
const WEDDING_BUDGET_V1_COVERS = { w1: ["wb9"], w2: ["wb10"], w3: ["wb19", "wb20", "wb21"], w4: ["wb42", "wb43", "wb44", "wb45", "wb47", "wb48", "wb49"], w5: ["wb80", "wb81", "wb82", "wb83", "wb84", "wb85"], w6: ["wb59", "wb60", "wb61", "wb63"] };
function seedWeddingBudget(prev) {
  const kept = prev.filter((b) => {
    const d = WEDDING_BUDGET_V1[b.id];
    return !(d && b.name === d[0] && Number(b.budget) === d[1] && !(b.spent > 0));
  }).map((b) => b.cat ? b : { ...b, cat: (WEDDING_BUDGET_V1[b.id] || [])[2] || "기타" });
  const has = new Set(kept.map((b) => b.id));
  kept.forEach((b) => (WEDDING_BUDGET_V1_COVERS[b.id] || []).forEach((id) => has.add(id)));
  return [...kept, ...WEDDING_BUDGET_DEFAULT.filter((b) => !has.has(b.id))];
}
const SHOOT_PREP = [
  "촬영 몇 주 전부터 하루 5~10분 거울 보며 표정 연습 — 자연스러운 웃음·눈웃음·살짝 미소·서로 보며 웃기, 커플 포즈도 몇 가지 미리 정하기",
  "신랑 촬영 준비 — 턱수염 제모는 붉은 기가 빠지게 4일 전쯤, 손 관리, 곱슬이면 다운펌, 대여 예복은 구겨지지 않게 차로 옮기기"
];
const WEDDING_CHECKLIST_DEFAULT = [
  { cat: "D-12~9개월", items: [
    "양가 인사·상견례 진행, 예식 시기·규모·예산 상한선 부부 합의",
    "웨딩북·다이렉트결혼준비 앱으로 웨딩홀 후보 추리고 주말 투어 (하루 2~3곳)",
    "토요일 12~14시 골든타임은 1년 전에도 마감 — 맘에 든 홀은 보증인원·식대·페이백 확인 후 바로 가계약",
    "플래너 동행 vs 워킹(직접) 결정, 스드메 정찰제 견적 3개 이상 비교",
    "인기 본식 스냅·DVD 업체는 1년 전 마감 — 홀 계약 직후 날짜 걸어두기",
    "공동 예산 시트(노션/스프레드시트) 만들어 계약금·잔금 일정 기록 시작",
    "신혼집 방향(매매·전세) 결정, 혼인신고 타이밍별 대출 유불리 공부"
  ] },
  { cat: "D-9~6개월", items: [
    "스드메 확정 계약 — 원본·수정본 컷 수, 헬퍼비·얼리스타트비 추가금 계약서에 명시",
    "드레스 투어(3~4곳) 후 본식·촬영 드레스 라인 결정 (피팅비 감안)",
    "리허설 촬영 날짜 확정, 신랑 예복은 맞춤 2~3개월 걸리니 미리 계약",
    "신혼여행 항공·숙소 예약, 여권 유효기간(남은 기간 6개월 이상 권장)·비자/ESTA 확인",
    "예물·예단·꾸밈비 범위 양가 조율 (갈등 소지 초반에 정리)",
    "웨딩박람회·제휴 이벤트로 한복·예복·주얼리 견적 비교, 페이백 챙기기",
    "사회자·축가 지인/전문업체 결정, 지인이면 이 시기에 미리 부탁"
  ] },
  { cat: "D-6~3개월", items: [
    "리허설 촬영 진행, 셀렉·앨범 수정 기간(1~2개월) 역산해 일정 관리",
    SHOOT_PREP[0],
    SHOOT_PREP[1],
    "신혼집 계약 — 정책 대출은 심사기간 고려해 잔금일 한 달 전 신청",
    "종이 청첩장 주문 + 모바일 청첩장(참석 여부·계좌 안내 기능) 제작",
    "식전 영상(성장 영상) 준비, 웨딩홀 화면 규격·재생 방식 확인",
    "가전·혼수 백화점 웨딩클럽/제휴로 묶어 구매 — 사은품·포인트 최대화",
    "부모님 한복·양가 어머니 미용 예약, 폐백·이바지 여부 결정",
    "청첩장 모임 리스트 작성 → 예상 하객 수와 보증인원 비교 조정"
  ] },
  { cat: "D-3~1개월", items: [
    "청첩장 모임 소그룹 진행, 모바일 청첩장은 단체방 말고 개별 연락",
    "본식 드레스 가봉 피팅, 당일 드레스·부케·헬퍼 일정 최종 확인",
    "사회자·축가와 식순 대본 공유, 축가 MR 웨딩홀에 미리 전달",
    "본식 스냅·DVD 업체에 필수 컷 리스트·가족 단체사진 명단 전달",
    "신혼여행 최종 결제 + 여행자보험·환전·eSIM 처리",
    "웨딩홀 최종 미팅 — 보증인원 확정, 식순, 영상 송출, 답례품 점검",
    "축의대·명부·주차 안내 등 당일 역할 배정"
  ] },
  { cat: "D-30일~당일", items: [
    "잔금 폭탄 시기 — 홀·스드메·스냅 잔금 일정과 결제수단(현금영수증) 캘린더 정리",
    "메이크업 리허설로 당일 스타일 확정, 새벽 샵 도착 동선 시뮬레이션",
    "D-7부터 술·자극적 음식·새 화장품 테스트 금지 (피부 컨디션)",
    "전날 드레스·구두·예물·축의대 용품·비상 파우치(핀·실·진통제) 한곳에 모으기",
    "당일 타임테이블(샵→홀→대기실→본식→원판→피로연) 가족·헬퍼 공유",
    "포토테이블·부모님 편지 등 감성 요소 세팅, 축가·사회자 최종 리허설 통화",
    "신혼여행 캐리어 미리 패킹, 여권·바우처·상비약은 기내 가방에"
  ] },
  { cat: "결혼 후", items: [
    "혼인신고는 대출·청약 유불리(생애최초·신혼특공·신생아 특례) 따져 유리한 시점에",
    "축의금 정산해 양가와 투명하게 나누고, 일주일 내 하객 감사 연락",
    "본식 스냅·DVD 원본 오면 즉시 클라우드+외장하드 이중 백업",
    "전입신고·주소지 변경 처리, 지자체 신혼부부 지원금·이자 지원 신청",
    "부부 공동 통장·생활비 규칙·비상금 계좌 등 재테크 구조 첫 달에 세팅",
    "연말정산 혼인 세액공제(1인 50만)·결혼 지출 증빙 정리",
    "업체 후기 작성으로 페이백·추가 혜택 회수"
  ] }
];
const WEDDING_TIPS = [
  "스드메·스냅 계약서엔 '기본 포함 항목'과 추가금(헬퍼비·얼리스타트비·원본 구입비)을 반드시 서면으로 — 당일 추가 결제 폭탄 예방",
  "웨딩홀 보증인원은 낮춰 잡기 — 초과는 추가 결제하면 되지만 미달분은 그대로 손해",
  "인기 본식 스냅·DVD는 웨딩홀보다 먼저 마감되기도 — 홀 계약 당일 바로 문의가 국룰",
  "혼인신고 하루 차이로 대출 조건이 달라질 수 있음 — 신혼집 대출 전략 먼저, 신고 시점은 나중에",
  "모든 결제는 페이백·제휴 포인트·카드 실적 겹쳐 챙기고, 후기 페이백 마감일은 캘린더에 등록",
  "웨딩홀 견적은 총액끼리 비교하지 말 것 — 홀마다 보증인원이 달라서, 같은 하객 수로 맞춰 다시 계산하면 순위가 바뀌어요(투어 비교표의 '같은 인원으로 환산')",
  "견적 협상: 예약 경로 확인, 비수기·비선호 시간대, 잔여타임 혜택, 식대·대관료·보증인원 조정 — '가격이 제일 중요하다'고 먼저 말하고 '조정 가능한 부분이 있나요?'를 한 번 더",
  "당일 계약 혜택이 커도 투어 마지막 순서로 정해요. 공정위 소비자분쟁해결기준에서는 예식일 150일 전까지 취소하면 계약금을 전액 돌려받아요. 그 뒤 취소는 시기에 따라 총비용의 10~35%가 위약금이에요. 업체 약관이 이보다 불리하면 다툴 수 있으니 계약서의 환불 규정을 확인해요.",
  "웨딩밴드는 첫 투어에서 바로 계약하지 말고 비교 — 당일 할인보다 여러 곳 착용 비교가 후회를 줄여요",
  "드레스투어는 사진 촬영 가능 여부·피팅비를 예약 전에 확인 — 촬영 불가인 샵이 생각보다 많아요",
  "웨딩촬영 시안은 장소별 원하는 컷·드레스·헤어변형을 매칭해 미리 만들어 가기 — 기본 시간 안에 추가금 없이 소화하기 쉬워요",
  "신랑 관리: 제모는 붉은 기가 3일쯤 가서 촬영 4일 전, 곱슬이면 다운펌, 대여 예복은 구겨지지 않게 차로 이동"
];
const WEDDING_VENUES = [
  { name: "아펠가모 광화문", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTAxMjNfMTI5%2FMDAxNzM3NjMyNjg1NTA2.2okgXjzK5zsWfKCrzn5a69RrEJ_sBWIOUtGHllln60Mg.Ks29fMqvoWBdJ6cL2z7T0jBCFv464zCl0vJMf-Ga-N4g.JPEG%2F44.jpg&type=sc960_832", area: "종로구", type: "컨벤션", meal: "6~8.5만", fee: "220~770만", cap: "200~400명", note: "도심 접근성 + 검증된 식사 퀄리티 — 직장인 하객 선호 1순위급" },
  { name: "아펠가모 선릉", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxNzA4MTdfMjc5%2FMDAxNTAyOTQ0MTc2OTQ3.O1CXvhxHfz1-oaQBez24jo7WMeLVbX4def1ZXw3eVCcg.o2OfzeS0z9h4S21iWxFkiFNuMOu3d93425Cm-UyFvy0g.JPEG.daewoo7749%2F201781120442958008.jpg&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7~9만", fee: "500~800만", cap: "250~450명", note: "강남권 아펠가모 — 식사 퀄리티 안정적, 회사 하객 접근성 좋음" },
  { name: "더컨벤션 반포", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTAyMjJfMjcg%2FMDAxNzQwMjIwMjQzMjMw.MzKbjMeJwRXRm8aCYyVLWEdD8UP1eS6r5UzvyBH-XyQg.B4f0Lo0jJAVRLXgLS428NWr9YdpXP4eFYsIl7920H8Eg.JPEG%2Foutput_3039599856.jpg&type=sc960_832", area: "서초구", type: "컨벤션", meal: "6.5~8만", fee: "300~600만", cap: "250~500명", note: "고속터미널 직결 — 가성비·접근성으로 재방문 하객 평 좋은 대표 컨벤션" },
  { name: "상록아트홀", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDA3MjdfMTU2%2FMDAxNTk1ODMwMDY1MTkw.nsBAmrvVa01DS8UpimStV88ftveXv-wCPTG7YuSmczsg.pWsENB5NUnKFd0WwMU6yJHZqCN93bzluFB29cEVzSqsg.JPEG.secondphoto%2F200516_%25B9%25DA%25B0%25E6%25B9%25CC%25BD%25C5%25BA%25CE%25B4%25D4_2293.jpg&amp;type=f54_54&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7.5~9.5만", fee: "500~900만", cap: "200~600명", note: "선릉역 인접 · 호텔급 홀 컨디션 — 공무원연금공단 운영으로 거품 없는 가격" },
  { name: "더채플앳청담", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2F20131217_159%2Fwjdtjstnrzz_1387261489537W9t4O_JPEG%2F2013-12-17_15%253B06%253B28.jpg&type=sc960_832", area: "강남구", type: "채플", meal: "8.5~11만", fee: "750~980만", cap: "250~400명", note: "12m 아치형 천고 채플홀 — 채플웨딩 대표 베뉴, 예약 경쟁 치열" },
  { name: "더채플앳논현", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDEwMjFfNzYg%2FMDAxNjAzMjU0MTU5ODAy.HF5w3ThEFZn7LmrSpYLvB5S6QNtq6zwJRbEkBJTGJvkg.iaoDVH153EkWENUHdkmXlwVdncRQ7e4ZUC9mfbn0sxUg.PNG.jassica9411%2Fimage.png&type=sc960_832", area: "강남구", type: "채플", meal: "8~10만", fee: "600~850만", cap: "200~350명", note: "청담 대비 합리적인 채플 — 밝은 채광 홀, 직장인 커플 계약 많음 · 후기 견적(2026.9): 대관 3,250만·식대 13만 — 가로폭이 좁아 하객 많으면 서서 보는 분 생김" },
  { name: "루클라비더화이트", img: "", area: "서울", type: "하우스", meal: "13만", fee: "1,600만", cap: "~300명", note: "2025년 오픈 단독홀 · 8M 층고 자연채광 화이트톤, 뷔페 평 좋음 · 후기 견적(2026.9) — 홀이 아담해 300명 넘으면 고민" },
  { name: "명동 라루체", img: "", area: "중구", type: "하우스", meal: "11만", fee: "1,500만", cap: "~250명", note: "명동역 3번 출구 도보 2~3분, 천장이 열리는 연출 · 후기 견적(2026.9) — 당일 현장 계약해야 할인이라 투어 마지막 순서로, 주말 주차 혼잡" },
  { name: "루이비스컨벤션 강서", img: "", area: "강서구", type: "컨벤션", meal: "9.3만", fee: "1,300만", cap: "~400명", note: "가양역 9번 출구 도보 3분·주차 여유, 8M 층고·26M 버진로드, 식대 가장 저렴 · 후기 견적(2026.9) — 예식 간격이 타이트" },
  { name: "소노펠리체 컨벤션", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDEyMDlfMjE5%2FMDAxNzMzNzMyMDc3NTMy.EVRl3qGgxYcfO-ujsUJ2HAnmFap35ceP9PG-JsgHNWog.BoeoeEYz6T038EUQ1zQXzCIAePfDkt6_VmtYf9wE0_Mg.JPEG%2Fheart-ged753d154_6400202251.jpg&type=sc960_832", area: "강남구", type: "컨벤션", meal: "7.2~9.5만", fee: "800만", cap: "350~800명", note: "삼성역 직결 + '미녀와야수 계단' 로비 — 대규모 하객 수용 강점" },
  { name: "루이비스컨벤션 중구점", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MDVfMjIw%2FMDAxNzU0MzU4NjMzMzgz.6ykx-yHafIoaN9nFHIE5ltdnEhq_cNDtT-j2EN0Zcd8g.auLAT8pDvSwO7MC3oyGrN-PuSHAnCcaNp3ylxttle1Qg.JPEG%2Fsection1%25A3%25DF06.jpg&type=sc960_832", area: "중구", type: "컨벤션", meal: "8.5만 내외", fee: "850만", cap: "200~500명", note: "호텔급 인테리어 단독홀 — 1시간 10분 여유 예식으로 인기" },
  { name: "세빛섬 플로팅아일랜드", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fcafefiles.naver.net%2F20150214_154%2Ffloatingi_1423882231612Eq88k_JPEG%2FIMG_8653.JPG&type=sc960_832", area: "서초구", type: "컨벤션", meal: "6~12만", fee: "200~500만", cap: "100~400명", note: "반포 한강 위 인공섬 — 화이트 돔 + 한강 뷰 이색 베뉴, 야외·루프톱 가능" },
  { name: "노블발렌티 대치", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDExMDJfMTIy%2FMDAxNjA0MzAzNDcxNDM4.Y3XjKyKUFdCnMx76E6-DQutMxxfU7MQqhvPba_PT0e8g.zlEC5Jr-2dZ7AiGW714PLrdf_O4UgFCJ3Vwh2EK0g_8g.JPEG.nazgreling%2FIMG00310.jpg&type=sc960_832", area: "강남구", type: "하우스", meal: "10~12만", fee: "700~1,000만", cap: "200~400명", note: "하우스웨딩 입문 대표 — 호텔 느낌 연출 대비 합리적, 주말 골든타임 조기 마감" }
];
const VENUE_THUMB = {
  호텔: "linear-gradient(135deg,#2E2E2E,#5A5A5A)",
  하우스: "linear-gradient(135deg,#6E6E6E,#9C9C9C)",
  채플: "linear-gradient(135deg,#8C8C8C,#C4C4C4)",
  컨벤션: "linear-gradient(135deg,#474747,#7A7A7A)",
  기타: "linear-gradient(135deg,#808080,#ABABAB)"
};
const RING_AGO = { name: "어고 (AGO)", area: "서촌 (종로구 옥인3길 21, 2·3층)", price: "문의", note: "1:1 예약 상담제 디자이너 웨딩밴드 — 공방에서 손으로 만든다(맞춤 약 4주). 대표 '아워스'는 두 색 금을 한 반지에 잇는 커플링, 아워스(M) 115만원(공식몰, 14K·18K). iF 디자인 어워드 2026 수상", url: "https://www.instagram.com/ago.episode", img: "" };
const BSNAP_PERSONAL = { name: "퍼스널서울", area: "서울", price: "문의", note: "본식 스냅 전문 — 인스타 @personalseoul (팔로워 3천+, 게시물 700+). 상품·가격은 인스타·상담으로 확인", url: "https://www.instagram.com/personalseoul", img: "" };
const BSNAP_FROM_STUDIO = [
  { name: "어도러블 스냅", area: "경기 광주 (출장)", price: "견적 상담", note: "필름 카메라로 찍는 필름 본식·빈티지 웨딩 스냅 — 인스타 소개 '필름본식', 디지털 하이라이트 컷 같이 (adorablesnap.com)", url: "https://www.instagram.com/adorable_snap", img: "" },
  { name: "리저브하우스", area: "강남권", price: "견적 상담", note: "화보 감성 웨딩 촬영 스튜디오 — 공식 사이트 메뉴에 본식스냅·리허설 상품 (reservehaus.com)", url: "https://www.instagram.com/reserve_studio", img: "" },
  { name: "원규스튜디오", area: "강남권", price: "견적 상담", note: "프리미엄 인물 중심 스튜디오(노블레스·디퍼런스 등 4개 브랜드) — 본식스냅 상품 따로 있음", url: "", img: "" }
];
const DRESS_CLAUDIA = { name: "클라우디아웨딩 (Claudia)", area: "지역 문의", price: "견적 상담", note: "웨딩드레스 브랜드 — 2026 S/S 컬렉션(인스타 @claudiawedding_official). 레퍼런스에 컬렉션 사진을 모아 뒀어요", url: "https://www.instagram.com/claudiawedding_official", img: "" };
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
    { name: "타주스튜디오", area: "강남권", price: "견적 상담", note: "밝고 자연스러운 분위기 — 스드메 패키지 단골 구성", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA5MjZfMTgy%2FMDAxNjY0MTczMDM1Mzk1.A1BxIIFwb407UiH-Kr2JfBBjEmZVhbecmHbzqdmlYZQg.SRSwQwIpqwiCqCi15choPCJXCv-cSKWArkWyhorsjVQg.JPEG.milkclean%2FLCW_1089-2.jpg&type=sc960_832" }
  ] },
  dress: { label: "인기 드레스", topic: "dresses", q: "웨딩드레스", items: [
    DRESS_CLAUDIA,
    { name: "로자스포사", area: "청담", price: "견적 상담", note: "국내 대표 프리미엄 드레스 브랜드 — 클래식·볼륨 라인 강점", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA4MDhfNjAg%2FMDAxNjI4NDAyMzk3MTk1.Nz3hqbfZguHQBVz-Sav_xVB2vVV6WFtqgl_5KA7xxfog.fgdV_b-jKBgGWUM4WFcgluqAN62GTTrrDhot-Vi9ghYg.JPEG.deblanc17%2FKakaoTalk_20210808_095354626_%25281%2529.jpg&type=sc960_832" },
    { name: "제시카로렌", area: "청담", price: "견적 상담", note: "모던·미니멀 실루엣으로 인기 — 피팅 예약 조기 마감", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNDAyMTNfMTUz%2FMDAxNzA3ODMyOTA5OTcy.Gw7l2yrF8e209n9t5qzWG3o3gwhPURTVUrilG7x7rSUg.CNdOubEKEeRhmdc-ZpVrp4hv3ZRl-ggBvmNTCWjsqGQg.PNG.netpage%2F20240213225849.png&type=sc960_832" },
    { name: "브라이드메르시", area: "청담", price: "견적 상담", note: "합리적 가격대의 감성 드레스로 후기 많은 샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMzA4MTRfMjI5%2FMDAxNjkxOTg5ODYzNzYw.dcUX9E24cAO01hBnAOMex89KSd0s0Fl7M0-wNwZ1T-sg.24Iu3C5YidwYE5A5VSoeIrwQqQLN_DUQQSVhb3xDU5Ug.JPEG.modern_franc%2FKakaoTalk_20230714_163703565_16.jpg&type=sc960_832" },
    { name: "로즈로사", area: "청담", price: "견적 상담", note: "사랑스럽고 로맨틱한 스타일 전문 드레스샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMjA1MjRfMjUy%2FMDAxNjUzMzUxMjAzNDU3.fdpxQxqx2OY5btZjsUU12AOrTtw70qQYpBrzuWbJM4Ig.Li1WvCsbklLHjlMzestTppg15c0UN5xWAsUQagNVX6Qg.JPEG.smile_0117%2FIMG_1271.JPG&type=sc960_832" },
    { name: "에스메랄다", area: "강남권", price: "견적 상담", note: "스드메 패키지 단골 구성 — 다양한 라인 보유", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAxOTEyMTJfMjEw%2FMDAxNTc2MTQzNTg3Mjc4.PewT_yT8yWAUsqSYkUbfmQw4BYo_AXEEtYNU8kyCEOUg.I8spYM5osSTvj3FHfAPiF8qgGqzVs2rFsTwBgJdpqRwg.JPEG.kwonhsp%2FCHIMAMANDA-C.jpg&type=sc960_832" },
    { name: "마틴드세븐", area: "강남권", price: "견적 상담", note: "화려한 비즈·레이스 디테일 — 패키지 인기 드레스샵", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMTA0MDlfMjk4%2FMDAxNjE3OTUxMjI2Njkz.IrtwOOSbpwyvVD66S1sT6cS49o6PKwault94IRaVlKog.PJANvQ-MLIYtAmBkqTPXtAKPECQ2Y-6_-IguahHrMYMg.JPEG.with_iwedding%2F%25B8%25B6%25C6%25BE%25B5%25E510_%25282%2529.JPG&type=sc960_832" },
    { name: "메종레브", area: "청담", price: "견적 상담", note: "오뜨꾸튀르·럭셔리 맞춤 — 1:1 컨설팅과 프라이빗 피팅룸", img: "" },
    { name: "플로렌스", area: "청담", price: "견적 상담", note: "고급 실크·자수 디테일 — 신부 체형을 살리는 디자인", img: "" }
  ] },
  snap: { label: "제주 스냅", topic: "snaps", q: "웨딩 스냅", items: [
    { name: "언트 (ONT)", area: "제주", price: "문의", note: "제주 야외 웨딩스냅 — 26년 하반기·27년 얼리버드 이벤트 중 (인스타 소개 기준)", url: "https://www.instagram.com/ont.kr", img: "" },
    { name: "단편하다 [斷片]", area: "제주", price: "문의", note: "제주 야외 스냅·영상 — 숲·해안·들판 로케이션. 27년 상반기 예약 중, 카카오 채널 상담", url: "https://www.instagram.com/danpyeonhada", img: "" },
    { name: "울필름", area: "제주 (서울 촬영도 표기)", price: "문의", note: "프리웨딩 디지털+필름, 따뜻한 빈티지톤 — 4시간·3곳, 헤메·드레스·부케 포함 상품 있음", url: "https://www.instagram.com/woollfilm", img: "https://ugc.production.linktr.ee/c07ea21e-f7d3-4dbf-a430-7477a5d7d59c_DSCF0826.jpeg" },
    { name: "인디고브릿지", area: "제주", price: "문의", note: "제주 웨딩스냅·스튜디오 + 드론 영상 옵션 — 26년 하반기 예약 진행 중", url: "https://www.instagram.com/indigo_bridge_snap", img: "" },
    { name: "노마하우스", area: "대구 중구", price: "본식스냅 230만", note: "트렌디 스튜디오 화보(팔로워 12만). 정찰제 — 스튜디오 290~450만, 아이폰스냅 25만, 작가 지정 +30/80만", url: "https://www.instagram.com/noma.house", img: "" },
    { name: "수와선 스튜디오", area: "서울 연희동", price: "문의", note: "클래식 스튜디오 웨딩 촬영(드레스 포함) — 상품·비용은 suwasunstudio.com", url: "https://www.instagram.com/suwasunstudio", img: "" },
    { name: "데이문", area: "지역 문의", price: "문의", note: "여성 작가의 인물 중심 야외 커플·웨딩스냅 — 웨딩 전용 @our_daymoon, 카카오 채널 예약", url: "https://www.instagram.com/daymoon_pic", img: "" }
  ] },
  // 사용자가 모아둔 작가 — 2026-09 인스타·웹 조사, 가격은 노마하우스 외 미공개
  // 본식 스냅 — 사진 스냅(제주 야외)과 따로 고른다. 2026-10 인스타·블로그 소개 기준
  bsnap: { label: "본식 스냅", topic: null, q: "본식 스냅", items: [
    { name: "노마하우스", area: "대구 중구", price: "본식스냅 230만", note: "트렌디 스튜디오 화보(팔로워 12만). 정찰제 — 아이폰스냅 25만, 작가 지정 +30/80만", url: "https://www.instagram.com/noma.house", img: "" },
    { name: "기억 (@__gieok)", area: "제주 (출장 지역은 문의)", price: "본식 100만", note: "신부대기실·리허설·본식, 세부수정 30장 + 색감수정 30장, 보정 최대 3개월. 원판 +20만. 사진 스냅과 같이 하면 10만 할인 (예약 안내 블로그 기준)", url: "https://www.instagram.com/__gieok", img: "" },
    { name: "@brightbride.snap", area: "지역 문의", price: "문의", note: "DM 공유 게시물: '결혼식에 노을이 내린다면?' — 본식 스냅", url: "https://www.instagram.com/brightbride.snap", img: "" },
    { name: "@cheesebutter_snap (아이폰 스냅)", area: "지역 문의", price: "문의", note: "DM 공유 게시물: '자연스러운 그날의 분위기를 담아요' — 아이폰 본식 스냅", url: "https://www.instagram.com/cheesebutter_snap", img: "" },
    { name: "@habit_film", area: "지역 문의", price: "문의", note: "DM으로 공유받은 스냅·영상 계정 — 본식 영상도 같이 문의", url: "https://www.instagram.com/habit_film", img: "" },
    ...BSNAP_FROM_STUDIO,
    BSNAP_PERSONAL
  ] },
  // 스냅 스드메 — 사진 스냅(제주) 촬영 날 드레스와 헤어·메이크업. 기억스냅 예약 안내 블로그의 '드레스 메이크업 제휴' 목록(2026-10-02 확인)
  // 제주 스냅 촬영 날은 드레스·헤메를 한 샵에서 같이 하는 경우가 많아 한 목록으로 본다(2026-10-03, 예전 smakeup 은 여기로 합침)
  sdress: { label: "제주 스냅 드레스·헤메", topic: null, q: "제주 스냅 드레스 헤어메이크업", items: [
    { name: "제주유일", area: "제주", price: "문의", note: "드레스 + 헤어·메이크업 같이", url: "https://www.instagram.com/jeju_you1", img: "", partner: "__gieok" },
    { name: "웨딩커넥트", area: "제주", price: "문의", note: "드레스 + 헤어·메이크업 같이 — 동행·2부 드레스도", url: "https://www.instagram.com/wedding__connect__", img: "", partner: "__gieok" },
    { name: "포아모르", area: "제주", price: "문의", note: "웨딩샵(드레스) + 헤어·메이크업 같이", url: "https://www.instagram.com/por__amor_jeju", img: "", partner: "__gieok" },
    { name: "캄포데피오리", area: "제주", price: "문의", note: "드레스 — 인스타 팔로워 1.9만", url: "https://www.instagram.com/campodefiori_jeju", img: "", partner: "__gieok" },
    { name: "드이베 제주 (Deibe)", area: "제주", price: "문의", note: "드레스 — 인스타 팔로워 1.2만", url: "https://www.instagram.com/deibe_jeju", img: "", partner: "__gieok" },
    { name: "고지형웨딩라인", area: "제주", price: "문의", note: "웨딩샵 — 드레스·헤메 중 무엇을 하는지 인스타에서 확인", url: "https://www.instagram.com/jeju__kojihyeong_wedding", img: "", partner: "__gieok" },
    { name: "더누아 (thenuah)", area: "제주", price: "문의", note: "드레스·헤메 중 무엇을 하는지 인스타에서 확인", url: "https://www.instagram.com/thenuah__", img: "", partner: "__gieok" },
    { name: "플러프 (FLUFF)", area: "제주", price: "문의", note: "헤어·메이크업", url: "https://www.instagram.com/fluff_jeju", img: "", partner: "__gieok" },
    { name: "포레스트 랩", area: "제주", price: "문의", note: "메이크업 — 인스타 팔로워 1.1만", url: "https://www.instagram.com/forest_lab_", img: "", partner: "__gieok" },
    { name: "히쁨 스타일리스트 수희", area: "제주", price: "문의", note: "헤어 변형(촬영 중 머리 바꾸기)", url: "https://www.instagram.com/stylist__soohee", img: "", partner: "__gieok" },
    { name: "단숨 메이크업", area: "제주", price: "문의", note: "메이크업·스타일링", url: "https://www.instagram.com/dansum_makeup", img: "", partner: "__gieok" }
  ] },
  // 본식 아이폰 스냅·DVD·양복, 제주 스냅 양복 — 2026-10-06 네이버 블로그 후기·인스타 계정으로 고른 인기 업체(가격은 후기·공개 기준, 없으면 문의)
  biphone: { label: "본식 아이폰 스냅", topic: null, q: "아이폰스냅", items: [
    { name: "엘프스냅", area: "서울", price: "41만 (당일 예약 38만)", note: "예식 1시간 30분 전~연출 촬영, 원본 컷 무제한, 신부픽 보정 20장·릴스 영상. 연회장 +7만 — DM으로 공유받은 블로그 후기", url: "https://www.instagram.com/elf_snap", img: "" },
    { name: "메이븐 스냅", area: "서울", price: "대표 36.9만 · 실장 31.9만 (후기)", note: "보정 20장 + 올드디카 20장, 식전 프리뷰·하이라이트 필름, 예식 60분 전~원판", url: "https://www.instagram.com/maiven.snap", img: "" },
    { name: "럽옵럽 스냅", area: "서울", price: "대표 34만 (후기)", note: "보정 25장 + 빈티지디카 40장 + 캠코더 영상, 예식 90분 전~원판", url: "https://www.instagram.com/loveoflove_snap", img: "" },
    { name: "멜로즈 스냅", area: "서울", price: "문의", note: "아이폰·서브 스냅 — 20곳 비교 후 고른 후기(2026-09)", url: "https://www.instagram.com/melrose_snap", img: "" },
    { name: "히나 스냅", area: "서울", price: "18만 (후기)", note: "가성비 아이폰·서브 스냅, 사진 빨리 받음(후기)", url: "https://www.instagram.com/_hinasnap", img: "" }
  ] },
  bdvd: { label: "본식 DVD", topic: null, q: "본식 DVD", items: [
    { name: "모먼트무브", area: "서울", price: "스탠다드 49만 + 부가세 (후기)", note: "서울 가성비 본식 DVD로 후기 많음", url: "https://www.instagram.com/momentmove_", img: "" },
    { name: "존존픽쳐스", area: "서울 (대전·대구·부산)", price: "문의", note: "특이한 웨딩 영상 — 퍼스널서울 본식 DVD 후기(2026-10)", url: "https://www.instagram.com/zonzonpictures_official", img: "" },
    { name: "드뉴필름 (구 스냅스타)", area: "서울 외 지점 다수", price: "문의", note: "4K·2캠 가성비 본식 DVD로 자주 언급(후기)", url: "https://www.instagram.com/denu_film", img: "" },
    { name: "르랑필름", area: "서울", price: "30~40만대 (후기)", note: "가성비 본식 DVD(2026-09 후기)", url: "https://www.instagram.com/lelang_film", img: "" }
  ] },
  bsuit: { label: "본식 양복", topic: null, q: "신랑 예복 맞춤정장", items: [
    { name: "아틀레 청담 본점", area: "청담", price: "맞춤 40~50만대 (후기)", note: "대여·맞춤 패키지 다양 — 후기에서 '국민 브랜드', 발렛 주차", url: "", img: "" },
    { name: "아벨로 청담", area: "청담", price: "문의", note: "맞춤 계약하면 촬영 예복 대여 벌수·횟수 무제한(후기), 영국·이태리 원단", url: "", img: "" },
    { name: "헤리츠테일러 청담", area: "청담", price: "문의", note: "맞춤 예복 + 촬영 예복 대여·턱시도 대여", url: "https://www.instagram.com/heritztailor_", img: "" },
    { name: "해리슨테일러", area: "청담 (종로 등)", price: "문의", note: "맞춤 정장·웨딩 세레모니 라인", url: "https://www.instagram.com/harrisontailor_official", img: "" },
    { name: "워드로브 청담", area: "청담", price: "문의", note: "1인 테일러샵 맞춤 예복·예복 대여(비제휴 후기)", url: "https://www.instagram.com/wardrobe_cheongdam", img: "" },
    { name: "슈트패브릭", area: "서울 (제주 대여점 있음)", price: "문의", note: "맞춤정장·정장 대여 — 제주 스냅 수트도 같은 브랜드", url: "https://www.instagram.com/suitfabric_official", img: "" }
  ] },
  ssuit: { label: "제주 스냅 양복", topic: null, q: "제주 스냅 수트 대여", items: [
    { name: "슈트패브릭 제주", area: "제주", price: "문의", note: "제주 스냅 신랑 정장 대여(후기)", url: "https://www.instagram.com/suitfabric_jeju", img: "" },
    { name: "더수트옴므", area: "제주", price: "문의", note: "제주 맞춤정장 · 촬영용 수트 대여(후기)", url: "https://www.instagram.com/thesuit_homme_official", img: "" },
    { name: "오드리테일러", area: "제주", price: "수트 7.7만 (후기)", note: "제주 웨딩드레스·헤어메이크업 같이 — 수트 대여도", url: "https://www.instagram.com/audreytailor_jejuwedding", img: "" },
    { name: "하이재이 옴므", area: "제주", price: "문의", note: "제주 수트 — 하이재이(제주 드레스·헤메 토탈샵)의 남성 라인", url: "https://www.instagram.com/hi_jay_homme", img: "" },
    { name: "릴리엔", area: "제주", price: "문의", note: "드레스·헤메 + 신랑 수트 같이(후기)", url: "https://www.instagram.com/_lilli___n", img: "" }
  ] },
  // 스냅 부케 — 제주 스냅 촬영 날 들 부케. 생화는 대부분 주문 제작, 대여는 조화가 많다(2026-10-03 인스타·블로그 후기 조사, 가격은 공개·후기 기준)
  sbouquet: { label: "제주 스냅 부케", topic: null, q: "제주 스냅 부케", items: [
    { name: "모리티 (MOLITI)", area: "제주", price: "1박 2일 대여 3.3만", note: "부케 대여 — 고급 안개꽃 어레인지(생화 여부는 문의). 제주공항 15분, DM 문의 · 2026-09 대여 시작", url: "https://www.instagram.com/mo__liti", img: "" },
    { name: "로즈데이플라워", area: "제주", price: "4만원대~ (후기)", note: "생화 부케 가성비로 후기 많음 — 제주시 연화남길 3, 24시 픽업. 9월 촬영 냉해 후기 1건", url: "https://www.instagram.com/rosedayflower_jeju", img: "" },
    { name: "더가든317", area: "제주", price: "11만 (후기)", note: "제주 스냅 생화 부케 전문 — 곶자왈·자연 무드", url: "https://www.instagram.com/the_garden317", img: "" },
    { name: "목화수반", area: "제주", price: "문의", note: "제주꽃집 — 웨딩 부케·플라워 디렉팅, 카카오 채널 예약. 제주 스냅 생화 부케 후기 있음", url: "https://www.instagram.com/mokhwasuban", img: "" },
    { name: "비올론플라워", area: "제주", price: "문의", note: "제주 부케·웨딩 플라워 — 부케 계정 @violon_bouquet_, 전 상품 예약제(오픈채팅)", url: "https://www.instagram.com/violon_flower", img: "" },
    { name: "핱트 (Hatt)", area: "제주", price: "문의", note: "제주 부케·플라워 디렉팅 — 제주 스냅 생화 부케 후기 있음", url: "https://www.instagram.com/hatt__flower", img: "", partner: "__gieok" },
    { name: "마크유어캘린더", area: "제주", price: "문의", note: "제주 부케·제주 스튜디오", url: "https://www.instagram.com/m.y.calendar", img: "", partner: "__gieok" },
    { name: "블루밍앨리스", area: "제주", price: "문의", note: "제주 부케·플라워 디렉팅", url: "https://www.instagram.com/blooming_alice", img: "", partner: "__gieok" },
    { name: "플로화", area: "제주", price: "문의", note: "제주꽃집 — 웨딩 부케·꽃다발", url: "https://www.instagram.com/flohwa_yun", img: "", partner: "__gieok" }
  ] },
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
    { name: "순수 (SOONSOO)", area: "청담", price: "견적 상담", note: "세련된 헤어 스타일링으로 인기 — 본식 새벽 타임 조기 마감", img: "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyMDA3MTVfMjQ1%2FMDAxNTk0ODE4ODUxNTk3.mvksOBKJxCLYlnFKV3lnkR6YqK_OwbQhz8Blsy8qLWog.WMKBg1TmP4rcWmcxsSbHGNqqqOSkxLoQC-s807QpvfEg.JPEG.donggeon222%2FIMG_7887.JPG&type=sc960_832" }
  ] },
  // 청첩장·결혼반지 — 2026-10 공식 홈페이지·인스타그램에서 확인한 내용만(가격은 공개된 것만, 없으면 "문의"). 웹 리서치 주제가 없어 [최신 정보로 갱신]은 안 보인다
  // 웨딩플래너 — 업체와 담당 플래너를 같이 적는다(담당자 칸). 인스타 DM으로 공유받은 분부터
  planner: { label: "웨딩플래너", topic: null, q: "웨딩플래너", items: [
    { name: "베리굿웨딩 · 한수아 팀장", area: "베리굿웨딩", price: "문의", note: "인스타 @hsuah_pl (DM으로 공유받음) — 베리굿웨딩 제휴 스드메 사진은 드레스·메이크업 탭에서", url: "https://www.instagram.com/hsuah_pl", img: "" }
  ] },
  invite: { label: "청첩장", topic: null, q: "청첩장 디자인", items: [
    { name: "바른손카드", area: "온라인 (종이)", price: "문의", note: "1970년부터 이어온 청첩장 브랜드 — 샘플·모바일 청첩장·식권 무료", url: "https://www.barunsoncard.com/", img: "" },
    { name: "보자기카드", area: "온라인 (종이)", price: "문의", note: "무료 샘플·배송, 모바일 청첩장·식전 영상 무료 (홈페이지 안내 기준)", url: "https://bojagicard.com/card/", img: "" },
    { name: "잇츠카드", area: "온라인 (종이)", price: "문의", note: "4장부터 주문하는 셀프 청첩장 — 적은 수량도 부담 없이", url: "https://www.instagram.com/itscard_official", img: "" },
    { name: "디어디어 (DEARDEER)", area: "온라인 (종이)", price: "문의", note: "디자인 청첩장 — 100장 약 7.5~15.5만(홈페이지 기준), 주문하면 모바일 청첩장 무료", url: "https://www.instagram.com/deardeerkr", img: "" },
    { name: "카드마켓", area: "온라인 (종이)", price: "문의", note: "청첩장 샘플, 식전 영상·모바일 청첩장 무료 제작", url: "https://www.cardmarket.kr/", img: "" },
    { name: "데어무드", area: "온라인 (모바일)", price: "문의", note: "모바일 청첩장 — 시안을 무료로 먼저 만들고 마음에 들면 결제, 산 뒤 수정 무제한", url: "https://theirmood.com/", img: "" },
    { name: "투아워게스트", area: "온라인 (모바일)", price: "문의", note: "모바일 청첩장 — 만원대(홈페이지 기준), 산 뒤 1년 무료 수정, 사진 60장", url: "https://www.instagram.com/toourguest", img: "" },
    { name: "살롱드레터", area: "온라인 (모바일)", price: "문의", note: "모바일 청첩장 — 첫 시안 15분, 하객 사진 올리기·참석 여부 받기", url: "https://salondeletter.com/", img: "" }
  ] },
  ring: { label: "결혼반지", topic: null, q: "결혼반지 커플링", items: [
    { name: "아크레도 (acredo)", area: "종로·청담·백화점", price: "문의", note: "독일 맞춤 제작 웨딩밴드 — 소재·폭·표면·다이아 세팅을 골라 만든다, 청담 플래그십 6개 층", url: "https://www.acredokorea.com/", img: "" },
    { name: "골든듀", area: "백화점·온라인", price: "문의", note: "국내 주얼리 브랜드 — 공식 온라인몰에 웨딩·커플링 따로 있음", url: "https://goldendewshop.com/", img: "" },
    { name: "누니주얼리", area: "한남·백화점", price: "문의", note: "2011년 시작한 디자이너 브랜드 — 자연의 질감을 담은 웨딩밴드 (인스타 팔로워 6만+)", url: "https://www.instagram.com/nooneejewelry", img: "" },
    { name: "소그노 (SOGNO)", area: "삼청동·강남", price: "문의", note: "2007년부터 이어온 디자이너 웨딩 주얼리 — 자연에서 따온 디자인", url: "https://www.instagram.com/sognojewelry_official", img: "" },
    { name: "레브가 다이아몬드", area: "청담", price: "문의", note: "디자인 등록 웨딩밴드·천연 다이아 맞춤 — 제품 약 110~670만(홈페이지 기준)", url: "https://www.instagram.com/revga_official", img: "" },
    { name: "디유953 (DU953)", area: "청담", price: "문의", note: "랩다이아·천연 다이아 반지와 웨딩밴드, 각인 맞춤 — 제품 약 60~400만+(홈페이지 기준)", url: "https://www.instagram.com/du953", img: "" },
    { name: "아뜰리에호수", area: "혜화·잠실·성수·홍대 등", price: "문의", note: "반지 공방 — 서로의 반지를 직접 만들고 각인까지, 전국 12개 지점", url: "https://www.instagram.com/atelier_hosoo", img: "" },
    RING_AGO
  ] }
};
const vendorNameKey = (s) => {
  let t = String(s || "").replace(/[([][^)\]]*[)\]]/g, (m) => /[가-힣]/.test(m) ? m : "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/(스튜디오|studio|스냅|snap)$/, "");
  }
  return t;
};
const sameVendor = (a, b) => {
  const ka = vendorNameKey(a.name), ha = ((String(a.url || "").match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1] || "").toLowerCase();
  const hb = ((String(b.url || "").match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1] || "").toLowerCase();
  return !!ka && ka === vendorNameKey(b.name) || !!ha && ha === hb;
};
function dedupeVendorList(list) {
  const out = [], remap = {}, gone = [];
  (list || []).forEach((x) => {
    const i = out.findIndex((k2) => sameVendor(k2, x));
    if (i < 0) {
      out.push(x);
      return;
    }
    const k = out[i], pick = (f) => {
      const a = k[f], b = x[f], has = (v) => v != null && v !== "";
      return has(a) && has(b) ? x.custom && !k.custom ? b : a : has(a) ? a : b;
    };
    out[i] = { ...k, ...Object.fromEntries(["price", "note", "img", "url", "lookup", "memo"].map((f) => [f, pick(f)]).filter(([, v]) => v !== void 0)), ...k.custom || x.custom ? { custom: true } : {} };
    remap[x.id] = k.id;
    gone.push(x);
  });
  return { list: out, remap, gone };
}
(() => {
  const r = dedupeVendorList([
    { id: "snap2", name: "울필름", url: "https://www.instagram.com/woollfilm", price: "문의", note: "기본" },
    { id: "u1", name: "@woollfilm", url: "https://instagram.com/woollfilm/", price: "250만", note: "", custom: true },
    { id: "s1", name: "피아스튜디오", img: "" },
    { id: "s2", name: "피아 (PIA) studio", img: "x.jpg" },
    { id: "s3", name: "스튜디오" }
  ]);
  if (!(r.list.length === 3 && r.list[0].id === "snap2" && r.list[0].price === "250만" && r.list[0].note === "기본" && r.list[1].img === "x.jpg" && r.remap.u1 === "snap2" && r.remap.s2 === "s1")) console.error("dedupeVendorList 실패", r);
})();
const VENDOR_THUMB = {
  studio: "linear-gradient(135deg,#2E2E2E,#5A5A5A)",
  dress: "linear-gradient(135deg,#8C8C8C,#C4C4C4)",
  makeup: "linear-gradient(135deg,#6E6E6E,#9C9C9C)",
  snap: "linear-gradient(135deg,#3A3A3A,#7A7A7A)",
  invite: "linear-gradient(135deg,#7A7A7A,#B5B5B5)",
  ring: "linear-gradient(135deg,#4A4A4A,#8F8F8F)",
  bsnap: "linear-gradient(135deg,#3A3A3A,#7A7A7A)",
  sdress: "linear-gradient(135deg,#8C8C8C,#C4C4C4)",
  sbouquet: "linear-gradient(135deg,#7A7A7A,#B5B5B5)",
  biphone: "linear-gradient(135deg,#4A4A4A,#8A8A8A)",
  bdvd: "linear-gradient(135deg,#2E2E2E,#6A6A6A)",
  bsuit: "linear-gradient(135deg,#1F1F1F,#575757)",
  ssuit: "linear-gradient(135deg,#3A3A3A,#7A7A7A)",
  planner: "linear-gradient(135deg,#5A5A5A,#9A9A9A)"
};
const VENDOR_SEGS = [
  ["본식", [["venue", "🏛", "식장"], ["dress", "👗", "드레스"], ["bsuit", "🤵", "양복"], ["makeup", "💄", "메이크업"], ["bsnap", "🎞", "본식 스냅"], ["biphone", "📱", "아이폰 스냅"], ["bdvd", "🎬", "DVD"]]],
  // 스튜디오 촬영은 안 한다(2026-10-02) — 사진은 제주 사진 스냅으로
  ["제주 스냅", [["snap", "📷", "제주 스냅"], ["sdress", "👗", "제주 스냅 드레스·헤메"], ["ssuit", "🤵", "제주 스냅 양복"], ["sbouquet", "💐", "제주 스냅 부케"]]],
  ["그 외", [["planner", "🧑‍💼", "플래너"], ["invite", "💌", "청첩장"], ["ring", "💍", "반지"], ["refs", "📌", "참고 자료"]]]
];
const VENDOR_REF = { venue: ["hall"], dress: ["bdress"], makeup: ["bhair"], bsnap: ["bsnap"], snap: ["jsnap"], sdress: ["jdress"], sbouquet: ["bouquet"], ring: ["ring"], refs: ["info", "etc"] };
const SNAP_SDM = ["sdress", "ssuit", "sbouquet"];
const IG_EMBED_KINDS = [...SNAP_SDM, "bsuit", "biphone", "bdvd"];
const SNAP_PARTNERS = {
  __gieok: { name: "기억스냅", src: "https://m.blog.naver.com/hongjibum36/223885142748", groups: [
    ["영상", [["서로에게", "seoroegae"], ["Fosh", "fosh__studio"], ["이호필름", "eho_film"], ["씨네모브", "cine_mauve"], ["무르 스튜디오", "moorrstudio"], ["밤수영", "bamsooyoung"], ["환곰필름", "hwangom_film"], ["하루필름", "_harufilm_jeju"], ["그날그순간", "thatday.moment"]]]
  ] }
};
const VENDOR_DETAIL_KEY = "wedding-vendor-detail-v1";
const VENDOR_STATUS = ["상담 중", "가계약", "계약 완료", "잔금까지 완료"];
const VENDOR_CONTRACT = ["아직 없음", "사본·사진 받음", "원본 보관 중"];
const VENDOR_EVENTS = {
  venue: ["투어·상담", "계약", "시식", "식순·연출 미팅", "예식"],
  studio: ["상담", "촬영", "사진 고르기(셀렉)", "앨범 받기"],
  dress: ["상담·피팅", "촬영 드레스 고르기", "가봉", "본식 드레스 고르기"],
  makeup: ["상담", "리허설 메이크업", "본식 메이크업"],
  bsnap: ["상담", "본식 촬영", "원본 받기", "보정본 받기"],
  snap: ["상담", "촬영일", "원본 받기", "보정본 받기"],
  sdress: ["상담", "드레스 고르기·피팅", "촬영일"],
  sbouquet: ["상담·주문", "부케 받기", "촬영일"],
  ssuit: ["피팅·예약", "촬영일"],
  bsuit: ["상담·원단 고르기", "가봉", "촬영 예복 대여", "찾기"],
  biphone: ["상담", "본식 촬영", "보정본 받기"],
  bdvd: ["상담", "본식 촬영", "영상 받기"],
  planner: ["첫 상담", "업체 투어 동행", "본식 당일 동행"],
  invite: ["샘플 받기", "시안 확정", "인쇄본 받기"],
  ring: ["매장 방문", "주문", "받기"]
};
const CONSULT_WAYS = ["방문", "전화", "카톡", "DM", "메일"];
const vendorDetailSeed = (kind) => ({
  status: "상담 중",
  total: 0,
  contact: "",
  phone: "",
  contract: "아직 없음",
  files: [],
  memo: "",
  consults: [],
  events: (VENDOR_EVENTS[kind] || ["상담"]).map((label, i) => ({ id: `e${i}`, label, date: "", time: "", done: false })),
  pays: [{ id: "p0", label: "계약금", amt: 0, date: "", paid: false }, { id: "p1", label: "잔금", amt: 0, date: "", paid: false }]
});
(() => {
  const b = [{ id: "wb38", link: "snap", budget: 120, paid: true }, { id: "wb20", link: "dress", budget: 300 }];
  const r = budgetToDetails(b, { snap: { name: "기억" }, dress: { name: "A" } }, { "dress|A": { ...vendorDetailSeed("dress"), total: 280 } });
  if (!(r["snap|기억"].total === 120 && paidOf(r["snap|기억"]) === 120 && r["dress|A"].total === 280 && budgetToDetails(b, {}, r) === r)) console.error("budgetToDetails 실패", r);
})();
const HONEYMOON_DEFAULT = [
  {
    id: "h1",
    place: "몰디브",
    cost: 1200,
    season: "11~4월 (건기)",
    note: "수상 풀빌라 휴양 · 수상비행기 이동",
    star: false,
    flight: "1인 90~150만 (경유)",
    days: "5박 7일",
    route: "인천 → 싱가포르/두바이 경유 → 말레 → 수상비행기·스피드보트로 리조트 이동. 4박 수상빌라 + 2박 비치빌라 조합이 국룰. 올인클루시브 추천",
    booking: "리조트는 6개월+ 전 얼리버드가 가장 저렴. 수상비행기 연결을 위해 말레 오후 3시 이전 도착 항공으로. 허니문 특전(디너·데코) 요청은 예약 시 미리. 도착 96시간 전부터 IMUGA(입국 신고서, 무료)를 작성해요. 관광비자는 도착할 때 30일짜리를 무료로 받아요."
  },
  {
    id: "h2",
    place: "하와이",
    cost: 1e3,
    season: "연중 (4~6월 가성비)",
    note: "휴양 + 관광 밸런스 · 직항 8시간",
    star: false,
    flight: "1인 100~160만 (직항)",
    days: "6박 8일",
    route: "인천 → 호놀룰루 직항. 오아후 3~4박(와이키키·노스쇼어·쿠알로아랜치) → 주내선으로 마우이 or 빅아일랜드 2~3박(할레아칼라 일출·화산국립공원). 렌터카 필수",
    booking: "항공은 4~6개월 전 발권이 적정가. 4~6월·9~11월이 비수기 가성비 구간. 인기 레스토랑(마마스피시하우스 등)은 1~2개월 전 예약. 출발 72시간 전까지 ESTA(US$40)를 받아요."
  },
  {
    id: "h3",
    place: "칸쿤",
    cost: 1100,
    season: "12~4월 (건기)",
    note: "올인클루시브 리조트 · 경유 필수",
    star: false,
    flight: "1인 150~220만 (경유)",
    days: "6박 8일",
    route: "인천 → 댈러스/멕시코시티 경유 → 칸쿤. 호텔존 올인클루시브 4~5박 + 치첸이트사·세노테 데이투어 1일 + 이슬라 무헤레스 카타마란 1일",
    booking: "올인클루시브는 3~5개월 전 프로모션 노리기. 성수기(12~4월) 피하려면 11월 초 추천. 댈러스 등 미국을 거치면 환승만 해도 ESTA(미국 전자여행허가, US$40)가 필요해요. 멕시코 입국 자체는 한국 여권이면 비자가 없어도 돼요."
  },
  {
    id: "h4",
    place: "이탈리아 + 스위스",
    cost: 1300,
    season: "5~6월 · 9~10월",
    note: "관광 중심 · 10일 이상 일정 추천 · 이탈리아만 가면 2인 약 950만",
    star: false,
    flight: "1인 90~140만 (직항/1회 경유)",
    days: "9박 11일",
    route: "인천 → 로마 in (2박, 바티칸·콜로세움) → 피렌체 2박(토스카나) → 베네치아 1박 → 기차로 밀라노 경유 → 스위스 인터라켄 3박(융프라우·그린델발트) → 취리히 out",
    booking: "5~6월·9~10월이 날씨·가격 최적. 스위스 기차패스·융프라우 티켓은 출발 2~3개월 전 구매, 도시 간 이동은 유레일보다 구간권 비교. 스위스를 빼고 이탈리아만(로마 2박·피렌체 2박·아말피 2박·베네치아 2박, 로마 out) 구성하면 2인 약 900~1,000만으로 300만가량 절약 — 산악열차·스위스 물가가 빠지는 대신 남부 해안이 들어가 일정도 여유로움. 솅겐 지역은 180일 중 90일까지 비자 없이 머물러요. 2025-10부터 EES(출입국 얼굴·지문 등록)를 해요. ETIAS(유럽 전자여행허가)는 아직 시작 전이라 출발 전에 다시 확인해요."
  },
  {
    id: "h7",
    place: "이탈리아 단독",
    cost: 950,
    season: "5~6월 · 9~10월",
    note: "관광+미식 집중 · 스위스 대비 -350만",
    star: false,
    flight: "1인 90~140만 (직항/1회 경유)",
    days: "8박 10일",
    route: "인천 → 로마 in (2박, 바티칸·콜로세움) → 피렌체 2박(우피치·토스카나 근교) → 아말피/포지타노 2박(해안 드라이브) → 베네치아 2박(곤돌라·부라노) → 로마 or 베네치아 out",
    booking: "5~6월·9~10월이 날씨·가격 최적, 7~8월 남부는 폭염·성수기라 비추. 도시 간 고속열차(이탈로/트렌이탈리아)는 조기 발권 시 반값. 아말피 숙소는 3~4개월 전 마감. 솅겐 지역은 180일 중 90일까지 비자 없이 머물러요. 2025-10부터 EES(출입국 얼굴·지문 등록)를 해요. ETIAS(유럽 전자여행허가)는 아직 시작 전이라 출발 전에 다시 확인해요."
  },
  {
    id: "h8",
    place: "스위스 단독",
    cost: 1250,
    season: "6~9월 (하이킹 최적)",
    note: "대자연 집중 · 물가 높음 주의",
    star: false,
    flight: "1인 110~150만 (취리히 직항)",
    days: "7박 9일",
    route: "인천 → 취리히 in → 루체른 1박(카펠교·리기산) → 인터라켄/그린델발트 3박(융프라우요흐·피르스트) → 체르마트 2박(고르너그라트·마테호른) → 몬트뢰 or 취리히 1박 out",
    booking: "스위스 트래블패스는 출발 전 온라인 구매(산악열차 25~50% 할인). 융프라우 VIP패스는 한국 여행사 특가 비교. 물가가 높아 조식 포함(하프보드) 숙소가 유리, 산악 일정은 날씨 보고 전날 확정. 솅겐 지역은 180일 중 90일까지 비자 없이 머물러요. 2025-10부터 EES(출입국 얼굴·지문 등록)를 해요. ETIAS(유럽 전자여행허가)는 아직 시작 전이라 출발 전에 다시 확인해요."
  },
  {
    id: "h6",
    place: "캐나다 (로키+밴쿠버)",
    cost: 1100,
    season: "6~9월 (로키 성수기)",
    note: "대자연 관광 중심 · 직항 10시간",
    star: false,
    flight: "1인 110~160만 (직항)",
    days: "7박 9일",
    route: "인천 → 밴쿠버 직항 in. 밴쿠버 2박(스탠리파크·그랜빌아일랜드·개스타운) → 국내선으로 캘거리 → 렌터카로 밴프 3박(레이크루이스·모레인호수·설퍼산 곤돌라) → 아이스필드 파크웨이 경유 재스퍼 1박(콜롬비아 대빙원) → 캘거리 or 밴쿠버 out",
    booking: "로키는 6~9월이 호수 색·트레킹 최적 — 밴프 숙소는 4~6개월 전 마감되니 항공과 같이 예약. 모레인호수는 셔틀 사전예약 필수, 렌터카는 캘거리 공항 수령이 동선 효율적. eTA(전자여행허가, 비행기로 갈 때 필요, CAD 7) 미리 신청"
  },
  {
    id: "h5",
    place: "발리",
    cost: 600,
    season: "4~10월 (건기)",
    note: "가성비 풀빌라 · 직항 7시간",
    star: false,
    flight: "1인 60~90만 (직항)",
    days: "5박 7일",
    route: "인천 → 덴파사르 직항. 스미냑/짱구 2박(비치클럽) → 우붓 2박(라이스테라스·정글 풀빌라) → 울루와뚜/누사두아 2박(절벽 오션뷰·수상사원). 프라이빗 드라이버 차터 추천",
    booking: "건기(4~10월) 중 7~8월 성수기만 피하면 풀빌라가 30%↓. 우붓 인기 빌라는 2~3개월 전 마감, 공항 픽업은 숙소에 사전 요청. 한국 여권은 도착비자(e-VOA, 50만 루피아)가 필요해요. 발리 관광세 15만 루피아와 전자 세관신고서도 미리 해 둬요."
  }
];
const HM_PLACES = [
  ["이탈리아 + 스위스", "FCO", "ZRH", "EUR"],
  ["이탈리아", "FCO", "FCO", "EUR"],
  ["스위스", "ZRH", "ZRH", "CHF"],
  ["몰디브", "MLE", "MLE", "USD"],
  ["하와이", "HNL", "HNL", "USD"],
  ["칸쿤", "CUN", "CUN", "USD"],
  ["캐나다", "YVR", "YVR", "CAD"],
  ["발리", "DPS", "DPS", "IDR"],
  ["파리", "CDG", "CDG", "EUR"],
  ["스페인", "BCN", "BCN", "EUR"],
  ["괌", "GUM", "GUM", "USD"],
  ["푸켓", "HKT", "HKT", "THB"],
  ["방콕", "BKK", "BKK", "THB"],
  ["다낭", "DAD", "DAD", "USD"],
  ["세부", "CEB", "CEB", "USD"],
  ["도쿄", "NRT", "NRT", "JPY"],
  ["오사카", "KIX", "KIX", "JPY"],
  ["뉴욕", "JFK", "JFK", "USD"],
  ["산토리니", "JTR", "JTR", "EUR"],
  ["모리셔스", "MRU", "MRU", "EUR"],
  ["보라보라", "PPT", "PPT", "USD"]
];
const hmPlace = (place) => HM_PLACES.find(([k]) => String(place || "").includes(k)) || null;
const hmNights = (days) => {
  const m = /(\d+)\s*박\s*(\d+)\s*일/.exec(days || "");
  return m ? Number(m[2]) - 1 : 6;
};
const addDays = (ymd2, n) => {
  const d = /* @__PURE__ */ new Date(ymd2 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
function flightLinks({ from = "ICN", to, back, dep, ret }) {
  const c = (d) => d.replace(/-/g, "");
  return [
    ["네이버 항공권", `https://flight.naver.com/flights/international/${from}-${to}-${c(dep)}/${back}-${from}-${c(ret)}?adult=2&fareType=Y`],
    ["스카이스캐너", `https://www.skyscanner.co.kr/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${c(dep).slice(2)}/${c(ret).slice(2)}/?adultsv2=2&cabinclass=economy`],
    ["구글 항공권", `https://www.google.com/travel/flights?hl=ko&curr=KRW&q=${encodeURIComponent(`Flights from ${from} to ${to} on ${dep} through ${ret} for 2 adults`)}`]
  ];
}
(() => {
  const l = flightLinks({ to: "FCO", back: "ZRH", dep: "2027-11-01", ret: addDays("2027-11-01", hmNights("9박 11일")) });
  if (!l[0][1].includes("ICN-FCO-20271101/ZRH-ICN-20271111") || !l[1][1].includes("/271101/271111/")) console.error("flightLinks 날짜/공항 오류");
  if (hmPlace("이탈리아 + 스위스")[2] !== "ZRH" || hmPlace("이탈리아 단독")[2] !== "FCO" || addDays("2027-12-30", 3) !== "2028-01-02") console.error("hmPlace/addDays 오류");
})();
function useFx() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    memoLoad("fx", async () => {
      const r = await authFetch("/api/fx");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then((j) => {
      if (alive && j) setData(j);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
const HM_CURS = ["USD", "EUR", "CHF", "JPY", "CAD", "THB", "IDR", "GBP", "AUD", "CNH", "HKD", "SGD"];
function HoneymoonCost({ h, onPatch, weddingDate }) {
  const fx = useFx();
  const pl = hmPlace(h.place);
  const to = h.airport || pl && pl[1] || "", back = h.airportBack || pl && pl[2] || to, cur0 = pl && pl[3] || "USD";
  const dep = h.depart || (weddingDate ? addDays(weddingDate, 1) : ""), ret = dep ? addDays(dep, hmNights(h.days)) : "";
  const prices = h.prices || [], costs = h.costs || [];
  const [p, setP] = useState({ man: 0, src: "네이버 항공권" });
  const [c, setC] = useState({ name: "", amt: 0, cur: cur0 });
  const rate = (cur) => fx && fx.rates && fx.rates[cur] ? fx.rates[cur].krw : null;
  const costMan = (x) => {
    const r = rate(x.cur);
    return r ? (Number(x.amt) || 0) * r / 1e4 : null;
  };
  const latest = prices[prices.length - 1], low = prices.length ? Math.min(...prices.map((x) => x.man)) : null;
  const localMan = costs.reduce((s, x) => s + (costMan(x) || 0), 0), missingFx = costs.some((x) => costMan(x) === null);
  const total = (latest ? latest.man * 2 : 0) + localMan;
  const lbl = "text-[12px] text-[#6B6B6B] block mb-1";
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#F0F0F0] px-4 py-4 mb-4 space-y-5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold mb-2" }, "✈️ 항공권 실제 가격 보기"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-2" }, /* @__PURE__ */ React.createElement("label", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: lbl }, "출발일", !h.depart && weddingDate ? " (예식 다음 날)" : ""), /* @__PURE__ */ React.createElement("input", { type: "date", value: dep, onChange: (e) => onPatch("depart", e.target.value), className: "w-full h-10 px-2 rounded-lg bg-[#F5F5F5] text-[13px]" })), /* @__PURE__ */ React.createElement("label", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: lbl }, "가는 공항(영문 3자)"), /* @__PURE__ */ React.createElement(TextInput, { value: to, onChange: (v) => onPatch("airport", v.toUpperCase().slice(0, 3)), placeholder: "예: MLE" })), /* @__PURE__ */ React.createElement("label", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: lbl }, "돌아오는 공항"), /* @__PURE__ */ React.createElement(TextInput, { value: back, onChange: (v) => onPatch("airportBack", v.toUpperCase().slice(0, 3)), placeholder: "예: MLE" }))), dep && /^[A-Z]{3}$/.test(to) && /^[A-Z]{3}$/.test(back) ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-2" }, "인천 출발 ", dep, " → 귀국편 출발 ", ret, " (", h.days || "7일", ") · 성인 2명 · 이코노미로 검색해요.", back !== to ? ` 가는 곳(${to})과 돌아오는 곳(${back})이 다른 일정은 네이버만 그대로 검색되고, 스카이스캐너·구글은 ${to} 왕복으로 검색돼요.` : ""), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 flex-wrap" }, flightLinks({ to, back, dep, ret }).map(([n, u]) => /* @__PURE__ */ React.createElement("a", { key: n, href: u, target: "_blank", rel: "noopener noreferrer", className: "h-9 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold inline-flex items-center" }, n)))) : /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "예식일을 정하거나 출발일과 공항 코드(영문 3글자)를 넣으면 검색 링크가 생겨요.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-1" }, "본 가격 기록 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 1인 왕복, 세금·유류할증료까지 포함한 최종 금액(만원)")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-2" }, /* @__PURE__ */ React.createElement(NumInput, { value: p.man, onChange: (v) => setP({ ...p, man: v }), ariaLabel: "1인 왕복 항공권(만원)", className: "flex-1" }), /* @__PURE__ */ React.createElement("select", { value: p.src, onChange: (e) => setP({ ...p, src: e.target.value }), "aria-label": "어디서 본 가격인지", className: "h-10 px-2 rounded-lg bg-[#F5F5F5] text-[13px]" }, ["네이버 항공권", "스카이스캐너", "구글 항공권", "항공사", "여행사"].map((s) => /* @__PURE__ */ React.createElement("option", { key: s }, s))), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        if (!(p.man > 0)) return;
        onPatch("prices", [...prices, { d: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), man: p.man, src: p.src }].slice(-30));
        setP({ ...p, man: 0 });
      },
      className: "h-10 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0"
    },
    "기록"
  )), prices.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] mb-1" }, "가장 최근 기록 ", /* @__PURE__ */ React.createElement("b", null, manWon(latest.man)), " (", latest.d, " · ", latest.src, ") · 지금까지 기록 중 최저 ", /* @__PURE__ */ React.createElement("b", null, manWon(low))), /* @__PURE__ */ React.createElement("ul", { className: "text-[12px] text-[#6B6B6B] space-y-0.5" }, prices.slice().reverse().slice(0, 5).map((x, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex justify-between gap-2" }, /* @__PURE__ */ React.createElement("span", null, x.d, " · ", x.src), /* @__PURE__ */ React.createElement("span", null, manWon(x.man), " ", /* @__PURE__ */ React.createElement("button", { type: "button", "aria-label": "이 기록 지우기", className: "ml-1 underline", onClick: () => onPatch("prices", prices.filter((y) => y !== x)) }, "지우기"))))))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-1" }, "숙소·현지 경비 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 현지 돈 단위로 적으면 원화로 바꿔 더해요")), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-2" }, fx ? `환율: ${fx.source} · ${fx.date} 기준${rate(cur0) ? ` · 1 ${cur0} = ${r2(rate(cur0)).toLocaleString()}원` : ""}.` : "환율을 불러오는 중이거나 불러오지 못했어요.", " 카드 결제·환전 때는 수수료가 붙어 1~2% 더 나와요."), costs.length > 0 && /* @__PURE__ */ React.createElement("ul", { className: "text-[13px] space-y-1 mb-2" }, costs.map((x) => /* @__PURE__ */ React.createElement("li", { key: x.id, className: "flex justify-between gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "truncate" }, x.name), /* @__PURE__ */ React.createElement("span", { className: "shrink-0" }, Number(x.amt).toLocaleString(), " ", x.cur, " → ", /* @__PURE__ */ React.createElement("b", null, costMan(x) === null ? "환율 없음" : manWon(r2(costMan(x)))), " ", /* @__PURE__ */ React.createElement("button", { type: "button", className: "ml-1 text-[12px] text-[#6B6B6B] underline", onClick: () => onPatch("costs", costs.filter((y) => y.id !== x.id)) }, "지우기"))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: c.name, onChange: (v) => setC({ ...c, name: v }), placeholder: "항목 (예: 리조트 4박, 2인)", className: "flex-1" }), /* @__PURE__ */ React.createElement(NumInput, { value: c.amt, onChange: (v) => setC({ ...c, amt: v }), ariaLabel: "금액(현지 돈 단위)", className: "w-24" }), /* @__PURE__ */ React.createElement("select", { value: c.cur, onChange: (e) => setC({ ...c, cur: e.target.value }), "aria-label": "통화", className: "h-10 px-2 rounded-lg bg-[#F5F5F5] text-[13px]" }, [.../* @__PURE__ */ new Set([cur0, ...HM_CURS])].map((s) => /* @__PURE__ */ React.createElement("option", { key: s }, s))), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        if (!c.name.trim() || !(c.amt > 0)) return;
        onPatch("costs", [...costs, { id: uid(), name: c.name.trim(), amt: c.amt, cur: c.cur }]);
        setC({ name: "", amt: 0, cur: c.cur });
      },
      className: "h-10 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0"
    },
    "추가"
  ))), (latest || costs.length > 0) && /* @__PURE__ */ React.createElement("div", { className: "rounded-lg bg-[#FAFAFA] px-3 py-3 flex items-center justify-between gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px]" }, "2인 합계 ", /* @__PURE__ */ React.createElement("b", { className: "text-[16px]" }, manWon(Math.round(total))), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, " = 항공권 ", latest ? `${manWon(latest.man)} × 2명` : "기록 없음", " + 숙소·현지 경비 ", manWon(Math.round(localMan)), missingFx ? " (환율 없는 항목은 빠짐)" : "")), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => onPatch("cost", Math.round(total)), className: "h-9 px-3 rounded-lg border border-[#0A0A0A] text-[13px] font-semibold" }, "이 합계를 총 경비로 쓰기")));
}
const HM_GUIDE_SECTIONS = [["costs", "경비"], ["flight", "항공권"], ["when", "시기"], ["course", "코스"], ["sights", "볼거리"], ["food", "맛집"], ["tips", "꿀팁"], ["cautions", "주의할 점"]];
function hmGuides(place) {
  const p = String(place || "");
  const one = (k2) => HM_GUIDE[k2] && { key: k2, ...HM_GUIDE[k2], costs: HM_COSTS[k2] || [] };
  if (p.includes("이탈리아") && p.includes("스위스") && !/단독/.test(p)) return ["이탈리아 + 스위스", "이탈리아", "스위스"].map(one).filter(Boolean);
  const k = Object.keys(HM_GUIDE).filter((k2) => k2 !== "이탈리아 + 스위스").find((k2) => p.includes(k2));
  return k ? [one(k)] : [];
}
function HmLine({ text }) {
  const urls = [], plain = String(text).replace(/\s*(https:\/\/[^\s)]+)/g, (_, u) => {
    urls.push(u);
    return "";
  }).trim();
  const m = /^(.{2,24}?)(: | — )(.+)$/.exec(plain);
  return /* @__PURE__ */ React.createElement("li", { className: "leading-relaxed" }, m ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("b", { className: "font-semibold text-[#0A0A0A]" }, m[1]), m[2] === ": " ? " " : " — ", m[3]) : plain, urls.map((u) => /* @__PURE__ */ React.createElement("a", { key: u, href: u, target: "_blank", rel: "noopener noreferrer", className: "ml-1.5 text-[11px] text-[#6B6B6B] underline underline-offset-2 whitespace-nowrap" }, "출처")));
}
function HmCostCard({ c }) {
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-4 py-3.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline justify-between gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold tracking-tight" }, c.total), /* @__PURE__ */ React.createElement("a", { href: c.url, target: "_blank", rel: "noopener noreferrer", className: "text-[11px] text-[#6B6B6B] underline underline-offset-2 shrink-0" }, c.src, " ↗")), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5" }, c.trip), c.rows && c.rows.length > 0 && /* @__PURE__ */ React.createElement("dl", { className: "mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]" }, c.rows.map(([k, v], i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B] whitespace-nowrap" }, k), /* @__PURE__ */ React.createElement("dd", { className: "text-[#3D3D3D] min-w-0" }, v)))), c.note && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] mt-2" }, c.note));
}
function HoneymoonGuide({ place }) {
  const [open, setOpen] = useState(false);
  const [gi, setGi] = useState(0);
  const [sec, setSec] = useState("costs");
  const gs = hmGuides(place);
  if (!gs.length) return null;
  const g = gs[Math.min(gi, gs.length - 1)];
  const secs = HM_GUIDE_SECTIONS.filter(([k]) => g[k] && g[k].length);
  const cur = secs.some(([k]) => k === sec) ? sec : secs[0][0];
  const chip = (on) => `h-8 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap ${on ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#525252] hover:bg-[#EDEDED]"}`;
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#F0F0F0] mt-3 mb-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setOpen(!open), "aria-expanded": open, className: "w-full flex items-center justify-between gap-2 px-4 py-3 text-left" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] font-bold" }, "후기로 본 정보 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 경비 사례·항공권·코스·꿀팁")), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-semibold text-[#525252] shrink-0" }, open ? "접기" : "펼치기")), open && /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-4" }, gs.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 mb-2 p-1 rounded-xl bg-[#F5F5F5] w-fit max-w-full overflow-x-auto" }, gs.map((x, i) => /* @__PURE__ */ React.createElement("button", { key: x.key, type: "button", onClick: () => setGi(i), className: `h-8 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap ${i === gi ? "bg-white shadow-sm" : "text-[#6B6B6B]"}` }, i === 0 ? "두 나라 함께" : x.key))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 overflow-x-auto pb-1 mb-3", role: "tablist" }, secs.map(([k, label]) => /* @__PURE__ */ React.createElement("button", { key: k, type: "button", role: "tab", "aria-selected": cur === k, onClick: () => setSec(k), className: chip(cur === k) }, label))), cur === "costs" ? /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-2.5" }, g.costs.map((c, i) => /* @__PURE__ */ React.createElement(HmCostCard, { key: i, c }))) : /* @__PURE__ */ React.createElement("ul", { className: "text-[14px] text-[#3D3D3D] space-y-2 list-disc pl-5 marker:text-[#BDBDBD]" }, g[cur].map((t, i) => /* @__PURE__ */ React.createElement(HmLine, { key: i, text: t }))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-3" }, "인스타·커뮤니티 후기와 공식 안내를 모았어요(", g.at, " 조사). 금액은 쓴 사람의 사례라 시기·환율·숙소에 따라 달라요. 입국 규정은 떠나기 전 공식 사이트에서 다시 확인해요.")));
}
const HM_COSTS = {
  "몰디브": [
    {
      total: "숙소만 2인 420만원",
      trip: "5.5박 · 5월(우기)",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DYq7M2XBBLp/",
      rows: [["공항 근처", "0.5박"], ["비치빌라", "3박"], ["오버워터빌라", "2박"], ["항공", "저가항공 경유(금액 없음)"]],
      note: "우기였지만 맑은 날이 훨씬 많았다는 후기"
    },
    {
      total: "고급 리조트 숙소 400만원대",
      trip: "8박 9일 · 비수기",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DWgSmLglVpU/",
      rows: [["줄인 방법", "5~10월 비수기"], ["", "아고다 '취소 불가' 요금"], ["", "7박 이상 장기 할인"], ["", "하프보드(조식+석식)"]]
    },
    {
      total: "2인 850만원대 (항공 포함)",
      trip: "4박 · 2024년 8월",
      src: "여행사 후기",
      url: "https://www.sinbuyatour.com/review/details/200",
      rows: [["리조트", "오가 아트 리조트"], ["항공", "싱가포르 경유"]]
    },
    { total: "2인 1,201만원 (패키지 중간값)", trip: "4박 7일 · 2026년 9월 집계", src: "패키지 비교", url: "https://altpackage.com/blog/honeymoon-package-cost-compare", note: "전부 경유편, 대부분 올인클루시브" }
  ],
  "하와이": [
    {
      total: "2인 약 700만원",
      trip: "5박 7일",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DWIp5sAj9M8/",
      rows: [["항공", "특가 1인 70만원 초중반"], ["숙소", "가성비 시티뷰(리조트피 확인)"], ["교통", "렌터카 대신 트롤리·홀로카드"], ["쇼핑", "월마트가 ABC스토어보다 쌈"]]
    },
    {
      total: "2인 약 1,000만원 (항공 포함)",
      trip: "6박 8일 오아후 · 2024년 9월",
      src: "여행사 후기",
      url: "https://www.sinbuyatour.com/review/details/193",
      rows: [["패키지(숙소)", "410만"], ["직항 항공", "192.6만"], ["현지 지출", "400만"], ["호텔", "힐튼 가든인 4박 + 쉐라톤 와이키키 2박"]]
    }
  ],
  "칸쿤": [
    {
      total: "2인 약 600~700만원 (항공 포함)",
      trip: "6박 8일 · 2025년 6월",
      src: "블로그 후기",
      url: "https://travel.manual-master.com/19",
      rows: [["리조트", "하얏트 질라라 5박 (올인클루시브 1박 50~70만)"], ["시내", "1박"], ["항공", "미국 경유 1인 180~220만"]]
    },
    {
      total: "2인 약 1,700만원 (예정 경비)",
      trip: "미국 서부 + 칸쿤 11박 13일",
      src: "블라인드",
      url: "https://www.teamblind.com/kr/post/11박13일-미국서부칸쿤-신혼여행-경비-tVFQUADz",
      rows: [["칸쿤 리조트", "630만 (하얏트 지바 2박 + 스칼렛 아르떼 3박)"], ["항공", "390만"]]
    }
  ],
  "이탈리아 + 스위스": [
    {
      total: "항공 240만 + 호텔 253만 + 투어 200만",
      trip: "10박 12일 · 2인",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DVTmKaaEg1h/",
      rows: [["항공", "터키항공 경유 2인 240만"], ["로마", "나보나49 3박 90만"], ["피렌체", "호텔 에스더 2박 25만"], ["인터라켄", "호텔 에덴 1박 38만"], ["그린델발트", "샬레 미리암 4박 100만"], ["투어", "남부 40만 · 바티칸 27만 · 융프라우 48만 · 캐년스윙 45만 · 호수 핫텁 40만"]]
    },
    {
      total: "직항 284만 + 숙박 400만",
      trip: "12박 기차 여행 · 2인",
      src: "여행사 계정 게시물",
      url: "https://www.instagram.com/p/DUIDJ9Mkkqc/",
      rows: [["항공", "대한항공 직항 2인 284만"], ["인터라켄", "3박 111만"], ["베네치아", "2박 79만"], ["피렌체", "3박 85만"], ["나폴리", "2박 44만"], ["로마", "2박 81만"]]
    },
    {
      total: "2인 약 2,345만원",
      trip: "프랑스+스위스+이탈리아 14박 · 5~6월",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/Dab7vT-JA0J/",
      rows: [["항공", "티웨이 비즈니스 770만"], ["프랑스 4박", "521만"], ["스위스 3박", "345만"], ["이탈리아 7박", "710만 (세미패키지 438만)"]]
    }
  ],
  "이탈리아": [
    {
      total: "2인 약 1,400만원 (항공 포함)",
      trip: "14박 15일 · 2025년 여름",
      src: "커뮤니티 후기(모녀 여행)",
      url: "https://theqoo.net/travel/3866854669",
      rows: [["항공", "대한항공 경유 2인 350만"], ["렌터카", "약 1,000유로"], ["코스", "로마 → 토스카나 농가민박 → 돌로미티"]]
    },
    {
      total: "남부 해안 숙소가 비싸요",
      trip: "2023 신혼 후기",
      src: "블로그 후기",
      url: "https://chanjae.net/1191",
      rows: [["포지타노 스위트", "1박 505유로"], ["나폴리 B&B", "1박 103유로"]]
    }
  ],
  "스위스": [
    {
      total: "3박 2인 약 345만원 (항공 제외)",
      trip: "5~6월",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/Dab7vT-JA0J/",
      rows: [["숙소", "173만"], ["식비", "54만 (마트 장보기)"], ["관광·교통", "102만 (융프라우 VIP패스 2일)"]]
    },
    {
      total: "항공 포함 2인 1,200만원이면 충분",
      trip: "신혼 예산 댓글",
      src: "블라인드",
      url: "https://www.teamblind.com/kr/post/%EC%8A%A4%EC%9C%84%EC%8A%A4-%EC%8B%A0%ED%98%BC%EC%97%AC%ED%96%89-%EC%98%88%EC%82%B0-%EC%96%BC%EB%A7%88%EB%82%98-%EC%9E%A1%EC%95%84%EC%95%BC%ED%95%B4-q5wGb8Z1",
      note: "2인 800만원대면 보통, 산뷰 온천 숙소 1박 40만원대"
    }
  ],
  "캐나다": [
    {
      total: "2인 약 1,070만원",
      trip: "밴프 4박 5일 · 9월 극성수기",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DdSxSb8RWZg/",
      rows: [["항공", "204만 (LA → 캘거리)"], ["숙박", "394만 (밴프 2박 246만 · 캔모어 2박 148만)"], ["교통", "178만 (렌터카 139만)"], ["식비", "168만"], ["투어", "96만 (호수투어 · 설상차 · 곤돌라)"]]
    },
    {
      total: "1인 250~350만원 (항공 포함)",
      trip: "7박 8일 자유여행",
      src: "여행사 추정",
      url: "https://www.tripstore.kr/blog/캐나다-자유여행-코스-경비",
      note: "여름 성수기엔 밴프 근처 호텔이 1박 최소 60만원이라는 후기도 있어요"
    }
  ],
  "발리": [
    {
      total: "2인 약 700~800만원",
      trip: "5박 7일",
      src: "인스타 후기",
      url: "https://www.instagram.com/p/DRhVjc5k2uB/",
      rows: [["항공", "가루다 직항 2인 200만"], ["물리아 풀빌라", "2박 (1박 100만원 초반)"], ["아야나 짐바란", "3박 (1박 30만원 중반)"], ["단독 택시", "시간당 약 1만원"], ["현지 지출", "100~200달러"]]
    },
    {
      total: "2인 약 740만원 (항공·숙소·투어)",
      trip: "5박 7일 · 2024년 9월",
      src: "여행사 후기",
      url: "https://www.sinbuyatour.com/review/details/194",
      rows: [["스미냑", "포테이토헤드 3박"], ["우붓", "만다파 리츠칼튼 리저브 2박"]]
    }
  ]
};
const HM_GUIDE = {
  "몰디브": {
    at: "2026-10",
    flight: [
      "인천–말레 직항은 없어요. 싱가포르·방콕·쿠알라룸푸르·두바이·도하·아부다비·콜롬보 중 한 곳을 거쳐 13~15시간.",
      "1인 왕복 약 100~180만원(성수기 200만원 이상). 에티하드가 싼 편, 싱가포르항공이 비싼 편.",
      "수상비행기는 해가 지면 안 떠요 — 밤에 도착하면 말레 근처에서 1박. 리조트 수상비행기 시간에 맞는 항공편(말레 오후 3시 전 도착)을 고르세요."
    ],
    when: [
      "12~4월 건기: 날씨 최고, 값도 최고. 5~11월 우기·비수기: 리조트가 20~40% 싸고, 소나기는 짧게 지나간다는 후기가 많아요.",
      "11월부터 날씨가 좋아지기 시작 — 가을에 간다면 11월이 날씨·값 균형이 좋아요. 추석·10월 초 연휴는 항공권이 비싸요."
    ],
    course: [
      "5박 7일이 가장 흔해요: 한 리조트 안에서 비치빌라 2박 + 워터빌라 3박(워터빌라만 묵는 것보다 1박 30만원 이상 아낌).",
      "리조트 고르는 기준: 라군형(바다색·물놀이) vs 하우스리프형(스노클·거북이), 자연섬인지, 공항에서 이동 수단(스피드보트가 수상비행기보다 20~40만원 쌈), 식사 플랜."
    ],
    sights: ["하우스리프 스노클링(거북이·가오리)", "돌핀·선셋 크루즈", "플로팅 조식(후기 기준 약 18달러)", "수상비행기 타기", "샌드뱅크 피크닉", "리조트 스파"],
    food: ["식사는 거의 리조트 안 — 식음료가 비싸서 올인클루시브나 하프보드(조식+석식)를 고르는 사람이 많아요.", "술을 안 마시면 하프보드가 이득이라는 후기가 많아요(점심은 물놀이하느라 거르기 쉬움)."],
    tips: [
      "여행사 올인클루시브 특가가 온라인 최저가보다 쌀 때가 많아요 — 여행사 2곳 정도만 견적 비교.",
      "허니문 특전(디너·데코·스파)은 혼인 증빙을 요구하는 곳이 많아요 — 예약할 때 필요한 서류를 꼭 물어보세요.",
      "스피드보트는 타기 30분 전 멀미약. 결제는 달러, 리조트 비용은 체크아웃 때 카드로 한 번에.",
      "결혼식 날짜가 확정됐으면 '취소 불가' 요금이 크게 싸요."
    ],
    cautions: [
      "입국: 무비자. 도착 96시간 전부터 IMUGA 여행자 신고서(무료)를 내요. 여권은 6개월 이상 남은 게 안전 https://imuga.immigration.gov.mv",
      "세금: 표시가에 봉사료 10% + 관광 GST 17% + 그린세(1인 1박 12달러)가 더 붙어 실제 결제는 약 30% 높아요 https://immaldives.com/travel-guide/costs/tax-and-fees/",
      "술·돼지고기는 반입 금지. 현지인 섬·말레에서는 노출 있는 옷과 음주를 삼가요.",
      "몰디브엔 한국 공관이 없어요 — 여권을 잃어버리면 주스리랑카 대사관에서 처리."
    ]
  },
  "하와이": {
    at: "2026-10",
    flight: [
      "인천–호놀룰루 직항 약 8시간: 대한항공·델타·에어프레미아 등. 1인 왕복 비수기 약 110만원, 성수기 150만원 이상(특가는 70~80만원대).",
      "9~11월·1월이 싼 편. 마우이·빅아일랜드는 호놀룰루에서 섬 사이 비행기로 약 40분."
    ],
    when: [
      "9~10월: 여름 성수기가 끝나 값이 내려가고 날씨도 좋아요. 12~1월 연말과 7~8월 방학철은 비싸요.",
      "6~11월은 허리케인 시즌 — 가을 여행이면 여행자보험을 들어 두세요."
    ],
    course: [
      "7박 예: 오아후 3박(와이키키·동부 해안·노스쇼어) → 마우이 4박(하나 로드, 할레아칼라 일출, 와일레아 휴양) → 호놀룰루 출국.",
      "마우이 대신 빅아일랜드를 넣으면 킬라우에아 화산국립공원·마우나케아 별 보기."
    ],
    sights: ["다이아몬드 헤드 등반(예약 필수)", "하나우마 베이 스노클링(예약 필수)", "쿠알로아 랜치", "할레아칼라 일출(예약 필수)", "하나 로드 드라이브", "빅아일랜드 화산국립공원"],
    food: ["레오나드 베이커리 말라사다", "지오반니 새우트럭(노스쇼어 할레이바)", "마마스 피시 하우스(마우이)", "월마트가 ABC스토어보다 초콜릿 등이 싸요"],
    tips: [
      "와이키키에선 렌터카를 매일 빌리지 마세요 — 호텔 주차비가 하루 40~50달러. 드라이브하는 날만 빌리기. 마우이·빅아일랜드는 렌터카 필수.",
      "예약 필수: 하나우마 베이(1인 25달러, 이틀 전), 다이아몬드 헤드(1인 5달러 + 주차 10달러), 할레아칼라 일출(60일 전·이틀 전 오전 7시 recreation.gov, 공원 입장료 30달러 별도) https://www.nps.gov/hale/planyourvisit/haleakala-sunrise-reservations-faq.htm",
      "호텔 리조트피는 1박 30~50달러 — 예약 금액에 포함인지 확인. 식당 팁은 18~20%.",
      "호텔과 에어비앤비를 섞으면 숙박비를 줄일 수 있어요."
    ],
    cautions: [
      "ESTA: 공식 사이트에서만 신청, 수수료 40달러(2025-09-30부터), 출발 72시간 전까지 https://esta.cbp.dhs.gov",
      "숙박세: 2026년부터 주 숙박세 11% + 카운티세 3% + 판매세 약 4.7% — 숙박비에 약 18.7%가 더 붙어요 https://files.hawaii.gov/tax/news/announce/ann26-01.pdf",
      "거북이·물개·산호 만지기, 출입 금지 구역 사진, 주택가 주차는 벌금·신고 대상이에요.",
      "마우이 라하이나는 2023년 산불 뒤 재건 중인 지역이에요."
    ]
  },
  "칸쿤": {
    at: "2026-10",
    flight: [
      "한국–칸쿤 직항은 없어요. 아에로멕시코 인천–멕시코시티 직항(매일) 후 국내선, 또는 미국 댈러스·LA·애틀랜타·휴스턴 경유.",
      "1인 왕복 약 180~220만원(후기 기준). 3~4개월 전 얼리버드를 권하는 후기가 많아요."
    ],
    when: [
      "11~1월이 가장 좋아요. 9~10월은 허리케인이 가장 잦은 때라 피하는 게 좋아요(외교부: 5~10월 허리케인 시기).",
      "2027년 가을이면 11월이 가장 안전해요. 봄~여름엔 해초(사르가숨)가 밀려온다는 후기가 많아요."
    ],
    course: [
      "6박 예: 호텔존 올인클루시브 4박 → 플라야 무헤레스·리비에라 마야 리조트 2박으로 옮겨 조용히 쉬기.",
      "중간에 하루씩: 치첸이사 + 세노테 투어, 이슬라 무헤레스 카타마란."
    ],
    sights: ["치첸이사 유적", "세노테 수영", "이슬라 무헤레스", "스칼렛 파크(공연·물놀이)", "툴룸 유적", "리조트 쇼·바"],
    food: ["로렌실로스(Lorenzillo's, 랍스터 — 예약 필수)", "타코스 리고", "멕스트림(타코·코치니타 피빌)", "호텔존 식당은 관광객용이라 비싼 편"],
    tips: [
      "올인클루시브는 '성인 전용'인지 먼저 보세요 — 가족 구역 소음·밤 파티 음악 후기가 있어요. 조용한 곳은 플라야 무헤레스 쪽.",
      "공항에서 호텔까지 12~56분으로 차이가 커요 — 이동 거리까지 보고 고르기. 공항 이동은 미리 예약한 사설 셔틀이 편해요.",
      "리조트 안 레스토랑 수, 알라카르트 예약 방식, 룸서비스 포함 여부를 비교하세요. 팁용 1달러 지폐를 챙겨요."
    ],
    cautions: [
      "입국: 한국 여권 무비자(최대 180일). 미국을 거치면 환승만 해도 ESTA(40달러)가 필요해요 — 아에로멕시코 직항이면 필요 없어요 https://0404.go.kr/ntnSafetyInfo/58/detail",
      "치안: 외교부 여행경보 2단계(여행자제) 지역이에요. 길거리 택시 대신 앱·예약 차량, 현금은 조금만.",
      "킨타나로오주 관광세(Visitax) 1인 약 15~16달러 — 공식 사이트 visitax.gob.mx에서만 내요(가짜 사이트 주의).",
      "올인클루시브에도 리조트피가 따로 붙는 곳이 있어요 — 결제 전 최종 금액 확인."
    ]
  },
  "캐나다": {
    at: "2026-10",
    flight: [
      "인천–밴쿠버 직항(대한항공·에어캐나다 매일), 1인 왕복 약 110~150만원(경유는 80만원대부터).",
      "인천–캘거리는 웨스트젯 직항(5월 말~10월 중순 주 6회). 가을 성수기는 5~6개월 전에 사는 게 싸요."
    ],
    when: [
      "9월 중순~10월 초가 가장 좋아요 — 낙엽송이 9/20~10/5쯤 노랗게 절정, 여름보다 한산. 낮 15~17°C, 밤 2°C.",
      "10월 중순부터 높은 곳에 눈, 호수가 얼기 시작. 레이크루이스·모레인 호수 셔틀은 10월 12일쯤 끝나고 모레인 도로도 닫혀요 — 10월 중순~11월은 피하기."
    ],
    course: [
      "8~9박 예: 밴쿠버 2~3박 → 비행기로 캘거리 → 밴프 3박 → 레이크루이스 1박 → 아이스필즈 파크웨이 → 재스퍼 2박 → 캘거리 출국.",
      "밴쿠버–로키는 차로 약 9시간. 밴쿠버에서 빌려 캘거리에 반납하면 편도 수수료 CAD 300~500."
    ],
    sights: ["레이크루이스 카누", "모레인 호수(셔틀로만)", "밴프 곤돌라", "아이스필즈 파크웨이: 페이토·보우 호수, 컬럼비아 대빙원 설상차", "요호 국립공원 에메랄드 호수", "재스퍼 멀린 호수", "밴쿠버 그랜빌 아일랜드·개스타운"],
    food: ["밴프 Park Distillery(바이슨 버거, 예약 권장)", "밴프 The Grizzly House(퐁듀·엘크 스테이크, 예약 필수)", "앨버타 소고기 스테이크(Chuck's Steakhouse 등)", "밴쿠버 브런치 Medina Cafe"],
    tips: [
      "로키는 렌터카가 사실상 필수. 휴대폰이 안 터지는 구간이 많아 오프라인 지도를 받아 가세요.",
      "국립공원 입장료 차 1대 하루 CAD 24.50. 연간권(CAD 167.50)은 7일 이상 머물 때만 이득 https://parks.canada.ca/pn-np/ab/banff/visit/tarifs-fees",
      "레이크루이스·모레인 셔틀(성인 CAD 12.75 + 예약비 3.50): 좌석 40%는 4월 15일, 나머지는 출발 이틀 전 오전 8시(현지)에 열려요. 모레인 호수는 개인 차량 진입 불가 https://parks.canada.ca/pn-np/ab/banff/visit/parkbus/louise",
      "가을 성수기 숙소는 최대한 빨리. 밴프가 비싸면 캔모어가 대안."
    ],
    cautions: [
      "eTA: 비행기로 가면 필수. 공식 사이트에서만, CAD 7(대행 사이트는 비쌈), 보통 몇 분 안에 승인 https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html",
      "곰 등 야생동물 — 곰 스프레이, 음식은 밖에 두지 않기. 여름~초가을 산불·연기는 출발 전 Parks Canada 공지 확인.",
      "겨울 타이어: 아이스필즈 파크웨이 11/1~3/31, BC주 주요 도로 10/1부터 의무.",
      "밴쿠버 다운타운 이스트사이드(이스트 헤이스팅스·메인 일대)는 밤낮 피하기, 차 안에 짐 두지 않기. 식당 팁 15~20%, 과속 단속 주의."
    ]
  },
  "발리": {
    at: "2026-10",
    flight: [
      "인천–발리 직항 약 7시간: 대한항공(매일 2편)·제주항공·가루다. 대한항공 1인 왕복 약 115만원, 저가항공은 약 20만원 쌈."
    ],
    when: [
      "4~10월 건기, 11~3월 우기. 7~8월은 성수기라 비싸요.",
      "9~10월은 건기 막바지라 날씨·값 모두 무난해 많이 추천돼요. 11월부터 스콜이 잦아요."
    ],
    course: [
      "5박 예: 우붓 2박(정글 풀빌라, 발리 스윙, 바투르 일출 지프투어) + 남부 3박(울루와뚜·짐바란·누사두아 오션뷰 리조트).",
      "6박이면 첫날 스미냑·짱구 1박을 더해 비치클럽. 우붓이 싸고 남부 오션뷰가 비싸요."
    ],
    sights: ["바투르 화산 일출 지프투어", "발리 스윙", "우붓 원숭이숲·왕궁", "울루와뚜 절벽사원 일몰 + 께짝댄스", "스미냑 비치클럽(노을 시간)", "스파·마사지"],
    food: ["베벡 벵길(우붓, 바삭한 오리)", "너티 누리스(우붓, 폭립)", "메네가 카페(짐바란, 일몰 해산물)", "께다똔(사누르, 나시짬뿌르)", "바비굴링(돼지 통구이)"],
    tips: [
      "관광세·도착비자·입국카드를 미리 해 두면 공항 줄이 짧아요(아래 주의할 점 참고).",
      "메뉴 가격에 ++가 붙으면 세금+봉사료로 15~21% 더 나와요.",
      "샤워기 필터를 챙기는 사람이 많아요(수질). 물갈이(발리 벨리) 대비 상비약.",
      "이동은 기사 딸린 단독 차량이 편해요. 패키지는 쇼핑 횟수·팁 포함 여부를 꼭 확인."
    ],
    cautions: [
      "도착비자(e-VOA) 50만 루피아(약 4.5만원, 30일), 여권 6개월 이상. 입국카드 All Indonesia는 무료, 도착 72시간 전부터 https://allindonesia.imigrasi.go.id",
      "관광세 1인 15만 루피아(1회) — Love Bali 앱·웹으로 미리 https://overseas.mofa.go.kr/id-ko/brd/m_2864/view.do?seq=1345256",
      "사원에선 단정한 복장, 성소 구역 출입·신목 오르기 금지 — 위반하면 처벌 https://overseas.mofa.go.kr/id-bali-ko/brd/m_23849/view.do?seq=163",
      "카드 복제 사기가 잦아요 — ATM은 은행 안에 있는 것만. 오토바이 날치기 주의, 국제운전면허 불인정이라 직접 운전 금지. 의료비가 비싸 여행자보험 필수."
    ]
  },
  "이탈리아 + 스위스": {
    at: "2026-10",
    flight: [
      "로마로 들어가 취리히로 나오는(또는 반대) 다구간 발권이 기본. 취리히 직항(대한항공)은 하계 시즌에만 주 3회라 10월 하순 이후엔 없을 수 있어요 — 날짜 먼저 확인.",
      "두 나라 연결은 밀라노에서 기차(슈피츠 경유 인터라켄, 브리그 경유 체르마트), 보통 3~4시간대."
    ],
    when: ["두 나라 모두 맞추려면 9월~10월 중순. 10월 말부터는 스위스 산악 리프트 정비와 취리히 직항 종료가 겹쳐요."],
    course: [
      "로마 3 → 피렌체 2 → (밀라노 경유) → 인터라켄 2 → 체르마트 2 → 취리히 출국.",
      "7박 9일에 두 나라는 이동·짐 정리로 빠듯하다는 의견이 많아요 — 10박 이상 권장."
    ],
    tips: ["스위스에 머무는 날이 짧으면 트래블패스보다 반액카드나 구간권이 나을 수 있어요.", "쉥겐 지역이라 국경 심사는 없지만 기차에서 여권 검사를 할 수 있어 여권은 몸에 지니기."],
    cautions: ["유로 → 스위스 프랑으로 바뀌고 물가 차이가 커요(스위스가 훨씬 비쌈). 쿱·미그로스 마트 장보기로 식비를 아끼는 사람이 많아요."]
  },
  "이탈리아": {
    at: "2026-10",
    flight: [
      "로마 직항: 대한항공·아시아나·티웨이. 밀라노 직항: 대한항공 주 4회, 아시아나 주 3회.",
      "1인 왕복: 경유 최저 60만원대, 대한항공 직항 176~226만원(가을 조회값). 출발 3~5개월 전이 싼 편.",
      "로마 IN → 밀라노·베네치아 OUT 다구간 발권이면 되돌아오는 이동이 없어요."
    ],
    when: [
      "9월~10월 중순이 좋아요 — 더위가 꺾이고 아말피 페리도 다녀요(대개 4월~11월 초).",
      "7~8월은 덥고 붐비고, 8월 중순 휴가철엔 문 닫는 가게가 많아요. 11월 이후엔 남부 페리가 대부분 멈춰요."
    ],
    course: ["9박 예: 로마 3 → 피렌체 2(토스카나 당일) → 아말피·포지타노 2 → 베네치아 2. 도시당 최소 2~3박이 좋다는 조언이 많아요."],
    sights: ["콜로세움·포로 로마노·바티칸 박물관", "트레비 분수(2026년 2월부터 분수 앞 구역 2유로)", "피렌체 두오모·우피치, 토스카나 와이너리", "포지타노·아말피 페리, 카프리", "베네치아 곤돌라·부라노"],
    food: ["피렌체 티본스테이크: 트라토리아 달오스테, 트라토리아 마리오", "피렌체 알 안티코 비나이오(샌드위치)", "포지타노 il Ritrovo(해산물)"],
    tips: [
      "트렌이탈리아·이탈로 고속열차는 일찍 살수록 싸요. 역 근처 대행사에서 사지 않기.",
      "바티칸·우피치·보르게세·최후의 만찬은 공식 사이트에서 미리 예약.",
      "도시세는 숙박비와 별도로 현장에서 내요 — 로마 4성 1인 1박 7.5유로, 피렌체 4성 7유로.",
      "베네치아 당일 방문료(5~10유로)는 정해진 날만 걷고, 숙박하면 면제 https://visit.venice.it/plan-your-trip/venice-entry-fee"
    ],
    cautions: [
      "소매치기: 식당 의자에 가방 걸기, 지하철 날치기 주의. 관광지 야바위판 사기(구경하는 사이 소매치기) https://it.mofa.go.kr/it-ko/brd/m_24772/view.do?seq=1330129",
      "ZTL(차량 통행 제한 구역): 카메라에 찍힐 때마다 벌금 80~335유로 + 렌터카 수수료, 귀국 몇 달 뒤 청구되기도 해요.",
      "입국: 쉥겐 90일 무비자, EES(첫 입국 때 지문·얼굴 등록)가 2025년 10월부터 시행. ETIAS(사전 여행허가)는 아직 시작 전 — 출발 전 공식 사이트 확인 https://travel-europe.europa.eu/etias_en"
    ]
  },
  "스위스": {
    at: "2026-10",
    flight: [
      "취리히 직항은 대한항공뿐, 하계 시즌(대개 3월 말~10월 하순)에만 주 3회. 1인 왕복 약 120~135만원(2026년 9월 조회값), 경유는 더 쌈.",
      "파리·밀라노로 들어가 기차로 넘어오는 방법도 많이 써요."
    ],
    when: [
      "6~9월이 좋아요. 9월 말부터 단풍.",
      "10월 말~11월은 산악 리프트 정비 기간(예: 그린델발트 피르스트 2026년 10/26~11/27 운휴)이고 첫눈으로 하이킹길이 막히기도 해요."
    ],
    course: ["짐을 덜 옮기는 거점 체류: 인터라켄·그린델발트 3박 → 체르마트 2박 → 루체른·취리히 1박."],
    sights: ["융프라우요흐(3,454m)", "피르스트 클리프워크·바흐알프제 하이킹", "뮈렌·라우터브루넨 절벽 마을", "체르마트 고르너그라트·마테호른 일출", "인터라켄 패러글라이딩·호수 유람선"],
    food: ["체르마트 Whymper-Stube(퐁듀·라클레트)", "융프라우요흐 신라면 컵라면(할인쿠폰 바우처로 교환)", "쿱·미그로스 마트 장보기로 식비 절약"],
    tips: [
      "스위스 트래블패스 2등석: 3일 CHF 254, 8일 CHF 439. 반액카드(CHF 150, 1개월 운임 50%)가 거점 체류엔 유리할 때가 많아요 https://www.sbb.ch/en/offers/buy-swiss-travel-pass",
      "융프라우요흐는 패스로도 무료가 아니에요 — 패스 할인이나 한국 할인쿠폰(동신항운)으로 사고, 성수기엔 좌석 예약 CHF 10 https://www.jungfrau.co.kr/rail/railchf.asp",
      "아침에 산 웹캠으로 날씨를 보고 맑은 날에 전망대 가기 — 예비일을 하루 두세요."
    ],
    cautions: [
      "구름이 끼면 전망대에서 아무것도 안 보여요. 3,000m 이상에선 고산병 주의.",
      "물가: 식당 한 끼 1인 10만원을 넘기도 해요. 교통·숙박비가 가장 커요.",
      "입국: EU는 아니지만 쉥겐 지역이라 EES 적용, 여권은 6개월 이상 남기기 권장 https://ch.mofa.go.kr/ch-ko/brd/m_27151/view.do?seq=280&page=1"
    ]
  }
};
const POLICY_BENEFITS_AT = "2026-09-29T23:59";
const POLICY_BENEFITS = [
  { name: "혼인(결혼) 세액공제", target: "2024~2026년 혼인신고, 생애 1회 · 소득 제한 없음", benefit: "1인 50만원 세액공제 — 맞벌이 각자 적용 시 부부 합산 최대 100만원", fit: "good", fitText: "가능", why: "소득 제한이 없어 부부합산 1.5억도 전액 적용돼요. 2026년 12월 31일까지 혼인신고해야 받아요. 2026 세제개편 정부안(8.3 발표)은 2027년부터 이 공제를 없애고 재정지원으로 바꾸는 내용이에요(국회 심의 중).", link: "https://www.hometax.go.kr" },
  { name: "혼인 증여재산공제 (결혼자금)", target: "혼인신고일 전후 각 2년 안에 부모·조부모(직계존속)에게 받은 증여", benefit: "각자 자기 부모·조부모에게서 받는 돈이 1인 1.5억(기본 공제 5천만 + 혼인 공제 1억)까지 증여세가 없어요. 부부 합산 최대 3억. 혼인 공제 1억은 출산 공제(자녀 출생일로부터 2년 안의 증여)와 합쳐 1인 1억이 한도예요(상속세 및 증여세법 제53조·제53조의2)", fit: "good", fitText: "가능", why: "소득·자산 요건 없음. 기준일은 결혼식이 아니라 혼인신고일 — 신고일 전 2년~후 2년 안에 받아야 해요. 혼인신고를 미루면 증여 시점도 그 기간에 맞춰야 해요. 공제를 받으려면 증여세 신고는 해야 해요", link: "https://www.nts.go.kr" },
  { name: "청약 결혼 페널티 폐지", target: "모든 (예비)부부 · 소득 무관", benefit: "부부 중복청약 허용, 배우자 혼전 당첨이력 배제, 배우자 통장기간 50% 합산(최대 3점)", fit: "good", fitText: "가능", why: "소득 무관 — 맞벌이 고소득 신혼부부의 당첨 확률을 실질적으로 높여주는 제도예요. 부부가 둘 다 당첨되면 먼저 신청한 1건만 유효해요. 공공주택특별법 공공분양은 부부 중 한 명만 신청할 수 있어요. 본인의 혼전 당첨 이력이 있어도 신혼특공은 한 번 더 넣을 수 있어요.", link: "https://www.applyhome.co.kr" },
  { name: "ISA (2026 세제개편 정부안 · 9.1 국무회의 확정, 국회 심의 중)", target: "19세 이상 · 일반형은 소득 제한 없음", benefit: "일반형: 연 2,000만/총 1억, 비과세 200만(초과분 9.9%) — 이월·계약기간 현행 유지(9/1 국무회의에서 폐지안 철회). 신설 '생산적금융 ISA'(2027~): 국내주식·국내주식형펀드 전용, 이자·배당 전액 비과세, 연 2,000만/총 2억, 일반형과 중복가입 가능", fit: "good", fitText: "가능", why: "미사용 한도 이월이 그대로라 급하게 몰아 넣을 필요 없음. 생산적금융 ISA는 국회 통과 후 2027년 시행 예정", link: "https://www.moef.go.kr" },
  // 한도는 2026-09 주택도시기금 공고 대조(2025.6.28 이후 계약 기준) — policy().loan.programs 와 같이 고친다
  { name: "신생아 특례 디딤돌 (구입)", target: "신청일 기준 2년 안에 출산한 가구 · 부부 연소득 합산 2억 이하(한 사람 1.3억 이하)·외벌이 1.3억 이하 · 집값 9억·전용 85㎡ 이하", benefit: "최대 4억(생애최초 LTV 수도권·규제지역 70%) · 특례금리 1.80~4.50% 5년(추가 출산 시 자녀 1명당 5년씩 연장, 최장 15년)", fit: "warn", fitText: "출산 시 가능", why: "맞벌이 특례 합산 2억까지 허용 — 단 출산이 전제, 소득 상위구간은 금리 상단. 과천은 9억 상한이 관건", link: "https://www.myhome.go.kr" },
  { name: "신생아 특례 버팀목 (전세)", target: "신청일 기준 2년 안에 출산한 가구 · 부부 연소득 합산 2억 이하(한 사람 1.3억 이하)·외벌이 1.3억 이하 · 보증금 수도권 5억·그 외 4억 이하 · 순자산 3.45억 이하", benefit: "보증금 80% 이내 최대 2.4억 · 특례금리 연 1.3~4.3%(소득·보증금 구간별)", fit: "warn", fitText: "출산 시 가능", why: "소득은 통과 가능하나 출산 요건 필수 + 순자산 기준 확인 필요", link: "https://www.myhome.go.kr" },
  { name: "서울시 장기전세Ⅱ (미리내집)", target: "혼인신고일로부터 7년 이내이거나 입주 전까지 혼인을 증명할 예비신혼부부 · 60㎡ 이하는 120%(맞벌이 180%), 초과는 150%(맞벌이 200%)", benefit: "시세 80% 이하 전세로 10년+ 거주(출산 시 최장 20년), 보증금 분할납부제(공고마다 달라요, 제7차 기준) — 입주 때 70%만 내고 30%는 연 2.73% 이자로 유예", fit: "warn", fitText: "경계선", why: "맞벌이 200% 기준(2인 연 1.4~1.5억대)에 걸치는 소득 — 공고별 기준액 확인 필수", link: "https://www.i-sh.co.kr" },
  { name: "청년주택드림 청약통장", target: "19~34세 무주택 · 개인 연소득 5천만 이하", benefit: "우대금리 최고 4.5%. 당첨 시 연계대출은 기본 연 2.40~4.15%예요. 결혼·출산 우대를 받으면 최저 1.5%까지 내려가요(분양가 6억·85㎡ 이하).", fit: "warn", fitText: "부분가능", why: "개인소득 5천만 이하인 배우자 명의로만 가입 가능", link: "https://www.molit.go.kr/2024dreamaccount/main.jsp" },
  { name: "청약통장 소득공제", target: "총급여 7천만 이하 + 무주택 세대의 세대주 또는 배우자(2025~)", benefit: "총급여 7천만 이하인 무주택 세대의 세대주나 배우자는 본인 명의로 낸 돈 연 300만까지 40%(최대 120만)를 소득공제받아요. 부부가 각자 요건을 채우면 각자 받아요. 2028년 납입분까지예요.", fit: "warn", fitText: "부분가능", why: "총급여 7천만 이하인 쪽이 세대주가 아니어도 배우자로 공제 가능 — 부부 모두 7천만 초과면 불가", link: "https://www.hometax.go.kr" },
  { name: "청년미래적금 (2026 신설)", target: "만 19~34세 · 개인 총급여 7,500만(종합소득 6,300만) 이하 · 가구소득이 기준 중위소득 200%(맞벌이 부부 250%) 이하. 2차 가입 신청은 2026.10.7~10.16이에요.", benefit: "3년 만기 · 월 50만 · 정부기여금 일반형 6% / 우대형(총급여 3,600만 이하 중소기업 등) 12% + 비과세", fit: "bad", fitText: "소득 초과", why: "부부합산 1.5억은 맞벌이 2인 가구 중위 250%(연 약 1.26억)를 초과해 가구소득 요건 탈락", link: "https://ylaccount.kinfa.or.kr" },
  { name: "신혼부부 전용 디딤돌·버팀목", target: "혼인신고일로부터 7년 이내 · 부부 연소득 합산 7,500만(전세)~8,500만(구입) 이하", benefit: "구입 최대 3.2억(2025.6.28 이후 계약분, 연 2.55~3.85%) / 전세 수도권 최대 2.5억(연 1.9~3.3%)", fit: "bad", fitText: "소득 초과", why: "부부합산 소득 한도를 크게 초과", link: "https://nhuf.molit.go.kr" },
  { name: "보금자리론 1인 소득 기준 (2026.10.19~)", target: "신혼부부 합산 소득이 기준(8,500만)을 넘어도 배우자 한 명 소득 7천만 이하 · 주택 6억 이하", benefit: "그 배우자가 단독 차주로 보금자리론(최대 3.6억, 생애최초 4.2억) 신청 — 상환능력은 차주 1인 소득·부채로 심사", fit: "warn", fitText: "조건부 가능", why: "소득 낮은 쪽이 7천만 이하면 해당 — 다만 6억 이하 주택이라 과천보다 경기 외곽·빌라·오피스텔 매매에 맞는 경로", link: "https://www.hf.go.kr/ko/sub01/sub01_01_01.do" },
  { name: "배우자 주식 증여 후 매도 (이월과세 1년)", target: "해외주식 등 평가이익이 큰 주식 보유 부부", benefit: "배우자 증여공제 10년 6억 안에서 넘기면 취득가가 증여 시점 가격으로 올라가 양도세가 줄어요", fit: "good", fitText: "가능", why: "2025년 증여분부터 1년 안에 팔면 이월과세로 원래 취득가 적용 → 집 잔금 등 쓸 날보다 1년 이상 먼저 증여. 생활비를 한 통장으로 자주 옮기면 증여로 잡혀 6억 한도를 조금씩 쓸 수 있으니 공동 생활비 통장은 따로", link: "https://www.nts.go.kr" },
  { name: "주택임차차입금 원리금 상환 소득공제", target: "무주택 세대주(요건 시 세대원) · 전용 85㎡(국민주택규모) 이하 주택 · 전세대출 원리금 상환", benefit: "상환액의 40% 소득공제 — 청약저축 공제와 합산 연 400만 한도", fit: "good", fitText: "전세 시 가능", why: "과천 전세 진입 계획이면 바로 해당 — 은행·HF 등 대출기관에서 직접 빌린 전세대출이어야 해요", link: "https://www.hometax.go.kr" },
  { name: "월세 세액공제", target: "무주택 세대주 · 총급여 8천만 이하 · 전용 85㎡ 또는 기준시가 4억 이하", benefit: "연 월세 1,000만 한도 15~17% 세액공제. 총급여 5,500만 이하는 17%, 넘으면 15%예요.", fit: "warn", fitText: "월세 시 가능", why: "총급여 8천만 이하인 쪽이 세대주로 계약하면 받을 수 있어요", link: "https://www.hometax.go.kr" },
  { name: "맞벌이 연말정산 몰아주기", target: "맞벌이 부부", benefit: "의료비(총급여 3% 문턱)는 소득 낮은 쪽, 자녀 인적공제·자녀세액공제는 세율 높은 쪽, 신용카드(총급여 25% 문턱)는 소득 낮은 쪽에 모으기", fit: "good", fitText: "가능", why: "같은 지출이라도 누구 명의로 공제받느냐에 따라 환급이 달라져요 — 산후조리원 비용(200만 한도)도 의료비 공제 대상", link: "https://www.hometax.go.kr" },
  { name: "출산·자녀 세제 혜택", target: "자녀 출산·양육 가구", benefit: "자녀세액공제(1명 25만·2명 55만) · 출산·입양 세액공제(30/50/70만, 2026 세제개편 정부안에서 폐지·재정지원 전환(국회 심의 중)) · 회사 출산지원금 출생 2년 내 2회 전액 비과세 · 6세 이하 보육수당 월 20만 비과세 · 난임시술비 30% 세액공제", fit: "warn", fitText: "출산 시 가능", why: "회사 출산지원금 비과세와 산후조리원 의료비 공제는 놓치기 쉬워요", link: "https://www.hometax.go.kr" },
  { name: "서울시 임차보증금 이자지원", target: "혼인신고일로부터 7년 이내 · 부부 연소득 합산 1.3억 이하 · 보증금 7억 이하", benefit: "대출 최대 3억에 연 1.5%+α 이자지원, 최장 10년", fit: "bad", fitText: "소득 초과", why: "상향된 기준(1.3억)도 초과 — 추가 상향 여부는 모니터링 가치 있음", link: "https://housing.seoul.go.kr" }
];
function judgePolicy(p, hh) {
  const i1 = Number(hh.income1) || 0, i2 = Number(hh.income2) || 0, sum = i1 + i2, dual = i1 > 0 && i2 > 0;
  const low = Math.min(i1, i2), lowName = i1 <= i2 ? hh.label1 || "본인" : hh.label2 || "배우자";
  const assets = Number(hh.assets) || 0;
  const st = store.get("eligibility-profile-v1", null) || {};
  const monthlyWon = st.incomeSrc === "manual" ? (Number(st.me) || 0) + (Number(st.spouse) || 0) : Math.max(0, Math.round(sum * 1e4 / 12) - (dual ? 2 : 1) * (Number(st.nontaxMonthly) || 0));
  const R = (fit, fitText, why) => ({ ...p, fit, fitText, why, auto: true });
  const Y = policy().youth, MEDIAN_2P_200_MAN = Math.round(Y.median2pMonthlyWon * Y.youthFutureDualPct / 100 * 12 / 1e4);
  const INCOME_BASE_100 = policy().specialSupply.incomeBase100;
  const n = String(p.name || "");
  const S = `부부 연소득 합산 ${manWon(sum)}`;
  const over = (label, capMan) => `${S}이 ${label} ${manWon(capMan)}보다 ${manWon(sum - capMan)} 많아요`;
  const newbornIncomeFail = (re) => {
    const pg = policy().loan.programs.find((x) => re.test(x.name)) || {}, cap = dual ? pg.incomeMax || 2e4 : pg.incomeMaxSingle || 13e3, per = pg.perPersonMax;
    const hi = Math.max(i1, i2);
    return sum > cap ? over(dual ? "기준" : "외벌이 기준", cap) : dual && per && hi > per ? `한 사람 연소득 ${manWon(hi)}이 1인 상한 ${manWon(per)}보다 ${manWon(hi - per)} 많아요` : "";
  };
  if (/신생아.*디딤돌/.test(n)) {
    const f = newbornIncomeFail(/신생아.*디딤돌/);
    return !f ? R("warn", "출산 시 가능", `${S}은 ${dual ? "맞벌이 기준 2억·한 사람 1.3억" : "외벌이 기준 1.3억"} 이하라 소득은 통과해요. 신청일 기준 2년 안에 출산한 가구여야 하고, 집은 9억·전용 85㎡ 이하여야 해요.`) : R("bad", "소득 초과", f);
  }
  if (/신생아.*버팀목/.test(n)) {
    const f = newbornIncomeFail(/신생아.*버팀목/);
    if (f) return R("bad", "소득 초과", f);
    if (assets > 34500) return R("bad", "자산 초과", `순자산 ${manWon(assets)}이 기준 3.45억보다 ${manWon(assets - 34500)} 많아요`);
    return R("warn", "출산 시 가능", `${S}·순자산 ${manWon(assets)} 모두 기준 이하예요. 신청일 기준 2년 안에 출산한 가구여야 해요.`);
  }
  if (/장기전세|미리내집/.test(n)) {
    const lim = INCOME_BASE_100[2] * 2, r = monthlyWon / lim;
    const why = `부부 월소득 합산 ${won(monthlyWon)}(세전, ${st.incomeSrc === "manual" ? "자격 진단에 직접 입력한 값" : "연소득 ÷ 12 − 비과세"})과 맞벌이 기준(도시근로자 월평균소득 200% = ${won(lim)})을 비교했어요`;
    return r <= 0.9 ? R("good", "가능", `${why}. 기준 이하예요.`) : r <= 1 ? R("warn", "경계선", `${why}. 기준에 가까워 공고별 기준액을 확인해야 해요.`) : R("bad", "소득 초과", `${why}. 기준보다 ${won(monthlyWon - lim)} 많아요.`);
  }
  if (/청년주택드림/.test(n)) return low <= 5e3 ? R("warn", "부분가능", `${lowName} 연소득 ${manWon(low)}이 기준 5천만 이하라 ${lowName} 명의로 가입할 수 있어요(만 34세 이하인지 확인).`) : R("bad", "소득 초과", "두 분 모두 개인 연소득이 5천만을 넘어요.");
  if (/청약통장 소득공제/.test(n)) return low <= 7e3 ? R("warn", "부분가능", `${lowName} 총급여 ${manWon(low)}이 7천만 이하예요. 무주택 세대의 세대주나 배우자라 공제받을 수 있어요(본인 명의 납입분 연 300만 한도).`) : R("bad", "소득 초과", "두 분 모두 총급여가 7천만을 넘어요.");
  if (/청년미래적금/.test(n)) return low <= Y.youthFuturePersonalMaxMan && sum <= MEDIAN_2P_200_MAN ? R("warn", "부분가능", `개인 소득과 가구 소득(${S}) 모두 기준 이하예요. 만 34세 이하인지 확인해요.`) : R("bad", "소득 초과", sum > MEDIAN_2P_200_MAN ? `${S}이 맞벌이 2인 가구 중위소득 ${Y.youthFutureDualPct}%(약 ${manWon(MEDIAN_2P_200_MAN)})보다 ${manWon(sum - MEDIAN_2P_200_MAN)} 많아요` : `개인 총급여가 기준 ${manWon(Y.youthFuturePersonalMaxMan)}을 넘어요.`);
  if (/신혼부부.*(디딤돌|버팀목)/.test(n)) return sum <= 7500 ? R("good", "가능", `${S}이 디딤돌 기준(8,500만)·버팀목 기준(7,500만) 모두 이하예요.`) : sum <= 8500 ? R("warn", "구입만 가능", `${S}이 디딤돌 기준(8,500만) 이하라 구입 대출만 돼요. 버팀목 기준(7,500만)보다는 ${manWon(sum - 7500)} 많아요.`) : R("bad", "소득 초과", over("디딤돌 기준", 8500));
  if (/임차보증금 이자지원/.test(n)) return sum <= 13e3 ? R("good", "가능", `${S}이 기준 1.3억 이하예요(보증금 7억 이하 · 혼인신고일로부터 7년 이내).`) : R("bad", "소득 초과", over("기준", 13e3));
  return p;
}
(() => {
  const f = (inc1, inc2, name) => judgePolicy({ name }, { income1: inc1, income2: inc2, assets: 2e4 }).fit;
  if (f(9700, 6e3, "신혼부부 전용 디딤돌·버팀목") !== "bad" || f(4e3, 3e3, "신혼부부 전용 디딤돌·버팀목") !== "good" || f(9700, 6e3, "청약통장 소득공제") !== "warn") console.error("judgePolicy 실패");
})();
const KIDS_CHECKLIST_DEFAULT = [
  { cat: "임신 준비", items: [
    "보건소 무료 산전검사 (부부 모두 — 풍진·엽산 포함)",
    "난임·임신 지원 정책 확인 (지자체별 상이)",
    "신생아 특공·신생아 특례대출 요건 미리 확인 (소득·주택가격 상한)",
    "태아보험 견적 비교 (임신 확인 직후 가입이 조건 유리)",
    "출산휴가·육아휴직 일정 회사와 사전 협의"
  ] },
  { cat: "임신 중", items: [
    "임신·출산 진료비 바우처 신청 (국민행복카드 100만원)",
    "산부인과 정기검진 일정 캘린더 등록",
    "산후조리원 예약 — 인기 지역은 임신 초기에 마감",
    "아기용품 리스트 작성 (중고·물려받기 먼저 확인)",
    "어린이집 입소대기 등록 가능 여부 확인 (일부 지자체 임신 중 가능)"
  ] },
  { cat: "출생 ~ 6개월", items: [
    "출생신고 (1개월 내) + 첫만남이용권(첫째 200만·둘째 이상 300만) 신청",
    "부모급여 신청 (0세 월 100만 · 1세 월 50만)",
    "아동수당 신청 (월 10만원, 2026년 만 9세 미만 → 2030년 만 13세 미만까지 단계 확대)",
    "부모급여는 출생 후 60일 안에 신청해야 출생월부터 소급",
    "육아휴직: 1~3개월 월 250만·4~6개월 200만·이후 160만 상한 / 부모 모두 쓰면 6+6(첫 6개월 각자 최대 450만), 각 3개월 이상 쓰면 1년 6개월 / 배우자 출산휴가 20일",
    "예방접종 일정 등록 (BCG·B형간염 등 — 질병청 앱)",
    "영유아 건강검진 주기 등록",
    "어린이집 입소대기 등록 (인기 국공립은 1~2년 대기)"
  ] },
  { cat: "6개월 ~ 3세", items: [
    "부모급여 → 양육수당/보육료 전환 확인 (어린이집 이용 여부에 따라)",
    "어린이집 적응 프로그램 계획",
    "영유아 발달 체크 (검진 시기마다)",
    "양가 돌봄·아이돌봄서비스 등 보육 공백 대책"
  ] },
  { cat: "4~5세 (유아)", items: [
    "유치원 vs 어린이집 결정 (유아학비·보육료 지원 비교)",
    "'처음학교로' 유치원 입학 신청 (매년 11월 추첨)",
    "사교육 방향 부부 합의 (시작 시기·예산 상한)"
  ] },
  { cat: "초등 이후", items: [
    "취학통지서 확인 (입학 전해 12월) 및 예비소집",
    "늘봄학교·돌봄교실 신청 (맞벌이 필수 체크)",
    "학군지 이사 여부 결정 — 내 집 마련 입주 시점과 연계",
    "교육비 장기 적립 시작 (절세계좌 활용)"
  ] }
];
const KIDS_EDU_STAGES = {
  infant: { label: "영유아 (0~5세)", intro: "출생 직후 서류·수당부터 취학 준비까지 — 영유아기는 신청 시기를 놓치면 손해가 큰 구간이에요.", cards: [
    { age: "0~12개월", timing: "출생 직후 서류·수당 신청 러시", points: ["출생신고(1개월 내) + 첫만남이용권 200만(둘째 이상 300만)", "부모급여 월 100만(0세) · 아동수당 월 10만 동시 신청 — 부모급여는 60일 내 신청해야 소급", "예방접종 스케줄 등록 (4주 내 BCG·B형간염 2차)", "영유아 건강검진 1차(14~35일)부터 주기 관리", "어린이집 입소대기 등록 — 국공립은 1~2년 대기"], q: "신생아 지원금 신청 순서" },
    { age: "1~2세", timing: "가정보육 vs 어린이집 결정", points: ["부모급여 1세 월 50만 → 이후 양육수당/보육료 전환", "3월 입소가 대부분 — 전해 11~12월에 대기 확정 연락", "어린이집 적응 기간(1~2주) 부모 일정 확보", "18~24개월 언어 발달 체크 (영유아검진 문진 활용)"], q: "어린이집 첫 입소 적응" },
    { age: "3~4세 (유아 전환)", timing: "유치원 전환 검토 시작", points: ["누리과정 지원 시작(만 3세) — 유아학비/보육료 비교", "어린이집 유아반 vs 유치원: 교육과정·하원시간·방학 비교", "'처음학교로' 일정 미리 파악 (매년 11월 신청·추첨)", "가정학습 방향 부부 합의 (한글·수 놀이 수준)"], q: "유치원 어린이집 차이 선택" },
    { age: "5세 (취학 전)", timing: "초등 준비의 해", points: ["유치원 방과후과정(돌봄) 유지 여부 확인", "취학 전 건강검진 — 시력·치과·언어", "초등 학군 확정 — 이사한다면 입학 전해 여름까지", "등하교 연습 등 기초 생활습관 만들기"], q: "예비 초등학생 준비" }
  ] },
  elementary: { label: "초등 (6년)", intro: "저학년은 돌봄 공백 대책, 고학년은 중등 대비가 핵심이에요. 학군지 이사의 실질 마지노선도 이 구간입니다.", cards: [
    { age: "예비 초등 (입학 전 겨울)", timing: "취학통지서: 입학 전해 12월", points: ["취학통지서 수령·예비소집 참석", "늘봄학교·돌봄교실 신청 — 맞벌이 필수 체크", "방과후학교 프로그램 미리 확인", "입학 준비물·생활 루틴 세팅"], q: "초등학교 입학 준비물 예비소집" },
    { age: "1~2학년", timing: "돌봄 공백 대책이 최우선", points: ["늘봄학교(아침·저녁)로 하교 공백 커버", "독서 습관 등 기초 학습습관 형성", "사교육은 예체능 위주로 가볍게", "부모 참여 행사(공개수업·상담) 일정 관리"], q: "초등 저학년 늘봄학교 후기" },
    { age: "3~4학년", timing: "교과 학습이 시작되는 구간", points: ["수학 격차가 벌어지기 시작 — 기초 연산 점검", "영어 노출 확대 (학원 vs 홈스쿨 결정)", "과천 거주 시 평촌 학원가 접근성 체감 시작", "진로 탐색 활동·독서 확장"], q: "초등 3학년 수학 영어 학습" },
    { age: "5~6학년", timing: "중등 대비 + 학군 결정 마지노선", points: ["수학 선행 여부·속도 부부 합의", "중학교 배정(근거리) 확인 — 학군지 이사면 중1 배정 전까지", "자기주도 학습 습관 완성", "예비 중1 겨울 계획 (자유학기 이해)"], q: "초등 고학년 중등 대비" }
  ] },
  secondary: { label: "중·고등 (6년)", intro: "내신·입시 체계가 계속 바뀌는 구간이라, 시기마다 최신 제도를 확인하는 게 중요해요.", cards: [
    { age: "중1", timing: "자유학기제 — 시험 부담 없는 탐색기", points: ["자유학기(시험 없음) 동안 진로 탐색 집중", "내신 산출 방식·수행평가 구조 이해", "고교 유형(일반고/특목·자사고) 정보 수집 시작"], q: "중1 자유학기제 활용" },
    { age: "중2~3", timing: "고교 선택 결정 구간", points: ["지필고사 시작 — 내신 관리 본격화", "고교 유형 결정: 일반고 vs 특목·자사고 (통학거리 포함)", "고교학점제 개설과목 학교별 비교", "고입 전형 일정(11~12월) 체크"], q: "고등학교 선택 특목고 일반고" },
    { age: "고1", timing: "고교학점제 과목 선택이 입시 방향", points: ["진로 연계 과목 선택 전략 (선택과목이 대입과 직결)", "내신 + 학교생활기록부 관리 시작", "수시/정시 방향 1차 판단"], q: "고교학점제 과목 선택" },
    { age: "고2~3", timing: "대입 전형 확정·실행", points: ["수시(학종·교과) vs 정시 전략 확정", "수능 대비 로드맵·모의고사 관리", "전형료·컨설팅·재수 가능성까지 예산 계획"], q: "대입 수시 정시 전략" }
  ] },
  college: { label: "대학·교육비", intro: "교육비는 닥쳐서 마련하면 늦어요 — 출생 직후부터 증여 공제와 장기 적립을 묶어 준비하는 게 핵심입니다.", cards: [
    { age: "출생~10세 (적립기)", timing: "복리 효과가 가장 큰 구간", points: ["월 20만 적립(연 4%) 18년 ≈ 6,300만 — 저축 시뮬레이터로 계산", "미성년 증여 공제 1차 활용 (10년간 2,000만 비과세)", "자녀 명의 계좌 개설 + 증여세 신고(공제 내라도 신고 권장)"], q: "자녀 증여 계좌 적립" },
    { age: "10~15세 (증액기)", timing: "증여 공제 2회차 개시", points: ["10년 경과 후 추가 2,000만 증여 가능", "적립 포트폴리오 중간 점검·리밸런싱", "사교육비와 장기 적립의 균형 재조정"], q: "미성년 자녀 증여 2천만원" },
    { age: "15~19세 (확정기)", timing: "목표액·부족분 확정", points: ["목표: 국공립 4년 3~4천만 vs 사립 5~7천만 (생활비 별도)", "사교육 피크(고교) 예산과 대학 자금 분리 관리", "수시 전형료·입학금 등 일시 지출 대비"], q: "대학 등록금 4년 비용" },
    { age: "대학 재학", timing: "장학·대출 제도 활용", points: ["국가장학금(소득구간별) 매 학기 신청", "학자금 대출 vs 자체 자금 비교", "등록금 분할 납부 제도 활용 가능"], q: "국가장학금 소득분위" }
  ] }
};
const SCHOOL_DISTRICTS = [
  { area: "과천", tags: ["거주 예정지", "중소형 학군"], note: "학업 성취도 높고 면학 분위기 조용한 편. 학원가는 평촌(15분) 의존 — 초등까지는 과천, 중등부터 평촌 학원가 활용이 일반적.", q: "과천 학군 초등학교" },
  { area: "평촌 (안양 동안구)", tags: ["수도권 3대 학원가"], note: "범계·평촌역 학원가 밀집. 과천에서 가장 가까운 대형 학원가로, 과천 거주 시 실질적 사교육 거점.", q: "평촌 학원가 학군" },
  { area: "분당 (성남)", tags: ["학군 + 학원가"], note: "수내·서현 중심 학군과 정자·미금 학원가. 판교 직주근접 수요와 겹쳐 진입 비용 높음.", q: "분당 학군 수내 서현" },
  { area: "대치 (강남)", tags: ["전국 최상위"], note: "전국 최대 학원가. 중등 이후 '대치 유학' 수요도 많음 — 거주 전환은 교육비·주거비 동반 상승 감안.", q: "대치동 학군 학원가" },
  { area: "목동 (양천)", tags: ["강서권 대표"], note: "목동 신시가지 단지 중심 학군·학원가. 재건축 진행에 따라 단지별 편차.", q: "목동 학군 재건축" }
];
const ELIG_DEFAULT = {
  me: 7855556,
  spouse: 4718403,
  // 2026-08-24 건보 보수월액 검증값 (2025년 월평균)
  kids: 0,
  fetus: 0,
  // 태아 수 — 가구원 수 = 부부 + 자녀 + 태아
  asset: 2e4,
  car: 0,
  // 만원 — 총자산(부채 차감 후) / 차량가액. 공고마다 다른 한도는 공고별 분석이 공고문으로 판정
  householdMode: "separate",
  // 세대 구성 — separate 각자 세대주 · head1/head2 한쪽 세대주+동거인 · joint 혼인 후 한 세대
  residence: [{ city: "", since: "" }, { city: "", since: "" }]
  // 사람별 거주 시·군, 전입 연월(YYYY-MM) — 지역 우선공급 판정
};
function householdModeLabel(mode, names) {
  return { head1: `${names[0]} 세대주·${names[1]} 동거인`, head2: `${names[1]} 세대주·${names[0]} 동거인`, joint: "혼인 후 한 세대" }[mode] || "각자 세대주(따로 세대)";
}
function eunNeun(name) {
  const c = String(name || "").charCodeAt(String(name || "").length - 1);
  return `${name}${c >= 44032 && c <= 55203 && (c - 44032) % 28 === 0 ? "는" : "은"}`;
}
const HH_DEFAULT = {
  income1: 9700,
  income2: 6e3,
  assets: 2e4,
  monthlySave: 250,
  firstTime: true,
  targetKey: "jeonse59budget",
  rate: 6.3,
  existingDebtMonthly: 0,
  // 직접 입력 목표 — targetKey가 "custom"일 때 사용. { dealType: "매매"|"전세"|"청약", price(원), area(㎡, 선택), name(선택) }
  customTarget: null,
  loanAmountCalc: 6e4,
  loanRateCalc: 4.5,
  loanYearsCalc: 30,
  repayType: "equal_payment",
  label1: "본인",
  label2: "배우자"
  // 커스텀 호칭 — 홈 설정에서 변경
};
const TARGET_DEAL_TYPES = ["매매", "전세", "월세", "청약"];
const CUSTOM_TARGET_DEFAULT = { dealType: "전세", price: 64e7, rent: 0, area: 59, name: "" };
const presetToCustom = (t) => ({
  dealType: t.key.startsWith("sale") ? "매매" : t.key.startsWith("sub") ? "청약" : "전세",
  price: t.price,
  rent: 0,
  area: t.label.includes("84") ? 84 : t.label.includes("59") ? 59 : 0,
  name: ""
});
function customTargetOf(s) {
  if (s.customTarget && Number(s.customTarget.price) > 0) return { ...CUSTOM_TARGET_DEFAULT, ...s.customTarget };
  const t = TARGETS.find((t2) => t2.key === s.targetKey);
  return t ? presetToCustom(t) : { ...CUSTOM_TARGET_DEFAULT };
}
function customTargetLabel(c) {
  const area = Number(c.area) > 0 ? ` · ${pyeongText(c.area)}` : "";
  return `${c.dealType || "매매"}${area}${c.name ? " · " + c.name : ""}`;
}
function resolveTarget(s) {
  const c = customTargetOf(s);
  const dealType = TARGET_DEAL_TYPES.includes(c.dealType) ? c.dealType : "매매";
  const rent = dealType === "월세" ? Math.max(0, Number(c.rent) || 0) : 0;
  return {
    key: "custom",
    label: customTargetLabel({ ...c, dealType }),
    price: Number(c.price) || 0,
    rent,
    area: Number(c.area) || 0,
    name: c.name || "",
    note: dealType === "월세" ? `보증금 ${won(Number(c.price) || 0)} · 월세 ${won(rent)}` : "직접 입력한 목표",
    isSale: dealType === "매매",
    dealType
  };
}
const ALLOC_DEFAULT = { totalCash: 2e4, realty: 12e3, wedding: 3e3, kids: 0 };
function allocCash(a) {
  if (a?.cash1 == null && a?.cash2 == null) return { cash1: Number(a?.totalCash) || 0, cash2: 0 };
  return { cash1: Number(a.cash1) || 0, cash2: Number(a.cash2) || 0 };
}
const MILESTONES_DEFAULT = [
  { id: "m1", label: "과천 신규 분양 일정 확인 (지식정보타운·재건축)", date: "2026-12-31" },
  { id: "m2", label: "전세 계약 목표", date: "2026-12-01" }
];
function SectionHeader({ eyebrow, title, accent }) {
  return /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, eyebrow && /* @__PURE__ */ React.createElement("div", { className: `text-[11px] font-medium text-[#6B6B6B] mb-1.5 ${/[가-힣]/.test(String(eyebrow)) ? "" : "font-mono tracking-[0.16em] uppercase"}` }, eyebrow), /* @__PURE__ */ React.createElement("h2", { className: "text-[19px] font-bold tracking-tight text-[#0A0A0A]" }, title));
}
function Card({ children, className = "", ...rest }) {
  return /* @__PURE__ */ React.createElement("div", { ...rest, className: `bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-5 ${className}` }, children);
}
function ThumbImg({ src, alt, fallback }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const safe = safeUrl(src);
  if (!safe || broken) return fallback;
  return /* @__PURE__ */ React.createElement("img", { src: safe, alt, referrerPolicy: "no-referrer", onError: () => setBroken(true), className: "w-full h-full object-cover" });
}
function Kpi({ icon, label, value, accent = "#0A0A0A" }) {
  return /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-14px_rgba(0,0,0,0.14)] p-4 lg:p-5 flex items-center gap-3.5" }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:flex w-10 h-10 rounded-xl bg-[#F4F4F5] items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 18 })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-0.5" }, label), /* @__PURE__ */ React.createElement("div", { className: "text-[19px] lg:text-[21px] font-bold tracking-tight truncate", style: { fontVariantNumeric: "tabular-nums" } }, value)));
}
function ToneBadge({ tone, children }) {
  const map = { good: "bg-[#0A0A0A] text-white", warn: "bg-white text-[#0A0A0A] border border-[#0A0A0A]", bad: "bg-white text-[#6B6B6B] border border-dashed border-[#C9C9C9]", neutral: "bg-[#F2F2F2] text-[#525252]" };
  return /* @__PURE__ */ React.createElement("span", { className: `text-[12px] px-3 py-1 rounded-full font-semibold whitespace-nowrap ${map[tone] || map.neutral}` }, children);
}
const noNudge = {
  onWheel: (e) => e.currentTarget.blur(),
  onKeyDown: (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  }
};
function Field({ label, value, onChange, step = 1 }) {
  const id = React.useId();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: id, className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement(
    "input",
    {
      id,
      type: "number",
      inputMode: "decimal",
      step,
      value: typeof value === "number" && !Number.isInteger(value) ? r2(value) : value,
      onChange: (e) => onChange(Number(e.target.value)),
      ...noNudge,
      className: "w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[16px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors",
      style: { fontVariantNumeric: "tabular-nums" }
    }
  ));
}
function Select({ label, value, onChange, options }) {
  const id = React.useId();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: id, className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement(
    "select",
    {
      id,
      value,
      onChange: (e) => onChange(e.target.value),
      className: "w-full h-12 px-3 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    },
    options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o.value, value: o.value }, o.label))
  ));
}
function Toggle({ label, active, onClick, activeText, inactiveText }) {
  const opt = (on, text) => /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      role: "radio",
      "aria-checked": on,
      onClick: on ? void 0 : onClick,
      className: `flex-1 min-w-0 px-2 rounded-lg text-[14px] font-semibold leading-tight transition-colors ${on ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-white"}`
    },
    text
  );
  return /* @__PURE__ */ React.createElement("div", { className: "flex flex-col justify-end" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement("div", { role: "radiogroup", "aria-label": label, className: "flex gap-1 min-h-[48px] p-1 rounded-xl bg-[#F5F5F5]" }, opt(!!active, activeText), opt(!active, inactiveText)));
}
function Stat({ label, value, sub, tone }) {
  const color = tone === "warn" ? "text-[#0A0A0A]" : tone === "good" ? "text-[#0A0A0A]" : "text-[#0A0A0A]";
  return /* @__PURE__ */ React.createElement("div", { className: "py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1" }, label), /* @__PURE__ */ React.createElement("div", { className: `text-2xl font-bold ${color}`, style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, value), sub && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-1" }, sub));
}
function InfoNote({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 text-[13px] text-[#6B6B6B] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 15, className: "mt-0.5 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, children));
}
function FilterRow({ label, value, active }) {
  return /* @__PURE__ */ React.createElement("div", { className: `flex justify-between items-center px-4 py-3.5 rounded-xl ${active ? "bg-[#0A0A0A]/10 border border-[#0A0A0A]/40" : "bg-[#F7F7F7]"}` }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px]" }, label), /* @__PURE__ */ React.createElement("span", { className: `text-[16px] font-bold ${active ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}` }, value));
}
function SourceBadge({ source, error }) {
  if (error) return /* @__PURE__ */ React.createElement(ToneBadge, { tone: "bad" }, "불러오기 실패 · 예시 데이터");
  return source === "live" ? /* @__PURE__ */ React.createElement(ToneBadge, { tone: "good" }, "실시간 데이터") : /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, "예시 데이터");
}
function ProgressBar({ ratio, color = "#0A0A0A", height = 6 }) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio || 0) * 100)));
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-full bg-[#F0F0F0] overflow-hidden", style: { height } }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full transition-all", style: { width: `${pct}%`, background: color } }));
}
function NumInput({ value, onChange, className = "", ariaLabel }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      inputMode: "decimal",
      "aria-label": ariaLabel,
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      ...noNudge,
      className: `h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`,
      style: { fontVariantNumeric: "tabular-nums" }
    }
  );
}
const manFull = (man) => `${Math.round((Number(man) || 0) * 1e4).toLocaleString()}원`;
function WonInput({ value, onChange, className = "", ariaLabel, onKeyDown }) {
  const n = Math.round((Number(value) || 0) * 1e4);
  return /* @__PURE__ */ React.createElement("div", { className: "relative min-w-0" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      inputMode: "numeric",
      "aria-label": ariaLabel,
      value: n ? n.toLocaleString() : "",
      placeholder: "0",
      onKeyDown,
      onChange: (e) => {
        const d = e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 13);
        onChange(d ? Number(d) / 1e4 : 0);
      },
      className: `h-10 pl-2.5 pr-6 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`,
      style: { fontVariantNumeric: "tabular-nums" }
    }
  ), /* @__PURE__ */ React.createElement("span", { className: "absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[#6B6B6B] pointer-events-none" }, "원"));
}
function TextInput({ value, onChange, placeholder, className = "", onKeyDown, list, ariaLabel }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "text",
      "aria-label": ariaLabel || placeholder,
      value,
      onChange: (e) => onChange(e.target.value),
      placeholder,
      onKeyDown,
      list,
      className: `h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors ${className}`
    }
  );
}
function IconBtn({ name, onClick, title, className = "" }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, title, "aria-label": title, className: `w-9 h-9 rounded-lg flex items-center justify-center text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/5 shrink-0 ${className}` }, /* @__PURE__ */ React.createElement(Icon, { name, size: 16 }));
}
function PillNav({ tabs, tab, setTab }) {
  const rowRef = useRef(null);
  useEffect(() => {
    const el = rowRef.current && rowRef.current.querySelector('[aria-current="page"]');
    if (el) el.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);
  return /* @__PURE__ */ React.createElement("nav", { className: "sticky top-0 z-10 bg-[#F4F4F5]/95 backdrop-blur -mx-5 sm:-mx-10 px-5 sm:px-10 py-3" }, /* @__PURE__ */ React.createElement("div", { ref: rowRef, className: "flex gap-1.5 overflow-x-auto no-scrollbar [mask-image:linear-gradient(90deg,#000_88%,transparent)] lg:[mask-image:none]" }, tabs.map((t) => {
    const active = tab === t.id;
    return /* @__PURE__ */ React.createElement("button", { key: t.id, onClick: () => setTab(t.id), "aria-current": active ? "page" : void 0, className: `flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}` }, /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 14 }), t.label);
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
    loading ? "불러오는 중" : "새로고침"
  );
}
function LiveUpdateBtn({ topic, params = "", onData }) {
  const [st, setSt] = useState({ loading: false, err: "" });
  const run = async () => {
    setSt({ loading: true, err: "" });
    try {
      const r = await authFetch(`/api/research?topic=${topic}&force=1${params}`);
      const j = await r.json().catch(() => null);
      if (r.status === 504 || !j && r.status >= 500) throw new Error("1분 안에 못 끝냈어요. 서버가 계속 조사 중이니 1~2분 뒤 다시 누르면 결과가 보여요.");
      if (r.ok && j && j.items && !j.items.length) throw new Error("조사 결과가 비어 있어요. 조건(지역 등)을 비우거나 바꿔서 다시 눌러 보세요.");
      if (!r.ok || !j || !j.items) throw new Error(j && j.message || "최신 정보를 가져오지 못했어요. 1~2분 뒤 다시 눌러 주세요(계속 실패하면 서버 키 설정을 확인해요).");
      onData(j);
      setSt({ loading: false, err: "" });
    } catch (e) {
      setSt({ loading: false, err: String(e && e.message || e) });
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, st.err && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B] truncate max-w-[240px]", title: st.err }, st.err), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: run,
      disabled: st.loading,
      className: "flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40 shrink-0"
    },
    /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", className: st.loading ? "animate-spin" : "" }, /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "11", r: "8" }), /* @__PURE__ */ React.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })),
    st.loading ? "웹 검색·정리 중 (최대 1분)" : "최신 정보로 갱신"
  ));
}
function NewsPanel({ query, eyebrow = "실시간", title }) {
  const [state, setState] = useState({ items: [], source: "sample", loading: true, at: null });
  const reqId = useRef(0);
  const load = () => {
    const my = ++reqId.current;
    setState((s) => ({ ...s, loading: true }));
    loadNews(query).then((r) => {
      if (my === reqId.current) setState({ ...r, loading: false, at: /* @__PURE__ */ new Date() });
    });
  };
  useEffect(load, [query]);
  const naverUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow, title }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, state.at && !state.loading && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B]" }, state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), " 갱신"), /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: load, loading: state.loading }))), state.source === "sample" && !state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-3" }, "지금은 실시간 뉴스를 불러오지 못했어요. 잠시 후 새로고침하거나 아래 링크로 바로 확인해 주세요."), /* @__PURE__ */ React.createElement("a", { href: naverUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-[14px] font-semibold underline underline-offset-4" }, '네이버 뉴스에서 "', query, '" 바로 검색 ', /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 }))), state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "뉴스를 불러오는 중…")), !state.loading && state.items.length > 0 && /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F0F0F0]" }, [...state.items].sort((a, b) => String(b.ts || b.date || "").localeCompare(String(a.ts || a.date || ""))).slice(0, 10).map((n, i) => /* @__PURE__ */ React.createElement("li", { key: i }, /* @__PURE__ */ React.createElement("a", { href: safeUrl(n.link) || naverSearch(n.title || query), target: "_blank", rel: "noopener noreferrer", className: "block px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold leading-snug" }, n.title), /* @__PURE__ */ React.createElement("div", { className: "mt-1 flex items-center gap-2 text-[12px] text-[#6B6B6B]" }, n.source && /* @__PURE__ */ React.createElement("span", null, n.source), (n.ts || n.date) && /* @__PURE__ */ React.createElement("span", { className: "font-mono" }, n.ts ? new Date(n.ts).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : n.date)))))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("a", { href: naverUrl, target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#525252] underline underline-offset-4" }, "네이버 뉴스에서 더 보기"))));
}
const NOTE_HTML_TAGS = /* @__PURE__ */ new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "UL", "OL", "LI", "SPAN", "FONT"]);
function sanitizeNoteHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  const scrub = (el) => {
    Array.from(el.children).forEach(scrub);
    if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return el.remove();
    if (!NOTE_HTML_TAGS.has(el.tagName)) return el.replaceWith(...el.childNodes);
    Array.from(el.attributes).forEach((a) => {
      if (!(el.tagName === "FONT" && a.name === "size" && /^[1-7]$/.test(a.value))) el.removeAttribute(a.name);
    });
  };
  Array.from(tpl.content.children).forEach(scrub);
  return tpl.innerHTML;
}
function NoteBody({ note }) {
  if (!note.body) return null;
  return note.html ? /* @__PURE__ */ React.createElement("div", { className: "note-rich text-[14px] text-[#525252] leading-relaxed mt-1.5 break-words", dangerouslySetInnerHTML: { __html: sanitizeNoteHtml(note.body) } }) : /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mt-1.5 whitespace-pre-wrap break-words" }, String(note.body).split(/(https:\/\/[^\s]+)/).map((t, i) => i % 2 ? /* @__PURE__ */ React.createElement("a", { key: i, href: t, target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-2" }, t) : t));
}
function CustomNotes({ themeId, accent = "#0A0A0A" }) {
  const [notes, setNotes] = usePersist(`notes-${themeId}-v1`, []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const add = () => {
    if (!title.trim()) return;
    setNotes([...notes, { id: uid(), at: Date.now(), title: title.trim(), body: body.trim() }]);
    setTitle("");
    setBody("");
    setAdding(false);
  };
  const saveEdit = () => {
    if (!draft.title.trim()) return;
    setNotes(notes.map((n) => n.id === editId ? { ...n, title: draft.title.trim(), body: draft.body.trim(), html: false, u: Date.now() } : n));
    setEditId(null);
  };
  const area = (value, onChange) => /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value,
      onChange: (e) => onChange(e.target.value),
      rows: 3,
      placeholder: "내용 (선택)",
      "aria-label": "메모 내용",
      className: "w-full rounded-lg bg-[#F5F5F5] border border-transparent px-2.5 py-2 text-[14px] leading-relaxed focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    }
  );
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "자유 기록", title: "메모", accent }), !adding && /* @__PURE__ */ React.createElement("button", { onClick: () => setAdding(true), className: "mb-4 h-9 px-3.5 rounded-full bg-white border border-[#E5E5E5] text-[13px] font-semibold text-[#525252] inline-flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " 메모 추가")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, adding && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: title, onChange: setTitle, placeholder: "제목 (예: 상담받은 은행 금리 메모)" }), area(body, setBody), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: add, className: "flex-1 h-10 rounded-xl text-white text-[14px] font-semibold", style: { background: accent } }, "추가"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setAdding(false);
    setTitle("");
    setBody("");
  }, className: "flex-1 h-10 rounded-xl bg-[#F0F0F0] text-[#525252] text-[14px] font-semibold" }, "취소")))), notes.map((n) => /* @__PURE__ */ React.createElement(Card, { key: n.id }, editId === n.id ? /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: draft.title, onChange: (v) => setDraft({ ...draft, title: v }), placeholder: "제목" }), area(draft.body, (v) => setDraft({ ...draft, body: v })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: saveEdit, className: "flex-1 h-10 rounded-xl text-white text-[14px] font-semibold", style: { background: accent } }, "저장"), /* @__PURE__ */ React.createElement("button", { onClick: () => setEditId(null), className: "flex-1 h-10 rounded-xl bg-[#F0F0F0] text-[#525252] text-[14px] font-semibold" }, "취소"))) : /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, n.title), /* @__PURE__ */ React.createElement(NoteBody, { note: n })), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 shrink-0" }, /* @__PURE__ */ React.createElement(IconBtn, { name: "brush", title: "편집", onClick: () => {
    setEditId(n.id);
    setDraft({ title: n.title, body: noteToPlain(n) });
  } }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => setNotes(notes.filter((x) => x.id !== n.id)) }))))), !notes.length && !adding && /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#6B6B6B]" }, "은행 상담, 임장 메모처럼 남겨 둘 것을 적어요. 상담사도 이 메모를 참고해요.")));
}
const POLICY_DISMISSED_KEY = "policy-dismissed-v1";
function policyOverdue(sec, checkedAt) {
  const today = todayYmd();
  if (!checkedAt) return today > sec.nextReview;
  const last = String(checkedAt).slice(0, 10);
  return today > sec.nextReview && last < sec.nextReview || Date.now() - new Date(checkedAt).getTime() > 120 * 864e5;
}
function fmtPolicyValue(path, v) {
  if (typeof v === "number") {
    if (/Won$/.test(path)) return won(v);
    if (/Man$/.test(path)) return manWon(v);
    if (/Pct$/.test(path)) return `${v}%`;
    if (v > 0 && v < 1) return `${+(v * 100).toFixed(3)}%`;
    return v.toLocaleString("ko-KR");
  }
  const L = {
    capWon: /broker/.test(path) ? "최대 금액" : "대출 한도",
    rate: "요율",
    deduction: "누진공제",
    base: "기본",
    slope: "감소율",
    min: "최소",
    overWon: "총급여 기준",
    deal: "거래",
    incomeMax: "부부 연소득 합산 상한",
    incomeMaxSingle: "외벌이 상한",
    perPersonMax: "1인 상한",
    anyPersonMax: "배우자 1인 상한",
    anyPersonFrom: "적용일",
    priceMax: "집값·보증금 상한",
    limit: "대출 한도",
    cond: "조건",
    lowMaxWon: "저율 구간 상한",
    lowRate: "저율",
    highMinWon: "고율 구간 시작",
    highRate: "고율",
    eduSurcharge: "지방교육세 가산",
    maxPriceWon: "대상 집값 상한",
    amountWon: "감면액",
    until: "기한",
    single: "외벌이",
    dual: "맞벌이",
    priority: "우선공급",
    general: "일반공급",
    privatePct: "민영",
    nationalPct: "국민주택",
    maxAreaM2: "최대 면적",
    private: "민영",
    public: "공공",
    newlywed: "신혼특공",
    firstHome: "생애최초(민영)",
    firstHomePublic: "생애최초(공공)",
    firstHomeSingle: "1인 가구 생애최초",
    newborn: "신생아특공(민영)",
    newbornPublic: "신생아특공(공공)",
    lotteryOverIncomeWithPropertyCap: "소득 초과 시 부동산 기준 추첨",
    national: "국민주택",
    publicHousingAct: "공공주택특별법 공공분양",
    smallAmountWon: "소형 감면액",
    privatePeriodYears: "가점 인정 기간(년)",
    publicCount: "공공 납입 인정 횟수",
    firstHomePublicLand: "생애최초(공공택지)",
    firstHomePrivateLand: "생애최초(민간택지)"
  };
  const num = (k, x) => /Won$|^(priceMax|limit)$/.test(k) ? won(x) : /Man$|^(incomeMax|incomeMaxSingle|perPersonMax|anyPersonMax)$/.test(k) ? manWon(x) : /M2$/.test(k) ? `${x}㎡` : /^\d+$/.test(k) ? won(x) : (/Pct|Share/.test(path + k) || /tiers/.test(path)) && x >= 1 ? `${x}%` : x > 0 && x < 1 ? `${+(x * 100).toFixed(3)}%` : x.toLocaleString("ko-KR");
  const val = (k, x) => x == null ? "없음" : typeof x === "boolean" ? x ? "가능" : "불가" : typeof x === "number" ? num(k, x) : typeof x === "object" ? fmt(x) : String(x);
  const pairs = (o, skip = []) => Object.entries(o).filter(([k]) => !skip.includes(k)).map(([k, x]) => (x && typeof x === "object" ? `${L[k] || k} (${val(k, x)})` : `${/^\d+$/.test(k) ? k + "인 " : k === "name" ? "" : (L[k] || k) + " "}${val(k, x)}`).trim());
  const fmt = (o) => {
    if (!Array.isArray(o)) return pairs(o).join(" · ");
    return o.map((el) => {
      if (!el || typeof el !== "object") return val("", el);
      if (!("upToWon" in el) && !("upTo" in el)) return pairs(el).join(", ");
      const up = el.upToWon ?? el.upTo, subj = /hardCaps|broker/.test(path) ? "가격 " : /brackets/.test(path) ? "과세표준 " : "";
      return `${up == null ? "그 이상" : `${subj}${won(up)} ${/broker/.test(path) ? "미만" : "이하"}`} → ${pairs(el, ["upToWon", "upTo"]).join(", ")}`;
    }).join(" · ");
  };
  if (v == null || typeof v !== "object") return val("", v);
  const s = fmt(v);
  return s.length > 400 ? s.slice(0, 400) + "…" : s;
}
const policyLabel = (path) => ((window.POLICY_DEFAULT || {}).labels || {})[path] || path;
async function fetchPolicyProposals() {
  try {
    const r = await authFetch("/api/policy-proposals");
    if (r.ok) return await r.json();
  } catch {
  }
  return null;
}
function policyAttention(doc, overrides, dismissed) {
  const secs = (window.POLICY_DEFAULT || {}).sections || {};
  const checked = doc && doc.checked || {};
  const pending = (doc && doc.items || []).filter((it) => !dismissed[it.id] && JSON.stringify((overrides[it.path] || {}).value) !== JSON.stringify(it.proposed)).length;
  const overdue = Object.entries(secs).filter(([k, sec]) => policyOverdue(sec, checked[k] && checked[k].at)).length;
  return { pending, overdue };
}
function PolicyDataPanel({ doc, busy, err, onReview }) {
  const [overrides] = usePersist(POLICY_OVERRIDES_KEY, {});
  const [dismissed, setDismissed] = usePersist(POLICY_DISMISSED_KEY, {});
  const secs = (window.POLICY_DEFAULT || {}).sections || {};
  const checked = doc && doc.checked || {};
  const items = (doc && doc.items || []).filter((it) => !dismissed[it.id] && JSON.stringify((overrides[it.path] || {}).value) !== JSON.stringify(it.proposed));
  const who = () => {
    try {
      const u = firebase.auth().currentUser;
      return u && u.email || "";
    } catch {
      return "";
    }
  };
  const apply = (it) => setKey(POLICY_OVERRIDES_KEY, { ...store.get(POLICY_OVERRIDES_KEY, {}), [it.path]: { value: it.proposed, at: Date.now(), by: who(), source: it.source, reason: it.reason } });
  const revert = (path) => {
    const o = { ...store.get(POLICY_OVERRIDES_KEY, {}) };
    delete o[path];
    setKey(POLICY_OVERRIDES_KEY, o);
  };
  const running = Object.keys(busy).length;
  const ovEntries = Object.entries(overrides);
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] leading-relaxed mb-3" }, "대출 규제·세율·요율·소득 기준처럼 해마다 바뀌는 숫자예요. 매주 월요일 서버가 공식 자료와 자동 대조하고, 바뀐 것 같은 값은 아래 후보로 올라와요. ", /* @__PURE__ */ React.createElement("b", null, "[반영]을 눌러야 적용"), "되고 두 기기에 함께 반영돼요."), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => onReview(Object.keys(secs)), disabled: running > 0, className: "h-9 px-4 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40" }, running > 0 ? `점검 중… ${Object.keys(secs).length - running}/${Object.keys(secs).length}` : "전체 점검"), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B]" }, "모든 항목을 서버에서 동시에 점검해요(2~5분). 창을 닫아도, 앱을 꺼도 서버에서 계속 진행돼요.")), err && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[12px] text-[#8A5A00] bg-[#FFF7E6] rounded-lg px-3 py-2 whitespace-pre-line" }, err), items.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mb-4 space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, "변경 후보 ", items.length, "건"), items.map((it) => /* @__PURE__ */ React.createElement("div", { key: it.id, className: "rounded-xl border border-[#E5E5E5] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, policyLabel(it.path), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-normal text-[#6B6B6B]" }, "· ", (secs[it.section] || {}).label)), /* @__PURE__ */ React.createElement("div", { className: "text-[12.5px] mt-1 break-words", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "지금 값"), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B] line-through" }, fmtPolicyValue(it.path, it.current)), " → ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "바뀐 값"), " ", /* @__PURE__ */ React.createElement("b", null, fmtPolicyValue(it.path, it.proposed))), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] mt-1 leading-relaxed" }, it.reason, it.sourceDate ? ` (${it.sourceDate})` : "", " ", it.confidence !== "high" && /* @__PURE__ */ React.createElement("span", { className: "text-[#8A5A00]" }, "· 확인 권장")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-2" }, /* @__PURE__ */ React.createElement("a", { href: safeUrl(it.source), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold underline underline-offset-4 mr-auto" }, "근거 보기"), /* @__PURE__ */ React.createElement("button", { onClick: () => setDismissed({ ...dismissed, [it.id]: Date.now() }), className: "h-8 px-3 rounded-full bg-[#F0F0F0] text-[12px] font-semibold text-[#525252]" }, "무시"), /* @__PURE__ */ React.createElement("button", { onClick: () => apply(it), className: "h-8 px-3 rounded-full bg-[#0A0A0A] text-white text-[12px] font-semibold" }, "반영"))))), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#F0F0F0] border-y border-[#F0F0F0] mb-4" }, Object.entries(secs).map(([k, sec]) => {
    const c = checked[k];
    const over = policyOverdue(sec, c && c.at);
    return /* @__PURE__ */ React.createElement("div", { key: k, className: "py-2.5 flex items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold flex items-center gap-1.5" }, sec.label, over && /* @__PURE__ */ React.createElement("span", { className: "text-[10.5px] font-bold text-[#8A5A00] bg-[#FFF7E6] rounded-full px-1.5 py-0.5" }, "확인 필요")), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "기본값 기준일 ", sec.asOf, " · 다음 확인일 ", sec.nextReview, c ? ` · 마지막 점검 ${String(c.at).slice(0, 10)}(변경 후보 ${c.found}건)` : " · 아직 점검 안 함"), c && c.notes && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-0.5 line-clamp-2" }, c.notes)), /* @__PURE__ */ React.createElement("button", { onClick: () => onReview([k]), disabled: !!busy[k], className: "h-8 px-3 rounded-full bg-[#F0F0F0] text-[12px] font-semibold text-[#525252] disabled:opacity-40 shrink-0" }, busy[k] ? "점검 중…" : "지금 점검"));
  })), ovEntries.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold mb-1.5" }, "반영한 값 ", ovEntries.length, "개"), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, ovEntries.map(([path, o]) => /* @__PURE__ */ React.createElement("div", { key: path, className: "flex items-center gap-2 text-[12px]" }, /* @__PURE__ */ React.createElement("span", { className: "min-w-0 flex-1 truncate" }, /* @__PURE__ */ React.createElement("b", null, policyLabel(path)), " = ", fmtPolicyValue(path, o.value), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "· ", o.at ? todayYmd(new Date(o.at)) : "")), /* @__PURE__ */ React.createElement("button", { onClick: () => revert(path), className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4 shrink-0" }, "기본값으로 되돌리기"))))));
}
function SettingsModal({ open, onClose, hh, setHh, policyDoc, policyBusy, policyErr, onPolicyReview }) {
  if (!open) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-5" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-black/40 backdrop-blur-sm", onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: "relative bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-5" }, /* @__PURE__ */ React.createElement("h3", { className: "text-[19px] font-bold tracking-tight" }, "설정"), /* @__PURE__ */ React.createElement(IconBtn, { name: "plus", title: "닫기", onClick: onClose, className: "rotate-45" })), /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] mb-1" }, "호칭 설정"), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] leading-relaxed mb-3" }, '"본인/배우자" 대신 쓸 이름·애칭이에요. 진단·계좌 등 모든 화면에 반영됩니다.'), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "첫 번째"), /* @__PURE__ */ React.createElement(TextInput, { value: hh.label1 || "", onChange: (v) => setHh({ label1: v }), placeholder: "본인", className: "!h-11" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "두 번째"), /* @__PURE__ */ React.createElement(TextInput, { value: hh.label2 || "", onChange: (v) => setHh({ label2: v }), placeholder: "배우자", className: "!h-11" })))), /* @__PURE__ */ React.createElement("div", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] mb-1" }, "정책 데이터"), /* @__PURE__ */ React.createElement(PolicyDataPanel, { doc: policyDoc, busy: policyBusy, err: policyErr, onReview: onPolicyReview })), /* @__PURE__ */ React.createElement("button", { onClick: onClose, className: "w-full h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold text-[14px]" }, "완료")));
}
function computeDiagnosis(s) {
  const monthlySave = s.monthlySave ?? 250;
  const target = resolveTarget(s);
  const financing = estimateFinancing({ dealType: target.dealType, price: target.price, rent: target.rent, hh: s });
  const mortgage = financing.dsrLoan != null ? financing : estimateFinancing({ dealType: "매매", price: target.price, hh: s });
  const { maxLoan, binding: bindingConstraint, requiredCash, gap } = financing;
  const monthsToGoal = gap > 0 && monthlySave > 0 ? Math.ceil(gap / (monthlySave * 1e4)) : 0;
  const ledger = ledgerStats();
  const actualSave = ledger.avgNetMan;
  const monthsToGoalActual = gap > 0 && actualSave > 0 ? Math.ceil(gap / (actualSave * 1e4)) : gap > 0 ? null : 0;
  return {
    target,
    financing,
    dsrLoan: mortgage.dsrLoan,
    ltvLoan: mortgage.ltvLoan,
    tierCap: mortgage.tierCap,
    mortgageMaxLoan: mortgage.maxLoan,
    maxLoan,
    bindingConstraint,
    requiredCash,
    gap,
    monthsToGoal,
    yearsToGoal: (monthsToGoal / 12).toFixed(1),
    extra: financing.extra,
    equity: financing.equityWon,
    wedding: weddingMoney(),
    actualSave,
    monthsToGoalActual
  };
}
function JeonseLoanCalc({ hh, setHh, target, privacy }) {
  const [jc, setJc] = usePersist("realty-jeonse-calc-v1", { deposit: null, rate: 4, years: 2 });
  const depositMan = jc.deposit ?? (target.dealType === "전세" ? Math.round(target.price / 1e4) : 64e3);
  const depositWon = depositMan * 1e4;
  const f = estimateFinancing({ dealType: "전세", price: depositWon, hh: { ...hh, loanRateCalc: jc.rate } });
  const P = policy().loan.jeonse;
  const ratioLoan = depositWon * P.ratio;
  const years = Math.max(0, Number(jc.years) || 0);
  const monthlyInterest = f.maxLoan * (jc.rate / 100) / 12;
  const eligible = f.programs.filter((p) => p.eligible);
  const policyBest = eligible.reduce((m, p) => Math.max(m, Math.min(p.limit, ratioLoan)), 0);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "계산 결과", title: "전세대출 한도", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "전세 보증금(만원)", value: depositMan, onChange: (v) => setJc({ ...jc, deposit: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "전세대출 금리(%)", value: jc.rate, onChange: (v) => setJc({ ...jc, rate: v }), step: 0.1 })), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement(FilterRow, { label: `① 보증금의 ${Math.round(P.ratio * 100)}%`, value: won(ratioLoan), active: f.binding === `보증금 ${Math.round(P.ratio * 100)}%` }), " ", /* @__PURE__ */ React.createElement(FilterRow, { label: "② 보증기관 한도 (HUG·HF·SGI, 추정)", value: won(P.capWon), active: f.binding === "보증 한도" })), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#E5E5E5] space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "은행 전세대출 예상 한도"), /* @__PURE__ */ React.createElement("span", { className: "text-2xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, won(f.maxLoan))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[14px]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, "필요 자기자본 (보증금 − 대출)"), /* @__PURE__ */ React.createElement("b", { style: { fontVariantNumeric: "tabular-nums" } }, won(f.requiredCash))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[14px]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, "자기자본 대비 ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "(부대비용 ", won(f.extra.total), " 포함)")), /* @__PURE__ */ React.createElement("b", { style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, f.gap > 0 ? `${won(f.gap)} 부족` : "충족")))), jc.deposit != null && /* @__PURE__ */ React.createElement("button", { onClick: () => setJc({ ...jc, deposit: null }), className: "mt-3 text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "보증금을 진단 목표 기준으로 되돌리기"))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "우리 부부 기준", title: "정책 전세대출 (버팀목) 판정", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#E5E5E5]" }, f.programs.map((p) => /* @__PURE__ */ React.createElement("div", { key: p.name, className: "px-5 py-3.5 flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: `text-[15px] font-semibold ${p.eligible ? "" : "text-[#6B6B6B]"}` }, p.eligible ? "✓" : "✕", " ", p.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, p.reason)), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "한도"), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, wonShort(p.limit)))))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5] text-[13px] text-[#525252] leading-relaxed" }, eligible.length ? /* @__PURE__ */ React.createElement(React.Fragment, null, "조건이 맞으면 정책대출로 최대 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, won(policyBest)), "(보증금 ", Math.round(P.ratio * 100), "% 이내)까지 — 금리가 은행 전세대출보다 낮아 먼저 확인할 가치가 있어요.") : "지금 부부합산 소득·보증금 기준으로는 정책 전세대출 대상이 아니에요 — 은행 전세대출 기준으로 보세요."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "직접 계산", title: "전세대출 이자 (만기일시상환)", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "계약기간(년)", value: jc.years, onChange: (v) => setJc({ ...jc, years: v }) }), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col justify-end" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] leading-relaxed" }, "대출금 ", won(f.maxLoan), " · ", jc.rate, "% 기준, 원금은 만기(이사 나갈 때) 보증금으로 상환"))), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#E5E5E5]" }, /* @__PURE__ */ React.createElement(Stat, { label: "매달 이자", value: won(Math.round(monthlyInterest)) }), /* @__PURE__ */ React.createElement(Stat, { label: `계약기간 총 이자 (${years}년)`, value: won(Math.round(monthlyInterest * 12 * years)), tone: "warn" }), /* @__PURE__ */ React.createElement(Stat, { label: "월 주거비 환산 (이자만)", value: won(Math.round(monthlyInterest)), sub: "월세와 비교할 때 이 금액 + 자기자본의 기회비용(예: 예금이자)을 같이 보세요" })))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "현행 규칙", title: "전세대출 체크포인트", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, P.rules.map((r) => /* @__PURE__ */ React.createElement("li", { key: r, className: "flex gap-2 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, r)))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, policy().loan.asOf, " — 실제 한도는 보증기관 심사(소득·주택가격·전세가율)와 은행에 따라 달라요. 계약 전에 은행·보증기관 사전심사로 확인하세요.")))));
}
function CustomTargetCard({ hh, setHh, active = true }) {
  const c = customTargetOf(hh);
  const priceMan = Math.round((Number(c.price) || 0) / 1e4);
  const rentMan = Math.round((Number(c.rent) || 0) / 1e4);
  const patch = (p) => setHh({ targetKey: "custom", customTarget: { ...c, ...p } });
  const isRent = c.dealType === "월세";
  return /* @__PURE__ */ React.createElement("div", { className: `rounded-2xl border p-4 transition-colors ${active ? "border-[#0A0A0A] bg-[#0A0A0A]/5" : "border-dashed border-[#D4D4D4] bg-white"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-semibold flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Icon, { name: "target", size: 15 }), " 우리 목표"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, '유형과 가격을 직접 적어요 — 상담사가 조회한 실거래 카드의 "목표로"로도 채워져요')), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, c.price > 0 ? wonShort(c.price) : "—"), isRent && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252]" }, "월 ", rentMan > 0 ? manWon(rentMan) : "—"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-3" }, TARGET_DEAL_TYPES.map((d) => /* @__PURE__ */ React.createElement("button", { key: d, onClick: () => patch({ dealType: d }), className: `h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${c.dealType === d && active ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#525252]"}` }, d))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, isRent ? "보증금(만원)" : c.dealType === "전세" ? "전세 보증금(만원)" : c.dealType === "청약" ? "분양가(만원)" : "매매가(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: priceMan || "", onChange: (v) => patch({ price: Math.max(0, Math.round(v)) * 1e4 }), className: "!h-11 !text-[15px]" }), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-1" }, c.price > 0 ? `= ${won(c.price)}` : "예: 88000 → 8억 8,000만")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "전용면적(㎡, 선택)"), /* @__PURE__ */ React.createElement(NumInput, { value: c.area || "", onChange: (v) => patch({ area: Math.max(0, Math.round(v)) }), className: "!h-11 !text-[15px]" }))), isRent && /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "월세(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: rentMan || "", onChange: (v) => patch({ rent: Math.max(0, Math.round(v)) * 1e4 }), className: "!h-11 !text-[15px]", ariaLabel: "월세(만원)" }), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-1" }, "월세는 대출이 아니라 매달 나가는 돈이라 진단의 월 부담에 더해지고, 월 저축 여력에서 빼서 봐야 해요.")), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "단지·지역 (선택)"), /* @__PURE__ */ React.createElement(TextInput, { value: c.name || "", onChange: (v) => patch({ name: v.slice(0, 40) }), placeholder: "예: 래미안슈르, 과천 원문동" })));
}
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function MapPanel({ mapKey, points, height = 340, focus, onMapClick }) {
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState("idle");
  useEffect(() => {
    if (mapKey == null) {
      setStatus("wait");
      return;
    }
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
        naver.maps.Event.addListener(mapRef.current, "click", (e) => {
          if (clickRef.current && e && e.coord) clickRef.current({ lat: e.coord.lat(), lng: e.coord.lng() });
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
  const makeInfo = (title, desc) => new naver.maps.InfoWindow({
    content: `<div style="width:max-content;max-width:240px;padding:8px 12px;font-size:13px;line-height:1.5;font-family:Pretendard,sans-serif;background:#fff;border:1px solid #E5E5E5;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.12);word-break:keep-all">
      <b>${escHtml(title || "")}</b><br/><span style="color:#8A8A8A">${escHtml(desc || "")}</span></div>`,
    borderWidth: 0,
    backgroundColor: "transparent",
    anchorSize: new naver.maps.Size(12, 10),
    anchorColor: "#fff"
  });
  useEffect(() => {
    if (status !== "ok" || !mapRef.current) return;
    markersRef.current.forEach((m) => m.marker.setMap(null));
    markersRef.current = [];
    if (tmpRef.current) {
      tmpRef.current.info.close();
      tmpRef.current.marker.setMap(null);
      tmpRef.current = null;
    }
    const valid = (points || []).filter((p) => p.lat && p.lng);
    const bounds = valid.length ? new naver.maps.LatLngBounds() : null;
    valid.forEach((p) => {
      const pos = new naver.maps.LatLng(p.lat, p.lng);
      const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: p.title });
      const info = makeInfo(p.title, p.desc);
      naver.maps.Event.addListener(marker, "click", () => info.open(mapRef.current, marker));
      markersRef.current.push({ marker, info, key: p.id != null ? String(p.id) : `${p.lat},${p.lng}` });
      if (bounds) bounds.extend(pos);
    });
    if (bounds && valid.length > 1) mapRef.current.fitBounds(bounds);
    else if (valid.length === 1) mapRef.current.setCenter(new naver.maps.LatLng(valid[0].lat, valid[0].lng));
  }, [points, status]);
  const tmpRef = useRef(null);
  useEffect(() => {
    if (status !== "ok" || !mapRef.current || !focus || !focus.lat || !focus.lng) return;
    const pos = new naver.maps.LatLng(focus.lat, focus.lng);
    mapRef.current.morph(pos, Math.max(mapRef.current.getZoom(), 15));
    if (tmpRef.current) {
      tmpRef.current.info.close();
      tmpRef.current.marker.setMap(null);
      tmpRef.current = null;
    }
    const fkey = focus.id != null ? String(focus.id) : `${focus.lat},${focus.lng}`;
    const hit = markersRef.current.find((m) => m.key === fkey);
    if (hit) {
      hit.info.open(mapRef.current, hit.marker);
      return;
    }
    const marker = new naver.maps.Marker({ position: pos, map: mapRef.current, title: focus.title || "" });
    const info = makeInfo(focus.title, focus.desc);
    info.open(mapRef.current, marker);
    tmpRef.current = { marker, info };
  }, [focus, status]);
  const fallbackTitle = { wait: "지도를 준비하는 중…", nokey: "지도를 불러오지 못했어요", error: "지도를 불러오지 못했어요" }[status];
  return /* @__PURE__ */ React.createElement("div", { className: "relative rounded-2xl overflow-hidden border border-[#E5E5E5]", style: { height } }, /* @__PURE__ */ React.createElement("div", { ref, className: "w-full h-full" }), fallbackTitle && /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-[#FAFAFA] p-6 text-center flex flex-col items-center justify-center gap-2 text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement(Icon, { name: "pin", size: 28 }), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-semibold text-[#525252]" }, fallbackTitle), status !== "wait" && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] leading-relaxed max-w-xs" }, "지도는 잠시 쓸 수 없어요 — 목록의 주소·링크로 위치를 확인해 주세요.")));
}
const CAL_KIND = { "접수시작": "solid", "접수마감": "outline", "당첨발표": "announce", "공고 게시": "tint" };
const CAL_KIND_CHIP = { solid: "bg-[#525252] text-white", outline: "bg-white border border-[#525252] text-[#525252]", announce: "bg-white border border-dashed border-[#525252] text-[#525252]", tint: "bg-[#E5E5E5] text-[#525252]" };
const CAL_SRC = {
  apt: { label: "청약(분양)", solid: "bg-[#0A0A0A] text-white", outline: "bg-white border border-[#0A0A0A] text-[#0A0A0A]", tint: "bg-[#0A0A0A]/10 text-[#0A0A0A]" },
  remndr: { label: "무순위·줍줍", solid: "bg-[#D97706] text-white", outline: "bg-white border border-[#D97706] text-[#D97706]", tint: "bg-[#D97706]/10 text-[#D97706]" },
  lh: { label: "LH", solid: "bg-[#059669] text-white", outline: "bg-white border border-[#059669] text-[#059669]", tint: "bg-[#059669]/10 text-[#059669]" },
  sh: { label: "SH·서울시", solid: "bg-[#2563EB] text-white", outline: "bg-white border border-[#2563EB] text-[#2563EB]", tint: "bg-[#2563EB]/10 text-[#2563EB]" },
  jeonse: { label: "장기전세·전세형", solid: "bg-[#0D9488] text-white", outline: "bg-white border border-[#0D9488] text-[#0D9488]", tint: "bg-[#0D9488]/10 text-[#0D9488]" }
};
const calEvCls = (e) => {
  const v = CAL_KIND[e.kind];
  return v === "announce" ? `${CAL_SRC[e.src].outline} border-dashed` : CAL_SRC[e.src][v];
};
function buildCalByDate(items, notices, srcSel, kindSel) {
  const events = [];
  (items || []).forEach((i) => {
    const src = i.kind === "무순위" ? "remndr" : "apt";
    if (!srcSel.includes(src)) return;
    if (i.applyStart) events.push({ date: i.applyStart, kind: "접수시작", i, src });
    if (i.applyEnd && i.applyEnd !== i.applyStart) events.push({ date: i.applyEnd, kind: "접수마감", i, src });
    if (i.announceDate) events.push({ date: i.announceDate, kind: "당첨발표", i, src });
  });
  (notices || []).forEach((n) => {
    const jeonse = /전세/.test(`${n.type || ""} ${n.name || ""}`);
    const src = jeonse ? "jeonse" : n.agency === "LH" ? "lh" : "sh";
    if (!srcSel.includes(src)) return;
    const p = normYmdStr(n.postedAt), s = normYmdStr(n.applyStart), c = normYmdStr(n.closeAt);
    if (s) events.push({ date: s, kind: "접수시작", i: n, src });
    if (p && p !== s) events.push({ date: p, kind: "공고 게시", i: n, src });
    if (c && c !== s) events.push({ date: c, kind: "접수마감", i: n, src });
  });
  const byDate = {};
  events.forEach((e) => {
    if (kindSel.includes(e.kind)) (byDate[e.date] = byDate[e.date] || []).push(e);
  });
  return byDate;
}
function CheongyakCalendar({ byDate, srcSel, kindSel, onSrc, onKind, selD, onSelD }) {
  const today = /* @__PURE__ */ new Date();
  const todayStr = todayYmd(today);
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const moveMonth = (d) => setCur(({ y, m }) => {
    const dt = new Date(y, m + d, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const firstDow = new Date(cur.y, cur.m, 1).getDay();
  const dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const monthPfx = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
  const monthCnt = Object.entries(byDate).reduce((n, [d, evs]) => n + (d.startsWith(monthPfx) ? evs.length : 0), 0);
  const [showEmpty, setShowEmpty] = useState(false);
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "한눈에 보는 일정 — 청약·무순위·LH·SH·장기전세", title: "통합 공고 캘린더" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(-1), "aria-label": "이전 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "rotate-180" })), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, cur.y, "년 ", cur.m + 1, "월 ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-semibold text-[#6B6B6B]" }, "일정 ", monthCnt, "건")), /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(1), "aria-label": "다음 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16 }))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-2" }, Object.entries(CAL_SRC).map(([v, s]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: v,
      onClick: () => onSrc(v),
      className: `h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${srcSel.includes(v) ? s.solid : "bg-[#F5F5F5] text-[#6B6B6B] hover:bg-[#ECECEC]"}`
    },
    srcSel.includes(v) ? "✓ " : "",
    s.label
  ))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-3" }, Object.keys(CAL_KIND).map((k) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: k,
      onClick: () => onKind(k),
      title: "눌러서 표시/숨김",
      className: `px-2 py-0.5 rounded-full text-[11px] font-semibold transition-opacity ${CAL_KIND_CHIP[CAL_KIND[k]]} ${kindSel.includes(k) ? "" : "opacity-30 line-through"}`
    },
    k
  ))), monthCnt === 0 && !showEmpty ? /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-4 py-5 text-center text-[13px] text-[#6B6B6B]" }, "이 달엔 표시할 일정이 없어요 — 다음 달로 넘기거나 ", /* @__PURE__ */ React.createElement("button", { onClick: () => setShowEmpty(true), className: "font-semibold underline underline-offset-4" }, "달력 보기")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 text-center text-[11px] font-semibold text-[#6B6B6B] mb-1.5" }, ["일", "월", "화", "수", "목", "금", "토"].map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d, className: i === 0 ? "text-[#C96A6A]" : "" }, d))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 gap-1" }, Array.from({ length: firstDow }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: "e" + i })), Array.from({ length: dim }).map((_, idx) => {
    const d = idx + 1, key = ymd(cur.y, cur.m, d), evs = byDate[key] || [], sel = selD === key;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: d,
        onClick: () => onSelD(sel ? null : key),
        className: `min-h-[64px] rounded-lg p-1 flex flex-col items-center gap-0.5 transition-colors ${sel ? "bg-[#0A0A0A]/5 ring-1 ring-[#0A0A0A]" : "hover:bg-[#F5F5F5]"} ${key === todayStr ? "bg-[#F0F0F0]" : ""}`
      },
      /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-semibold ${new Date(cur.y, cur.m, d).getDay() === 0 ? "text-[#C96A6A]" : ""}` }, d),
      /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-0.5 w-full" }, evs.slice(0, 3).map((e, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: `w-full truncate rounded px-0.5 text-[10px] font-bold leading-4 ${calEvCls(e)}` }, e.kind === "당첨발표" ? "🎉" : "", e.i.name.slice(0, 8))), evs.length > 3 && /* @__PURE__ */ React.createElement("span", { className: "text-[9px] font-bold text-[#6B6B6B]" }, "+", evs.length - 3))
    );
  }))), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[12px] text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("b", null, "날짜를 누르면 아래 목록이 그 날의 일정만 보여줘요"), " (같은 날짜를 다시 누르면 해제). 배지의 ", /* @__PURE__ */ React.createElement("b", null, "색은 출처"), "(검정 청약 · 주황 무순위 · 초록 LH · 파랑 SH · 청록 전세), 모양은 일정 종류 — ", /* @__PURE__ */ React.createElement("b", null, "칠해진 배지 접수시작 · 실선 테두리 접수마감 · 점선 테두리 🎉 당첨발표 · 연한색 공고 게시"), ". LH·SH·장기전세는 수도권 공고만 표시돼요.")));
}
function SubIncomeStrip({ onOpen }) {
  const raw = usePersist("eligibility-profile-v1", ELIG_DEFAULT)[0];
  usePersist("household-inputs-v2", {});
  const [reg] = usePersist("marriage-registered-v1", false);
  const p = resolveElig(raw), SS = policy().specialSupply, T = SS.tiers || {};
  const me = Number(p.me) || 0, sp = Number(p.spouse) || 0, sum = me + sp, dual = me > 0 && sp > 0;
  const lim = (pct) => Math.floor(SS.incomeBase100[3] * pct / 100);
  const NW = T.newlywed || { priority: { single: 100, dual: 120 }, general: SS.newlywedPct };
  const pr = NW.priority[dual ? "dual" : "single"], ge = NW.general[dual ? "dual" : "single"];
  const S1 = T.firstHomeSingle || { privatePct: 160, maxAreaM2: 60 };
  const soloN = [me, sp].filter((v) => soloFirstHomeOk(v, lim(S1.privatePct), S1, 0, SS.lotteryPropertyCapWon || 331e6)).length;
  const mw = (v) => `${Math.round(v / 1e4).toLocaleString()}만원`;
  const capEok = ((SS.lotteryPropertyCapWon || 331e6) / 1e8).toFixed(2).replace(/0$/, "");
  const r = subTier([me, sp], SS.incomeBase100[3], pr, ge, SS.dualEachMaxPct), why = subEachWhy(r, mw);
  const nw = r.tier === "우선공급" ? /* @__PURE__ */ React.createElement(React.Fragment, null, "신혼특공 우선공급 기준(", pr, "% = ", mw(lim(pr)), ") 이하라 ", /* @__PURE__ */ React.createElement("b", null, "우선공급 대상"), "이에요(소득 기준으로 먼저 뽑는 물량).") : r.tier === "일반공급" ? /* @__PURE__ */ React.createElement(React.Fragment, null, why || `우선공급 기준(${pr}% = ${mw(lim(pr))})보다 ${mw(sum - lim(pr))} 많지만, `, why ? " " : "", "일반공급 기준(", ge, "% = ", mw(lim(ge)), ") 이하라 ", /* @__PURE__ */ React.createElement("b", null, "일반공급 대상"), "이에요.") : /* @__PURE__ */ React.createElement(React.Fragment, null, why || `신혼특공 소득 기준(${ge}% = ${mw(lim(ge))})보다 ${mw(sum - lim(ge))} 많아요.`, " ", /* @__PURE__ */ React.createElement("b", null, "소득을 보지 않고 뽑는 추첨 물량(민영 신혼·생애최초 특공 물량의 30% — 우선공급 50%·일반공급 20%를 뺀 나머지)에만"), " 신청할 수 있고, 세대 부동산 가액 합계가 ", capEok, "억 이하여야 해요.");
  return /* @__PURE__ */ React.createElement(Card, { className: "mb-4 !py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, "우리 소득 구간"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#3D3D3D] leading-relaxed", style: { fontVariantNumeric: "tabular-nums" } }, "부부 월소득 합산 ", mw(sum), "(세전). ", nw, !reg && /* @__PURE__ */ React.createElement(React.Fragment, null, " 혼인신고 전이면 각자 1인 가구로 생애최초 특공 추첨에 ", /* @__PURE__ */ React.createElement("b", null, soloN, "명"), "이 신청할 수 있어요(전용 ", S1.maxAreaM2, "㎡ 이하, 소득 기준을 넘어도 세대 부동산가액 ", capEok, "억 이하면 가능).")), /* @__PURE__ */ React.createElement("button", { onClick: onOpen, className: "ml-auto text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "청약통장·루트 자세히"));
}
function SubRouteCard() {
  const raw = usePersist("eligibility-profile-v1", ELIG_DEFAULT)[0];
  usePersist("household-inputs-v2", {});
  const [reg, setReg] = usePersist("marriage-registered-v1", false);
  const p = resolveElig(raw);
  const SS = policy().specialSupply, T = SS.tiers || {};
  const me = Number(p.me) || 0, sp = Number(p.spouse) || 0, sum = me + sp, dual = me > 0 && sp > 0;
  const base = SS.incomeBase100[3];
  const lim = (pct) => Math.floor(base * pct / 100);
  const tierOf2 = (v, pr, ge) => v <= lim(pr) ? ["우선공급", pr] : v <= lim(ge) ? ["일반공급", ge] : ["추첨", ge];
  const NW = T.newlywed || { priority: { single: 100, dual: 120 }, general: SS.newlywedPct };
  const nwR = subTier([me, sp], base, NW.priority[dual ? "dual" : "single"], NW.general[dual ? "dual" : "single"], SS.dualEachMaxPct);
  const nw = [nwR.tier, nwR.pct];
  const fh = T.firstHome ? tierOf2(sum, T.firstHome.priority, T.firstHome.general) : null;
  const S1 = T.firstHomeSingle || { privatePct: 160, nationalPct: 130, maxAreaM2: 60 };
  const capEok = ((SS.lotteryPropertyCapWon || 331e6) / 1e8).toFixed(2).replace(/0$/, "");
  const baby = (Number(p.kids) || 0) > 0 || p.fetus > 0 || p.pregnant;
  const mw = (v) => `${Math.round(v / 1e4).toLocaleString()}만원`;
  const soloOk = [me, sp].map((v) => soloFirstHomeOk(v, lim(S1.privatePct), S1, 0, SS.lotteryPropertyCapWon || 331e6));
  const tierText = ([t, pct], v, why = "") => t === "추첨" ? `${why || `기준(${pct}% = ${mw(lim(pct))})보다 ${mw(v - lim(pct))} 많아요.`} 추첨 물량에만 신청할 수 있고 세대 부동산 가액 합계가 ${capEok}억 이하여야 해요.` : `${why ? why + " " : ""}기준(${pct}% = ${mw(lim(pct))}) 이하라 ${t} 대상이에요.`;
  const soloWhy = `본인 소득이 기준(${S1.privatePct}% = ${mw(lim(S1.privatePct))}) 이하이거나, 넘더라도 세대 부동산가액이 ${capEok}억 원 이하면 추첨 물량에 넣을 수 있어요. 전용 ${S1.maxAreaM2}㎡ 이하만 되고, 소득세를 5년 이상 냈어야 해요.`;
  const badgeOf = (t) => ({ 추첨: "추첨 물량만", 우선공급: "우선공급 대상", 일반공급: "일반공급 대상" })[t] || t;
  const tone = (t) => t === "추첨" ? "warn" : "good";
  const mode = reg ? "joint" : p.householdMode || "separate";
  const headIdx = mode === "head1" ? 0 : mode === "head2" ? 1 : -1;
  const head = headIdx >= 0 ? p.names[headIdx] : "", cohab = headIdx >= 0 ? p.names[1 - headIdx] : "";
  const headInc = headIdx === 0 ? me : sp;
  const before = headIdx >= 0 ? [
    {
      name: `생애최초 특공 · ${head}(세대주) 1인 가구`,
      tone: soloOk[headIdx] ? "good" : "warn",
      badge: soloOk[headIdx] ? "가능" : "소득 초과",
      why: `${head} 월소득 ${mw(headInc)}만 봐요. ${soloWhy}`
    },
    { name: `일반공급 1순위 · ${head}만`, tone: "good", badge: "지금 바로", why: `투기과열지구에서는 세대주만 1순위가 돼요. ${eunNeun(cohab)} 등본상 동거인(세대주와 가족 관계가 아닌 함께 사는 사람)이라 1순위가 안 돼요. 세대를 분리해 세대주가 되면 둘 다 1순위가 돼요.` }
  ] : [
    {
      name: `생애최초 특공 · 각자 1인 세대`,
      tone: soloOk.every(Boolean) ? "good" : "warn",
      badge: soloOk.filter(Boolean).length === 2 ? "둘 다 가능" : soloOk.some(Boolean) ? "한 명 가능" : "소득 초과",
      why: `${p.names[0]} 월 ${mw(me)} · ${p.names[1]} 월 ${mw(sp)}. 각자 본인 소득만 봐요. ${soloWhy} 둘 다 세대주라 각자 1순위예요.`
    },
    { name: "일반공급 1순위 · 부부 각자", tone: "good", badge: "지금 바로", why: "소득 기준이 없어요. 투기과열지구의 59㎡ 이하는 60%를 추첨으로 뽑고, 부부가 같은 단지에 각자 청약해도 돼요. 둘 다 당첨되면 먼저 신청한 1건만 유효해요." },
    (SS.preMarriedNewlywed || {}).publicHousingAct !== false && { name: "공공 신혼특공 · 예비신혼부부", tone: "mid", badge: "공공분양만", why: "뉴:홈·신혼희망타운 같은 공공분양(공공주택특별법)만 돼요. 국민주택 신혼특공은 혼인 7년 이내만 돼요. 입주 전까지 혼인을 증명해야 하고, 부부 합산 소득 기준은 공고마다 확인해요." }
  ].filter(Boolean);
  const after = [
    { name: "신혼부부 특공 (민영)", tone: tone(nw[0]), badge: badgeOf(nw[0]), why: `부부 월소득 합산 ${mw(sum)}. ${tierText(nw, sum, subEachWhy(nwR, mw))} 혼인신고일로부터 7년 안에 신청할 수 있어요.` },
    fh && { name: "생애최초 특공 (민영, 부부)", tone: tone(fh[0]), badge: badgeOf(fh[0]), why: `부부 월소득 합산 ${mw(sum)}. ${tierText(fh, sum)} 부부는 1인 가구의 60㎡ 제한이 없어요. 다만 민영 특공은 전용 85㎡ 이하 주택만 대상이에요.` },
    { name: "신생아 특공", tone: baby ? "good" : "mid", badge: baby ? "가능" : "출산 후", why: "모집공고일 기준 만 2세 미만 자녀(태아·입양 포함)가 있으면 혼인 여부와 상관없이 돼요(1순위·무주택 필요). 민영은 소득 130% 이하 우선 50%, 160% 이하 20%, 나머지 30%는 추첨(부동산 3.31억 원 이하)이에요." }
  ].filter(Boolean);
  const afterWeak = nw[0] === "추첨" && (!fh || fh[0] === "추첨");
  const nearEdge = !afterWeak && sum > lim(NW.general[dual ? "dual" : "single"]) * 0.95;
  const edge = afterWeak ? ` 혼인신고를 하면 부부 월소득 합산이 ${mw(sum)}이 되어 특공 소득 기준을 넘어요. 혼인신고를 미루는 쪽이 유리해요.` : nearEdge ? ` 혼인신고 후 부부 월소득 합산 ${mw(sum)}은 기준 바로 아래예요. 비과세를 반영해 다시 확인해요.` : "";
  const chances = 2 + soloOk.filter(Boolean).length;
  const tip = mode === "joint" ? afterWeak ? "부부 합산 소득이 특공 소득 기준을 넘어요. 신혼·생애최초 특공은 추첨 물량에 넣고, 일반공급 추첨도 같이 넣어요." : `신혼특공(${badgeOf(nw[0])})을 먼저 노려요. 혼인신고일로부터 7년 안에 신청해야 해요. ${SPECIAL_ONCE_TEXT}` : headIdx >= 0 ? `${eunNeun(cohab)} 동거인이라 1순위가 안 돼요. 지금은 ${head}만 넣을 수 있고, 소득은 ${head} 혼자 월 ${mw(headInc)}만 봐요. 넣을 곳은 ${S1.maxAreaM2}㎡ 이하 생애최초 특공(1인 가구 추첨)${soloOk[headIdx] ? "" : "(소득 초과라 어려워요)"}과 일반공급 1순위예요. 둘 다 넣으려면 ${cohab}도 세대를 분리해 세대주가 되거나, 혼인신고 후 부부로 넣어요.${edge}` : `둘 다 세대주라 각자 1순위예요. 59㎡ 이하 민영은 두 사람이 각자 생애최초 특공(1인 가구 추첨)과 일반공급 1순위에 넣을 수 있어, 한 단지에 기회가 ${chances}번이에요. 84㎡처럼 60㎡를 넘는 집은 1인 가구 생애최초가 안 되니 일반공급 추첨 위주로 넣거나, 혼인신고 후 신혼·생애최초(부부)로 넣어요. 혼인신고 전에 각자 생애최초로 당첨돼도 혼인 후 신혼특공은 한 번 더 넣을 수 있어요.${edge}`;
  const caution = mode === "separate" ? "부부가 같은 단지에 둘 다 당첨되면 먼저 신청한 1건만 유효해요. 공고문의 중복 청약 규정도 확인해요." : "";
  const toneCls = { good: "bg-[#E7F4EE] text-[#1F5D46]", warn: "bg-[#FFF4D6] text-[#8A5A00]", mid: "bg-[#F0F0F0] text-[#525252]" };
  const Rows = ({ list }) => /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F0F0F0]" }, list.map((r) => /* @__PURE__ */ React.createElement("li", { key: r.name, className: "py-2 flex items-start gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: `shrink-0 mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${toneCls[r.tone]}` }, r.badge), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, r.name), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] leading-relaxed" }, r.why)))));
  return /* @__PURE__ */ React.createElement(Card, { className: "mb-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, "🧭 우리에게 유리한 청약 루트 ", /* @__PURE__ */ React.createElement("span", { className: "ml-1 text-[12px] font-semibold text-[#6B6B6B]" }, "· ", reg ? "혼인신고 완료" : householdModeLabel(mode, p.names))), /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-1.5 text-[12px] font-semibold text-[#525252] cursor-pointer" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!reg, onChange: (e) => setReg(e.target.checked), className: "w-4 h-4 accent-[#0A0A0A]" }), "혼인신고 했음")), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[13px] text-[#0A0A0A] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "추천"), " · ", tip), caution && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[12px] text-[#8A5A00]" }, "⚠️ ", caution), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid md:grid-cols-2 gap-x-5 gap-y-3" }, mode !== "joint" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold text-[#6B6B6B]" }, "혼인신고 전 (미루는 경우)"), /* @__PURE__ */ React.createElement(Rows, { list: before })), /* @__PURE__ */ React.createElement("div", { className: mode === "joint" ? "md:col-span-2" : "" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold text-[#6B6B6B]" }, "혼인신고 후"), /* @__PURE__ */ React.createElement(Rows, { list: after }))), /* @__PURE__ */ React.createElement("div", { className: "mt-2 space-y-1.5 text-[11px] text-[#8A8A8A] leading-relaxed" }, /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("b", null, "소득 기준"), " · 소득은 월평균·세전으로 비교해요(", p.auto ? "홈 연소득 ÷ 12 − 비과세" : "자격 진단에 직접 입력한 값", "). 기준 금액은 ", SS.incomeBaseYear, " 도시근로자 3인 이하 가구 월평균소득 ", mw(base), "에 %를 곱한 값이에요."), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("b", null, "용어"), " · 우선공급: 특공 물량 중 소득이 더 낮은 가구에 먼저 배정하는 몫. 일반공급(특공 안): 우선공급 다음 소득 구간 몫. 추첨 물량: 특공 물량 중 소득을 안 보고 추첨하는 몫(부동산 가액 기준만 봐요). 1순위: 통장 가입기간·납입 요건을 채운 신청자 순위로, 투기과열지구에서는 세대주만 돼요. ", SPECIAL_ONCE_TEXT, " 최종 판단은 공고문으로 해요."), /* @__PURE__ */ React.createElement("p", null, /* @__PURE__ */ React.createElement("b", null, "동거인"), " · 혼인신고 전 연인은 등본에 동거인으로 올라도 세대원(배우자·부모·자녀처럼 가족 관계로 묶인 사람)이 아니에요. 그래서 소득·가구원 수에서 빠지고, 신청자는 1인 가구(전용 60㎡ 이하)로 봐요. 대신 동거인은 세대주가 아니라 투기과열지구 1순위가 안 돼요. 둘 다 넣으려면 각자 세대주가 돼야 해요.")));
}
const SUB_KEY = "sub-analysis-v1";
const SUB_RUN_EVT = "sub-analysis-run";
const subRuns = {};
function setSubRun(id, v) {
  if (v) subRuns[id] = v;
  else delete subRuns[id];
  try {
    window.dispatchEvent(new CustomEvent(SUB_RUN_EVT, { detail: id }));
  } catch {
  }
}
function applyhomeIds(url) {
  try {
    const u = new URL(url);
    const h = u.searchParams.get("houseManageNo"), n = u.searchParams.get("pblancNo");
    if (!/(^|\.)applyhome\.co\.kr$/.test(u.hostname) || !/^\d+$/.test(h || "") || !/^\d+$/.test(n || "")) return null;
    return { houseManageNo: h, pblancNo: n, detailPath: u.pathname };
  } catch {
    return null;
  }
}
function buildSubContext() {
  const p = resolveElig(), SS = policy().specialSupply;
  const hh = { ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) };
  const reg = !!store.get("marriage-registered-v1", false);
  const wedding = (store.get("wedding-info-v1", {}) || {}).date || "";
  const subs = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT).filter((a) => a.type === "청약통장").map((a) => ({ 명의: a.owner, 가입연월: a.since || "미입력", 납입횟수: Number(a.count) || 0, 잔액만원: Number(a.balance) || 0 }));
  return JSON.stringify({
    두사람: p.names.map((n, i) => {
      const r = (p.residence || [])[i] || {};
      return { 이름: n, 세전월평균소득원: i ? p.spouse : p.me, 거주시군: r.city || "미입력", 그지역전입연월: r.since || "미입력", 주택: "무주택(부동산가액 0원)" };
    }),
    소득산정방식: p.auto ? "홈 연소득 ÷ 12 − 월 비과세(세전 추정)" : "직접 입력(원천징수 총급여·건보 보수월액)",
    자녀수: Number(p.kids) || 0,
    태아수: p.fetus,
    총자산만원: Number(p.asset) || 0,
    차량가액만원: Number(p.car) || 0,
    무주택: hh.firstTime ? "두 사람 모두 무주택 · 주택 소유 이력 없음(생애최초)" : "두 사람 모두 무주택",
    혼인신고: reg ? "완료" : "안 함(예비신혼부부)",
    결혼식날짜: wedding || "미정",
    세대구성: reg ? "혼인 후 한 세대" : householdModeLabel(p.householdMode, p.names),
    청약통장: subs.length ? subs : "미등록",
    정책참고값_공고문이우선: { 기준표연도: SS.incomeBaseYear, 도시근로자월평균소득100퍼센트_가구원수별_원: SS.incomeBase100, 특공소득구간_퍼센트: subTiersKo(SS.tiers || {}), 특공추첨부동산가액상한원: SS.lotteryPropertyCapWon }
  });
}
function subTiersKo(T) {
  const nw = T.newlywed || {}, fh = T.firstHome || {}, fp = T.firstHomePublic || {}, s1 = T.firstHomeSingle || {};
  return {
    민영신혼특공: { 우선공급_외벌이: (nw.priority || {}).single, 우선공급_맞벌이: (nw.priority || {}).dual, 일반공급_외벌이: (nw.general || {}).single, 일반공급_맞벌이: (nw.general || {}).dual },
    민영생애최초: { 우선공급: fh.priority, 일반공급: fh.general },
    공공생애최초: { 우선공급: fp.priority, 일반공급: fp.general },
    생애최초1인가구: { 민영: s1.privatePct, 국민주택: s1.nationalPct, 전용면적상한_제곱미터: s1.maxAreaM2 },
    민영신생아특공: { 우선공급: (T.newborn || {}).priority, 일반공급: (T.newborn || {}).general },
    공공신생아특공: { 우선공급: (T.newbornPublic || {}).priority, 일반공급: (T.newbornPublic || {}).general },
    맞벌이_한사람소득상한: { 우선공급: (policy().specialSupply.dualEachMaxPct || {}).priority, 일반공급: (policy().specialSupply.dualEachMaxPct || {}).general }
  };
}
async function runSubAnalysis(item, pdf) {
  const id = item.id, ids = applyhomeIds(item.url);
  if (!pdf && !ids) return setSubRun(id, { needPdf: true, err: "청약홈 공고 번호가 없는 공고예요." });
  setSubRun(id, { msg: pdf ? "올린 공고문 올리는 중…" : "청약홈에서 공고문 찾는 중…" });
  try {
    const body = { ...ids || {}, ...pdf ? { pdf } : {}, context: buildSubContext() };
    const r = await withTimeout(authFetch("/api/sub-analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), 9e4, "분석 요청이 지연돼요 — 다시 시도해 주세요.");
    const j = await r.json().catch(() => ({}));
    if (j.error === "no_pdf") return setSubRun(id, { needPdf: true, err: j.message });
    if (!r.ok || !j.jobId) throw new Error(j.message || `분석 요청 실패 (${r.status})`);
    setSubRun(id, { msg: "공고문 읽는 중… 1~2분" });
    const started = Date.now();
    while (Date.now() - started < 10 * 60 * 1e3) {
      await new Promise((res) => setTimeout(res, 4e3));
      const jr = await authFetch(`/api/sub-job?id=${encodeURIComponent(j.jobId)}`).catch(() => null);
      if (!jr || !jr.ok) continue;
      const job = await jr.json().catch(() => null);
      if (!job) continue;
      if (job.state === "done" && job.result) {
        const all = { ...store.get(SUB_KEY, {}) || {}, [id]: { ...job.result, source: job.source, name: item.name, at: (/* @__PURE__ */ new Date()).toISOString() } };
        setKey(SUB_KEY, Object.fromEntries(Object.entries(all).sort((a, b) => String(b[1].at).localeCompare(String(a[1].at))).slice(0, 30)));
        return setSubRun(id, null);
      }
      if (job.state === "failed") return setSubRun(id, { err: job.error || "분석에 실패했어요.", needPdf: !!job.noPdf });
    }
    setSubRun(id, { err: "10분 안에 끝나지 않았어요 — 잠시 후 다시 시도해 주세요." });
  } catch (e) {
    setSubRun(id, { err: String(e && e.message || e) });
  }
}
const VERDICT_CLS = { 가능: "bg-[#E7F4EE] text-[#1F5D46]", 조건부: "bg-[#FFF4D6] text-[#8A5A00]", 불가: "bg-[#F0F0F0] text-[#6B6B6B]" };
function SubRouteList({ list }) {
  return /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F0F0F0]" }, (list || []).map((r, k) => /* @__PURE__ */ React.createElement("li", { key: k, className: "py-2 flex items-start gap-2.5" }, /* @__PURE__ */ React.createElement("span", { className: `shrink-0 mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${VERDICT_CLS[r.verdict] || VERDICT_CLS.조건부}` }, r.verdict), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, r.route), r.why && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] leading-relaxed" }, r.why)))));
}
function SubAnalysisResult({ a }) {
  const H = ({ children }) => /* @__PURE__ */ React.createElement("div", { className: "mt-3 mb-1 text-[12px] font-bold text-[#6B6B6B]" }, children);
  const rec = a.recommendation || {};
  return /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#3D3D3D]" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, [a.complex, a.houseType, a.regulated, a.noticeDate && `공고 ${a.noticeDate}`].filter(Boolean).join(" · ")), (rec.summary || (rec.steps || []).length > 0) && /* @__PURE__ */ React.createElement("div", { className: "mt-2 rounded-xl bg-[#FAFAFA] px-3.5 py-3" }, rec.summary && /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold text-[#0A0A0A] leading-relaxed" }, rec.summary), (rec.steps || []).length > 0 && /* @__PURE__ */ React.createElement("ol", { className: "mt-1.5 list-decimal pl-5 space-y-0.5 leading-relaxed" }, rec.steps.map((s, k) => /* @__PURE__ */ React.createElement("li", { key: k }, s)))), (a.people || []).filter((x) => (x.routes || []).length).map((x) => /* @__PURE__ */ React.createElement("div", { key: x.name }, /* @__PURE__ */ React.createElement(H, null, x.name, " 혼자 (혼인신고 전)"), /* @__PURE__ */ React.createElement(SubRouteList, { list: x.routes }))), (a.couple || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "부부로 (혼인신고 후·예비신혼)"), /* @__PURE__ */ React.createElement(SubRouteList, { list: a.couple })), (a.specials || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "특별공급"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-1 leading-relaxed" }, a.specials.map((s, k) => /* @__PURE__ */ React.createElement("li", { key: k }, /* @__PURE__ */ React.createElement("b", null, s.kind), s.units != null ? ` ${s.units}세대` : "", s.income ? ` · ${s.income}` : "", s.note ? /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, " · ", s.note) : null)))), a.general && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "일반공급"), /* @__PURE__ */ React.createElement("div", { className: "leading-relaxed" }, a.general)), a.regionPriority && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "지역 우선공급"), /* @__PURE__ */ React.createElement("div", { className: "leading-relaxed" }, a.regionPriority)), (a.units || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "주택형"), /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-[12px]", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("th", { className: "py-1 pr-3 font-semibold" }, "주택형"), /* @__PURE__ */ React.createElement("th", { className: "py-1 pr-3 font-semibold" }, "전체"), /* @__PURE__ */ React.createElement("th", { className: "py-1 pr-3 font-semibold" }, "특공"), /* @__PURE__ */ React.createElement("th", { className: "py-1 pr-3 font-semibold" }, "일반"), /* @__PURE__ */ React.createElement("th", { className: "py-1 font-semibold" }, "분양가"))), /* @__PURE__ */ React.createElement("tbody", null, a.units.map((u, k) => /* @__PURE__ */ React.createElement("tr", { key: k, className: "border-t border-[#F5F5F5]" }, /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-3 font-semibold" }, u.type), /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-3" }, u.total ?? "-"), /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-3" }, u.special ?? "-"), /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-3" }, u.general ?? "-"), /* @__PURE__ */ React.createElement("td", { className: "py-1" }, u.priceWon ? wonShort(u.priceWon) : "-"))))))), (a.schedule || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "일정"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, a.schedule.map((s, k) => /* @__PURE__ */ React.createElement("span", { key: k, className: "text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold" }, s.step, " ", s.date)))), (a.cautions || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(H, null, "주의·확인할 서류"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-0.5 leading-relaxed" }, a.cautions.map((c, k) => /* @__PURE__ */ React.createElement("li", { key: k }, "⚠️ ", c)))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[11px] text-[#8A8A8A]" }, a.source === "upload" ? "올린 공고문" : "청약홈 공고문", " 기준 AI 분석 · ", String(a.at || "").slice(0, 10), " · 최종 판단은 공고문 원문으로"));
}
function SubAnalyzePanel({ item }) {
  const [all] = usePersist(SUB_KEY, {});
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if (e.detail === item.id) tick((x) => x + 1);
    };
    window.addEventListener(SUB_RUN_EVT, h);
    return () => window.removeEventListener(SUB_RUN_EVT, h);
  }, [item.id]);
  const run = subRuns[item.id], res = (all || {})[item.id], busy = !!(run && run.msg);
  const start = (pdf) => {
    setOpen(true);
    runSubAnalysis(item, pdf);
  };
  const onFile = (f) => {
    if (!f) return;
    if (f.size > 18 * 1024 * 1024) return setSubRun(item.id, { needPdf: true, err: "PDF가 너무 커요(18MB 이하) — 자격·공급 부분만 남겨 올려 주세요." });
    const rd = new FileReader();
    rd.onload = () => start(String(rd.result).replace(/^data:[^;,]*;base64,/, "data:application/pdf;base64,"));
    rd.readAsDataURL(f);
  };
  const btn = "h-9 px-3.5 rounded-full text-[13px] font-semibold";
  return /* @__PURE__ */ React.createElement("div", { className: "mt-3 pt-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, !res && /* @__PURE__ */ React.createElement("button", { disabled: busy, onClick: () => start(), className: `${btn} bg-[#0A0A0A] text-white disabled:opacity-50` }, "우리 조건으로 분석"), res && /* @__PURE__ */ React.createElement("button", { onClick: () => setOpen((o) => !o), className: `${btn} bg-[#0A0A0A] text-white` }, open ? "분석 접기" : "우리 조건 분석 보기"), res && /* @__PURE__ */ React.createElement("button", { disabled: busy, onClick: () => start(), className: `${btn} bg-[#F5F5F5] text-[#525252] disabled:opacity-50` }, "다시 분석"), busy && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "⏳ ", run.msg)), run && run.err && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#8A5A00]" }, run.err), run && run.needPdf && !busy && /* @__PURE__ */ React.createElement("label", { className: "mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#525252]" }, /* @__PURE__ */ React.createElement("span", null, "공고문 PDF를 올려 주세요(LH·SH 공고는 해당 사이트에서 받아 올리기)"), /* @__PURE__ */ React.createElement("input", { type: "file", accept: "application/pdf,.pdf", onChange: (e) => onFile(e.target.files && e.target.files[0]), className: "text-[12px]" })), res && open && /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(SubAnalysisResult, { a: res })));
}
function CheongyakTab({ mapKey }) {
  const [state, setState] = useState({ source: "sample", items: [], loading: true, at: null });
  const [f, setF] = useState(() => ({ region: "all", type: "all", area: "all", maxPrice: 0, hideExpired: true, ...store.get("cheongyak-filter-v1", {}) }));
  const load = (force) => {
    setState((s) => ({ ...s, loading: true }));
    loadCheongyak(force).then((r) => setState({ ...r, loading: false, at: /* @__PURE__ */ new Date() }));
  };
  const [notices, setNotices] = useState([]);
  const [noticesMeta, setNoticesMeta] = useState({ warning: "", lhError: "" });
  useEffect(() => {
    authFetchApi("/api/lh-notices").then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.items) {
        setNotices(j.items.filter((n) => /서울|경기|인천/.test(n.region || "")));
        setNoticesMeta({ warning: j.warning || "", lhError: j.lhError || "" });
      } else {
        setNoticesMeta({ warning: j && j.message || "LH·SH 공고를 불러오지 못했어요 — 캘린더에 청약 일정만 표시돼요.", lhError: (j && j.error) === "unauthorized" ? "unauthorized" : "" });
      }
    }).catch(() => setNoticesMeta({ warning: "LH·SH 공고를 불러오지 못했어요 — 캘린더에 청약 일정만 표시돼요.", lhError: "" }));
  }, []);
  useEffect(() => load(false), []);
  useEffect(() => {
    store.set("cheongyak-filter-v1", f);
  }, [f]);
  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));
  const regions = Array.from(new Set(state.items.map((i) => i.region).filter(Boolean)));
  const regionSel = Array.isArray(f.regions) ? f.regions : f.region && f.region !== "all" ? [f.region] : [];
  const toggleRegion = (r) => setF((p) => {
    const cur = Array.isArray(p.regions) ? p.regions : regionSel;
    return { ...p, regions: cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r] };
  });
  const today = todayYmd();
  const filtered = state.items.filter((i) => {
    if (regionSel.length && !regionSel.includes(i.region)) return false;
    if (f.type !== "all" && !(i.types || []).includes(f.type)) return false;
    if (f.area !== "all" && !(i.areas || []).includes(Number(f.area))) return false;
    if (f.maxPrice > 0 && i.priceMin && i.priceMin > f.maxPrice * 1e4) return false;
    if (f.hideExpired && i.applyEnd && i.applyEnd < today) return false;
    return true;
  });
  const noticesFiltered = regionSel.length ? notices.filter((n) => regionSel.some((r) => (n.region || "").includes(String(r).slice(0, 2)))) : notices;
  const [srcSel, setSrcSel] = useState(() => store.get("unical-src-v1", Object.keys(CAL_SRC)));
  const [kindSel, setKindSel] = useState(() => store.get("unical-kind-v1", Object.keys(CAL_KIND)));
  useEffect(() => {
    store.set("unical-src-v1", srcSel);
  }, [srcSel]);
  useEffect(() => {
    store.set("unical-kind-v1", kindSel);
  }, [kindSel]);
  const toggleIn = (setSel) => (v) => setSel((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  const calByDate = buildCalByDate(filtered, noticesFiltered, srcSel, kindSel);
  const [calDate, setCalDate] = useState(null);
  const dayItems = [], dayNoticeEvts = [], seenDay = /* @__PURE__ */ new Set();
  const dayKinds = {};
  (calDate ? calByDate[calDate] || [] : []).forEach((e) => {
    if (e.src === "apt" || e.src === "remndr") {
      (dayKinds[e.i.id] = dayKinds[e.i.id] || []).push(e.kind);
      if (!seenDay.has(e.i.id)) {
        seenDay.add(e.i.id);
        dayItems.push(e.i);
      }
    } else dayNoticeEvts.push(e);
  });
  const listItems = calDate ? dayItems : filtered;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "조건 검색", title: "청약 정보" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4" }, /* @__PURE__ */ React.createElement(SourceBadge, { source: state.source }), state.at && !state.loading && /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B] hidden sm:inline" }, state.at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), " 갱신"), /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: () => load(true), loading: state.loading }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1.5" }, "지역 — 여러 개 선택 가능"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setF((p) => ({ ...p, regions: [] })),
      className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${regionSel.length === 0 ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#525252] hover:bg-[#ECECEC]"}`
    },
    "전체"
  ), regions.map((r) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: r,
      onClick: () => toggleRegion(r),
      className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${regionSel.includes(r) ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#525252] hover:bg-[#ECECEC]"}`
    },
    regionSel.includes(r) ? "✓ " : "",
    r
  )))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" }, /* @__PURE__ */ React.createElement(Select, { label: "공급유형", value: f.type, onChange: set("type"), options: [["all", "전체"], ["신혼특공", "신혼특공"], ["신생아", "신생아"], ["생애최초", "생애최초"], ["일반공급", "일반공급"], ["무순위", "무순위·줍줍"]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Select, { label: "평형", value: f.area, onChange: set("area"), options: [["all", "전체"], ["59", pyeongText(59)], ["74", pyeongText(74)], ["84", pyeongText(84)]].map(([v, l]) => ({ value: v, label: l })) }), /* @__PURE__ */ React.createElement(Field, { label: "분양가 최대(만원, 0이면 제한 없음)", value: f.maxPrice, onChange: set("maxPrice"), step: 5e3 }), /* @__PURE__ */ React.createElement(Toggle, { label: "접수 마감된 공고", active: f.hideExpired, onClick: () => setF((p) => ({ ...p, hideExpired: !p.hideExpired })), activeText: "숨기기", inactiveText: "함께 보기" })), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[13px] text-[#6B6B6B] leading-relaxed" }, '새로고침을 누르면 청약홈 최신 공고를 다시 불러와요. "예시 데이터" 표시가 보이면 실시간 공고를 못 불러온 상태예요. 최종 확인은 청약홈에서 해 주세요.'))), /* @__PURE__ */ React.createElement(CheongyakCalendar, { byDate: calByDate, srcSel, kindSel, onSrc: toggleIn(setSrcSel), onKind: toggleIn(setKindSel), selD: calDate, onSelD: setCalDate }), noticesMeta.warning && /* @__PURE__ */ React.createElement("div", { className: "-mt-3 mb-6" }, /* @__PURE__ */ React.createElement(InfoNote, null, "⚠️ ", noticesMeta.warning, noticesMeta.lhError === "unauthorized" ? " — data.go.kr에서 「한국토지주택공사_분양임대공고문 조회 서비스」를 활용신청하면(기존 키 그대로) LH 공고도 표시돼요." : "")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold text-[#525252] mb-3 flex items-center gap-2 flex-wrap" }, calDate ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null, "📅 ", Number(calDate.slice(5, 7)), "월 ", Number(calDate.slice(8, 10)), "일 일정 ", listItems.length + dayNoticeEvts.length, "건"), /* @__PURE__ */ React.createElement("button", { onClick: () => setCalDate(null), className: "h-6 px-2.5 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold" }, "날짜 해제 ✕")) : /* @__PURE__ */ React.createElement("span", null, "검색결과 ", filtered.length, "건")), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-3 items-start" }, state.loading && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "최신 공고를 불러오는 중…")), !state.loading && listItems.length + dayNoticeEvts.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, calDate ? "이 날의 공고·일정이 없어요 — 배지가 있는 날짜를 눌러보세요." : "조건에 맞는 공고가 없어요. 필터를 완화해 보세요.")), dayNoticeEvts.map((e) => /* @__PURE__ */ React.createElement(Card, { key: `${e.i.id}-${e.kind}`, className: "!py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap mb-1" }, /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-bold px-2 py-0.5 rounded-full ${agencyBadgeCls(e.i.agency)}` }, e.i.agency), e.i.type && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold" }, e.i.type), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#6B6B6B]" }, "이 날 ", e.kind, e.i.status ? ` · ${e.i.status}` : "")), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold leading-snug" }, e.i.name), safeUrl(e.i.url) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(e.i.url), target: "_blank", rel: "noopener noreferrer", className: "inline-block mt-1.5 text-[12px] font-semibold underline underline-offset-4" }, "공고 보기"))), listItems.map((i) => {
    const expired = i.applyEnd && i.applyEnd < today;
    return /* @__PURE__ */ React.createElement(Card, { key: i.id }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, i.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, i.addr || i.region)), expired ? /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, "접수 마감") : /* @__PURE__ */ React.createElement(ToneBadge, { tone: "good" }, "마감 전")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-3" }, calDate && (dayKinds[i.id] || []).map((k) => /* @__PURE__ */ React.createElement("span", { key: k, className: `text-[12px] px-2 py-0.5 rounded-full font-semibold ${CAL_KIND_CHIP[CAL_KIND[k]]}` }, k === "당첨발표" ? "🎉 " : "", "이 날 ", k)), (i.types || []).map((t) => /* @__PURE__ */ React.createElement("span", { key: t, className: `text-[12px] px-2 py-0.5 rounded-full font-semibold ${t === "무순위" ? "bg-[#D97706]/10 text-[#D97706]" : "bg-[#0A0A0A]/10 text-[#0A0A0A]"}` }, t)), (i.areas || []).map((a) => /* @__PURE__ */ React.createElement("span", { key: a, className: "text-[12px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold" }, pyeongText(a)))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-y-1.5 gap-x-3 text-[13px] text-[#3D3D3D]" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "분양가 "), wonShort(i.priceMin), "~", wonShort(i.priceMax)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "공급 "), i.totalUnits ? i.totalUnits.toLocaleString() + "세대" : "-", i.specialUnits ? ` (그중 특공 ${i.specialUnits.toLocaleString()}세대)` : ""), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "접수 "), i.applyStart || "-", " ~ ", i.applyEnd || "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "발표 "), i.announceDate || "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "입주 "), i.moveIn || "-")), /* @__PURE__ */ React.createElement("a", { href: safeUrl(i.url) || "https://www.applyhome.co.kr", target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "inline-flex items-center gap-1 mt-3 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2" }, "청약홈에서 확인 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 })), /* @__PURE__ */ React.createElement(SubAnalyzePanel, { item: i }));
  })))));
}
function migratedChecklistDone() {
  const v2 = store.get("checklist-done-v2", null);
  if (!v2) return {};
  const out = {};
  CHECKLIST_INIT.forEach((g, gi) => g.items.forEach((t, ii) => {
    if (v2[`${gi}-${ii}`]) out[stableKey(g.cat, t)] = true;
  }));
  return out;
}
function RealtyChecklist() {
  const [doneMap, setDoneMap] = usePersist("checklist-done-v3", migratedChecklistDone());
  const toggle = (cat, text) => {
    const k = stableKey(cat, text), next = { ...doneMap };
    if (next[k]) delete next[k];
    else next[k] = true;
    setDoneMap(next);
    propagateTask(["check", cat, text], !doneMap[k]);
  };
  const total = CHECKLIST_INIT.reduce((a, g) => a + g.items.length, 0);
  const done = CHECKLIST_INIT.reduce((a, g) => a + g.items.filter((t) => doneMap[stableKey(g.cat, t)]).length, 0);
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "실행 관리", title: "체크리스트", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "전체 진행률"), /* @__PURE__ */ React.createElement("span", { className: "text-[16px] font-bold text-[#0A0A0A]" }, done, " / ", total)), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, CHECKLIST_INIT.map((g) => /* @__PURE__ */ React.createElement(Card, { key: g.cat }, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, g.cat), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((t) => {
    const on = !!doneMap[stableKey(g.cat, t)], linked = taskGroupOf(["check", g.cat, t]) >= 0;
    return /* @__PURE__ */ React.createElement("li", { key: t }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggle(g.cat, t), className: "flex items-start gap-3 text-left w-full" }, on ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[15px] ${on ? "line-through text-[#6B6B6B]" : "text-[#0A0A0A]"}` }, t, linked && /* @__PURE__ */ React.createElement("span", { className: "ml-1.5 text-[11px] font-semibold text-[#6B6B6B] no-underline", title: "플랜 타임라인의 같은 일과 함께 체크돼요" }, "🔗 플랜"))), CHECK_NOTES[t] && /* @__PURE__ */ React.createElement("div", { className: "ml-8 mt-0.5 text-[12px] text-[#6B6B6B] leading-relaxed" }, CHECK_NOTES[t]));
  }))))));
}
const timelineFlat = () => TIMELINE.flatMap((p) => p.items.map((it) => ({ key: stableKey(p.title, it), phase: p.title, text: it })));
function migratedTimelineDone() {
  const v1 = store.get("plan-timeline-done-v1", null);
  if (!v1) return {};
  const out = {};
  TIMELINE.forEach((p, pi) => p.items.forEach((it, ii) => {
    if (v1[`${pi}-${ii}`]) out[stableKey(p.title, it)] = true;
  }));
  return out;
}
function useTimelineDone() {
  return usePersist("plan-timeline-done-v2", migratedTimelineDone());
}
const TASK_LINKS = [
  [["roadmap", "realty", "첫 전세 계약 (과천 59㎡ 기준)"], ["plan", "전세 진입 + 자산 축적", "과천 전세(59㎡ 기준 6.4억~8.8억선) 계약 실행"]],
  [["roadmap", "realty", "청약 상시 도전 (과천 신규 공급)"], ["plan", "전세 진입 + 자산 축적", "과천 신규 공급 단지 청약 일정 상시 모니터링"], ["check", "정보 모니터링", "청약홈 과천 지역 공급 일정 알림 설정"]],
  [["roadmap", "realty", "자금 축적 (ISA·절세계좌)"], ["plan", "전세 진입 + 자산 축적", "ISA 목적자금 축적 시작"]],
  [["roadmap", "realty", "매매 또는 청약 당첨"], ["plan", "전세 만기 임박, 재평가", "청약 당첨 여부 확인, 미당첨 시 매매 갈아타기 재검토"]],
  [["roadmap", "realty", "입주·대출 상환계획 확정"], ["plan", "입주 및 안정화", "입주 또는 매매 실행, 대출 상환계획 확정"]],
  [["plan", "기반 다지기", "청약통장 가입기간·납입횟수 점검"], ["check", "청약 준비", "청약통장 가입기간·납입횟수 확인"]],
  [["plan", "기반 다지기", "부부합산 소득분위 정확히 계산 → 특공/일반공급 경로 확정"], ["check", "청약 준비", "부부합산 소득분위 정확히 산출"]],
  [["roadmap", "wedding", "상견례·예식 시기 합의"], ["wedding", "양가 인사·상견례 진행, 예식 시기·규모·예산 상한선 부부 합의"]],
  [["roadmap", "wedding", "웨딩홀 투어·가계약"], ["wedding", "토요일 12~14시 골든타임은 1년 전에도 마감 — 맘에 든 홀은 보증인원·식대·페이백 확인 후 바로 가계약"]],
  [["roadmap", "wedding", "스드메·본식 스냅 계약"], ["wedding", "스드메 확정 계약 — 원본·수정본 컷 수, 헬퍼비·얼리스타트비 추가금 계약서에 명시"]],
  [["roadmap", "wedding", "청첩장·모임"], ["wedding", "청첩장 모임 소그룹 진행, 모바일 청첩장은 단체방 말고 개별 연락"]],
  [["roadmap", "wedding", "신혼여행"], ["wedding", "신혼여행 최종 결제 + 여행자보험·환전·eSIM 처리"]],
  [["roadmap", "wedding", "혼인신고 (대출 유불리 검토 후)"], ["wedding", "혼인신고는 대출·청약 유불리(생애최초·신혼특공·신생아 특례) 따져 유리한 시점에"], ["plan", "기반 다지기", "혼인신고일 확정(특공 7년 요건 기산점)"]]
];
const sameRef = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const taskGroupOf = (ref) => TASK_LINKS.findIndex((g) => g.some((r) => sameRef(r, ref)));
const weddingChecklistOr = () => groupsOrDefault("wedding-checklist-v2", WEDDING_CHECKLIST_DEFAULT);
function taskDone(ref) {
  const [kind, a, b] = ref;
  if (kind === "roadmap") {
    const p = (store.get("roadmap-v2", null) || []).find((x) => x.themeId === a);
    const it = p && p.items.find((i) => i.text === b);
    return it ? !!it.done : null;
  }
  if (kind === "plan") return !!store.get("plan-timeline-done-v2", {})[stableKey(a, b)];
  if (kind === "check") return !!store.get("checklist-done-v3", {})[stableKey(a, b)];
  if (kind === "wedding") {
    const it = weddingChecklistOr().flatMap((g) => g.items).find((i) => i.text === a);
    return it ? !!it.done : null;
  }
  return null;
}
function setTaskDone(ref, done) {
  const [kind, a, b] = ref;
  if (kind === "roadmap") {
    const phases = store.get("roadmap-v2", null);
    if (!phases) return;
    const next = phases.map((p) => p.themeId !== a ? p : { ...p, items: p.items.map((i) => i.text === b ? { ...i, done } : i) });
    if (JSON.stringify(next) !== JSON.stringify(phases)) setKey("roadmap-v2", next);
  } else if (kind === "plan" || kind === "check") {
    const key = kind === "plan" ? "plan-timeline-done-v2" : "checklist-done-v3";
    const m = { ...store.get(key, {}) }, k = stableKey(a, b);
    if (!!m[k] === done) return;
    if (done) m[k] = true;
    else delete m[k];
    setKey(key, m);
  } else if (kind === "wedding") {
    const groups = weddingChecklistOr();
    if (!groups.some((g) => g.items.some((i) => i.text === a && !!i.done !== done))) return;
    setKey("wedding-checklist-v2", groups.map((g) => ({ ...g, items: g.items.map((i) => i.text === a ? { ...i, done } : i) })));
  }
}
function propagateTask(ref, done) {
  const gi = taskGroupOf(ref);
  if (gi < 0) return;
  setTimeout(() => TASK_LINKS[gi].forEach((r) => {
    if (r[0] !== ref[0]) setTaskDone(r, done);
  }), 0);
}
function reconcileTaskLinks() {
  TASK_LINKS.forEach((g) => {
    if (g.some((r) => taskDone(r) === true)) g.forEach((r) => {
      if (taskDone(r) === false) setTaskDone(r, true);
    });
  });
}
function RealtyPlanTab({ hh, diag, setTab, privacy }) {
  const [done, setDone] = useTimelineDone();
  const toggle = (k) => {
    setDone({ ...done, [k]: !done[k] });
    const it = timelineFlat().find((x) => x.key === k);
    if (it) propagateTask(["plan", it.phase, it.text], !done[k]);
  };
  const flat = timelineFlat();
  const next = flat.find((x) => !done[x.key]);
  const doneCnt = flat.filter((x) => done[x.key]).length;
  const { target, gap, monthsToGoal, requiredCash, maxLoan } = diag;
  const eta = (() => {
    if (gap <= 0 || !monthsToGoal) return null;
    const now = /* @__PURE__ */ new Date(), dt = new Date(now.getFullYear(), now.getMonth() + monthsToGoal, 1);
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
  })();
  const boostMonths = gap > 0 && hh.monthlySave > 0 ? monthsToGoal - Math.ceil(gap / ((hh.monthlySave + 50) * 1e4)) : 0;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "우리 계획", title: "우리 플랜 브리핑", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 bg-[#0A0A0A] text-white flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-white/50 mb-0.5" }, "현재 목표 — 진단 탭과 실시간 연동"), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold truncate" }, target.label)), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[18px] font-bold shrink-0" }, wonShort(target.price))), /* @__PURE__ */ React.createElement("div", { className: "p-5" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 mb-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, "최대 대출가능"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonShort(maxLoan)))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, "필요 자기자본"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonShort(requiredCash)))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, "달성 예상"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, gap <= 0 ? "지금 가능" : eta || "-"))), next ? /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#0A0A0A] px-4 py-3.5 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-medium text-[#6B6B6B] mb-1" }, "다음 할 일 · ", next.phase), /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2.5" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggle(next.key), title: "완료 처리", className: "mt-0.5 shrink-0 text-[#C9C9C9] hover:text-[#0A0A0A]" }, /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 17 })), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold leading-relaxed" }, next.text))) : /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-4 py-3.5 mb-3 text-[14px] text-[#525252]" }, "타임라인의 할 일을 모두 끝냈어요 🎉 아래에 단계를 직접 추가하거나 체크리스트를 이어가세요."), gap > 0 && boostMonths > 0 && /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-4 bg-[#FAFAFA] rounded-lg px-3 py-2.5" }, "월 저축을 ", /* @__PURE__ */ React.createElement("b", null, hh.monthlySave, "만 → ", hh.monthlySave + 50, "만"), "으로 늘리면 목표 달성이 약 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, boostMonths, "개월"), " 빨라져요. 저축 여력은 돈 모으기 테마에서 점검하세요."), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("cheongyak"), className: "h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold" }, "청약 공고 확인"), /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("diag"), className: "h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]" }, "목표·진단 조정"), /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("loan"), className: "h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]" }, "대출 계산"))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "로드맵", title: "내집마련 4단계 타임라인", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("span", { className: "mb-4 font-mono text-[12px] font-semibold text-[#6B6B6B] shrink-0" }, doneCnt, "/", flat.length, " 완료")), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "relative pl-6" }, /* @__PURE__ */ React.createElement("div", { className: "absolute left-[9px] top-2 bottom-2 w-px bg-[#E5E5E5]" }), TIMELINE.map((p, pi) => {
    const keys = p.items.map((it) => stableKey(p.title, it));
    const pd = keys.filter((k) => done[k]).length;
    const isCur = next && next.phase === p.title;
    const isDone = pd === keys.length;
    return /* @__PURE__ */ React.createElement("div", { key: pi, className: "mb-8 relative last:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: `absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white ${isDone ? "bg-[#C9C9C9]" : "bg-[#0A0A0A]"}` }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap mb-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#0A0A0A]" }, p.phase), isCur && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "진행 중"), /* @__PURE__ */ React.createElement("span", { className: "ml-auto font-mono text-[11px] text-[#6B6B6B]" }, pd, "/", keys.length)), /* @__PURE__ */ React.createElement("div", { className: `text-lg font-bold mb-2 ${isDone ? "text-[#737373] line-through" : ""}`, style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, p.title), /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: keys.length ? pd / keys.length : 0, height: 4 })), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, p.items.map((it, ii) => {
      const k = stableKey(p.title, it);
      return /* @__PURE__ */ React.createElement("li", { key: ii }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggle(k), className: "flex items-start gap-2 text-left w-full" }, done[k] ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 16, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 16, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[15px] leading-relaxed ${done[k] ? "line-through text-[#737373]" : "text-[#3D3D3D]"}` }, it, taskGroupOf(["plan", p.title, it]) >= 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-1.5 text-[11px] font-semibold text-[#6B6B6B]", title: "홈 로드맵·체크리스트의 같은 일과 함께 체크돼요" }, "🔗"))));
    })));
  })))));
}
const LONGLEASE_LINKS = [
  ["SH 인터넷청약 (시프트·미리내집)", "https://www.i-sh.co.kr"],
  ["LH 청약플러스", "https://apply.lh.or.kr"],
  ["GH 경기주택도시공사 청약", "https://apply.gh.or.kr"],
  ["마이홈포털 (임대주택 통합검색)", "https://www.myhome.go.kr"]
];
const LONGLEASE_INFO = [
  { title: "장기전세주택 (SH 시프트)", body: "주변 전세 시세의 80% 이하 보증금으로 최장 20년까지 거주하는 공공 전세. 무주택 세대구성원 + 소득·자산 기준 충족 필요, 재계약 시 보증금 인상도 제한(5% 이내)돼 목돈을 지키며 청약·매매를 준비하기 좋아요." },
  { title: "장기전세주택Ⅱ '미리내집'", body: "신혼부부(예비 포함) 중심 공급이에요. 기본 10년 살고, 입주 후 자녀를 낳으면 최장 20년까지 살 수 있어요. 자녀가 2명 이상이면 시세보다 10~20% 싸게 살 수 있는 우선매수청구권이 생겨요. 소득 기준이 일반 시프트보다 완화되는 공고가 많아 맞벌이에게 유리해요. 2026년 4월부터 보증금 분할 납부도 돼요 — 입주 때 보증금의 70%만 내고, 나머지 30%는 나갈 때까지 미룰 수 있어요(미룬 금액에 연 2.73% 이자). 2026년 4~8월 계약자의 92%가 이 방식을 골랐어요. 조건은 공고별로 달라요." },
  { title: "우리 부부 체크포인트", body: "① 무주택 세대 유지 ② 공고별 소득 기준(도시근로자 월평균소득의 %) — 맞벌이 완화 조항 확인 ③ 부동산·자동차 자산 기준 ④ 청약통장 필요 여부는 공고마다 다름 ⑤ 당첨돼도 청약 통장은 유지되는 유형이 대부분 — 공고문에서 최종 확인하세요." }
];
function LongLeaseTab() {
  const [state, setState] = useState({ loading: true, items: [], err: "", at: null });
  const load = (force) => {
    setState((s) => ({ ...s, loading: true, err: "" }));
    fetchApi("/api/longlease", force).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.items) setState({ loading: false, items: j.items, err: "", at: j.fetchedAt });
      else setState({ loading: false, items: [], err: j && j.message || "공고를 불러오지 못했어요", at: null });
    }).catch(() => setState({ loading: false, items: [], err: "네트워크 오류", at: null }));
  };
  useEffect(() => load(false), []);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "개념 정리", title: "장기전세주택 한눈에" }), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-3 gap-4 items-stretch" }, LONGLEASE_INFO.map((c, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-2" }, c.title), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, c.body))))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: state.at ? `${todayYmd(new Date(state.at))} 기준 · 공식 공고` : "공식 공고", title: "장기전세 공고 (SH·LH)" }), /* @__PURE__ */ React.createElement("button", { onClick: () => load(true), disabled: state.loading, className: "mb-4 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40" }, state.loading ? "불러오는 중…" : "새로고침")), state.err && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, state.err, " — 아래 공식 사이트에서 직접 확인해 주세요.")), !state.loading && !state.err && state.items.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "등록된 장기전세 공고가 없어요.")), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, state.items.map((it) => /* @__PURE__ */ React.createElement(Card, { key: it.id, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold leading-snug" }, it.name), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, it.region, " · ", it.kind)), /* @__PURE__ */ React.createElement(ToneBadge, { tone: it.closeAt && normYmdStr(it.closeAt) >= todayYmd() ? "good" : "neutral" }, it.agency.split(" ")[0])), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 gap-y-1.5 text-[13px] text-[#3D3D3D] mb-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "공고일 "), it.postedAt || "-"), it.closeAt && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "마감 "), it.closeAt, " ", it.status && /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "· ", it.status)), it.supply && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "공급 "), it.supply)), /* @__PURE__ */ React.createElement("div", { className: "mt-auto flex gap-3" }, safeUrl(it.url) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(it.url), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "공고문 보기"), /* @__PURE__ */ React.createElement("a", { href: naverSearch(`${it.name}`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, "네이버 검색"))))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, /* @__PURE__ */ React.createElement("b", null, "공식 공고만 표시해요"), " — SH 청약시스템의 장기전세 모집공고와 LH 공식 API의 전세형 공고를 그대로 가져옵니다(AI 추정 아님). SH 모집공고는 부정기적으로 나오고 접수기간이 공고문마다 달라, ", /* @__PURE__ */ React.createElement("b", null, "접수 여부·일정은 공고문에서 확인"), "해 주세요. 접수 중인 건은 마감일이 함께 표시됩니다."))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "바로가기", title: "공식 공고 사이트" }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, LONGLEASE_LINKS.map(([label, url]) => /* @__PURE__ */ React.createElement(
    "a",
    {
      key: url,
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "h-12 rounded-xl bg-white shadow-sm flex items-center justify-center px-3 text-center text-[13px] font-semibold text-[#525252] hover:text-[#0A0A0A] hover:shadow transition-shadow"
    },
    label
  )))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "장기전세주택 미리내집", eyebrow: "실시간", title: "장기전세 뉴스" }));
}
const INCOME_PCTS = [100, 120, 130, 140, 150, 160, 180, 200];
function resolveElig(stored) {
  const { assetCap, carCap, ...saved } = stored || store.get("eligibility-profile-v1", {}) || {};
  const p = { ...ELIG_DEFAULT, ...saved };
  p.fetus = Number(p.fetus) || (p.pregnant ? 1 : 0);
  p.pregnant = p.fetus > 0;
  const hh = { ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) };
  const names = [hh.label1 || "본인", hh.label2 || "배우자"];
  if (p.incomeSrc === "manual") return { ...p, names, auto: false };
  const nt = Number(p.nontaxMonthly) || 0;
  const mo = (man) => Number(man) > 0 ? Math.max(0, Math.round(Number(man) * 1e4 / 12) - nt) : 0;
  return { ...p, me: mo(hh.income1), spouse: mo(hh.income2), asset: Number(hh.assets) || 0, names, auto: true };
}
function EligibilityCheckTab() {
  const { incomeBase100: INCOME_BASE_100, incomeBaseYear: INCOME_BASE_YEAR } = policy().specialSupply;
  const [raw, setP] = usePersist("eligibility-profile-v1", ELIG_DEFAULT);
  const [reg] = usePersist("marriage-registered-v1", false);
  const p = resolveElig(raw);
  const set = (k) => (v) => setP((prev) => ({ ...prev, [k]: v }));
  const me = Number(p.me) || 0, sp = Number(p.spouse) || 0, income = me + sp;
  const hhSize = Math.min(5, Math.max(2, 2 + (Number(p.kids) || 0) + p.fetus));
  const limitOf = (size, pct) => Math.floor(INCOME_BASE_100[size] * pct / 100);
  const krw = (v) => (Number(v) || 0).toLocaleString("ko-KR") + "원";
  const mw = (v) => `${Math.round((Number(v) || 0) / 1e4).toLocaleString()}만원`;
  const res = [0, 1].map((i) => ({ city: "", since: "", ...(p.residence || [])[i] || {} }));
  const setRes = (i, k) => (v) => setP((prev) => {
    const r = [0, 1].map((j) => ({ city: "", since: "", ...(prev.residence || [])[j] || {} }));
    r[i] = { ...r[i], [k]: v };
    return { ...prev, residence: r };
  });
  const MODES = [["separate", householdModeLabel("separate", p.names)], ["head1", householdModeLabel("head1", p.names)], ["head2", householdModeLabel("head2", p.names)], ["joint", householdModeLabel("joint", p.names)]];
  const cols = [{ label: `부부 합산 판정(월 ${mw(income)})`, v: income }, ...!reg ? [{ label: `${p.names[0]} 혼자 판정(월 ${mw(me)})`, v: me }, { label: `${p.names[1]} 혼자 판정(월 ${mw(sp)})`, v: sp }] : []];
  const verdictCell = (v, lim) => v <= lim ? /* @__PURE__ */ React.createElement(ToneBadge, { tone: "good" }, "통과(기준 이하)") : /* @__PURE__ */ React.createElement(ToneBadge, { tone: "bad" }, mw(v - lim), " 초과");
  const SS = policy().specialSupply, NWT = (SS.tiers || {}).newlywed || { priority: { dual: 120 }, general: { dual: 160 } }, EACH = SS.dualEachMaxPct || { priority: 100, general: 140 };
  const nwR = subTier([me, sp], INCOME_BASE_100[3], NWT.priority.dual, NWT.general.dual, EACH);
  const readOnly = (label, value) => /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, label), /* @__PURE__ */ React.createElement("div", { className: "h-12 px-3.5 rounded-xl bg-[#FAFAFA] flex items-center text-[16px] font-semibold", style: { fontVariantNumeric: "tabular-nums" } }, value));
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "한 번 저장하면 공고마다 재사용", title: "우리 부부 자격 프로필" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-3 min-h-[44px] mb-3 cursor-pointer select-none" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: p.auto, onChange: (e) => setP((prev) => ({ ...prev, incomeSrc: e.target.checked ? "home" : "manual" })), className: "w-5 h-5 accent-[#0A0A0A] shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "홈 정보로 자동 계산"), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, p.auto ? "지금: 홈 연소득 ÷ 12 − 비과세, 총자산은 홈 부부 현금" : "지금: 아래 칸에 직접 입력(원천징수·건보 보수월액)")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4" }, p.auto ? /* @__PURE__ */ React.createElement(React.Fragment, null, readOnly(`${p.names[0]} 월평균소득(세전)`, krw(p.me)), readOnly(`${p.names[1]} 월평균소득(세전)`, krw(p.spouse))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: `${p.names[0]} 월평균소득(원, 세전)`, value: raw.me, onChange: set("me"), step: 1e5 }), /* @__PURE__ */ React.createElement(Field, { label: `${p.names[1]} 월평균소득(원, 세전)`, value: raw.spouse, onChange: set("spouse"), step: 1e5 })), /* @__PURE__ */ React.createElement(Field, { label: "자녀 수(태아 제외)", value: p.kids, onChange: set("kids"), step: 1 }), /* @__PURE__ */ React.createElement(Field, { label: "태아 수(임신 중이면 1)", value: p.fetus, onChange: (v) => setP((prev) => ({ ...prev, fetus: Math.max(0, Math.round(v) || 0), pregnant: v > 0 })), step: 1 })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4" }, p.auto ? readOnly("총자산(만원) · 홈 부부 현금", (Number(p.asset) || 0).toLocaleString()) : /* @__PURE__ */ React.createElement(Field, { label: "총자산(만원, 부채 차감)", value: raw.asset, onChange: set("asset"), step: 1e3 }), /* @__PURE__ */ React.createElement(Field, { label: "차량가액(만원)", value: p.car, onChange: set("car"), step: 100 }), p.auto && /* @__PURE__ */ React.createElement(Field, { label: "1인당 월 비과세(원, 식대 등)", value: raw.nontaxMonthly || 0, onChange: set("nontaxMonthly"), step: 5e4 })), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, "세대 구성 ", reg && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B] font-normal" }, "· 혼인신고 완료라 한 세대로 봐요")), /* @__PURE__ */ React.createElement("div", { role: "radiogroup", "aria-label": "세대 구성", className: "flex flex-wrap gap-1.5" }, MODES.map(([id, label]) => {
    const on = (p.householdMode || "separate") === id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: id,
        role: "radio",
        "aria-checked": on,
        onClick: () => set("householdMode")(id),
        className: `min-h-[44px] px-4 rounded-xl text-[14px] font-semibold border transition-colors ${on ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5] hover:border-[#0A0A0A]"}`
      },
      on ? "✓ " : "",
      label
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px] text-[#6B6B6B]" }, "등본 기준 — 동거인은 세대주가 아니라 투기과열지구 1순위를 못 써요.")), /* @__PURE__ */ React.createElement("div", { className: "mt-5 grid sm:grid-cols-2 gap-4" }, p.names.map((n, i) => /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, n, " 거주지 · 전입 연월"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: res[i].city, onChange: setRes(i, "city"), placeholder: "시·군 (예: 과천시)", ariaLabel: `${n} 거주 시·군`, className: "!h-12 !rounded-xl !text-[15px]" }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "month",
      "aria-label": `${n} 그 지역 전입 연월`,
      value: res[i].since,
      onChange: (e) => setRes(i, "since")(e.target.value),
      className: "h-12 px-3 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] shrink-0"
    }
  ))))), /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[13px] text-[#6B6B6B] leading-relaxed" }, "청약 소득은 ", /* @__PURE__ */ React.createElement("b", null, "세전"), "이에요 — 민영은 ", /* @__PURE__ */ React.createElement("b", null, "비과세를 뺀 전년도 원천징수영수증 총급여(21번) ÷ 근무월수"), ", 공공은 ", /* @__PURE__ */ React.createElement("b", null, "건강보험 보수월액"), ". 거주지·전입 연월은 지역 우선공급(예: 모집공고일 기준 과천에 2년 이상 계속 거주) 판정에 써요. ", /* @__PURE__ */ React.createElement("b", null, "공고마다 다른 자산·자동차 한도는 공고별 분석에서 공고문 기준으로 판정해요.")))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "공고의 소득 기준(%)과 우리 소득 비교", title: "소득 기준 자동 판정" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3.5 border-b border-[#F0F0F0] text-[14px] text-[#0A0A0A] leading-relaxed" }, "부부 월소득 합산 ", /* @__PURE__ */ React.createElement("b", null, mw(income)), "(세전) · ", /* @__PURE__ */ React.createElement("b", null, hhSize, "인 가구 기준"), p.fetus > 0 ? " (임신 반영)" : "", !reg && /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, " — 혼인신고 전이라 각자 혼자 기준도 같이 봐요")), /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React.createElement("table", { className: "w-full text-[13px]", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[#6B6B6B] border-b border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("th", { className: "px-5 py-3 font-semibold whitespace-nowrap" }, "공고 소득 기준(도시근로자 월평균소득의 %)"), /* @__PURE__ */ React.createElement("th", { className: "px-4 py-3 font-semibold whitespace-nowrap" }, "기준 금액(", hhSize, "인 가구 · 월 · 세전)"), cols.map((c) => /* @__PURE__ */ React.createElement("th", { key: c.label, className: "px-4 py-3 font-semibold whitespace-nowrap" }, c.label)))), /* @__PURE__ */ React.createElement("tbody", null, INCOME_PCTS.map((pct) => {
    const lim = limitOf(hhSize, pct);
    return /* @__PURE__ */ React.createElement("tr", { key: pct, className: "border-b border-[#F7F7F7]" }, /* @__PURE__ */ React.createElement("td", { className: "px-5 py-2.5 font-bold" }, pct, "%"), /* @__PURE__ */ React.createElement("td", { className: "px-4 py-2.5" }, krw(lim)), cols.map((c) => /* @__PURE__ */ React.createElement("td", { key: c.label, className: "px-4 py-2.5" }, verdictCell(c.v, lim))));
  })))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3.5 border-t border-[#F0F0F0] text-[13px] text-[#6B6B6B] leading-relaxed space-y-1" }, /* @__PURE__ */ React.createElement("div", null, '공고문에서 "도시근로자 월평균소득의 ', /* @__PURE__ */ React.createElement("b", null, "n%"), '"를 찾아 그 줄을 보면 돼요. 맞벌이 완화 배율(예: 120%→180%)은 완화된 줄로 확인. 기준표는 ', INCOME_BASE_YEAR, " 가구원수별 월평균소득이에요."), !reg && /* @__PURE__ */ React.createElement("div", null, "혼자 기준도 같은 줄의 기준 금액과 비교해요 — 분양 특별공급(신혼·생애최초·신생아)은 1~3인 가구 모두 3인 기준(", krw(INCOME_BASE_100[3]), ")을 쓰니, 분양 공고는 이 금액으로 보세요."), reg && /* @__PURE__ */ React.createElement("div", null, "분양 특별공급(신혼·생애최초·신생아)은 3인 이하 가구도 3인 기준(", krw(INCOME_BASE_100[3]), ")을 써요 — 위 표의 ", hhSize, "인 기준은 임대·공공 공고용이에요."), /* @__PURE__ */ React.createElement("div", null, "임대 공고는 1인 120%, 2인 110%를 곱한 값이 100%예요."), me > 0 && sp > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[#0A0A0A]" }, /* @__PURE__ */ React.createElement("b", null, "민영 신혼특공(맞벌이)"), " · ", nwR.tier === "추첨" ? "추첨 물량만" : `${nwR.tier} 대상`, "이에요. ", subEachWhy(nwR, mw) || `합산 ${mw(income)}을 3인 기준 ${nwR.pct}%와 비교했어요.`, " 맞벌이는 합산 기준과 함께 한 사람 소득이 우선공급 ", EACH.priority, "%·일반공급 ", EACH.general, "% 이하여야 해요.")))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "소득 외 요건", title: "거주 요건 체크" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "SH 장기전세·미리내집"), ": 공고일 현재 ", /* @__PURE__ */ React.createElement("b", null, "서울시 거주"), " 필수")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "과천 등 투기과열지구 분양"), ": 재건축은 ", /* @__PURE__ */ React.createElement("b", null, "모집공고일 기준 과천에 2년 이상 계속 거주"), "한 사람이 우선이에요. 66만㎡ 이상 대규모 택지(지식정보타운 등)는 과천 30%·경기 20%·수도권 50%로 나눠 뽑아요. 인기 단지는 과천 거주자 몫에서 사실상 마감돼요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "거주기간은 ", /* @__PURE__ */ React.createElement("b", null, "모집공고일부터 거꾸로"), " 세요. 과천 청약이 목표면 분양 예상 시점보다 2년 먼저 전입해야 해요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "총자산·자동차가액 한도, 혼인신고일로부터 7년 이내 여부, 5년 무주택 이력, 재당첨 제한은 공고마다 달라요. 청약 공고 카드의 ", /* @__PURE__ */ React.createElement("b", null, "[우리 조건으로 분석]"), "이 공고문 기준으로 판정해요."))))));
}
const PUBLIC_TYPES = [
  { name: "행복주택", target: "청년·신혼부부·대학생 (무주택)", price: "시세 60~80% 임대료", term: "6~10년 (신혼부부는 자녀 있으면 10년)", point: "역세권 등 입지가 좋은 편. 신혼부부 계층 물량이 따로 있어 경쟁이 상대적으로 수월한 공고도 있어요.", q: "행복주택 신혼부부 입주조건" },
  { name: "통합공공임대", target: "중위소득 150% 이하 무주택 (유형 통합)", price: "소득에 따라 시세 35~90%", term: "최장 30년", point: "2022년부터 국민·영구·행복을 하나로 합친 신규 공급 유형 — 요즘 새 공고는 대부분 이 형태예요.", q: "통합공공임대 신혼부부 조건" },
  { name: "국민임대", target: "도시근로자 월평균소득 70% 이하 무주택 (1인 90%, 2인 80%)", price: "시세 60~80%", term: "최장 30년", point: "전용 60㎡ 이하 위주. 소득 요건이 맞으면 장기 거주 안정성이 가장 좋아요.", q: "국민임대 입주자격" },
  { name: "영구임대", target: "기초생활수급자 등 최저소득층", price: "시세 30% 수준", term: "50년 (사실상 영구)", point: "일반 맞벌이 신혼부부는 대상이 아니에요 — 참고용.", q: "영구임대주택 자격" },
  { name: "공공임대 (5·10년 분양전환)", target: "무주택 (신혼 특공 있음)", price: "임대 후 분양전환가로 매수", term: "5~10년 임대 → 분양전환", point: "임대로 살아보고 그 집을 우선 매수할 수 있는 유형 — 내 집 마련 디딤돌로 활용.", q: "10년 공공임대 분양전환" },
  { name: "전세임대", target: "무주택 저소득·신혼부부", price: "지원한도 내 보증금의 5% 부담 수준", term: "2년 단위 갱신 (최장 20년)", point: "내가 살고 싶은 집을 직접 골라오면 LH가 집주인과 전세계약 후 재임대 — 신혼부부 전세임대Ⅰ·Ⅱ 확인.", q: "신혼부부 전세임대 조건" },
  { name: "매입임대", target: "무주택 청년·신혼부부", price: "시세 30~50%", term: "2년 단위 (최장 20년)", point: "LH·SH가 사둔 빌라·오피스텔 등을 저렴하게 임대 — 신혼부부 매입임대는 아이 계획 있으면 유리.", q: "신혼부부 매입임대주택" },
  { name: "장기전세 (시프트·미리내집)", target: "무주택 (미리내집은 신혼부부 중심)", price: "전세 시세 80% 이하", term: "최장 20년", point: "월세 없이 전세 — 자세한 내용은 위 '🏠 장기전세' 탭에서 봐요.", q: "장기전세주택 공고" },
  { name: "공공분양 뉴:홈", target: "무주택 (신혼·생애최초 특공)", price: "나눔형은 시세 70% 이하", term: "분양 (소유)", point: "나눔형(저렴+시세차익 30% 공유)·선택형(6년 임대 후 분양 선택)·일반형 — 신혼 특공 물량이 크지만 소득·총자산 기준이 있어 고소득 맞벌이는 초과할 수 있어요(공고별 확인).", q: "뉴홈 공공분양 신혼부부" },
  { name: "신혼희망타운", target: "혼인 7년 이내, 6세 이하 자녀, 예비신혼부부, 한부모 · 소득 130% 이하(맞벌이 상향), 총자산 3.62억 원 이하", price: "분양가 상한 적용", term: "분양 (수익공유형 모기지 연계)", point: "분양가가 총자산 기준을 넘으면 수익공유형 모기지(연 1.6%, 집값의 30% 이상)에 반드시 가입하고, 팔 때 시세차익 일부를 기금과 나눠요.", q: "신혼희망타운 입주자격" }
];
const agencyBadgeCls = (a) => a === "SH" ? "bg-[#2563EB]/10 text-[#2563EB]" : a === "서울시" ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "bg-[#059669]/10 text-[#059669]";
function PublicTypesSection() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "공공주택 A to Z", title: "유형별 한눈에 — 신혼부부 관점" }), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, PUBLIC_TYPES.map((t, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold mb-2" }, t.name), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 gap-y-1.5 text-[13px] text-[#3D3D3D] mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "대상 "), t.target), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "가격 "), t.price), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "기간 "), t.term)), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3 flex-1" }, "💡 ", t.point), /* @__PURE__ */ React.createElement("a", { href: naverSearch(t.q), target: "_blank", rel: "noopener noreferrer", className: "mt-auto text-[13px] font-semibold underline underline-offset-4" }, "최신 조건 검색")))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "소득·자산 기준과 임대료는 공고·지역마다 달라요. 관심 유형은 '🏢 청약 공고·캘린더' 탭에서 지금 나온 공고를 확인하고, 공고문으로 최종 판단해요."))));
}
const REALTY_TERMS = [
  { cat: "계약·권리 지키기", items: [
    ["등기부등본", "집의 신분증 — 소유자와 근저당(담보대출) 등 권리관계를 확인해요. 계약 전과 잔금 직전, 전입 다음 날에도 한 번 더 떼보는 게 안전해요."],
    ["근저당권", "집주인이 집을 담보로 받은 대출. 내 보증금+근저당 합계가 집값의 70~80%를 넘으면 위험 신호(깡통전세)예요(법 기준은 아니에요)."],
    ["전입신고 · 대항력", "이사 후 전입신고+실거주하면 '새 집주인에게도 임차권을 주장'하는 대항력이 다음 날 0시에 생겨요. 이사 당일 필수."],
    ["확정일자 · 우선변제권", "계약서에 받는 날짜 도장으로, 주민센터·등기소·인터넷등기소에서 받아요. 임대차 신고를 하면 자동으로 붙어요. 계약서를 쓴 직후 바로 받아요. 대항력과 합쳐지면 경매 시 후순위 채권자보다 먼저 보증금을 돌려받아요."],
    ["전세보증보험 (HUG 등)", "집주인이 보증금을 못 돌려줄 때 보증기관이 대신 지급해요. HUG(주택도시보증공사) 기준 보증금이 수도권 7억·그 밖 5억 이하이고, 보증금과 선순위채권 합계가 주택가격의 90% 이내여야 가입돼요. 빌라는 공시가격의 126%까지예요. 무주택 신혼부부는 보증료를 40% 할인받아요."],
    ["전세권 설정", "등기부에 전세권(물권, 물건을 직접 지배하는 권리)을 등기하는 방법이에요. 전입하지 않아도 보호되지만 집주인 동의와 등기 비용이 들어요. 보통은 확정일자와 보증보험으로 충분해요."],
    ["소액임차인 최우선변제", "소액임차인 최우선변제(경매 때 가장 먼저 돌려받는 몫)는 서울이 보증금 1억6,500만원 이하일 때 5,500만원까지예요. 과밀억제권역·세종·용인·화성·김포는 1억4,500만원 이하일 때 4,800만원이에요(과천은 과밀억제권역). 기준은 선순위 담보 설정일이에요."],
    ["선순위 근저당 · 채권최고액", "선순위 근저당은 내 보증금보다 먼저 등기된 대출이에요. 집이 경매로 넘어가면 이 대출을 먼저 갚아요. 채권최고액은 등기부에 적힌 그 대출의 최대 담보 금액으로, 보통 실제 대출액의 120~130%예요. 위험도는 채권최고액 기준으로 계산해요."],
    ["전세가율", "매매가 대비 전세 보증금 비율. 예: 매매 5억·전세 4억이면 80%. 높을수록 집값이 조금만 떨어져도 보증금을 못 돌려받을 위험이 커요."]
  ] },
  { cat: "청약", items: [
    ["가점제 · 추첨제", "무주택기간(32)+부양가족(35)+통장기간(17)=84점 만점 가점 순 배정 vs 무작위 추첨. 신혼부부는 가점이 낮아 특공·추첨제 물량이 유리해요."],
    ["특별공급 (특공)", "신혼부부·생애최초·신생아·다자녀 등 일반공급과 경쟁하지 않는 별도 물량이에요. " + SPECIAL_ONCE_TEXT],
    ["무주택기간", "만 30세(그 전에 혼인했으면 혼인신고일)부터 계산 — 부부 모두 무주택이어야 해요."],
    ["청약 예치금", "지역·면적별 기준금액(서울 85㎡ 이하 300만원 등)을 공고일 전까지 통장에 넣어둬야 해당 평형 신청 가능."],
    ["분양가상한제", "분양가를 택지비+건축비 수준으로 제한 — 공공택지 전부와 민간택지는 강남·서초·송파·용산만. 과천 재건축은 미적용."],
    ["전매제한 · 실거주의무", "당첨 후 일정 기간 되팔 수 없고(전매제한), 일부 단지는 직접 거주 의무도 있어요. 자금 계획에 반영 필수."],
    ["무순위 청약 (줍줍)", "계약 포기·부적격으로 남은 집을 다시 파는 거예요. 2025.6.10부터 무주택 세대구성원만 신청할 수 있고, 시·군·구가 정하면 그 지역 거주자로 제한돼요. 청약통장과 가점은 필요 없어요."],
    ["우선공급 · 일반공급 · 추첨 물량 (특공 안)", "특공 물량을 소득 구간으로 나눠요. 우선공급은 소득이 더 낮은 가구에 먼저 주는 몫, 일반공급은 그다음 소득 구간 몫이에요. 추첨 물량은 소득을 안 보고 추첨하는 몫(민영 신혼·생애최초 특공은 우선 50%·일반 20%를 뺀 30%)으로, 세대 부동산 가액 기준만 맞으면 돼요."],
    ["1순위", "청약 신청 순위 중 첫째. 투기과열지구 기준으로 통장 가입 2년 이상 + 예치금(공공은 24회 납입)을 채우고, 2주택 이상 세대가 아니어야 해요. 투기과열지구에서는 세대주여야 하고, 최근 5년 안에 당첨된 적이 없어야 해요."],
    ["세대주 · 세대원 · 동거인", "세대주는 주민등록 세대의 대표자, 세대원은 세대주와 가족 관계(배우자·부모·자녀 등)로 같은 세대에 오른 사람이에요. 동거인은 등본에 함께 올라 있지만 가족 관계가 아닌 사람으로, 혼인신고 전 연인이 여기에 해당해요. 동거인은 소득·가구원 수에 들어가지 않고, 세대주가 아니라 투기과열지구 1순위가 안 돼요."],
    ["투기과열지구", "집값이 과열됐다고 정부가 지정한 지역(과천 포함). 청약 1순위가 세대주로 제한되고, 가점제 비율이 높고, 재당첨 제한·전매제한이 강해요."]
  ] },
  { cat: "대출·세금", items: [
    ["LTV", "집값 대비 대출 가능 비율. 규제지역 무주택 40%, 생애최초 70%(비수도권 80%)."],
    ["DSR", "연소득 대비 '모든 대출' 연 원리금 비율 한도(40%). 사실상 대출 한도를 결정하는 핵심 — 진단 탭이 이 기준으로 계산해요."],
    ["DTI", "연소득 대비 주담대 원리금+기타대출 이자 비율. DSR보다 느슨해 요즘은 DSR이 주로 적용돼요."],
    ["하드캡 (가격구간 대출 한도)", "집값 구간별 주담대 최대 한도예요(2025.10.16~). 15억 이하 6억, 25억 이하 4억, 25억 초과 2억이고, 소득과 관계없이 적용돼요."],
    ["스트레스 금리", "DSR을 계산할 때 실제 금리에 더하는 가상의 금리예요. 금리가 오를 때를 대비한 것이라, 더할수록 대출 한도가 줄어요."],
    ["원리금균등 · 원금균등", "원리금균등은 매달 같은 금액(원금+이자)을 갚아요. 원금균등은 매달 같은 원금에 남은 이자를 더해 갚아서, 처음 부담이 크고 갈수록 줄어요. 총이자는 원금균등이 적어요."],
    ["비과세 · 보수월액", "비과세는 세금을 매기지 않는 소득(예: 식대 월 20만원)이에요. 청약 소득을 계산할 때는 빼요. 보수월액은 건강보험료를 매기는 기준 월급으로, 공공분양 소득 확인에 써요."],
    ["디딤돌 · 보금자리론", "무주택 서민의 '구입' 정책대출 — 시중은행보다 저리, 소득·집값 요건 있음. 신생아 특례는 금리가 크게 낮아요."],
    ["버팀목 전세대출", "무주택 서민의 '전세' 정책대출 — 신혼부부 전용은 한도·금리 우대."],
    ["중도금 · 잔금", "분양은 계약금(10%)→중도금(60%, 집단대출)→잔금(30%, 입주 시 주담대 전환) 순서로 나눠 내요."],
    ["취득세", "집을 살 때 내는 세금이에요. 무주택자가 1주택을 사면 6억 이하 1%, 6~9억 1~3%, 9억 초과 3%이고, 지방교육세(0.1~0.3%)가 따로 붙어요. 생애최초 감면은 최대 200만(소형 300만)이에요."],
    ["종부세 (종합부동산세)", "보유 주택 공시가격이 공제액을 넘으면 매년 내는 세금. 2026 세제개편안: '주택 수' 대신 '가액+실거주' 기준 — 실거주 1주택 공제 12억→14억(시가 약 20억까지 면제), 비거주는 9억으로 축소."],
    ["장기보유특별공제", "집을 팔 때 양도차익에서 깎아주는 공제. 2026 세제개편안: 보유기간 중심 → '실거주 기간' 중심으로 개편 + 공제 상한 신설 — 사서 직접 오래 살수록 유리해지는 구조."]
  ] },
  { cat: "집 고르기·드는 돈", items: [
    ["잘 팔리는 집", "신혼집은 2~5년 뒤 옮기는 발판인 경우가 많아, 마음에 드는 집보다 나중에 잘 팔릴 집을 고르라는 조언이 많아요. 흔히 보는 기준: ① 대단지(1,000세대 이상은 불황에도 거래가 이어짐) ② 지하철역 걸어서 5분 안팎 ③ 초등학교 가까이(3040 부모 수요)."],
    ["집 살 때 드는 돈 (사례)", "8억 집을 생애최초로 산 사례(인스타 @economy.notes 게시물) — 집값은 내 돈 3억 + 대출 5억. 그 밖에 취득세 1,830만·중개보수 324만·인테리어 4,500만·입주청소 100만·이사 265만·시스템에어컨 505만·가전 653만으로 부대비용이 약 8,177만이었어요. 집값의 10% 정도를 따로 잡아 두면 안전해요(인테리어를 줄이면 크게 줄어요)."]
  ] },
  { cat: "면적·기타", items: [
    ["전용면적", "현관 안쪽, 우리 가족만 쓰는 실면적. 59㎡=흔히 '25평형', 84㎡='34평형'으로 불려요."],
    ["공급면적", "전용+계단·복도 등 주거공용면적. 아파트 'OO평형' 표기의 기준이라 전용면적과 헷갈리지 않게."],
    ["베이 (bay)", "전면 발코니에 접한 공간 수 — 3베이·4베이일수록 채광·통풍이 좋아 선호돼요."],
    ["임장", "후보 단지를 직접 걸어보며 확인하는 것 — 소음·언덕·상권·통근시간은 지도로는 몰라요."]
  ] }
];
const REALTY_PROCEDURES = [
  { title: "전세 계약 절차", steps: ["예산·대출한도 확인 (버팀목 등 정책대출 먼저)", "매물 확인 + 임장 (주변 시세와 비교)", "등기부등본 확인 — 근저당·소유자 일치", "계약금 5~10% 계약 (집주인 신분증·계좌 명의 확인)", "곧바로 확정일자", "보증보험 가입 가능 여부를 HUG에 미리 확인", "전세대출 신청", "잔금·입주", "이사 당일 전입신고", "보증보험 가입 (잔금일·전입일 중 늦은 날부터 계약기간 절반이 지나기 전)"] },
  { title: "청약 신청 절차", steps: ["청약통장 요건·예치금 확인", "공고문 정독 — 자격·일정·특공 물량", "청약홈에서 특공/1·2순위 접수", "당첨 발표 → 서류 제출 (부적격 주의)", "계약금 납부 (보통 분양가의 10~20%)", "중도금 집단대출 (납부 방식은 공고마다 달라요)", "입주: 잔금 + 소유권 이전"] },
  { title: "임장 준비 순서 (손품 먼저)", steps: ["예산으로 갈 수 있는 지역 후보 몇 곳 정하기 — 교통·학군·생활권까지 비교", "후보 중 가장 선호되는 지역부터 보기 — 왜 선호되는지 먼저 이해", "생활권 확인 — 직장·양가와의 거리, 아이 교육환경", "예산에 맞는 단지만 추리기 — 너무 비싸거나 싼 곳은 구경만 하게 돼요", "실거래가와 지금 호가 차이 확인 (관심 매물 [매매 시세 조회])", "학군·초등학교 거리·학원가로 한 번 더 좁힌 뒤 현장 임장"] },
  { title: "매매 계약 절차", steps: ["자금계획 — DSR 한도·보유현금 (진단 탭 활용)", "임장 + 실거래가 확인 (국토부 실거래가 공개시스템)", "가계약 → 본계약 (등기부 재확인)", "주택담보대출 신청", "중도금 (계약에 따라 생략 가능)", "잔금 + 소유권이전등기 (법무사 대행)", "취득세 신고·납부 (60일 이내)"] }
];
function RealtyGuideTab() {
  const [q, setQ] = useState("");
  const kw = q.trim();
  const groups = REALTY_TERMS.map((g) => ({ ...g, items: g.items.filter(([t, d]) => !kw || t.includes(kw) || d.includes(kw)) })).filter((g) => g.items.length);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "모르는 말 찾기", title: "부동산 용어 사전" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(TextInput, { value: q, onChange: setQ, placeholder: "용어 검색 (예: DSR, 확정일자)", className: "!w-56 !bg-white shadow-sm" }))), groups.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, '"', kw, '" 검색 결과가 없어요.')), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, groups.map((g) => /* @__PURE__ */ React.createElement("section", { key: g.cat }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, g.cat), /* @__PURE__ */ React.createElement("div", { className: "space-y-3.5" }, g.items.map(([t, d]) => /* @__PURE__ */ React.createElement("div", { key: t }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold mb-0.5" }, t), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, d))))))))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "단계별 순서", title: "절차 한눈에" }), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-3 gap-4 items-start" }, REALTY_PROCEDURES.map((p) => /* @__PURE__ */ React.createElement(Card, { key: p.title, className: "h-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, p.title), /* @__PURE__ */ React.createElement("ol", { className: "space-y-2.5" }, p.steps.map((s, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex gap-2.5 text-[13px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "shrink-0 w-5 h-5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-bold flex items-center justify-center mt-0.5" }, i + 1), /* @__PURE__ */ React.createElement("span", null, s))))))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "일반적인 순서 기준이에요 — 정책·규제는 수시로 바뀌니 실행 전에 전략·정보 탭의 뉴스와 공식 안내로 확인해요."))));
}
const rankOf = (order, key) => {
  const i = (order || []).indexOf(key);
  return i < 0 ? 0 : i + 1;
};
const withRank = (order, key, k) => {
  const o = (order || []).filter((x) => x !== key);
  if (k > 0) o.splice(Math.min(k - 1, o.length), 0, key);
  return o;
};
function RankSelect({ order, id, onChange, label = "순위" }) {
  const r = rankOf(order, id), n = (order || []).length + (r ? 0 : 1);
  return /* @__PURE__ */ React.createElement("label", { className: "inline-flex items-center gap-1 text-[12px] text-[#525252]" }, /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, label), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: r,
      onChange: (e) => onChange(Number(e.target.value)),
      "aria-label": label,
      className: `h-8 pl-2 pr-6 rounded-lg text-[12px] font-bold border ${r ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"}`
    },
    /* @__PURE__ */ React.createElement("option", { value: 0 }, "순위 없음"),
    Array.from({ length: n }, (_, i) => /* @__PURE__ */ React.createElement("option", { key: i + 1, value: i + 1 }, i + 1, "순위"))
  ));
}
const WATCH_KEY = "realty-watchlist-v1";
const WATCH_EMPTY = {
  loanUse: "받음",
  loanAmt: "",
  loanRate: "",
  loanYears: "",
  link: "",
  title: "",
  addr: "",
  dealType: "월세",
  price: "",
  rent: "",
  area: "",
  floor: "",
  built: "",
  bldg: "아파트",
  maintenance: "",
  rooms: "",
  moveIn: "",
  options: "",
  broker: "",
  marketPrice: "",
  seniorDebt: "",
  guarantee: "모름",
  violation: "모름",
  trust: "모름",
  memo: ""
};
const WATCH_NUM_MAN = ["price", "rent", "maintenance", "marketPrice", "seniorDebt"];
const riskTone = (lv) => lv === "높음" ? "bg-[#FDECEA] text-[#B42318]" : lv === "보통" ? "bg-[#FFF4D6] text-[#8A5A00]" : lv === "낮음" ? "bg-[#E7F4EE] text-[#1F5D46]" : "bg-[#F0F0F0] text-[#525252]";
const fitTone = (lv) => lv === "잘 맞음" ? "bg-[#E7F4EE] text-[#1F5D46]" : lv === "안 맞음" ? "bg-[#FDECEA] text-[#B42318]" : "bg-[#FFF4D6] text-[#8A5A00]";
function shrinkImage(file, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했어요"));
    };
    img.src = url;
  });
}
const watchPriceText = (it) => it.dealType === "월세" ? `보증금 ${wonShort(it.price || 0)} / 월 ${won(it.rent || 0)}` : `${it.dealType} ${wonShort(it.price || 0)}`;
function WatchChoice({ label, value, options, onChange }) {
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, label), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, options.map((o) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: o,
      type: "button",
      onClick: () => onChange(o),
      "aria-pressed": value === o,
      className: `h-9 px-3 rounded-full text-[13px] font-semibold ${value === o ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#525252]"}`
    },
    o
  ))));
}
function WatchInput({ label, value, onChange, unit, ph, num }) {
  const id = React.useId();
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: id, className: "text-[12px] text-[#6B6B6B] block mb-1" }, label), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      id,
      type: "text",
      inputMode: num ? "decimal" : void 0,
      value: value ?? "",
      onChange: (e) => onChange(e.target.value),
      placeholder: ph || "",
      className: "h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    }
  ), unit && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B] shrink-0" }, unit)));
}
function WatchForm({ initial, onSave, onCancel }) {
  const toForm = (it) => {
    const f2 = { ...WATCH_EMPTY, ...it };
    WATCH_NUM_MAN.forEach((k) => {
      f2[k] = it && Number(it[k]) > 0 ? String(+(Number(it[k]) / 1e4).toFixed(4)) : "";
    });
    ["area", "built"].forEach((k) => {
      f2[k] = it && it[k] ? String(it[k]) : "";
    });
    return f2;
  };
  const [f, setF] = useState(() => toForm(initial || {}));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const autofill = async (image) => {
    setBusy(true);
    setErr("");
    try {
      const r = await withTimeout(authFetch("/api/listing-extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: paste, image }) }), 6e4, "응답이 늦어요 — 다시 시도해 주세요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || `자동 채우기 실패 (${r.status})`);
      const x = j.fields || {};
      if (!Object.keys(x).length) throw new Error("매물 정보를 찾지 못했어요 — 가격·면적이 보이는 부분을 붙여넣어 주세요");
      setF((p) => {
        const n = { ...p };
        Object.entries(x).forEach(([k, v]) => {
          if (v == null || v === "") return;
          n[k] = WATCH_NUM_MAN.includes(k) ? String(+(Number(v) / 1e4).toFixed(4)) : String(v);
        });
        return n;
      });
    } catch (e) {
      setErr(String(e && e.message || e));
    } finally {
      setBusy(false);
    }
  };
  const onImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      autofill(await shrinkImage(file));
    } catch (x) {
      setErr(String(x.message || x));
    }
  };
  const save = () => {
    if (!f.title.trim() && !f.addr.trim()) {
      setErr("단지·건물명이나 주소 중 하나는 적어 주세요 — 캡처나 글 붙여넣기로 채울 수 있어요");
      return;
    }
    const out = { ...f, title: f.title.trim(), addr: f.addr.trim(), link: safeUrl(f.link.trim()) ? f.link.trim() : "" };
    WATCH_NUM_MAN.forEach((k) => {
      const n = tourNum(f[k]);
      out[k] = n > 0 ? Math.round(n * 1e4) : 0;
    });
    out.area = Number(f.area) || 0;
    out.built = Number(f.built) || 0;
    onSave(out);
  };
  return /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(WatchInput, { label: "매물 링크 (네이버 부동산 등)", value: f.link, onChange: set("link"), ph: "https://naver.me/..." }), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-1" }, "링크는 카드에서 매물을 바로 여는 용도예요. 네이버 부동산은 서버 접속을 막아 링크로 정보를 읽을 수 없어서, 정보는 아래 캡처·글 붙여넣기로 채워요.")), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] p-3 space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, "자동 채우기 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "— 매물 페이지 글을 복사해 붙여넣거나 캡처를 올리면 상담사가 칸을 채워요")), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: paste,
      onChange: (e) => setPaste(e.target.value),
      rows: 3,
      placeholder: "매물 설명·가격·면적·관리비가 보이는 부분을 그대로 붙여넣기",
      "aria-label": "매물 글 붙여넣기",
      className: "w-full rounded-lg bg-white border border-[#E5E5E5] px-2.5 py-2 text-[13px] leading-relaxed focus:outline-none focus:border-[#0A0A0A]"
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => autofill(), disabled: busy || !paste.trim(), className: "h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40" }, busy ? "읽는 중…" : "글로 채우기"), /* @__PURE__ */ React.createElement("label", { className: `h-9 px-3.5 rounded-full bg-white border border-[#E5E5E5] text-[13px] font-semibold inline-flex items-center cursor-pointer ${busy ? "opacity-40 pointer-events-none" : ""}` }, "캡처로 채우기", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "image/*", onChange: onImage, className: "hidden" })))), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement(WatchInput, { label: "단지·건물명", value: f.title, onChange: set("title"), ph: "예: 래미안슈르" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "주소 (지도 표시용)", value: f.addr, onChange: set("addr"), ph: "예: 과천시 별양동 1-1" })), /* @__PURE__ */ React.createElement(WatchChoice, { label: "거래 유형", value: f.dealType, options: ["매매", "전세", "월세"], onChange: set("dealType") }), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#EDEDED] p-3 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, "자금 계획 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "— 월 고정비와 분석이 이 계획으로 계산돼요")), /* @__PURE__ */ React.createElement(WatchChoice, { label: f.dealType === "매매" ? "주택담보대출" : "보증금 대출(전세대출)", value: f.loanUse, options: ["받음", "안 받음"], onChange: set("loanUse") }), f.loanUse !== "안 받음" && /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement(WatchInput, { label: "대출 금액", value: f.loanAmt, onChange: set("loanAmt"), unit: "만원", num: true, ph: "비우면 필요한 만큼" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "금리", value: f.loanRate, onChange: set("loanRate"), unit: "%", num: true, ph: "비우면 계산기 금리" }), f.dealType === "매매" && /* @__PURE__ */ React.createElement(WatchInput, { label: "기간", value: f.loanYears, onChange: set("loanYears"), unit: "년", num: true, ph: "30" })), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "대출 금액을 비우면 가격에서 우리 자기자본(대출 없이 낼 수 있는 우리 돈)을 뺀 만큼을 대출로 잡아요. 예상 대출 한도(진단과 같은 규칙)를 넘지는 않아요. 직접 적은 금액이 한도를 넘으면 카드에 경고가 떠요.")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, /* @__PURE__ */ React.createElement(WatchInput, { label: f.dealType === "매매" ? "매매가" : "보증금", value: f.price, onChange: set("price"), unit: "만원", num: true }), f.dealType === "월세" && /* @__PURE__ */ React.createElement(WatchInput, { label: "월세", value: f.rent, onChange: set("rent"), unit: "만원", num: true }), /* @__PURE__ */ React.createElement(WatchInput, { label: "관리비(월)", value: f.maintenance, onChange: set("maintenance"), unit: "만원", num: true }), /* @__PURE__ */ React.createElement(WatchInput, { label: `전용면적${Number(f.area) > 0 ? ` · ${pyeongText(f.area)}` : ""}`, value: f.area, onChange: set("area"), unit: "㎡", num: true }), /* @__PURE__ */ React.createElement(WatchInput, { label: "층", value: f.floor, onChange: set("floor"), ph: "예: 5/15층" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "준공연도", value: f.built, onChange: set("built"), num: true, ph: "예: 2018" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "방/욕실", value: f.rooms, onChange: set("rooms"), ph: "예: 2/1" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "입주 가능일", value: f.moveIn, onChange: set("moveIn"), ph: "예: 즉시, 11월 말" })), /* @__PURE__ */ React.createElement(WatchChoice, { label: "주택 유형", value: f.bldg, options: ["아파트", "오피스텔", "빌라", "단독·다가구", "기타"], onChange: set("bldg") }), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#EDEDED] p-3 space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, "위험도 판단에 쓰는 정보 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "— 등기부등본·중개사 설명으로 아는 만큼만 적어요. 모르면 비워 두세요. 상담사가 확인할 항목으로 알려 줘요.")), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement(WatchInput, { label: "매매 시세(추정)", value: f.marketPrice, onChange: set("marketPrice"), unit: "만원", num: true, ph: "비우면 실거래로 추정" }), /* @__PURE__ */ React.createElement(WatchInput, { label: "선순위 근저당 채권최고액(내 보증금보다 먼저 잡힌 대출)", value: f.seniorDebt, onChange: set("seniorDebt"), unit: "만원", num: true, ph: "등기부 을구에 적힌 금액" })), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement(WatchChoice, { label: "전세보증보험(보증금 반환 보장) 가입", value: f.guarantee, options: ["가능", "불가", "모름"], onChange: set("guarantee") }), /* @__PURE__ */ React.createElement(WatchChoice, { label: "위반건축물(불법 증축 등)", value: f.violation, options: ["없음", "있음", "모름"], onChange: set("violation") }), /* @__PURE__ */ React.createElement(WatchChoice, { label: "신탁 등기(소유권이 신탁회사에 있음)", value: f.trust, options: ["없음", "있음", "모름"], onChange: set("trust") }))), /* @__PURE__ */ React.createElement(WatchInput, { label: "옵션·특이사항", value: f.options, onChange: set("options") }), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement(WatchInput, { label: "중개사무소", value: f.broker, onChange: set("broker") }), /* @__PURE__ */ React.createElement(WatchInput, { label: "메모", value: f.memo, onChange: set("memo"), ph: "임장 느낌, 채광, 소음 등" })), err && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A5A00] bg-[#FFF7E6] rounded-lg px-3 py-2" }, err), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: save, disabled: busy, className: "flex-1 h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold text-[14px] disabled:opacity-50" }, "저장하고 분석"), /* @__PURE__ */ React.createElement("button", { onClick: onCancel, className: "h-11 px-5 rounded-xl bg-[#F0F0F0] text-[#525252] font-semibold text-[14px]" }, "취소"))));
}
function watchFixedCosts(it, hh) {
  const price = Number(it.price) || 0, eqWon = realtyEquityMan({ ...HH_DEFAULT, ...hh }) * 1e4;
  const fin = estimateFinancing({ dealType: it.dealType, price, rent: Number(it.rent) || 0, hh });
  const need = Math.max(0, price - Math.max(0, eqWon));
  const maxLoan = Math.max(0, fin.maxLoan || 0);
  const wantMan = tourNum(it.loanAmt) || 0;
  const loan = it.loanUse === "안 받음" ? 0 : wantMan > 0 ? Math.round(wantMan * 1e4) : Math.min(need, maxLoan);
  const overLimit = loan > maxLoan;
  const rate = r2(Number(it.loanRate) || Number(hh && hh.loanRateCalc || HH_DEFAULT.loanRateCalc) || 4.5);
  const years = Number(it.loanYears) || 30;
  const name = it.title || it.addr || "관심 매물";
  const out = [];
  if (it.dealType === "월세" && it.rent > 0) out.push({ id: "watch-rent", memo: `월세 · ${name}`, amount: Math.round(it.rent), cat: "house", day: 1, type: "exp" });
  if (loan > 0) out.push(it.dealType === "매매" ? { id: "watch-loan", memo: `주담대 원리금(${rate}%·${years}년) · ${name}`, amount: Math.round(annuityPayment(loan, rate, years)), cat: "house", day: 25, type: "exp" } : { id: "watch-loan", memo: `${it.dealType === "전세" ? "전세대출" : "보증금 대출"} 이자(${rate}%) · ${name}`, amount: Math.round(loan * rate / 100 / 12), cat: "house", day: 25, type: "exp" });
  if (it.maintenance > 0) out.push({ id: "watch-maint", memo: `관리비 · ${name}`, amount: Math.round(it.maintenance), cat: "house", day: 10, type: "exp" });
  const cashNeed = Math.max(0, price - loan);
  return { items: out, loan, maxLoan, overLimit, rate, years, cashNeed, cashShort: Math.max(0, cashNeed - Math.max(0, eqWon)), short: Math.max(0, need - loan), total: out.reduce((a, x) => a + x.amount, 0) };
}
const photoRef = (id) => cloud.db && cloud.ref().collection("photos").doc(id);
const photoCache = /* @__PURE__ */ new Map();
const deleteWatchPhoto = (id) => {
  photoCache.delete(id);
  const r = photoRef(id);
  if (r) r.delete().catch(() => {
  });
};
function PhotoViewer({ srcs, fallbacks, index, onIndex, onClose, label = "사진", caption, extra }) {
  const n = srcs.length;
  const go = (d) => {
    if (n > 1) onIndex((index + d + n) % n);
  };
  const touchX = useRef(null);
  const [fails, setFails] = useState(0);
  useEffect(() => {
    setFails(0);
  }, [index, srcs[index]]);
  const alt = fallbacks && fallbacks[index] && fallbacks[index] !== srcs[index] ? fallbacks[index] : null;
  const src = fails === 0 ? srcs[index] : fails === 1 && alt ? alt : null;
  const broken = fails > 0 && !src;
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, n]);
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `${label} 크게 보기`,
      onClick: onClose,
      onTouchStart: (e) => {
        touchX.current = e.touches[0].clientX;
      },
      onTouchEnd: (e) => {
        const s = touchX.current;
        touchX.current = null;
        if (s == null) return;
        const dx = e.changedTouches[0].clientX - s;
        if (Math.abs(dx) >= 40) go(dx < 0 ? 1 : -1);
      },
      className: "fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
    },
    src ? /* @__PURE__ */ React.createElement("img", { key: src, src, alt: `${label} ${index + 1}/${n}`, referrerPolicy: "no-referrer", onError: () => setFails((f) => f + 1), className: "max-w-full max-h-full rounded-lg" }) : /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-white/80" }, src === null || broken ? "사진을 불러오지 못했어요" : "불러오는 중…"),
    caption && /* @__PURE__ */ React.createElement("div", { className: "absolute top-3 left-1/2 -translate-x-1/2 max-w-[90%] truncate px-3 py-1 rounded-full bg-black/60 text-white text-[12px]" }, caption),
    extra && /* @__PURE__ */ React.createElement("div", { onClick: (e) => e.stopPropagation(), className: "absolute left-1/2 -translate-x-1/2 max-w-[94vw] cursor-default", style: { bottom: "calc(56px + env(safe-area-inset-bottom))" } }, extra),
    n > 1 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        "aria-label": "이전 사진",
        onClick: (e) => {
          e.stopPropagation();
          go(-1);
        },
        className: "absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 hover:bg-white/90 text-[#0A0A0A] text-[30px] leading-none flex items-center justify-center cursor-pointer"
      },
      "‹"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        "aria-label": "다음 사진",
        onClick: (e) => {
          e.stopPropagation();
          go(1);
        },
        className: "absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 hover:bg-white/90 text-[#0A0A0A] text-[30px] leading-none flex items-center justify-center cursor-pointer"
      },
      "›"
    ), /* @__PURE__ */ React.createElement("div", { className: "absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-[13px] font-semibold", style: { bottom: "calc(16px + env(safe-area-inset-bottom))", fontVariantNumeric: "tabular-nums" }, "aria-live": "polite" }, index + 1, " / ", n))
  );
}
function WatchPhotos({ it, onChange }) {
  const ids = it.photos || [];
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [big, setBig] = useState(null);
  const n = ids.length;
  useEffect(() => {
    if (big != null && big >= n) setBig(n ? n - 1 : null);
  }, [n]);
  useEffect(() => {
    let stop = false;
    ids.forEach((id) => {
      if (photoCache.has(id)) {
        setUrls((u) => ({ ...u, [id]: photoCache.get(id) }));
        return;
      }
      const r = photoRef(id);
      if (!r) return;
      r.get().then((d) => {
        const v = d.exists && d.data().data;
        if (v) photoCache.set(id, v);
        if (!stop) setUrls((u) => ({ ...u, [id]: v || null }));
      }).catch(() => {
      });
    });
    return () => {
      stop = true;
    };
  }, [ids.join(",")]);
  const add = async (files) => {
    if (!cloud.db || !cloud.user) {
      setErr("로그인해야 사진을 올릴 수 있어요");
      return;
    }
    setBusy(true);
    setErr("");
    const added = [];
    try {
      for (const file of Array.from(files || []).slice(0, 10)) {
        let data = await shrinkImage(file, 1280, 0.8);
        if (data.length > 88e4) data = await shrinkImage(file, 960, 0.7);
        const id = uid();
        await photoRef(id).set({ data, listingId: it.id, at: Date.now(), by: cloud.user.email || "" });
        photoCache.set(id, data);
        setUrls((u) => ({ ...u, [id]: data }));
        added.push(id);
      }
    } catch (e) {
      setErr(`사진을 올리지 못했어요 — ${String(e && e.message || e).slice(0, 80)}`);
    } finally {
      if (added.length) onChange([...store.get(WATCH_KEY, []).find((x) => x.id === it.id)?.photos || [], ...added]);
      setBusy(false);
    }
  };
  const del = (id) => {
    if (!window.confirm("이 사진을 지울까요?")) return;
    deleteWatchPhoto(id);
    onChange(ids.filter((x) => x !== id));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, ids.map((id, idx) => /* @__PURE__ */ React.createElement("div", { key: id, className: "relative w-16 h-16 rounded-lg overflow-hidden bg-[#F0F0F0]" }, urls[id] ? /* @__PURE__ */ React.createElement("button", { onClick: () => setBig(idx), "aria-label": `사진 ${idx + 1} 크게 보기`, className: "w-full h-full" }, /* @__PURE__ */ React.createElement("img", { src: urls[id], alt: "매물 사진", className: "w-full h-full object-cover" })) : /* @__PURE__ */ React.createElement("div", { className: "w-full h-full flex items-center justify-center text-[10px] text-[#6B6B6B]" }, urls[id] === null ? "사진 없음" : "…"), /* @__PURE__ */ React.createElement("button", { onClick: () => del(id), "aria-label": "사진 지우기", className: "absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-none" }, "×"))), /* @__PURE__ */ React.createElement("label", { className: `w-16 h-16 rounded-lg border border-dashed border-[#D4D4D4] flex flex-col items-center justify-center text-[11px] font-semibold text-[#525252] cursor-pointer ${busy ? "opacity-40 pointer-events-none" : ""}` }, busy ? "올리는 중…" : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), "사진"), /* @__PURE__ */ React.createElement("input", { type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: (e) => {
    const f = e.target.files;
    add(f).finally(() => {
      e.target.value = "";
    });
  } }))), err && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#8A5A00]" }, err), big != null && ids[big] && /* @__PURE__ */ React.createElement(PhotoViewer, { srcs: ids.map((id) => urls[id]), index: big, onIndex: setBig, onClose: () => setBig(null), label: "매물 사진" }));
}
const readDataUrl = (file) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.onerror = () => rej(new Error("파일을 읽지 못했어요"));
  fr.readAsDataURL(file);
});
function WatchlistTab({ hh, mapKey, privacy }) {
  const [items, setItems] = usePersist(WATCH_KEY, []);
  const [rank, setRank] = usePersist("realty-watch-rank-v1", []);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tabs, setTabs] = useState({});
  const setTab = (id, k) => setTabs((t) => {
    const n = { ...t };
    if (k) n[id] = k;
    else delete n[id];
    return n;
  });
  const [busy, setBusy] = useState({});
  const [errs, setErrs] = useState({});
  const [sel, setSel] = useState(null);
  const patchItem = (id, p) => setKey(WATCH_KEY, store.get(WATCH_KEY, []).map((x) => x.id === id ? { ...x, ...p, u: Date.now() } : x));
  const reviewContext = () => {
    const c = buildAdvisorContext({ hh, theme: "realty" });
    if (c && c.realty) {
      const { watchlist, target, maxLoan, bindingConstraint, requiredCash, cashGap, monthsToGoal, financing, ...keep } = c.realty;
      c.realty = keep;
    }
    return c;
  };
  const analyze = async (it) => {
    setBusy((b) => ({ ...b, [it.id]: true }));
    setErrs((e) => ({ ...e, [it.id]: "" }));
    try {
      const { review, lat, lng, ...rest } = it;
      const fc = watchFixedCosts(it, hh);
      const listing = { ...rest, financePlan: {
        loanUse: it.loanUse || "받음",
        loanWon: fc.loan,
        loanLimitWon: fc.maxLoan,
        overLimit: fc.overLimit,
        ratePct: fc.rate,
        years: it.dealType === "매매" ? fc.years : void 0,
        cashNeedWon: fc.cashNeed,
        cashShortWon: fc.cashShort,
        monthlyFixedWon: fc.total,
        monthlyBreakdown: fc.items.map((f) => `${f.memo.split(" · ")[0]} ${f.amount}원`)
      } };
      const r = await withTimeout(authFetch("/api/listing-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listing, context: reviewContext() }) }), 65e3, "분석이 1분을 넘겼어요 — 다시 시도해 주세요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.review) throw new Error(j.message || `분석 실패 (${r.status})`);
      patchItem(it.id, { review: j.review });
    } catch (e) {
      setErrs((x) => ({ ...x, [it.id]: String(e && e.message || e) }));
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[it.id];
        return n;
      });
    }
  };
  const locate = async (it) => {
    if (!it.addr) return;
    if (mapKey) await loadNaver(mapKey).catch(() => {
    });
    const c = await geocodeAddr(it.addr);
    if (c) patchItem(it.id, { lat: c.lat, lng: c.lng, approx: !!c.approx, pinned: false, geoV: 2 });
  };
  useEffect(() => {
    let stop = false;
    (async () => {
      for (const it of store.get(WATCH_KEY, [])) {
        if (stop) return;
        if (it.addr && !it.pinned && it.geoV !== 2) await locate(it);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);
  const [docBusy, setDocBusy] = useState({});
  const setDocErr = (id, m) => setErrs((e) => ({ ...e, [id]: m }));
  const fetchBuilding = async (it) => {
    if (!it.addr) {
      setDocErr(it.id, "주소가 없어요 — 편집에서 동·번지까지 넣어 주세요");
      return;
    }
    setDocBusy((b) => ({ ...b, [it.id]: "building" }));
    setDocErr(it.id, "");
    try {
      const r = await withTimeout(authFetch("/api/listing-building", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ addr: it.addr }) }), 3e4, "건축물대장 응답이 늦어요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || `건축물대장 조회 실패 (${r.status})`);
      if (!j.items || !j.items.length) throw new Error("그 번지에 등록된 건축물대장이 없어요 — 주소의 번지가 맞는지 확인해 주세요");
      const building = { items: j.items, at: (/* @__PURE__ */ new Date()).toISOString() };
      const b0 = j.items[0], year = Number(String(b0.approvalDate).slice(0, 4));
      patchItem(it.id, { building, ...year > 1900 && !it.built ? { built: year } : {} });
      analyze({ ...it, building });
    } catch (e) {
      setDocErr(it.id, String(e && e.message || e));
    } finally {
      setDocBusy((b) => {
        const n = { ...b };
        delete n[it.id];
        return n;
      });
    }
  };
  const fetchMarket = async (it) => {
    if (!it.addr) {
      setDocErr(it.id, "주소가 없어요 — 편집에서 주소(동·번지)를 넣어 주세요");
      return;
    }
    setDocBusy((b) => ({ ...b, [it.id]: "market" }));
    setDocErr(it.id, "");
    try {
      const r = await withTimeout(authFetch("/api/listing-market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ addr: it.addr, area: it.area, bldg: it.bldg }) }), 3e4, "실거래 조회 응답이 늦어요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || `실거래 조회 실패 (${r.status})`);
      if (j.note) throw new Error(j.note);
      const market = { ...j, at: (/* @__PURE__ */ new Date()).toISOString() };
      patchItem(it.id, { market, ...j.estimateWon && !(it.marketPrice > 0) ? { marketPrice: j.estimateWon } : {} });
    } catch (e) {
      setDocErr(it.id, String(e && e.message || e));
    } finally {
      setDocBusy((b) => {
        const n = { ...b };
        delete n[it.id];
        return n;
      });
    }
  };
  const uploadRegistry = async (it, file) => {
    if (!file) return;
    setDocBusy((b) => ({ ...b, [it.id]: "registry" }));
    setDocErr(it.id, "");
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (isPdf && file.size > 6 * 1024 * 1024) throw new Error("PDF가 6MB를 넘어요 — 필요한 쪽만 올려 주세요");
      const data = isPdf ? await readDataUrl(file) : await shrinkImage(file);
      const r = await withTimeout(authFetch("/api/listing-registry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: data }) }), 65e3, "등기부 판독이 1분을 넘겼어요 — 다시 시도해 주세요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.registry) throw new Error(j.message || `등기부 판독 실패 (${r.status})`);
      const reg = j.registry;
      const patch = { registry: reg, ...reg.activeMortgageTotal > 0 ? { seniorDebt: reg.activeMortgageTotal } : {}, trust: reg.trust ? "있음" : "없음" };
      patchItem(it.id, patch);
      analyze({ ...it, ...patch });
    } catch (e) {
      setDocErr(it.id, String(e && e.message || e));
    } finally {
      setDocBusy((b) => {
        const n = { ...b };
        delete n[it.id];
        return n;
      });
    }
  };
  const saveNew = (out) => {
    const it = { id: uid(), at: Date.now(), ...out };
    setKey(WATCH_KEY, [...store.get(WATCH_KEY, []), it]);
    setAdding(false);
    locate(it);
    analyze(it);
  };
  const saveEdit = (out) => {
    const it = { ...items.find((x) => x.id === editId), ...out };
    patchItem(editId, out);
    setEditId(null);
    if (out.addr) locate(it);
    analyze(it);
    if (!it.confirmed) return;
    const all = store.get("ledger-fixed-v1", []), old = all.filter((f) => String(f.id).startsWith("watch-"));
    const nx = /* @__PURE__ */ new Date();
    nx.setDate(1);
    nx.setMonth(nx.getMonth() + 1);
    const from = old[0] && old[0].from || ymKey(nx);
    setKey("ledger-fixed-v1", [...all.filter((f) => !String(f.id).startsWith("watch-")), ...watchFixedCosts(it, hh).items.map((f) => {
      const o = old.find((x) => x.id === f.id);
      return { ...f, at: o && o.at || Date.now(), u: Date.now(), from: o && o.from || from };
    })]);
  };
  const confirmWatch = (it) => {
    const on = !it.confirmed;
    setKey(WATCH_KEY, store.get(WATCH_KEY, []).map((x) => ({ ...x, confirmed: on && x.id === it.id, u: x.confirmed || x.id === it.id ? Date.now() : x.u })));
    const fixed = store.get("ledger-fixed-v1", []).filter((f) => !String(f.id).startsWith("watch-"));
    if (!on) {
      setKey("ledger-fixed-v1", fixed);
      return;
    }
    const fc = watchFixedCosts(it, hh);
    const next = /* @__PURE__ */ new Date();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    setKey("ledger-fixed-v1", [...fixed, ...fc.items.map((f) => ({ ...f, at: Date.now(), from: ymKey(next) }))]);
    applyAdvisorAction({ name: "set_target", args: { dealType: it.dealType, price: it.price, rent: it.rent, area: it.area, name: it.title || it.addr } }, { hh, setHh: (patch) => {
      const cur = { ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) };
      setKey("household-inputs-v2", { ...cur, ...patch });
    } });
    alert(`'${it.title || it.addr}'을(를) 확정했어요. 가계부 고정비에 월 ${won(fc.total)}을 넣었어요.
${fc.items.map((f) => `· ${f.memo.split(" · ")[0]} ${won(f.amount)}`).join("\n")}${fc.short > 0 ? `

⚠️ 자기자본과 대출 한도를 합쳐도 ${won(fc.short)}이 부족해요.` : ""}
다음 달(${ymKey(next)})부터 가계부에 매달 기입돼요. 진단 목표도 이 매물로 바꿨어요.`);
  };
  const remove = (it) => {
    if (!window.confirm(`'${it.title || it.addr}'을(를) 관심 매물에서 지울까요?`)) return;
    if (it.confirmed) confirmWatch(it);
    if (rankOf(rank, it.id)) setRank(withRank(rank, it.id, 0));
    setKey(WATCH_KEY, store.get(WATCH_KEY, []).filter((x) => x.id !== it.id));
    (it.photos || []).forEach(deleteWatchPhoto);
  };
  const points = items.filter((i) => i.lat && i.lng).map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, title: i.title || i.addr, desc: watchPriceText(i) }));
  const rk = (it) => rankOf(rank, it.id) || 999;
  const sorted = [...items].sort((a, b) => (b.confirmed ? 1 : 0) - (a.confirmed ? 1 : 0) || rk(a) - rk(b) || (b.at || 0) - (a.at || 0));
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "찾아 둔 매물", title: "관심 매물", accent: "#0A0A0A" }), !adding && /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setAdding(true);
    setEditId(null);
  }, className: "mb-4 h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold inline-flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " 매물 추가")), adding && /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(WatchForm, { onSave: saveNew, onCancel: () => setAdding(false) })), items.length === 0 && !adding && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "네이버 부동산 등에서 찾은 매물 링크와 정보를 모아 두면, 상담사가 ", /* @__PURE__ */ React.createElement("b", null, "위험도"), "(전세가율·근저당·보증보험·위반건축물)와 ", /* @__PURE__ */ React.createElement("b", null, "우리 부부 적합도"), "(자기자본·대출·월 부담)를 바로 판단해요. 오른쪽 위 [매물 추가]로 시작하세요.")), points.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(MapPanel, { mapKey, points, height: 320, focus: sel })), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, sorted.map((it) => editId === it.id ? /* @__PURE__ */ React.createElement("div", { key: it.id, className: "lg:col-span-2" }, /* @__PURE__ */ React.createElement(WatchForm, { initial: it, onSave: saveEdit, onCancel: () => setEditId(null) })) : /* @__PURE__ */ React.createElement(Card, { key: it.id, className: "flex flex-col" }, (() => {
    const fc = watchFixedCosts(it, hh), tab = tabs[it.id] || "info";
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-[#0A0A0A]/10 font-semibold" }, it.dealType), it.bldg && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] px-2 py-0.5 rounded-full bg-[#F0F0F0] text-[#525252] font-semibold" }, it.bldg), /* @__PURE__ */ React.createElement("span", { className: "text-[16px] font-bold truncate" }, it.title || it.addr), it.confirmed && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "✓ 확정"), rankOf(rank, it.id) > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-[#0A0A0A] bg-[#FFF4D6] px-2 py-0.5 rounded-full" }, rankOf(rank, it.id), "순위")), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5 break-keep" }, [it.addr, pyeongText(it.area), it.floor, it.built ? `${it.built}년` : ""].filter(Boolean).join(" · ")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-3 mt-1" }, it.link && /* @__PURE__ */ React.createElement("a", { href: safeUrl(it.link), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "매물 보기"), it.lat && it.lng ? /* @__PURE__ */ React.createElement("button", { onClick: () => setSel({ id: it.id, lat: it.lat, lng: it.lng, title: it.title || it.addr, desc: watchPriceText(it), at: Date.now() }), className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "지도에서 보기") : it.addr && /* @__PURE__ */ React.createElement("button", { onClick: () => locate(it), className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "위치 찾기")), it.lat && it.approx && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A5A00] mt-0.5" }, "📍 지도는 대략 위치(동·구 중심)예요. ", /* @__PURE__ */ React.createElement("button", { onClick: () => locate(it), className: "font-semibold underline underline-offset-2" }, "다시 찾기"), " 계속 안 맞으면 편집에서 주소에 번지까지 넣어 주세요.")), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, watchPriceText(it))), it.maintenance > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "관리비 ", won(it.maintenance)))), it.review ? /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-1.5 mb-1" }, /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-bold px-2 py-0.5 rounded-full ${riskTone(it.review.risk.level)}` }, "위험도 ", it.review.risk.level, it.review.risk.score != null ? ` · ${it.review.risk.score}` : ""), /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-bold px-2 py-0.5 rounded-full ${fitTone(it.review.fit.level)}` }, "적합도 ", it.review.fit.level, it.review.fit.score != null ? ` · ${it.review.fit.score}` : ""), fc.total > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#525252]" }, "월 고정비 ", /* @__PURE__ */ React.createElement("b", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, won(fc.total))), fc.overLimit ? " ⚠️" : "")), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#3D3D3D] leading-relaxed" }, it.review.summary)) : busy[it.id] ? null : /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[12px] text-[#6B6B6B]" }, "아직 분석 전이에요.", fc.total > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, " 월 고정비 ", /* @__PURE__ */ React.createElement("b", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, won(fc.total))))), busy[it.id] && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[13px] text-[#525252]" }, "상담사가 판단하는 중… (실거래 시세 조회 포함 30초 안팎)"), errs[it.id] && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#8A5A00]" }, errs[it.id]), /* @__PURE__ */ React.createElement("div", { role: "tablist", className: "mt-3 flex gap-1 border-b border-[#EDEDED]" }, [["info", "매물 정보"], ["review", "판단"]].map(([k, l]) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: k,
        role: "tab",
        "aria-selected": tab === k,
        onClick: () => setTab(it.id, tab === k ? "none" : k),
        className: `h-9 px-3 -mb-px text-[13px] font-semibold border-b-2 ${tab === k ? "border-[#0A0A0A] text-[#0A0A0A]" : "border-transparent text-[#6B6B6B]"}`
      },
      l
    ))), tab === "review" && (it.review ? /* @__PURE__ */ React.createElement("div", { className: "mt-3 space-y-3 text-[13px] leading-relaxed" }, it.review.risk.items.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold mb-1" }, "위험 요인"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-1" }, it.review.risk.items.map((x, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex gap-2" }, /* @__PURE__ */ React.createElement("span", { className: `mt-1 w-2 h-2 rounded-full shrink-0 ${x.severity === "high" ? "bg-[#B42318]" : x.severity === "mid" ? "bg-[#D99A00]" : "bg-[#1F5D46]"}` }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, x.title), " — ", x.detail))))), it.review.fit.reasons.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold mb-1" }, "우리에게 맞는지"), /* @__PURE__ */ React.createElement("ul", { className: "list-disc pl-4 space-y-0.5" }, it.review.fit.reasons.map((x, i) => /* @__PURE__ */ React.createElement("li", { key: i }, x)))), it.review.monthly && it.review.monthly.breakdown && /* @__PURE__ */ React.createElement("div", { className: "text-[#525252]" }, "월 부담: ", it.review.monthly.breakdown), it.review.checks.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold mb-1" }, "계약 전 확인"), /* @__PURE__ */ React.createElement("ul", { className: "list-disc pl-4 space-y-0.5" }, it.review.checks.map((x, i) => /* @__PURE__ */ React.createElement("li", { key: i }, x)))), it.review.questions.length > 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "font-bold mb-1" }, "중개사에게 물어볼 것"), /* @__PURE__ */ React.createElement("ul", { className: "list-disc pl-4 space-y-0.5" }, it.review.questions.map((x, i) => /* @__PURE__ */ React.createElement("li", { key: i }, x)))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, String(it.review.at || "").slice(0, 10), " 분석 · 참고용이에요. 계약 전에 등기부등본·건축물대장을 직접 확인해요.")) : /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[12px] text-[#6B6B6B]" }, "아직 판단 결과가 없어요. 아래 [분석]을 눌러 주세요.")), tab === "info" && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[13px] leading-relaxed" }, /* @__PURE__ */ React.createElement("dl", { className: "grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5" }, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "가격"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, watchPriceText(it)), it.maintenance > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, " · 관리비 ", won(it.maintenance))), it.area > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "면적"), /* @__PURE__ */ React.createElement("dd", null, "전용 ", pyeongText(it.area))), (it.floor || it.built > 0) && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "층·준공"), /* @__PURE__ */ React.createElement("dd", null, [it.floor, it.built ? `${it.built}년` : ""].filter(Boolean).join(" · "))), it.rooms && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "방/욕실"), /* @__PURE__ */ React.createElement("dd", null, it.rooms)), it.moveIn && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "입주 가능일"), /* @__PURE__ */ React.createElement("dd", null, it.moveIn)), it.options && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "옵션·특이사항"), /* @__PURE__ */ React.createElement("dd", { className: "whitespace-pre-wrap" }, it.options)), it.broker && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "중개사무소"), /* @__PURE__ */ React.createElement("dd", null, it.broker)), it.memo && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "메모"), /* @__PURE__ */ React.createElement("dd", { className: "whitespace-pre-wrap" }, it.memo)), /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "권리·안전"), /* @__PURE__ */ React.createElement("dd", null, [it.seniorDebt > 0 ? `선순위 근저당 ${won(it.seniorDebt)}` : "", `보증보험 ${it.guarantee || "모름"}`, `위반건축물 ${it.violation || "모름"}`, `신탁 ${it.trust || "모름"}`].filter(Boolean).join(" · ")), it.marketPrice > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "매매 시세"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonShort(it.marketPrice)), " (추정)")), /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "자금 계획"), /* @__PURE__ */ React.createElement("dd", null, it.loanUse === "안 받음" || !(fc.loan > 0) ? "대출 없이 현금" : `${it.dealType === "매매" ? "주담대" : "보증금 대출"} ${won(fc.loan)} · ${fc.rate}%${it.dealType === "매매" ? ` · ${fc.years}년` : ""}`, fc.overLimit && /* @__PURE__ */ React.createElement("span", { className: "text-[#B42318] font-semibold" }, " · ⚠️ 예상 한도 ", won(fc.maxLoan), "보다 많아요"), fc.short > 0 && !fc.overLimit && /* @__PURE__ */ React.createElement("span", { className: "text-[#8A5A00]" }, " · 자기자본과 대출 한도를 합쳐도 ", won(fc.short), " 부족")), fc.total > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("dt", { className: "text-[#6B6B6B]" }, "월 고정비"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("b", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, won(fc.total))), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "(", fc.items.map((f) => `${f.memo.split(" · ")[0]} ${won(f.amount)}`).join(" + "), ")"), it.confirmed && /* @__PURE__ */ React.createElement("span", { className: "text-[#1F5D46] font-semibold" }, " · 가계부에 반영됨"))))), tab === "info" && /* @__PURE__ */ React.createElement("div", { className: "mt-3 pt-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-bold text-[#6B6B6B] mr-auto" }, "서류로 확인"), /* @__PURE__ */ React.createElement("button", { onClick: () => fetchMarket(it), disabled: !!docBusy[it.id], className: "h-8 px-3 rounded-full bg-[#F0F0F0] text-[12px] font-semibold text-[#525252] disabled:opacity-40" }, docBusy[it.id] === "market" ? "시세 조회 중…" : it.market ? "매매 시세 다시 조회" : "매매 시세 조회"), /* @__PURE__ */ React.createElement("button", { onClick: () => fetchBuilding(it), disabled: !!docBusy[it.id], className: "h-8 px-3 rounded-full bg-[#F0F0F0] text-[12px] font-semibold text-[#525252] disabled:opacity-40" }, docBusy[it.id] === "building" ? "조회 중…" : it.building ? "건축물대장 다시 조회" : "건축물대장 조회"), /* @__PURE__ */ React.createElement("label", { className: `h-8 px-3 rounded-full bg-[#F0F0F0] text-[12px] font-semibold text-[#525252] inline-flex items-center cursor-pointer ${docBusy[it.id] ? "opacity-40 pointer-events-none" : ""}` }, docBusy[it.id] === "registry" ? "등기부 읽는 중…" : it.registry ? "등기부 다시 올리기" : "등기부 올리기 (PDF·캡처)", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "application/pdf,image/*", className: "hidden", onChange: (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      uploadRegistry(it, f);
    } }))), it.market && (() => {
      const m = it.market;
      const est = m.estimateWon || it.marketPrice;
      const ratio = it.dealType !== "매매" && est > 0 && it.price > 0 ? it.price / est : null;
      return /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "매매 시세"), " · ", est ? /* @__PURE__ */ React.createElement("b", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonShort(est))) : "추정 불가", " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "(", m.basis, m.perM2Won ? ` · ㎡당 ${won(m.perM2Won)}` : "", ")"), ratio != null && /* @__PURE__ */ React.createElement("span", { className: `ml-1 font-bold ${ratio > 0.8 ? "text-[#B42318]" : ratio > 0.7 ? "text-[#8A5A00]" : "text-[#1F5D46]"}` }, "· 전세가율(시세 대비 보증금) ", Math.round(ratio * 100), "%", ratio > 0.8 ? " — 80%를 넘어 위험" : ""), m.tier !== "same" && /* @__PURE__ */ React.createElement("div", { className: "text-[#6B6B6B]" }, "같은 건물 거래가 없어 ", m.tier === "dong" ? "같은 동" : "같은 시군구", "의 비슷한 면적으로 추정했어요. 참고용이에요."), (m.deals || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[#6B6B6B]" }, m.deals.slice(0, 3).map((d) => `${d.complex || d.addr} ${pyeongText(d.area)} ${wonShort(d.price)}(${d.date})`).join(" · ")));
    })(), it.building && it.building.items && it.building.items[0] && (() => {
      const b = it.building.items[0];
      const nonHome = b.mainUse && !/주택|아파트|주거|기숙사/.test(b.mainUse + b.etcUse);
      return /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "건축물대장"), " · ", b.name, " · ", /* @__PURE__ */ React.createElement("span", { className: nonHome ? "text-[#B42318] font-bold" : "" }, b.mainUse, b.etcUse ? `(${b.etcUse})` : ""), " · 사용승인 ", b.approvalDate, " · ", b.floors, b.households ? ` · ${b.households}세대` : "", b.units ? ` · ${b.units}호` : "", b.parking ? ` · 주차 ${b.parking}대` : "", b.elevators ? ` · 승강기 ${b.elevators}` : "", nonHome && /* @__PURE__ */ React.createElement("div", { className: "text-[#B42318] font-semibold" }, "⚠️ 주용도가 주택이 아니에요. 근린생활시설·업무시설은 전세대출·보증보험이 안 되거나, 주거용으로 불법 개조한 집일 수 있어요."), it.building.items.length > 1 && /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, " · 같은 번지 건물 ", it.building.items.length, "동"));
    })(), it.registry && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "등기부"), " · 소유자 ", (it.registry.owners || []).map((o) => `${o.name}${o.share ? `(${o.share})` : ""}${o.since ? ` ${o.since} ${o.cause || ""}` : ""}`).join(", ") || "확인 필요", " · ", "효력 있는 근저당 ", /* @__PURE__ */ React.createElement("b", null, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, it.registry.activeMortgageTotal > 0 ? won(it.registry.activeMortgageTotal) : "없음")), it.registry.trust && /* @__PURE__ */ React.createElement("span", { className: "ml-1 text-[11px] font-bold text-white bg-[#B42318] rounded-full px-1.5 py-0.5" }, "신탁"), it.registry.seizure && /* @__PURE__ */ React.createElement("span", { className: "ml-1 text-[11px] font-bold text-white bg-[#B42318] rounded-full px-1.5 py-0.5" }, "압류·가압류"), (it.registry.gap || []).filter((g) => g.active && g.type !== "신탁").length > 0 && /* @__PURE__ */ React.createElement("div", null, "갑구: ", (it.registry.gap || []).filter((g) => g.active).map((g) => `${g.type}${g.amount ? ` ${won(g.amount)}` : ""}${g.date ? ` (${g.date})` : ""}`).join(" · ")), (it.registry.eul || []).filter((g) => g.active).length > 0 && /* @__PURE__ */ React.createElement("div", null, "을구: ", (it.registry.eul || []).filter((g) => g.active).map((g) => `${g.type} ${g.holder || ""}${g.amount ? ` ${won(g.amount)}` : ""}`).join(" · ")), it.registry.summary && /* @__PURE__ */ React.createElement("div", { className: "text-[#525252]" }, it.registry.summary), (it.registry.warnings || []).map((w, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "text-[#8A5A00]" }, "⚠️ ", w)), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, it.registry.issueDate ? `${it.registry.issueDate} 발급본 · ` : "", "판독은 참고용이에요. 계약 직전과 잔금일에 다시 떼서 확인해요.")), !it.building && !it.registry && !it.market && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[11px] text-[#6B6B6B]" }, "매매 시세는 주소로 국토부 실거래를 찾고, 건축물대장은 주소로 자동 조회해요. 등기부는 인터넷등기소(iros.go.kr) 열람본 PDF를 올리면 권리관계를 읽어 위험도에 반영해요. 전입세대열람(그 집에 전입한 세대 확인)은 소유자, 임차인, 매매·임대차 계약자, 금융기관 등이 주민센터나 정부24에서 볼 수 있어요. 계약 전이면 집주인 동의를 받아야 하고, 계약서를 쓴 뒤에는 임차인이 혼자 발급받을 수 있어요. 소액임차인 최우선변제(경매 때 가장 먼저 돌려받는 몫)는 서울이 보증금 1억6,500만원 이하일 때 5,500만원까지예요. 과밀억제권역·세종·용인·화성·김포는 1억4,500만원 이하일 때 4,800만원이에요(과천은 과밀억제권역). 기준은 선순위 담보 설정일이에요.")), tab === "info" && /* @__PURE__ */ React.createElement(WatchPhotos, { it, onChange: (ids) => patchItem(it.id, { photos: ids }) }), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("button", { onClick: () => confirmWatch(it), className: `h-9 px-3.5 rounded-lg text-[13px] font-semibold ${it.confirmed ? "bg-[#F0F0F0] text-[#6B6B6B]" : "bg-[#0A0A0A] text-white"}` }, it.confirmed ? "확정 해제" : "확정"), /* @__PURE__ */ React.createElement("button", { onClick: () => analyze(it), disabled: !!busy[it.id], className: "h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-[#F0F0F0] text-[#3D3D3D] disabled:opacity-40" }, busy[it.id] ? "분석 중…" : it.review ? "다시 분석" : "분석"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setEditId(it.id);
      setAdding(false);
    }, className: "h-9 px-3.5 rounded-lg text-[13px] font-semibold bg-[#F0F0F0] text-[#3D3D3D]" }, "편집"), /* @__PURE__ */ React.createElement("div", { className: "ml-auto flex items-center gap-3" }, /* @__PURE__ */ React.createElement(RankSelect, { order: rank, id: it.id, onChange: (k) => setRank(withRank(rank, it.id, k)), label: `${it.title || it.addr} 순위` }), /* @__PURE__ */ React.createElement("button", { onClick: () => remove(it), className: "text-[13px] font-semibold text-[#B4533A] underline underline-offset-4" }, "삭제"))));
  })())))));
}
function RealtyTheme({ mapKey, hh, setHh, setTheme, privacy }) {
  useDmRefNotes();
  const [tabRaw, setTab] = usePersist("realty-tab-v1", "diag");
  const TAB_MIGRATE = { loan: "diag", news: "strategy", cheongyak: "apply", public: "apply", longlease: "apply", realty: "diag", overview: "diag", guide: "strategy" };
  const tab = TAB_MIGRATE[tabRaw] || tabRaw;
  const [applySegRaw, setApplySeg] = usePersist("realty-apply-seg-v1", "cheongyak");
  const applySeg = applySegRaw === "lh" ? "cheongyak" : applySegRaw;
  const views = tab === "diag" ? ["diag", "loan"] : tab === "strategy" ? ["strategy", "news", "guide"] : [tab];
  const navTab = (id) => {
    if (id === "loan" || id === "diag") setTab("diag");
    else if (id === "news" || id === "guide") setTab("strategy");
    else if (id === "cheongyak") {
      setApplySeg("cheongyak");
      setTab("apply");
    } else setTab(id);
  };
  const [newsRegion, setNewsRegion] = usePersist("news-region-v1", "과천");
  const [bankData, setBankData] = usePersist("bankloan-data-v1", { items: BANK_LOANS, at: null });
  const [loanKind, setLoanKind] = usePersist("realty-loan-kind-v1", "mortgage");
  const { income1, income2, assets, monthlySave, firstTime, targetKey, rate, existingDebtMonthly, loanAmountCalc, loanRateCalc, loanYearsCalc, repayType } = hh;
  const setRate = (v) => setHh({ rate: v });
  const setLoanAmountCalc = (v) => setHh({ loanAmountCalc: v });
  const setLoanRateCalc = (v) => setHh({ loanRateCalc: v });
  const setLoanYearsCalc = (v) => setHh({ loanYearsCalc: v });
  const diag = computeDiagnosis({ income1, income2, assets, monthlySave, firstTime, targetKey, customTarget: hh.customTarget, rate, existingDebtMonthly, loanRateCalc });
  const { target, financing, dsrLoan, ltvLoan, tierCap, mortgageMaxLoan, maxLoan, bindingConstraint, requiredCash, gap, monthsToGoal, yearsToGoal } = diag;
  const income = income1 + income2;
  const incomeWon = income * 1e4;
  const netAnnual = estimateNetAnnual(income1 * 1e4) + estimateNetAnnual(income2 * 1e4);
  const netMonthly = netAnnual / 12;
  const SS = policy().specialSupply;
  const specialSupplyLimitMan = Math.floor(SS.incomeBase100[3] * (income1 > 0 && income2 > 0 ? SS.newlywedPct.dual : SS.newlywedPct.single) / 100 * 12 / 1e4);
  const incomeExceedsSpecialSupply = income > specialSupplyLimitMan;
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
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PhaseGauge, { themeId: "realty" }), /* @__PURE__ */ React.createElement(PillNav, { tabs: REALTY_TABS, tab, setTab }), tab === "diag" && /* @__PURE__ */ React.createElement(RealtyLinkedBar, { diag, hh, privacy }), tab === "apply" && /* @__PURE__ */ React.createElement(SegRow, { options: [["cheongyak", "🏢 청약 공고·캘린더"], ["check", "🧮 우리 자격·루트"], ["types", "📚 공공주택 유형"], ["longlease", "🏠 장기전세"]], value: applySeg, onChange: setApplySeg }), ["diag", "strategy", "loan", "plan"].some((v) => views.includes(v)) && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, views.includes("diag") && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "1단계", title: "우리 부부 정보", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "홈의 부부 정보와 실시간 연동"), /* @__PURE__ */ React.createElement("button", { onClick: goHomeEdit, className: "text-[13px] font-semibold underline underline-offset-4" }, "홈에서 수정")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-2" }, [[`${hh.label1 || "본인"} 연소득`, income1], [`${hh.label2 || "배우자"} 연소득`, income2], ["부부 현금 합계", assets], ["월 저축 가능액(입력값)", monthlySave], ["기존 대출 월 상환액", existingDebtMonthly]].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, l), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(v)))))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#E5E5E5] space-y-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] text-[#525252]" }, "부부 월소득 합산(세전, 연소득 ÷ 12)"), /* @__PURE__ */ React.createElement("span", { className: "text-xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, won(Math.round(incomeWon / 12))))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] text-[#525252]" }, "부부 월소득 합산(세후, 추정)"), /* @__PURE__ */ React.createElement("span", { className: "text-xl font-bold text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, won(Math.round(netMonthly)))))), incomeExceedsSpecialSupply && /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex gap-2 text-[14px] text-[#0A0A0A] bg-[#0A0A0A]/5 rounded-xl p-3" }, /* @__PURE__ */ React.createElement(Icon, { name: "info", size: 16, className: "mt-0.5 shrink-0" }), /* @__PURE__ */ React.createElement("span", null, "부부 연소득 합산이 신혼특공 소득 기준(3인 가구 기준 ", income1 > 0 && income2 > 0 ? `맞벌이 ${SS.newlywedPct.dual}%` : `${SS.newlywedPct.single}%`, ", 연 약 ", manWon(specialSupplyLimitMan), ")보다 ", manWon(income - specialSupplyLimitMan), " 많아요. 특공 추첨 물량(소득을 안 보고 추첨하는 몫, 세대 부동산 가액 기준만 봐요)이나 일반공급을 중심으로 봐요.")))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "2단계", title: "목표 직접 입력", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(CustomTargetCard, { hh, setHh })), /* @__PURE__ */ React.createElement("section", { style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "3단계", title: "진단 결과", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 bg-[#0A0A0A] text-white text-[15px] font-semibold" }, target.label), /* @__PURE__ */ React.createElement("div", { className: "px-5 divide-y divide-[#E5E5E5]" }, /* @__PURE__ */ React.createElement(Stat, { label: target.dealType === "월세" ? "보증금" : target.dealType === "전세" ? "전세 보증금" : "목표 가격", value: won(target.price), sub: target.rent > 0 ? `월세 ${won(target.rent)} — 매달 나가는 돈이라 실제 저축 여력은 월 저축에서 이만큼 빼서 보세요` : void 0 }), /* @__PURE__ */ React.createElement(Stat, { label: `최대 ${financing.loanLabel}(추정)`, value: won(maxLoan), sub: `한도를 정한 기준: ${{ LTV: "LTV(집값 대비 대출 비율)", "DSR(소득)": "DSR(연소득 대비 연간 상환액 비율)", "가격구간 대출한도": "하드캡(집값 구간별 최대 한도)" }[bindingConstraint] || bindingConstraint} · ${policy().loan.asOf}` }), /* @__PURE__ */ React.createElement(Stat, { label: financing.monthlyLabel, value: won(Math.round(financing.monthly)) }), /* @__PURE__ */ React.createElement(Stat, { label: "필요 자기자본(가격에서 대출을 뺀 금액)", value: won(requiredCash) }), /* @__PURE__ */ React.createElement(Stat, { label: "+ 부대비용 (추정)", value: won(diag.extra.total), sub: [diag.extra.tax > 0 && `취득세 ${wonShort(diag.extra.tax)}`, diag.extra.broker > 0 && `중개보수 ${wonShort(diag.extra.broker)}`, `이사 ${manWon(diag.extra.move / 1e4)}`].filter(Boolean).join(" · ") }), /* @__PURE__ */ React.createElement(Stat, { label: "− 쓸 수 있는 자기자본", value: won(diag.equity), sub: `부부 현금 ${manWon(assets)}에서 앞으로 나갈 결혼 비용 ${manWon(diag.wedding.reserve)}${lockedPensionMan() > 0 ? `과 연금저축·IRP ${manWon(lockedPensionMan())}(55세 전에 꺼내면 세금이 붙는 돈)` : ""}을 뺀 금액` }), /* @__PURE__ */ React.createElement(Stat, { label: "집 살 때 모자란 현금", value: gap > 0 ? won(gap) : "모자라지 않아요", tone: gap > 0 ? "warn" : "good" }), /* @__PURE__ */ React.createElement(Stat, { label: `입력한 월 저축(${manWon(monthlySave)})으로 달성까지`, value: gap > 0 ? `약 ${yearsToGoal}년 (${monthsToGoal}개월)` : "즉시 가능", tone: gap > 0 ? "warn" : "good" }), gap > 0 && /* @__PURE__ */ React.createElement(Stat, { label: diag.actualSave != null ? `가계부 실적(월 ${manWon(diag.actualSave)})으로 달성까지` : "가계부 실적 기준", value: diag.actualSave == null ? "지난달 기록부터 계산돼요" : diag.monthsToGoalActual ? `약 ${(diag.monthsToGoalActual / 12).toFixed(1)}년 (${diag.monthsToGoalActual}개월)` : "지금 속도로는 어려워요", tone: diag.monthsToGoalActual ? "warn" : void 0 })), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-3 border-t border-[#E5E5E5] text-[13px] leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "정책대출 판정 · "), financing.programs.map((p) => /* @__PURE__ */ React.createElement("span", { key: p.name, className: `inline-block mr-3 ${p.eligible ? "text-[#1F5D46] font-semibold" : "text-[#6B6B6B]"}` }, p.eligible ? "✓" : "✕", " ", p.name, /* @__PURE__ */ React.createElement("span", { className: "font-normal" }, " — ", p.reason)))), gap > 0 && /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 text-[14px] text-[#525252] leading-relaxed bg-[#FAFAFA] border-t border-[#E5E5E5]" }, "2025년 10월 규제 이후 주담대는 하드캡(집값 구간별 최대 한도)이 있어서, 소득이 높아도 더 빌릴 수 없어요.", target.isSale ? " 매매는 우리 돈 비중이 아주 커야 해서 청약을 함께 준비하길 권해요." : " 공공택지 청약은 분양가상한제 덕에 필요한 자기자본이 적어요(재건축은 상한제 없음). 다만 당첨 여부와 입주 시점을 알 수 없어요. 잔금대출은 입주 때 시세로 한도를 볼 수 있어서, 하드캡 구간이 올라가 한도가 더 줄 수 있어요(은행에 가격 기준 확인 필요).")))), views.includes("strategy") && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "경로 비교", title: "청약 · 매매 · 전세", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, STRATEGIES.map((s, i) => /* @__PURE__ */ React.createElement(Card, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, s.title), /* @__PURE__ */ React.createElement(ToneBadge, { tone: s.tone }, s.badge)), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, s.points.map((p, j) => /* @__PURE__ */ React.createElement("li", { key: j, className: "flex gap-2 text-[15px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, p)))))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "우리 조건 기준", title: "혜택·제도 활용 가능 여부", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4 text-[14px] text-[#525252] bg-[#F7F7F7] rounded-xl p-4 leading-relaxed" }, '과천은 가격 자체가 높아서 조건을 통과해도 "가격 상한"에 막히는 제도가 많아요. 실제로 열려 있는 것과 막히는 것을 구분했어요.'), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, BENEFITS.map((b, i) => /* @__PURE__ */ React.createElement(Card, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold" }, b.title), /* @__PURE__ */ React.createElement(ToneBadge, { tone: b.tone }, b.fit)), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-3" }, b.body), /* @__PURE__ */ React.createElement("a", { href: safeUrl(b.link), target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-[14px] font-semibold text-[#0A0A0A] underline decoration-[#0A0A0A] underline-offset-2" }, b.label, " ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 13 })))))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "청약 제도 대출 규제 변경", eyebrow: "제도 업데이트", title: "최신 제도·규제 뉴스" })), views.includes("loan") && /* @__PURE__ */ React.createElement("div", { style: { gridColumn: "1 / -1" } }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "대출계산기", title: "월 상환·한도 계산", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(SegRow, { options: [["mortgage", "🏠 주담대 (매매·청약)"], ["jeonse", "🔑 전세대출"]], value: loanKind, onChange: setLoanKind })), views.includes("loan") && loanKind === "jeonse" && /* @__PURE__ */ React.createElement(JeonseLoanCalc, { hh, setHh, target, privacy }), views.includes("loan") && loanKind !== "jeonse" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "계산 결과", title: "대출 한도 3단 필터", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, /* @__PURE__ */ React.createElement(FilterRow, { label: `① DSR ${Math.round(policy().loan.mortgage.dsr * 100)}%: 연소득의 ${Math.round(policy().loan.mortgage.dsr * 100)}%까지 원리금 상환`, value: won(dsrLoan), active: mortgageMaxLoan === dsrLoan }), /* @__PURE__ */ React.createElement(FilterRow, { label: `② LTV(집값 대비 대출 비율) ${firstTime ? `${Math.round(policy().loan.mortgage.ltvFirst * 100)}%·생애최초` : `${Math.round(policy().loan.mortgage.ltvRegular * 100)}%·규제지역 무주택`}`, value: won(ltvLoan), active: mortgageMaxLoan === ltvLoan }), /* @__PURE__ */ React.createElement(FilterRow, { label: "③ 하드캡: 집값 구간별 최대 한도(2025.10.16~)", value: won(tierCap), active: mortgageMaxLoan === tierCap })), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#E5E5E5] flex justify-between items-center" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "최종 대출 가능액(셋 중 가장 작은 값)", financing.dsrLoan == null ? /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B] font-normal" }, " · 목표 가격 ", wonShort(target.price), "짜리 집을 산다면") : ""), /* @__PURE__ */ React.createElement("span", { className: "text-2xl font-bold", style: { fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" } }, won(mortgageMaxLoan))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "입력값 조정", title: "조건 바꿔보기", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: "DSR 계산 금리(%, 스트레스 금리 포함)", value: rate, onChange: setRate, step: 0.1 }), /* @__PURE__ */ React.createElement(Toggle, { label: "생애최초 구입자", active: firstTime, onClick: () => setHh({ firstTime: !firstTime }), activeText: "예 (LTV 70%)", inactiveText: "아니오 (규제지역 LTV 40%)" })))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "직접 계산", title: "이자 계산기", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "대출금액(만원)", value: loanAmountCalc, onChange: setLoanAmountCalc }), /* @__PURE__ */ React.createElement(Field, { label: "금리(%)", value: loanRateCalc, onChange: setLoanRateCalc, step: 0.1 }), /* @__PURE__ */ React.createElement(Field, { label: "대출기간(년)", value: loanYearsCalc, onChange: setLoanYearsCalc }), /* @__PURE__ */ React.createElement(Toggle, { label: "상환방식", active: repayType === "equal_payment", onClick: () => setHh({ repayType: repayType === "equal_payment" ? "equal_principal" : "equal_payment" }), activeText: "원리금균등", inactiveText: "원금균등" })), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#E5E5E5]" }, /* @__PURE__ */ React.createElement(Stat, { label: repayType === "equal_payment" ? "매달 상환액(고정)" : "첫 달 상환액(이후 점점 감소)", value: won(Math.round(loanFirstMonthPay)) }), /* @__PURE__ */ React.createElement(Stat, { label: "총 이자", value: won(Math.round(loanTotalInterest)), tone: "warn" }), /* @__PURE__ */ React.createElement(Stat, { label: "총 상환액(원금+이자)", value: won(Math.round(loanTotalPay)) })), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[13px] text-[#6B6B6B] leading-relaxed" }, /* @__PURE__ */ React.createElement("b", null, "원리금균등"), "은 매달 같은 금액, ", /* @__PURE__ */ React.createElement("b", null, "원금균등"), "은 원금을 매달 동일하게 갚아 이자가 점점 줄어드는 대신 초반 상환액이 커요. 총 이자는 원금균등이 더 적어요.")))), tab === "plan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(RealtyPlanTab, { hh, diag, setTab: navTab, privacy }), /* @__PURE__ */ React.createElement(RealtyChecklist, null))), views.includes("loan") && loanKind !== "jeonse" && /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: bankData.at ? `${bankData.at.slice(0, 10)} 갱신 데이터` : "2026-07 기준 · 추정", title: "은행 주담대 상품 비교", accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(LiveUpdateBtn, { topic: "bankloans", onData: (j) => setBankData({ items: j.items, at: j.fetchedAt }) }))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, bankData.items.map((b) => {
    const mid = Math.round((b.rateMin + b.rateMax) / 2 * 10) / 10;
    const pay = (r) => {
      const i = r / 100 / 12, n = loanYearsCalc * 12, P = loanAmountCalc * 1e4;
      return n > 0 ? i > 0 ? P * i / (1 - Math.pow(1 + i, -n)) : P / n : 0;
    };
    const applied = loanRateCalc === mid;
    return /* @__PURE__ */ React.createElement(Card, { key: b.bank, className: "!p-4 h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, b.bank, " ", /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, b.product)), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5" }, b.rateType)), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[15px] font-bold" }, b.rateMin.toFixed(2), "~", b.rateMax.toFixed(2), "%"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5", style: { fontVariantNumeric: "tabular-nums" } }, "월 ", won(Math.round(pay(b.rateMin))), " ~ ", won(Math.round(pay(b.rateMax)))))), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#525252] mt-1.5 leading-relaxed" }, b.feature), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 mt-auto pt-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setHh({ loanRateCalc: mid }), className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${applied ? "bg-[#F0F0F0] text-[#6B6B6B]" : "bg-[#0A0A0A] text-white"}` }, applied ? "적용됨" : `평균 ${mid}% 계산기에 적용`), /* @__PURE__ */ React.createElement("a", { href: safeUrl(b.link), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "상품 안내")));
  })), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "월 상환액은 이자 계산기 조건(대출 ", manWon(loanAmountCalc), " · ", loanYearsCalc, "년 · 원리금균등) 기준이에요. [계산기에 적용]을 누르면 그 은행 평균 금리로 계산기가 바뀌어요. [최신 정보로 갱신]은 금감원 공시(또는 웹 검색)로 가져와요. 실제 금리는 우대조건과 시점에 따라 달라요. LTV(규제지역 무주택 ", Math.round(policy().loan.mortgage.ltvRegular * 100), "%, 생애최초 ", Math.round(policy().loan.mortgage.ltvFirst * 100), "%)와 하드캡은 모든 은행이 같고, 진단 계산과 같은 기준이에요."))), views.includes("news") && /* @__PURE__ */ React.createElement("div", { className: "mb-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-8 lg:space-y-0" }, /* @__PURE__ */ React.createElement(NewsPanel, { query: "부동산 규제 대출", eyebrow: "실시간 뉴스", title: "부동산 뉴스" }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5 mb-4" }, ["과천", "서울", "경기", "성남", "안양", "수원", "전국"].map((r) => /* @__PURE__ */ React.createElement("button", { key: r, onClick: () => setNewsRegion(r), className: `h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${newsRegion === r ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}` }, r))), /* @__PURE__ */ React.createElement(NewsPanel, { query: `${newsRegion === "전국" ? "" : newsRegion + " "}청약 분양`, eyebrow: "지역별 청약 소식", title: `${newsRegion} 청약 뉴스` }))), tab === "apply" && applySeg === "cheongyak" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SubIncomeStrip, { onOpen: () => setApplySeg("check") }), /* @__PURE__ */ React.createElement(CheongyakTab, { mapKey })), tab === "apply" && applySeg === "check" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SubscriptionAccountsCard, { hh, privacy }), /* @__PURE__ */ React.createElement(SubRouteCard, null), /* @__PURE__ */ React.createElement(EligibilityCheckTab, null)), tab === "apply" && applySeg === "types" && /* @__PURE__ */ React.createElement(PublicTypesSection, null), tab === "apply" && applySeg === "longlease" && /* @__PURE__ */ React.createElement(LongLeaseTab, null), views.includes("guide") && /* @__PURE__ */ React.createElement(RealtyGuideTab, null), tab === "watch" && /* @__PURE__ */ React.createElement(WatchlistTab, { hh, mapKey, privacy }), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "realty", accent: "#0A0A0A" })));
}
const SAVING_TABS = [
  { id: "ledger", label: "가계부", icon: "wallet" },
  { id: "accounts", label: "내 계좌·절세", icon: "piggy" },
  { id: "stocks", label: "보유 주식", icon: "trending" },
  { id: "policy", label: "정책·혜택", icon: "search" }
];
const SAVING_TAB_ALIAS = { overview: "accounts", tracker: "accounts", sim: "accounts", guide: "accounts" };
function useSavingRates() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    memoLoad("saving-rates", async () => {
      const r = await authFetch("/api/saving-rates");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then((j) => {
      if (alive && j) setData(j);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
const savingRateDefault = (rates) => {
  const v = rates && rates.saving && rates.saving.term12 && rates.saving.term12.avg;
  return typeof v === "number" ? v : null;
};
const rateAtLabel = (rates) => String(rates && rates.at || "").slice(0, 10);
const STOCK_ACCOUNTS = ["일반", "ISA", "연금저축", "IRP"];
const isKrCode = (code) => /^\d{6}$/.test(String(code || "").trim());
function isKrMarketOpen(d = /* @__PURE__ */ new Date()) {
  const k = new Date(d.getTime() + (d.getTimezoneOffset() + 540) * 6e4);
  const day = k.getDay(), m = k.getHours() * 60 + k.getMinutes();
  return day >= 1 && day <= 5 && m >= 540 && m <= 930;
}
function quoteBadge(q) {
  if (!q) return null;
  if (q.official && !q.delayed) return { text: "공식 실시간(한국투자증권)", cls: "bg-[#E8F5EC] text-[#1B7F3B]" };
  if (q.official) return { text: "공식 전일 종가(금융위원회)", cls: "bg-[#F2F2F2] text-[#525252]" };
  return { text: "비공식 실시간(네이버·야후, 1분 안팎 지연)", cls: "bg-[#FFF6DB] text-[#8A5A00]" };
}
const hhmm = (t) => {
  if (!t) return "";
  const d = new Date(t);
  return isNaN(d) ? String(t) : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const signPct = (n) => n == null || isNaN(n) ? "" : `${n > 0 ? "+" : ""}${(Math.round(n * 100) / 100).toFixed(2)}%`;
const wonFull = (n) => `${n < 0 ? "-" : ""}${Math.round(Math.abs(n)).toLocaleString()}원`;
const STOCK_EMPTY = { name: "", code: "", qty: "", avgPrice: "", account: "일반", owner: "", memo: "" };
function StocksTab({ hh, privacy }) {
  const [holdings, setHoldings] = usePersist("stock-holdings-v1", []);
  const [form, setForm] = useState(STOCK_EMPTY);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState({ loading: false, err: "", data: null });
  const codes = [...new Set(holdings.map((h) => String(h.code || "").trim().toUpperCase()).filter(Boolean))].join(",");
  const load = async () => {
    if (!codes) return;
    setQ((s) => ({ ...s, loading: true, err: "" }));
    try {
      const r = await authFetch(`/api/quotes?codes=${encodeURIComponent(codes)}`, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.items)) throw new Error("bad");
      setQ({ loading: false, err: "", data: j });
    } catch {
      setQ((s) => ({ ...s, loading: false, err: "시세를 불러오지 못했어요 — 잠시 후 다시 시도해 주세요" }));
    }
  };
  useEffect(() => {
    load();
  }, [codes]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && isKrMarketOpen()) load();
    }, 6e4);
    return () => clearInterval(t);
  }, [codes]);
  const quoteOf = (code) => (q.data && q.data.items || []).find((x) => String(x.code).toUpperCase() === String(code).toUpperCase());
  const fx = q.data && q.data.fx;
  const usd = fx && Number(fx.USDKRW) > 0 ? Number(fx.USDKRW) : null;
  const toKrw = (h, v) => isKrCode(h.code) ? v : usd ? v * usd : null;
  const rows = holdings.map((h) => {
    const qt = quoteOf(h.code), qty = Number(h.qty) || 0, avg = Number(h.avgPrice) || 0;
    const cost = toKrw(h, qty * avg);
    const value = qt && qt.price != null ? toKrw(h, qty * Number(qt.price)) : null;
    return { h, qt, qty, avg, cost, value, pl: value != null && cost != null ? value - cost : null };
  });
  const sum = (list) => list.reduce((s, r) => ({ cost: s.cost + (r.cost || 0), value: s.value + (r.value != null ? r.value : r.cost || 0), known: s.known && r.value != null }), { cost: 0, value: 0, known: true });
  const total = sum(rows);
  const byAcc = [["일반", ["일반"]], ["ISA", ["ISA"]], ["연금(연금저축·IRP)", ["연금저축", "IRP"]]].map(([label, accs]) => ({ label, ...sum(rows.filter((r) => accs.includes(r.h.account || "일반"))), n: rows.filter((r) => accs.includes(r.h.account || "일반")).length })).filter((x) => x.n > 0);
  const owners = [hh.label1 || "본인", hh.label2 || "배우자"];
  const save = () => {
    const f = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase(), qty: Number(form.qty) || 0, avgPrice: Number(form.avgPrice) || 0, owner: form.owner || owners[0] };
    if (!f.name || !f.code) return;
    if (editId) setHoldings(holdings.map((h) => h.id === editId ? { ...h, ...f, u: Date.now() } : h));
    else setHoldings([...holdings, { id: uid(), at: Date.now(), u: Date.now(), ...f }]);
    setForm(STOCK_EMPTY);
    setEditId(null);
  };
  const edit = (h) => {
    setEditId(h.id);
    setForm({ ...STOCK_EMPTY, ...h, qty: String(h.qty ?? ""), avgPrice: String(h.avgPrice ?? "") });
  };
  const kr = isKrCode(form.code);
  const inCls = "w-full h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]";
  const plCls = (n) => n == null ? "text-[#6B6B6B]" : n > 0 ? "text-[#C62828]" : n < 0 ? "text-[#1565C0]" : "";
  const money = (n) => n == null ? "—" : /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonFull(n));
  const priceTxt = (h, v) => isKrCode(h.code) ? `${Math.round(v).toLocaleString()}원` : `$${(Math.round(v * 100) / 100).toLocaleString()}`;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: q.data && q.data.at ? `시세 갱신 ${hhmm(q.data.at)}${isKrMarketOpen() ? " · 장중 1분마다 자동" : " · 장 마감"}` : "장중(평일 09:00~15:30)에는 1분마다 자동 갱신", title: "보유 주식 — 지금 얼마예요?" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(RefreshBtn, { onClick: load, loading: q.loading }))), q.err && /* @__PURE__ */ React.createElement("div", { className: "mb-3 rounded-xl bg-[#FFF6DB] text-[#8A5A00] text-[13px] px-4 py-2.5" }, "⚠️ ", q.err, ". 입력한 종목·수량은 그대로 있어요."), q.data && (q.data.errors || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[12px] text-[#8A5A00]" }, "⚠️ 시세를 못 받은 종목: ", q.data.errors.map((e) => `${e.code}(${e.message})`).join(", ")), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#F0F0F0]" }, [["총 매입금액", money(total.cost)], ["총 평가금액", money(total.value)], ["총 손익", /* @__PURE__ */ React.createElement("span", { className: plCls(total.value - total.cost) }, money(total.value - total.cost))], ["수익률", /* @__PURE__ */ React.createElement("span", { className: plCls(total.value - total.cost) }, total.cost > 0 ? signPct((total.value - total.cost) / total.cost * 100) : "—")]].map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1" }, l), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, v)))), !total.known && holdings.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-3 text-[12px] text-[#6B6B6B]" }, "시세가 없는 종목은 매입금액 그대로 평가금액에 넣었어요."), byAcc.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4 flex flex-wrap gap-2" }, byAcc.map((a) => /* @__PURE__ */ React.createElement("span", { key: a.label, className: "text-[12px] bg-[#FAFAFA] rounded-full px-3 py-1.5" }, a.label, " ", /* @__PURE__ */ React.createElement("b", null, money(a.value)), " ", /* @__PURE__ */ React.createElement("span", { className: plCls(a.value - a.cost) }, a.cost > 0 ? signPct((a.value - a.cost) / a.cost * 100) : ""))))), /* @__PURE__ */ React.createElement(Card, null, holdings.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#6B6B6B]" }, "아직 종목이 없어요. 아래에서 첫 종목을 추가해 주세요.") : /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto -mx-1" }, /* @__PURE__ */ React.createElement("table", { className: "w-full min-w-[760px] text-[13px]", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-[11px] text-[#6B6B6B] border-b border-[#F0F0F0]" }, ["종목", "수량", "평균 매수가", "현재가(전일 대비)", "평가금액", "손익(원화)", "계좌", ""].map((h, i) => /* @__PURE__ */ React.createElement("th", { key: i, className: `py-2 px-1 font-medium ${i > 0 && i < 6 ? "text-right" : "text-left"}` }, h)))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[#F5F5F5]" }, rows.map(({ h, qt, qty, avg, value, cost, pl }) => {
    const b = quoteBadge(qt);
    return /* @__PURE__ */ React.createElement("tr", { key: h.id, className: "align-top" }, /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-semibold" }, h.name), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, h.code, " · ", h.owner, h.memo ? ` · ${h.memo}` : ""), b && /* @__PURE__ */ React.createElement("div", { className: "mt-1 flex flex-wrap items-center gap-1" }, /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-semibold px-1.5 py-0.5 rounded ${b.cls}` }, b.text), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-[#6B6B6B]" }, hhmm(qt.time))), !isKrCode(h.code) && fx && /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-[#6B6B6B] mt-0.5" }, "환율 ", usd ? usd.toLocaleString() : "—", "원 · ", fx.source || "출처 미상", " · ", hhmm(fx.time))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, qty.toLocaleString())), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, priceTxt(h, avg)), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, qt && qt.price != null ? /* @__PURE__ */ React.createElement(React.Fragment, null, priceTxt(h, Number(qt.price)), /* @__PURE__ */ React.createElement("div", { className: `text-[11px] ${plCls(qt.change)}` }, qt.change > 0 ? "+" : "", qt.change != null ? isKrCode(h.code) ? Math.round(qt.change).toLocaleString() : Math.round(qt.change * 100) / 100 : "", " ", signPct(qt.changePct))) : /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "—")), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right font-semibold" }, money(value)), /* @__PURE__ */ React.createElement("td", { className: `py-2 px-1 text-right ${plCls(pl)}` }, money(pl), /* @__PURE__ */ React.createElement("div", { className: "text-[11px]" }, pl != null && cost > 0 ? signPct(pl / cost * 100) : "")), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1" }, h.account || "일반"), /* @__PURE__ */ React.createElement("td", { className: "py-1 px-0 whitespace-nowrap" }, /* @__PURE__ */ React.createElement(IconBtn, { name: "brush", title: "종목 고치기", onClick: () => edit(h) }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "종목 삭제", onClick: () => {
      if (confirm(`${h.name}을(를) 지울까요?`)) setHoldings(holdings.filter((x) => x.id !== h.id));
    } })));
  })))), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[11px] text-[#6B6B6B]" }, "빨강은 이익, 파랑은 손실이에요. 해외 종목 금액은 위 환율로 원화 환산했어요."))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: editId ? "고치는 중" : "종목 추가", title: editId ? "종목 고치기" : "새 종목 넣기" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "종목 이름"), /* @__PURE__ */ React.createElement(TextInput, { value: form.name, onChange: (v) => setForm({ ...form, name: v }), placeholder: "예: 삼성전자" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "종목 코드"), /* @__PURE__ */ React.createElement(TextInput, { value: form.code, onChange: (v) => setForm({ ...form, code: v }), placeholder: "국내 6자리 · 해외 티커(AAPL)" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "수량(주)"), /* @__PURE__ */ React.createElement("input", { type: "number", inputMode: "decimal", "aria-label": "수량", value: form.qty, onChange: (e) => setForm({ ...form, qty: e.target.value }), ...noNudge, className: inCls })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "평균 매수가(", form.code.trim() ? kr ? "원" : "달러" : "코드 입력 시 자동", ")"), /* @__PURE__ */ React.createElement("input", { type: "number", inputMode: "decimal", step: "any", "aria-label": "평균 매수가", value: form.avgPrice, onChange: (e) => setForm({ ...form, avgPrice: e.target.value }), ...noNudge, className: inCls })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "계좌"), /* @__PURE__ */ React.createElement("select", { "aria-label": "계좌", value: form.account, onChange: (e) => setForm({ ...form, account: e.target.value }), className: inCls }, STOCK_ACCOUNTS.map((a) => /* @__PURE__ */ React.createElement("option", { key: a }, a)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "명의"), /* @__PURE__ */ React.createElement("select", { "aria-label": "명의", value: form.owner || owners[0], onChange: (e) => setForm({ ...form, owner: e.target.value }), className: inCls }, owners.map((o) => /* @__PURE__ */ React.createElement("option", { key: o }, o)))), /* @__PURE__ */ React.createElement("div", { className: "col-span-2 sm:col-span-3" }, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "메모(선택)"), /* @__PURE__ */ React.createElement(TextInput, { value: form.memo, onChange: (v) => setForm({ ...form, memo: v }), placeholder: "예: 배당 재투자" }))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mt-4" }, /* @__PURE__ */ React.createElement("button", { onClick: save, disabled: !form.name.trim() || !form.code.trim(), className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold disabled:opacity-40" }, editId ? "고친 내용 저장" : "종목 추가"), editId && /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setEditId(null);
    setForm(STOCK_EMPTY);
  }, className: "h-10 px-4 rounded-lg bg-[#F5F5F5] text-[13px] font-semibold text-[#525252]" }, "취소")))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "2026년 9월 세법 기준", title: "세금 참고" }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed" }, "국내 상장주식 매매차익은 대주주가 아니면 과세되지 않아요. 해외주식은 1년 동안 번 차익에서 250만원을 뺀 나머지에 22%(양도소득세 20% + 지방소득세 2%)를 다음 해 5월에 신고·납부해요. 배당은 15.4% 원천징수."), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] mt-2" }, "ISA·연금저축·IRP 안에서 산 종목은 계좌 규칙대로 과세돼요(내 계좌·절세 › 절세 방법 참고)."))));
}
function ymIndex(ym) {
  const m = /^(\d{4})-(\d{2})/.exec(ym || "");
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}
function savingRatePct(a, tenureMonths, depDefault) {
  if (a.ratePct != null && a.ratePct !== "") return Number(a.ratePct) || 0;
  if (a.type === "예적금") return depDefault == null ? null : depDefault;
  if (a.type !== "청약통장") return null;
  const hit = ((policy().savingDefaults || {}).subscriptionRates || []).find((r) => r.upToMonths == null || tenureMonths < r.upToMonths);
  return hit ? hit.ratePct : null;
}
function savingRateType(a) {
  return a.rateType || (a.type === "예적금" || a.type === "청약통장" ? "단리" : "월복리");
}
function projectSaving(a, t, nowIdx, depDefault) {
  const SD = policy().savingDefaults || {};
  const bal0 = Number(a.balance) || 0, mon = Number(a.monthly) || 0;
  const matIdx = ymIndex(a.maturity), sinceIdx = ymIndex(a.since);
  const T = Math.max(0, Math.min(t, matIdx == null ? t : matIdx - nowIdx));
  const rate = savingRatePct(a, (sinceIdx == null ? 0 : Math.max(0, nowIdx - sinceIdx)) + T, depDefault);
  const r = (rate || 0) / 100 / 12;
  const principal = bal0 + mon * T;
  let interest;
  if (savingRateType(a) === "단리") interest = bal0 * r * T + mon * r * T * (T + 1) / 2;
  else {
    let b = bal0;
    for (let m = 0; m < T; m++) b = (b + mon) * (1 + r);
    interest = b - principal;
  }
  const tax = a.type === "연금저축" || a.type === "IRP" ? 0 : a.type === "ISA" ? Math.max(0, interest - ((SD.isaTaxFreeMan || {})[a.isaType === "서민형" ? "low" : "normal"] || 0)) * (SD.isaOverRate || 0) : interest * (SD.interestTaxRate || 0);
  return { principal, interest, tax, after: principal + interest - tax, rate, T };
}
function SavingTheme({ hh, privacy }) {
  const [tabRaw, setTab] = usePersist("saving-tab-v1", "ledger");
  const tab = SAVING_TAB_ALIAS[tabRaw] || tabRaw;
  const savingRates = useSavingRates();
  const depositDefault = savingRateDefault(savingRates);
  const [ratesOpen, setRatesOpen] = useState(false);
  const jump = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [accounts, setAccounts] = usePersist("saving-accounts-v1", ACCOUNTS_DEFAULT);
  const [gift, setGift] = usePersist("saving-gift-v1", { giftAmount: 2e4, spouseGiftUsed: 0 });
  const [sim, setSim] = usePersist("saving-sim-v1", { monthly: 250, ratePct: 4, years: 10 });
  const [policyData, setPolicyData] = usePersist("policy-data-v1", { items: POLICY_BENEFITS, at: null });
  const policyItems = !policyData.at || policyData.at < POLICY_BENEFITS_AT ? POLICY_BENEFITS : policyData.items || [];
  const policies = policyItems.map((p) => judgePolicy(p, hh));
  const patch = (id, k, v) => setAccounts(accounts.map((a) => a.id === id ? { ...a, [k]: v, u: Date.now() } : a));
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalPaid = accounts.reduce((s, a) => s + (a.paid || 0), 0);
  const totalGoal = accounts.reduce((s, a) => s + (a.goal || 0), 0);
  const pensionAccounts = accounts.filter((a) => a.type === "연금저축" || a.type === "IRP");
  const isSpouseOwned = (a) => {
    const o = String(a.owner || "").trim();
    if (!o) return false;
    if (hh.label2 && o === String(hh.label2).trim()) return true;
    if (hh.label1 && o === String(hh.label1).trim()) return false;
    return /^(배우자|아내|와이프|남편|남편분|신랑|신부)$/.test(o);
  };
  const unknownOwner = pensionAccounts.some((a) => {
    const o = String(a.owner || "").trim();
    return o && o !== String(hh.label1 || "").trim() && o !== String(hh.label2 || "").trim() && !/^(본인|배우자|아내|와이프|남편|남편분|신랑|신부)$/.test(o);
  });
  const paidByType = (spouse, type) => pensionAccounts.filter((a) => isSpouseOwned(a) === spouse && a.type === type).reduce((s, a) => s + (a.paid || 0), 0);
  const PN = policy().pension;
  const creditFor = (ps, irp, incomeMan) => {
    const total = Math.min(Math.min(ps, PN.psLimitMan) + irp, PN.totalLimitMan);
    return total * (incomeMan > PN.thresholdMan ? PN.rateHigh : PN.rateLow);
  };
  const refundEst = creditFor(paidByType(false, "연금저축"), paidByType(false, "IRP"), hh.income1) + creditFor(paidByType(true, "연금저축"), paidByType(true, "IRP"), hh.income2);
  const groups = ACCOUNT_TYPES.map((t) => ({ type: t, list: accounts.filter((a) => a.type === t) })).filter((g) => g.list.length > 0);
  const addAccount = (type) => setAccounts([...accounts, { id: uid(), at: Date.now(), owner: hh.label1 || "본인", type, balance: 0, paid: 0, goal: 0 }]);
  useEffect(() => {
    setAccounts((prev) => {
      let changed = false;
      const next = prev.map((a) => {
        const o = String(a.owner || "").trim();
        if (o === "본인" && hh.label1 && hh.label1 !== "본인") {
          changed = true;
          return { ...a, owner: hh.label1 };
        }
        if (o === "배우자" && hh.label2 && hh.label2 !== "배우자") {
          changed = true;
          return { ...a, owner: hh.label2 };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [hh.label1, hh.label2]);
  const years = Math.min(40, Math.max(1, Number(sim.years) || 1));
  const mRate = (Number(sim.ratePct) || 0) / 100 / 12;
  const simInitial = Number(sim.initial) || 0;
  const trackerMonthly = Math.round(totalGoal / 12);
  const yearly = [];
  {
    let bal = simInitial;
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = (bal + (Number(sim.monthly) || 0)) * (1 + mRate);
      yearly.push({ y, bal: Math.round(bal), principal: simInitial + (Number(sim.monthly) || 0) * 12 * y });
    }
  }
  const maxBal = yearly.length ? yearly[yearly.length - 1].bal : 1;
  const nowIdx = ymIndex(todayYmd());
  const isPensionAcc = (a) => a.type === "연금저축" || a.type === "IRP";
  const accRows = accounts.map((a) => ({ a, rows: Array.from({ length: years }, (_, i) => projectSaving(a, (i + 1) * 12, nowIdx, depositDefault)) }));
  const sumRows = (list, y) => list.reduce((s, { rows }) => {
    const r = rows[y];
    return { principal: s.principal + r.principal, interest: s.interest + r.interest, tax: s.tax + r.tax, after: s.after + r.after };
  }, { principal: 0, interest: 0, tax: 0, after: 0 });
  const accYearly = Array.from({ length: years }, (_, y) => ({ y: y + 1, ...sumRows(accRows, y) }));
  const accTotal = accYearly[years - 1];
  const houseTotal = sumRows(accRows.filter((x) => !isPensionAcc(x.a)), years - 1);
  const pensionTotal = sumRows(accRows.filter((x) => isPensionAcc(x.a)), years - 1);
  const accMax = Math.max(1, accTotal.principal + accTotal.interest);
  const needRate = accRows.filter((x) => x.rows[0].rate == null && ((Number(x.a.balance) || 0) > 0 || (Number(x.a.monthly) || 0) > 0));
  const [simOpen, setSimOpen] = useState(false);
  const spouseExemption = Math.max(0, policy().gift.spouseExemptionMan - gift.spouseGiftUsed);
  const giftTaxableBase = Math.max(0, gift.giftAmount * 1e4 - spouseExemption * 1e4);
  const giftTaxOwed = giftTax(giftTaxableBase);
  const incomeTotal = hh.income1 + hh.income2;
  const rate1 = r2((hh.income1 > PN.thresholdMan ? PN.rateHigh : PN.rateLow) * 100);
  const rate2 = r2((hh.income2 > PN.thresholdMan ? PN.rateHigh : PN.rateLow) * 100);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PillNav, { tabs: SAVING_TABS, tab, setTab }), tab === "accounts" && /* @__PURE__ */ React.createElement("div", { className: "sticky top-[60px] z-[9] -mx-5 sm:-mx-10 px-5 sm:px-10 pb-3 bg-[#F4F4F5]/95 backdrop-blur flex gap-1.5 overflow-x-auto no-scrollbar" }, [["acc-status", "계좌 현황"], ["acc-sim", `${years}년 뒤 예상`], ["acc-guide", "절세 방법"]].map(([id, label]) => /* @__PURE__ */ React.createElement("button", { key: id, type: "button", onClick: () => jump(id), className: "h-8 px-3 rounded-full bg-white shadow-sm text-[12.5px] font-semibold text-[#525252] hover:bg-[#FAFAFA] whitespace-nowrap" }, label, " ↓"))), tab === "accounts" && /* @__PURE__ */ React.createElement("div", { id: "acc-status", className: "scroll-mt-32" }, /* @__PURE__ */ React.createElement(SavingLinkedBar, { hh, totalBalance, privacy }), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "예적금·청약통장·ISA·연금 한눈에", title: "우리 계좌 현황" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 divide-x divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1" }, "총 잔액"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalBalance))), /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1" }, "올해 납입"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalPaid))), /* @__PURE__ */ React.createElement("div", { className: "p-4 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1" }, "연 납입 목표"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(totalGoal)))), /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[13px] text-[#525252] mb-1.5" }, /* @__PURE__ */ React.createElement("span", null, "목표 달성률"), /* @__PURE__ */ React.createElement("span", { className: "font-bold", style: { fontVariantNumeric: "tabular-nums" } }, totalGoal > 0 ? Math.round(totalPaid / totalGoal * 100) : 0, "%")), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: totalGoal > 0 ? totalPaid / totalGoal : 0 }), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[13px] text-[#6B6B6B]" }, "올해 연금저축·IRP에 낸 돈 기준 예상 세액공제 환급 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(Math.round(refundEst))), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[11px]" }, "(명의자별로 계산 · 1인당 연금저축 ", manWon(PN.psLimitMan), ", 연금저축+IRP 합산 ", manWon(PN.totalLimitMan), " 한도)")), unknownOwner && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px] text-[#8A5A00]" }, "⚠️ 명의를 알아볼 수 없는 계좌가 있어 ", hh.label1 || "본인", ' 몫으로 계산했어요. 명의를 "', hh.label1 || "본인", '" 또는 "', hh.label2 || "배우자", '"로 맞춰 주세요.')))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, groups.map((g) => {
    const gb = g.list.reduce((s, a) => s + (a.balance || 0), 0);
    const gp = g.list.reduce((s, a) => s + (a.paid || 0), 0);
    const gg = g.list.reduce((s, a) => s + (a.goal || 0), 0);
    return /* @__PURE__ */ React.createElement("section", { key: g.type }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: `${g.list.length}개 계좌`, title: g.type }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 pb-3 border-b border-[#F0F0F0]" }, g.type === "청약통장" ? /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "잔액 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(gb)), " · 월 납입 합계 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(g.list.reduce((s, a) => s + (Number(a.monthly) || 0), 0)))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "잔액 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(gb)), " · 올해 납입 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(gp)), " / 연 목표 ", manWon(gg)), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold" }, gg > 0 ? Math.round(gp / gg * 100) : 0, "%"))), /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, g.list.map((a) => /* @__PURE__ */ React.createElement("div", { key: a.id, className: "rounded-xl bg-[#FAFAFA] p-3.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: a.owner, onChange: (v) => patch(a.id, "owner", v), placeholder: "명의", className: "!w-24 !bg-white" }), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "계좌 삭제", onClick: () => setAccounts(accounts.filter((x) => x.id !== a.id)) })), a.type === "청약통장" ? (() => {
      const inc = isSpouseOwned(a) ? hh.income2 : hh.income1;
      const yearPay = Math.min((Number(a.monthly) || 0) * 12, 300);
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "mb-2.5" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "잔액(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.balance, onChange: (v) => patch(a.id, "balance", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] leading-relaxed" }, "소득공제(조세특례제한법 제87조): ", inc > 7e3 ? /* @__PURE__ */ React.createElement(React.Fragment, null, "명의자 연소득 ", manWon(inc), "이 총급여 7,000만원을 넘어 ", /* @__PURE__ */ React.createElement("b", null, "공제 대상이 아니에요.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, "월 납입 ", manWon(Number(a.monthly) || 0), " × 12 = 연 ", manWon(yearPay), "(한도 300만)의 40%, ", /* @__PURE__ */ React.createElement("b", null, "소득공제 ", manWon(r2(yearPay * 0.4))), " 예상이에요. 무주택 세대의 세대주나 그 배우자여야 해요.")));
    })() : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2.5 mb-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "잔액(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.balance, onChange: (v) => patch(a.id, "balance", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "올해 납입(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.paid, onChange: (v) => patch(a.id, "paid", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "연 목표(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.goal, onChange: (v) => patch(a.id, "goal", v), className: "!bg-white" }))), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: a.goal > 0 ? a.paid / a.goal : 0, height: 4 })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "월 납입(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: a.monthly || 0, onChange: (v) => patch(a.id, "monthly", v), className: "!bg-white !h-9 !text-[13px]" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, a.type === "ISA" || a.type === "연금저축" || a.type === "IRP" ? "예상 수익률(연 %)" : "금리(연 %)"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "number",
        inputMode: "decimal",
        step: "0.1",
        "aria-label": "연 금리",
        value: a.ratePct ?? "",
        placeholder: a.type === "청약통장" ? `기본 ${savingRatePct({ type: "청약통장" }, a.since && ymIndex(a.since) != null ? ymIndex(todayYmd()) - ymIndex(a.since) : 0)}%` : a.type === "예적금" && depositDefault != null ? `공시 평균 ${depositDefault}% · 금감원 · ${rateAtLabel(savingRates)}` : "입력",
        onChange: (e) => patch(a.id, "ratePct", e.target.value === "" ? null : Number(e.target.value)),
        ...noNudge,
        className: "w-full h-9 px-2.5 rounded-lg bg-white border border-transparent text-[13px] font-semibold focus:outline-none focus:border-[#0A0A0A]",
        style: { fontVariantNumeric: "tabular-nums" }
      }
    )), a.type !== "청약통장" && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "이자 방식"), /* @__PURE__ */ React.createElement("select", { "aria-label": "이자 방식", value: savingRateType(a), onChange: (e) => patch(a.id, "rateType", e.target.value), className: "w-full h-9 px-2 rounded-lg bg-white border border-transparent text-[13px] font-semibold focus:outline-none focus:border-[#0A0A0A]" }, /* @__PURE__ */ React.createElement("option", { value: "단리" }, "단리(적금식)"), /* @__PURE__ */ React.createElement("option", { value: "월복리" }, "월복리"))), a.type === "청약통장" ? null : a.type === "ISA" ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "ISA 유형"), /* @__PURE__ */ React.createElement("select", { "aria-label": "ISA 유형", value: a.isaType || "일반형", onChange: (e) => patch(a.id, "isaType", e.target.value), className: "w-full h-9 px-2 rounded-lg bg-white border border-transparent text-[13px] font-semibold focus:outline-none focus:border-[#0A0A0A]" }, /* @__PURE__ */ React.createElement("option", { value: "일반형" }, "일반형(비과세 200만)"), /* @__PURE__ */ React.createElement("option", { value: "서민형" }, "서민형(비과세 400만)"))) : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "만기(선택)"), /* @__PURE__ */ React.createElement("input", { type: "month", "aria-label": "만기", value: a.maturity || "", onChange: (e) => patch(a.id, "maturity", e.target.value), className: "w-full h-9 px-2 rounded-lg bg-white border border-transparent text-[13px] font-semibold focus:outline-none focus:border-[#0A0A0A]" }))), a.type === "청약통장" && /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5 mt-2.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "가입 시작(년·월)"), /* @__PURE__ */ React.createElement("input", { type: "month", "aria-label": "청약통장 가입 시작", value: a.since || "", onChange: (e) => patch(a.id, "since", e.target.value), className: "w-full h-10 px-2.5 rounded-lg bg-white border border-transparent text-[14px] font-semibold focus:outline-none focus:border-[#0A0A0A]" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "누적 납입 횟수"), /* @__PURE__ */ React.createElement(NumInput, { value: a.count || 0, onChange: (v) => patch(a.id, "count", v), className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", { className: "col-span-2 text-[11px] text-[#6B6B6B]" }, "🔗 부동산 › 청약·공공 › 우리 자격·루트에 1순위 요건과 가입기간 점수로 바로 보여요"))))), /* @__PURE__ */ React.createElement("button", { onClick: () => addAccount(g.type), className: "mt-3 w-full h-10 rounded-xl border border-dashed border-[#C9C9C9] text-[13px] font-semibold text-[#525252] flex items-center justify-center gap-1.5 hover:bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " ", g.type, " 계좌 추가")));
  }), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "새 유형", title: "다른 계좌 추가" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, ACCOUNT_TYPES.map((t) => /* @__PURE__ */ React.createElement("button", { key: t, onClick: () => addAccount(t), className: "h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold hover:bg-[#ECECEC] flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 12 }), t))))))), tab === "accounts" && /* @__PURE__ */ React.createElement("div", { id: "acc-sim", className: "scroll-mt-32 mt-8" }, /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] mb-3" }, "기본 금리 출처 — 청약통장: 정책 데이터(", (((window.POLICY_DEFAULT || {}).sections || {}).savingDefaults || {}).asOf || "기준일 미상", " 기준) · 예적금: ", depositDefault != null ? /* @__PURE__ */ React.createElement(React.Fragment, null, "금감원 금융상품 공시(", rateAtLabel(savingRates), ") 적금 12개월 기본금리 평균 ", depositDefault, "%") : "금감원 공시를 불러오지 못했어요 — 예적금 금리를 직접 적어 주세요"), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "계좌별 계산", title: /* @__PURE__ */ React.createElement(React.Fragment, null, years, "년 뒤 우리 계좌 ", manWon(Math.round(accTotal.after))) }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-end gap-3 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "w-40" }, /* @__PURE__ */ React.createElement(Field, { label: "몇 년 뒤까지(년)", value: sim.years, onChange: (v) => setSim({ ...sim, years: v }) })), /* @__PURE__ */ React.createElement("p", { className: "flex-1 min-w-[220px] text-[13px] text-[#6B6B6B] leading-relaxed pb-1" }, "위 계좌 현황의 ", /* @__PURE__ */ React.createElement("b", null, "지금 잔액"), "에서 시작해 ", /* @__PURE__ */ React.createElement("b", null, "매달 월 납입"), "을 넣는다고 보고 계산해요(오늘 ", todayYmd().slice(0, 7), " 기준). 월 납입·금리·만기는 위 계좌 카드에서 고쳐요.")), needRate.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[12px] text-[#8A5A00]" }, "⚠️ 금리를 안 적은 계좌가 ", needRate.length, "개 있어 이자를 0으로 계산했어요(", needRate.map((x) => `${x.a.owner} ${x.a.type}`).join(", "), "). ", needRate.some((x) => x.a.type === "예적금") ? "예적금은 금감원 공시 평균을 불러오지 못해 약정 금리를 직접 적어야 해요. " : "", "ISA·연금은 예상 수익률을 적어 주세요."), /* @__PURE__ */ React.createElement("div", { className: "overflow-x-auto -mx-1" }, /* @__PURE__ */ React.createElement("table", { className: "w-full min-w-[640px] text-[13px]", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-[11px] text-[#6B6B6B] border-b border-[#F0F0F0]" }, ["계좌", "명의", "월 납입", "금리", `${years}년 뒤 원금`, "이자·수익(세전)", "세금", "세후"].map((h, i) => /* @__PURE__ */ React.createElement("th", { key: h, className: `py-2 px-1 font-medium ${i > 1 ? "text-right" : "text-left"}` }, h)))), /* @__PURE__ */ React.createElement("tbody", { className: "divide-y divide-[#F5F5F5]" }, accRows.map(({ a, rows }) => {
    const r = rows[years - 1];
    return /* @__PURE__ */ React.createElement("tr", { key: a.id }, /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 font-semibold" }, a.type, a.type === "ISA" && a.isaType === "서민형" ? " · 서민형" : ""), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-[#525252]" }, a.owner), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Number(a.monthly) || 0))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, r.rate == null ? /* @__PURE__ */ React.createElement("span", { className: "text-[#8A5A00]" }, "입력 필요") : `${r.rate}% ${savingRateType(a) === "단리" ? "단리" : "복리"}`, a.type === "예적금" && (a.ratePct == null || a.ratePct === "") && depositDefault != null ? /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "공시 평균 ", depositDefault, "% · 금감원 · ", rateAtLabel(savingRates)) : null, a.maturity ? /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "만기 ", a.maturity) : null), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(r.principal)))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(r.interest * 10) / 10))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right text-[#6B6B6B]" }, isPensionAcc(a) ? "과세이연" : /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(r.tax * 10) / 10))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right font-bold" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(r.after)))));
  }), /* @__PURE__ */ React.createElement("tr", { className: "border-t-2 border-[#E5E5E5] font-bold" }, /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1", colSpan: 4 }, "합계"), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(accTotal.principal)))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(accTotal.interest * 10) / 10))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(accTotal.tax * 10) / 10))), /* @__PURE__ */ React.createElement("td", { className: "py-2 px-1 text-right" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(accTotal.after)))))))), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3 mt-4" }, /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-0.5" }, "집 살 때 쓸 수 있는 돈 · 청약통장·예적금·ISA 등"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(houseTotal.after)))), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-1 leading-relaxed" }, "세후 금액이에요. ISA는 의무 기간 3년을 채운 뒤에 세제 혜택을 받고 꺼내요. 청약통장은 당첨 전에 해지하면 청약 자격(가입기간·납입 횟수)이 사라져요.")), /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-0.5" }, "노후용으로 묶인 돈 · 연금저축·IRP"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(pensionTotal.after)))), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-1 leading-relaxed" }, "세전 금액이에요(과세이연 — 세금을 나중에 내요). 55세 이후 연금으로 받을 때 연금소득세 3.3~5.5%를 내요. 올해 세액공제 환급(예상 ", manWon(Math.round(refundEst)), ")은 여기에 넣지 않았어요."))), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[12px] text-[#6B6B6B] leading-relaxed" }, "세금: 예적금·청약통장 이자는 15.4%(이자소득세 14% + 지방소득세 1.4%), ISA는 수익에서 비과세 한도(일반형 200만·서민형 400만)를 뺀 나머지에 9.9%예요. 청약통장 금리는 금리를 비워 두면 해지 시점 가입기간 기준 정부 금리(1년 미만 2.3%·2년 미만 2.8%·2년 이상 3.1%, 2026.9 기준)로 계산해요. 만기가 지나면 그 뒤로는 납입·이자 없이 원리금 그대로 둬요."), savingRates && /* @__PURE__ */ React.createElement("div", { className: "mt-3 pt-3 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setRatesOpen(!ratesOpen), "aria-expanded": ratesOpen, className: "text-[13px] font-semibold text-[#525252]" }, "은행별 금리 상위 5곳 ", ratesOpen ? "접기 ▲" : "펼쳐 보기 ▼", " ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 금감원 공시 ", rateAtLabel(savingRates))), ratesOpen && /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-3 gap-3 mt-3" }, [["적금 12개월", savingRates.saving && savingRates.saving.term12], ["적금 24개월", savingRates.saving && savingRates.saving.term24], ["예금 12개월", savingRates.deposit && savingRates.deposit.term12]].map(([label, g]) => /* @__PURE__ */ React.createElement("div", { key: label, className: "rounded-xl bg-[#FAFAFA] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold mb-1" }, label, " ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "· 평균 ", g && g.avg != null ? `${g.avg}%` : "—", g && g.max != null ? ` · 최고 ${g.max}%` : "")), /* @__PURE__ */ React.createElement("ol", { className: "space-y-1 text-[12px]" }, (g && g.top || []).slice(0, 5).map((t, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex justify-between gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "truncate" }, i + 1, ". ", t.bank, " · ", t.product), /* @__PURE__ */ React.createElement("span", { className: "shrink-0 font-semibold", style: { fontVariantNumeric: "tabular-nums" } }, t.rate, "%", t.rateMax != null ? ` (최고 ${t.rateMax}%)` : ""))), !(g && g.top || []).length && /* @__PURE__ */ React.createElement("li", { className: "text-[#6B6B6B]" }, "자료가 없어요")))), /* @__PURE__ */ React.createElement("p", { className: "sm:col-span-3 text-[11px] text-[#6B6B6B]" }, "왼쪽 숫자는 기본금리, 괄호 안 최고 금리는 우대 조건(급여 이체 등)을 모두 채웠을 때예요. ", safeUrl(savingRates.link) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(savingRates.link), target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-2" }, savingRates.source || "금감원 금융상품 한눈에")))))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "연도별", title: "원금과 수익이 쌓이는 흐름" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, accYearly.map((r) => {
    const tot = r.principal + r.interest;
    return /* @__PURE__ */ React.createElement("div", { key: r.y, className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B] w-8 shrink-0 text-right" }, r.y, "년"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-4 rounded-full bg-[#F0F0F0] overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#0A0A0A] relative", style: { width: `${Math.max(2, Math.round(tot / accMax * 100))}%` } }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 bg-[#8A8A8A] rounded-full", style: { width: `${tot > 0 ? Math.round(r.principal / tot * 100) : 100}%` } }))), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold w-24 shrink-0 text-right", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(Math.round(r.after)))));
  })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-4 mt-4 pt-3 border-t border-[#F0F0F0] text-[12px] text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#8A8A8A] inline-block" }), "원금(잔액 + 납입 누계)"), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0A] inline-block" }), "이자·수익(세전)"), /* @__PURE__ */ React.createElement("span", { className: "ml-auto" }, "오른쪽 숫자는 세후 금액이에요")))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setSimOpen(!simOpen), "aria-expanded": simOpen, className: "w-full flex items-center justify-between mb-3 text-left" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold" }, "직접 시나리오 ", /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-normal text-[#6B6B6B]" }, "· 원금·월 납입·수익률을 직접 넣어 보기")), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-semibold text-[#525252]" }, simOpen ? "접기" : "펼치기")), simOpen && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "복리 계산", title: "월 저축으로 쌓이는 연도별 자산" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "시작 원금(만원)", value: sim.initial || 0, onChange: (v) => setSim({ ...sim, initial: v }), step: 100 }), /* @__PURE__ */ React.createElement(Field, { label: "월 납입(만원)", value: sim.monthly, onChange: (v) => setSim({ ...sim, monthly: v }), step: 10 }), /* @__PURE__ */ React.createElement(Field, { label: "연 수익률(%)", value: sim.ratePct, onChange: (v) => setSim({ ...sim, ratePct: v }), step: 0.5 }), /* @__PURE__ */ React.createElement(Field, { label: "기간(년)", value: sim.years, onChange: (v) => setSim({ ...sim, years: v }) })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSim({ ...sim, initial: totalBalance, monthly: trackerMonthly }),
      className: "h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold"
    },
    "계좌 현황 값으로 채우기(시작 ",
    totalBalance.toLocaleString(),
    "만원 · 월 ",
    trackerMonthly.toLocaleString(),
    "만원)"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSim({ ...sim, monthly: hh.monthlySave }),
      className: "h-9 px-3.5 rounded-full bg-[#F5F5F5] text-[13px] font-semibold text-[#525252] hover:bg-[#ECECEC]"
    },
    "진단의 월 저축액(",
    hh.monthlySave,
    "만원) 불러오기"
  )), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[13px] text-[#6B6B6B] leading-relaxed" }, "[계좌 현황 값으로 채우기]는 ", /* @__PURE__ */ React.createElement("b", null, "모든 계좌 총 잔액을 시작 원금"), "으로, ", /* @__PURE__ */ React.createElement("b", null, "연 납입 목표 ÷ 12를 월 납입"), "으로 가져와요. 매달 넣은 돈이 월복리로 불어난다고 가정해요. ISA·연금계좌에 넣으면 이 수익에 붙는 세금을 아낄 수 있어요."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "예상 결과", title: /* @__PURE__ */ React.createElement(React.Fragment, null, years, "년 후 ", manWon(yearly[years - 1].bal)) }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "space-y-2.5" }, yearly.map((r) => /* @__PURE__ */ React.createElement("div", { key: r.y, className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B] w-8 shrink-0 text-right" }, r.y, "년"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 h-4 rounded-full bg-[#F0F0F0] overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#0A0A0A] relative", style: { width: `${Math.max(2, Math.round(r.bal / maxBal * 100))}%` } }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-y-0 left-0 bg-[#8A8A8A] rounded-full", style: { width: `${Math.round(r.principal / r.bal * 100)}%` } }))), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold w-24 shrink-0 text-right", style: { fontVariantNumeric: "tabular-nums" } }, manWon(r.bal))))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-4 mt-4 pt-3 border-t border-[#F0F0F0] text-[12px] text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#8A8A8A] inline-block" }), "원금"), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] bg-[#0A0A0A] inline-block" }), "원금+수익"), /* @__PURE__ */ React.createElement("span", { className: "ml-auto" }, "누적 수익 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(yearly[years - 1].bal - yearly[years - 1].principal))))))))), tab === "accounts" && /* @__PURE__ */ React.createElement("div", { id: "acc-guide", className: "scroll-mt-32 mt-8 space-y-2" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "우선순위", title: "돈 넣는 순서" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-4" }, "절세 한도는 전부 ", /* @__PURE__ */ React.createElement("b", null, "1인 기준"), "이라 계좌는 각자 명의로 각자 채워요. 공동 목표자금만 별도 통장으로 나눠요. ①부터 채우는 게 ", /* @__PURE__ */ React.createElement("b", null, "받는 세제 혜택에 비해 돈이 묶이는 손해가 가장 적은 순서"), "예요."), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-5 gap-3" }, [
    ["주택청약종합저축", "각자 월 25만", "월 납입 인정액이 25만원으로 올랐어요(2024.11~). 공공분양 일반공급은 납입 인정 금액이 많은 순으로 뽑아서 월 25만이 유리해요. 총급여 7천만 이하인 무주택 세대의 세대주나 배우자는 본인 명의로 낸 돈 연 300만까지 40%(최대 120만)를 소득공제받아요. 부부가 각자 요건을 채우면 각자 받아요. 2028년 납입분까지예요."],
    ["연금저축", "각자 연 600만 (월 50만)", "세액공제를 가장 먼저 채울 계좌예요. 위험자산에 100% 투자할 수 있고 일부 인출도 돼서 IRP보다 먼저 채워요."],
    ["IRP", "각자 연 300만 (월 25만)", "연금저축과 합쳐 공제 한도 900만원을 채우는 용도예요. 중간에 꺼내기가 사실상 막혀 있어 그 이상은 넣지 않아요."],
    ["ISA", "남는 여력 전부 (연 2,000만)", "의무 기간 3년이 지나면 세제 혜택을 받고 꺼낼 수 있어요. 과천 계약금·잔금에 쓸 돈을 여기에 모아요. 원금은 그 전에도 뺄 수 있어요."],
    ["파킹·예적금", "그래도 남으면", "청약·계약에 바로 쓸 수 있게 현금성으로 둬요. 집을 마련한 뒤에는 연금계좌에 더 넣어(1인 연 1,800만원까지) 세금을 나중에 내요(과세이연)."]
  ].map(([t, amt, desc], i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "rounded-xl bg-[#FAFAFA] p-4" }, /* @__PURE__ */ React.createElement("span", { className: "w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[12px] font-bold flex items-center justify-center mb-2.5" }, i + 1), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold leading-snug" }, t), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-[#6B6B6B] mt-0.5 mb-1.5" }, amt), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, desc)))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "절세계좌 ①", title: "ISA — 목적자금의 주력" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-x-10 gap-y-6" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-bold mb-3 text-[#6B6B6B]" }, "제도 핵심 · 2026.8.3 세제개편안 반영"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "연 2,000만원 한도, 총 1억원 · 비과세 200만원(서민형 400만), 초과분 9.9% 분리과세. 서민형은 총급여 5,000만(종합소득 3,800만) 이하예요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "쓰지 않은 한도 이월과 계약기간은 지금 그대로예요."), " 8월 정부안의 이월 폐지·5년 제한은 9/1 확정안에서 철회됐어요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "2027년 신설 ", /* @__PURE__ */ React.createElement("b", null, "생산적금융 ISA"), ": 국내주식·국내주식형펀드 전용, 이자·배당 전액 비과세, 연 2,000만/총 2억. 의무 기간 3년, 그 뒤는 기간 제한 없이 유지할 수 있어요(9.1 확정 정부안). 1인 1계좌이고 일반 ISA와 함께 가입할 수 있어요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "의무 유지 기간은 3년이에요. 원금은 언제든 뺄 수 있어서 과천 목적자금(청약·매매용)에 가장 잘 맞아요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "지금 할 일:"), " 개설만 해 두면 쓰지 않은 한도가 연 2,000만씩 쌓여요(총 1억까지). 일찍 열어 두는 것만으로도 유리해요.")))), /* @__PURE__ */ React.createElement("div", { className: "lg:border-l lg:border-[#F0F0F0] lg:pl-10" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-bold mb-3 text-[#6B6B6B]" }, "실전 운용"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "유형은 ", /* @__PURE__ */ React.createElement("b", null, "중개형"), "으로 — ETF·리츠·채권을 직접 매매할 수 있어요. 신탁형·일임형은 운용 제약에 수수료까지 붙어요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "담는 순서는 ", /* @__PURE__ */ React.createElement("b", null, "이자·배당 나오는 자산부터"), " — 배당ETF·리츠·채권·파킹형. 일반계좌에서 15.4% 떼이는 세금을 비과세 200만+9.9%로 바꾸는 게 ISA의 본질이고, 손익통산(이익−손실 상계 후 과세)도 ISA 안에서만 돼요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "만기 때 할 일:"), " 3년을 채운 뒤 과천 자금으로 쓸 거면 꺼내요. 여유가 있으면 ", /* @__PURE__ */ React.createElement("b", null, "연금계좌로 옮겨요. 옮긴 금액의 10%(최대 300만)를 추가로 세액공제"), "받아요. 그다음 바로 다시 가입해 한도를 새로 시작해요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "원금 안에서 중간에 빼도 불이익은 없지만 ", /* @__PURE__ */ React.createElement("b", null, "뺀 만큼 납입 한도가 다시 생기지는 않아요."), " 넣기 전에 쓸 일정부터 확인해요."))))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "절세계좌 ②", title: "연금저축 + IRP — 환급의 코어" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-x-10 gap-y-6" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-bold mb-3 text-[#6B6B6B]" }, "한도 구조 · 우리 부부 환급액"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "세액공제 한도는 ", /* @__PURE__ */ React.createElement("b", null, "1인 900만(연금저축 600만 + IRP 300만)"), "이에요. 연금저축만 넣으면 600만까지, IRP만 넣으면 900만까지 인정돼요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "넣는 것은 두 계좌 합쳐 ", /* @__PURE__ */ React.createElement("b", null, "1인 연 1,800만"), "까지 돼요. 공제받지 못한 초과분은 연금저축이면 언제든 세금 없이 꺼낼 수 있어요(IRP는 해지해야 꺼낼 수 있어요). ", /* @__PURE__ */ React.createElement("b", null, "납입연도 전환 신청"), "으로 다음 해 공제분으로 넘길 수도 있어요."))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-3 my-4" }, [{ label: hh.label1 || "본인", income: hh.income1, rate: rate1 }, { label: hh.label2 || "배우자", income: hh.income2, rate: rate2 }].map((p, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, p.label, " · 총급여 ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(p.income))), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, "공제율 ", p.rate, "% · 900만 채우면 연 최대 ", (900 * p.rate / 100).toFixed(1), "만원 환급")))), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed bg-[#FAFAFA] rounded-lg px-3 py-2" }, "둘 다 900만씩 채우면 연말정산에서 ", /* @__PURE__ */ React.createElement("b", null, "부부 합산 약 ", ((900 * rate1 + 900 * rate2) / 100).toFixed(1), "만원"), "이 돌아와요. 넣기만 하면 받는 확정 수익이라 어떤 투자보다 먼저예요(홈에 적은 부부 총급여로 계산).")), /* @__PURE__ */ React.createElement("div", { className: "lg:border-l lg:border-[#F0F0F0] lg:pl-10" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[13px] font-bold mb-3 text-[#6B6B6B]" }, "운용 · 인출 규칙"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "연금저축을 먼저"), " 채워요. 위험자산에 100% 투자할 수 있고 일부 인출도 돼요(공제받은 원금·수익을 빼면 16.5% 기타소득세). IRP는 ", /* @__PURE__ */ React.createElement("b", null, "30%를 안전자산에 둬야 하고 법으로 정한 사유가 아니면 중간에 못 빼서"), "(빼려면 해지해야 해요) 뒤로 미뤄요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "IRP 중도인출 사유에 ", /* @__PURE__ */ React.createElement("b", null, "무주택자 주택 구입·전세보증금"), "이 있지만, 공제받은 돈엔 똑같이 16.5%가 붙어 이득이 없어요. 그래서 집 살 돈은 처음부터 ISA로 나눠 둬요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "받을 때:"), " 55세 이후 연금으로 받으면 3.3~5.5%(나이별로 달라요)만 내요. 사적연금 수령액이 ", /* @__PURE__ */ React.createElement("b", null, "연 1,500만을 넘으면 전액 종합과세(또는 16.5% 분리과세 선택)"), "라, 받는 기간을 늘려 연 1,500만 이하로 맞추는 게 기본이에요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "그해 공제는 ", /* @__PURE__ */ React.createElement("b", null, "12월 31일에 낸 돈까지"), "예요. 연말에 한도가 남아 있으면 한 번에 넣어도 전액 인정돼요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, "IRP는 ", /* @__PURE__ */ React.createElement("b", null, "운용·자산관리 수수료가 0원인 증권사"), "에서 만들어요. 은행 IRP를 쓰고 있다면 가진 상품 그대로 옮길 수 있어요(현물이전)."))))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "자산 배치", title: "어느 계좌에 뭘 담을까" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-4" }, "같은 상품도 어느 계좌에 담느냐로 세금이 갈려요. 원칙은 하나 — ", /* @__PURE__ */ React.createElement("b", null, "세금이 많이 붙는 자산일수록 절세계좌 안으로"), "."), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-3" }, [
    ["국내 주식 · 국내주식형 ETF", "일반계좌 OK", false, "매매차익이 원래 비과세라 아까운 절세 한도를 쓸 필요가 없어요. 2027년 생산적금융 ISA가 생기면 배당까지 비과세인 그쪽으로."],
    ["배당주 · 리츠 · 채권 · 파킹형", "ISA", true, "이자·배당세 15.4%가 비과세 200만+9.9%로. 배당이 잦을수록 ISA에 넣는 효과가 커져요."],
    ["국내상장 해외 ETF (S&P500 등)", "연금계좌 · ISA", true, "일반계좌에선 매매차익까지 배당소득 15.4%로 잡히고 금융소득종합과세(연 2,000만 초과)에 합산돼요. 연금계좌면 과세이연 후 3.3~5.5%, ISA면 9.9%."],
    ["해외주식 직접투자 (미국 직투)", "일반계좌만 가능", false, "ISA·연금계좌엔 담을 수 없어요. 양도차익은 연 250만 공제 후 22% — 대신 금융소득종합과세와는 별개라 고소득자에겐 이 나름의 장점."]
  ].map(([asset, where, hot, why], i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "rounded-xl bg-[#FAFAFA] p-4" }, /* @__PURE__ */ React.createElement("span", { className: `inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${hot ? "bg-[#0A0A0A] text-white" : "bg-[#ECECEC] text-[#525252]"}` }, where), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold leading-snug mt-2" }, asset), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mt-1.5" }, why)))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "하지 말 것", title: "흔한 실수 5가지" }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4" }, [
    ["연금계좌 중도해지", "공제받은 원금+수익 전체에 16.5%. 그간 환급을 다 토해내요. 힘들면 해지 대신 납입 중지·감액부터."],
    ["ISA 3년 내 해지", "감면받은 세금을 추징당해요. 급전은 해지 말고 원금 범위 내 인출로."],
    ["IRP에 여윳돈 몰빵", "공제되는 300만까지만. 초과분은 55세까지 사실상 못 꺼내는 돈이 돼요."],
    ["국내상장 해외 ETF를 일반계좌에 방치", "차익이 배당소득 15.4%로 잡히고 연 2,000만 넘으면 금융소득종합과세까지."],
    ["공제한도 초과 납입 후 그냥 두기", "초과분은 납입연도 전환 신청으로 다음 해 공제를 받을 수 있어요. 몰라서 안 쓰는 사람이 대부분."]
  ].map(([t, d], i) => /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold mb-1" }, "✕ ", t), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, d)))))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-6 items-start" }, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "세금 폭탄 예방", title: "배우자간 자금 이동 계산기" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed mb-4" }, "배우자 증여재산공제는 10년간 6억원. 넘는 만큼만 증여세가 붙어요."), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-4 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "이체 검토 금액(만원)", value: gift.giftAmount, onChange: (v) => setGift({ ...gift, giftAmount: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "최근 10년 기사용 공제(만원)", value: gift.spouseGiftUsed, onChange: (v) => setGift({ ...gift, spouseGiftUsed: v }) })), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement(Stat, { label: "잔여 배우자 증여공제(10년)", value: won(spouseExemption * 1e4) }), /* @__PURE__ */ React.createElement(Stat, { label: "공제 초과 과세대상 금액", value: won(giftTaxableBase) }), /* @__PURE__ */ React.createElement(Stat, { label: "예상 증여세 (기한 내 신고 3% 공제 후)", value: giftTaxOwed > 0 ? won(giftTaxOwed) : "0원(공제 범위 안)", tone: giftTaxOwed > 0 ? "warn" : "good" })))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "실전 수칙", title: "세금 폭탄 예방" }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-3 text-[15px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("p", null, "• ", /* @__PURE__ */ React.createElement("b", null, "부모님 증여:"), " 각자 자기 부모님께 혼인신고일 전 2년~후 2년 안에 받으면 1인 1.5억(기본 5천만 + 혼인 1억), 부부 합산 최대 3억원까지 증여세가 없어요. 기본 5천만은 10년 합산, 혼인 1억은 출산 공제와 합쳐 1억 한도예요."), /* @__PURE__ */ React.createElement("p", null, "• ", /* @__PURE__ */ React.createElement("b", null, "부모님께 무이자로 빌리기:"), " 빌린 돈 × 적정이자율(연 4.6%)이 연 1천만원 미만이면 증여세가 없어요 — 약 2억 1,700만원까지예요(상속세 및 증여세법 제41조의4). 1년 단위로 다시 계산하고, 진짜 빌린 돈이라는 증거(차용증·실제 상환 기록)가 없으면 증여로 봐요."), /* @__PURE__ */ React.createElement("p", null, "• ", /* @__PURE__ */ React.createElement("b", null, "공동명의 매매:"), " 지분율은 실제로 낸 돈의 비율과 맞춰요."), /* @__PURE__ */ React.createElement("p", null, "• ", /* @__PURE__ */ React.createElement("b", null, "자금조달계획서:"), " 투기과열지구에서 집을 사면 금액과 관계없이 모두 내야 해요.")))))), tab === "policy" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "우리 기준 자동 판정", title: "신혼부부 정책·혜택 체크" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4" }, /* @__PURE__ */ React.createElement(LiveUpdateBtn, { topic: "policies", params: `&income=${incomeTotal}`, onData: (j) => setPolicyData({ items: j.items, at: j.fetchedAt }) }))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "부부 연소득 합산 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, manWon(incomeTotal)), "(홈에 적은 값) 기준으로 받을 수 있는 것과 막히는 것을 나눴어요. ", policyData.at && policyData.at >= POLICY_BENEFITS_AT ? `${policyData.at.slice(0, 10)}에 웹에서 조사한 내용이에요.` : `기본 데이터는 ${POLICY_BENEFITS_AT}에 공식 자료와 대조했어요.`, " [최신 정보로 갱신]을 누르면 지금 시점 정책을 웹에서 다시 조사해요."))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, policies.map((p, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold" }, p.name), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5 shrink-0" }, p.auto && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-semibold text-[#6B6B6B]", title: "홈의 부부 소득·자산으로 자동 판정" }, "🔗 자동 판정"), /* @__PURE__ */ React.createElement(ToneBadge, { tone: p.fit }, p.fitText))), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1.5" }, p.target), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-2" }, p.benefit), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3 bg-[#FAFAFA] rounded-lg px-3 py-2" }, p.why), /* @__PURE__ */ React.createElement("a", { href: safeUrl(p.link), target: "_blank", rel: "noopener noreferrer", className: "mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" }, "공식 안내 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 })))))), /* @__PURE__ */ React.createElement(NewsPanel, { query: "신혼부부 정책 혜택", eyebrow: "놓치는 정책 없게", title: "신혼부부 정책 뉴스" })), tab === "stocks" && /* @__PURE__ */ React.createElement(StocksTab, { hh, privacy }), tab === "ledger" && /* @__PURE__ */ React.createElement(LedgerTheme, { privacy, hh }), tab !== "ledger" && /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "saving" })));
}
const WEDDING_TABS = [
  { id: "overview", label: "개요", icon: "heart" },
  { id: "budget", label: "예산표", icon: "piggy" },
  { id: "checklist", label: "체크리스트", icon: "check2" },
  { id: "vendors", label: "업체 고르기", icon: "building" },
  { id: "guests", label: "하객 리스트", icon: "users" },
  { id: "honeymoon", label: "신혼여행", icon: "plane" }
];
const naverSearch = (q) => `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
const naverBlog = (q) => `https://search.naver.com/search.naver?ssc=tab.blog.all&query=${encodeURIComponent(q)}`;
function mergeVendorResearch(prev, items, idPrefix, isCustom) {
  const imgByName = {}, lookupByName = {};
  (prev || []).forEach((x) => {
    if (x.img) imgByName[x.name] = x.img;
    if (x.lookup) lookupByName[x.name] = x.lookup;
  });
  const names = new Set((items || []).map((v) => v.name));
  const kept = (prev || []).filter((x) => isCustom(x) && !names.has(x.name));
  const taken = new Set(kept.map((x) => x.id));
  let n = 0;
  const fresh = (items || []).map((v) => {
    while (taken.has(idPrefix + n)) n++;
    return { ...v, id: idPrefix + n++, img: imgByName[v.name] || v.img || "", ...lookupByName[v.name] ? { lookup: lookupByName[v.name] } : {} };
  });
  return [...fresh, ...kept];
}
function uniqIds(list) {
  const seen = /* @__PURE__ */ new Set();
  let dup = false;
  const out = (list || []).map((x) => {
    if (!seen.has(x.id)) {
      seen.add(x.id);
      return x;
    }
    dup = true;
    const id = uid();
    seen.add(id);
    return { ...x, id, custom: true };
  });
  return dup ? out : list;
}
function useUniqIds(list, setList) {
  useEffect(() => {
    if (cloud.enabled && !cloud.hydrated) return;
    const fixed = uniqIds(list);
    if (fixed !== list) setList(fixed);
  }, [list]);
}
let vgLoad = null;
const loadVerygood = () => vgLoad || (vgLoad = fetch("data/verygood-vendors.json").then((r) => r.ok ? r.json() : null).catch(() => null).then((j) => {
  if (!j) vgLoad = null;
  return j;
}));
const VG_KINDS = ["studio", "dress", "makeup"];
const vgImg = (base, p) => !p ? "" : /^https?:\/\//i.test(p) ? p : `/api/vg-img?p=${encodeURIComponent(p)}`;
const vgConcept = (v) => (String(v.intro || "").split("\n").map((s) => s.trim()).find(Boolean) || "").slice(0, 80);
const MOOD_KEY = "wedding-mood-picks-v1";
const MOOD_VENDOR_KEY = "wedding-mood-vendors-v1";
const MOOD_PAGE = 8;
const SNAP_PHOTOS_KEY = "wedding-vendor-photos-v1";
const SNAP_PHOTOS_TTL = 7 * 864e5;
const igHandle = (u) => (String(u || "").match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i) || [])[1] || "";
const MOOD_SHOW = 6;
const bigThumb = (u) => /^https:\/\/search\.pstatic\.net\//i.test(u || "") ? /[?&]type=/.test(u) ? u.replace(/([?&]type=)[^&]*/, "$1sc960_832") : u + (u.includes("?") ? "&" : "?") + "type=sc960_832" : u;
const moodWho = () => {
  try {
    const u = firebase.auth().currentUser;
    return u && (u.displayName || String(u.email || "").split("@")[0]) || "우리";
  } catch {
    return "우리";
  }
};
function PickHeart({ on, onClick, className = "" }) {
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": on,
      "aria-label": on ? "고른 사진 빼기" : "사진 고르기",
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      className: `w-11 h-11 flex items-center justify-center shrink-0 ${className}`
    },
    /* @__PURE__ */ React.createElement("span", { className: `w-8 h-8 rounded-full flex items-center justify-center text-[18px] leading-none ${on ? "bg-white text-[#E11D48] shadow" : "bg-black/45 text-white"}` }, on ? "♥" : "♡")
  );
}
function VendorHeart({ on, onClick, dark }) {
  const tone = on ? dark ? "bg-white text-[#E11D48]" : "bg-[#FFE4E6] text-[#E11D48]" : dark ? "bg-white/20 text-white" : "bg-[#F0F0F0] text-[#0A0A0A] hover:bg-[#E5E5E5]";
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": on,
      "aria-label": on ? "고른 업체 빼기" : "업체 고르기",
      title: on ? "누르면 고른 업체에서 빠져요" : void 0,
      onClick: (e) => {
        e.stopPropagation();
        onClick();
      },
      className: `h-8 pl-2 pr-3 rounded-lg text-[12px] font-bold inline-flex items-center gap-1 shrink-0 ${tone}`
    },
    /* @__PURE__ */ React.createElement("span", { className: "text-[16px] leading-none" }, on ? "♥" : "♡"),
    on ? "고른 업체" : "업체 고르기"
  );
}
function MoodTile({ src, name, on, onPick, onOpen, badge, className = "", showName = true, square }) {
  return /* @__PURE__ */ React.createElement("div", { "data-cell": true, className: `min-w-0 ${className}` }, /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onOpen, "aria-label": `${name} 사진 크게 보기`, className: `block w-full overflow-hidden bg-[#F0F0F0] ${square ? "aspect-square" : "aspect-[4/5] rounded-xl"}` }, /* @__PURE__ */ React.createElement(
    "img",
    {
      src,
      alt: "",
      loading: "lazy",
      decoding: "async",
      referrerPolicy: "no-referrer",
      className: "w-full h-full object-cover",
      onError: (e) => {
        const c = e.currentTarget.closest("[data-cell]");
        if (c) c.style.display = "none";
      }
    }
  )), /* @__PURE__ */ React.createElement(PickHeart, { on, onClick: onPick, className: "absolute top-0 right-0" }), badge && /* @__PURE__ */ React.createElement("span", { className: "absolute left-1.5 bottom-1.5 max-w-[80%] truncate px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold" }, badge)), showName && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[11px] text-[#6B6B6B] truncate" }, name));
}
function VendorLookup({ v, kind, onSave }) {
  const [st, setSt] = useState({ busy: false, err: "", note: "" });
  const [big, setBig] = useState(null);
  const lk = v.lookup, imgs = lk && lk.images || [], info = lk && lk.info;
  const find = async () => {
    setSt({ busy: true, err: "", note: "" });
    try {
      const r = await withTimeout(authFetch("/api/vendor-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, name: String(v.name || "").trim().slice(0, 40), area: String(v.area || "").trim().slice(0, 20), handle: igHandle(v.url) })
      }), 65e3, "응답이 1분을 넘겼어요 — 잠시 후 [다시 찾기]를 눌러 주세요.");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw new Error(j && j.message || (r.status === 504 ? "1분 안에 못 끝냈어요 — 잠시 후 [다시 찾기]를 눌러 주세요." : `정보를 찾지 못했어요(${r.status}) — 잠시 후 다시 눌러 주세요.`));
      onSave({ images: j.images || [], info: j.info || null, at: j.at || (/* @__PURE__ */ new Date()).toISOString() });
      setSt({ busy: false, err: "", note: j.note || "" });
    } catch (e) {
      setSt({ busy: false, err: String(e && e.message || e), note: "" });
    }
  };
  const big1 = (im) => /^https:\/\//i.test(im.link || "") ? im.link : im.thumb;
  const chip = "inline-block text-[11px] font-semibold text-[#525252] bg-white border border-black/[0.06] rounded-full px-2 py-0.5";
  const link = "text-[12px] font-semibold underline underline-offset-4";
  return /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, imgs.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5 mb-2 overflow-x-auto" }, imgs.slice(0, 6).map((im, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: im.thumb,
      type: "button",
      onClick: () => setBig(i),
      "aria-label": `${v.name} 사진 ${i + 1} 크게 보기`,
      className: "w-12 h-12 rounded-lg overflow-hidden bg-[#F0F0F0] shrink-0"
    },
    /* @__PURE__ */ React.createElement(ThumbImg, { src: im.thumb, alt: im.title || v.name, fallback: /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-[#6B6B6B]" }, "없음") })
  ))), info && /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-3 py-2.5 mb-2 text-[13px] leading-relaxed" }, info.concept && /* @__PURE__ */ React.createElement("p", { className: "font-semibold text-[#0A0A0A]" }, info.concept), info.styles && info.styles.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mt-1.5" }, info.styles.map((s) => /* @__PURE__ */ React.createElement("span", { key: s, className: chip }, s))), info.priceHint && info.sources && info.sources.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "찾은 가격 "), /* @__PURE__ */ React.createElement("span", { className: "font-semibold" }, info.priceHint)), info.location && /* @__PURE__ */ React.createElement("div", { className: "mt-0.5 text-[12px] text-[#6B6B6B]" }, "위치 ", info.location), (safeUrl(info.instagram) || safeUrl(info.homepage)) && /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 mt-1.5" }, safeUrl(info.instagram) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(info.instagram), target: "_blank", rel: "noopener noreferrer", className: link }, "인스타그램"), safeUrl(info.homepage) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(info.homepage), target: "_blank", rel: "noopener noreferrer", className: link }, "홈페이지")), ((info.highlights || []).length > 0 || (info.cautions || []).length > 0) && /* @__PURE__ */ React.createElement("details", { className: "mt-1.5" }, /* @__PURE__ */ React.createElement("summary", { className: "cursor-pointer text-[12px] font-semibold text-[#525252]" }, "특징 ", (info.highlights || []).length, "개 · 주의 ", (info.cautions || []).length, "개 보기"), /* @__PURE__ */ React.createElement("ul", { className: "mt-1 space-y-0.5 text-[12px] text-[#525252]" }, (info.highlights || []).map((h, i) => /* @__PURE__ */ React.createElement("li", { key: "h" + i }, "· ", h)), (info.cautions || []).map((c, i) => /* @__PURE__ */ React.createElement("li", { key: "c" + i, className: "text-[#8A5A00]" }, "주의 · ", c)))), info.sources && info.sources.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[11px] text-[#6B6B6B] flex flex-wrap gap-x-2" }, /* @__PURE__ */ React.createElement("span", null, "출처"), info.sources.map((s, i) => safeUrl(s.url) && /* @__PURE__ */ React.createElement("a", { key: i, href: safeUrl(s.url), target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-2 truncate max-w-[160px]" }, s.title || `링크 ${i + 1}`)))), lk && lk.at && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-1.5" }, String(lk.at).slice(0, 10), " 조사 · 참고용", imgs.length ? " · 사진: 네이버 이미지 검색" : ""), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: find, disabled: st.busy, className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#F0F0F0] text-[#0A0A0A] hover:bg-[#E5E5E5] disabled:opacity-50 shrink-0" }, st.busy ? "사진·후기 찾는 중… 20~40초" : lk ? "다시 찾기" : "정보 찾기"), (st.err || st.note) && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#8A5A00] min-w-0" }, st.err || st.note)), big != null && imgs[big] && /* @__PURE__ */ React.createElement(PhotoViewer, { srcs: imgs.map(big1), fallbacks: imgs.map((im) => im.thumb), index: big, onIndex: setBig, onClose: () => setBig(null), label: `${v.name} 사진`, caption: "사진: 네이버 이미지 검색" }));
}
const IG = (h) => `https://www.instagram.com/${h}`;
const SNAP_DM_ADD = [
  ["gabo.jeju", "@gabo.jeju (가보 제주스냅)", "제주", "DM 공유 게시물: '가보 제주스냅 예약중'"],
  ["ifwelove_", "@ifwelove_", "제주", "DM 공유 게시물: 제주 스냅 — '사랑스럽다는 말이 가장 잘 어울리는 사람'"],
  ["bemymuse.studio", "@bemymuse.studio", "제주", "DM 공유 게시물: '합리적인 제주스냅을 찾으셨나요?'"],
  ["viansnap.jeju", "@viansnap.jeju", "제주", "DM으로 공유받은 제주 스냅 계정"],
  ["arohaday.jeju", "@arohaday.jeju", "제주", "DM으로 공유받은 제주 스냅 계정"],
  ["factstudio_kr", "@factstudio_kr", "지역 문의", "DM으로 공유받은 스튜디오 계정"],
  ["habit_film", "@habit_film", "지역 문의", "DM으로 공유받은 스냅·영상 계정"],
  ["cheesebutter_snap", "@cheesebutter_snap (아이폰 스냅)", "지역 문의", "DM 공유 게시물: '자연스러운 그날의 분위기를 담아요'"],
  ["brightbride.snap", "@brightbride.snap", "지역 문의", "DM 공유 게시물: '결혼식에 노을이 내린다면?' — 본식 스냅"],
  ["damda.seoul", "@damda.seoul", "서울", "DM 공유 게시물: '꿈은 없고요 그냥 찍고 싶습니다'"]
].map(([h, name, area, note]) => ({ id: `dm-${h}`, name, area, price: "문의", note: `${note} · 가격·일정은 인스타그램에서 확인`, url: IG(h), img: "", custom: true }));
const VENDOR_ADDS = [
  ["sdress", "uao_hairmakeup", "유아오 (UAO)", "제주", "문의", "청담 출신 아티스트 팀 — 2:1 현장 동행·디렉팅, 웨딩드레스 700벌+, 생화 헤어 변형. 패키지 가격은 블로그 '유아오 패키지 상품안내'·카카오 채널 '유아오'", "2026-10-06"],
  ["biphone", "seren.snap", "세렌스냅", "서울 (예식장 출장)", "문의", "아이폰·디카·폴라로이드 스냅, 무음 촬영 — 27년 10월까지 예약. DM 공유 게시물(클라우디아 드레스 뒷모습 컷)", "2026-10-06"],
  ["planner", "shinsj_pl", "베리굿웨딩 · 신수진 부장", "베리굿웨딩", "문의", "13년차 웨딩플래너, 드레스 디자이너 경력 — 클라우디아 드레스 게시물(DM 공유)", "2026-10-06"],
  // 유아오 패키지 제휴(2026-10-07 유아오 안내) — 연락할 때 "유아오에서 링크 공유 받아 연락드립니다"
  ["ssuit", "horsetailor_", "홀스테일러", "제주", "유아오 패키지 포함 (셔츠 1만·구두 2만 대여)", `제주 웨딩스냅 전문 정장 대여 — 유아오 패키지 제휴, 예약 완료. 상담·일정은 카카오 채널 '홀스테일러'(pf.kakao.com/_nPQxfn)에서, 희망 컬러·사이즈를 같이 보내면 빨라요. "유아오에서 링크 공유 받아 연락드립니다"`, "2026-10-07"],
  ["sbouquet", "_twolittleflower_", "투리틀플라워", "제주 (아라동)", "15~25만 (유아오 제휴 범위)", `유아오 제휴 부케 — 앞선 신부님 후기가 가장 좋았던 곳(유아오 추천). 상담·결제·배송은 카카오 채널 '투리틀플라워'(pf.kakao.com/_BLqxln)로 직접. 부케 디자인·색감 시안을 보내면 상담이 빨라요, 꽃 종류·크기에 따라 추가 비용. "유아오에서 링크 공유 받아 연락드립니다"`, "2026-10-07"],
  ["sbouquet", "yeflry", "예플리", "제주시 오남로6길 29-1", "15~25만 (유아오 제휴 범위)", `유아오 제휴 부케 — 유아오 추천(후기 좋음). 꽃다발·부케 예약, 스튜디오 대관도. 인스타 DM은 안 받고 카카오 채널 '예플리'(pf.kakao.com/_xbBWxfG)로 상담. 시안 공유하면 빠르고, 꽃 종류·크기에 따라 추가 비용. "유아오에서 링크 공유 받아 연락드립니다"`, "2026-10-07"]
].map(([kind, h, name, area, price, note, at]) => ({ kind, id: `ref-${kind}-${h}`, name, area, price, note, url: IG(h), img: "", custom: true, addedAt: at }));
const SNAP_ADD_V2 = [
  ["__gieok", "기억 (@__gieok)", "제주", "웨딩데이·스튜디오·해외(파리·삿포로) 스냅 — 27년 상반기·26년 11월 잔여 예약, 카카오 채널 상담 (인스타 소개 기준)"]
].map(([h, name, area, note]) => ({ id: `ig-${h}`, name, area, price: "문의", note, url: IG(h), img: "", custom: true }));
const GIEOK = {
  price: "스냅 100만",
  note: "기억스냅 100만(오후~노을 4시간, 3곳, 의상 3벌, 세부수정 25+색감수정 10, 드론) · 기억 studio 135만(5시간, 세부 30+색감 10). 옵션: 불꽃놀이 15만, 필름 1롤 10만(최대 2롤), 선보정 10만. 본식 스냅과 같이 하면 10만, 블로그 후기 쓰면 5만 할인. 원본은 촬영 후 10일 안 메일, 보정본은 고른 뒤 60일 안(RAW 없음). 환불: 예약 7일 안 100%, 이후 50%, 촬영 60일 전부터 환불 불가, 일정 변경은 촬영 90일 전까지. 결항이면 100% 환불, 날씨가 나쁘면 날짜 변경"
};
const DM_REFS = {
  wedding: [
    ["웨딩홀도 할인받을 수 있다", "uidolove", "reel/DbpJcgYyam6/"],
    ["웨딩홀 견적 비교할 때", "wedd_yoi", "reel/DcqJnl0RwHQ/"],
    ["같은 홀인데 옆 커플이 100만원 더 싸게 계약했다면", "ppodeuk_i", "reel/DcsuW3qRsOl/"],
    ["피팅비 냈는데 사진 촬영은 안 된다?", "8allang", "reel/Dam0yZiTd0z/"],
    ["웨딩 촬영, 시안이 있고 없고의 차이", "ooung.ah", "reel/DcmmcJ5ht5Y/"],
    ["1년 4개월 전부터 본식 직전까지 준비 순서", "pumine.zip", "reel/DcOGJutzSz6/"],
    ["27년 가을 결혼비용 4,000만원 사례", "wedding_receipt_", "reel/DdQqC8JR7ZI/"],
    ["대관료 400만원대 서울 웨딩홀 정리", "marsh.mallow.bubu", "reel/DdTqfUKxVB9/"]
  ],
  realty: [
    ["신혼부부 특공 vs 생애최초 특공", "you_dongsan", "reel/DWI9QYTkVBQ/"],
    ["혼인신고 타이밍과 대출 이자", "bbong_bubu", "reel/DWYwMhKE2rZ/"],
    ["생애최초 8억 집 구매 비용 정리", "economy.notes", "p/DbuWrfaphlV/"],
    ["서울 신혼부부 미리내집 496세대 모집(2026.8)", "theflow.daily", "p/DcSKhewST_H/"],
    ["하반기부터 청약 기회가 늘어난다", "you_dongsan", "reel/DcA286wxcJ0/"],
    ["서울 6억대 단지 선별", "apt_sum", "p/DaXTVRePmIK/"]
  ]
};
const DM_EXTRA_NOTES = [
  ["notes-realty-v1", { id: "dm-seoul-6eok", title: "서울 6억대 20평대 단지 (@apt_sum, 2026년 7월 1주차)", body: `네이버부동산 실매물 기준으로 게시자가 고른 목록이에요. 지금 시세는 관심 매물 [매매 시세 조회]로 다시 확인해요.

노원: 상계동 벽산·상계주공16·1·11단지·수락리버시티4단지 / 공릉동 삼익4단지·우성·비선·우방 / 월계동 월계주공2단지(추천)
관악: 신림동 건영1차·건영3차·관악산휴먼시아1단지·신림푸르지오2차·관악산휴먼시아2단지(추천)
강북: 수유동 수유래미안 / 미아동 벽산라이브파크(추천)
성북: 정릉동 정릉스카이쌍용(추천)·정릉풍림아이원
구로: 고척동 한일유앤아이(추천)·동아한신
강서: 방화동 방화동부센트레빌2차(추천)·방화3단지청솔
중랑: 면목동 면목한신(추천)·면목두산4,5단지
도봉: 창동 창동대우
양천: 신정동 푸른마을3단지
강남: 대치동 테헤란로대우아이빌

https://www.instagram.com/p/DaXTVRePmIK/` }],
  ["notes-saving-v1", { id: "dm-money-habits", title: "신혼부부 돈 관리 습관 (인스타 DM 공유 게시물)", body: `게시자 경험담이에요.

@haus.of.nano — 결혼 얘기가 나오면 통장부터 합치기. 월급은 들어오자마자 모으기, 용돈은 각자 20만원, 생활비는 카드 한 장으로, 남는 돈은 자동 투자.
https://www.instagram.com/p/DYxDOPISH7H/

@danbu_happy — 신혼 3년 만에 서울 아파트를 산 습관: 통장 합치기, 생활비 40만원, 부부 용돈 30만원, 주말 새벽 임장, 스드메 200만원, 신혼여행 뒤 해외여행 안 가기, 신혼특공 여러 번 도전, 계약 전 매물 50개 이상 보기, 매수 뒤 경기도 월세살이로 주거비 줄이기.
https://www.instagram.com/p/DacgiWfB8f7/` }]
];
const HONEYMOON_MONTHS_NOTE = `게시자 의견이에요(예비 신부가 직접 정리). 날씨·가격은 떠나기 전에 다시 확인해요.

1월 몰디브 — 바다색이 1년 중 가장 맑아요
2월 칸쿤 — 선선하고, 올인클루시브라 예산 걱정이 적어요
3월 코사무이(태국) — 다른 동남아보다 아직 선선해요, 풀빌라 추천
4월 교토·도쿄 — 벚꽃 시기, 숙소는 반년 전에 예약
5월 이탈리아 아말피·포지타노 — 덥지도 습하지도 않아요
6월 파리·남프랑스 — 라벤더가 피기 시작해요
7월 발리 — 동남아가 우기일 때 발리는 건기예요
8월 스위스 인터라켄 — 눈 덮인 산과 초록 들판, 패러글라이딩
9월 그리스 산토리니 — 성수기가 끝나 한적하고 노을이 좋아요
10월 하와이 — 비와 파도가 적어 스노클링하기 좋아요
11월 스페인 안달루시아 — 유럽이 추워질 때도 따뜻해요(세비야·그라나다)
12월 호주 시드니·골드코스트 — 남반구 여름 시작

https://www.instagram.com/p/DdprDSRmGbr/`;
const VENDOR_STAFF = {
  "noma.house": [
    ["김태경 대표", "noma.house"],
    ["최희윤 실장", "noma_huiyun"],
    ["김재민 실장", "noma_min"],
    ["구영우 실장", "noma_youngwoo"],
    ["최지연 실장", "noma_jiyeon"],
    ["이승환 실장", "noma_lsh"],
    ["공은진 실장", "noma_eunjin"],
    ["전도해 실장", "noma_dohae"],
    ["최승현 실장", "noma_hyeon"],
    ["김지광 실장", "noma_jigang"],
    ["권혁제 실장", "noma_kwon"]
  ]
};
const vendorStaff = (v) => {
  const m = /instagram\.com\/([\w.]+)/i.exec(v && v.url || "");
  return m && VENDOR_STAFF[m[1].toLowerCase()] || null;
};
function useDmRefNotes() {
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("dm-refs-note-v1", false) && store.get("dm-honeymoon-note-v1", false) && store.get("dm-extra-v1", false) && store.get("ring-ago-added-v1", false)) return;
      if (!store.get("dm-refs-note-v1", false)) for (const [cat, title] of [["wedding", "결혼 준비 참고 게시물 (인스타 DM으로 공유받음)"], ["realty", "청약·집 구하기 참고 게시물 (인스타 DM으로 공유받음)"]]) {
        const key = `notes-${cat}-v1`, notes = store.get(key, []), id = `dm-refs-${cat}`;
        if (notes.some((n) => n.id === id)) continue;
        const body = DM_REFS[cat].map(([tt, h, path]) => `${tt} (@${h})
https://www.instagram.com/${path}`).join("\n\n") + "\n\n게시물 속 가격·조건은 앱이 확인한 사실이 아니에요. 볼 때 날짜와 출처를 같이 확인해요.";
        setKey(key, [...notes, { id, at: Date.now(), title, body }]);
      }
      setKey("dm-refs-note-v1", true);
      if (!store.get("dm-extra-v1", false)) {
        const ck = store.get("wedding-checklist-v2", null);
        if (ck) {
          const have = new Set(ck.flatMap((g) => g.items.map((i) => i.text)));
          const add = SHOOT_PREP.filter((t2) => !have.has(t2)).map((t2) => ({ id: uid(), text: t2, done: false }));
          const gi = Math.max(0, ck.findIndex((g) => g.cat === "D-6~3개월"));
          if (add.length && ck.length) setKey("wedding-checklist-v2", ck.map((g, i) => i === gi ? { ...g, items: [...g.items, ...add] } : g));
        }
        for (const [key, note] of DM_EXTRA_NOTES) {
          const notes = store.get(key, []);
          if (!notes.some((n) => n.id === note.id)) setKey(key, [...notes, { ...note, at: Date.now() }]);
        }
        setKey("dm-extra-v1", true);
      }
      if (!store.get("ring-ago-added-v1", false)) {
        const cur = store.get("wedding-vendor-ring-v4", null);
        if (Array.isArray(cur) && !cur.some((v) => sameVendor(v, RING_AGO))) setKey("wedding-vendor-ring-v4", [...cur, { id: "dm-ago", ...RING_AGO, at: Date.now() }]);
        setKey("ring-ago-added-v1", true);
      }
      if (!store.get("dm-honeymoon-note-v1", false)) {
        const notes = store.get("notes-wedding-v1", []);
        if (!notes.some((n) => n.id === "dm-honeymoon-months")) setKey("notes-wedding-v1", [...notes, { id: "dm-honeymoon-months", at: Date.now(), title: "월별 신혼여행지 추천 (@ohmywedding._ 게시물)", body: HONEYMOON_MONTHS_NOTE }]);
        setKey("dm-honeymoon-note-v1", true);
      }
    };
    t = setTimeout(run, 1500);
    return () => clearTimeout(t);
  }, []);
}
const CONTRACT_PART = 88e4;
const contractRef = (id, i) => cloud.db && cloud.ref().collection("contracts").doc(`${id}_${i}`);
async function saveContractFile(file) {
  if (!cloud.db || !cloud.user) throw new Error("로그인해야 계약서를 올릴 수 있어요");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf && !/^image\//.test(file.type)) throw new Error("PDF나 사진 파일을 올려 주세요");
  if (isPdf && file.size > 6 * 1024 * 1024) throw new Error("PDF가 6MB를 넘어요 — 필요한 쪽만 올려 주세요");
  let data = isPdf ? await readDataUrl(file) : await shrinkImage(file, 2200, 0.85);
  if (!isPdf && data.length > CONTRACT_PART) data = await shrinkImage(file, 1700, 0.8);
  const id = uid(), parts = Math.ceil(data.length / CONTRACT_PART), by = cloud.user.email || "";
  for (let i = 0; i < parts; i++) await contractRef(id, i).set({ data: data.slice(i * CONTRACT_PART, (i + 1) * CONTRACT_PART), fileId: id, part: i, at: Date.now(), by });
  return { id, name: String(file.name || (isPdf ? "계약서.pdf" : "계약서.jpg")).slice(0, 80), type: isPdf ? "pdf" : "image", parts, size: file.size, at: Date.now(), by };
}
async function loadContractFile(f) {
  const docs = await Promise.all(Array.from({ length: f.parts }, (_, i) => contractRef(f.id, i).get()));
  if (docs.some((d) => !d.exists)) throw new Error("파일 일부가 없어요 — 다시 올려 주세요");
  return docs.map((d) => d.data().data).join("");
}
const deleteContractFile = (f) => {
  for (let i = 0; i < f.parts; i++) {
    const r = contractRef(f.id, i);
    if (r) r.delete().catch(() => {
    });
  }
};
const dataUrlBlob = (u) => {
  const [h, b64] = u.split(","), bin = atob(b64), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: (/data:([^;]+)/.exec(h) || [])[1] || "application/octet-stream" });
};
function ContractFiles({ files, onAdd, onRemove }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [view, setView] = useState(null);
  const add = async (list) => {
    setBusy(true);
    setErr("");
    try {
      for (const f of Array.from(list || []).slice(0, 10)) onAdd(await saveContractFile(f));
    } catch (e) {
      setErr(String(e && e.message || e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  };
  const open = async (f) => {
    setErr("");
    const w = f.type === "pdf" ? window.open("", "_blank") : null;
    try {
      const u = await loadContractFile(f);
      if (f.type === "pdf") {
        const url = URL.createObjectURL(dataUrlBlob(u));
        if (w) w.location.href = url;
        else window.location.href = url;
      } else setView(u);
    } catch (e) {
      if (w) w.close();
      setErr(String(e && e.message || e));
    }
  };
  const kb = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
  return /* @__PURE__ */ React.createElement("div", null, files.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5 mb-2" }, files.map((f) => /* @__PURE__ */ React.createElement("div", { key: f.id, className: "flex items-center gap-2 rounded-xl bg-[#FAFAFA] pl-3 pr-1 py-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-[16px] shrink-0", "aria-hidden": "true" }, f.type === "pdf" ? "📄" : "🖼"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => open(f), className: "min-w-0 flex-1 text-left py-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold truncate underline underline-offset-4" }, f.name), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, f.type === "pdf" ? "PDF" : "사진", " · ", kb(f.size || 0), " · ", new Date(f.at).toISOString().slice(0, 10))), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "첨부 삭제", onClick: () => {
    if (window.confirm(`'${f.name}'을(를) 지울까요?`)) {
      deleteContractFile(f);
      onRemove(f.id);
    }
  }, className: "!w-9 !h-9" })))), /* @__PURE__ */ React.createElement("label", { className: `h-10 px-3.5 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold inline-flex items-center gap-1 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}` }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " ", busy ? "올리는 중…" : "계약서 사진·PDF 첨부", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "application/pdf,.pdf,image/*", multiple: true, className: "hidden", onChange: (e) => {
    const fl = e.target.files;
    add(fl).finally(() => {
      e.target.value = "";
    });
  } })), err && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] font-semibold text-[#8A5A00]" }, err), view && /* @__PURE__ */ React.createElement(PhotoViewer, { srcs: [view], index: 0, onIndex: () => {
  }, onClose: () => setView(null), label: "계약서" }));
}
function AutoArea({ value, onChange, minRows = 4, className = "", ...rest }) {
  const ref = useRef(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.scrollHeight + 2, max = Math.max(200, Math.round(window.innerHeight * 0.6));
    el.style.height = `${Math.min(h, max)}px`;
    el.style.overflowY = h > max ? "auto" : "hidden";
  };
  React.useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);
  return /* @__PURE__ */ React.createElement("textarea", { ref, value, onChange, rows: minRows, className: `${className} resize-none`, style: { overscrollBehavior: "contain" }, ...rest });
}
const DATE_CLS = "h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold w-full min-w-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors";
const AREA_CLS = "w-full px-2.5 py-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] leading-relaxed focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors";
function VendorDetailPanel({ kind, label, vendor, item, detail, onPatch, onBrowse, onUnconfirm, snap, onGo, privacy, extra, after, cost }) {
  const d = detail || vendorDetailSeed(kind);
  const set = (k, v) => onPatch((cur) => ({ ...cur, [k]: v }));
  const patchRow = (field, id, k, v) => onPatch((cur) => ({ ...cur, [field]: (cur[field] || []).map((r) => r.id === id ? { ...r, [k]: v } : r) }));
  const addRow = (field, row) => onPatch((cur) => ({ ...cur, [field]: [...cur[field] || [], { id: uid(), ...row }] }));
  const delRow = (field, id) => onPatch((cur) => ({ ...cur, [field]: (cur[field] || []).filter((r) => r.id !== id) }));
  const pays = d.pays || [], events = d.events || [];
  const total = cost ? cost.total : detailTotal(d) || 0, paid = paidOf(d), sum = paysSum(d);
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const next = events.filter((e) => e.date && !e.done && e.date >= today).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
  const nextPay = pays.filter((p) => !p.paid && Number(p.amt) > 0).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
  const url = safeUrl(item && item.url || vendor.url);
  const isShoot = (e) => /촬영/.test(e.label || "");
  const handle = igHandle(url).toLowerCase(), partners = kind === "snap" && SNAP_PARTNERS[handle];
  const chip = (on) => `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${on ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#525252] hover:bg-[#EBEBEB]"}`;
  const ddayOf = (s) => {
    const n = Math.round((Date.parse(s) - Date.parse(today)) / 864e5);
    return n === 0 ? "오늘" : n > 0 ? `D-${n}` : `D+${-n}`;
  };
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "rounded-3xl bg-[#0A0A0A] text-white px-5 py-6 lg:px-7 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-white/60 mb-1.5" }, label, " · 확정 ✓"), /* @__PURE__ */ React.createElement("div", { className: "text-[26px] lg:text-[30px] font-bold leading-tight break-keep" }, vendor.name), (vendor.area || vendor.price) && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[13px] text-white/70" }, [vendor.area, vendor.price].filter(Boolean).join(" · ")), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex items-center gap-1.5 flex-wrap", role: "group", "aria-label": "계약 상태" }, VENDOR_STATUS.map((s) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: s,
      type: "button",
      "aria-pressed": d.status === s,
      onClick: () => set("status", s),
      className: `h-8 px-3 rounded-full text-[12px] font-bold transition-colors ${d.status === s ? "bg-white text-[#0A0A0A]" : "bg-white/15 text-white/80 hover:bg-white/25"}`
    },
    s
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex items-center gap-2 flex-wrap" }, url && /* @__PURE__ */ React.createElement("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "h-9 px-3.5 rounded-lg bg-white text-[#0A0A0A] text-[13px] font-bold inline-flex items-center" }, /instagram\.com/i.test(url) ? "인스타그램" : "업체 페이지"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onBrowse, className: "h-9 px-3.5 rounded-lg bg-white/15 text-white text-[13px] font-bold hover:bg-white/25" }, "다른 업체 다시 보기"), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        if (window.confirm(`'${vendor.name}' 확정을 풀까요? 적어 둔 세부 사항은 남아 있어서 다시 확정하면 그대로 보여요.`)) onUnconfirm();
      },
      className: "h-9 px-2 text-[13px] font-semibold text-white/70 underline underline-offset-4"
    },
    "확정 해제"
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "piggy", label: "총 금액", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, total > 0 ? manFull(total) : "미정") }), /* @__PURE__ */ React.createElement(Kpi, { icon: "check2", label: "낸 돈", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manFull(paid)), accent: "#525252" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "calendar", label: "남은 돈", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, total > 0 ? manFull(Math.max(0, total - paid)) : "—"), accent: "#8A8A8A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "calendar", label: "다음 일정", value: next ? /* @__PURE__ */ React.createElement("span", null, ddayOf(next.date), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, " · ", next.label)) : "없음", accent: "#B0B0B0" })), nextPay && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[13px] text-[#8A5A00] font-semibold" }, "아직 안 낸 돈: ", nextPay.label, " ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manFull(nextPay.amt)), nextPay.date ? ` · ${nextPay.date}까지` : " · 낼 날짜를 적어 두세요"), SNAP_SDM.includes(kind) && /* @__PURE__ */ React.createElement(Card, { className: "mb-3 !p-4 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "같이 가는 제주 스냅"), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold truncate" }, snap && snap.name ? snap.name : "아직 안 정했어요", snap && snap.shoot ? /* @__PURE__ */ React.createElement("span", { className: "font-semibold text-[#525252]" }, " · 촬영일 ", snap.shoot) : null)), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => onGo("snap"), className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#F0F0F0] hover:bg-[#E5E5E5] shrink-0" }, "제주 스냅 보기")), kind === "snap" && /* @__PURE__ */ React.createElement(Card, { className: "mb-3 !p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "촬영 날 드레스·헤메·양복·부케 (스냅 스드메)"), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-2" }, [["sdress", "👗 스냅 드레스·헤메"], ["ssuit", "🤵 스냅 양복"], ["sbouquet", "💐 스냅 부케"]].map(([k, t]) => {
    const c = snap && snap.sdm && snap.sdm[k];
    return /* @__PURE__ */ React.createElement("button", { key: k, type: "button", onClick: () => onGo(k), className: `text-left rounded-xl px-3 py-2.5 transition-colors ${c ? "bg-[#0A0A0A] text-white" : "bg-[#FAFAFA] hover:bg-[#F0F0F0]"}` }, /* @__PURE__ */ React.createElement("div", { className: `text-[11px] mb-0.5 ${c ? "text-white/60" : "text-[#6B6B6B]"}` }, t, c ? " · 확정 ✓" : ""), /* @__PURE__ */ React.createElement("div", { className: `text-[13px] font-bold truncate ${c ? "" : "text-[#737373]"}` }, c || `미정 · ${partners ? partners.name + " 제휴샵에서 고르기" : "눌러서 고르기"}`));
  }))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-3 items-start" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, "일정"), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, events.map((e) => /* @__PURE__ */ React.createElement("div", { key: e.id, className: "rounded-xl bg-[#FAFAFA] p-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => patchRow("events", e.id, "done", !e.done), "aria-pressed": !!e.done, "aria-label": `${e.label || "일정"} ${e.done ? "다녀옴 표시 빼기" : "다녀왔어요"}`, className: "w-9 h-9 flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Icon, { name: e.done ? "check2" : "square", size: 19, className: e.done ? "text-[#0A0A0A]" : "text-[#C9C9C9]" })), /* @__PURE__ */ React.createElement(TextInput, { value: e.label, onChange: (v) => patchRow("events", e.id, "label", v), placeholder: "일정 이름", ariaLabel: "일정 이름", className: `!bg-white ${e.done ? "line-through text-[#737373]" : ""}` }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "일정 삭제", onClick: () => delRow("events", e.id), className: "!w-8 !h-8" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-1.5 mt-1.5" }, /* @__PURE__ */ React.createElement("input", { type: "date", value: e.date || "", onChange: (ev) => patchRow("events", e.id, "date", ev.target.value), "aria-label": `${e.label || "일정"} 날짜`, className: `${DATE_CLS} !bg-white !px-2` }), /* @__PURE__ */ React.createElement("input", { type: "time", value: e.time || "", onChange: (ev) => patchRow("events", e.id, "time", ev.target.value), "aria-label": `${e.label || "일정"} 시간`, className: `${DATE_CLS} !bg-white !px-2` })), !e.date && isShoot(e) && SNAP_SDM.includes(kind) && snap && snap.shoot && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => patchRow("events", e.id, "date", snap.shoot),
      className: "mt-1.5 text-[12px] font-semibold underline underline-offset-4"
    },
    "제주 스냅 촬영일(",
    snap.shoot,
    ")로 채우기"
  ), e.date && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[11px] text-[#6B6B6B]" }, e.done ? "다녀왔어요" : ddayOf(e.date))))), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => addRow("events", { label: "", date: "", time: "", done: false }), className: "mt-2 h-9 px-3 rounded-lg text-[13px] font-semibold bg-[#F0F0F0] hover:bg-[#E5E5E5] inline-flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " 일정 추가")), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, "돈"), cost ? /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "총 금액 — 투어 체크리스트 견적으로 예산표에 들어간 금액"), /* @__PURE__ */ React.createElement("div", { className: "text-[18px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manFull(cost.total))), cost.lines.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] mt-0.5" }, cost.lines.map(([n, v]) => `${n} ${manFull(v)}`).join(" · "))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "총 금액 — 아래 낼 돈을 더한 금액이에요. 예산표 금액도 이걸로 맞춰져요"), /* @__PURE__ */ React.createElement("div", { className: "text-[18px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, total > 0 ? manFull(total) : "아직 없음")), sum > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] mt-0.5" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, "낸 돈 ", manFull(paid), " · 남은 돈 ", manFull(Math.max(0, total - paid)))), !sum && total > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5" }, "예전에 적은 총 금액이에요 — 계약금·잔금 등을 적으면 그 합으로 바뀌어요"))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 space-y-2" }, pays.map((p) => /* @__PURE__ */ React.createElement("div", { key: p.id, className: "rounded-xl bg-[#FAFAFA] p-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: p.label, onChange: (v) => patchRow("pays", p.id, "label", v), placeholder: "계약금·중도금·잔금", ariaLabel: "낼 돈 이름", className: "!bg-white" }), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => patchRow("pays", p.id, "paid", !p.paid),
      "aria-pressed": !!p.paid,
      className: `h-10 px-3 rounded-lg text-[12px] font-bold shrink-0 transition-colors ${p.paid ? "bg-[#1F5D46] text-white" : "bg-white text-[#6B6B6B] hover:text-[#0A0A0A]"}`
    },
    p.paid ? "✓ 냈어요" : "안 냈어요"
  ), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => delRow("pays", p.id), className: "!w-8 !h-8" })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-1.5 mt-1.5" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-0.5" }, "금액"), /* @__PURE__ */ React.createElement(WonInput, { value: p.amt || 0, onChange: (v) => patchRow("pays", p.id, "amt", v), ariaLabel: `${p.label || "낼 돈"} 금액(원)`, className: "!bg-white" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-0.5" }, p.paid ? "낸 날" : "낼 날"), /* @__PURE__ */ React.createElement("input", { type: "date", value: p.date || "", onChange: (ev) => patchRow("pays", p.id, "date", ev.target.value), "aria-label": `${p.label || "낼 돈"} 날짜`, className: `${DATE_CLS} !bg-white` })))))), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => addRow("pays", { label: "중도금", amt: 0, date: "", paid: false }), className: "mt-2 h-9 px-3 rounded-lg text-[13px] font-semibold bg-[#F0F0F0] hover:bg-[#E5E5E5] inline-flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " 낼 돈 추가"), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#6B6B6B]" }, "'냈어요'로 바꾼 돈은 예산표에도 낸 돈으로 들어가요.")), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, "계약서"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap mb-3", role: "group", "aria-label": "계약서 상태" }, VENDOR_CONTRACT.map((s) => /* @__PURE__ */ React.createElement("button", { key: s, type: "button", "aria-pressed": d.contract === s, onClick: () => set("contract", s), className: chip(d.contract === s) }, s))), /* @__PURE__ */ React.createElement(
    ContractFiles,
    {
      files: d.files || [],
      onAdd: (f) => onPatch((cur) => ({ ...cur, files: [...cur.files || [], f], contract: !cur.contract || cur.contract === VENDOR_CONTRACT[0] ? VENDOR_CONTRACT[1] : cur.contract })),
      onRemove: (id) => onPatch((cur) => ({ ...cur, files: (cur.files || []).filter((x) => x.id !== id) }))
    }
  )), /* @__PURE__ */ React.createElement(Card, { className: "lg:col-span-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "상담 기록 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, (d.consults || []).length, "건 · 최근 순")), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: () => onPatch((cur) => ({ ...cur, consults: [{ id: uid(), date: today, way: "방문", who: cur.contact || "", text: "" }, ...cur.consults || []] })),
      className: "h-9 px-3 rounded-lg text-[13px] font-semibold bg-[#0A0A0A] text-white inline-flex items-center gap-1 shrink-0"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }),
    " 상담 기록 추가"
  )), (d.consults || []).length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, "상담하거나 연락할 때마다 날짜와 들은 내용을 남겨요 — 견적, 약속한 것, 다음에 할 일."), /* @__PURE__ */ React.createElement("div", { className: "space-y-2" }, [...d.consults || []].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((c) => /* @__PURE__ */ React.createElement("div", { key: c.id, className: "rounded-xl bg-[#FAFAFA] p-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-1.5 items-center" }, /* @__PURE__ */ React.createElement("input", { type: "date", value: c.date || "", onChange: (ev) => patchRow("consults", c.id, "date", ev.target.value), "aria-label": "상담한 날", className: `${DATE_CLS} !bg-white !px-2` }), /* @__PURE__ */ React.createElement(TextInput, { value: c.who || "", onChange: (v) => patchRow("consults", c.id, "who", v), placeholder: "상담한 사람", ariaLabel: "상담한 사람", className: "!bg-white" }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "상담 기록 삭제", onClick: () => {
    if (window.confirm("이 상담 기록을 지울까요?")) delRow("consults", c.id);
  }, className: "!w-8 !h-8" })), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 flex-wrap my-1.5", role: "group", "aria-label": "상담 방식" }, CONSULT_WAYS.map((w) => /* @__PURE__ */ React.createElement("button", { key: w, type: "button", "aria-pressed": c.way === w, onClick: () => patchRow("consults", c.id, "way", w), className: `h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${c.way === w ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] hover:bg-[#EBEBEB]"}` }, w))), /* @__PURE__ */ React.createElement(AutoArea, { value: c.text || "", onChange: (e) => patchRow("consults", c.id, "text", e.target.value), minRows: 5, placeholder: "들은 내용 · 받은 견적 · 다음에 할 일", "aria-label": "상담 내용", className: `${AREA_CLS} !bg-white !text-[15px] !leading-relaxed min-h-[132px]` }))))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, kind === "planner" ? "담당 플래너 · 메모" : "담당자 · 메모"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, kind === "planner" ? "담당 플래너" : "담당자"), /* @__PURE__ */ React.createElement(TextInput, { value: d.contact || "", onChange: (v) => set("contact", v), placeholder: kind === "planner" ? "예: 한수아 팀장" : "예: 김OO 실장", ariaLabel: "담당자" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "연락처"), /* @__PURE__ */ React.createElement(TextInput, { value: d.phone || "", onChange: (v) => set("phone", v), placeholder: "전화·카카오 채널", ariaLabel: "연락처" }))), /^[\d\-+\s()]{8,}$/.test(d.phone || "") && /* @__PURE__ */ React.createElement("a", { href: `tel:${String(d.phone).replace(/[^\d+]/g, "")}`, className: "mt-2 inline-block text-[13px] font-semibold underline underline-offset-4" }, "전화 걸기"), /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mt-3 mb-1" }, "메모"), /* @__PURE__ */ React.createElement(AutoArea, { value: d.memo || "", onChange: (e) => set("memo", e.target.value), minRows: 4, placeholder: "상담하며 들은 것, 고른 컨셉, 준비물", "aria-label": "메모", className: AREA_CLS }), item && item.note && /* @__PURE__ */ React.createElement("details", { className: "mt-2" }, /* @__PURE__ */ React.createElement("summary", { className: "cursor-pointer text-[12px] font-semibold text-[#525252]" }, "비교할 때 적어 둔 업체 정보"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 text-[12px] text-[#525252] leading-relaxed whitespace-pre-line" }, item.note)))), partners && /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, partners.name, " 제휴 업체"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-3" }, "드레스·헤메·부케는 스냅 드레스·헤메, 스냅 부케 탭에 있어요 · ", /* @__PURE__ */ React.createElement("a", { href: partners.src, target: "_blank", rel: "noopener noreferrer", className: "underline underline-offset-2" }, "예약 안내 블로그")), partners.groups.map(([g, list]) => /* @__PURE__ */ React.createElement("div", { key: g, className: "mb-2.5 last:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-[#6B6B6B] mb-1" }, g), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-3 gap-y-1" }, list.map(([n, h]) => /* @__PURE__ */ React.createElement("a", { key: h, href: IG(h), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, n)))))), extra, after);
}
const VENDOR_LABEL = { ...Object.fromEntries(VENDOR_SEGS.flatMap(([, items]) => items.map(([k, ic, l]) => [k, `${ic} ${l}`]))), studio: "📸 스튜디오" };
const vendorSegsFor = (confirmed) => confirmed && confirmed.studio && confirmed.studio.name ? VENDOR_SEGS.map(([g, items]) => g === "본식" ? [g, [items[0], ["studio", "📸", "스튜디오"], ...items.slice(1)]] : [g, items]) : VENDOR_SEGS;
function weddingCalEvents(confirmed, details, info, custom) {
  const out = [];
  Object.keys(VENDOR_LABEL).forEach((k) => {
    const c = confirmed[k];
    if (!c || !c.name) return;
    const d = details[`${k}|${c.name}`];
    if (!d) return;
    (d.events || []).filter((e) => e.date).forEach((e) => out.push({ date: e.date, time: e.time || "", title: e.label || "일정", kind: k, vendor: c.name, done: !!e.done, type: "event" }));
    (d.pays || []).filter((p) => p.date && Number(p.amt) > 0).forEach((p) => out.push({ date: p.date, time: "", title: `${p.label || "낼 돈"} ${p.paid ? "냄" : "내는 날"}`, kind: k, vendor: c.name, done: !!p.paid, type: "pay", amt: Number(p.amt) }));
  });
  if (info && info.date) out.push({ date: info.date, time: "", title: "결혼식", kind: "venue", vendor: info.venue || "", done: false, type: "wedding" });
  (custom || []).filter((e) => e.date).forEach((e) => out.push({ date: e.date, time: e.time || "", title: e.title || "일정", memo: e.memo || "", done: !!e.done, type: "custom", id: e.id }));
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
const KR_HOLIDAYS = {
  2025: { "01-01": "1월 1일", "01-27": "임시공휴일", "01-28": "설날 전날", "01-29": "설날", "01-30": "설날 다음 날", "03-01": "3·1절", "03-03": "대체공휴일(3·1절)", "05-05": "어린이날 · 부처님 오신 날", "05-06": "대체공휴일(부처님 오신 날)", "06-03": "임시공휴일(대통령선거)", "06-06": "현충일", "08-15": "광복절", "10-03": "개천절", "10-05": "추석 전날", "10-06": "추석", "10-07": "추석 다음 날", "10-08": "대체공휴일(추석)", "10-09": "한글날", "12-25": "기독탄신일" },
  2026: { "01-01": "1월 1일", "02-16": "설날 전날", "02-17": "설날", "02-18": "설날 다음 날", "03-01": "3·1절", "03-02": "대체공휴일(3·1절)", "05-01": "노동절", "05-05": "어린이날", "05-24": "부처님 오신 날", "05-25": "대체공휴일(부처님 오신 날)", "06-03": "전국동시지방선거", "06-06": "현충일", "07-17": "제헌절", "08-15": "광복절", "08-17": "대체공휴일(광복절)", "09-24": "추석 전날", "09-25": "추석", "09-26": "추석 다음 날", "10-03": "개천절", "10-05": "대체공휴일(개천절)", "10-09": "한글날", "12-25": "기독탄신일" },
  2027: { "01-01": "1월 1일", "02-06": "설날 전날", "02-07": "설날", "02-08": "설날 다음 날", "02-09": "대체공휴일(설날)", "03-01": "3·1절", "05-01": "노동절", "05-03": "대체공휴일(노동절)", "05-05": "어린이날", "05-13": "부처님 오신 날", "06-06": "현충일", "07-17": "제헌절", "07-19": "대체공휴일(제헌절)", "08-15": "광복절", "08-16": "대체공휴일(광복절)", "09-14": "추석 전날", "09-15": "추석", "09-16": "추석 다음 날", "10-03": "개천절", "10-04": "대체공휴일(개천절)", "10-09": "한글날", "10-11": "대체공휴일(한글날)", "12-25": "기독탄신일", "12-27": "대체공휴일(기독탄신일)" }
};
const krHoliday = (ymd2) => (KR_HOLIDAYS[ymd2.slice(0, 4)] || {})[ymd2.slice(5)] || "";
function WeddingCalendar({ events, onOpen, privacy, custom = [], setCustom }) {
  const blank = { id: null, title: "", date: "", time: "", memo: "" };
  const [form, setForm] = useState(null);
  const saveForm = () => {
    if (!form.title.trim() || !form.date) return;
    const row2 = { title: form.title.trim().slice(0, 60), date: form.date, time: form.time || "", memo: (form.memo || "").slice(0, 300) };
    setCustom(form.id ? custom.map((e) => e.id === form.id ? { ...e, ...row2, u: Date.now() } : e) : [...custom, { id: uid(), at: Date.now(), done: false, ...row2 }]);
    setForm(null);
  };
  const todayStr = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= todayStr && !e.done);
  const [cur, setCur] = useState({ y: +todayStr.slice(0, 4), m: +todayStr.slice(5, 7) - 1 });
  const isThisMonth = cur.y === +todayStr.slice(0, 4) && cur.m === +todayStr.slice(5, 7) - 1;
  const [sel, setSel] = useState(todayStr);
  const gridRef = useRef(null);
  const moveMonth = (dd) => {
    setSel(null);
    setCur(({ y, m }) => {
      const dt = new Date(y, m + dd, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });
  };
  const pfx = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
  const byDate = events.reduce((m, e) => {
    (m[e.date] = m[e.date] || []).push(e);
    return m;
  }, {});
  const firstDow = new Date(cur.y, cur.m, 1).getDay(), dim = new Date(cur.y, cur.m + 1, 0).getDate();
  const monthN = events.filter((e) => e.date.startsWith(pfx)).length;
  const chip = (e) => e.type === "wedding" ? "bg-[#E11D48] text-white" : e.type === "custom" ? e.done ? "bg-[#F0F0F0] text-[#737373] line-through" : "bg-[#DCE8F7] text-[#1D4E89]" : e.type === "pay" ? e.done ? "bg-[#EAF3EE] text-[#1F5D46]" : "bg-[#FFF4D6] text-[#8A5A00]" : e.done ? "bg-[#F0F0F0] text-[#737373] line-through" : "bg-[#0A0A0A] text-white";
  const dayList = sel ? byDate[sel] || [] : [];
  const openDetail = (e) => {
    if (e.type === "custom") {
      const c = custom.find((x) => x.id === e.id);
      if (c) setForm({ ...blank, ...c });
    } else onOpen(e.kind);
  };
  const goTo = (e) => {
    setCur({ y: +e.date.slice(0, 4), m: +e.date.slice(5, 7) - 1 });
    setSel(e.date);
    requestAnimationFrame(() => {
      const el = gridRef.current;
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 90;
        if (y < window.scrollY) window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  };
  const row = (e, i, onClick, withDate = true) => /* @__PURE__ */ React.createElement("button", { key: i, type: "button", onClick: () => onClick(e), className: "w-full flex items-center gap-2.5 py-2 text-left hover:bg-[#FAFAFA] rounded-lg px-1" }, withDate ? /* @__PURE__ */ React.createElement("span", { className: "w-[74px] shrink-0 text-[12px] font-semibold text-[#525252]", style: { fontVariantNumeric: "tabular-nums" } }, (e.date.slice(0, 4) === todayStr.slice(0, 4) ? e.date.slice(5) : e.date.slice(2)).replace(/-/g, "."), e.time ? ` ${e.time}` : "") : /* @__PURE__ */ React.createElement("span", { className: "w-[42px] shrink-0 text-[12px] font-semibold text-[#525252]", style: { fontVariantNumeric: "tabular-nums" } }, e.time || "종일"), /* @__PURE__ */ React.createElement("span", { className: `shrink-0 rounded px-1.5 text-[11px] font-bold leading-5 ${chip(e)}` }, e.type === "wedding" ? "💍" : e.type === "pay" ? "₩" : e.type === "custom" ? "✎" : "●"), /* @__PURE__ */ React.createElement("span", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("span", { className: `block text-[13px] font-semibold truncate ${e.done ? "text-[#737373] line-through" : ""}` }, e.title, e.amt ? /* @__PURE__ */ React.createElement(Blur, { on: privacy }, " · ", manFull(e.amt)) : null), /* @__PURE__ */ React.createElement("span", { className: "block text-[11px] text-[#6B6B6B] truncate" }, e.type === "wedding" ? e.vendor || "예식일" : e.type === "custom" ? e.memo || "직접 등록한 일정" : `${VENDOR_LABEL[e.kind]} · ${e.vendor}`)), !withDate && /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 14, className: "shrink-0 text-[#9A9A9A]" }));
  return /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, "결혼 준비 일정"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setForm({ ...blank, date: sel || todayStr }), className: "h-8 px-2.5 rounded-lg text-[12px] font-bold bg-[#0A0A0A] text-white inline-flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " 일정")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(-1), "aria-label": "이전 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "rotate-180" })), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold min-w-[96px] text-center", style: { fontVariantNumeric: "tabular-nums" } }, cur.y, ".", String(cur.m + 1).padStart(2, "0"), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#6B6B6B]" }, monthN, "건")), /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(1), "aria-label": "다음 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16 })), !isThisMonth && /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setSel(null);
    setCur({ y: +todayStr.slice(0, 4), m: +todayStr.slice(5, 7) - 1 });
  }, className: "h-8 px-2.5 rounded-lg text-[12px] font-semibold bg-[#F0F0F0] hover:bg-[#E5E5E5]" }, "오늘"))), /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-5" }, /* @__PURE__ */ React.createElement("div", { ref: gridRef }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 text-center text-[11px] font-semibold text-[#6B6B6B] mb-1" }, ["일", "월", "화", "수", "목", "금", "토"].map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d, className: i === 0 ? "text-[#C96A6A]" : "" }, d))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 gap-1" }, Array.from({ length: firstDow }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: "e" + i })), Array.from({ length: dim }).map((_, idx) => {
    const dn = idx + 1, key = `${pfx}-${String(dn).padStart(2, "0")}`, evs = byDate[key] || [], on = sel === key, hol = krHoliday(key);
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: dn,
        type: "button",
        onClick: () => setSel(on ? null : key),
        "aria-label": `${cur.m + 1}월 ${dn}일${hol ? ` ${hol}` : ""} 일정 ${evs.length}건`,
        title: hol || void 0,
        "aria-pressed": on,
        className: `min-h-[56px] rounded-lg p-0.5 flex flex-col items-center gap-0.5 transition-colors ${on ? "ring-1 ring-[#0A0A0A] bg-[#0A0A0A]/5" : "hover:bg-[#F5F5F5]"} ${key === todayStr ? "bg-[#F0F0F0]" : ""}`
      },
      key === todayStr ? /* @__PURE__ */ React.createElement("span", { className: "w-6 h-6 rounded-full bg-[#0A0A0A] text-white text-[12px] font-bold flex items-center justify-center", "aria-label": "오늘" }, dn) : /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-semibold ${hol || new Date(cur.y, cur.m, dn).getDay() === 0 ? "text-[#C96A6A]" : ""}` }, dn),
      evs.slice(0, 2).map((e, i) => /* @__PURE__ */ React.createElement("span", { key: i, className: `w-full truncate rounded px-0.5 text-[10px] font-bold leading-4 ${chip(e)}` }, e.type === "wedding" ? "💍결혼식" : e.title)),
      evs.length > 2 && /* @__PURE__ */ React.createElement("span", { className: "text-[9px] font-bold text-[#6B6B6B]" }, "+", evs.length - 2)
    );
  }))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 pt-2 border-t border-[#F0F0F0] lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-[#6B6B6B] mb-0.5" }, sel ? `${+sel.slice(5, 7)}월 ${+sel.slice(8)}일${sel === todayStr ? " · 오늘" : ""}${krHoliday(sel) ? ` · ${krHoliday(sel)}` : ""}` : "날짜를 고르면 그날 일정이 나와요"), sel && (dayList.length ? dayList.map((e, i) => row(e, i, openDetail, false)) : /* @__PURE__ */ React.createElement("div", { className: "py-2 text-[13px] text-[#6B6B6B]" }, "이날은 일정이 없어요.")), sel && dayList.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-0.5" }, "누르면 세부 화면으로 가요"))), form && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-2" }, form.id ? "일정 고치기" : "일정 직접 등록"), /* @__PURE__ */ React.createElement(TextInput, { value: form.title, onChange: (v) => setForm({ ...form, title: v }), placeholder: "예: 상견례, 혼주 한복 대여, 신혼집 계약", ariaLabel: "일정 이름", className: "!bg-white mb-1.5" }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-1.5 mb-1.5" }, /* @__PURE__ */ React.createElement("input", { type: "date", value: form.date, onChange: (ev) => setForm({ ...form, date: ev.target.value }), "aria-label": "일정 날짜", className: `${DATE_CLS} !bg-white !px-2` }), /* @__PURE__ */ React.createElement("input", { type: "time", value: form.time, onChange: (ev) => setForm({ ...form, time: ev.target.value }), "aria-label": "일정 시간", className: `${DATE_CLS} !bg-white !px-2` })), /* @__PURE__ */ React.createElement(TextInput, { value: form.memo, onChange: (v) => setForm({ ...form, memo: v }), placeholder: "메모 (장소·준비물, 선택)", ariaLabel: "일정 메모", className: "!bg-white" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 mt-2 flex-wrap" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: saveForm, disabled: !form.title.trim() || !form.date, className: "h-9 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold disabled:opacity-40" }, "저장"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setForm(null), className: "h-9 px-3 rounded-lg bg-[#F0F0F0] text-[13px] font-semibold" }, "취소"), form.id && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
    setCustom(custom.map((e) => e.id === form.id ? { ...e, done: !e.done, u: Date.now() } : e));
    setForm(null);
  }, className: "h-9 px-3 rounded-lg bg-[#F0F0F0] text-[13px] font-semibold" }, (custom.find((e) => e.id === form.id) || {}).done ? "다녀옴 표시 빼기" : "다녀왔어요"), form.id && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
    if (window.confirm("이 일정을 지울까요?")) {
      setCustom(custom.filter((e) => e.id !== form.id));
      setForm(null);
    }
  }, className: "h-9 px-2 text-[13px] font-semibold text-[#B4533A] underline underline-offset-4 ml-auto" }, "삭제"))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 border-t border-[#F0F0F0] pt-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-[#6B6B6B] mb-0.5" }, "다가오는 일정 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal" }, "· 누르면 달력이 그날로 가요")), upcoming.length ? upcoming.slice(0, 6).map((e, i) => row(e, i, goTo)) : /* @__PURE__ */ React.createElement("div", { className: "py-2 text-[13px] text-[#6B6B6B]" }, events.length ? "남은 일정이 없어요." : "확정한 업체 화면에서 일정·낼 돈 날짜를 적거나 [+ 일정]으로 직접 넣으면 여기에 모여요.")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[11px] text-[#6B6B6B]" }, "검정 업체 일정 · 파랑 직접 등록 · 노랑 낼 돈 · 초록 낸 돈 · 빨강 결혼식"));
}
const IG_NO_EMBED = /* @__PURE__ */ new Set(["stylist__soohee"]);
function IgProfileEmbed({ handle, name }) {
  return /* @__PURE__ */ React.createElement("div", { className: "relative w-full border-t border-[#F0F0F0]", style: { paddingTop: "calc(66.67% + 156px)" } }, /* @__PURE__ */ React.createElement(
    "iframe",
    {
      src: `https://www.instagram.com/${handle}/embed/`,
      title: `${name} 인스타그램 최근 게시물`,
      loading: "lazy",
      scrolling: "no",
      referrerPolicy: "strict-origin-when-cross-origin",
      sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
      className: "absolute inset-0 w-full h-full border-0 bg-white"
    }
  ));
}
function WeddingVendorTab({ kind, confirmed, onConfirm, detail, onPatchDetail, snap, onGo, privacy }) {
  const def = WEDDING_VENDORS[kind];
  const listKey = `wedding-vendor-${kind}-v4`, metaKey = `wedding-vendor-${kind}-meta-v1`;
  const defaultList = def.items.map((v, i) => ({ id: kind + i, ...v }));
  const [list, setList] = usePersist(listKey, defaultList);
  const [meta, setMeta] = usePersist(metaKey, { at: null });
  useUniqIds(list, setList);
  const [area, setArea] = useState("");
  const [nv, setNv] = useState({ name: "", area: "", price: "", note: "" });
  const patchVendor = (id, k, val) => setList(list.map((x) => x.id === id ? { ...x, [k]: val } : x));
  const saveLookup = (id, lookup) => {
    const next = store.get(listKey, defaultList).map((x) => x.id === id ? { ...x, lookup } : x);
    store.set(listKey, next);
    setList(next);
  };
  const isConf = (v) => !!(confirmed && confirmed.name === v.name);
  const [favs, setFavs] = usePersist(`wedding-vendor-${kind}-favs-v1`, {});
  const [rank, setRank] = usePersist(`wedding-vendor-${kind}-rank-v1`, []);
  const [favOnly, setFavOnly] = useState(false);
  const toggleFav = (name) => setFavs((f2) => {
    const n = { ...f2 };
    if (n[name]) delete n[name];
    else n[name] = Date.now();
    return n;
  });
  const removeVendor = (v) => {
    setList((l) => l.filter((x) => x.id !== v.id));
    if (!list.some((x) => x.id !== v.id && x.name === v.name)) {
      setFavs((f2) => {
        if (!f2[v.name]) return f2;
        const n = { ...f2 };
        delete n[v.name];
        return n;
      });
      setRank((r) => rankOf(r, v.name) ? withRank(r, v.name, 0) : r);
    }
  };
  const shown = list.filter((v) => (!area.trim() || `${v.area || ""} ${v.name || ""}`.includes(area.trim())) && (!favOnly || !!favs[v.name])).sort((a, b) => (isConf(b) ? 1 : 0) - (isConf(a) ? 1 : 0) || (rankOf(rank, a.name) || 999) - (rankOf(rank, b.name) || 999) || (favs[b.name] ? 1 : 0) - (favs[a.name] ? 1 : 0) || (b.partner ? 1 : 0) - (a.partner ? 1 : 0));
  const [mode, setMode] = useState(() => VENDOR_REF[kind] && (store.get(REF_KEY, []) || []).some((r) => VENDOR_REF[kind].includes(r.cat)) ? "refs" : "feed");
  const [openBlocks, setOpenBlocks] = useState({});
  const [vg, setVg] = useState(VG_KINDS.includes(kind) ? null : { vendors: [] });
  useEffect(() => {
    if (!VG_KINDS.includes(kind)) return;
    let on = true;
    loadVerygood().then((j) => {
      if (on) setVg(j || { failed: true, vendors: [] });
    });
    return () => {
      on = false;
    };
  }, [kind]);
  const [picks, setPicks] = usePersist(MOOD_KEY, []);
  const [count, setCount] = useState(MOOD_PAGE);
  const [view, setView] = useState(null);
  const sentinel = useRef(null);
  const base = vg && vg.imgBase || "";
  const f = area.trim();
  const vgVendors = useMemo(() => (vg && vg.vendors || []).filter((v) => v.kind === kind), [vg, kind]);
  const vgById = useMemo(() => Object.fromEntries(vgVendors.map((v) => [v.id, v])), [vgVendors]);
  const [vpicks, setVpicks] = usePersist(MOOD_VENDOR_KEY, []);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const vKey = (vendorId) => `${kind}|${vendorId}`;
  const vendorSet = useMemo(() => new Set(vpicks.map((p) => p.id)), [vpicks]);
  const isVPicked = (vendorId) => vendorSet.has(vKey(vendorId));
  const toggleVendor = (vendorId, vendorName) => {
    const id = vKey(vendorId), cur = store.get(MOOD_VENDOR_KEY, []);
    setVpicks(cur.some((p) => p.id === id) ? cur.filter((p) => p.id !== id) : [...cur, { id, kind, vendorId, vendorName, by: moodWho(), at: Date.now(), u: Date.now() }]);
  };
  const isSnap = !VG_KINDS.includes(kind);
  const [snapPh, setSnapPh] = usePersist(SNAP_PHOTOS_KEY, {});
  const [snapSt, setSnapSt] = useState({ busy: false, err: "" });
  const snapIds = isSnap ? list.map((x) => x.id).join(",") : "";
  useEffect(() => {
    if (!isSnap) return;
    const cur = store.get(SNAP_PHOTOS_KEY, {});
    const stale = list.filter((x) => String(x.name || "").trim() && !igEmbedOf(x) && !(cur[x.id] && Date.now() - Date.parse(cur[x.id].at) < SNAP_PHOTOS_TTL)).slice(0, 20);
    if (!stale.length) return;
    let on = true;
    setSnapSt({ busy: true, err: "" });
    (async () => {
      try {
        const r = await withTimeout(authFetch("/api/vendor-photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, vendors: stale.map((x) => ({ id: x.id, name: String(x.name).trim().slice(0, 40), handle: igHandle(x.url) })) })
        }), 58e3, "사진 찾기가 1분을 넘겼어요 — 잠시 후 탭을 다시 열어 주세요.");
        const j = await r.json().catch(() => null);
        if (!r.ok || !j) throw new Error(j && j.message || `작업 사진을 못 불러왔어요(${r.status}) — 잠시 후 탭을 다시 열어 주세요.`);
        const next = { ...store.get(SNAP_PHOTOS_KEY, {}) };
        Object.entries(j.items || {}).forEach(([id, v]) => {
          next[id] = { images: v && v.images || [], at: v && v.at || (/* @__PURE__ */ new Date()).toISOString() };
        });
        store.set(SNAP_PHOTOS_KEY, next);
        if (on) {
          setSnapPh(next);
          setSnapSt({ busy: false, err: "" });
        }
      } catch (e) {
        if (on) setSnapSt({ busy: false, err: String(e && e.message || e) });
      }
    })();
    return () => {
      on = false;
    };
  }, [isSnap, snapIds]);
  const igEmbedOf = (x) => IG_EMBED_KINDS.includes(kind) && !IG_NO_EMBED.has(igHandle(x.url).toLowerCase()) ? igHandle(x.url) : "";
  const snapImgs = (x) => {
    const s = snapPh[x.id];
    return (s && s.images && s.images.length ? s.images : x.lookup && x.lookup.images) || [];
  };
  const partnerOf = (v) => v.partner && SNAP_PARTNERS[v.partner] ? SNAP_PARTNERS[v.partner].name : null;
  const PartnerBadge = ({ v }) => partnerOf(v) ? /* @__PURE__ */ React.createElement("span", { className: "align-middle ml-1 text-[10px] font-bold text-[#1F5D46] bg-[#E3F1EA] px-2 py-0.5 rounded-full whitespace-nowrap" }, partnerOf(v), " 제휴") : null;
  const blocks = useMemo(() => isSnap ? [...list].sort((a, b) => (partnerOf(b) ? 1 : 0) - (partnerOf(a) ? 1 : 0)).filter((x) => !f || `${x.area || ""} ${x.name || ""}`.includes(f)).map((x) => {
    const ims = snapImgs(x);
    const ig = /instagram\.com/i.test(x.url || "") ? safeUrl(x.url) : null;
    const embed = igEmbedOf(x);
    return {
      id: x.id,
      name: x.name,
      partner: x.partner,
      concept: String(x.note || "").split("\n")[0].slice(0, 80),
      photos: embed ? [] : ims.map((im) => ({ key: im.thumb, src: bigThumb(im.thumb) })),
      snap: true,
      embed,
      ig,
      home: ig ? null : safeUrl(x.url),
      open: (i) => openCustom(x, i, ims, "네이버 이미지 검색(후기·블로그)")
    };
  }) : [
    // 비교 목록에 같은 업체가 있으면 블록 하나로 — 사진은 베리굿, 소개·지역·가격은 목록에 적은 것
    ...vgVendors.filter((v) => (v.photos || []).length && (!f || `${v.name} ${v.intro || ""}`.includes(f))).map((v) => {
      const lx = list.find((x) => sameVendor(x, v));
      return {
        id: v.id,
        name: v.name,
        concept: lx && String(lx.note || "").split("\n")[0].slice(0, 80) || vgConcept(v),
        info: lx ? [lx.area, lx.price].filter(Boolean).join(" · ") : "",
        photos: v.photos.map((p) => ({ key: p, src: vgImg(base, p) })),
        g: v,
        open: (i) => openVg(v, i)
      };
    }),
    ...list.filter((x) => x.lookup && (x.lookup.images || []).length && (!f || `${x.area || ""} ${x.name || ""}`.includes(f)) && !vgVendors.some((v) => (v.photos || []).length && sameVendor(x, v))).map((x) => ({ id: x.id, name: x.name, concept: String(x.note || "").split("\n")[0].slice(0, 80), photos: x.lookup.images.map((im) => ({ key: im.thumb, src: bigThumb(im.thumb) })), custom: true, open: (i) => openCustom(x, i) }))
  ], [vgVendors, list, f, base, isSnap, snapPh]);
  const feed = onlyPicked ? blocks.filter((b) => isVPicked(b.id)) : blocks;
  useEffect(() => {
    setCount(MOOD_PAGE);
  }, [f, onlyPicked]);
  useEffect(() => {
    const el = sentinel.current;
    if (mode !== "feed" || !el || count >= feed.length) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) setCount((c) => c + MOOD_PAGE);
    }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [mode, count, feed.length]);
  const pickId = (vendorId, photo) => `${kind}|${vendorId}|${photo}`;
  const pickSet = useMemo(() => new Set(picks.map((p) => p.id)), [picks]);
  const isPicked = (vendorId, photo) => pickSet.has(pickId(vendorId, photo));
  const togglePick = (vendorId, vendorName, photo) => {
    const id = pickId(vendorId, photo), cur = store.get(MOOD_KEY, []);
    const next = cur.some((p) => p.id === id) ? cur.filter((p) => p.id !== id) : [...cur, { id, kind, vendorId, vendorName, photo, by: moodWho(), at: Date.now(), u: Date.now() }];
    setPicks(next);
  };
  const myPicks = picks.filter((p) => p.kind === kind).sort((a, b) => (b.at || 0) - (a.at || 0));
  const pickGroups = [...myPicks.reduce((m, p) => {
    if (!m.has(p.vendorId)) m.set(p.vendorId, { id: p.vendorId, name: p.vendorName, picks: [] });
    m.get(p.vendorId).picks.push(p);
    return m;
  }, /* @__PURE__ */ new Map()).values()];
  const topVendors = [...pickGroups].sort((a, b) => b.picks.length - a.picks.length).slice(0, 5);
  const myVendors = vpicks.filter((p) => p.kind === kind).sort((a, b) => (b.at || 0) - (a.at || 0));
  const vendorCover = (id, fallback) => {
    const v = vgById[id];
    if (v && (v.img || (v.photos || [])[0])) return vgImg(base, v.img || v.photos[0]);
    const x = list.find((y) => y.id === id);
    const im = x && snapImgs(x)[0];
    return x && x.img || im && im.thumb || (fallback ? vgImg(base, fallback) : "");
  };
  const have = new Set(list.map((x) => x.name));
  const inList = (name, g) => have.has(name) || !!(g && list.some((x) => sameVendor(x, g)));
  const addVg = (g) => {
    if (inList(g.name, g)) return;
    setList([...list, { id: uid(), custom: true, name: g.name, area: "", price: "", note: vgConcept(g), img: vgImg(base, g.img), url: g.url }]);
  };
  function openVg(v, i) {
    const ps = v.photos || [];
    setView({ vendorId: v.id, name: v.name, keys: ps, srcs: ps.map((p) => vgImg(base, p)), i: Math.max(0, i), vg: v, url: v.url, src: "베리굿웨딩" });
  }
  function openCustom(x, i, ims = x.lookup && x.lookup.images || [], src = "네이버 이미지 검색") {
    setView({
      vendorId: x.id,
      name: x.name,
      keys: ims.map((im) => im.thumb),
      srcs: ims.map((im) => /^https:\/\//i.test(im.link || "") ? im.link : bigThumb(im.thumb)),
      fallbacks: ims.map((im) => bigThumb(im.thumb)),
      i: Math.max(0, i),
      src,
      ig: /instagram\.com/i.test(x.url || "") ? safeUrl(x.url) : null
    });
  }
  const openPick = (p) => {
    if (String(p.photo).startsWith("ref:")) {
      const id = p.photo.slice(4);
      loadRefImg(id).then((v2) => setView({ vendorId: p.vendorId, name: p.vendorName, keys: [p.photo], srcs: [v2 || refImgCache.get(id + "_t") || null], i: 0, src: "레퍼런스" })).catch(() => {
      });
      return;
    }
    const v = vgById[p.vendorId];
    if (v && (v.photos || []).length) return openVg(v, v.photos.indexOf(p.photo));
    const x = list.find((y) => y.id === p.vendorId), xi = x ? isSnap ? snapImgs(x) : x.lookup && x.lookup.images || [] : [];
    if (xi.length) return openCustom(x, xi.findIndex((im) => im.thumb === p.photo), xi, isSnap ? "네이버 이미지 검색(후기·블로그)" : "네이버 이미지 검색");
    setView({ vendorId: p.vendorId, name: p.vendorName, keys: [p.photo], srcs: [vgImg(base, p.photo)], i: 0 });
  };
  const addBtn = (name, g, dark) => inList(name, g) ? /* @__PURE__ */ React.createElement("span", { className: `h-8 px-3 rounded-lg text-[12px] font-bold inline-flex items-center shrink-0 ${dark ? "bg-white/20 text-white/80" : "bg-[#F0F0F0] text-[#6B6B6B]"}` }, "비교 중") : g ? /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => addVg(g), className: `h-8 px-3 rounded-lg text-[12px] font-bold shrink-0 ${dark ? "bg-white text-[#0A0A0A]" : "bg-[#0A0A0A] text-white"}` }, "비교 목록에 추가") : null;
  let customHead = false;
  const [focus, setFocus] = useState(null);
  const goVendor = (vendorId, name) => {
    const g = vgById[vendorId];
    const x = list.find((y) => y.id === vendorId) || list.find((y) => y.name === name) || g && list.find((y) => sameVendor(y, g)) || list.find((y) => sameVendor(y, { name }));
    setArea("");
    setFavOnly(false);
    setOnlyPicked(false);
    if (x) {
      setMode("compare");
      setFocus(`vcard-${x.id}`);
      return;
    }
    if (blocks.some((b) => b.id === vendorId)) {
      setMode("feed");
      setCount((c) => Math.max(c, blocks.findIndex((b) => b.id === vendorId) + MOOD_PAGE));
      setFocus(`vblock-${vendorId}`);
      return;
    }
    if (g) openVg(g, 0);
  };
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = document.getElementById(focus);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-[#0A0A0A]");
        setTimeout(() => el.classList.remove("ring-2", "ring-[#0A0A0A]"), 1800);
      }
      setFocus(null);
    }, 120);
    return () => clearTimeout(t);
  }, [focus, mode]);
  const vendorLink = (vendorId, name, cls = "") => /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => goVendor(vendorId, name), className: `text-left min-w-0 hover:underline underline-offset-4 ${cls}`, title: "업체 정보 보기" }, name);
  const [refsAll] = usePersist(REF_KEY, []);
  const refN = VENDOR_REF[kind] ? refsAll.filter((r) => VENDOR_REF[kind].includes(r.cat)).length : 0;
  const [browse, setBrowse] = useState(false);
  useEffect(() => {
    setBrowse(false);
  }, [kind, confirmed && confirmed.name]);
  if (confirmed && confirmed.name && !browse) {
    const item = list.find((x) => x.name === confirmed.name);
    return /* @__PURE__ */ React.createElement(
      VendorDetailPanel,
      {
        kind,
        label: def.label,
        vendor: confirmed,
        item,
        detail,
        onPatch: onPatchDetail,
        privacy,
        onBrowse: () => setBrowse(true),
        onUnconfirm: () => onConfirm(item || confirmed),
        snap,
        onGo,
        extra: VENDOR_REF[kind] && /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement(RefGallery, { cats: VENDOR_REF[kind], compact: true, title: "레퍼런스", eyebrow: "상담 때 보여 줄 사진" }))
      }
    );
  }
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: mode === "compare" ? meta.at ? `${meta.at.slice(0, 10)} 실시간 리서치` : "시작 리스트 · 대표 업체 예시" : "마음에 드는 사진을 골라요", title: def.label }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4 flex-wrap" }, mode === "compare" && /* @__PURE__ */ React.createElement("button", { onClick: () => setFavOnly((f2) => !f2), "aria-pressed": favOnly, className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${favOnly ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}` }, "★ 즐겨찾기", Object.keys(favs).length ? ` ${Object.keys(favs).length}` : ""), mode !== "board" && /* @__PURE__ */ React.createElement(TextInput, { value: area, onChange: setArea, placeholder: "지역·업체명 필터", className: "!w-36 !h-9 !bg-white shadow-sm" }), mode === "compare" && def.topic && /* @__PURE__ */ React.createElement(
    LiveUpdateBtn,
    {
      topic: def.topic,
      params: `&area=${encodeURIComponent(area.trim())}`,
      onData: (j) => {
        const isCustom = (x) => x.custom || !(String(x.id).startsWith(kind) || String(x.id).startsWith("r" + kind));
        const merged = mergeVendorResearch(store.get(listKey, defaultList), j.items, "r" + kind, isCustom);
        store.set(listKey, merged);
        store.set(metaKey, { at: j.fetchedAt });
        setList(merged);
        setMeta({ at: j.fetchedAt });
      }
    }
  ))), /* @__PURE__ */ React.createElement(SegRow, { options: [["feed", "사진으로 고르기"], ...VENDOR_REF[kind] ? [["refs", `레퍼런스 ${refN}`]] : [], ["board", `우리 무드보드 사진 ${myPicks.length} · 업체 ${myVendors.length}`], ["compare", "비교 중인 업체"]], value: mode, onChange: setMode }), mode === "refs" && VENDOR_REF[kind] && /* @__PURE__ */ React.createElement(RefGallery, { cats: VENDOR_REF[kind], compact: true, title: "레퍼런스", eyebrow: `${def.label} — 상담 때 보여 줄 사진` }), confirmed && confirmed.name && /* @__PURE__ */ React.createElement("div", { className: "-mt-2 mb-4 flex items-center gap-2 flex-wrap text-[12px] text-[#525252]" }, "확정: ", /* @__PURE__ */ React.createElement("span", { className: "font-bold text-[#0A0A0A]" }, confirmed.name), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setBrowse(false), className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#0A0A0A] text-white" }, "세부 사항으로 돌아가기")), SNAP_SDM.includes(kind) && /* @__PURE__ */ React.createElement(Card, { className: "mb-4 !p-4 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "제주 스냅 촬영 날 ", kind === "sbouquet" ? "들 부케" : kind === "ssuit" ? "신랑 양복" : "드레스·헤어메이크업"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, snap && snap.name ? /* @__PURE__ */ React.createElement(React.Fragment, null, "제주 스냅: ", snap.name, snap.shoot ? /* @__PURE__ */ React.createElement("span", { className: "font-semibold text-[#525252]" }, " · 촬영일 ", snap.shoot) : null) : "제주 스냅을 아직 안 정했어요"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5" }, kind === "sbouquet" ? "생화 부케는 대부분 주문 제작이고 대여는 조화가 많아요 — 기억스냅 제휴 부케샵과 인스타·블로그 후기로 고른 곳이에요" : kind === "ssuit" ? "제주 스냅 후기에 자주 나온 수트 대여·맞춤 샵이에요 — 드레스·헤메샵에서 수트를 같이 빌려 주는 곳도 있어요" : "아래 목록은 기억스냅 예약 안내 블로그의 드레스·메이크업 제휴샵이에요", snap && snap.handle === "__gieok" ? kind === "sbouquet" ? " — 제휴 표시는 지금 확정한 사진 스냅과 같이 일하는 곳" : " — 지금 확정한 사진 스냅과 같이 일하는 곳" : "")), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => onGo("snap"), className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#F0F0F0] hover:bg-[#E5E5E5] shrink-0" }, "제주 스냅 보기")), mode === "feed" && /* @__PURE__ */ React.createElement(React.Fragment, null, vg === null && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, "사진을 불러오는 중…"), vg && vg.failed && /* @__PURE__ */ React.createElement(Card, { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, "베리굿웨딩 사진 목록을 불러오지 못했어요. 새로고침해 보고, 계속 안 되면 data/verygood-vendors.json 이 배포됐는지 확인해 주세요.")), isSnap && snapSt.err && /* @__PURE__ */ React.createElement(Card, { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#8A5A00]" }, snapSt.err)), vg && blocks.length > 0 && /* @__PURE__ */ React.createElement("label", { className: "mb-3 inline-flex items-center gap-2 text-[13px] font-semibold cursor-pointer" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: onlyPicked, onChange: (e) => setOnlyPicked(e.target.checked), className: "w-4 h-4 accent-[#0A0A0A]" }), "고른 업체만 보기 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "(", myVendors.length, "곳)")), vg && feed.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, onlyPicked && blocks.length ? "아직 고른 업체가 없어요. 업체 이름 옆 [♡ 업체 고르기]를 눌러 모아요." : f ? `"${f}"에 맞는 사진이 없어요. 필터 칸을 비워 보세요.` : "아직 볼 사진이 없어요. [비교 중인 업체]에서 업체의 [정보 찾기]를 누르면 그 사진이 여기에 모여요.")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, feed.slice(0, count).map((b) => {
    const head = b.custom && !customHead;
    if (head) customHead = true;
    const n = b.photos.length, more = n > MOOD_SHOW;
    return /* @__PURE__ */ React.createElement(React.Fragment, { key: b.id }, head && /* @__PURE__ */ React.createElement("div", { className: "pt-3 text-[14px] font-bold" }, "직접 추가한 업체 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 사진: 네이버 이미지 검색")), /* @__PURE__ */ React.createElement(Card, { id: `vblock-${b.id}`, className: "!p-0 overflow-hidden transition-shadow" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 px-3 pt-3 lg:px-4 lg:pt-4" }, !b.embed && /* @__PURE__ */ React.createElement("div", { className: "w-14 h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-[#F0F0F0] shrink-0 ring-2 ring-[#F0F0F0]" }, n > 0 && /* @__PURE__ */ React.createElement("img", { src: b.photos[0].src, alt: "", loading: "lazy", decoding: "async", referrerPolicy: "no-referrer", className: "w-full h-full object-cover", onError: (e) => {
      e.currentTarget.style.display = "none";
    } })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold truncate" }, b.name, /* @__PURE__ */ React.createElement(PartnerBadge, { v: b })), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] truncate" }, b.embed ? /* @__PURE__ */ React.createElement(React.Fragment, null, "인스타그램 @", b.embed, " · 최근 게시물") : /* @__PURE__ */ React.createElement(React.Fragment, null, "사진 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, n), "장", b.info ? ` · ${b.info}` : "")))), b.concept && /* @__PURE__ */ React.createElement("div", { className: "px-3 lg:px-4 mt-2 text-[13px] text-[#3D3D3D] leading-snug line-clamp-2" }, b.concept), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 px-3 lg:px-4 mt-2.5 mb-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap" }, b.ig && /* @__PURE__ */ React.createElement("a", { href: b.ig, target: "_blank", rel: "noopener noreferrer", className: "h-9 px-3.5 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold inline-flex items-center shrink-0" }, "인스타그램에서 보기"), b.home && /* @__PURE__ */ React.createElement("a", { href: b.home, target: "_blank", rel: "noopener noreferrer", className: "h-9 px-3.5 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold inline-flex items-center shrink-0" }, "홈페이지에서 보기"), /* @__PURE__ */ React.createElement(VendorHeart, { on: isVPicked(b.id), onClick: () => toggleVendor(b.id, b.name) }), !b.snap && addBtn(b.name, b.g), b.g && safeUrl(b.g.url) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(b.g.url), target: "_blank", rel: "noopener noreferrer", className: "h-8 px-1 inline-flex items-center text-[12px] font-semibold text-[#525252] underline underline-offset-4 shrink-0" }, "베리굿웨딩에서 보기"))), b.embed && /* @__PURE__ */ React.createElement(IgProfileEmbed, { handle: b.embed, name: b.name }), n === 0 && !b.embed && /* @__PURE__ */ React.createElement("div", { className: "px-3 lg:px-4 pb-3 text-[12px] text-[#6B6B6B]" }, snapSt.busy ? "사진 찾는 중…" : `${snapSt.err ? "사진을 못 불러왔어요" : "찾은 사진이 없어요"} — ${b.home ? "홈페이지" : "인스타그램"}에서 사진을 확인해 주세요.`), n > 0 && (() => {
      const open = !!openBlocks[b.id];
      const shownPhotos = open ? b.photos : b.photos.slice(0, MOOD_SHOW);
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 lg:grid-cols-6 gap-[2px]" }, shownPhotos.map((p, i) => /* @__PURE__ */ React.createElement(
        MoodTile,
        {
          key: p.key,
          src: p.src,
          name: b.name,
          showName: false,
          square: true,
          on: isPicked(b.id, p.key),
          onPick: () => togglePick(b.id, b.name, p.key),
          onOpen: () => b.open(i)
        }
      ))), more && /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          "aria-expanded": open,
          onClick: (e) => {
            const card = e.currentTarget.parentElement;
            setOpenBlocks((o) => ({ ...o, [b.id]: !open }));
            if (open && card) requestAnimationFrame(() => {
              const y = card.getBoundingClientRect().top + window.scrollY - 80;
              if (y < window.scrollY) window.scrollTo({ top: y, behavior: "smooth" });
            });
          },
          className: "w-full h-11 text-[13px] font-semibold text-[#525252] border-t border-[#F0F0F0] hover:bg-[#FAFAFA]"
        },
        open ? "접기" : `사진 ${n - MOOD_SHOW}장 더 보기`
      ));
    })()));
  })), count < feed.length && /* @__PURE__ */ React.createElement("div", { ref: sentinel, className: "h-12 flex items-center justify-center text-[12px] text-[#6B6B6B]" }, "업체 더 불러오는 중…"), isSnap && blocks.length > 0 && IG_EMBED_KINDS.includes(kind) && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[11px] text-[#6B6B6B]" }, "사진: 업체 인스타그램 최근 게시물(인스타그램 공식 프로필 임베드) — 더 보려면 [인스타그램에서 보기]를 눌러요."), isSnap && blocks.length > 0 && !IG_EMBED_KINDS.includes(kind) && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[11px] text-[#6B6B6B]" }, "사진: 네이버 이미지 검색(후기·블로그) — 업체 공식 사진은 인스타그램·홈페이지에서 확인해 주세요. 7일마다 새로 찾아요."), vgVendors.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[11px] text-[#6B6B6B]" }, "출처: 베리굿웨딩(verygoodwedding.co.kr) 제휴 업체 ", vgVendors.length, "곳 · ", vg.at ? String(vg.at).slice(0, 10) : "?", " 기준 · 업체마다 첫 줄 ", MOOD_SHOW, "장이 보이고 [사진 N장 더 보기]로 그 자리에서 펼쳐져요. 사진을 누르면 크게 넘겨 볼 수 있어요. 가격은 견적 상담으로 확인해요.")), mode === "board" && (myPicks.length === 0 && myVendors.length === 0 ? /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "사진으로 고르기에서 마음에 드는 사진이나 업체에 ♡를 눌러 모아요")) : /* @__PURE__ */ React.createElement(React.Fragment, null, myVendors.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "고른 업체 ", myVendors.length, "곳 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 최근에 고른 순")), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-3" }, "[업체 고르기]로 모은 업체예요"), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 mb-6" }, myVendors.map((p) => {
    const cover = vendorCover(p.vendorId);
    return /* @__PURE__ */ React.createElement(Card, { key: p.id, className: "!p-3 flex items-center gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => goVendor(p.vendorId, p.vendorName), "aria-label": `${p.vendorName} 업체 정보 보기`, className: "flex items-center gap-3 min-w-0 flex-1 text-left group" }, /* @__PURE__ */ React.createElement("div", { className: "w-11 h-14 rounded-lg overflow-hidden bg-[#F0F0F0] shrink-0" }, cover && /* @__PURE__ */ React.createElement("img", { src: cover, alt: "", loading: "lazy", decoding: "async", referrerPolicy: "no-referrer", onError: (e) => {
      e.currentTarget.style.display = "none";
    }, className: "w-full h-full object-cover" })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold truncate group-hover:underline underline-offset-4" }, p.vendorName), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, p.by || "우리", " 골랐어요 · 누르면 업체 정보"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 shrink-0" }, addBtn(p.vendorName, vgById[p.vendorId]), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => toggleVendor(p.vendorId, p.vendorName),
        "aria-label": `${p.vendorName} 고른 업체에서 빼기`,
        className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#F0F0F0] text-[#525252] hover:bg-[#E5E5E5]"
      },
      "빼기"
    )));
  }))), topVendors.length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "우리 취향에 맞는 업체 TOP 5"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-3" }, "고른 사진이 많은 순 · 최대 5곳"), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 mb-6" }, topVendors.map((r, i) => /* @__PURE__ */ React.createElement(Card, { key: r.id, className: "!p-3 flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "w-5 text-[15px] font-bold text-center shrink-0" }, i + 1), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 shrink-0" }, r.picks.slice(0, 3).map((p) => /* @__PURE__ */ React.createElement(PickThumb, { key: p.id, p, base }))), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold truncate" }, vendorLink(r.id, r.name)), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "고른 사진 ", r.picks.length, "장", isVPicked(r.id) && /* @__PURE__ */ React.createElement("span", { className: "ml-1.5 font-bold text-[#E11D48]" }, "♥ 고른 업체"))), addBtn(r.name, vgById[r.id])))), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-3" }, "고른 사진 ", myPicks.length, "장 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 업체별, 최근에 고른 순")), /* @__PURE__ */ React.createElement("div", { className: "space-y-5" }, pickGroups.map((g) => /* @__PURE__ */ React.createElement("div", { key: g.id }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-2 truncate" }, vendorLink(g.id, g.name), " ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "· ", g.picks.length, "장")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, g.picks.map((p) => /* @__PURE__ */ React.createElement(PickTile, { key: p.id, p, base, name: p.vendorName, showName: false, on: true, onPick: () => togglePick(p.vendorId, p.vendorName, p.photo), onOpen: () => openPick(p), badge: `${p.by || "우리"} 고름` }))))))))), view && /* @__PURE__ */ React.createElement(
    PhotoViewer,
    {
      srcs: view.srcs,
      fallbacks: view.fallbacks,
      index: view.i,
      onIndex: (i) => setView({ ...view, i }),
      onClose: () => setView(null),
      label: `${view.name} 사진`,
      caption: view.src ? `${view.name} · 사진: ${view.src}` : view.name,
      extra: /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center gap-2 flex-wrap pl-1 pr-3 py-1 rounded-2xl bg-black/75 text-white" }, /* @__PURE__ */ React.createElement(PickHeart, { on: isPicked(view.vendorId, view.keys[view.i]), onClick: () => togglePick(view.vendorId, view.name, view.keys[view.i]) }), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold truncate min-w-0" }, view.name), /* @__PURE__ */ React.createElement(VendorHeart, { dark: true, on: isVPicked(view.vendorId), onClick: () => toggleVendor(view.vendorId, view.name) }), view.ig && /* @__PURE__ */ React.createElement("a", { href: view.ig, target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold underline underline-offset-4 shrink-0" }, "인스타그램"), view.vg && safeUrl(view.url) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(view.url), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold underline underline-offset-4 shrink-0" }, "베리굿웨딩에서 보기"), addBtn(view.name, view.vg, true))
    }
  ), mode === "compare" && /* @__PURE__ */ React.createElement(React.Fragment, null, shown.length === 0 && /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, favOnly ? "즐겨찾기한 업체가 없어요. ☆를 눌러 추가하거나 ★ 즐겨찾기 버튼을 다시 눌러 전체를 보세요." : "조건에 맞는 업체가 없어요. 필터를 지우거나 아래에서 직접 추가해 보세요.")), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, shown.map((v) => /* @__PURE__ */ React.createElement(Card, { key: v.id, id: `vcard-${v.id}`, className: `h-full flex flex-col transition-shadow ${isConf(v) ? "border !border-[#0A0A0A]" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "w-full h-36 rounded-xl mb-3 overflow-hidden" }, /* @__PURE__ */ React.createElement(ThumbImg, { src: v.img || v.lookup && v.lookup.images && v.lookup.images[0] && v.lookup.images[0].thumb || "", alt: v.name, fallback: /* @__PURE__ */ React.createElement("div", { className: "w-full h-full flex flex-col items-center justify-center gap-1 text-white", style: { background: VENDOR_THUMB[kind] } }, /* @__PURE__ */ React.createElement("span", { className: "text-[30px] font-bold opacity-90" }, (v.name || "?")[0]), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold tracking-[0.24em] opacity-70" }, def.label.replace("인기 ", ""))) })), /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-1" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, v.name, " ", isConf(v) && /* @__PURE__ */ React.createElement("span", { className: "align-middle ml-1 text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "✓ 확정"), rankOf(rank, v.name) > 0 && /* @__PURE__ */ React.createElement("span", { className: "align-middle ml-1 text-[10px] font-bold text-[#0A0A0A] bg-[#FFF4D6] px-2 py-0.5 rounded-full" }, rankOf(rank, v.name), "순위"), /* @__PURE__ */ React.createElement(PartnerBadge, { v })), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, v.area)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[13px] font-bold" }, v.price), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => toggleFav(v.name),
      "aria-pressed": !!favs[v.name],
      "aria-label": favs[v.name] ? "즐겨찾기 해제" : "즐겨찾기",
      title: favs[v.name] ? "즐겨찾기 해제" : "즐겨찾기",
      className: `w-8 h-8 rounded-full flex items-center justify-center text-[17px] leading-none transition-colors ${favs[v.name] ? "bg-[#FFF4D6] text-[#D99A00]" : "bg-[#F5F5F5] text-[#9A9A9A] hover:text-[#525252]"}`
    },
    favs[v.name] ? "★" : "☆"
  ), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => removeVendor(v), className: "!w-7 !h-7" }))), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3 flex-1" }, v.note), vendorStaff(v) && /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, "작가 ", vendorStaff(v).length, "명 인스타 — 작가마다 사진 느낌이 달라요"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-3 gap-y-1" }, vendorStaff(v).map(([n, h]) => /* @__PURE__ */ React.createElement("a", { key: h, href: `https://www.instagram.com/${h}/`, target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, n)))), /* @__PURE__ */ React.createElement(VendorLookup, { v, kind, onSave: (lk) => saveLookup(v.id, lk) }), /* @__PURE__ */ React.createElement("div", { className: "mt-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 min-w-0" }, /* @__PURE__ */ React.createElement("a", { href: naverSearch(`${v.name} ${def.q}`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "네이버 검색"), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${v.name} ${def.q} 후기 가격`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, "후기·견적"), safeUrl(v.url) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(v.url), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, /instagram\.com/i.test(v.url) ? "인스타" : "업체 페이지")), /* @__PURE__ */ React.createElement(RankSelect, { order: rank, id: v.name, onChange: (k) => setRank((r) => withRank(r, v.name, k)), label: `${v.name} 순위` }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onConfirm(v),
      className: `h-8 px-3 rounded-lg text-[12px] font-bold shrink-0 transition-colors ${isConf(v) ? "bg-[#F0F0F0] text-[#6B6B6B] hover:bg-[#E5E5E5]" : "bg-[#0A0A0A] text-white"}`
    },
    isConf(v) ? "확정 해제" : "확정하기"
  )), kind === "ring" && /* @__PURE__ */ React.createElement(TextInput, { value: v.memo || "", onChange: (val) => patchVendor(v.id, "memo", val), placeholder: "본 반지 메모 (예: 18K 로즈골드, 다이아 없음, 12호·18호, 180만)", className: "!h-8 !text-[12px] mb-1.5" }), /* @__PURE__ */ React.createElement(TextInput, { value: v.img || "", onChange: (val) => patchVendor(v.id, "img", val), placeholder: "대표 사진 URL 붙여넣기 (선택)", className: "!h-8 !text-[12px]" })))), /* @__PURE__ */ React.createElement(Card, { className: "h-full flex flex-col justify-center border-dashed" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, "직접 추가 · 박람회·후기에서 알게 된 업체를 적어 두고 부부가 함께 비교해요"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: nv.name, onChange: (v) => setNv({ ...nv, name: v }), placeholder: "업체명 *" }), /* @__PURE__ */ React.createElement(TextInput, { value: nv.area, onChange: (v) => setNv({ ...nv, area: v }), placeholder: "지역 (예: 청담)" }), /* @__PURE__ */ React.createElement(TextInput, { value: nv.price, onChange: (v) => setNv({ ...nv, price: v }), placeholder: "가격대 (예: 180만~)" }), /* @__PURE__ */ React.createElement(TextInput, { value: nv.note, onChange: (v) => setNv({ ...nv, note: v }), placeholder: "메모" })), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        if (!nv.name.trim()) return;
        setList([...list, { id: uid(), img: "", custom: true, ...nv, name: nv.name.trim() }]);
        setNv({ name: "", area: "", price: "", note: "" });
      },
      className: "h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 15 }),
    " 리스트에 추가"
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "시작 리스트는 대표 업체 일부 예시이고, 대표 사진은 네이버 검색 썸네일(컨셉 참고용)이에요. 가격은 시즌·구성별 편차가 커서 견적 상담이 정확해요. ", def.topic ? "[최신 정보로 갱신]을 누르면 지금 인기 업체를 웹에서 다시 조사해요. 직접 추가한 업체와 등록한 사진은 갱신해도 그대로 남아요. " : "", "카드의 [정보 찾기]는 그 업체의 사진(네이버 이미지 검색)과 컨셉·후기 요약(웹 검색)을 모아 보여 주고, 적어 둔 가격·메모는 바꾸지 않아요."))));
}
const guestCnt = (g) => Math.max(1, Number(g.cnt) || 1);
const guestHeads = (arr) => arr.reduce((s, g) => s + guestCnt(g), 0);
const GUEST_SORTS = [["added", "등록순"], ["name", "이름순"], ["rel", "관계순"]];
function GuestSideCard({ title, list, nv, setNv, onAdd, onToggle, onRemove, onPatch, onMove, onReorder, relOptions = [] }) {
  const relDlId = useRef("rel-dl-" + uid()).current;
  const [sort, setSort] = useState("added");
  const [relFilter, setRelFilter] = useState("all");
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ name: "", rel: "" });
  const relKey = (g) => String(g.rel || "").trim();
  const relGroups = list.reduce((m, g) => {
    const k = relKey(g);
    m[k] = (m[k] || 0) + guestCnt(g);
    return m;
  }, {});
  const relChips = Object.entries(relGroups).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  const [dragId, setDragId] = useState(null);
  const dragRef = useRef(null);
  const startDrag = (e, id) => {
    e.preventDefault();
    dragRef.current = id;
    setDragId(id);
    const mv = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const li = el && el.closest ? el.closest("li[data-gid]") : null;
      const tid = li && li.getAttribute("data-gid");
      if (tid && tid !== dragRef.current) onReorder(dragRef.current, tid);
    };
    const up = () => {
      dragRef.current = null;
      setDragId(null);
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const sorted = sort === "added" ? list : [...list].sort((a, b) => String(a[sort] || "").localeCompare(String(b[sort] || ""), "ko"));
  const activeRel = relFilter !== "all" && relGroups[relFilter] != null ? relFilter : "all";
  const shown = activeRel === "all" ? sorted : sorted.filter((g) => relKey(g) === activeRel);
  const canReorder = sort === "added" && activeRel === "all";
  const saveEdit = () => {
    if (!draft.name.trim()) return;
    onPatch(editId, { name: draft.name.trim(), rel: draft.rel.trim() });
    setEditId(null);
  };
  return /* @__PURE__ */ React.createElement(Card, { className: "h-full" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold" }, title), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold text-[#6B6B6B]" }, guestHeads(list), "명 · 청첩장 모임 ", guestHeads(list.filter((g) => g.chungmo)), "명")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-3" }, /* @__PURE__ */ React.createElement(TextInput, { value: nv.name, onChange: (v) => setNv({ ...nv, name: v }), placeholder: "이름 *", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement(TextInput, { value: nv.rel, onChange: (v) => setNv({ ...nv, rel: v }), placeholder: "관계 (예: 친구·회사)", className: "flex-1 min-w-0", list: relDlId }), /* @__PURE__ */ React.createElement(NumInput, { value: nv.cnt, onChange: (v) => setNv({ ...nv, cnt: v }), className: "!w-[64px] shrink-0 text-center", ariaLabel: "인원(동반 포함)" }), /* @__PURE__ */ React.createElement("button", { onClick: onAdd, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " 추가")), /* @__PURE__ */ React.createElement("datalist", { id: relDlId }, relOptions.map((r) => /* @__PURE__ */ React.createElement("option", { key: r, value: r }))), list.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 mb-2" }, GUEST_SORTS.map(([k, l]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: k,
      onClick: () => setSort(k),
      className: `h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${sort === k ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#6B6B6B] hover:bg-[#E5E5E5]"}`
    },
    l
  ))), relChips.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1 mb-2" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setRelFilter("all"),
      className: `h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${activeRel === "all" ? "bg-[#0A0A0A] text-white" : "bg-white border border-[#E5E5E5] text-[#6B6B6B] hover:bg-[#FAFAFA]"}`
    },
    "전체 ",
    guestHeads(list),
    "명"
  ), relChips.map(([k, n]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: k || "__none",
      onClick: () => setRelFilter(activeRel === k ? "all" : k),
      className: `h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${activeRel === k ? "bg-[#0A0A0A] text-white" : "bg-white border border-[#E5E5E5] text-[#6B6B6B] hover:bg-[#FAFAFA]"}`
    },
    k || "관계 미지정",
    " ",
    n,
    "명"
  ))), list.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] py-4 text-center" }, "아직 없어요. 위에서 하객을 추가해 보세요. 숫자 칸은 동반 포함 인원수예요."), /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F5F5F5]" }, shown.map((g, idx) => /* @__PURE__ */ React.createElement("li", { key: g.id, "data-gid": g.id, className: `py-2.5 transition-colors ${dragId === g.id ? "bg-[#F5F5F5] opacity-60 rounded-lg" : ""}` }, editId === g.id ? /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }), placeholder: "이름 *", className: "!h-8 !text-[13px] flex-1 min-w-0" }), /* @__PURE__ */ React.createElement(TextInput, { value: draft.rel, onChange: (v) => setDraft({ ...draft, rel: v }), placeholder: "관계", className: "!h-8 !text-[13px] flex-1 min-w-0", list: relDlId }), /* @__PURE__ */ React.createElement("button", { onClick: saveEdit, className: "h-8 px-3 rounded-lg bg-[#0A0A0A] text-white text-[12px] font-semibold shrink-0" }, "저장"), /* @__PURE__ */ React.createElement("button", { onClick: () => setEditId(null), className: "h-8 px-2.5 rounded-lg bg-[#F0F0F0] text-[#6B6B6B] text-[12px] font-semibold shrink-0" }, "취소")) : /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, canReorder && /* @__PURE__ */ React.createElement(
    "button",
    {
      onPointerDown: (e) => startDrag(e, g.id),
      title: "드래그로 순서 이동",
      className: "h-8 w-5 -ml-1 flex items-center justify-center text-[#C8C8C8] hover:text-[#6B6B6B] cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
    },
    /* @__PURE__ */ React.createElement("svg", { width: "10", height: "14", viewBox: "0 0 10 14", fill: "currentColor" }, /* @__PURE__ */ React.createElement("circle", { cx: "2.5", cy: "2", r: "1.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "7.5", cy: "2", r: "1.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "2.5", cy: "7", r: "1.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "7.5", cy: "7", r: "1.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "2.5", cy: "12", r: "1.4" }), /* @__PURE__ */ React.createElement("circle", { cx: "7.5", cy: "12", r: "1.4" }))
  ), canReorder && /* @__PURE__ */ React.createElement("span", { className: "flex flex-col shrink-0 -my-1 -mr-1.5" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onMove(g.id, -1),
      title: "위로",
      disabled: idx === 0,
      className: "h-4 w-5 flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] disabled:opacity-25 disabled:hover:text-[#737373]"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 11, className: "-rotate-90" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onMove(g.id, 1),
      title: "아래로",
      disabled: idx === shown.length - 1,
      className: "h-4 w-5 flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] disabled:opacity-25 disabled:hover:text-[#737373]"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 11, className: "rotate-90" })
  )), /* @__PURE__ */ React.createElement("span", { className: "text-[14px] font-semibold flex-1 min-w-0 truncate" }, g.name), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B] shrink-0" }, g.rel || "-"), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-0.5 shrink-0", title: "동반 포함 인원수" }, /* @__PURE__ */ React.createElement(NumInput, { value: guestCnt(g), onChange: (v) => onPatch(g.id, { cnt: Math.max(1, Number(v) || 1) }), className: "!h-7 !w-11 !px-1 text-center !text-[12px]" }), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B]" }, "명")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onToggle(g.id),
      title: "청첩장 모임 참석 여부 — 누르면 바뀌어요",
      "aria-pressed": !!g.chungmo,
      className: `h-7 px-2.5 rounded-full text-[11px] font-bold shrink-0 transition-colors ${g.chungmo ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#6B6B6B] hover:bg-[#E5E5E5]"}`
    },
    g.chungmo ? "✓ 청모 참석" : "청모 미참석"
  ), /* @__PURE__ */ React.createElement(IconBtn, { name: "brush", title: "이름·관계 수정", onClick: () => {
    setEditId(g.id);
    setDraft({ name: g.name, rel: g.rel || "" });
  }, className: "!w-7 !h-7 shrink-0" }), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => onRemove(g.id), className: "!w-7 !h-7 shrink-0" }))))));
}
function GuestListTab() {
  const [guests, setGuests] = usePersist("wedding-guests-v1", []);
  const [nvH, setNvH] = useState({ name: "", rel: "", cnt: 1 });
  const [nvW, setNvW] = useState({ name: "", rel: "", cnt: 1 });
  const add = (side, nv, setNv) => {
    if (!nv.name.trim()) return;
    setGuests([...guests, { id: uid(), at: Date.now(), side, name: nv.name.trim(), rel: nv.rel.trim(), cnt: Math.max(1, Number(nv.cnt) || 1), chungmo: false }]);
    setNv({ name: "", rel: "", cnt: 1 });
  };
  const toggle = (id) => setGuests(guests.map((g) => g.id === id ? { ...g, chungmo: !g.chungmo, u: Date.now() } : g));
  const patch = (id, p) => setGuests(guests.map((g) => g.id === id ? { ...g, ...p, u: Date.now() } : g));
  const remove = (id) => setGuests(guests.filter((g) => g.id !== id));
  const move = (id, dir) => {
    const g = guests.find((x) => x.id === id);
    if (!g) return;
    const sideIds = guests.filter((x) => x.side === g.side).map((x) => x.id);
    const j = sideIds.indexOf(id) + dir;
    if (j < 0 || j >= sideIds.length) return;
    const a = guests.findIndex((x) => x.id === id), b = guests.findIndex((x) => x.id === sideIds[j]);
    const next = [...guests];
    [next[a], next[b]] = [next[b], next[a]];
    setGuests(next);
  };
  const reorder = (id, targetId) => setGuests((prev) => {
    const from = prev.findIndex((g) => g.id === id), to = prev.findIndex((g) => g.id === targetId);
    if (from < 0 || to < 0 || from === to || prev[from].side !== prev[to].side) return prev;
    const next = [...prev];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
  const bySide = (s) => guests.filter((g) => g.side === s);
  const relOptions = Object.entries(guests.reduce((m, g) => {
    const k = String(g.rel || "").trim();
    if (k) m[k] = (m[k] || 0) + 1;
    return m;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([k]) => k);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "하객 관리", title: "하객 초대 리스트" }), /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-4 divide-x divide-[#F0F0F0] text-center" }, /* @__PURE__ */ React.createElement("div", { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, "총 하객"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, guestHeads(guests), "명"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#737373]" }, guests.length, "팀")), /* @__PURE__ */ React.createElement("div", { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, "신랑측"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, guestHeads(bySide("h")), "명"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#737373]" }, bySide("h").length, "팀")), /* @__PURE__ */ React.createElement("div", { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, "신부측"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, guestHeads(bySide("w")), "명"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#737373]" }, bySide("w").length, "팀")), /* @__PURE__ */ React.createElement("div", { className: "p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1" }, "청첩장 모임 참석"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold", style: { fontVariantNumeric: "tabular-nums" } }, guestHeads(guests.filter((g) => g.chungmo)), "명"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#737373]" }, guests.filter((g) => g.chungmo).length, "팀")))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-start" }, /* @__PURE__ */ React.createElement(
    GuestSideCard,
    {
      title: "🤵 신랑측",
      list: bySide("h"),
      nv: nvH,
      setNv: setNvH,
      onAdd: () => add("h", nvH, setNvH),
      onToggle: toggle,
      onRemove: remove,
      onPatch: patch,
      onMove: move,
      onReorder: reorder,
      relOptions
    }
  ), /* @__PURE__ */ React.createElement(
    GuestSideCard,
    {
      title: "👰 신부측",
      list: bySide("w"),
      nv: nvW,
      setNv: setNvW,
      onAdd: () => add("w", nvW, setNvW),
      onToggle: toggle,
      onRemove: remove,
      onPatch: patch,
      onMove: move,
      onReorder: reorder,
      relOptions
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, '숫자 칸은 동반 포함 인원수예요. 위 집계(총 하객·측별·청첩장 모임)는 인원을 합한 값이고, 아래 작은 숫자는 팀(적은 건) 수예요. 청모 버튼을 누르면 청첩장 모임 참석 여부가 바뀌고, 연필로 이름·관계를 고쳐요. 관계 칩(예: 친구 12명)을 누르면 그 관계만 보여요. 관계 글자가 완전히 같은 것끼리 묶여서 "친구"와 "대학 친구"는 따로 묶여요. 정렬(등록·이름·관계순)은 보기 순서만 바꿔요. 저장 순서를 바꾸려면 등록순 보기에서 왼쪽 ⠿ 손잡이를 끌거나 ▲▼를 눌러요. 하객 인원은 예산표의 식대 계산에도 쓰여요.'))));
}
const CARD_DEDUCTION_LIMIT = (gross) => gross <= 7e3 ? 300 : 250;
function deductionRoom(p) {
  const T = p.gross * 0.25, L = CARD_DEDUCTION_LIMIT(p.gross);
  return { room: Math.max(0, L - Math.max(0, p.used - T) * 0.15), gap: Math.max(0, T - p.used) };
}
function payOnePerson(p, x, cardRate) {
  const { room, gap } = deductionRoom(p);
  const y = x - Math.min(x, gap);
  const m = marginalTaxRate(p.gross * 1e4), cr = Math.max(0, cardRate) / 100;
  const evalK = (k) => {
    const ded = Math.min(room, 0.3 * k + 0.15 * (y - k));
    return { cash: k, card: x - k, ded, total: ded * m + (x - k) * cr };
  };
  const kstar = Math.min(y, Math.max(0, (room - 0.15 * y) / 0.15));
  return [y, kstar, 0].map(evalK).reduce((a, b) => b.total > a.total + 1e-9 ? b : a);
}
function payOneMethod(p, x, method, cardRate) {
  const { room, gap } = deductionRoom(p);
  const ded = Math.min(room, Math.max(0, x - gap) * (method === "cash" ? 0.3 : 0.15));
  return ded * marginalTaxRate(p.gross * 1e4) + (method === "card" ? x * Math.max(0, cardRate) / 100 : 0);
}
function planWeddingPayment(p1, p2, amount, opt) {
  const local = opt.localOn ? Math.min(amount, Math.max(0, opt.localLimit)) : 0;
  const localSave = local * Math.max(0, opt.localRate) / 100;
  const rest = amount - local;
  const step = Math.max(10, Math.ceil(rest / 200 / 10) * 10);
  const at = (s) => {
    const a = payOnePerson(p1, s, opt.cardRate), b = payOnePerson(p2, rest - s, opt.cardRate);
    return { a, b, total: a.total + b.total + localSave };
  };
  let best = at(0);
  for (let s = step; s < rest + step; s += step) {
    const c = at(Math.min(s, rest));
    if (c.total > best.total + 1e-9) best = c;
  }
  const all = (who, method) => (who === 1 ? payOneMethod(p1, rest, method, opt.cardRate) : payOneMethod(p2, rest, method, opt.cardRate)) + localSave;
  return { local, localSave, best, alts: { p1cash: all(1, "cash"), p2cash: all(2, "cash"), p1card: all(1, "card"), p2card: all(2, "card") } };
}
(() => {
  const r = planWeddingPayment({ gross: 9700, used: 3e3 }, { gross: 6e3, used: 1800 }, 3e3, { cardRate: 1.5, localOn: false, localRate: 0, localLimit: 0 });
  if (r.best.total + 1e-9 < Math.max(...Object.values(r.alts))) console.error("planWeddingPayment: 최적안이 몰아주기보다 나쁨", r);
  if (!(r.best.a.ded > 0 && r.best.b.ded > 0)) console.error("planWeddingPayment: 한도 남은 두 사람 모두에게 나눠야 함", r);
  if (payOnePerson({ gross: 9700, used: 3e3 }, 500, 0.5).cash !== 500) console.error("payOnePerson: 한도가 안 차는 금액은 현금영수증이어야 함");
  const low = payOnePerson({ gross: 3500, used: 1500 }, 1e3, 1.5);
  if (!(low.card > low.cash)) console.error("payOnePerson: 저소득은 카드가 유리해야 함", low);
})();
const WEDDING_PAY_CHECKS = ["지역화폐 사용 가능 여부 (웨딩홀 가맹·월 구매한도·가족 명의·분할 결제)", "현금영수증 발급 가능 여부", "카드 적립률과 월 적립 한도", "마일리지 혜택", "무이자 할부 가능 여부", "각자 올해 카드·현금 사용액이 연봉 25%를 넘었는지", "각자 공제한도 남은 금액", "결제 명의 (위 추천대로)", "분할 결제 가능 여부", "웨딩홀 현금 할인 (식대·대관료 할인, 서비스 추가)"];
const WEDDING_PAY_DEFAULT = { amount: null, used1: null, used2: null, cardRate: 1.5, localOn: false, localRate: 7, localLimit: 0, checks: {} };
function WeddingPaymentGuide({ hh, privacy, remaining }) {
  const [payRaw, setPay] = usePersist("wedding-payment-v1", WEDDING_PAY_DEFAULT);
  const pay = { ...WEDDING_PAY_DEFAULT, ...payRaw };
  const set = (k, v) => setPay({ ...pay, [k]: v });
  const g1 = Number(hh.income1) || 0, g2 = Number(hh.income2) || 0;
  const n1 = hh.label1 || "본인", n2 = hh.label2 || "배우자";
  const used1 = pay.used1 ?? Math.round(g1 * 0.3), used2 = pay.used2 ?? Math.round(g2 * 0.3);
  const amount = pay.amount ?? Math.max(0, remaining);
  const plan = planWeddingPayment({ gross: g1, used: used1 }, { gross: g2, used: used2 }, amount, pay);
  const lines = [[n1, plan.best.a], [n2, plan.best.b]].filter(([, r]) => r.cash + r.card > 0).map(([name, r]) => ({
    name,
    parts: [r.cash > 0 && `현금영수증 ${manWon(Math.round(r.cash))}`, r.card > 0 && `카드 ${manWon(Math.round(r.card))}`].filter(Boolean).join(" + ")
  }));
  const eff = (v) => `약 ${Math.round(v).toLocaleString()}만원`;
  const altRows = [[`${n1}에게 몰아 현금영수증`, plan.alts.p1cash], [`${n2}에게 몰아 현금영수증`, plan.alts.p2cash], [`${n1}에게 몰아 카드`, plan.alts.p1card], [`${n2}에게 몰아 카드`, plan.alts.p2card]];
  const checksDone = WEDDING_PAY_CHECKS.filter((t) => pay.checks[t]).length;
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "잔금 결제 가이드", title: "잔금, 누가 어떻게 결제할까" }), /* @__PURE__ */ React.createElement(Card, { className: "!border-[#0A0A0A] border" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-1" }, "잔금 ", manWon(amount), pay.amount == null && ` (예산표 ${WEDDING_HALL_CAT} 합계 연동)`, " · 우리 부부 추천"), amount <= 0 ? /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252]" }, "남은 잔금이 없어요. 아래에 결제할 금액을 넣으면 계산해 드려요.") : /* @__PURE__ */ React.createElement(React.Fragment, null, plan.local > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mt-1" }, "🪙 지역화폐로 ", manWon(plan.local), "을 먼저 내요. 결제할 때 바로 ", eff(plan.localSave), " 할인돼요."), lines.map((l) => /* @__PURE__ */ React.createElement("div", { key: l.name, className: "text-[15px] font-bold mt-1" }, l.name, " 명의 · ", l.parts)), plan.best.a.cash + plan.best.b.cash === 0 && pay.cardRate > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[13px] text-[#525252] bg-[#FAFAFA] rounded-lg px-3 py-2" }, "💡 잔금이 커서 ", /* @__PURE__ */ React.createElement("b", null, "카드 공제율 15%만으로도 두 사람 공제 한도가 다 차요."), " 현금영수증으로 바꿔도 공제는 늘지 않고 카드 적립만 잃어요. 카드 월 적립 한도가 낮다면 실제 적립률로 고쳐 다시 보세요."), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[14px] text-[#525252]" }, "예상 효과 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, eff(plan.best.total)), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "(연말정산 환급 + 카드 적립", plan.local > 0 ? " + 지역화폐 할인" : "", ")")), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-2 mt-3" }, altRows.map(([label, v]) => /* @__PURE__ */ React.createElement("div", { key: label, className: "flex justify-between bg-[#FAFAFA] rounded-lg px-3 py-2 text-[13px]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, label), /* @__PURE__ */ React.createElement("span", { className: "font-semibold", style: { fontVariantNumeric: "tabular-nums" } }, eff(v)))))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "결제할 잔금(만원)"), /* @__PURE__ */ React.createElement(NumInput, { ariaLabel: "결제할 잔금(만원)", value: amount, onChange: (v) => set("amount", v) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, n1, " 올해 사용액(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: used1, onChange: (v) => set("used1", v) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, n2, " 올해 사용액(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: used2, onChange: (v) => set("used2", v) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "카드 적립률(%)"), /* @__PURE__ */ React.createElement(NumInput, { ariaLabel: "카드 적립률(%)", value: pay.cardRate, onChange: (v) => set("cardRate", v) }))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-3 mt-3 items-end" }, /* @__PURE__ */ React.createElement("label", { className: "h-10 px-3 rounded-lg bg-[#F5F5F5] text-[13px] font-semibold text-[#3D3D3D] flex items-center gap-2 cursor-pointer select-none" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!pay.localOn, onChange: () => set("localOn", !pay.localOn), className: "w-4 h-4 accent-[#0A0A0A] shrink-0" }), "지역화폐 쓸 수 있음"), pay.localOn && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "할인율(%)"), /* @__PURE__ */ React.createElement(NumInput, { value: pay.localRate, onChange: (v) => set("localRate", v) })), pay.localOn && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "쓸 수 있는 한도(만원)"), /* @__PURE__ */ React.createElement(NumInput, { value: pay.localLimit, onChange: (v) => set("localLimit", v) }))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid sm:grid-cols-2 gap-2 text-[12px] text-[#6B6B6B]" }, [[n1, g1, used1], [n2, g2, used2]].map(([n, g, u]) => /* @__PURE__ */ React.createElement("div", { key: n }, n, " · 총급여 ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(g)), " · 공제 시작선(총급여의 25%) ", manWon(Math.round(g * 0.25)), u < g * 0.25 && "(아직 못 넘음)", " · 공제 한도 ", CARD_DEDUCTION_LIMIT(g), "만원 · 한계세율(소득이 늘 때 붙는 세율) ", (marginalTaxRate(g * 1e4) * 100).toFixed(1), "%"))), (pay.amount != null || pay.used1 != null || pay.used2 != null) && /* @__PURE__ */ React.createElement("button", { onClick: () => setPay({ ...pay, amount: null, used1: null, used2: null }), className: "mt-3 text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "잔금·사용액을 자동값으로 되돌리기"), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "올해 사용액은 잔금을 빼고 연말까지 쓸 카드·현금영수증 합계 예상치예요(비워두면 연봉의 30%로 가정). 소득공제는 기본 한도만 반영한 추정치예요."))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-3 mt-3 items-start" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, "결제 직전 체크리스트"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-bold" }, checksDone, "/", WEDDING_PAY_CHECKS.length)), /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5" }, WEDDING_PAY_CHECKS.map((t) => /* @__PURE__ */ React.createElement("label", { key: t, className: "flex gap-2 items-start text-[13px] cursor-pointer" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!pay.checks[t], onChange: () => set("checks", { ...pay.checks, [t]: !pay.checks[t] }), className: "mt-0.5 accent-[#0A0A0A]" }), /* @__PURE__ */ React.createElement("span", { className: pay.checks[t] ? "line-through text-[#737373]" : "text-[#3D3D3D]" }, t)))), /* @__PURE__ */ React.createElement("p", { className: "mt-2.5 text-[12px] text-[#6B6B6B] leading-relaxed" }, "지역화폐는 웨딩홀 가맹 여부(연매출 30억 초과 사업장은 제외)와 월 구매 한도를 확인해요. 남의 지역화폐를 넘겨받아 쓰면 안 돼요(각자 본인 명의로 나눠 결제). 현금은 10만원 이상이면 요청하지 않아도 현금영수증을 발급해야 하는 업종이에요.")), /* @__PURE__ */ React.createElement(Card, { className: "!p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "판단 기준"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 text-[13px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", null, "🪙 ", /* @__PURE__ */ React.createElement("b", null, "지역화폐가 되면 먼저 써요."), " 할인율(보통 5~10%)과 월 구매 한도는 지자체마다 달라요. 2023년부터 연매출 30억원이 넘는 사업장은 가맹점에서 빠지니 큰 웨딩홀은 안 될 수 있어요. 카드형 지역화폐는 연말정산에서 체크카드처럼 30% 공제돼요. 남의 지역화폐를 넘겨받아 쓰면 안 돼요(각자 본인 명의로 나눠 결제)."), /* @__PURE__ */ React.createElement("li", null, "🧾 ", /* @__PURE__ */ React.createElement("b", null, "공제율은 현금영수증 30%, 카드 15%예요."), " 공제 한도가 남아 있으면 보통 현금영수증이 유리해요."), /* @__PURE__ */ React.createElement("li", null, "💳 ", /* @__PURE__ */ React.createElement("b", null, "연봉이 낮거나 공제 한도가 다 찼으면 카드가 나아요."), " 세금 혜택이 작아서 적립·캐시백·마일리지가 더 클 수 있어요. 적립률보다 ", /* @__PURE__ */ React.createElement("b", null, "월 적립 한도"), "를 먼저 봐요."), /* @__PURE__ */ React.createElement("li", null, "👤 ", /* @__PURE__ */ React.createElement("b", null, "명의는 올해 카드 사용액이 총급여의 25%를 이미 넘은 사람으로 해요."), " 둘 다 넘었으면 연봉이 높은 사람으로 하고, 한 사람 한도가 차면 나눠서 결제해요."), /* @__PURE__ */ React.createElement("li", null, "💰 현금 결제 시 식대·대관료 할인이나 서비스를 주는 곳도 있고, 부담되면 무이자 할부도 비교해 보세요. 예식장·웨딩 준비 서비스·결혼사진은 현금영수증 의무발행업종이라 10만원 이상 현금이면 요청하지 않아도 발급해야 해요. '현금영수증 없이 하면 할인'은 받지 말아요.")))));
}
const budgetCat = (b) => b.cat || "기타";
const BUDGET_ROW = "grid grid-cols-[minmax(0,1fr)_7.5rem_2.75rem_2rem] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8.5rem_2.75rem_2rem] gap-x-2";
function WeddingBudgetTab({ budget, setBudget, alloc, vendorOn = {}, onVendorTotal, onOpenVendor }) {
  const [draft, setDraft] = useState({});
  const [newCat, setNewCat] = useState("");
  const [open, setOpen] = useState(() => store.get("wedding-budget-open", {}));
  const saveOpen = (o) => {
    setOpen(o);
    store.set("wedding-budget-open", o);
  };
  const setOpenCat = (c, v) => saveOpen({ ...open, [c]: v });
  const patch = (id, k, v) => setBudget(budget.map((b) => b.id === id ? { ...b, [k]: v } : b));
  const order = (keys, defaults) => {
    const rank = (k) => {
      const i = defaults.indexOf(k);
      return i < 0 ? defaults.length : i;
    };
    return keys.sort((a, b) => rank(a) - rank(b));
  };
  const cats = order(Array.from(new Set(budget.map(budgetCat))), Array.from(new Set(WEDDING_BUDGET_DEFAULT.map(budgetCat))));
  const subsOf = (c, list) => order(Array.from(new Set(list.map(budgetSub))), Array.from(new Set(WEDDING_BUDGET_DEFAULT.filter((b) => b.cat === c).map(budgetSub))));
  const sum = (list) => list.reduce((s, b) => s + (Number(b.budget) || 0), 0);
  const total = sum(budget);
  const money = weddingMoney(alloc, budget);
  const addItem = (cat, subs) => {
    const d = draft[cat] || {};
    if (!(d.name || "").trim()) return;
    const sub = (d.sub ?? subs[0] ?? "기타").trim() || "기타";
    setBudget([...budget, { id: uid(), cat, sub, name: d.name.trim(), budget: Number(d.amount) || 0, note: "" }]);
    setDraft({ ...draft, [cat]: { sub, name: "", amount: 0 } });
  };
  const addCat = () => {
    const c = newCat.trim();
    if (!c || cats.includes(c)) return;
    setBudget([...budget, { id: uid(), cat: c, sub: "기타", name: "새 항목", budget: 0, note: "" }]);
    setNewCat("");
    setOpenCat(c, true);
  };
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "2025~26 결혼 준비 후기 기반", title: "예식 비용 예산표" }), /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-0.5" }, "예상 총액"), /* @__PURE__ */ React.createElement("div", { className: "text-[26px] font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(total))), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] text-right" }, /* @__PURE__ */ React.createElement("div", null, "지불 완료 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#1F5D46]", style: { fontVariantNumeric: "tabular-nums" } }, manWon(money.paid)), " · 남은 결제 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums" } }, manWon(money.remaining))), alloc.wedding > 0 && /* @__PURE__ */ React.createElement("div", null, "홈 배정 ", manWon(alloc.wedding), " 대비 ", /* @__PURE__ */ React.createElement("b", { className: money.over ? "text-[#B4533A]" : "text-[#0A0A0A]" }, Math.round(total / alloc.wedding * 100), "%"), money.over && /* @__PURE__ */ React.createElement("b", { className: "text-[#B4533A] ml-1" }, manWon(total - alloc.wedding), " 초과")))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-4" }, cats.map((c) => {
    const v = sum(budget.filter((b) => budgetCat(b) === c));
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: c,
        onClick: () => {
          setOpenCat(c, true);
          setTimeout(() => {
            const el = document.getElementById(`wb-${encodeURIComponent(c)}`);
            el && el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 30);
        },
        className: `text-left rounded-lg px-3 py-2 transition-colors ${open[c] ? "bg-[#0A0A0A] text-white" : "bg-[#FAFAFA] hover:bg-[#F0F0F0]"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: `text-[12px] truncate ${open[c] ? "text-white/70" : "text-[#6B6B6B]"}` }, c),
      /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, manWon(v))
    );
  }))), /* @__PURE__ */ React.createElement("div", { className: "flex justify-end mb-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    const all = cats.every((c) => open[c]);
    saveOpen(Object.fromEntries(cats.map((c) => [c, !all])));
  }, className: "h-8 px-3 rounded-full text-[12px] font-semibold bg-white text-[#525252] shadow-sm" }, cats.every((c) => open[c]) ? "모두 접기" : "모두 펼치기")), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, cats.map((c) => {
    const all = budget.filter((b) => budgetCat(b) === c);
    const subs = subsOf(c, all);
    const d = draft[c] || {};
    return /* @__PURE__ */ React.createElement(Card, { key: c, id: `wb-${encodeURIComponent(c)}`, className: "!p-0 scroll-mt-20 overflow-hidden" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setOpenCat(c, !open[c]), className: "w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: `shrink-0 text-[#6B6B6B] transition-transform ${open[c] ? "rotate-90" : ""}` }), /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold flex-1 min-w-0 truncate" }, c, " ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B] ml-1" }, subs.join(" · "))), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold shrink-0", style: { fontVariantNumeric: "tabular-nums" } }, manWon(sum(all)))), open[c] && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-4 border-t border-[#F0F0F0]" }, subs.map((sb) => {
      const items = all.filter((b) => budgetSub(b) === sb);
      return /* @__PURE__ */ React.createElement("div", { key: sb, className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between bg-[#F7F7F7] rounded-lg px-3 py-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-bold text-[#3D3D3D]" }, sb, " ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, items.length, "개")), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold", style: { fontVariantNumeric: "tabular-nums" } }, manWon(sum(items)))), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#F4F4F4]" }, items.map((b) => /* @__PURE__ */ React.createElement("div", { key: b.id, className: `${BUDGET_ROW} py-1.5 items-center` }, /* @__PURE__ */ React.createElement(TextInput, { ariaLabel: "항목명", value: b.name, onChange: (v) => patch(b.id, "name", v), className: "!h-9 font-semibold" }), /* @__PURE__ */ React.createElement("div", { className: "col-span-4 sm:col-span-1 order-last sm:order-none min-w-0" }, b.linkLabel && /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-semibold text-[#0A0A0A] px-1 truncate", title: b.linkLabel }, "🔗 ", b.linkLabel, b.paidAmt > 0 && !b.paid ? ` · ${manFull(b.paidAmt)} 냄` : ""), /* @__PURE__ */ React.createElement(TextInput, { value: b.note || "", onChange: (v) => patch(b.id, "note", v), placeholder: "메모 (업체·결제일·조건)", className: "!h-7 !text-[12px] !bg-transparent !px-1 text-[#6B6B6B]" })), (() => {
        const vk = b.link && b.link.startsWith("venue-") ? "venue" : b.link, own = !!b.link && VENDOR_BUDGET_KINDS.includes(b.link) && vendorOn[b.link];
        const linkedPaid = !!b.link && vendorOn[vk] && b.paidAmt !== void 0;
        return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(WonInput, { ariaLabel: `${b.name} 금액(원)`, value: b.budget, onChange: (v) => own ? onVendorTotal(b.link, v) : patch(b.id, "budget", v), className: `!h-9 !text-[13px] text-right ${b.paid ? "!bg-[#EAF3EE] text-[#1F5D46]" : ""}` }), linkedPaid ? /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => onOpenVendor(vk),
            title: `업체 화면의 낸 돈 기준 — ${manFull(b.paidAmt || 0)} 냈어요. 누르면 업체 화면으로 가요`,
            className: `h-9 rounded-lg text-[11px] font-bold leading-tight transition-colors ${b.paid ? "bg-[#1F5D46] text-white" : b.paidAmt > 0 ? "bg-[#EAF3EE] text-[#1F5D46]" : "bg-[#F5F5F5] text-[#6B6B6B] hover:text-[#0A0A0A]"}`
          },
          b.paid ? "✓ 다 냄" : b.paidAmt > 0 ? "일부 냄" : "미지불"
        ) : /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => patch(b.id, "paid", !b.paid),
            "aria-pressed": !!b.paid,
            title: b.paid ? "지불했어요 — 누르면 미지불로 바꿔요" : "아직 안 냈어요 — 누르면 지불 완료로 표시해요(부부 현금에서 이미 빠진 돈)",
            className: `h-9 rounded-lg text-[11px] font-bold leading-tight transition-colors ${b.paid ? "bg-[#1F5D46] text-white" : "bg-[#F5F5F5] text-[#6B6B6B] hover:text-[#0A0A0A]"}`
          },
          b.paid ? "✓ 지불" : "미지불"
        ));
      })(), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "항목 삭제", onClick: () => setBudget(budget.filter((x) => x.id !== b.id)), className: "!w-8 !h-9" })))));
    }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-[6rem_minmax(0,1fr)_7.5rem_auto] gap-1.5 mt-4" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        list: `wb-subs-${c}`,
        value: d.sub ?? subs[0] ?? "",
        onChange: (e) => setDraft({ ...draft, [c]: { ...d, sub: e.target.value } }),
        placeholder: "소분류",
        "aria-label": `${c} 소분류`,
        className: "h-9 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold w-full focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
      }
    ), /* @__PURE__ */ React.createElement("datalist", { id: `wb-subs-${c}` }, subs.map((sb) => /* @__PURE__ */ React.createElement("option", { key: sb, value: sb }))), /* @__PURE__ */ React.createElement(
      TextInput,
      {
        value: d.name || "",
        onChange: (v) => setDraft({ ...draft, [c]: { ...d, name: v } }),
        placeholder: "항목 추가",
        className: "min-w-0 !h-9",
        onKeyDown: (e) => {
          if (e.key === "Enter") addItem(c, subs);
        }
      }
    ), /* @__PURE__ */ React.createElement(WonInput, { ariaLabel: "추가할 금액(원)", value: d.amount || 0, onChange: (v) => setDraft({ ...draft, [c]: { ...d, amount: v } }), className: "!h-9 text-right", onKeyDown: (e) => {
      if (e.key === "Enter") addItem(c, subs);
    } }), /* @__PURE__ */ React.createElement("button", { onClick: () => addItem(c, subs), className: "h-9 px-3 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[13px] shrink-0" }, "추가")), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[11px] text-[#6B6B6B]" }, "소분류는 목록에서 고르거나 새 이름을 적으면 그대로 새 묶음이 생겨요.")));
  }), /* @__PURE__ */ React.createElement(Card, { className: "!p-4 border-dashed" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "카테고리 추가"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newCat, onChange: setNewCat, placeholder: "예: 반려동물 링보이", className: "flex-1 min-w-0", onKeyDown: (e) => {
    if (e.key === "Enter") addCat();
  } }), /* @__PURE__ */ React.createElement("button", { onClick: addCat, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "추가")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#6B6B6B]" }, "카테고리 안의 항목을 모두 지우면 카테고리도 사라져요."))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "돈을 낸 항목은 ", /* @__PURE__ */ React.createElement("b", null, "미지불"), " 버튼을 눌러 ", /* @__PURE__ */ React.createElement("b", null, "✓ 지불"), "로 바꿔 두세요. 지불한 금액은 이미 부부 현금에서 빠진 돈으로 보고, 아직 안 낸 금액만 부동산 자기자본에서 미리 빼요. 🔗 표시 항목은 업체 고르기 탭에서 확정한 업체와 신혼여행 ★1순위 가격이 자동으로 들어가요(가격이 범위면 가운데 값, 식대는 하객 리스트 인원 × 1인 식대). 확정한 업체 줄은 업체 화면이 기준이에요 — 여기서 금액을 고치면 그 업체의 계약 금액이 바뀌고, 낸 돈은 업체 화면에서 '냈어요'로 적은 만큼 들어가요(식장 금액은 투어 체크리스트 견적). 기본 금액은 2025~26 후기·업계 조사의 대표값(추정)이에요. 견적을 받거나 결제하면 그 금액으로 고쳐 적어요.")));
}
const REF_KEY = "wedding-refs-v1";
try {
  if (/^#refimport=/.test(location.hash)) {
    sessionStorage.setItem("refimport-pending", decodeURIComponent(location.hash.slice("#refimport=".length)));
    history.replaceState(null, "", location.pathname + location.search);
    [["active-theme-v1", "wedding"], ["wedding-tab-v1", "vendors"], ["wedding-vendor-seg-v1", "refs"]].forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }
} catch {
}
const REF_CATS = [["bdress", "본식 드레스"], ["bhair", "본식 헤메"], ["bsnap", "본식 스냅"], ["jsnap", "제주 스냅"], ["jdress", "제주 스냅 드레스·헤메"], ["bouquet", "부케"], ["ring", "반지"], ["hall", "웨딩홀"], ["invite", "청첩장"], ["info", "준비 정보"], ["etc", "기타"]];
const REF_CAT_LABEL = Object.fromEntries(REF_CATS);
const refImgRef = (id) => cloud.db && cloud.ref().collection("refimgs").doc(id);
const refImgCache = /* @__PURE__ */ new Map();
async function loadRefImg(id) {
  if (refImgCache.has(id)) return refImgCache.get(id);
  const r = refImgRef(id);
  if (!r) return null;
  const d = await r.get();
  const v = d.exists ? d.data().data : null;
  if (v) refImgCache.set(id, v);
  return v;
}
async function saveRefImage(fileOrBlob) {
  if (!cloud.db || !cloud.user) throw new Error("로그인해야 사진을 올릴 수 있어요");
  let full = await shrinkImage(fileOrBlob, 1600, 0.85);
  if (full.length > 88e4) full = await shrinkImage(fileOrBlob, 1280, 0.78);
  const thumb = await shrinkImage(fileOrBlob, 480, 0.78);
  const id = uid(), by = cloud.user.email || "", at = Date.now();
  await Promise.all([refImgRef(id).set({ data: full, at, by }), refImgRef(id + "_t").set({ data: thumb, at, by })]);
  refImgCache.set(id, full);
  refImgCache.set(id + "_t", thumb);
  return id;
}
const deleteRefImage = (id) => {
  [id, id + "_t"].forEach((k) => {
    refImgCache.delete(k);
    const r = refImgRef(k);
    if (r) r.delete().catch(() => {
    });
  });
};
const REF_CAT_KIND = { invite: "invite", hall: "venue", bdress: "dress", bhair: "makeup", bsnap: "bsnap", jsnap: "snap", jdress: "sdress", bouquet: "sbouquet", ring: "ring", info: "refs", etc: "refs" };
const refPickVendor = (r) => ({ id: `ref-${r.handle || r.vendor || "etc"}`, name: r.handle ? `@${r.handle}` : r.vendor || "레퍼런스" });
function useRefThumb(photo) {
  const id = String(photo || "").startsWith("ref:") ? photo.slice(4) : null;
  const [src, setSrc] = useState(() => id ? refImgCache.get(id + "_t") || "" : null);
  useEffect(() => {
    if (!id || src) return;
    let on = true;
    loadRefImg(id + "_t").then((v) => {
      if (on) setSrc(v || "");
    }).catch(() => {
    });
    return () => {
      on = false;
    };
  }, [id]);
  return src;
}
function PickTile({ p, base, ...rest }) {
  const rs = useRefThumb(p.photo);
  return /* @__PURE__ */ React.createElement(MoodTile, { src: rs !== null ? rs : vgImg(base, p.photo), ...rest });
}
function PickThumb({ p, base }) {
  const rs = useRefThumb(p.photo);
  const src = rs !== null ? rs : vgImg(base, p.photo);
  return src ? /* @__PURE__ */ React.createElement("img", { src, alt: "", loading: "lazy", decoding: "async", referrerPolicy: "no-referrer", onError: (e) => {
    e.currentTarget.style.display = "none";
  }, className: "w-11 h-14 rounded-lg object-cover bg-[#F0F0F0]" }) : /* @__PURE__ */ React.createElement("span", { className: "w-11 h-14 rounded-lg bg-[#F0F0F0]" });
}
function RefTile({ r, onOpen, picked, onPick, selected = null, attach = null }) {
  const [src, setSrc] = useState(() => refImgCache.get(r.id + "_t") || null);
  const el = useRef(null);
  useEffect(() => {
    if (src) return;
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) {
        io.disconnect();
        loadRefImg(r.id + "_t").then((v) => setSrc(v || "")).catch(() => setSrc(""));
      }
    }, { rootMargin: "400px 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, [r.id]);
  const who = r.handle ? `@${r.handle}` : r.vendor;
  return /* @__PURE__ */ React.createElement("div", { ref: el, className: "relative" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: onOpen,
      "aria-label": selected == null ? `${who || "레퍼런스"} 사진 크게 보기` : `${who || "레퍼런스"} 사진 ${selected ? "고른 것 풀기" : "고르기"}`,
      "aria-pressed": selected == null ? void 0 : selected,
      className: `relative block w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#F0F0F0] ${selected ? "ring-[3px] ring-[#0A0A0A]" : ""}`
    },
    src ? /* @__PURE__ */ React.createElement("img", { src, alt: "", className: "w-full h-full object-cover" }) : /* @__PURE__ */ React.createElement("span", { className: "absolute inset-0 flex items-center justify-center text-[11px] text-[#9A9A9A]" }, src === "" ? "사진 없음" : "…"),
    r.folder && /* @__PURE__ */ React.createElement("span", { className: "absolute left-1.5 top-1.5 max-w-[70%] truncate px-2 py-0.5 rounded-full bg-white/85 text-[#0A0A0A] text-[10px] font-bold" }, "📁 ", r.folder),
    who && /* @__PURE__ */ React.createElement("span", { className: "absolute right-1.5 bottom-1.5 max-w-[85%] truncate px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-semibold" }, who),
    selected != null && /* @__PURE__ */ React.createElement("span", { className: `absolute right-1.5 top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold ${selected ? "bg-[#0A0A0A] text-white" : "bg-white/85 text-transparent border border-[#BDBDBD]"}` }, "✓")
  ), onPick && /* @__PURE__ */ React.createElement(PickHeart, { on: picked, onClick: onPick, className: "absolute top-0 right-0" }), attach && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: attach.toggle, "aria-pressed": attach.on, className: `absolute left-1.5 bottom-1.5 h-7 px-2.5 rounded-full text-[11px] font-bold shadow ${attach.on ? "bg-[#0A0A0A] text-white" : "bg-white/90 text-[#0A0A0A]"}` }, attach.on ? "✓ 첨부됨" : "+ 대화에 첨부"));
}
function RefGallery({ cats = null, title = "레퍼런스", eyebrow = "상담 때 보여 줄 사진 — 드레스·헤메·포즈·분위기", compact = false, attach = null }) {
  const [refs, setRefs] = usePersist(REF_KEY, []);
  const [folders, setFolders] = usePersist("wedding-ref-folders-v1", []);
  const [cat, setCat] = useState(cats && cats.length === 1 ? cats[0] : "all"), [folder, setFolder] = useState("");
  const allowed = cats || REF_CATS.map(([k]) => k), defCat = cat === "all" ? cats ? cats[0] : "etc" : cat;
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [view, setView] = useState(null);
  const [full, setFull] = useState({});
  const [picks, setPicks] = usePersist(MOOD_KEY, []);
  const pickIdOf = (r) => `${REF_CAT_KIND[r.cat] || "refs"}|${refPickVendor(r).id}|ref:${r.id}`;
  const pickSet = new Set(picks.map((p) => p.id));
  const togglePick = (r) => {
    const id = pickIdOf(r), cur2 = store.get(MOOD_KEY, []), v = refPickVendor(r);
    setPicks(cur2.some((p) => p.id === id) ? cur2.filter((p) => p.id !== id) : [...cur2, { id, kind: REF_CAT_KIND[r.cat] || "refs", vendorId: v.id, vendorName: v.name, photo: `ref:${r.id}`, by: moodWho(), at: Date.now(), u: Date.now() }]);
  };
  const [imp, setImp] = useState(() => {
    try {
      const v = sessionStorage.getItem("refimport-pending");
      if (v) {
        sessionStorage.removeItem("refimport-pending");
        return v;
      }
    } catch {
    }
    return null;
  });
  const inCat = (r) => cat === "all" ? allowed.includes(r.cat) : r.cat === cat;
  const folderNames = Array.from(/* @__PURE__ */ new Set([...refs.filter(inCat).map((r) => r.folder).filter(Boolean), ...folders.filter((f) => cat === "all" ? allowed.includes(f.cat) : f.cat === cat).map((f) => f.name)])).sort((a, b) => a.localeCompare(b, "ko"));
  const shown = refs.filter((r) => inCat(r) && (!folder || r.folder === folder)).sort((a, b) => (b.at || 0) - (a.at || 0));
  useEffect(() => {
    setFolder("");
  }, [cat]);
  useEffect(() => {
    if (view == null) return;
    [view - 1, view, view + 1].map((i) => shown[(i + shown.length) % shown.length]).filter(Boolean).forEach((r) => {
      if (full[r.id] !== void 0) return;
      loadRefImg(r.id).then((v) => setFull((f) => ({ ...f, [r.id]: v || null }))).catch(() => setFull((f) => ({ ...f, [r.id]: null })));
    });
  }, [view, shown.length]);
  const patch = (id, k, v) => setRefs(refs.map((r) => r.id === id ? { ...r, [k]: v, u: Date.now() } : r));
  const [editing, setEditing] = useState(false), [sel, setSel] = useState(() => /* @__PURE__ */ new Set()), [moveTo, setMoveTo] = useState(""), [done, setDone] = useState("");
  useEffect(() => {
    setSel(/* @__PURE__ */ new Set());
  }, [cat, folder, editing]);
  const toggleSel = (id) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const moveRefs = (ids, to) => {
    const now = Date.now(), moved = refs.map((r) => ids.has(r.id) && r.cat !== to ? { ...r, cat: to, u: now } : r);
    setRefs(moved);
    const byPhoto = Object.fromEntries(moved.filter((r) => ids.has(r.id)).map((r) => [`ref:${r.id}`, r]));
    const cur2 = store.get(MOOD_KEY, []);
    if (cur2.some((p) => byPhoto[p.photo])) setPicks(cur2.map((p) => {
      const r = byPhoto[p.photo];
      if (!r) return p;
      const v = refPickVendor(r);
      return { ...p, id: pickIdOf(r), kind: REF_CAT_KIND[r.cat] || "refs", vendorId: v.id, vendorName: v.name, u: now };
    }));
    setDone(`${ids.size}장을 '${REF_CAT_LABEL[to]}'(으)로 옮겼어요`);
  };
  const removeRefs = (ids) => {
    if (!window.confirm(`사진 ${ids.size}장을 레퍼런스에서 지울까요? 되돌릴 수 없어요.`)) return false;
    ids.forEach((id) => deleteRefImage(id));
    setRefs(refs.filter((r) => !ids.has(r.id)));
    const cur2 = store.get(MOOD_KEY, []);
    if (cur2.some((p) => ids.has(String(p.photo || "").slice(4)))) setPicks(cur2.filter((p) => !ids.has(String(p.photo || "").slice(4))));
    setDone(`${ids.size}장을 지웠어요`);
    return true;
  };
  const add = async (files) => {
    setErr("");
    setBusy("올리는 중…");
    const added = [];
    try {
      for (const f of Array.from(files || []).slice(0, 30)) {
        const id = await saveRefImage(f);
        added.push({ id, at: Date.now(), u: Date.now(), cat: defCat, folder, src: "", vendor: "", handle: "", note: "", by: cloud.user && cloud.user.email || "" });
        setBusy(`올리는 중… ${added.length}장`);
      }
    } catch (e) {
      setErr(String(e && e.message || e).slice(0, 120));
    } finally {
      if (added.length) setRefs([...store.get(REF_KEY, []), ...added]);
      setBusy("");
    }
  };
  const runImport = async () => {
    const lines = String(imp || "").split("\n").map((l) => l.trim()).filter(Boolean);
    setErr("");
    const added = [], fails = [];
    for (let i = 0; i < lines.length; i++) {
      setBusy(`가져오는 중… ${i + 1}/${lines.length}`);
      let it;
      try {
        it = lines[i].startsWith("{") ? JSON.parse(lines[i]) : { img: lines[i] };
      } catch {
        fails.push(i + 1);
        continue;
      }
      if (it.code && !it.src) it.src = `https://www.instagram.com/p/${it.code}/`;
      if (it.src && refs.concat(added).some((r) => r.src && r.src === it.src && r.part === (it.part || 0))) continue;
      try {
        const r = await withTimeout(authFetch("/api/ref-fetch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(it.img ? { url: it.img } : { code: it.code }) }), 3e4, "응답이 늦어요");
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.data) throw new Error(j.message || r.status);
        const id = await saveRefImage(dataUrlBlob(j.data));
        added.push({
          id,
          at: Date.now() - i,
          u: Date.now(),
          cat: REF_CAT_LABEL[it.cat] ? it.cat : defCat,
          folder: String(it.folder || "").slice(0, 30),
          src: safeUrl(it.src) || "",
          part: Number(it.part) || 0,
          vendor: String(it.vendor || "").slice(0, 40),
          handle: /^[A-Za-z0-9._]{1,30}$/.test(it.handle || "") ? it.handle : "",
          note: String(it.note || "").slice(0, 300),
          by: cloud.user && cloud.user.email || ""
        });
      } catch (e) {
        fails.push(i + 1);
      }
    }
    if (added.length) setRefs([...store.get(REF_KEY, []), ...added]);
    setBusy("");
    setErr(fails.length ? `${fails.length}줄은 못 가져왔어요(${fails.slice(0, 10).join(", ")}번째) — 사진 주소가 만료됐을 수 있어요.` : "");
    if (!fails.length) setImp(null);
  };
  const newFolder = () => {
    const name = (window.prompt("새 폴더 이름 (예: 포즈, 노을, 머메이드)") || "").trim().slice(0, 30);
    if (!name) return;
    if (!folders.some((f) => f.name === name && f.cat === defCat)) setFolders([...folders, { cat: defCat, name }]);
    setFolder(name);
  };
  const cur = view != null ? shown[view] : null;
  const chip = (on) => `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors shrink-0 ${on ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`;
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, compact ? /* @__PURE__ */ React.createElement("div", { className: "flex items-baseline gap-2 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[17px] font-bold" }, title), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, eyebrow, " · ", refs.filter(inCat).length, "장")) : /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow, title }), allowed.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-1 mb-2" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setCat("all"), className: chip(cat === "all") }, "전체 ", refs.filter((r) => allowed.includes(r.cat)).length), REF_CATS.filter(([k]) => allowed.includes(k)).map(([k, l]) => {
    const n = refs.filter((r) => r.cat === k).length;
    return /* @__PURE__ */ React.createElement("button", { key: k, type: "button", onClick: () => setCat(k), className: chip(cat === k) }, l, n ? ` ${n}` : "");
  })), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 overflow-x-auto pb-1 mb-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFolder(""), className: `h-7 px-2.5 rounded-full text-[11px] font-semibold shrink-0 ${!folder ? "bg-[#525252] text-white" : "bg-[#F0F0F0] text-[#525252]"}` }, "모든 폴더"), folderNames.map((n) => /* @__PURE__ */ React.createElement("button", { key: n, type: "button", onClick: () => setFolder(folder === n ? "" : n), className: `h-7 px-2.5 rounded-full text-[11px] font-semibold shrink-0 ${folder === n ? "bg-[#525252] text-white" : "bg-[#F0F0F0] text-[#525252]"}` }, "📁 ", n, " ", refs.filter((r) => inCat(r) && r.folder === n).length)), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: newFolder, className: "h-7 px-2.5 rounded-full text-[11px] font-semibold shrink-0 border border-dashed border-[#BDBDBD] text-[#525252]" }, "+ 폴더")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-3 flex-wrap" }, /* @__PURE__ */ React.createElement("label", { className: `h-9 px-3.5 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold inline-flex items-center gap-1 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}` }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 }), " 사진 올리기", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: (e) => {
    const f = e.target.files;
    add(f).finally(() => {
      e.target.value = "";
    });
  } })), shown.length > 0 && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
    setEditing(!editing);
    setDone("");
  }, "aria-pressed": editing, className: `h-9 px-3 rounded-lg text-[13px] font-semibold ${editing ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0]"}` }, editing ? "편집 끝" : "옮기기·삭제"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setImp(imp == null ? "" : null), className: "h-9 px-3 rounded-lg bg-[#F0F0F0] text-[13px] font-semibold" }, "인스타 사진 가져오기"), busy && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, busy), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B] ml-auto" }, "올리면 '", REF_CAT_LABEL[defCat], "'", folder ? ` › ${folder}` : "", "로 들어가요")), imp != null && /* @__PURE__ */ React.createElement(Card, { className: "mb-3 !p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-1.5" }, "한 줄에 하나 — 인스타 사진 주소, 또는 ", "{", '"img":"사진 주소","src":"게시물 주소","handle":"계정","cat":"jsnap","folder":"포즈"', "}"), /* @__PURE__ */ React.createElement("textarea", { value: imp, onChange: (e) => setImp(e.target.value), rows: 5, "aria-label": "가져올 사진 목록", className: AREA_CLS }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mt-2" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: runImport, disabled: !!busy || !imp.trim(), className: "h-9 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold disabled:opacity-40" }, "가져오기"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setImp(null), className: "h-9 px-3 rounded-lg bg-[#F0F0F0] text-[13px] font-semibold" }, "닫기"))), err && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[12px] font-semibold text-[#8A5A00]" }, err), shown.length === 0 ? /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, refs.length ? "이 분류·폴더에는 아직 사진이 없어요." : "상담 때 보여 줄 사진을 모아 두는 곳이에요. [사진 올리기]로 캡처·저장한 사진을 올리고, 분류와 폴더로 나눠요.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, editing && /* @__PURE__ */ React.createElement("div", { className: "sticky top-2 z-10 mb-2 rounded-xl bg-[#0A0A0A] text-white p-2.5 flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-bold" }, sel.size ? `${sel.size}장 골랐어요` : "옮기거나 지울 사진을 눌러 고르세요"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setSel(sel.size === shown.length ? /* @__PURE__ */ new Set() : new Set(shown.map((r) => r.id))), className: "h-8 px-2.5 rounded-lg bg-white/15 text-[12px] font-semibold" }, sel.size === shown.length ? "모두 풀기" : "모두 고르기"), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5 ml-auto" }, /* @__PURE__ */ React.createElement("select", { value: moveTo, onChange: (e) => setMoveTo(e.target.value), "aria-label": "옮길 분류", className: "h-8 px-2 rounded-lg bg-white/15 text-white text-[12px] font-semibold" }, /* @__PURE__ */ React.createElement("option", { value: "", className: "text-black" }, "옮길 곳 고르기"), REF_CATS.map(([k, l]) => /* @__PURE__ */ React.createElement("option", { key: k, value: k, className: "text-black" }, l))), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: !sel.size || !moveTo, onClick: () => {
    moveRefs(sel, moveTo);
    setSel(/* @__PURE__ */ new Set());
  }, className: "h-8 px-3 rounded-lg bg-white text-[#0A0A0A] text-[12px] font-bold disabled:opacity-40" }, "옮기기"), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: !sel.size, onClick: () => {
    if (removeRefs(sel)) setSel(/* @__PURE__ */ new Set());
  }, className: "h-8 px-3 rounded-lg bg-[#B4533A] text-white text-[12px] font-bold disabled:opacity-40" }, "삭제"))), done && /* @__PURE__ */ React.createElement("div", { className: "mb-2 text-[12px] font-semibold text-[#1F5D46]" }, done), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5" }, shown.map((r, i) => /* @__PURE__ */ React.createElement(RefTile, { key: r.id, r, onOpen: () => editing ? toggleSel(r.id) : setView(i), picked: pickSet.has(pickIdOf(r)), onPick: editing ? null : () => togglePick(r), selected: editing ? sel.has(r.id) : null, attach: attach && !editing ? { on: attach.ids.has(r.id), toggle: () => attach.toggle(r) } : null })))), cur && /* @__PURE__ */ React.createElement(
    PhotoViewer,
    {
      srcs: shown.map((r) => full[r.id] === void 0 ? refImgCache.get(r.id + "_t") : full[r.id]),
      index: view,
      onIndex: setView,
      onClose: () => setView(null),
      label: "레퍼런스",
      caption: `${REF_CAT_LABEL[cur.cat] || "기타"}${cur.folder ? ` › ${cur.folder}` : ""}`,
      extra: /* @__PURE__ */ React.createElement("div", { className: "w-[min(92vw,420px)] rounded-2xl bg-black/80 text-white p-3 space-y-2" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap text-[13px]" }, /* @__PURE__ */ React.createElement(PickHeart, { on: pickSet.has(pickIdOf(cur)), onClick: () => togglePick(cur) }), /* @__PURE__ */ React.createElement("span", { className: "font-bold truncate" }, cur.handle ? `@${cur.handle}` : cur.vendor || "업체 정보 없음"), cur.handle && /* @__PURE__ */ React.createElement("a", { href: `https://www.instagram.com/${cur.handle}/`, target: "_blank", rel: "noopener noreferrer", className: "text-[12px] underline underline-offset-4" }, "인스타"), safeUrl(cur.src) && /* @__PURE__ */ React.createElement("a", { href: safeUrl(cur.src), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] underline underline-offset-4" }, "원 게시물"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
        if (removeRefs(/* @__PURE__ */ new Set([cur.id]))) setView(null);
      }, className: "ml-auto text-[12px] text-[#FCA5A5] underline underline-offset-4" }, "삭제")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-1.5" }, /* @__PURE__ */ React.createElement("select", { value: cur.cat, onChange: (e) => {
        const to = e.target.value;
        moveRefs(/* @__PURE__ */ new Set([cur.id]), to);
        if (!(cat === "all" ? allowed.includes(to) : to === cat)) setView(null);
      }, "aria-label": "분류(옮길 탭)", className: "h-9 px-2 rounded-lg bg-white/15 text-white text-[12px] font-semibold" }, REF_CATS.map(([k, l]) => /* @__PURE__ */ React.createElement("option", { key: k, value: k, className: "text-black" }, l))), /* @__PURE__ */ React.createElement("select", { value: cur.folder || "", onChange: (e) => {
        if (e.target.value === "__new") {
          const n = (window.prompt("새 폴더 이름") || "").trim().slice(0, 30);
          if (n) patch(cur.id, "folder", n);
        } else patch(cur.id, "folder", e.target.value);
      }, "aria-label": "폴더", className: "h-9 px-2 rounded-lg bg-white/15 text-white text-[12px] font-semibold" }, /* @__PURE__ */ React.createElement("option", { value: "", className: "text-black" }, "폴더 없음"), Array.from(/* @__PURE__ */ new Set([...refs.map((r) => r.folder).filter(Boolean), ...folders.map((f) => f.name)])).sort().map((n) => /* @__PURE__ */ React.createElement("option", { key: n, value: n, className: "text-black" }, "📁 ", n)), /* @__PURE__ */ React.createElement("option", { value: "__new", className: "text-black" }, "+ 새 폴더"))), /* @__PURE__ */ React.createElement("input", { value: cur.vendor || "", onChange: (e) => patch(cur.id, "vendor", e.target.value.slice(0, 40)), placeholder: "업체·작가 이름 (선택)", "aria-label": "업체 이름", className: "w-full h-9 px-2.5 rounded-lg bg-white/15 text-white placeholder-white/50 text-[13px]" }), /* @__PURE__ */ React.createElement("input", { value: cur.note || "", onChange: (e) => patch(cur.id, "note", e.target.value.slice(0, 300)), placeholder: "메모 — 이 사진에서 마음에 드는 점", "aria-label": "메모", className: "w-full h-9 px-2.5 rounded-lg bg-white/15 text-white placeholder-white/50 text-[13px]" }))
    }
  ));
}
const INVITE_KEY = "wedding-invite-v1";
const PAPER_SIZES = [[148, 210, "A5 148×210"], [127, 178, "5×7인치 127×178"], [120, 180, "120×180"], [110, 170, "110×170"], [100, 150, "엽서 100×150"]];
const INVITE_FIELDS = [
  ["groom", "신랑 이름"],
  ["bride", "신부 이름"],
  ["groomOrder", "신랑 서열 (예: 장남)"],
  ["brideOrder", "신부 서열 (예: 차녀)"],
  ["groomFather", "신랑 아버지"],
  ["groomMother", "신랑 어머니"],
  ["brideFather", "신부 아버지"],
  ["brideMother", "신부 어머니"],
  ["date", "예식 날짜", "date"],
  ["time", "예식 시간", "time"],
  ["venue", "예식장"],
  ["hall", "홀 이름"],
  ["address", "예식장 주소"],
  ["groomPhone", "신랑 연락처"],
  ["bridePhone", "신부 연락처"],
  ["greeting", "인사말 (혼주용 — 혼주 명의)", "area"],
  ["friendGreeting", "인사말 (친구용 — 두 사람 명의)", "area"],
  ["transport", "교통·주차 안내", "area"],
  ["groomAccount", "신랑측 계좌 (은행 계좌번호 예금주, 여러 줄)", "area"],
  ["brideAccount", "신부측 계좌", "area"],
  ["groomParentAccount", "신랑 혼주 계좌 (혼주용)", "area"],
  ["brideParentAccount", "신부 혼주 계좌 (혼주용)", "area"]
];
const INVITE_PRINTERS = [
  { name: "네모디", url: "https://nemodi.com/category/%EC%B2%AD%EC%B2%A9%EC%9E%A5/264/", fit: "100×150 엽서 · 200×150 2단", price: "100장 약 1.5만~4만 원 (1단, 장당 150~400원 계산) · 2단 3만~5만 원", extra: "봉투 별도 +7천~9천 원/100장 · 최소 8장 · 정오 전 결제 시 당일 발송", tag: "가장 저렴·빠름", pick: true },
  { name: "모두카피", url: "https://www.moducopy.co.kr/shop/list.php?ca_id=b010", fit: "145×100 · 170×120 · 205×95 · 2단·3단", price: "100장 약 8만~9만 원 (낱장 장당 800~900원 계산) · 2단 장당 1,000원~", extra: "봉투·스티커·식권 무료 포함 · 랑데뷰·몽블랑·반누보 등 · 3~5일 · 도련 포함 템플릿(AI·PSD) 제공", tag: "청첩장 전용·봉투 포함", pick: true },
  { name: "와우프레스 (소량 청첩장)", url: "https://m.wowpress.co.kr/ordr/stk/dets?ProdNo=40572", fit: "110×158 · 200×180 엽서 · 2단·3단 · 비규격", price: "3,800원부터 (최소 10매) · 100장 총액 확인 못 함", extra: "AI·EPS 파일 · 1박 2일 · 금·은·홀로그램 박, 벨벳 코팅 가능", tag: "박·코팅 후가공", pick: true },
  { name: "디티피아", url: "https://dtpia.co.kr/Order/Normal/Invitation.aspx", fit: "크기 직접 입력", price: "견적 (100~500장 선택)", extra: "AI·PDF·EPS·JPG · 고급 용지 30종+ · 금박·은박·형압(추가비) · 3~4일", tag: "고급 용지·형압" },
  { name: "오프린트미", url: "https://www.ohprint.me/blog/self-wedding-invitation-guide", fit: "4×6 카드(약 102×152) · 2단", price: "프리미엄 매트 100매 약 7,600원 (검색 요약) · 200장 봉투 포함 약 4.3만 원 (블로그)", extra: "봉투 별도 · 캔바·파일 업로드 가이드 있음", tag: "소량 저렴" },
  { name: "비즈하우스", url: "https://www.bizhows.com/ko", fit: "6가지 크기 · 1단·2단", price: "100매 약 2만~5만 원 (후기 기준) · 샘플 10장 약 8천 원", extra: "PDF 업로드(후기) · 봉투 별도 · 2~3일", tag: "샘플 주문" }
];
const INVITE_COST_COMPARE = [
  ["업체 완제품 저가형 (보자기·바른손몰)", "16만~17.6만", "문구만 다른 2종 약 19만~21만", "봉투·스티커·식권·교정 포함, 샘플 후기 쿠폰 2~6만"],
  ["업체 완제품 인기 디자인 (잇츠·보자기)", "17만~20만", "문구만 2종 24.6만 · 디자인 2개 29.1만", "디자인을 나누면 주문 2건이라 수량 할인이 따로(약 +6만)"],
  ["직접 디자인 + 저가 인쇄 (네모디·오프린트미)", "5만~13만", "10만~15만", "가장 쌈 · 8장부터 같은 단가라 나눠도 손해 없음 · 오타 재인쇄 위험은 우리 몫"],
  ["직접 디자인 + 청첩장 전용 인쇄 (모두카피)", "16만~24만", "20만~30만", "봉투·스티커·식권 포함이지만 완제품과 비슷하거나 비쌈"],
  ["직접 디자인 + 고급 용지·금박·실링", "27만~47만", "33만~55만", "박은 디자인마다 고정비(약 4만)라 2종이면 두 배"]
];
const INVITE_AUDS = [["parents", "👪 혼주용"], ["friends", "🥂 친구용"]];
const inviteSlot = (format, aud) => format + (aud === "friends" ? "_f" : "");
const inviteRef = (id) => cloud.db && cloud.ref().collection("invites").doc(id);
const inviteHtmlCache = /* @__PURE__ */ new Map();
async function loadInviteHtml(id) {
  if (!id) return "";
  if (inviteHtmlCache.has(id)) return inviteHtmlCache.get(id);
  const r = inviteRef(id);
  if (!r) return "";
  const d = await r.get();
  const v = d.exists ? d.data().html || "" : "";
  inviteHtmlCache.set(id, v);
  return v;
}
const INV_BAD_TAG = /<\s*\/?\s*(script|iframe|object|embed|form|base|meta|frame|frameset|applet|noscript|template|portal|set|animate|animatemotion|animatetransform|foreignobject)\b[^<>]*>?/gi;
const INV_IMG_OK = /^(\{\{photo\d{1,2}\}\}|data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+|\/i\/[A-Za-z0-9]{12,32}\/img\/\d{1,2}(\?v=[a-z0-9]{1,12})?|#[\w-]*)$/i;
const INV_LINK_OK = /^(\{\{\w+\}\}|#[\w-]*|(tel|sms):[\w+\-.{}() ]*|https:\/\/map\.naver\.com\/[^\s"'<>\\]*|https:\/\/fonts\.googleapis\.com\/[^\s"'<>\\]*)$/i;
function invDecode(v) {
  return String(v).replace(/^["']|["']$/g, "").replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) % 1114112)).replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d) % 1114112)).replace(/&(colon|tab|newline|quot|apos|lpar|rpar|amp);?/gi, (_, n) => ({ colon: ":", tab: "", newline: "", quot: "", apos: "", lpar: "(", rpar: ")", amp: "&" })[n.toLowerCase()]).replace(/[\u0000-\u0020\u007f-\u00a0]+/g, (m, i, all) => i === 0 || i + m.length === all.length ? "" : " ");
}
const invUrlOk = (v, img) => {
  const d = invDecode(v);
  return INV_IMG_OK.test(d) || !img && INV_LINK_OK.test(d);
};
function sanitizeInvite(html) {
  let s = String(html || "");
  for (let n = 0; n < 6; n++) {
    const before = s;
    s = s.replace(INV_BAD_TAG, "");
    s = s.replace(/([\s"'\/])on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1");
    s = s.replace(/([\s"'\/])(srcdoc|ping|codebase|dynsrc|lowsrc|attributename)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1");
    s = s.replace(
      /([\s"'\/])(src|srcset|poster|background|data|(?:xlink:)?href|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (m, pre, a, v) => invUrlOk(v, !/href|action/i.test(a)) ? m : `${pre}${a}="#"`
    );
    s = s.replace(/url\(\s*("[^"()]*"|'[^'()]*'|[^()]*)\s*\)|url\(/gi, (m, v) => v === void 0 ? "none(" : invUrlOk(v, true) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\/[^\s"'<>()\\]*$/i.test(invDecode(v)) ? m : "none");
    s = s.replace(/image-set\s*\(|-webkit-image-set\s*\(|expression\s*\(/gi, "(");
    s = s.replace(/@import\s*(?:url\(\s*)?("[^"]*"|'[^']*'|[^\s;)]*)\s*\)?[^;{}]*;?/gi, (m, v) => /^https:\/\/fonts\.googleapis\.com\/[^\s"'<>()\\]*$/i.test(invDecode(v)) ? m : "");
    s = s.replace(/<link\b[^<>]*>?/gi, (m) => /^<link(\s+(rel|href|crossorigin)\s*=\s*("[^"]*"|'[^']*'))+\s*\/?>$/i.test(m) && /\srel\s*=\s*["']stylesheet["']/i.test(m) && /\shref\s*=\s*["']https:\/\/fonts\.googleapis\.com\/[^"'<>\s]*["']/i.test(m) ? m : "");
    if (s === before) break;
  }
  return s;
}
const inviteDateText = (ymd2) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd2 || "");
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${+m[1]}년 ${+m[2]}월 ${+m[3]}일 ${"일월화수목금토"[d.getDay()]}요일`;
};
const inviteTimeText = (hm) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hm || "");
  if (!m) return "";
  const h = +m[1], mi = +m[2];
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}시${mi ? ` ${mi}분` : ""}`;
};
const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
function renderInvite(html, info, photoUrls) {
  const i = info || {}, place = [i.venue, i.address].filter(Boolean).join(" ");
  const vals = { ...i, date: inviteDateText(i.date), time: inviteTimeText(i.time), mapLink: place ? `https://map.naver.com/p/search/${encodeURIComponent(i.address || i.venue)}` : "#" };
  let s = String(html || "").replace(/\{\{photo(\d{1,2})\}\}/g, (_, n) => escHtml(photoUrls[Number(n) - 1] || BLANK_IMG));
  s = s.replace(/\{\{(\w+)\}\}/g, (_, k) => k === "mapLink" ? escHtml(vals.mapLink) : escHtml(vals[k] || "").replace(/\n/g, "<br>"));
  return sanitizeInvite(s);
}
const INVITE_CSP = "default-src 'none'; img-src data: blob: 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; base-uri 'none'; form-action 'none'";
const inviteDoc = (body, extraCss = "") => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${INVITE_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}img{max-width:100%}${extraCss}</style></head><body>${body}</body></html>`;
const randomSlug = (n = 14) => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789", a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => c[x % c.length]).join("");
};
const inviteBlank = () => ({ info: {}, photos: [], paper: { w: 148, h: 210 }, f: { mobile: { cur: null, final: null, versions: [] }, paper: { cur: null, final: null, versions: [] }, mobile_f: { cur: null, final: null, versions: [] }, paper_f: { cur: null, final: null, versions: [] } }, chat: { mobile: [], paper: [], mobile_f: [], paper_f: [] }, pending: {}, share: null, shareF: null });
const invPatch = (fn) => {
  const cur = { ...inviteBlank(), ...store.get(INVITE_KEY, {}) };
  setKey(INVITE_KEY, fn(cur));
};
const invitePolling = /* @__PURE__ */ new Set();
async function pollInviteJob(slot, jobId) {
  const format = slot.replace(/_f$/, "");
  if (invitePolling.has(jobId)) return;
  invitePolling.add(jobId);
  const pend = () => (store.get(INVITE_KEY, {}).pending || {})[slot] || null;
  const mine = () => {
    const p = pend();
    return !!(p && p.jobId === jobId);
  };
  const done = (fn) => invPatch((s) => {
    const p = (s.pending || {})[slot];
    const out = fn ? fn(s) : s;
    return { ...out, pending: { ...s.pending, [slot]: p && p.jobId === jobId ? null : p } };
  });
  const say = (text) => done((s) => ({ ...s, chat: { ...s.chat, [slot]: [...s.chat[slot] || [], { id: uid(), role: "ai", text: `⚠️ ${text}`, at: Date.now(), err: true }].slice(-60) } }));
  const started = Date.now();
  let misses = 0;
  try {
    while (Date.now() - started < 9 * 6e4) {
      await new Promise((r3) => setTimeout(r3, 3500));
      if (!mine()) return;
      const r = await authFetch(`/api/invite-job?id=${encodeURIComponent(jobId)}`).catch(() => null);
      const j = r && r.ok ? await r.json().catch(() => null) : null;
      if (!j || !j.state) {
        if (r && r.status === 404 && ++misses >= 10) {
          say("작업을 찾을 수 없어요 — 같은 요청을 다시 보내 주세요.");
          return;
        }
        continue;
      }
      misses = 0;
      if (j.state === "queued" && Date.now() - (pend() || {}).at > 15e4) {
        say("서버가 작업을 시작하지 않았어요 — 같은 요청을 다시 보내 주세요.");
        return;
      }
      if (j.state === "queued" || j.state === "running") continue;
      if (j.state === "done" && j.html) {
        const id = jobId, at = Date.now(), note = String(j.note || "시안을 만들었어요.").slice(0, 600);
        try {
          await inviteRef(id).set({ html: j.html, format, note, at, by: cloud.user && cloud.user.email || "" });
        } catch (e) {
          say(`시안을 저장하지 못했어요 — ${String(e && e.message || e).slice(0, 80)}`);
          return;
        }
        inviteHtmlCache.set(id, j.html);
        done((s) => {
          const f = s.f[slot] || { versions: [] }, has = (f.versions || []).some((v) => v.id === id);
          const size = format === "paper" ? s.paper || { w: 148, h: 210 } : void 0;
          return {
            ...s,
            f: { ...s.f, [slot]: { ...f, cur: id, versions: has ? f.versions : [...f.versions || [], { id, at, note, size }].slice(-40) } },
            chat: { ...s.chat, [slot]: has ? s.chat[slot] || [] : [...s.chat[slot] || [], { id: uid(), role: "ai", text: note, ver: id, at }].slice(-60) }
          };
        });
      } else say(j.error || "시안을 만들지 못했어요 — 다시 시도해 주세요.");
      return;
    }
    if (mine()) say("시간이 너무 오래 걸려 기다리기를 멈췄어요 — 다시 요청해 주세요.");
  } finally {
    invitePolling.delete(jobId);
  }
}
function MmInput({ value, label, onCommit }) {
  const [t, setT] = useState(String(value));
  useEffect(() => {
    setT(String(value));
  }, [value]);
  const commit = () => {
    const n = Math.round(Number(t));
    const v = Number.isFinite(n) && n ? Math.max(60, Math.min(300, n)) : value;
    setT(String(v));
    if (v !== value) onCommit(v);
  };
  return /* @__PURE__ */ React.createElement("input", { type: "number", inputMode: "numeric", value: t, min: 60, max: 300, onChange: (e) => setT(e.target.value), onBlur: commit, onKeyDown: (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  }, "aria-label": label, className: "w-16 h-9 px-2 rounded-lg bg-white shadow-sm text-[13px]" });
}
function InviteStudio({ info: wInfo, confirmed }) {
  const [inv, setInv] = usePersist(INVITE_KEY, inviteBlank());
  const st = { ...inviteBlank(), ...inv, f: { ...inviteBlank().f, ...inv.f || {} }, chat: { ...inviteBlank().chat, ...inv.chat || {} }, pending: inv.pending || {} };
  const [format, setFormat] = useState("mobile");
  const [aud, setAud] = useState(() => {
    try {
      return localStorage.getItem("invite-aud") === "friends" ? "friends" : "parents";
    } catch {
      return "parents";
    }
  });
  const pickAud = (a) => {
    setAud(a);
    try {
      localStorage.setItem("invite-aud", a);
    } catch {
    }
  };
  const slot = inviteSlot(format, aud), mSlot = inviteSlot("mobile", aud), shareKey = aud === "friends" ? "shareF" : "share", share = st[shareKey];
  const fs = st.f[slot] || { versions: [] }, chat = st.chat[slot] || [], pending = st.pending[slot];
  const info = { date: wInfo && wInfo.date, venue: confirmed && confirmed.venue && confirmed.venue.name || wInfo && wInfo.venue, ...st.info };
  const [html, setHtml] = useState("");
  const [photoUrls, setPhotoUrls] = useState([]);
  const [text, setText] = useState(""), [attach, setAttach] = useState([]), [err, setErr] = useState(""), [busy, setBusy] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [refsOpen, setRefsOpenRaw] = useState(() => {
    try {
      return localStorage.getItem("invite-refs-open") !== "0";
    } catch {
      return true;
    }
  });
  const setRefsOpen = (v) => {
    setRefsOpenRaw(v);
    try {
      localStorage.setItem("invite-refs-open", v ? "1" : "0");
    } catch {
    }
  };
  const boxRef = useRef(null), chatEnd = useRef(null);
  const [boxW, setBoxW] = useState(360);
  const size = st.paper || { w: 148, h: 210 };
  useEffect(() => {
    let on = true;
    setHtml("");
    loadInviteHtml(fs.cur).then((v) => {
      if (on) setHtml(v || "");
    }).catch(() => {
    });
    return () => {
      on = false;
    };
  }, [fs.cur, slot]);
  useEffect(() => {
    let on = true;
    Promise.all((st.photos || []).map((id) => loadRefImg(id).catch(() => null))).then((v) => {
      if (on) setPhotoUrls(v.map((x) => x || BLANK_IMG));
    });
    return () => {
      on = false;
    };
  }, [(st.photos || []).join(",")]);
  useEffect(() => {
    if (pending && pending.jobId) pollInviteJob(slot, pending.jobId);
  }, [slot, pending && pending.jobId]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    chatEnd.current && chatEnd.current.scrollIntoView({ block: "nearest" });
  }, [chat.length, !!pending]);
  const setInfo = (k, v) => setInv((s) => ({ ...inviteBlank(), ...s, info: { ...s.info || {}, [k]: v } }));
  const filled = INVITE_FIELDS.map(([k]) => k).filter((k) => String(info[k] || "").trim()).concat(info.address || info.venue ? ["mapLink"] : []);
  const vSize = format === "paper" && ((fs.versions || []).find((v) => v.id === fs.cur) || {}).size || size;
  const pageW = vSize.w * 3.7795, pageH = vSize.h * 3.7795;
  const zoom = Math.min(1, (boxW - 24) / pageW);
  const rendered = html ? renderInvite(html, info, photoUrls) : "";
  const previewDoc = !html ? "" : format === "paper" ? inviteDoc(rendered, `body{background:#E9E9E9;padding:12px 0;zoom:${zoom.toFixed(3)}} .page{margin:0 auto 12px;box-shadow:0 2px 12px rgba(0,0,0,.18);background:#fff}`) : inviteDoc(rendered, "body{background:#fff}");
  const send = async () => {
    const t = text.trim();
    if (!t || pending || busy) return;
    if (!cloud.db || !cloud.user) {
      setErr("로그인해야 시안을 만들 수 있어요");
      return;
    }
    setErr("");
    setBusy("보내는 중…");
    const userMsg = { id: uid(), role: "user", text: t.slice(0, 2e3), attach, at: Date.now() };
    try {
      const refs = (await Promise.all(attach.slice(0, 4).map((id) => loadRefImg(id + "_t").catch(() => null)))).filter((u) => /^data:image\/(jpeg|png|webp);base64,/.test(u || ""));
      const hist = [...chat.filter((m) => !m.err), userMsg].slice(-12).map((m) => ({ role: m.role === "ai" ? "assistant" : "user", text: m.text }));
      const r = await withTimeout(authFetch("/api/invite-design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, audience: aud, size, html: html || "", messages: hist, refs, photoCount: (st.photos || []).length, filled })
      }), 3e4, "요청이 늦어요 — 다시 보내 주세요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.jobId) throw new Error(j.message || `요청 실패(${r.status})`);
      invPatch((b) => ({ ...b, chat: { ...b.chat, [slot]: [...(b.chat || {})[slot] || [], userMsg].slice(-60) }, pending: { ...b.pending || {}, [slot]: { jobId: j.jobId, at: Date.now() } } }));
      setText("");
      setAttach([]);
      pollInviteJob(slot, j.jobId);
    } catch (e) {
      setErr(String(e && e.message || e).slice(0, 160));
    } finally {
      setBusy("");
    }
  };
  const pickVersion = (id) => setInv((s) => {
    const b = { ...inviteBlank(), ...s };
    return { ...b, f: { ...inviteBlank().f, ...b.f, [slot]: { ...inviteBlank().f[slot], ...b.f[slot], cur: id } } };
  });
  const finalize = () => setInv((s) => {
    const b = { ...inviteBlank(), ...s };
    const cur = { ...inviteBlank().f[slot], ...b.f[slot] };
    return { ...b, f: { ...inviteBlank().f, ...b.f, [slot]: { ...cur, final: cur.cur } } };
  });
  const addPhotos = async (files) => {
    setErr("");
    setBusy("사진 올리는 중…");
    try {
      for (const f of Array.from(files || []).slice(0, 12)) {
        const id = await saveRefImage(f);
        setInv((s) => ({ ...inviteBlank(), ...s, photos: [...s && s.photos || [], id].slice(0, 12) }));
      }
    } catch (e) {
      setErr(String(e && e.message || e).slice(0, 120));
    } finally {
      setBusy("");
    }
  };
  const removePhoto = (id) => {
    if (!window.confirm("이 사진을 뺄까요? 시안의 사진 번호가 하나씩 당겨져요.")) return;
    deleteRefImage(id);
    setInv((s) => ({ ...inviteBlank(), ...s, photos: (s.photos || []).filter((x) => x !== id) }));
  };
  const openWindow = (print) => {
    if (!html) return;
    const css = format === "paper" ? `@page{size:${vSize.w}mm ${vSize.h}mm;margin:0}body{background:#fff}.page{margin:0 auto}` : "body{background:#fff}";
    const doc = inviteDoc(rendered, css);
    if (print) {
      const f = document.createElement("iframe");
      f.setAttribute("sandbox", "allow-same-origin allow-modals");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      f.onload = () => setTimeout(() => {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch (e) {
          setErr("인쇄 창을 열지 못했어요 — [새 창에서 보기]로 열어 인쇄해 주세요");
        }
        setTimeout(() => f.remove(), 6e4);
      }, 700);
      f.srcdoc = doc;
      document.body.appendChild(f);
      return;
    }
    const wrap = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>청첩장 시안</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="${escHtml(doc)}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([wrap], { type: "text/html" }));
    const w = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
    if (!w) setErr("팝업이 막혔어요 — 이 사이트의 팝업을 허용해 주세요");
    else w.opener = null;
  };
  const pubImgs = (slug) => Array.from({ length: 12 }, (_, i) => cloud.db.collection("publicInviteImgs").doc(`${slug}_${i + 1}`));
  const publish = async () => {
    const src = await loadInviteHtml((st.f[mSlot] || {}).final || (st.f[mSlot] || {}).cur);
    if (!src) {
      setErr("먼저 모바일 시안을 만들어 주세요");
      return;
    }
    if (!cloud.db || !cloud.user) {
      setErr("로그인해야 링크를 만들 수 있어요");
      return;
    }
    setErr("");
    setBusy("링크 만드는 중…");
    try {
      const slug = share && share.slug || randomSlug(), at = Date.now(), by = cloud.user.email || "";
      if (!share || !share.slug) invPatch((s) => ({ ...s, [shareKey]: { slug, at: 0, ver: null } }));
      const usedNums = new Set([...String(src).matchAll(/\{\{photo(\d{1,2})\}\}/g)].map((m) => Number(m[1])));
      const urls = (st.photos || []).map((_, i) => `/i/${slug}/img/${i + 1}?v=${at.toString(36)}`);
      const out = renderInvite(src, info, urls);
      const used = (st.photos || []).map((id, i) => [id, i + 1]).filter(([, n]) => usedNums.has(n));
      for (const [id, n] of used) {
        let data = await loadRefImg(id);
        for (let k = 0; data && data.length > 88e4 && k < 4; k++) data = await shrinkImage(dataUrlBlob(data), [1280, 1080, 900, 720][k], [0.72, 0.68, 0.64, 0.6][k]);
        if (!data || data.length > 88e4) throw new Error(`${n}번 사진이 너무 커요`);
        await pubImgs(slug)[n - 1].set({ data, at, by });
      }
      await Promise.all(pubImgs(slug).filter((_, i) => !used.some(([, n]) => n === i + 1)).map((r) => r.delete().catch(() => {
      })));
      const title = info.groom && info.bride ? `${info.groom} ♥ ${info.bride} 결혼합니다` : "결혼합니다";
      const desc = [inviteDateText(info.date), inviteTimeText(info.time), info.venue].filter(Boolean).join(" · ");
      await cloud.db.collection("publicInvites").doc(slug).set({ html: out, title, desc, ogImg: used.length ? used[0][1] : null, at, by });
      invPatch((s) => ({ ...s, [shareKey]: { slug, at, ver: (st.f[mSlot] || {}).final || (st.f[mSlot] || {}).cur } }));
    } catch (e) {
      setErr(`링크를 만들지 못했어요 — ${String(e && e.message || e).slice(0, 100)}`);
    } finally {
      setBusy("");
    }
  };
  const unpublish = async () => {
    const slug = share && share.slug;
    if (!slug || !window.confirm("공개 링크를 지울까요? 이미 보낸 링크는 1분쯤 뒤부터 열리지 않아요.")) return;
    try {
      await cloud.db.collection("publicInvites").doc(slug).delete();
      await Promise.all(pubImgs(slug).map((r) => r.delete().catch(() => {
      })));
      setInv((s) => ({ ...inviteBlank(), ...s, [shareKey]: null }));
    } catch (e) {
      setErr(String(e && e.message || e).slice(0, 120));
    }
  };
  const shareUrl = share && share.at ? `${location.origin}/i/${share.slug}` : "";
  const toggleAttach = (r) => setAttach((a) => a.includes(r.id) ? a.filter((x) => x !== r.id) : [...a, r.id].slice(-4));
  const vers = [...fs.versions || []].reverse();
  const chip = (on) => `h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${on ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`;
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "레퍼런스를 첨부하고 AI와 대화하며 시안을 잡아요", title: "청첩장 시안 만들기" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap mb-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFormat("mobile"), className: chip(format === "mobile") }, "📱 모바일 청첩장"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setFormat("paper"), className: chip(format === "paper") }, "📄 종이 청첩장"), /* @__PURE__ */ React.createElement("span", { className: "w-px h-6 bg-[#E5E5E5] mx-1", "aria-hidden": "true" }), INVITE_AUDS.map(([k, l]) => /* @__PURE__ */ React.createElement("button", { key: k, type: "button", onClick: () => pickAud(k), className: chip(aud === k) }, l)), format === "paper" && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap ml-1" }, /* @__PURE__ */ React.createElement("select", { value: `${size.w}x${size.h}`, onChange: (e) => {
    const [w, h] = e.target.value.split("x").map(Number);
    if (w) setInv((s) => ({ ...inviteBlank(), ...s, paper: { w, h } }));
  }, "aria-label": "종이 크기", className: "h-9 px-2 rounded-lg bg-white shadow-sm text-[13px] font-semibold" }, PAPER_SIZES.map(([w, h, l]) => /* @__PURE__ */ React.createElement("option", { key: l, value: `${w}x${h}` }, l, "mm")), !PAPER_SIZES.some(([w, h]) => w === size.w && h === size.h) && /* @__PURE__ */ React.createElement("option", { value: `${size.w}x${size.h}` }, "직접 ", size.w, "×", size.h, "mm")), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "직접"), /* @__PURE__ */ React.createElement(MmInput, { value: size.w, label: "가로(mm)", onCommit: (v) => setInv((s) => ({ ...inviteBlank(), ...s, paper: { ...s.paper || size, w: v } })) }), /* @__PURE__ */ React.createElement("span", { className: "text-[12px]" }, "×"), /* @__PURE__ */ React.createElement(MmInput, { value: size.h, label: "세로(mm)", onCommit: (v) => setInv((s) => ({ ...inviteBlank(), ...s, paper: { ...s.paper || size, h: v } })) }), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "mm · 크기를 바꾸면 다음 요청 때 그 크기로 다시 잡아요"))), /* @__PURE__ */ React.createElement(Card, { className: "mb-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setRefsOpen(!refsOpen), "aria-expanded": refsOpen, className: `w-full flex items-center gap-2 text-left ${refsOpen ? "mb-3" : ""}` }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold" }, "청첩장 레퍼런스"), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, refsOpen ? "접기" : `펼쳐서 사진 고르기${attach.length ? ` · 대화에 ${attach.length}장 첨부 중` : ""}`), /* @__PURE__ */ React.createElement("span", { className: "ml-auto text-[#6B6B6B]", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: `transition-transform ${refsOpen ? "-rotate-90" : "rotate-90"}` }))), refsOpen && /* @__PURE__ */ React.createElement(RefGallery, { cats: ["invite"], compact: true, title: "청첩장 레퍼런스", eyebrow: "마음에 드는 시안 사진을 모으고 [+ 대화에 첨부]", attach: { ids: new Set(attach), toggle: toggleAttach } })), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-[minmax(0,1fr)_400px] gap-3 items-start" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "미리보기"), fs.cur && /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, "v", (fs.versions || []).findIndex((v) => v.id === fs.cur) + 1, fs.final === fs.cur ? " · ✓ 최종" : ""), /* @__PURE__ */ React.createElement("div", { className: "ml-auto flex items-center gap-1.5 flex-wrap" }, fs.cur && fs.final !== fs.cur && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: finalize, className: "h-8 px-3 rounded-lg bg-[#1F5D46] text-white text-[12px] font-bold" }, "이 시안으로 최종 확정"), html && format === "paper" && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => openWindow(true), className: "h-8 px-3 rounded-lg bg-[#F0F0F0] text-[12px] font-semibold" }, "인쇄·PDF 저장"), html && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => openWindow(false), className: "h-8 px-3 rounded-lg bg-[#F0F0F0] text-[12px] font-semibold" }, "새 창에서 보기"))), /* @__PURE__ */ React.createElement("div", { ref: boxRef, className: `rounded-xl overflow-hidden bg-[#F5F5F5] ${format === "mobile" ? "flex justify-center py-3" : ""}` }, !html ? /* @__PURE__ */ React.createElement("div", { className: "h-[420px] flex flex-col items-center justify-center text-center px-6 text-[13px] text-[#6B6B6B] gap-2" }, pending ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "text-[22px] animate-pulse" }, "✎"), "AI가 시안을 그리는 중이에요 — 1~3분 걸려요. 다른 화면에 갔다 와도 이어서 받아요.") : /* @__PURE__ */ React.createElement(React.Fragment, null, "레퍼런스를 첨부하고 오른쪽 대화창에 원하는 느낌을 적어 보세요.", /* @__PURE__ */ React.createElement("br", null), '예: "첨부한 사진처럼 여백 많은 미니멀, 흰 바탕에 세리프 글씨, 첫 화면에 우리 사진 크게"')) : format === "mobile" ? /* @__PURE__ */ React.createElement("iframe", { title: "모바일 청첩장 미리보기", sandbox: "allow-popups allow-popups-to-escape-sandbox", srcDoc: previewDoc, className: "w-[390px] max-w-full h-[720px] bg-white rounded-[24px] border-[6px] border-[#1A1A1A] shadow-lg" }) : /* @__PURE__ */ React.createElement("iframe", { title: "종이 청첩장 미리보기", sandbox: "", srcDoc: previewDoc, className: "w-full bg-[#E9E9E9]", style: { height: Math.min(1400, Math.round((pageH * 2 + 48) * zoom)) } })), vers.length > 0 && /* @__PURE__ */ React.createElement("details", { className: "mt-2" }, /* @__PURE__ */ React.createElement("summary", { className: "cursor-pointer text-[13px] font-semibold text-[#525252]" }, "버전 ", vers.length, "개 — 눌러서 되돌리기"), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 space-y-1 max-h-56 overflow-auto" }, vers.map((v, i) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: v.id,
      type: "button",
      onClick: () => pickVersion(v.id),
      className: `w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] ${v.id === fs.cur ? "bg-[#0A0A0A] text-white" : "bg-[#FAFAFA] hover:bg-[#F0F0F0]"}`
    },
    /* @__PURE__ */ React.createElement("b", null, "v", vers.length - i),
    v.id === fs.final ? " ✓ 최종" : "",
    " · ",
    new Date(v.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    " · ",
    /* @__PURE__ */ React.createElement("span", { className: "opacity-80" }, String(v.note || "").slice(0, 60))
  )))), format === "paper" && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, "인쇄만 맡길 곳 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "· 확정본을 [인쇄·PDF 저장]으로 PDF로 받아 업체에 올려요")), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[12px] text-[#6B6B6B] leading-relaxed" }, "주문 전에: ① 업체 규격에 맞춰 위에서 크기를 고르고 시안을 다시 받기(예: 네모디 100×150) ② 업체가 '도련(재단 여유) 사방 3mm'를 요구하면 배경을 그만큼 넓힌 파일이 필요하니 주문 화면에서 확인 ③ 글자·사진은 가장자리에서 5mm 안쪽 ④ 화면 색과 인쇄 색은 조금 달라요 — 샘플(소량)을 먼저 받아 보면 안전해요. 가격은 2026년 10월 조사, 주문 화면에서 다시 확인하세요."), /* @__PURE__ */ React.createElement("div", { className: "mt-2 rounded-lg bg-white shadow-sm p-2.5 overflow-x-auto" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold" }, "업체에 다 맡기기 vs 직접 디자인 + 인쇄만 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "· 봉투·스티커 포함, 2026년 10월 조사")), /* @__PURE__ */ React.createElement("table", { className: "mt-1.5 w-full text-[11px] min-w-[520px]" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", { className: "text-left text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("th", { className: "font-semibold py-1 pr-2" }, "방식"), /* @__PURE__ */ React.createElement("th", { className: "font-semibold py-1 pr-2" }, "200장 1종"), /* @__PURE__ */ React.createElement("th", { className: "font-semibold py-1 pr-2" }, "혼주 150 + 친구 100"), /* @__PURE__ */ React.createElement("th", { className: "font-semibold py-1" }, "메모"))), /* @__PURE__ */ React.createElement("tbody", null, INVITE_COST_COMPARE.map(([a, b, c, d], i) => /* @__PURE__ */ React.createElement("tr", { key: a, className: `border-t border-[#F0F0F0] ${i === 2 ? "font-semibold" : ""}` }, /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-2" }, a), /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-2 whitespace-nowrap" }, b), /* @__PURE__ */ React.createElement("td", { className: "py-1 pr-2" }, c), /* @__PURE__ */ React.createElement("td", { className: "py-1 text-[#6B6B6B]" }, d))))), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[11px] text-[#6B6B6B]" }, "업체에 맡길 땐 디자인 하나에 혼주용·친구용 문구만 바꿔 한 번에 주문하면 판 추가비(보자기 1.5만, 바른손은 내지 1종·봉투 2종까지 무료)만 붙어요. 직접 디자인은 샘플 10장(3천~8천 원)을 먼저 뽑아 오타·색을 확인해요.")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 grid sm:grid-cols-2 gap-2" }, INVITE_PRINTERS.map((v) => /* @__PURE__ */ React.createElement("a", { key: v.name, href: v.url, target: "_blank", rel: "noopener noreferrer", className: "block rounded-lg bg-white shadow-sm p-2.5 hover:bg-[#FCFCFC]" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-bold" }, v.name), v.pick && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0A0A0A] text-white" }, "추천"), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B] ml-auto" }, v.tag)), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[12px] font-semibold" }, v.price), /* @__PURE__ */ React.createElement("div", { className: "mt-0.5 text-[11px] text-[#6B6B6B]" }, v.fit), /* @__PURE__ */ React.createElement("div", { className: "mt-0.5 text-[11px] text-[#6B6B6B]" }, v.extra))))), format === "mobile" && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-1" }, "하객에게 보낼 링크"), share && share.at ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 flex-wrap" }, /* @__PURE__ */ React.createElement("a", { href: shareUrl, target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4 break-all" }, shareUrl), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => navigator.clipboard && navigator.clipboard.writeText(shareUrl), className: "h-8 px-3 rounded-lg bg-[#0A0A0A] text-white text-[12px] font-bold" }, "복사")), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[12px] text-[#6B6B6B]" }, share.ver !== ((st.f[mSlot] || {}).final || (st.f[mSlot] || {}).cur) ? "링크에는 예전 시안이 올라가 있어요 — [링크 갱신]을 눌러 지금 확정본으로 바꿔요. " : "", "정보나 사진을 고친 뒤에도 [링크 갱신]을 눌러야 링크에 반영돼요."), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex gap-1.5" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: publish, disabled: !!busy, className: "h-8 px-3 rounded-lg bg-[#F0F0F0] text-[12px] font-semibold" }, "링크 갱신"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: unpublish, className: "h-8 px-2 text-[12px] font-semibold text-[#B4533A] underline underline-offset-4" }, "링크 지우기"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-2" }, "최종 확정본(없으면 지금 시안)을 로그인 없이 열리는 링크로 만들어요. 링크를 아는 사람은 이름·일시·장소·계좌를 볼 수 있어요."), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: publish, disabled: !html || !!busy, className: "h-9 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold disabled:opacity-40" }, "링크 만들기")))), /* @__PURE__ */ React.createElement(Card, { className: "!p-3 flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold mb-2" }, "AI와 시안 잡기 ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-normal text-[#6B6B6B]" }, "· ", aud === "friends" ? "친구용" : "혼주용", " ", format === "mobile" ? "모바일" : `종이 ${size.w}×${size.h}mm`)), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-h-[240px] max-h-[520px] overflow-auto space-y-2 pr-1" }, chat.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] leading-relaxed" }, '원하는 분위기·구성·글씨체를 말해 주세요. 레퍼런스를 첨부하면 그 느낌을 참고해요. 시안이 나오면 "이름을 더 크게", "인사말 위치를 사진 아래로", "베이지 톤으로"처럼 고쳐 달라고 하면 돼요.'), chat.map((m) => /* @__PURE__ */ React.createElement("div", { key: m.id, className: `flex ${m.role === "user" ? "justify-end" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: `max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line ${m.role === "user" ? "bg-[#0A0A0A] text-white" : m.err ? "bg-[#FFF4D6] text-[#8A5A00]" : "bg-[#F3F3F3]"}` }, m.text, (m.attach || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[11px] opacity-75" }, "레퍼런스 ", m.attach.length, "장 첨부"), m.ver && /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => pickVersion(m.ver), className: "block mt-1 text-[11px] font-semibold underline underline-offset-2" }, "이 시안 보기")))), pending && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-[12px] text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement("span", { className: "animate-pulse" }, "✎ 시안 그리는 중… (1~3분)"), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setInv((s) => ({ ...inviteBlank(), ...s, pending: { ...s && s.pending || {}, [slot]: null } })), className: "underline underline-offset-2" }, "기다리기 멈추기")), /* @__PURE__ */ React.createElement("div", { ref: chatEnd })), attach.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex items-center gap-1.5 flex-wrap" }, attach.map((id) => /* @__PURE__ */ React.createElement(AttachChip, { key: id, id, onRemove: () => setAttach((a) => a.filter((x) => x !== id)) })), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B]" }, "최대 4장")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex items-end gap-1.5" }, /* @__PURE__ */ React.createElement(
    AutoArea,
    {
      value: text,
      onChange: (e) => setText(e.target.value),
      minRows: 2,
      placeholder: fs.cur ? "고칠 점을 적어요 (예: 첫 화면 사진을 더 크게, 글씨는 명조로)" : "원하는 느낌을 적어요",
      "aria-label": "AI에게 요청",
      className: `${AREA_CLS} !text-[14px]`,
      onKeyDown: (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
      }
    }
  ), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: send, disabled: !text.trim() || !!pending || !!busy, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-bold shrink-0 disabled:opacity-40" }, "보내기")), (err || busy) && /* @__PURE__ */ React.createElement("div", { className: `mt-1.5 text-[12px] font-semibold ${err ? "text-[#8A5A00]" : "text-[#6B6B6B]"}` }, err || busy))), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-3 mt-3 items-start" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-3" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setShowInfo((o) => !o), className: "w-full flex items-center justify-between text-left" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold" }, "청첩장에 들어갈 정보 ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-normal text-[#6B6B6B]" }, "· ", filled.filter((k) => k !== "mapLink").length, "/", INVITE_FIELDS.length, " 채움 · 고치면 미리보기에 바로")), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: `text-[#6B6B6B] transition-transform ${showInfo ? "rotate-90" : ""}` })), showInfo && /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mt-3" }, INVITE_FIELDS.map(([k, l, t]) => /* @__PURE__ */ React.createElement("div", { key: k, className: t === "area" ? "col-span-2" : "" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-0.5" }, l), t === "area" ? /* @__PURE__ */ React.createElement(AutoArea, { value: info[k] || "", onChange: (e) => setInfo(k, e.target.value), minRows: 2, "aria-label": l, className: AREA_CLS }) : t ? /* @__PURE__ */ React.createElement("input", { type: t, value: info[k] || "", onChange: (e) => setInfo(k, e.target.value), "aria-label": l, className: DATE_CLS }) : /* @__PURE__ */ React.createElement(TextInput, { value: info[k] || "", onChange: (v) => setInfo(k, v), ariaLabel: l }))), /* @__PURE__ */ React.createElement("div", { className: "col-span-2 text-[11px] text-[#6B6B6B]" }, "예식일·예식장은 개요와 확정한 식장에서 가져왔어요. 여기서 고치면 청첩장에만 적용돼요. 빈 칸은 다음 AI 요청 때 그 부분을 빼고 그려요."))), /* @__PURE__ */ React.createElement(Card, { className: "!p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "우리 사진 ", /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-normal text-[#6B6B6B]" }, "· 시안의 사진 1, 2… 자리에 순서대로")), /* @__PURE__ */ React.createElement("label", { className: `h-8 px-3 rounded-lg bg-[#0A0A0A] text-white text-[12px] font-bold inline-flex items-center gap-1 cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}` }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " 사진 넣기", /* @__PURE__ */ React.createElement("input", { type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: (e) => {
    const f = e.target.files;
    addPhotos(f).finally(() => {
      e.target.value = "";
    });
  } }))), (st.photos || []).length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "아직 없어요. 웨딩 사진을 넣으면 시안의 사진 자리에 바로 들어가요. 사진은 AI에게 보내지 않아요.") : /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-4 sm:grid-cols-6 gap-1.5" }, st.photos.map((id, i) => /* @__PURE__ */ React.createElement("div", { key: id, className: "relative" }, /* @__PURE__ */ React.createElement("div", { className: "aspect-square rounded-lg overflow-hidden bg-[#F0F0F0]" }, photoUrls[i] && photoUrls[i] !== BLANK_IMG && /* @__PURE__ */ React.createElement("img", { src: photoUrls[i], alt: "", className: "w-full h-full object-cover" })), /* @__PURE__ */ React.createElement("span", { className: "absolute left-1 top-1 px-1.5 rounded bg-black/60 text-white text-[10px] font-bold" }, "사진 ", i + 1), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => removePhoto(id), "aria-label": `사진 ${i + 1} 빼기`, className: "absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-none" }, "×")))))));
}
function AttachChip({ id, onRemove }) {
  const src = useRefThumb(`ref:${id}`);
  return /* @__PURE__ */ React.createElement("span", { className: "relative inline-block w-10 h-12 rounded-md overflow-hidden bg-[#F0F0F0]" }, src && /* @__PURE__ */ React.createElement("img", { src, alt: "", className: "w-full h-full object-cover" }), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: onRemove, "aria-label": "첨부 빼기", className: "absolute right-0 top-0 w-4 h-4 bg-black/60 text-white text-[10px] leading-none" }, "×"));
}
function WeddingTheme({ hh, privacy }) {
  useDmRefNotes();
  const [tabRaw, setTab] = usePersist("wedding-tab-v1", "overview");
  const [guestsAll] = usePersist("wedding-guests-v1", []);
  const tab = ["venue", "studio", "dress", "makeup", "refs"].includes(tabRaw) ? "vendors" : tabRaw;
  const [seg, setSeg] = usePersist("wedding-vendor-seg-v1", ["studio", "dress", "makeup"].includes(tabRaw) ? tabRaw : "venue");
  const [info, setInfo] = usePersist("wedding-info-v1", { date: "", venue: "" });
  const [confirmed, setConfirmed] = usePersist("wedding-confirmed-v1", {});
  const [vendorDetails, setVendorDetails] = usePersist(VENDOR_DETAIL_KEY, {});
  const [customEvents, setCustomEvents] = usePersist("wedding-custom-events-v1", []);
  const confirmVendor = (kind, v, price) => {
    const off = confirmed[kind] && confirmed[kind].name === v.name;
    setConfirmed({ ...confirmed, [kind]: off ? null : { name: v.name, area: v.area || "", price: price || "", url: v.url || "" } });
    if (kind === "venue") {
      if (off) {
        if (info.venue === v.name) setInfo({ ...info, venue: "" });
      } else setInfo({ ...info, venue: v.name });
    }
  };
  const [honeymoon, setHoneymoon] = usePersist("wedding-honeymoon-v5", HONEYMOON_DEFAULT);
  const [venueList, setVenueList] = usePersist("wedding-venues-v3", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v })));
  const [budget, setBudget] = usePersist("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const budgetIsV1 = budget.some((b) => /^w\d$/.test(b.id) && !b.cat);
  useEffect(() => {
    if (budgetIsV1) setBudget(seedWeddingBudget(budget));
  }, [budgetIsV1]);
  const [budgetLinks, setBudgetLinks] = usePersist("wedding-budget-links-v1", {});
  const [tours, setTours] = usePersist(VENUE_TOUR_KEY, []);
  const [tourOpen, setTourOpen] = useState(null);
  useEffect(() => {
    if (budgetIsV1) return;
    if (cloud.enabled && !cloud.hydrated) return;
    let base0 = normalizeWeddingBudget(budget);
    if (!store.get("wedding-budget-zero-v1", false)) {
      const linkedVal = (b) => {
        const a = b.link && budgetLinks[b.link];
        return a && typeof a === "object" && a.value != null;
      };
      const z = base0.map((b) => WEDDING_BUDGET_EST[b.id] != null && Number(b.budget) === WEDDING_BUDGET_EST[b.id] && !b.paid && !(Number(b.paidAmt) > 0) && !linkedVal(b) ? { ...b, budget: 0 } : b);
      if (z.some((b, i) => b !== base0[i])) base0 = z;
      setKey("wedding-budget-zero-v1", true);
    }
    if (!store.get("wedding-no-studio-v1", false)) {
      const drop = ["wb19", "wb24", "wb25", "wb26"];
      const keep = (b) => !drop.includes(b.id) || b.paid || b.link || !(Number(b.budget) === 0 || Number(b.budget) === WEDDING_BUDGET_EST[b.id]);
      if (!(confirmed.studio && confirmed.studio.name) && base0.some((b) => !keep(b))) base0 = base0.filter(keep);
      setKey("wedding-no-studio-v1", true);
    }
    const m = migrateSnapBudgetLink(base0, budgetLinks);
    let det = vendorDetails;
    if (!store.get("wedding-budget-detail-v1", false)) {
      det = budgetToDetails(m.budget, confirmed, vendorDetails);
      if (det !== vendorDetails) setVendorDetails(det);
      setKey("wedding-budget-detail-v1", true);
    }
    const r = applyWeddingBudgetLinks(m.budget, m.applied, weddingBudgetLinks({ confirmed, venueList, honeymoon, heads: guestHeads(guestsAll), tours, details: det }));
    if (r.budget !== budget) setBudget(r.budget);
    if (r.applied !== budgetLinks) setBudgetLinks(r.applied);
  }, [budgetIsV1, confirmed, venueList, honeymoon, guestsAll, budget, budgetLinks, tours, vendorDetails]);
  const [checklist, setChecklist] = usePersist(
    "wedding-checklist-v2",
    WEDDING_CHECKLIST_DEFAULT.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ id: uid(), text: t, done: false })) }))
  );
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const [newPlace, setNewPlace] = useState({ place: "", cost: 0, season: "", note: "", route: "" });
  const [venueFilter, setVenueFilter] = useState("all");
  useUniqIds(venueList, setVenueList);
  const [venueFavs, setVenueFavs] = usePersist("wedding-venue-favs-v1", {});
  const [favOnly, setFavOnly] = useState(false);
  const [venueRank, setVenueRank] = usePersist("wedding-venue-rank-v1", []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-dm-added-v1", false)) return;
      const snapKey = "wedding-vendor-snap-v4", cur = store.get(snapKey, WEDDING_VENDORS.snap.items.map((v, i) => ({ id: "snap" + i, ...v })));
      const have = new Set(cur.map((v) => String(v.url || "").toLowerCase().replace(/\/+$/, "")));
      const add = SNAP_DM_ADD.filter((v) => !have.has(v.url.toLowerCase()) && !cur.some((x) => x.id === v.id));
      if (add.length) setKey(snapKey, [...cur, ...add.map((v) => ({ ...v, at: Date.now() }))]);
      const notes = store.get("notes-wedding-v1", []);
      const memo = [
        { id: "dm-note-planner", title: "베리굿웨딩 한수아 팀장", body: `인스타 @hsuah_pl (DM으로 공유받음) — ${IG("hsuah_pl")}` },
        { id: "dm-note-ring", title: "결혼반지 — '대한민국 1호 명장 공방' 후기", body: "인스타 @young1y_ 방문 후기(DM으로 공유받음) — https://www.instagram.com/reel/DdLs7rDiKuc/" }
      ].filter((m) => !notes.some((n) => n.id === m.id));
      if (memo.length) setKey("notes-wedding-v1", [...notes, ...memo.map((m) => ({ ...m, at: Date.now() }))]);
      setKey("wedding-dm-added-v1", true);
    };
    t = setTimeout(run, 900);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-picks-20261007-v1", false)) return;
      const conf = store.get("wedding-confirmed-v1", {}) || {};
      if (!conf.ssuit) setKey("wedding-confirmed-v1", { ...conf, ssuit: { name: "홀스테일러", area: "제주", price: "유아오 패키지 포함", url: IG("horsetailor_") } });
      let rk = store.get("wedding-vendor-sbouquet-rank-v1", []) || [];
      rk = withRank(withRank(rk, "예플리", 1), "투리틀플라워", 1);
      setKey("wedding-vendor-sbouquet-rank-v1", rk);
      const fv = store.get("wedding-vendor-sbouquet-favs-v1", {}) || {};
      setKey("wedding-vendor-sbouquet-favs-v1", { ...fv, "투리틀플라워": fv["투리틀플라워"] || Date.now(), "예플리": fv["예플리"] || Date.now() });
      setKey("wedding-picks-20261007-v1", true);
    };
    t = setTimeout(run, 2600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      const done = store.get("wedding-vendor-adds-v1", []) || [];
      const todo = VENDOR_ADDS.filter((v) => !done.includes(v.id));
      if (!todo.length) return;
      [...new Set(todo.map((v) => v.kind))].forEach((kind) => {
        const key = `wedding-vendor-${kind}-v4`, cur = store.get(key, WEDDING_VENDORS[kind].items.map((v, i) => ({ id: kind + i, ...v })));
        const add = todo.filter((v) => v.kind === kind && !cur.some((x) => x.id === v.id || sameVendor(x, v))).map(({ kind: _k, addedAt, ...v }) => ({ ...v, at: Date.now() }));
        if (add.length) setKey(key, [...cur, ...add]);
      });
      setKey("wedding-vendor-adds-v1", [...done, ...todo.map((v) => v.id)]);
    };
    t = setTimeout(run, 2100);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-snap-added-v2", false)) return;
      const snapKey = "wedding-vendor-snap-v4", cur = store.get(snapKey, WEDDING_VENDORS.snap.items.map((v, i) => ({ id: "snap" + i, ...v })));
      const have = new Set(cur.map((v) => String(v.url || "").toLowerCase().replace(/\/+$/, "")));
      const add = SNAP_ADD_V2.filter((v) => !have.has(v.url.toLowerCase()) && !cur.some((x) => x.id === v.id));
      if (add.length) setKey(snapKey, [...cur, ...add.map((v) => ({ ...v, at: Date.now() }))]);
      setKey("wedding-snap-added-v2", true);
    };
    t = setTimeout(run, 1200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-snap-gieok-v1", false)) return;
      const snapKey = "wedding-vendor-snap-v4", cur = store.get(snapKey, null);
      const isGieok = (v) => igHandle(v.url).toLowerCase() === "__gieok";
      if (Array.isArray(cur) && cur.some(isGieok)) setKey(snapKey, cur.map((v) => isGieok(v) ? {
        ...v,
        area: v.area === "지역 문의" ? "제주" : v.area,
        price: !v.price || v.price === "문의" ? GIEOK.price : v.price,
        note: GIEOK.note
      } : v));
      const conf = store.get("wedding-confirmed-v1", {}) || {}, c = conf.snap, item = Array.isArray(cur) && c && cur.find((v) => v.name === c.name);
      if (c && item && isGieok(item)) setKey("wedding-confirmed-v1", { ...conf, snap: { ...c, url: item.url, area: c.area === "지역 문의" ? "제주" : c.area, price: !c.price || c.price === "문의" ? GIEOK.price : c.price } });
      setKey("wedding-snap-gieok-v1", true);
    };
    t = setTimeout(run, 1400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-dress-claudia-v1", false)) return;
      const key = "wedding-vendor-dress-v4", cur = store.get(key, null);
      if (Array.isArray(cur) && !cur.some((x) => sameVendor(x, DRESS_CLAUDIA))) setKey(key, [{ id: "dr-claudia", ...DRESS_CLAUDIA, custom: true, at: Date.now() }, ...cur]);
      setKey("wedding-dress-claudia-v1", true);
    };
    t = setTimeout(run, 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-bsnap-personal-v1", false)) return;
      const key = "wedding-vendor-bsnap-v4", cur = store.get(key, null);
      let item = Array.isArray(cur) && cur.find((x) => sameVendor(x, BSNAP_PERSONAL));
      if (Array.isArray(cur) && !item) {
        item = { id: "bs-personal", ...BSNAP_PERSONAL, custom: true, at: Date.now() };
        setKey(key, [...cur, item]);
      }
      const v = item || BSNAP_PERSONAL, conf = store.get("wedding-confirmed-v1", {}) || {};
      setKey("wedding-confirmed-v1", { ...conf, bsnap: { name: v.name, area: v.area || "", price: v.price || "", url: v.url || "" } });
      setKey("wedding-bsnap-personal-v1", true);
    };
    t = setTimeout(run, 1700);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-bsnap-studio-v1", false)) return;
      const key = "wedding-vendor-bsnap-v4", cur = store.get(key, null);
      if (Array.isArray(cur)) {
        const add = BSNAP_FROM_STUDIO.filter((v) => !cur.some((x) => sameVendor(x, v))).map((v, i) => ({ id: `bs-studio${i}`, ...v, custom: true, at: Date.now() }));
        if (add.length) setKey(key, [...cur, ...add]);
      }
      setKey("wedding-bsnap-studio-v1", true);
    };
    t = setTimeout(run, 1600);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-vendor-dedupe-v1", false)) return;
      const now = Date.now();
      let picks = store.get(MOOD_KEY, []), vps = store.get(MOOD_VENDOR_KEY, []), photos = store.get(SNAP_PHOTOS_KEY, {}), conf = store.get("wedding-confirmed-v1", {}) || {};
      let pChanged = false, vChanged = false, phChanged = false, cChanged = false;
      Object.keys(WEDDING_VENDORS).forEach((kind) => {
        const key = `wedding-vendor-${kind}-v4`, cur = store.get(key, null);
        if (!Array.isArray(cur)) return;
        const r = dedupeVendorList(cur);
        if (!r.gone.length) return;
        setKey(key, r.list);
        const to = (id) => r.remap[id] || id;
        const movePicks = (arr, mk) => {
          const seen = /* @__PURE__ */ new Set();
          return arr.map((p) => p.kind === kind && r.remap[p.vendorId] ? { ...p, vendorId: to(p.vendorId), vendorName: (r.list.find((x) => x.id === to(p.vendorId)) || {}).name || p.vendorName, id: mk(p), u: now } : p).filter((p) => !seen.has(p.id) && seen.add(p.id));
        };
        if (picks.some((p) => p.kind === kind && r.remap[p.vendorId])) {
          picks = movePicks(picks, (p) => `${kind}|${to(p.vendorId)}|${p.photo}`);
          pChanged = true;
        }
        if (vps.some((p) => p.kind === kind && r.remap[p.vendorId])) {
          vps = movePicks(vps, (p) => `${kind}|${to(p.vendorId)}`);
          vChanged = true;
        }
        Object.entries(r.remap).forEach(([old, keep]) => {
          if (photos[old]) {
            photos = { ...photos };
            if (!photos[keep]) photos[keep] = photos[old];
            delete photos[old];
            phChanged = true;
          }
        });
        const c = conf[kind], g = c && r.gone.find((x) => x.name === c.name);
        if (g) {
          conf = { ...conf, [kind]: { ...c, name: r.list.find((x) => x.id === r.remap[g.id]).name } };
          cChanged = true;
        }
      });
      if (pChanged) setKey(MOOD_KEY, picks);
      if (vChanged) setKey(MOOD_VENDOR_KEY, vps);
      if (phChanged) setKey(SNAP_PHOTOS_KEY, photos);
      if (cChanged) setKey("wedding-confirmed-v1", conf);
      setKey("wedding-vendor-dedupe-v1", true);
    };
    t = setTimeout(run, 1200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-sdm-merge-v1", false)) return;
      const now = Date.now(), dKey = "wedding-vendor-sdress-v4", mKey = "wedding-vendor-smakeup-v4";
      const defs = WEDDING_VENDORS.sdress.items.map((v, i) => ({ id: "sdress" + i, ...v }));
      const sdStored = store.get(dKey, null), smStored = store.get(mKey, null);
      if (!Array.isArray(sdStored) && !Array.isArray(smStored)) {
        setKey("wedding-sdm-merge-v1", true);
        return;
      }
      let list = Array.isArray(sdStored) ? [...sdStored] : defs;
      const remap = {};
      const ids = new Set(list.map((x) => x.id));
      const put = (x, prefix) => {
        const same = list.find((k) => sameVendor(k, x));
        if (same) return same.id;
        const id = ids.has(x.id) ? `${prefix}-${uid()}` : x.id;
        ids.add(id);
        list.push({ ...x, id, at: now });
        return id;
      };
      (Array.isArray(smStored) ? smStored : []).forEach((x) => {
        remap[x.id] = put(x, "sdm");
      });
      if (Array.isArray(sdStored)) defs.forEach((x) => put(x, "sdm"));
      setKey(dKey, list);
      const to = (id) => remap[id] || id;
      const move = (arr, mk) => {
        const seen = /* @__PURE__ */ new Set();
        return arr.map((p) => p.kind === "smakeup" ? { ...p, kind: "sdress", vendorId: to(p.vendorId), id: mk({ ...p, vendorId: to(p.vendorId) }), u: now } : p).filter((p) => !seen.has(p.id) && seen.add(p.id));
      };
      const picks = store.get(MOOD_KEY, []), vps = store.get(MOOD_VENDOR_KEY, []);
      if (picks.some((p) => p.kind === "smakeup")) setKey(MOOD_KEY, move(picks, (p) => `sdress|${p.vendorId}|${p.photo}`));
      if (vps.some((p) => p.kind === "smakeup")) setKey(MOOD_VENDOR_KEY, move(vps, (p) => `sdress|${p.vendorId}`));
      const photos = store.get(SNAP_PHOTOS_KEY, {});
      if (Object.keys(remap).some((o) => photos[o] && o !== remap[o])) {
        const ph = { ...photos };
        Object.entries(remap).forEach(([o, k]) => {
          if (ph[o] && o !== k) {
            if (!ph[k]) ph[k] = ph[o];
            delete ph[o];
          }
        });
        setKey(SNAP_PHOTOS_KEY, ph);
      }
      const mf = store.get("wedding-vendor-smakeup-favs-v1", {}), mr = store.get("wedding-vendor-smakeup-rank-v1", []);
      if (Object.keys(mf).length) setKey("wedding-vendor-sdress-favs-v1", { ...mf, ...store.get("wedding-vendor-sdress-favs-v1", {}) });
      if (mr.length) {
        const dr = store.get("wedding-vendor-sdress-rank-v1", []);
        setKey("wedding-vendor-sdress-rank-v1", [...dr, ...mr.filter((n) => !dr.includes(n))]);
      }
      let conf = store.get("wedding-confirmed-v1", {}) || {};
      const cm = conf.smakeup && conf.smakeup.name ? conf.smakeup : null, cd = conf.sdress && conf.sdress.name ? conf.sdress : null;
      if (cm) {
        const details = store.get(VENDOR_DETAIL_KEY, {}), mk = `smakeup|${cm.name}`, dk = `sdress|${cm.name}`;
        if (details[mk]) {
          const a = details[dk], b = details[mk];
          const merged = !a ? b : {
            ...b,
            ...a,
            pays: [...a.pays || [], ...b.pays || []],
            events: [...a.events || [], ...b.events || []],
            ...(a.totalSet || Number(a.total) > 0) && (b.totalSet || Number(b.total) > 0) ? { total: (Number(a.total) || 0) + (Number(b.total) || 0), totalSet: true } : {}
          };
          const nd = { ...details, [dk]: merged };
          delete nd[mk];
          setKey(VENDOR_DETAIL_KEY, nd);
        }
        const budget2 = store.get("wedding-budget-v1", null), links = store.get("wedding-budget-links-v1", {});
        if (!cd || cd.name === cm.name) {
          conf = { ...conf, sdress: cd || cm };
          delete conf.smakeup;
          if (Array.isArray(budget2)) {
            const hasD = budget2.some((b) => b.link === "sdress");
            const nb = budget2.flatMap((b) => b.link !== "smakeup" ? [b] : hasD ? [] : [{ ...b, link: "sdress", id: b.id === "link-smakeup" ? "link-sdress" : b.id, name: "제주 스냅 드레스·헤메" }]);
            setKey("wedding-budget-v1", nb);
            const nl = { ...links };
            if (!hasD && nl.smakeup) nl.sdress = nl.smakeup;
            delete nl.smakeup;
            setKey("wedding-budget-links-v1", nl);
          }
        } else {
          delete conf.smakeup;
          if (Array.isArray(budget2)) setKey("wedding-budget-v1", budget2.map((b) => b.link === "smakeup" ? { ...b, link: void 0, linkLabel: void 0, note: [b.note, `예전 스냅 헤메 확정 · ${cm.name}`].filter(Boolean).join(" · ") } : b));
        }
        setKey("wedding-confirmed-v1", conf);
      }
      if (store.get("wedding-vendor-seg-v1", "") === "smakeup") setKey("wedding-vendor-seg-v1", "sdress");
      setKey("wedding-sdm-merge-v1", true);
    };
    t = setTimeout(run, 1700);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      if (store.get("wedding-detail-total-v1", false)) return;
      const all = store.get(VENDOR_DETAIL_KEY, {}) || {};
      let changed = false;
      const out = { ...all };
      Object.entries(all).forEach(([k, dt]) => {
        if (!dt || k.startsWith("venue|")) return;
        const s = paysSum(dt), tot = Number(dt.total) || 0;
        if (s > 0 && tot > s) {
          out[k] = { ...dt, pays: [...dt.pays || [], { id: uid(), label: "남은 돈", amt: Math.round((tot - s) * 1e4) / 1e4, date: "", paid: false }], u: Date.now() };
          changed = true;
        }
      });
      if (changed) setKey(VENDOR_DETAIL_KEY, out);
      setKey("wedding-detail-total-v1", true);
    };
    t = setTimeout(run, 1900);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    let t;
    const run = () => {
      if (cloud.enabled && !cloud.hydrated) {
        t = setTimeout(run, 1500);
        return;
      }
      const ADDED = ["루클라비더화이트", "명동 라루체", "루이비스컨벤션 강서"];
      const done = store.get("wedding-venue-added-v1", []);
      const todo = ADDED.filter((nm) => !done.includes(nm));
      if (!todo.length) return;
      const cur = store.get("wedding-venues-v3", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v })));
      const have = new Set(cur.map((v) => v.name));
      const add = WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v })).filter((v) => todo.includes(v.name) && !have.has(v.name));
      if (add.length) setKey("wedding-venues-v3", [...cur, ...add]);
      setKey("wedding-venue-added-v1", [...done, ...todo]);
    };
    t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, []);
  const [venueEdit, setVenueEdit] = useState(null);
  const saveVenueEdit = () => {
    const e = venueEdit;
    if (!e || !e.name.trim()) return;
    const old = venueList.find((x) => x.id === e.id);
    if (!old) {
      setVenueEdit(null);
      return;
    }
    const name = e.name.trim();
    if (name !== old.name && venueList.some((x) => x.id !== e.id && x.name === name)) {
      alert(`'${name}'은(는) 이미 리스트에 있어요. 다른 이름으로 저장해 주세요.`);
      return;
    }
    setVenueList(venueList.map((x) => x.id === e.id ? { ...x, name, area: e.area, type: e.type, cap: e.cap, meal: e.meal, fee: e.fee, note: e.note, img: e.img, custom: true } : x));
    if (name !== old.name) {
      if (venueFavs[old.name]) {
        const n = { ...venueFavs, [name]: venueFavs[old.name] };
        delete n[old.name];
        setVenueFavs(n);
      }
      setVenueRank(venueRank.map((x) => x === old.name ? name : x));
      setTours(tours.map((t) => t.id === tourId(old.name) ? { ...t, id: tourId(name), venue: name, u: Date.now() } : t));
      if (confirmed.venue && confirmed.venue.name === old.name) {
        setConfirmed({ ...confirmed, venue: { ...confirmed.venue, name } });
        setBudgetLinks(Object.fromEntries(Object.entries(budgetLinks).map(([k, p]) => [k, p && typeof p === "object" && p.src === old.name ? { ...p, src: name } : p])));
      }
      if (info.venue === old.name) setInfo({ ...info, venue: name });
    }
    setVenueEdit(null);
  };
  const toggleFav = (name) => {
    const n = { ...venueFavs };
    if (n[name]) delete n[name];
    else n[name] = Date.now();
    setVenueFavs(n);
  };
  const removeVenue = (v) => {
    if (isConfVenue(v)) {
      alert("확정한 식장이라 지울 수 없어요. 먼저 '확정 해제'를 눌러 주세요.");
      return;
    }
    if (!window.confirm(`'${v.name}'을(를) 리스트에서 삭제할까요?`)) return;
    setVenueList((l) => l.filter((x) => x.id !== v.id));
    const sameName = venueList.some((x) => x.id !== v.id && x.name === v.name);
    if (!sameName) {
      setVenueFavs((f) => {
        if (!f[v.name]) return f;
        const n = { ...f };
        delete n[v.name];
        return n;
      });
      setVenueRank((r) => rankOf(r, v.name) ? withRank(r, v.name, 0) : r);
      setTours((ts) => ts.some((t) => t.id === tourId(v.name)) ? ts.filter((t) => t.id !== tourId(v.name)) : ts);
    }
  };
  const detailKey = (k) => confirmed[k] && confirmed[k].name ? `${k}|${confirmed[k].name}` : null;
  const patchDetail = (k) => (fn) => {
    const key = detailKey(k);
    if (!key) return;
    setVendorDetails((all) => ({ ...all, [key]: { ...fn((all || {})[key] || budgetToDetails(budget, confirmed, {}, k)[key] || vendorDetailSeed(k)), u: Date.now() } }));
  };
  const setVendorTotal = (k, v) => patchDetail(k)((cur) => {
    const s = paysSum(cur);
    if (!(s > 0)) return { ...cur, total: v, totalSet: true };
    let diff = Math.round((v - s) * 1e4) / 1e4;
    if (!diff) return cur;
    let pays = [...cur.pays || []];
    if (diff > 0) pays.push({ id: uid(), label: "남은 돈 (예산표에서 고침)", amt: diff, date: "", paid: false });
    else for (let i = pays.length - 1; i >= 0 && diff < 0; i--) {
      const p = pays[i];
      if (p.paid || !(Number(p.amt) > 0)) continue;
      const cut = Math.min(Number(p.amt), -diff);
      pays[i] = { ...p, amt: Math.round((Number(p.amt) - cut) * 1e4) / 1e4 };
      diff += cut;
    }
    return { ...cur, pays, total: paysSum({ pays }), totalSet: true };
  });
  const openVendor = (k) => {
    setTab("vendors");
    setSeg(k);
    window.scrollTo({ top: 0 });
  };
  const vendorOn = Object.fromEntries(Object.keys(confirmed).filter((k) => confirmed[k] && confirmed[k].name).map((k) => [k, true]));
  const snapCtx = (() => {
    const c = confirmed.snap, dt = c && vendorDetails[detailKey("snap")];
    const url = c && c.url || (c && (store.get("wedding-vendor-snap-v4", []) || []).find((x) => x.name === c.name) || {}).url;
    const shoot = (dt && dt.events || []).find((e) => /촬영/.test(e.label || "") && e.date);
    return {
      name: c && c.name,
      handle: igHandle(url).toLowerCase(),
      shoot: shoot ? shoot.date : "",
      sdm: { sdress: confirmed.sdress && confirmed.sdress.name, sbouquet: confirmed.sbouquet && confirmed.sbouquet.name, ssuit: confirmed.ssuit && confirmed.ssuit.name }
    };
  })();
  const [venueBrowse, setVenueBrowse] = useState(false);
  useEffect(() => {
    setVenueBrowse(false);
  }, [confirmed.venue && confirmed.venue.name]);
  const vendorTabProps = (k) => ({ kind: k, confirmed: confirmed[k], onConfirm: (v) => confirmVendor(k, v, v.price), detail: vendorDetails[detailKey(k)], onPatchDetail: patchDetail(k), snap: snapCtx, onGo: setSeg, privacy });
  const d = dday(info.date);
  const totalBudget = budget.reduce((s, b) => s + (b.budget || 0), 0);
  const alloc = store.get("home-alloc-v1", ALLOC_DEFAULT);
  const toggleTask = (gi, id) => {
    const cur = checklist[gi] && checklist[gi].items.find((it) => it.id === id);
    setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map((it) => it.id === id ? { ...it, done: !it.done } : it) }));
    if (cur) propagateTask(["wedding", cur.text], !cur.done);
  };
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((it) => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone2 = checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0);
  const patchHm = (id, k, v) => setHoneymoon(honeymoon.map((h) => h.id === id ? { ...h, [k]: v } : h));
  const starHm = (id) => setHoneymoon(honeymoon.map((h) => ({ ...h, star: h.id === id ? !h.star : false })));
  const [venueMeta, setVenueMeta] = usePersist("wedding-venues-meta-v1", { at: null });
  const [newVenue, setNewVenue] = useState({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" });
  const patchVenue = (id, k, val) => setVenueList(venueList.map((x) => x.id === id ? { ...x, [k]: val } : x));
  const venueTypes = ["all", ...Array.from(new Set(venueList.map((v) => v.type)))];
  const [vSearch, setVSearch] = usePersist("wedding-venue-search-v1", { area: "", maxMeal: 0 });
  const mealMinOf = (v) => {
    const m = String(v.meal || "").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  };
  const isConfVenue = (v) => !!(confirmed.venue && confirmed.venue.name === v.name);
  const venues = venueList.filter((v) => (venueFilter === "all" || v.type === venueFilter) && (!favOnly || !!venueFavs[v.name]) && (!vSearch.area.trim() || `${v.area || ""} ${v.name || ""}`.includes(vSearch.area.trim())) && (!(vSearch.maxMeal > 0) || mealMinOf(v) === null || mealMinOf(v) <= vSearch.maxMeal)).sort((a, b) => (isConfVenue(b) ? 1 : 0) - (isConfVenue(a) ? 1 : 0) || (rankOf(venueRank, a.name) || 999) - (rankOf(venueRank, b.name) || 999) || (venueFavs[b.name] ? 1 : 0) - (venueFavs[a.name] ? 1 : 0));
  const venueQuery = [vSearch.area.trim() || "서울", venueFilter === "all" ? "" : venueFilter, "웨딩홀", vSearch.maxMeal > 0 ? `식대 ${vSearch.maxMeal}만원대` : ""].filter(Boolean).join(" ");
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PhaseGauge, { themeId: "wedding" }), /* @__PURE__ */ React.createElement(PillNav, { tabs: WEDDING_TABS, tab, setTab }), tab === "overview" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, info.date ? /* @__PURE__ */ React.createElement("div", { className: "rounded-3xl bg-[#0A0A0A] text-white px-6 py-10 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-white/70 mb-3" }, "우리 결혼식"), /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[52px] sm:text-[68px] leading-none font-semibold tracking-tight" }, ddayText(d)), /* @__PURE__ */ React.createElement("div", { className: "mt-4 text-[14px] text-white/75" }, info.date, info.venue ? " · " + info.venue : "")) : /* @__PURE__ */ React.createElement(Card, { className: "flex flex-wrap items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "예식일을 정하면 D-day와 준비 일정이 맞춰져요"), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, "날짜는 나중에 바꿀 수 있어요")), /* @__PURE__ */ React.createElement("input", { type: "date", "aria-label": "예식일", value: "", onChange: (e) => setInfo({ ...info, date: e.target.value }), className: "h-11 px-3 rounded-xl bg-[#F5F5F5] text-[15px] font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0A0A0A]" })), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(WeddingLinkedBar, { money: weddingMoney(alloc, budget), privacy, setTab })), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "check2", label: "체크리스트 진행", value: `${taskDone2}/${taskTotal}` }), /* @__PURE__ */ React.createElement(Kpi, { icon: "piggy", label: "예산 총액 · 아직 안 낸 돈", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(totalBudget), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, " · ", manWon(weddingMoney(alloc, budget).remaining))), accent: "#525252" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "users", label: "하객 리스트", value: `${guestHeads(guestsAll)}명`, accent: "#8A8A8A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "building", label: "식장 후보", value: `${venueList.length}곳`, accent: "#B0B0B0" })), /* @__PURE__ */ React.createElement(Card, { className: "mt-3 !p-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, "확정한 업체"), /* @__PURE__ */ React.createElement("button", { onClick: () => setTab("vendors"), className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4" }, "후보 비교하러 가기")), vendorSegsFor(confirmed).map(([group, items]) => /* @__PURE__ */ React.createElement("div", { key: group, className: "mb-2.5 last:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-semibold text-[#6B6B6B] mb-1" }, group), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-2" }, items.filter(([k]) => k !== "refs").map(([k, ic, label]) => {
    const c = confirmed[k], dt = vendorDetails[detailKey(k)];
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: k,
        onClick: () => {
          setTab("vendors");
          setSeg(k);
        },
        className: `text-left rounded-xl px-3 py-2.5 transition-colors ${c ? "bg-[#0A0A0A] text-white" : "bg-[#FAFAFA] hover:bg-[#F0F0F0]"}`
      },
      /* @__PURE__ */ React.createElement("div", { className: `text-[11px] mb-0.5 ${c ? "text-white/60" : "text-[#6B6B6B]"}` }, ic, " ", label, " ", c && `· ${dt && dt.status || "확정"} ✓`),
      /* @__PURE__ */ React.createElement("div", { className: `text-[13px] font-bold truncate ${c ? "" : "text-[#737373]"}` }, c ? c.name : "미정 · 눌러서 비교"),
      c && (c.area || c.price) ? /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-white/60 truncate" }, [c.area, c.price].filter(Boolean).join(" · ")) : null
    );
  }))))), /* @__PURE__ */ React.createElement(WeddingCalendar, { events: weddingCalEvents(confirmed, vendorDetails, info, customEvents), onOpen: openVendor, privacy, custom: customEvents, setCustom: setCustomEvents }), /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, "예식일"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      "aria-label": "예식일",
      value: info.date,
      onChange: (e) => setInfo({ ...info, date: e.target.value }),
      className: "w-full h-12 px-3.5 rounded-xl bg-[#F5F5F5] border border-transparent text-[15px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    }
  )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[14px] text-[#525252] block mb-1.5 font-medium" }, "예식장 (미정이면 비워두기)"), /* @__PURE__ */ React.createElement(TextInput, { value: info.venue, onChange: (v) => setInfo({ ...info, venue: v }), placeholder: "예: OO웨딩홀", className: "!h-12" }))))), /* @__PURE__ */ React.createElement(WeddingPaymentGuide, { hh, privacy, remaining: budget.filter((b) => budgetCat(b) === WEDDING_HALL_CAT).reduce((s, b) => s + (Number(b.budget) || 0), 0) })), tab === "budget" && /* @__PURE__ */ React.createElement(WeddingBudgetTab, { budget, setBudget, alloc, vendorOn, onVendorTotal: setVendorTotal, onOpenVendor: openVendor }), tab === "checklist" && (() => {
    const phaseIdx = d === null ? null : Math.min(checklist.length - 1, d < 0 ? 5 : d <= 30 ? 4 : d <= 90 ? 3 : d <= 180 ? 2 : d <= 270 ? 1 : 0);
    const curGroup = phaseIdx !== null ? checklist[phaseIdx] : null;
    const curLeft = curGroup ? curGroup.items.filter((it) => !it.done).length : 0;
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "2026 실전 후기 기반", title: "웨딩 체크리스트" }), curGroup ? /* @__PURE__ */ React.createElement(Card, { className: "mb-4 !border-[#0A0A0A] border" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-bold text-white bg-[#0A0A0A] px-2.5 py-1 rounded-full" }, ddayText(d)), /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold" }, '지금은 "', curGroup.cat, '" 단계')), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[13px] text-[#525252]" }, curLeft > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, "이 단계에서 남은 할 일 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, curLeft, "개"), ". 아래 굵은 테두리 카드부터 처리해요.") : "이 단계 할 일을 모두 끝냈어요. 다음 단계를 미리 봐요.")) : /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "개요 탭에서 예식일을 정하면 지금 해야 할 단계를 자동으로 짚어 줘요.")), /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "전체 진행률"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 flex-1 max-w-[220px] ml-4" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: taskTotal > 0 ? taskDone2 / taskTotal : 0 }), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold shrink-0" }, taskDone2, "/", taskTotal))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "할 일 추가"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
      "select",
      {
        value: newTask.gi,
        onChange: (e) => setNewTask({ ...newTask, gi: e.target.value }),
        className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
      },
      checklist.map((g, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, g.cat))
    ), /* @__PURE__ */ React.createElement(TextInput, { value: newTask.text, onChange: (v) => setNewTask({ ...newTask, text: v }), placeholder: "예: 웨딩카 예약", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement("button", { onClick: addTask, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "추가")))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, checklist.map((g, gi) => {
      const state = phaseIdx === null ? "none" : gi === phaseIdx ? "now" : gi < phaseIdx ? "past" : "next";
      const gLeft = g.items.filter((it) => !it.done).length;
      return /* @__PURE__ */ React.createElement("section", { key: gi }, /* @__PURE__ */ React.createElement(Card, { className: state === "now" ? "!border-[#0A0A0A] border-2" : state === "past" ? "opacity-60" : "" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("h4", { className: "font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full" }, g.cat), state === "now" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "지금 할 일"), state === "past" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#6B6B6B]" }, gLeft > 0 ? `지난 단계 · 남은 일 ${gLeft}개` : "지난 단계 · 모두 완료"), state === "next" && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#737373]" }, "다음 단계")), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`결혼준비 ${g.cat.replace("D-", "")} 체크리스트 후기`), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#6B6B6B] underline underline-offset-4 hover:text-[#0A0A0A]" }, "실제 후기 검색")), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-2 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleTask(gi, it.id), className: "flex items-start gap-3 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[14px] leading-relaxed ${it.done ? "line-through text-[#737373]" : "text-[#24231E]"}` }, it.text, taskGroupOf(["wedding", it.text]) >= 0 && /* @__PURE__ */ React.createElement("span", { className: "ml-1.5 text-[11px] font-semibold text-[#6B6B6B]", title: "홈 로드맵의 같은 일과 함께 체크돼요" }, "🔗 로드맵"))), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => removeTask(gi, it.id), className: "!w-7 !h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" }))))));
    })), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "후기에서 자주 나오는", title: `실전 꿀팁 ${WEDDING_TIPS.length}가지` }), /* @__PURE__ */ React.createElement(Card, { className: "bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("ul", { className: "grid sm:grid-cols-2 gap-x-10 gap-y-3.5" }, WEDDING_TIPS.map((t, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex gap-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-bold shrink-0 mt-0.5" }, String(i + 1).padStart(2, "0")), /* @__PURE__ */ React.createElement("span", null, t)))))));
  })(), tab === "vendors" && /* @__PURE__ */ React.createElement("div", { className: "mb-5 space-y-2" }, vendorSegsFor(confirmed).map(([group, items]) => /* @__PURE__ */ React.createElement("div", { key: group, className: "flex items-center gap-1.5 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "w-full sm:w-24 text-[12px] font-semibold text-[#6B6B6B] shrink-0" }, group), items.map(([id, ic, label]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: id,
      onClick: () => setSeg(id),
      "aria-pressed": seg === id,
      className: `h-9 px-4 rounded-full text-[13px] font-semibold transition-colors ${seg === id ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`
    },
    ic,
    " ",
    label,
    confirmed[id] ? " ✓" : ""
  ))))), tourOpen && (() => {
    const v = venueList.find((x) => x.name === tourOpen) || { name: tourOpen };
    return /* @__PURE__ */ React.createElement(VenueTourSheet, { venue: v, tours, setTours, onClose: () => setTourOpen(null) });
  })(), tab === "vendors" && seg === "studio" && !(confirmed.studio && confirmed.studio.name) && /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252]" }, "스튜디오 촬영은 안 하기로 해서 목록을 뺐어요. 본식 스냅도 하는 곳(어도러블 스냅·리저브하우스·원규스튜디오)은 ", /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setSeg("bsnap"), className: "font-semibold underline underline-offset-4" }, "본식 스냅"), "으로 옮겼어요.")), tab === "vendors" && seg === "venue" && confirmed.venue && confirmed.venue.name && !venueBrowse && (() => {
    const vItem = venueList.find((x) => x.name === confirmed.venue.name);
    const t = tours.find((x) => x.id === tourId(confirmed.venue.name)), miss = tourMissing(t);
    const vRows = budget.filter((b) => b.link && b.link.startsWith("venue-"));
    const cost = { total: vRows.reduce((s, b) => s + (Number(b.budget) || 0), 0), lines: vRows.map((b) => [b.name, Number(b.budget) || 0]) };
    return /* @__PURE__ */ React.createElement(
      VendorDetailPanel,
      {
        kind: "venue",
        label: "식장",
        vendor: confirmed.venue,
        item: vItem,
        detail: vendorDetails[detailKey("venue")],
        onPatch: patchDetail("venue"),
        privacy,
        cost,
        onBrowse: () => setVenueBrowse(true),
        onUnconfirm: () => confirmVendor("venue", vItem || confirmed.venue, (vItem || confirmed.venue).meal),
        extra: /* @__PURE__ */ React.createElement(Card, { className: "mt-3 !p-4" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTourOpen(confirmed.venue.name), className: "w-full h-10 rounded-xl border border-[#E5E5E5] text-[13px] font-semibold flex items-center justify-between px-3 hover:border-[#0A0A0A]" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 14 }), " 투어 체크리스트 (보증인원·식대·대관료 견적)"), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]", style: { fontVariantNumeric: "tabular-nums" } }, tourFilled(t), "/", VENUE_TOUR_KEYS.length, " 채움")), miss.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px] font-semibold text-[#8A5A00]" }, "⚠️ 계약 전에 채워야 할 칸: ", miss.join(" · ")), /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-[12px] text-[#6B6B6B]" }, "식장 예산(대관료·식대·꽃)은 투어 체크리스트의 견적으로 들어가요.")),
        after: /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement(RefGallery, { cats: VENDOR_REF.venue, compact: true, title: "레퍼런스", eyebrow: "웨딩홀 사진·상담 팁" }))
      }
    );
  })(), tab === "vendors" && seg === "venue" && (!confirmed.venue || !confirmed.venue.name || venueBrowse) && /* @__PURE__ */ React.createElement(React.Fragment, null, confirmed.venue && confirmed.venue.name && /* @__PURE__ */ React.createElement("div", { className: "mb-4 flex items-center gap-2 flex-wrap text-[12px] text-[#525252]" }, "확정: ", /* @__PURE__ */ React.createElement("span", { className: "font-bold text-[#0A0A0A]" }, confirmed.venue.name), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setVenueBrowse(false), className: "h-8 px-3 rounded-lg text-[12px] font-bold bg-[#0A0A0A] text-white" }, "세부 사항으로 돌아가기")), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: venueMeta.at ? `서울 · ${venueMeta.at.slice(0, 10)} 실시간 리서치` : "서울 · 2025~26 기준", title: "인기 예식장 리스트" }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-4 flex-wrap" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setFavOnly((f) => !f), "aria-pressed": favOnly, className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${favOnly ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}` }, "★ 즐겨찾기", Object.keys(venueFavs).length ? ` ${Object.keys(venueFavs).length}` : ""), venueTypes.map((t) => /* @__PURE__ */ React.createElement("button", { key: t, onClick: () => setVenueFilter(t), className: `h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${venueFilter === t ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm"}` }, t === "all" ? "전체" : t)), /* @__PURE__ */ React.createElement(
    LiveUpdateBtn,
    {
      topic: "venues",
      params: `&vtype=${encodeURIComponent(venueFilter === "all" ? "" : venueFilter)}&area=${encodeURIComponent(vSearch.area.trim())}&maxMeal=${vSearch.maxMeal || 0}`,
      onData: (j) => {
        const isCustom = (x) => x.custom || !/^r?v\d+$/.test(String(x.id));
        const merged = mergeVendorResearch(store.get("wedding-venues-v3", WEDDING_VENUES.map((v, i) => ({ id: "v" + i, img: "", ...v }))), j.items, "rv", isCustom);
        store.set("wedding-venues-v3", merged);
        store.set("wedding-venues-meta-v1", { at: j.fetchedAt });
        setVenueList(merged);
        setVenueMeta({ at: j.fetchedAt });
      }
    }
  ))), /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, "원하는 조건으로 검색 · 유형은 위 버튼으로 고르고, 위치·가격대를 아래에 적으면 리스트가 바로 좁혀져요"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 items-end" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "위치 (지역·식장명)"), /* @__PURE__ */ React.createElement(TextInput, { value: vSearch.area, onChange: (v) => setVSearch({ ...vSearch, area: v }), placeholder: "예: 강남구, 반포" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[12px] text-[#6B6B6B] block mb-1" }, "1인 식대 최대(만원, 0이면 제한 없음)"), /* @__PURE__ */ React.createElement(NumInput, { value: vSearch.maxMeal, onChange: (v) => setVSearch({ ...vSearch, maxMeal: v }) })), /* @__PURE__ */ React.createElement(
    "a",
    {
      href: naverSearch(venueQuery),
      target: "_blank",
      rel: "noopener noreferrer",
      className: "h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 14 }),
    " 이 조건으로 네이버 검색"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        setVSearch({ area: "", maxMeal: 0 });
        setVenueFilter("all");
      },
      className: "h-10 rounded-lg border border-[#E5E5E5] text-[13px] font-semibold text-[#6B6B6B] hover:text-[#0A0A0A]"
    },
    "조건 초기화"
  )), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[12px] text-[#6B6B6B] leading-relaxed" }, "[최신 정보로 갱신]을 누르면 지금 고른 유형·위치·가격대 조건으로 웹을 다시 조사해요. 조건에 맞는 식장이 리스트에 없으면 네이버 검색으로 찾아 아래 [식장 직접 추가]에 적어요.")), /* @__PURE__ */ React.createElement(VenueTourCompare, { tours, venueNames: venueList.map((v) => v.name), confirmedName: confirmed.venue && confirmed.venue.name, onOpen: setTourOpen }), venues.length === 0 && /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "조건에 맞는 식장이 없어요. 가격대를 올리거나 위치를 비워보세요.")), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, venues.map((v) => venueEdit && venueEdit.id === v.id ? /* @__PURE__ */ React.createElement(Card, { key: v.id, className: "h-full" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, "식장 정보 편집"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.name, onChange: (x) => setVenueEdit({ ...venueEdit, name: x }), placeholder: "식장명 *", ariaLabel: "식장명" }), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.area, onChange: (x) => setVenueEdit({ ...venueEdit, area: x }), placeholder: "지역", ariaLabel: "지역" }), /* @__PURE__ */ React.createElement("select", { value: venueEdit.type, onChange: (e) => setVenueEdit({ ...venueEdit, type: e.target.value }), "aria-label": "유형", className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" }, ["호텔", "하우스", "채플", "컨벤션", "기타"].map((t) => /* @__PURE__ */ React.createElement("option", { key: t }, t))), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.cap, onChange: (x) => setVenueEdit({ ...venueEdit, cap: x }), placeholder: "수용 인원", ariaLabel: "수용 인원" }), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.meal, onChange: (x) => setVenueEdit({ ...venueEdit, meal: x }), placeholder: "1인 식대 (예: 7.5만)", ariaLabel: "1인 식대" }), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.fee, onChange: (x) => setVenueEdit({ ...venueEdit, fee: x }), placeholder: "대관료 (예: 500만)", ariaLabel: "대관료" })), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.note, onChange: (x) => setVenueEdit({ ...venueEdit, note: x }), placeholder: "메모", className: "mb-2", ariaLabel: "메모" }), /* @__PURE__ */ React.createElement(TextInput, { value: venueEdit.img, onChange: (x) => setVenueEdit({ ...venueEdit, img: x }), placeholder: "대표 사진 URL (선택)", className: "mb-3", ariaLabel: "대표 사진 URL" }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: saveVenueEdit, className: "flex-1 h-10 rounded-xl bg-[#0A0A0A] text-white text-[14px] font-semibold" }, "저장"), /* @__PURE__ */ React.createElement("button", { onClick: () => setVenueEdit(null), className: "flex-1 h-10 rounded-xl bg-[#F0F0F0] text-[#525252] text-[14px] font-semibold" }, "취소"))) : /* @__PURE__ */ React.createElement(Card, { key: v.id, className: `h-full flex flex-col ${isConfVenue(v) ? "border !border-[#0A0A0A]" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "w-full h-36 rounded-xl mb-3 overflow-hidden" }, /* @__PURE__ */ React.createElement(ThumbImg, { src: v.img, alt: v.name, fallback: /* @__PURE__ */ React.createElement("div", { className: "w-full h-full flex flex-col items-center justify-center gap-1 text-white", style: { background: VENUE_THUMB[v.type] || VENUE_THUMB.기타 } }, /* @__PURE__ */ React.createElement("span", { className: "text-[30px] font-bold opacity-90" }, (v.name || "?")[0]), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold tracking-[0.24em] opacity-70" }, v.type)) })), /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, v.name, " ", isConfVenue(v) && /* @__PURE__ */ React.createElement("span", { className: "align-middle ml-1 text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full" }, "✓ 확정"), rankOf(venueRank, v.name) > 0 && /* @__PURE__ */ React.createElement("span", { className: "align-middle ml-1 text-[10px] font-bold text-[#0A0A0A] bg-[#FFF4D6] px-2 py-0.5 rounded-full" }, rankOf(venueRank, v.name), "순위")), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mt-0.5" }, v.area, " · 수용 ", v.cap)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 shrink-0" }, /* @__PURE__ */ React.createElement(ToneBadge, { tone: "neutral" }, v.type), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => toggleFav(v.name),
      "aria-pressed": !!venueFavs[v.name],
      "aria-label": venueFavs[v.name] ? "즐겨찾기 해제" : "즐겨찾기",
      title: venueFavs[v.name] ? "즐겨찾기 해제" : "즐겨찾기",
      className: `w-9 h-9 rounded-full flex items-center justify-center text-[18px] leading-none transition-colors ${venueFavs[v.name] ? "bg-[#FFF4D6] text-[#D99A00]" : "bg-[#F5F5F5] text-[#9A9A9A] hover:text-[#525252]"}`
    },
    venueFavs[v.name] ? "★" : "☆"
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 my-3" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "1인 식대"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, v.meal)), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-3 py-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "대관료(추정)"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, v.fee))), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-3" }, v.note), (() => {
    const t = tours.find((x) => x.id === tourId(v.name));
    const n = tourFilled(t);
    const miss = isConfVenue(v) ? tourMissing(t) : [];
    return /* @__PURE__ */ React.createElement("div", { className: "mb-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setTourOpen(v.name), className: "w-full h-10 rounded-xl border border-[#E5E5E5] text-[13px] font-semibold flex items-center justify-between px-3 hover:border-[#0A0A0A]" }, /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 14 }), " 투어 체크리스트"), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]", style: { fontVariantNumeric: "tabular-nums" } }, n > 0 ? `${n}/${VENUE_TOUR_KEYS.length} 채움` : "투어하며 채우기")), miss.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px] font-semibold text-[#8A5A00]" }, "⚠️ 계약 전에 채워야 할 칸: ", miss.join(" · ")));
  })(), /* @__PURE__ */ React.createElement("div", { className: "mt-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-2.5" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 min-w-0" }, /* @__PURE__ */ React.createElement("a", { href: naverSearch(v.name + " 웨딩"), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "네이버 검색"), /* @__PURE__ */ React.createElement("a", { href: naverBlog(v.name + " 결혼식 후기"), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, "후기 보기"), /* @__PURE__ */ React.createElement("button", { onClick: () => setVenueEdit({ id: v.id, name: v.name || "", area: v.area || "", type: v.type || "기타", cap: v.cap || "", meal: v.meal || "", fee: v.fee || "", note: v.note || "", img: v.img || "" }), className: "text-[13px] font-semibold text-[#525252] underline underline-offset-4" }, "편집"), /* @__PURE__ */ React.createElement("button", { onClick: () => removeVenue(v), className: "text-[13px] font-semibold text-[#B4533A] underline underline-offset-4" }, "삭제")), /* @__PURE__ */ React.createElement(RankSelect, { order: venueRank, id: v.name, onChange: (k) => setVenueRank(withRank(venueRank, v.name, k)), label: `${v.name} 순위` }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => confirmVendor("venue", v, v.meal),
      className: `h-8 px-3 rounded-lg text-[12px] font-bold shrink-0 transition-colors ${isConfVenue(v) ? "bg-[#F0F0F0] text-[#6B6B6B] hover:bg-[#E5E5E5]" : "bg-[#0A0A0A] text-white"}`
    },
    isConfVenue(v) ? "확정 해제" : "확정하기"
  )), /* @__PURE__ */ React.createElement(TextInput, { value: v.img || "", onChange: (val) => patchVenue(v.id, "img", val), placeholder: "대표 사진 URL 붙여넣기 (선택)", className: "!h-8 !text-[12px]" })))), /* @__PURE__ */ React.createElement(Card, { className: "h-full flex flex-col justify-center border-dashed" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-3" }, "식장 직접 추가 · 투어 다녀온 곳, 새로 뜨는 곳을 적어 두면 리스트가 최신으로 유지돼요"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2 mb-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.name, onChange: (v) => setNewVenue({ ...newVenue, name: v }), placeholder: "식장명 *" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.area, onChange: (v) => setNewVenue({ ...newVenue, area: v }), placeholder: "지역 (예: 강남구)" }), /* @__PURE__ */ React.createElement("select", { value: newVenue.type, onChange: (e) => setNewVenue({ ...newVenue, type: e.target.value }), className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" }, ["호텔", "하우스", "채플", "컨벤션", "기타"].map((t) => /* @__PURE__ */ React.createElement("option", { key: t }, t))), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.cap, onChange: (v) => setNewVenue({ ...newVenue, cap: v }), placeholder: "수용 인원" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.meal, onChange: (v) => setNewVenue({ ...newVenue, meal: v }), placeholder: "1인 식대" }), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.fee, onChange: (v) => setNewVenue({ ...newVenue, fee: v }), placeholder: "대관료" })), /* @__PURE__ */ React.createElement(TextInput, { value: newVenue.note, onChange: (v) => setNewVenue({ ...newVenue, note: v }), placeholder: "메모", className: "mb-2.5" }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        if (!newVenue.name.trim()) return;
        setVenueList([...venueList, { id: uid(), img: "", custom: true, ...newVenue, name: newVenue.name.trim() }]);
        setNewVenue({ name: "", area: "", type: "호텔", meal: "", fee: "", cap: "", note: "" });
      },
      className: "h-11 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-1.5"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 15 }),
    " 리스트에 추가"
  ))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "기본 ", WEDDING_VENUES.length, "곳은 2025~26 후기·보도를 조사한 목록이에요(가격은 추정치, 일부는 후기 견적). 삭제·추가·사진 등록은 모두 저장되고, 부부가 함께 보는 목록에 바로 반영돼요. 견적은 투어에서 직접 확인해요."))), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(RefGallery, { cats: VENDOR_REF.venue, compact: true, title: "웨딩홀 레퍼런스", eyebrow: "모아 둔 웨딩홀 사진·상담 팁" })), /* @__PURE__ */ React.createElement(NewsPanel, { query: "웨딩홀 예식장", eyebrow: "업계 소식으로 최신화", title: "웨딩홀 뉴스" })), tab === "vendors" && seg !== "venue" && (seg !== "studio" || confirmed.studio && confirmed.studio.name) && seg !== "invite" && WEDDING_VENDORS[seg] && /* @__PURE__ */ React.createElement(WeddingVendorTab, { key: seg, ...vendorTabProps(seg) }), tab === "vendors" && seg === "invite" && /* @__PURE__ */ React.createElement(InviteStudio, { info, confirmed }), tab === "vendors" && seg === "refs" && /* @__PURE__ */ React.createElement(RefGallery, { cats: VENDOR_REF.refs, title: "참고 자료", eyebrow: "결혼 준비 팁·견적·비용 사례" }), tab === "guests" && /* @__PURE__ */ React.createElement(GuestListTab, null), tab === "honeymoon" && /* @__PURE__ */ React.createElement(React.Fragment, null, (() => {
    const first = honeymoon.find((h) => h.star);
    return first ? /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#0A0A0A] text-white px-6 py-5 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, /* @__PURE__ */ React.createElement(Icon, { name: "star", size: 20, fill: "currentColor", className: "shrink-0" }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.22em] uppercase text-white/50" }, "1순위 허니문"), /* @__PURE__ */ React.createElement("div", { className: "text-[22px] font-bold tracking-tight truncate" }, first.place))), /* @__PURE__ */ React.createElement("button", { onClick: () => starHm(first.id), className: "text-[12px] font-semibold text-white/50 hover:text-white shrink-0" }, "1순위 해제")), /* @__PURE__ */ React.createElement("div", { className: "p-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5" }, /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-1" }, "총 경비(2인 추정)"), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold tracking-tight", style: { fontVariantNumeric: "tabular-nums" } }, manWon(first.cost))), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-1" }, "항공권(왕복)"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, first.flight || "-")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-1" }, "추천 일정"), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, first.days || "-")), /* @__PURE__ */ React.createElement("div", { className: "bg-[#FAFAFA] rounded-xl px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-1" }, "추천 시기"), /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, first.season || "-"))), first.route && /* @__PURE__ */ React.createElement("div", { className: "rounded-xl bg-[#FAFAFA] px-4 py-3.5 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#6B6B6B] mb-1.5" }, "추천 경로"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed" }, first.route)), first.booking && /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-[#F0F0F0] px-4 py-3.5 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-[#6B6B6B] mb-1.5" }, "예약 타이밍 팁"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed" }, first.booking)), /* @__PURE__ */ React.createElement(HoneymoonGuide, { place: first.place }), /* @__PURE__ */ React.createElement(HoneymoonCost, { h: first, weddingDate: info.date, onPatch: (k, v) => patchHm(first.id, k, v) }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-4" }, /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${first.place} 신혼여행 후기 경비`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "실제 후기·경비 검색"), /* @__PURE__ */ React.createElement("a", { href: naverSearch(`${first.place} 허니문 패키지`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, "패키지 검색"))))) : /* @__PURE__ */ React.createElement(Card, { className: "mb-6 text-center !py-5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#6B6B6B]" }, "별표(★)를 누르면 그 여행지가 1순위로 올라오고 경로·비용·예약 팁이 크게 표시돼요."));
  })(), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, honeymoon.filter((h) => !h.star).map((h) => /* @__PURE__ */ React.createElement("section", { key: h.id }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("button", { onClick: () => starHm(h.id), title: "1순위로 설정", "aria-label": `${h.place} 1순위로 설정`, className: h.star ? "text-[#0A0A0A]" : "text-[#D4D4D4] hover:text-[#6B6B6B]" }, /* @__PURE__ */ React.createElement(Icon, { name: "star", size: 18, fill: h.star ? "currentColor" : "none" })), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold truncate" }, h.place)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold tracking-tight mr-1", style: { fontVariantNumeric: "tabular-nums" } }, manWon(h.cost)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => setHoneymoon(honeymoon.filter((x) => x.id !== h.id)) }))), /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[13px] text-[#525252]" }, /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "추천 시기"), " ", h.season || "-"), h.note && /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[13px] text-[#6B6B6B]" }, h.note), h.route && /* @__PURE__ */ React.createElement("div", { className: "mt-3 rounded-xl bg-[#FAFAFA] px-4 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B6B6B] mb-1.5" }, "추천 경로"), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#3D3D3D] leading-relaxed" }, h.route)), /* @__PURE__ */ React.createElement(HoneymoonGuide, { place: h.place }), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${h.place} 신혼여행 후기 경비`), target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 mt-3 text-[13px] font-semibold underline underline-offset-4" }, "실제 후기·경비 검색 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 }))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "직접 추가", title: "후보 추가" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2.5 mb-2.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.place, onChange: (v) => setNewPlace({ ...newPlace, place: v }), placeholder: "여행지" }), /* @__PURE__ */ React.createElement(NumInput, { value: newPlace.cost, onChange: (v) => setNewPlace({ ...newPlace, cost: v }), ariaLabel: "총 경비(만원, 2인)" }), /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.season, onChange: (v) => setNewPlace({ ...newPlace, season: v }), placeholder: "추천 시기" }), /* @__PURE__ */ React.createElement(TextInput, { value: newPlace.note, onChange: (v) => setNewPlace({ ...newPlace, note: v }), placeholder: "메모" })), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      value: newPlace.route,
      onChange: (e) => setNewPlace({ ...newPlace, route: e.target.value }),
      placeholder: "추천 경로 (선택)",
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
    " 추가하기"
  ))))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "wedding" })));
}
const KIDS_TABS = [
  { id: "plan", label: "연령별 할 일", icon: "check2" },
  { id: "infant", label: "영유아", icon: "child" },
  { id: "elementary", label: "초등", icon: "calendar" },
  { id: "secondary", label: "중·고등", icon: "building" },
  { id: "college", label: "대학·교육비", icon: "calc" },
  { id: "gift", label: "증여 플랜", icon: "piggy" },
  { id: "info", label: "정보·뉴스", icon: "search" }
];
function KidsStageTab({ stage }) {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, stage.intro, " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#737373]" }, "시기·금액은 2026년 제도 기준 리서치 — 신청 전 공식 안내를 확인하세요.")))), /* @__PURE__ */ React.createElement("div", { className: "masonry mb-6" }, stage.cards.map((e, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, e.age), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] font-semibold text-[#6B6B6B] shrink-0 mt-1" }, i + 1, "/", stage.cards.length)), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#0A0A0A] bg-[#F5F5F5] rounded-lg px-3 py-2 mb-3" }, "⏰ ", e.timing), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 mb-3 flex-1" }, e.points.map((pt, j) => /* @__PURE__ */ React.createElement("li", { key: j, className: "flex gap-2 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, pt)))), /* @__PURE__ */ React.createElement("a", { href: naverSearch(e.q), target: "_blank", rel: "noopener noreferrer", className: "mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" }, "최신 정보 검색 ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 }))))));
}
function KidsTheme() {
  const [tab, setTab] = usePersist("kids-tab-v1", "plan");
  const [checklist, setChecklist] = usePersist(
    "kids-checklist-v1",
    KIDS_CHECKLIST_DEFAULT.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ id: uid(), text: t, done: false })) }))
  );
  const [newTask, setNewTask] = useState({ gi: 0, text: "" });
  const [giftCalc, setGiftCalc] = usePersist("kids-gift-calc-v1", { amount: 2e3, adult: false, used: 0 });
  const toggleTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.map((it) => it.id === id ? { ...it, done: !it.done } : it) }));
  const removeTask = (gi, id) => setChecklist(checklist.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((it) => it.id !== id) }));
  const addTask = () => {
    if (!newTask.text.trim()) return;
    setChecklist(checklist.map((g, i) => i !== Number(newTask.gi) ? g : { ...g, items: [...g.items, { id: uid(), text: newTask.text.trim(), done: false }] }));
    setNewTask({ ...newTask, text: "" });
  };
  const taskTotal = checklist.reduce((s, g) => s + g.items.length, 0);
  const taskDone2 = checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(PhaseGauge, { themeId: "kids" }), /* @__PURE__ */ React.createElement(PillNav, { tabs: KIDS_TABS, tab, setTab }), tab === "plan" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "check2", label: "전체 진행률", value: `${taskTotal > 0 ? Math.round(taskDone2 / taskTotal * 100) : 0}%` }), /* @__PURE__ */ React.createElement(Kpi, { icon: "calendar", label: "완료한 할 일", value: `${taskDone2} / ${taskTotal}`, accent: "#525252" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "child", label: "다음 할 일", value: /* @__PURE__ */ React.createElement("span", { className: "text-[14px] leading-snug" }, (checklist.flatMap((g) => g.items).find((i) => !i.done) || { text: "모두 완료 🎉" }).text), accent: "#8A8A8A" })), /* @__PURE__ */ React.createElement(Card, { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-semibold" }, "전체 진행률"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 flex-1 max-w-[280px] ml-4" }, /* @__PURE__ */ React.createElement(ProgressBar, { ratio: taskTotal > 0 ? taskDone2 / taskTotal : 0 }), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[14px] font-bold shrink-0" }, taskDone2, "/", taskTotal))), /* @__PURE__ */ React.createElement(Card, { className: "mt-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "할 일 추가"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value: newTask.gi,
      onChange: (e) => setNewTask({ ...newTask, gi: e.target.value }),
      className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    },
    checklist.map((g, i) => /* @__PURE__ */ React.createElement("option", { key: i, value: i }, g.cat))
  ), /* @__PURE__ */ React.createElement(TextInput, { value: newTask.text, onChange: (v) => setNewTask({ ...newTask, text: v }), placeholder: "예: 산후조리원 후보 알아보기", className: "flex-1 min-w-0" }), /* @__PURE__ */ React.createElement("button", { onClick: addTask, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "추가")))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, checklist.map((g, gi) => /* @__PURE__ */ React.createElement("section", { key: gi }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 gap-2" }, /* @__PURE__ */ React.createElement("h4", { className: "font-mono text-[12px] font-semibold text-[#0A0A0A] bg-[#F0F0F0] px-2.5 py-1 rounded-full" }, g.cat), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${g.cat} 육아 준비 후기`), target: "_blank", rel: "noopener noreferrer", className: "text-[12px] font-semibold text-[#6B6B6B] underline underline-offset-4 hover:text-[#0A0A0A]" }, "실제 후기 검색")), /* @__PURE__ */ React.createElement("ul", { className: "space-y-3" }, g.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-2 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleTask(gi, it.id), className: "flex items-start gap-3 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 19, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 19, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[14px] leading-relaxed ${it.done ? "line-through text-[#737373]" : "text-[#24231E]"}` }, it.text)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => removeTask(gi, it.id), className: "!w-7 !h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" }))))))))), tab === "infant" && /* @__PURE__ */ React.createElement(KidsStageTab, { stage: KIDS_EDU_STAGES.infant }), tab === "elementary" && /* @__PURE__ */ React.createElement(KidsStageTab, { stage: KIDS_EDU_STAGES.elementary }), tab === "secondary" && /* @__PURE__ */ React.createElement(KidsStageTab, { stage: KIDS_EDU_STAGES.secondary }), tab === "college" && /* @__PURE__ */ React.createElement(KidsStageTab, { stage: KIDS_EDU_STAGES.college }), tab === "gift" && (() => {
    const limit = giftCalc.adult ? 5e3 : 2e3;
    const remaining = Math.max(0, limit - (Number(giftCalc.used) || 0));
    const taxable = Math.max(0, ((Number(giftCalc.amount) || 0) - remaining) * 1e4);
    const tax = giftTax(taxable);
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "자녀 증여는 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, "10년 단위 공제(미성년 2,000만 · 성인 5,000만)"), "를 최대한 일찍, 여러 번 쓰는 게 핵심이에요. 공제 범위 안이라도 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, "신고는 해두는 것"), "이 취득가액 입증·자금출처 대비에 유리합니다. (세부 판단은 세무사 확인 권장)"))), /* @__PURE__ */ React.createElement("div", { className: "masonry mb-6" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-3" }, "표준 증여 타임라인 — 총 1.4억 비과세"), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, [
      ["출생 직후", "2,000만", "복리 기간 극대화 — 지수·우량주로 장기 방치가 정석"],
      ["만 10세", "2,000만", "10년 경과로 공제 리셋 — 2회차 증여"],
      ["만 20세", "5,000만", "성인 공제 5,000만으로 늘어요(만 19세부터). ISA는 만 19세부터(근로소득이 있으면 15세부터) 열 수 있고, 연금저축은 나이 제한이 없어요."],
      ["만 30세", "5,000만", "결혼 시엔 혼인 증여공제 1억이 별도로 추가(출산 증여공제와 합쳐 1억 한도)"]
    ].map(([when, amt, note], i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex items-start gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] font-bold bg-[#F0F0F0] rounded-full px-2.5 py-1 shrink-0 w-20 text-center" }, when), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("b", { className: "text-[14px]" }, amt), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, note)))))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-3" }, "어디에 넣어줄까"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "미성년 주식계좌 (1순위)"), " — 증여 후 발생한 수익엔 증여세가 안 붙어요. 지수 ETF·우량주 장기 보유가 정석. 단, 부모가 잦은 매매를 하면 차명계좌·추가증여로 볼 여지가 있으니 사고 묵히기.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "청약통장"), " — 미성년 때 가입한 기간은 가점에 최대 5년, 납입은 공공 순위에 최대 60회까지 인정돼요(2024.3.25~). ", /* @__PURE__ */ React.createElement("b", null, "만 14세 무렵 가입이 효율적"), "이에요. 월 10만원 자동이체.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "연금저축"), " — 나이 제한 없음(신생아도 가입, 세액공제는 소득 필요). 미성년 증여분(10년 2,000만)·성인 증여분(5,000만)의 장기 운용처로 적합.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "ISA"), " — 만 19세 이상(15세+ 근로소득자 예외)이라 ", /* @__PURE__ */ React.createElement("b", null, "미성년기엔 개설 불가"), ". 성인 이후 절세 운용처.")))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-3" }, "주의사항"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2.5 text-[14px] text-[#3D3D3D] leading-relaxed" }, /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "신고 기한 3개월"), " — 증여일이 속한 달 말일부터 3개월 내 홈택스 신고. 공제 내라도 신고해야 이후 수익의 원본 입증이 깔끔해요.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "유기정기금 활용"), ' — "매월 ○만원씩 ○년" 약정 증여는 미래분이 할인 평가돼 같은 공제로 더 많이 넣을 수 있어요(예: 미성년 2,000만 공제로 월 18만×10년 수준).')), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "증여는 반환 불가"), " — 자녀 돈이에요. 급할 때 꺼내 쓰면 반환·재증여 문제가 생깁니다.")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "세대생략 할증"), " — 조부모→손주 증여는 산출세액의 30% 할증(미성년+20억 초과분 40%).")), /* @__PURE__ */ React.createElement("li", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 15, className: "mt-0.5 shrink-0 text-[#6B6B6B]" }), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "교육비·용돈과 구분"), " — 통상적인 부양·교육비는 증여가 아니지만, 저축·투자로 쌓이면 증여로 봅니다.")))), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold mb-1" }, "자녀 증여세 계산기"), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#6B6B6B] mb-4" }, "직계존속 → 자녀 기준 (10년 합산)"), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-3 mb-4" }, /* @__PURE__ */ React.createElement(Field, { label: "증여액(만원)", value: giftCalc.amount, onChange: (v) => setGiftCalc({ ...giftCalc, amount: v }), step: 500 }), /* @__PURE__ */ React.createElement(Field, { label: "10년 내 기증여(만원)", value: giftCalc.used, onChange: (v) => setGiftCalc({ ...giftCalc, used: v }), step: 500 }), /* @__PURE__ */ React.createElement(Toggle, { label: "자녀 나이", active: !giftCalc.adult, onClick: () => setGiftCalc({ ...giftCalc, adult: !giftCalc.adult }), activeText: "미성년 (2천만)", inactiveText: "성인 (5천만)" })), /* @__PURE__ */ React.createElement("div", { className: "divide-y divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement(Stat, { label: "잔여 공제", value: won(remaining * 1e4) }), /* @__PURE__ */ React.createElement(Stat, { label: "공제 초과 과세대상", value: won(taxable) }), /* @__PURE__ */ React.createElement(Stat, { label: "예상 증여세 (기한 내 신고 3% 공제 후)", value: tax > 0 ? won(tax) : "0원 · 비과세 범위", tone: tax > 0 ? "warn" : "good" })))));
  })(), tab === "info" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "학군", title: "학군지 정보" }), /* @__PURE__ */ React.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#525252] leading-relaxed" }, "과천 거주 기준으로 현실적인 학군지 후보를 정리했어요. ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]" }, "학군지 이사는 내 집 마련 입주 시점과 묶어서"), " 판단하는 게 비용 면에서 유리합니다.")), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, SCHOOL_DISTRICTS.map((d, i) => /* @__PURE__ */ React.createElement(Card, { key: i, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-3 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, d.area), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1 flex-wrap justify-end" }, d.tags.map((t) => /* @__PURE__ */ React.createElement(ToneBadge, { key: t, tone: t === "거주 예정지" ? "good" : "neutral" }, t)))), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#3D3D3D] leading-relaxed mb-3 flex-1" }, d.note), /* @__PURE__ */ React.createElement("div", { className: "mt-auto flex gap-3" }, /* @__PURE__ */ React.createElement("a", { href: naverSearch(d.q), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold underline underline-offset-4" }, "학군 검색"), /* @__PURE__ */ React.createElement("a", { href: naverBlog(`${d.area} 학군 이사 후기`), target: "_blank", rel: "noopener noreferrer", className: "text-[13px] font-semibold text-[#6B6B6B] underline underline-offset-4" }, "이사 후기"))))), /* @__PURE__ */ React.createElement("div", { className: "mt-3" }, /* @__PURE__ */ React.createElement(InfoNote, null, "학군 정보는 2026년 리서치 기준 참고용이에요. 실제 배정·학원가 상황은 시기별로 달라지니 이사 결정 전 현장 확인을 권장합니다."))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(NewsPanel, { query: "출산 육아 지원 정책", eyebrow: "놓치는 지원 없게", title: "출산·육아 정책 뉴스" }), /* @__PURE__ */ React.createElement(NewsPanel, { query: "학군 교육 정책", eyebrow: "교육 동향", title: "학군·교육 뉴스" }))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "kids" })));
}
function weddingMoney(alloc, budget) {
  const a = alloc || store.get("home-alloc-v1", ALLOC_DEFAULT);
  const list = budget || store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const total = list.reduce((s, b) => s + (Number(b.budget) || 0), 0);
  const paid = list.reduce((s, b) => s + (b.paid ? Number(b.budget) || 0 : Math.min(Number(b.budget) || 0, Number(b.paidAmt) || 0)), 0);
  const allocW = Number(a.wedding) || 0;
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
    alloc: allocW,
    over: allocW > 0 && total > allocW,
    reserve: Math.max(0, Math.max(allocW, total) - paid)
  };
}
function lockedPensionMan() {
  return store.get("saving-accounts-v1", ACCOUNTS_DEFAULT).filter((a) => a.type === "연금저축" || a.type === "IRP").reduce((s, a) => s + (Number(a.balance) || 0), 0);
}
function realtyEquityMan(s) {
  if (s && s.fundPriority === "realty") return Math.max(0, (Number(s.assets) || 0) - lockedPensionMan());
  return Math.max(0, (Number(s && s.assets) || 0) - weddingMoney().reserve - lockedPensionMan());
}
const isSavingEntry = (e) => e.type !== "in" && e.cat === "save";
const isExpenseEntry = (e) => e.type !== "in" && e.cat !== "save";
function ledgerMonth(entries, key) {
  const es = entries.filter((e) => (e.date || "").startsWith(key));
  const sum = (f) => es.filter(f).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const inc = sum((e) => e.type === "in"), exp = sum(isExpenseEntry), save = sum(isSavingEntry);
  return { inc, exp, save, net: inc - exp, n: es.length };
}
function ledgerStats(entries) {
  const list = entries || store.get("ledger-entries-v1", []);
  const now = /* @__PURE__ */ new Date();
  const cur = ledgerMonth(list, ymKey(now));
  const past = [1, 2, 3].map((i) => ledgerMonth(list, ymKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))).filter((m) => m.n > 0);
  const avgNet = past.length ? past.reduce((s, m) => s + m.net, 0) / past.length : null;
  return { cur, saveRate: cur.inc > 0 && cur.exp > 0 ? cur.net / cur.inc : null, avgNetMan: avgNet == null ? null : Math.round(avgNet / 1e4), months: past.length };
}
const DERIVED_KEYS = [POLICY_OVERRIDES_KEY, "policy-dismissed-v1", "home-alloc-v1", "wedding-budget-v1", "ledger-entries-v1", "saving-accounts-v1", "wedding-info-v1", "wedding-checklist-v2", "kids-checklist-v1", "milestones-v1", "roadmap-v2", "plan-timeline-done-v2"];
function useStoreTick(keys) {
  const [, setT] = useState(0);
  useEffect(() => {
    const h = (e) => {
      if (keys.includes(e.detail)) setT((t) => t + 1);
    };
    window.addEventListener(REMOTE_EVT, h);
    return () => window.removeEventListener(REMOTE_EVT, h);
  }, [keys.join("|")]);
}
function etaText(months) {
  if (months === 0) return "지금 가능";
  if (!months) return "—";
  const now = /* @__PURE__ */ new Date(), dt = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`;
}
function targetShort(t) {
  const area = (t.label.match(/(\d+(?:\.\d+)?)\s*㎡/) || [])[1];
  return `${t.dealType}${area ? ` ${pyeongText(area)}` : ""} · ${wonShort(t.price)}${t.rent > 0 ? ` / 월 ${won(t.rent)}` : ""}`;
}
const GO_THEME_EVT = "planner-go-theme";
let homeEditRequested = false;
function goTheme(id, tabs = {}, opts = {}) {
  Object.entries(tabs).forEach(([k, v]) => {
    store.set(k, v);
    notifyRemoteKey(k);
  });
  if (opts.edit) homeEditRequested = true;
  try {
    window.dispatchEvent(new CustomEvent(GO_THEME_EVT, { detail: id }));
  } catch {
  }
}
const goHomeEdit = () => goTheme("home", {}, { edit: true });
function LinkedBar({ items, note, noteWarn, actions = [] }) {
  if (!noteWarn) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "mb-5 rounded-2xl bg-[#FFF7E6] border border-[#F3DDB0] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#8A5A00] leading-relaxed min-w-0 flex-1" }, "⚠️ ", note), actions.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "flex flex-wrap gap-x-3 gap-y-1" }, actions.map((a) => /* @__PURE__ */ React.createElement("button", { key: a.label, onClick: a.onClick, className: "text-[12px] font-semibold text-[#6B4A00] underline underline-offset-4" }, a.label))));
}
function saveMismatch(inputMan, actualMan) {
  if (actualMan == null || !(inputMan > 0)) return null;
  const diff = (actualMan - inputMan) / inputMan;
  return Math.abs(diff) > 0.2 ? diff : null;
}
function RealtyLinkedBar({ diag, hh, privacy }) {
  const mm = saveMismatch(hh.monthlySave, diag.actualSave);
  return /* @__PURE__ */ React.createElement(
    LinkedBar,
    {
      items: [
        { label: "부부 현금", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(hh.assets)) },
        diag.wedding.reserve > 0 && { label: "− 결혼 비용", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(diag.wedding.reserve)) },
        lockedPensionMan() > 0 && { label: "− 연금저축·IRP", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(lockedPensionMan())) },
        { label: "= 자기자본", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonShort(diag.equity)) },
        { label: "월 저축 입력", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(hh.monthlySave)) },
        { label: "가계부 실적", value: diag.actualSave == null ? "기록 없음" : /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(diag.actualSave)), warn: mm != null && mm < 0 }
      ],
      note: mm != null ? `가계부 실적이 입력한 월 저축보다 ${Math.round(Math.abs(mm) * 100)}% ${mm < 0 ? "적어요. 목표 달성 시점이 실제보다 이르게 계산되고 있을 수 있어요." : "많아요. 월 저축 입력값을 올려도 돼요."}` : "결혼식에 앞으로 나갈 비용은 자기자본에서 미리 빼고 계산해요.",
      noteWarn: mm != null && mm < 0,
      actions: [{ label: "현금·월 저축 수정", onClick: goHomeEdit }, { label: "결혼 예산", onClick: () => goTheme("wedding", { "wedding-tab-v1": "budget" }) }, { label: "가계부", onClick: () => goTheme("ledger") }]
    }
  );
}
function WeddingLinkedBar({ money, privacy, setTab }) {
  return /* @__PURE__ */ React.createElement(
    LinkedBar,
    {
      items: [
        { label: "홈 결혼 배정", value: money.alloc > 0 ? /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(money.alloc)) : "미배정" },
        { label: "예산 총액", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(money.total)), warn: money.over },
        { label: "지불 완료", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(money.paid)) },
        { label: "부동산 자기자본에서 차감", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(money.reserve)) }
      ],
      note: money.over ? `예산이 홈 배정보다 ${manWon(money.total - money.alloc)} 많아요. 홈 배정을 늘리거나 예산을 줄여 보세요.` : "예산표 금액과 홈 배정 중 큰 값에서 지불 완료분을 뺀 만큼을 부동산 자기자본에서 미리 빼요.",
      noteWarn: money.over,
      actions: [{ label: "예산표", onClick: () => setTab("budget") }, { label: "홈 배정 수정", onClick: goHomeEdit }, { label: "부동산 진단", onClick: () => goTheme("realty", { "realty-tab-v1": "diag", "realty-diag-seg-v1": "diag" }) }]
    }
  );
}
function SavingLinkedBar({ hh, totalBalance, privacy }) {
  const alloc = store.get("home-alloc-v1", ALLOC_DEFAULT);
  const actual = ledgerStats().avgNetMan;
  const mm = saveMismatch(hh.monthlySave, actual);
  const spare = Math.max(0, (Number(alloc.totalCash) || 0) - (Number(alloc.realty) || 0) - (Number(alloc.wedding) || 0) - (Number(alloc.kids) || 0));
  const gapAlloc = spare - totalBalance;
  return /* @__PURE__ */ React.createElement(
    LinkedBar,
    {
      items: [
        { label: "남는 현금", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(spare)) },
        { label: "계좌 잔액", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(totalBalance)) },
        { label: "월 저축 입력", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(hh.monthlySave)) },
        { label: "가계부 실적", value: actual == null ? "기록 없음" : /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(actual)), warn: mm != null && mm < 0 }
      ],
      note: spare > 0 ? gapAlloc > 0 ? `부동산·결혼에 배정하고 남는 현금 중 ${manWon(gapAlloc)}이 아직 계좌에 기입되지 않았어요.` : "남는 현금이 계좌에 모두 기입돼 있어요." : "홈에서 부동산·결혼에 배정하고 남는 현금이 돈 모으기 몫이에요.",
      actions: [{ label: "홈 배정·월 저축 수정", onClick: goHomeEdit }, { label: "가계부", onClick: () => goTheme("ledger") }]
    }
  );
}
function LedgerLinkedBar({ hh, privacy, monthSave }) {
  const st = ledgerStats();
  const diag = computeDiagnosis(hh);
  const months = diag.monthsToGoalActual;
  return /* @__PURE__ */ React.createElement(
    LinkedBar,
    {
      items: [
        { label: "지난 3개월 평균 수지", value: st.avgNetMan == null ? "기록 없음" : /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(st.avgNetMan)) },
        { label: "홈 월 저축 입력", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(hh.monthlySave)) },
        monthSave > 0 && { label: "이번 달 저축·이체", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(monthSave)) },
        { label: "집 살 때 모자란 현금", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, diag.gap > 0 ? wonShort(diag.gap) : "없음") }
      ],
      note: diag.gap <= 0 ? "목표 집에 필요한 현금은 이미 모였어요." : st.avgNetMan == null ? "지난달 기록이 쌓이면 이 속도로 부동산 목표를 언제 채우는지 계산해 드려요." : months ? `지금 수지(수입 − 지출) 속도면 집 살 때 모자란 현금을 ${etaText(months)}에 채워요(${months}개월 뒤).` : "지난 3개월 평균 수지(수입 − 지출)가 0 이하라 집 살 때 모자란 현금을 채우지 못해요.",
      noteWarn: diag.gap > 0 && st.avgNetMan != null && !months,
      actions: [{ label: "부동산 진단", onClick: () => goTheme("realty", { "realty-tab-v1": "diag", "realty-diag-seg-v1": "diag" }) }, { label: "월 저축 수정", onClick: goHomeEdit }]
    }
  );
}
const monthsSince = (ym) => {
  const m = /^(\d{4})-(\d{2})/.exec(ym || "");
  if (!m) return null;
  const now = /* @__PURE__ */ new Date();
  return (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]);
};
const subPeriodScore = (mo) => mo == null || mo < 0 ? 0 : mo < 6 ? 1 : mo < 12 ? 2 : Math.min(17, Math.floor(mo / 12) + 2);
function SubscriptionAccountsCard({ hh, privacy }) {
  const SUB_DEPOSIT_85_MAN = policy().subscription.deposit85Man;
  const accounts = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT).filter((a) => a.type === "청약통장");
  const addBoth = () => {
    const all = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT);
    setKey("saving-accounts-v1", [...all, ...[hh.label1 || "본인", hh.label2 || "배우자"].map((owner) => ({ id: uid(), at: Date.now(), owner, type: "청약통장", balance: 0, paid: 0, goal: 0, since: "", count: 0 }))]);
  };
  const goTracker = () => goTheme("saving", { "saving-tab-v1": "accounts" });
  if (!accounts.length) return /* @__PURE__ */ React.createElement(Card, { className: "mb-5 !py-4 flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, "🔗 우리 청약통장"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B]" }, "청약통장을 등록하면 1순위 요건(세대주·2년·예치금, 공공은 24회)과 가입기간 가점을 여기서 바로 계산해요.")), /* @__PURE__ */ React.createElement("button", { onClick: addBoth, className: "h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0" }, "부부 청약통장 추가"));
  const rows = accounts.map((a) => {
    const mo = monthsSince(a.since);
    const cnt = Number(a.count) || 0, bal = Number(a.balance) || 0;
    return { ...a, mo, cnt, bal, first: mo != null && mo >= 24, depositOk: bal >= SUB_DEPOSIT_85_MAN, score: subPeriodScore(mo) };
  });
  const main = rows.reduce((b, r) => r.score > (b ? b.score : -1) ? r : b, null);
  const spouseBonus = rows.filter((r) => r !== main).reduce((m, r) => Math.max(m, Math.min(3, Math.floor(r.score / 2))), 0);
  const total = Math.min(17, (main ? main.score : 0) + spouseBonus);
  return /* @__PURE__ */ React.createElement(Card, { className: "mb-5" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, "🔗 우리 청약통장 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[12px] text-[#6B6B6B]" }, "· 돈 모으기 › 내 계좌·절세와 연동")), /* @__PURE__ */ React.createElement("button", { onClick: goTracker, className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4 shrink-0" }, "통장 정보 수정")), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-2" }, rows.map((r) => /* @__PURE__ */ React.createElement("div", { key: r.id, className: "rounded-xl bg-[#FAFAFA] px-3.5 py-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-bold" }, r.owner), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-bold px-2 py-0.5 rounded-full ${r.first && r.depositOk ? "bg-[#1F5D46] text-white" : "bg-[#F0F0F0] text-[#6B6B6B]"}` }, r.first && r.depositOk ? "민영 1순위 요건 충족(세대주일 때)" : r.mo == null ? "가입 연월을 입력해 주세요" : "1순위 요건 부족")), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] leading-relaxed", style: { fontVariantNumeric: "tabular-nums" } }, "가입 ", r.mo == null ? "—" : `${Math.floor(r.mo / 12)}년 ${r.mo % 12}개월`, " ", r.mo != null && (r.mo >= 24 ? "✓" : "✕"), " · 납입 ", r.cnt, "회 ", r.cnt >= 24 ? "✓" : "(공공 1순위는 24회 필요)", " · 잔액 ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, manWon(r.bal)), " ", r.depositOk ? "✓" : "✕"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mt-0.5" }, "가입기간 가점 ", r.score, "점")))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-[12px] text-[#525252] leading-relaxed" }, "가점제 통장 가입기간 점수 ", /* @__PURE__ */ React.createElement("b", null, total, "점"), "(최대 17점) ", spouseBonus > 0 && /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "(", main.owner, " ", main.score, "점 + 배우자 통장 기간 50% 합산 ", spouseBonus, "점)"), ". 과천(투기과열지구) 1순위는 ", /* @__PURE__ */ React.createElement("b", null, "세대주만"), " 되고, 가입 2년 이상과 예치금(85㎡ 이하 ", manWon(SUB_DEPOSIT_85_MAN), ")이 필요해요. 공공은 24회 이상 납입해야 해요. 세대원인 배우자는 2순위라, 통장 기간이 긴 쪽을 세대주로 해요. 무주택기간·부양가족 점수는 공고 기준으로 따로 계산돼요."));
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
  return { total, done, next: next || "모두 완료" };
}
function summarizeWedding() {
  const info = store.get("wedding-info-v1", { date: "", venue: "" });
  const budget = store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
  const checklist = store.get("wedding-checklist-v2", null);
  const taskTotal = checklist ? checklist.reduce((s, g) => s + g.items.length, 0) : WEDDING_CHECKLIST_DEFAULT.reduce((s, g) => s + g.items.length, 0);
  const taskDone2 = checklist ? checklist.reduce((s, g) => s + g.items.filter((i) => i.done).length, 0) : 0;
  return {
    date: info.date,
    venue: info.venue,
    d: dday(info.date),
    totalBudget: budget.reduce((s, b) => s + (b.budget || 0), 0),
    itemCount: budget.length,
    taskTotal,
    taskDone: taskDone2
  };
}
const ROADMAP_DEFAULT = [
  { title: "결혼", themeId: "wedding", start: "2026-07-01", end: "2027-10-31", items: ["상견례·예식 시기 합의", "웨딩홀 투어·가계약", "스드메·본식 스냅 계약", "청첩장·모임", "결혼식", "신혼여행", "혼인신고 (대출 유불리 검토 후)"] },
  { title: "내 집 마련", themeId: "realty", start: "2027-01-01", end: "2030-12-31", items: ["첫 전세 계약 (과천 59㎡ 기준)", "청약 상시 도전 (과천 신규 공급)", "자금 축적 (ISA·절세계좌)", "매매 또는 청약 당첨", "입주·대출 상환계획 확정"] },
  { title: "자녀 계획", themeId: "kids", start: "2028-01-01", end: "2032-12-31", items: ["자녀 계획 부부 합의", "신생아 특공·특례대출 요건 확인", "임신·출산", "출산·육아 지원 정책 신청", "어린이집 입소 대기 등록"] }
];
const roadmapInit = () => ROADMAP_DEFAULT.map((p) => ({ id: uid(), ...p, items: p.items.map((t) => ({ id: uid(), text: t, done: false })) }));
function phaseCalc(p) {
  const total = p.items.length;
  const done = p.items.filter((it) => it.done).length;
  const now = Date.now();
  const st = p.start ? (/* @__PURE__ */ new Date(p.start + "T00:00:00")).getTime() : null;
  const en = p.end ? (/* @__PURE__ */ new Date(p.end + "T23:59:59")).getTime() : null;
  const timeR = st && en && en > st ? Math.max(0, Math.min(1, (now - st) / (en - st))) : null;
  const doneR = total ? done / total : 0;
  const status = st && now < st ? "next" : en && now > en ? "past" : "now";
  const behind = timeR != null && doneR < timeR - 0.08;
  return { total, done, timeR, doneR, status, behind };
}
function GaugeBar({ doneR, timeR, height = 12 }) {
  return /* @__PURE__ */ React.createElement("div", { className: "relative rounded-full bg-[#ECECEC]", style: { height } }, /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#0A0A0A] transition-all", style: { width: `${Math.round(doneR * 100)}%` } }), timeR != null && /* @__PURE__ */ React.createElement("div", { className: "absolute w-[2px] bg-[#0A0A0A]", style: { left: `calc(${Math.round(timeR * 100)}% - 1px)`, top: -4, bottom: -4 } }, /* @__PURE__ */ React.createElement("span", { className: "absolute -top-[15px] left-1/2 -translate-x-1/2 font-mono text-[9px] font-semibold text-[#6B6B6B] whitespace-nowrap" }, "오늘")));
}
function PhaseGaugeRow({ p, readonly, onToggleNext, children }) {
  const { total, done, timeR, doneR, status, behind } = phaseCalc(p);
  const next = p.items.find((it) => !it.done);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 mb-1 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] font-bold truncate" }, p.title), status === "now" && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-white bg-[#0A0A0A] px-2 py-0.5 rounded-full shrink-0" }, "진행 중"), status === "next" && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-semibold text-[#6B6B6B] shrink-0" }, "예정"), status === "past" && /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-semibold text-[#6B6B6B] shrink-0" }, doneR >= 1 ? "완료" : "기간 지남")), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B] shrink-0" }, p.start || "미정", " ~ ", p.end || "미정", " · ", done, "/", total)), /* @__PURE__ */ React.createElement("div", { className: "pt-4" }, /* @__PURE__ */ React.createElement(GaugeBar, { doneR, timeR })), /* @__PURE__ */ React.createElement("div", { className: "mt-2 flex items-start justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#525252] min-w-0" }, next ? /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, !readonly && onToggleNext && /* @__PURE__ */ React.createElement("button", { onClick: onToggleNext, title: "완료 처리", className: "shrink-0 text-[#C9C9C9] hover:text-[#0A0A0A]" }, /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 14 })), "지금 할 일: ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A] truncate" }, next.text)) : /* @__PURE__ */ React.createElement("span", null, "이 단계 할 일을 모두 끝냈어요 🎉")), /* @__PURE__ */ React.createElement("span", { className: `text-[11px] font-semibold shrink-0 ${behind ? "text-[#0A0A0A] underline underline-offset-2" : "text-[#6B6B6B]"}` }, timeR != null ? `기간 ${Math.round(timeR * 100)}% 지남 · ` : "", "할 일 ", Math.round(doneR * 100), "% 완료", status === "now" ? behind ? ". 일정보다 늦어요" : ". 일정대로 가고 있어요" : "")), children);
}
function Roadmap({ phases, setPhases }) {
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [showDone, setShowDone] = useState(false);
  const scrollRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const isDone = (p) => p.items.length > 0 && p.items.every((it) => it.done);
  const visible = showDone ? phases : phases.filter((p) => !isDone(p));
  const hiddenCount = phases.filter(isDone).length;
  const stepOf = (el) => el.firstElementChild && el.firstElementChild.offsetWidth || el.clientWidth;
  const perView = (el) => Math.max(1, Math.round(el.clientWidth / stepOf(el)));
  const scrollTo = (i) => {
    const el = scrollRef.current;
    if (!el) return;
    const n = Math.max(0, Math.min(visible.length - perView(el), i));
    el.scrollTo({ left: n * stepOf(el), behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setIdx(Math.round(el.scrollLeft / stepOf(el)));
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cur = visible.findIndex((p) => phaseCalc(p).status === "now" && p.items.some((it) => !it.done));
    if (cur > 0) {
      el.scrollTo({ left: cur * stepOf(el) });
      setIdx(cur);
    }
  }, []);
  const patchPhase = (id, k, v) => setPhases(phases.map((p) => p.id === id ? { ...p, [k]: v } : p));
  const toggleItem = (pid, iid) => {
    const ph = phases.find((x) => x.id === pid), cur = ph && ph.items.find((i) => i.id === iid);
    setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: p.items.map((it) => it.id === iid ? { ...it, done: !it.done } : it) }));
    if (ph && cur && ph.themeId) propagateTask(["roadmap", ph.themeId, cur.text], !cur.done);
  };
  const removeItem = (pid, iid) => setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: p.items.filter((it) => it.id !== iid) }));
  const addItem = (pid) => {
    const text = (drafts[pid] || "").trim();
    if (!text) return;
    setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: [...p.items, { id: uid(), text, done: false }] }));
    setDrafts({ ...drafts, [pid]: "" });
  };
  const addPhase = () => {
    const id = uid();
    setPhases([...phases, { id, title: "새 단계", start: "", end: "", items: [] }]);
    setOpenId(id);
    setTimeout(() => {
      const el = scrollRef.current;
      if (el) {
        el.scrollTo({ left: visible.length * stepOf(el), behavior: "smooth" });
        setIdx(visible.length);
      }
    }, 50);
  };
  return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 mb-4" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "큰 흐름", title: "전체 로드맵" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4 flex items-center gap-1.5 shrink-0" }, hiddenCount > 0 && /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => {
        setShowDone(!showDone);
        setIdx(0);
        if (scrollRef.current) scrollRef.current.scrollTo({ left: 0 });
      },
      className: "h-8 px-3 rounded-full bg-white shadow-sm text-[12px] font-semibold text-[#6B6B6B] hover:text-[#0A0A0A]"
    },
    showDone ? "완료 숨기기" : `완료 ${hiddenCount}개 보기`
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => scrollTo(idx - 1),
      disabled: idx <= 0,
      "aria-label": "이전 단계",
      className: "w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] disabled:opacity-30"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 14, className: "rotate-180" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => scrollTo(idx + 1),
      disabled: idx >= visible.length - (scrollRef.current ? perView(scrollRef.current) : 1),
      "aria-label": "다음 단계",
      className: "w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] disabled:opacity-30"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 14 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: addPhase,
      title: "단계 추가",
      className: "w-8 h-8 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center hover:opacity-80"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 14 })
  ))), visible.length === 0 && /* @__PURE__ */ React.createElement(Card, { className: "text-center !py-8" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#6B6B6B]" }, '모든 단계를 완료했어요 🎉 "완료 ', hiddenCount, '개 보기"로 지난 단계를 볼 수 있어요.')), /* @__PURE__ */ React.createElement("div", { ref: scrollRef, onScroll, className: "flex overflow-x-auto snap-x snap-mandatory no-scrollbar" }, visible.map((p) => {
    const phaseNo = phases.findIndex((x) => x.id === p.id) + 1;
    return /* @__PURE__ */ React.createElement("div", { key: p.id, className: `w-full shrink-0 snap-start min-w-0 ${visible.length > 1 ? "lg:w-1/2 lg:pr-3" : ""}` }, /* @__PURE__ */ React.createElement(Card, { className: "!py-4" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#6B6B6B] mt-1 shrink-0 w-14" }, phaseNo, "단계"), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement(PhaseGaugeRow, { p, onToggleNext: () => {
      const n = p.items.find((it) => !it.done);
      if (n) toggleItem(p.id, n.id);
    } })), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setOpenId(openId === p.id ? null : p.id),
        title: "자세히·편집",
        className: `shrink-0 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors ${openId === p.id ? "bg-[#0A0A0A] text-white" : "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"}`
      },
      openId === p.id ? "닫기" : "편집"
    )), openId === p.id && /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#F0F0F0] lg:pl-16" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4" }, /* @__PURE__ */ React.createElement("div", { className: "col-span-2" }, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "단계 이름"), /* @__PURE__ */ React.createElement(TextInput, { value: p.title, onChange: (v) => patchPhase(p.id, "title", v) })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "시작일"), /* @__PURE__ */ React.createElement("input", { type: "date", "aria-label": "시작일", value: p.start || "", onChange: (e) => patchPhase(p.id, "start", e.target.value), className: "w-full h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { className: "text-[11px] text-[#6B6B6B] block mb-1" }, "목표일"), /* @__PURE__ */ React.createElement("input", { type: "date", "aria-label": "목표일", value: p.end || "", onChange: (e) => patchPhase(p.id, "end", e.target.value), className: "w-full h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]" }))), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2 mb-3" }, p.items.map((it) => /* @__PURE__ */ React.createElement("li", { key: it.id, className: "flex items-start gap-1.5 group" }, /* @__PURE__ */ React.createElement("button", { onClick: () => toggleItem(p.id, it.id), className: "flex items-start gap-2 text-left flex-1" }, it.done ? /* @__PURE__ */ React.createElement(Icon, { name: "check2", size: 16, className: "mt-0.5 shrink-0 text-[#0A0A0A]" }) : /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 16, className: "mt-0.5 shrink-0 text-[#C9C9C9]" }), /* @__PURE__ */ React.createElement("span", { className: `text-[13px] leading-relaxed ${it.done ? "line-through text-[#737373]" : "text-[#3D3D3D]"}` }, it.text)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => removeItem(p.id, it.id), className: "!w-6 !h-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" })))), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5" }, /* @__PURE__ */ React.createElement(TextInput, { value: drafts[p.id] || "", onChange: (v) => setDrafts({ ...drafts, [p.id]: v }), placeholder: "항목 추가", className: "flex-1 min-w-0 !h-9 !text-[13px]" }), /* @__PURE__ */ React.createElement("button", { onClick: () => addItem(p.id), className: "h-9 px-3 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0" }, "추가"), /* @__PURE__ */ React.createElement("button", { onClick: () => window.confirm(`"${p.title}" 단계를 삭제할까요?`) && setPhases(phases.filter((x) => x.id !== p.id)), className: "h-9 px-3 rounded-lg border border-[#E5E5E5] text-[13px] font-semibold text-[#6B6B6B] hover:text-[#0A0A0A] shrink-0" }, "단계 삭제")))));
  })), visible.length > 1 && /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-center mt-1" }, visible.map((p, i) => /* @__PURE__ */ React.createElement("button", { key: p.id, onClick: () => scrollTo(i), title: p.title, "aria-label": `${i + 1}단계 · ${p.title}`, className: "group py-2.5 px-1" }, /* @__PURE__ */ React.createElement("span", { className: `block h-1.5 rounded-full transition-[width,background-color] ${i === idx ? "w-6 bg-[#0A0A0A]" : "w-1.5 bg-[#C9C9C9] group-hover:bg-[#8A8A8A]"}` })))));
}
function PhaseGauge({ themeId }) {
  const [phases] = usePersist("roadmap-v2", roadmapInit());
  const p = phases.find((x) => x.themeId === themeId);
  if (!p) return null;
  return /* @__PURE__ */ React.createElement(Card, { className: "hidden lg:block mb-6 !py-4" }, /* @__PURE__ */ React.createElement(PhaseGaugeRow, { p, readonly: true }));
}
function HomeTheme({ setTheme, hh, setHh, privacy }) {
  const [alloc, setAlloc] = usePersist("home-alloc-v1", ALLOC_DEFAULT);
  const [milestones, setMilestones] = usePersist("milestones-v1", MILESTONES_DEFAULT);
  const [phases, setPhases] = usePersist("roadmap-v2", roadmapInit());
  const [planDone] = useTimelineDone();
  const [newMs, setNewMs] = useState({ label: "", date: "" });
  const [editOpen, setEditOpen] = useState(() => {
    const r = homeEditRequested;
    homeEditRequested = false;
    return r;
  });
  const editRef = useRef(null);
  const openEdit = () => {
    setEditOpen(true);
    setTimeout(() => editRef.current && editRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };
  useEffect(() => {
    if (editOpen) setTimeout(() => editRef.current && editRef.current.scrollIntoView({ block: "start" }), 60);
  }, []);
  const realty = computeDiagnosis(hh);
  const saving = summarizeSaving();
  const wedding = summarizeWedding();
  const kids = summarizeKids();
  const money = realty.wedding;
  const ledger = ledgerStats();
  const { cash1, cash2 } = allocCash(alloc);
  const setCash = (patch) => {
    const next = { cash1, cash2, ...patch };
    const total = next.cash1 + next.cash2;
    setAlloc({ ...alloc, ...next, totalCash: total });
    setHh({ assets: total });
  };
  useEffect(() => {
    if (hh.assets !== alloc.totalCash) setHh({ assets: alloc.totalCash });
  }, [alloc.totalCash, hh.assets]);
  const allocated = alloc.realty + alloc.wedding + (alloc.kids || 0);
  const free = alloc.totalCash - allocated;
  const over = free < 0;
  const pct = (v) => alloc.totalCash > 0 ? Math.round(v / alloc.totalCash * 100) : 0;
  const segs = THEMES.filter((t) => t.id !== "saving" && (!t.hidden || alloc[t.id] > 0)).map((t) => ({ id: t.id, label: t.label, value: alloc[t.id] || 0, color: t.color }));
  const toggleRoadmapNext = (pid) => {
    const ph = phases.find((p) => p.id === pid), n = ph && ph.items.find((it) => !it.done);
    if (!n) return;
    setPhases(phases.map((p) => p.id !== pid ? p : { ...p, items: p.items.map((it) => it.id === n.id ? { ...it, done: true } : it) }));
    if (ph.themeId) propagateTask(["roadmap", ph.themeId, n.text], true);
  };
  const actions = [];
  phases.filter((p) => p.themeId !== "kids" && phaseCalc(p).status === "now").forEach((p) => {
    const n = p.items.find((it) => !it.done);
    if (n) actions.push({ key: "rm-" + p.id, ref: p.themeId ? ["roadmap", p.themeId, n.text] : null, text: n.text, src: `로드맵 · ${p.title}`, onDone: () => toggleRoadmapNext(p.id), go: () => setTheme(p.themeId || "home") });
  });
  const wChecklist = store.get("wedding-checklist-v2", null) || WEDDING_CHECKLIST_DEFAULT.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ text: t, done: false })) }));
  const wNext = wChecklist.flatMap((g) => g.items.map((it) => ({ ...it, cat: g.cat }))).find((it) => !it.done);
  if (wNext) actions.push({ key: "wc", ref: ["wedding", wNext.text], text: wNext.text, src: `결혼 체크리스트 · ${wNext.cat}`, go: () => goTheme("wedding", { "wedding-tab-v1": "checklist" }) });
  const pNext = timelineFlat().find((x) => !planDone[x.key]);
  if (pNext) actions.push({ key: "rp", ref: ["plan", pNext.phase, pNext.text], text: pNext.text, src: `부동산 플랜 · ${pNext.phase}`, go: () => goTheme("realty", { "realty-tab-v1": "plan" }) });
  const seenText = /* @__PURE__ */ new Set();
  const todo = actions.filter((a) => {
    const g = a.ref ? taskGroupOf(a.ref) : -1;
    const k = g >= 0 ? `g${g}` : a.text;
    return !seenText.has(k) && seenText.add(k);
  }).slice(0, 4);
  const mm = saveMismatch(hh.monthlySave, realty.actualSave);
  const alerts = [
    over && { text: `자금 배분이 총 현금보다 ${manWon(-free)} 많아요`, go: openEdit },
    money.over && { text: `결혼 예산(${manWon(money.total)})이 홈 배정보다 ${manWon(money.total - money.alloc)} 많아요`, go: () => goTheme("wedding", { "wedding-tab-v1": "budget" }) },
    wedding.d !== null && wedding.d >= 0 && wedding.d <= 60 && money.remaining > 0 && { text: `결혼식까지 ${ddayText(wedding.d)}, 아직 안 낸 돈이 ${manWon(money.remaining)} 있어요`, go: () => goTheme("wedding", { "wedding-tab-v1": "budget" }) },
    mm != null && mm < 0 && { text: `가계부 실적(월 ${manWon(realty.actualSave)})이 입력한 월 저축(${manWon(hh.monthlySave)})보다 ${Math.round(-mm * 100)}% 적어요. 목표 달성 시점이 실제보다 이르게 잡혔을 수 있어요`, go: () => goTheme("ledger") }
  ].filter(Boolean);
  const brief = store.get("advisor-brief-v1", {});
  const briefLine = brief.date === todayYmd() && brief.text ? String(brief.text).split("\n").map((l) => l.replace(/^[-*•\s]+/, "").replace(/\*\*/g, "")).find((l) => l.trim()) : "";
  const allMs = [
    ...wedding.date ? [{ id: "__wedding", label: `결혼식${wedding.venue ? " · " + wedding.venue : ""}`, date: wedding.date, fixed: true, strong: true }] : [],
    ...milestones
  ].sort((a, b) => {
    const pa = (dday(a.date) ?? 0) < 0, pb = (dday(b.date) ?? 0) < 0;
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? (b.date || "").localeCompare(a.date || "") : (a.date || "").localeCompare(b.date || "");
  });
  const nextMs = allMs.find((m) => dday(m.date) !== null && dday(m.date) >= 0);
  const addMs = () => {
    if (!newMs.label.trim() || !newMs.date) return;
    setMilestones([...milestones, { id: uid(), at: Date.now(), label: newMs.label.trim(), date: newMs.date }]);
    setNewMs({ label: "", date: "" });
  };
  const needCash = realty.requiredCash + realty.extra.total;
  const etaInput = realty.gap <= 0 ? "지금 가능" : etaText(realty.monthsToGoal);
  const etaActual = realty.gap <= 0 ? "지금 가능" : realty.actualSave == null ? "기록 쌓이면 계산" : etaText(realty.monthsToGoalActual);
  const net = ledger.cur.net;
  const M = (v) => /* @__PURE__ */ React.createElement(Blur, { on: privacy }, v);
  const Chip = ({ label, value, dark }) => /* @__PURE__ */ React.createElement("div", { className: `rounded-xl px-3 py-2 min-w-0 ${dark ? "bg-[#0A0A0A] text-white" : "bg-[#F7F7F7]"}` }, /* @__PURE__ */ React.createElement("div", { className: `text-[11px] mb-0.5 ${dark ? "text-white/60" : "text-[#6B6B6B]"}` }, label), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold truncate", style: { fontVariantNumeric: "tabular-nums" } }, value));
  const Op = ({ c }) => /* @__PURE__ */ React.createElement("span", { className: "text-[18px] font-bold text-[#6B6B6B] self-center px-0.5" }, c);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(Card, { className: "!p-0 overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4 bg-[#0A0A0A] text-white" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-white/50 mb-1" }, "오늘"), /* @__PURE__ */ React.createElement("div", { className: "text-[17px] font-bold leading-snug" }, wedding.d !== null && wedding.d >= 0 ? `결혼식 ${ddayText(wedding.d)}` : "결혼 준비", " · ", realty.gap > 0 ? `집 살 돈 ${wonShort(realty.gap)} 모자라요` : "집 살 현금 준비 완료"), briefLine && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[13px] text-white/70 leading-relaxed" }, "✨ ", briefLine)), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold text-[#6B6B6B] mb-2" }, "지금 할 일"), todo.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, "진행 중인 할 일이 없어요 🎉"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, todo.map((a) => /* @__PURE__ */ React.createElement("li", { key: a.key, className: "flex items-start gap-2" }, a.onDone ? /* @__PURE__ */ React.createElement("button", { onClick: a.onDone, title: "완료 처리", "aria-label": `${a.text} 완료`, className: "mt-0.5 shrink-0 text-[#C9C9C9] hover:text-[#0A0A0A]" }, /* @__PURE__ */ React.createElement(Icon, { name: "square", size: 16 })) : /* @__PURE__ */ React.createElement("span", { className: "mt-[7px] w-1.5 h-1.5 rounded-full bg-[#0A0A0A] shrink-0 mx-[5px]" }), /* @__PURE__ */ React.createElement("button", { onClick: a.go, className: "text-left min-w-0 group" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-semibold leading-snug group-hover:underline underline-offset-2" }, a.text), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, a.src)))))), /* @__PURE__ */ React.createElement("div", { className: "px-5 py-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-bold text-[#6B6B6B] mb-2" }, "확인할 것"), alerts.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, "숫자들이 서로 잘 맞아요 👍"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, alerts.map((a) => /* @__PURE__ */ React.createElement("li", { key: a.text }, /* @__PURE__ */ React.createElement("button", { onClick: a.go, className: "flex items-start gap-2 text-left text-[13px] leading-snug text-[#B4533A] font-semibold hover:underline underline-offset-2" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 14, className: "mt-0.5 shrink-0" }), /* @__PURE__ */ React.createElement("span", { className: privacy ? "money-blur" : "" }, a.text))))))))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "piggy", label: "총 현금 (부부 합산)", value: M(manWon(alloc.totalCash)), accent: "#0A0A0A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "home", label: "집 살 때 모자란 현금", value: M(realty.gap > 0 ? wonShort(realty.gap) : "없음"), accent: "#4B4B4B" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "heart", label: wedding.d !== null ? "결혼식 · 아직 안 낸 돈" : "결혼식 D-Day", value: wedding.d === null ? "미정" : /* @__PURE__ */ React.createElement(React.Fragment, null, ddayText(wedding.d), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#6B6B6B]" }, " · ", M(manWon(money.remaining)))), accent: "#8A8A8A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "wallet", label: `이번 달 수지${ledger.saveRate != null ? ` · 저축률 ${Math.round(ledger.saveRate * 100)}%` : ""}`, value: M(ledger.cur.n ? `${net >= 0 ? "+" : "−"}${won(Math.abs(net))}` : "기록 없음"), accent: "#C6C6C6" })), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "돈의 흐름", title: "자금 흐름" }), /* @__PURE__ */ React.createElement("button", { onClick: openEdit, className: "mb-4 text-[13px] font-semibold text-[#525252] underline underline-offset-4 shrink-0" }, "현금·배분 수정")), /* @__PURE__ */ React.createElement(Card, { className: privacy ? "privacy-on" : "" }, (() => {
    const pri = hh.fundPriority === "realty" ? "realty" : "wedding";
    const pen = lockedPensionMan(), wed = money.reserve;
    const houseCash = realty.equity;
    const leftWed = pri === "realty" ? Math.max(0, houseCash - needCash) / 1e4 : wed;
    const wedShort = Math.max(0, wed - leftWed);
    const Seg = ({ v, label }) => /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setHh({ fundPriority: v }),
        "aria-pressed": pri === v,
        className: `h-9 px-3.5 rounded-lg text-[13px] font-semibold ${pri === v ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#525252]"}`
      },
      pri === v ? "✓ " : "",
      label
    );
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center gap-2 mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] font-semibold text-[#3D3D3D]" }, "현금을 먼저 쓸 곳"), /* @__PURE__ */ React.createElement(Seg, { v: "wedding", label: "결혼 비용 먼저" }), /* @__PURE__ */ React.createElement(Seg, { v: "realty", label: "내 집 먼저" }), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] text-[#6B6B6B]" }, pri === "wedding" ? "결혼에 쓸 돈을 먼저 떼고, 남은 돈을 집에 써요." : "집에 필요한 만큼 먼저 쓰고, 남은 돈으로 결혼 비용을 내요.")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-stretch gap-1.5" }, /* @__PURE__ */ React.createElement(Chip, { label: "부부 현금", value: M(manWon(alloc.totalCash)) }), pen > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Op, { c: "−" }), /* @__PURE__ */ React.createElement(Chip, { label: "연금저축·IRP(집에 못 씀)", value: M(manWon(pen)) })), pri === "wedding" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Op, { c: "−" }), /* @__PURE__ */ React.createElement(Chip, { label: "결혼에 쓸 돈(아직 안 낸 돈)", value: M(manWon(wed)) })), /* @__PURE__ */ React.createElement(Op, { c: "=" }), /* @__PURE__ */ React.createElement(Chip, { label: "집에 쓸 수 있는 현금", value: M(wonShort(houseCash)), dark: true })), /* @__PURE__ */ React.createElement("div", { className: `mt-3 rounded-xl px-4 py-3 text-[14px] leading-relaxed ${realty.gap > 0 ? "bg-[#FFF4D6] text-[#6B4A00]" : "bg-[#E7F4EE] text-[#1F5D46]"}` }, "목표 집(", targetShort(realty.target), ")을 사려면 대출 말고 ", /* @__PURE__ */ React.createElement("b", null, "현금 ", M(wonShort(needCash))), "이 필요해요(부대비용 포함). 우리가 낼 수 있는 현금은 ", /* @__PURE__ */ React.createElement("b", null, M(wonShort(houseCash))), "이라 ", realty.gap > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("b", null, M(wonShort(realty.gap)), " 모자라요.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("b", null, M(wonShort(Math.min(houseCash, needCash)))), "만 쓰면 돼요."), pri === "realty" && /* @__PURE__ */ React.createElement("div", { className: "mt-1" }, "결혼 비용은 집에 쓰고 남은 ", /* @__PURE__ */ React.createElement("b", null, M(manWon(Math.round(leftWed)))), "으로 내요. ", wedShort > 0 ? /* @__PURE__ */ React.createElement("b", null, "결혼 비용 ", M(manWon(Math.round(wedShort))), "이 모자라요.") : "결혼 비용도 충분해요.")));
  })(), /* @__PURE__ */ React.createElement("div", { className: "mt-4 pt-4 border-t border-[#F0F0F0] grid grid-cols-2 lg:grid-cols-4 gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "월 저축 (입력)"), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, M(manWon(hh.monthlySave))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "달성 ", etaInput)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "월 저축 (가계부 실적", ledger.months ? ` · ${ledger.months}개월 평균` : "", ")"), /* @__PURE__ */ React.createElement("div", { className: `text-[15px] font-bold ${mm != null && mm < 0 ? "text-[#B4533A]" : ""}`, style: { fontVariantNumeric: "tabular-nums" } }, realty.actualSave == null ? "기록 없음" : M(manWon(realty.actualSave))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "달성 ", etaActual)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "저축·투자 계좌 잔액(예적금·청약·ISA·연금)"), /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, M(manWon(saving.totalBalance))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "남는 현금 ", M(manWon(Math.max(0, free))), free > saving.totalBalance ? ` · 계좌에 안 적은 돈 ${manWon(free - saving.totalBalance)}` : "")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "결혼 예산 · 지불 완료"), /* @__PURE__ */ React.createElement("div", { className: `text-[15px] font-bold ${money.over ? "text-[#B4533A]" : ""}`, style: { fontVariantNumeric: "tabular-nums" } }, M(manWon(money.total))), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "지불 ", M(manWon(money.paid)), " · 배정 ", M(manWon(money.alloc))))), /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[12px] text-[#6B6B6B] leading-relaxed" }, "결혼에 쓸 돈 = 결혼 예산 합계와 홈 결혼 배정 중 큰 값에서 이미 낸 돈을 뺀 금액. 연금저축·IRP는 55세 전에 꺼내면 세금 16.5%가 붙어 집 살 때 쓰지 않는 돈으로 봐요. 필요한 현금 = 목표 가격 − 예상 대출 + 취득세·중개보수·이사비 추정."))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "테마", title: "테마별 현황" }), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-3 mb-3" }, /* @__PURE__ */ React.createElement(
    HomeThemeCard,
    {
      icon: "home",
      color: "#0A0A0A",
      title: "부동산",
      chip: realty.gap > 0 ? `집 살 돈 ${wonShort(realty.gap)} 모자람` : "집 살 현금 준비 완료",
      privacy,
      onClick: () => setTheme("realty"),
      metrics: [["목표", targetShort(realty.target)], ["최대 대출", M(wonShort(realty.maxLoan))], ["달성 예상", realty.actualSave != null && realty.gap > 0 ? etaActual : etaInput]],
      next: pNext ? `다음: ${pNext.text}` : "부동산 플랜을 모두 끝냈어요"
    }
  ), /* @__PURE__ */ React.createElement(
    HomeThemeCard,
    {
      icon: "heart",
      color: "#BDBDBD",
      title: "결혼식",
      chip: wedding.d !== null ? ddayText(wedding.d) : "날짜 미정",
      privacy,
      onClick: () => setTheme("wedding"),
      metrics: [["예산 총액", M(manWon(money.total))], ["아직 안 낸 돈", M(manWon(money.remaining))], ["준비 진행", `${wedding.taskDone}/${wedding.taskTotal}`]],
      warn: money.over ? `예산이 배정보다 ${manWon(money.total - money.alloc)} 많아요` : "",
      next: wNext ? `다음: ${wNext.text}` : "체크리스트를 모두 끝냈어요"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-3 gap-3" }, /* @__PURE__ */ React.createElement(
    HomeMiniCard,
    {
      icon: "trending",
      title: "돈 모으기",
      onClick: () => setTheme("saving"),
      line: /* @__PURE__ */ React.createElement(React.Fragment, null, "잔액 ", M(manWon(saving.totalBalance)), " · 연 목표 ", saving.totalGoal > 0 ? Math.round(saving.totalPaid / saving.totalGoal * 100) : 0, "%")
    }
  ), /* @__PURE__ */ React.createElement(
    HomeMiniCard,
    {
      icon: "wallet",
      title: "가계부",
      onClick: () => setTheme("ledger"),
      line: ledger.cur.n ? /* @__PURE__ */ React.createElement(React.Fragment, null, "이번 달 지출 ", M(won(ledger.cur.exp)), " · 수지 ", M(`${net >= 0 ? "+" : "−"}${won(Math.abs(net))}`)) : "이번 달 기록이 아직 없어요"
    }
  ))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "전체 일정", title: `통합 타임라인${nextMs ? ` · 다음 ${ddayText(dday(nextMs.date))}` : ""}` }), /* @__PURE__ */ React.createElement("div", { className: "grid sm:grid-cols-2 gap-3 items-start" }, allMs.length === 0 && /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B]" }, "등록된 일정이 없어요. 아래에서 추가해 보세요.")), allMs.map((m) => {
    const n = dday(m.date);
    const past = n !== null && n < 0;
    return /* @__PURE__ */ React.createElement(Card, { key: m.id, className: "!p-4 flex items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: `w-2.5 h-2.5 rounded-full shrink-0 ${past ? "bg-[#D4D4D4]" : m.strong ? "bg-[#BDBDBD] ring-2 ring-[#0A0A0A]" : "bg-[#0A0A0A]"}` }), /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: `text-[15px] font-semibold truncate ${past ? "text-[#6B6B6B]" : ""}` }, m.label), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B]" }, m.date, m.id.startsWith("ph-") ? " · 로드맵" : ""))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1 shrink-0" }, /* @__PURE__ */ React.createElement("span", { className: `font-mono text-[12px] font-semibold px-2.5 py-1 rounded-full ${past ? "bg-[#F0F0F0] text-[#6B6B6B]" : "bg-[#0A0A0A] text-white"}` }, ddayText(n)), !m.fixed && /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => setMilestones(milestones.filter((x) => x.id !== m.id)) })));
  }), /* @__PURE__ */ React.createElement(Card, { className: "sm:col-span-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold text-[#6B6B6B] mb-2.5" }, "일정 추가 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal" }, "(결혼식 날짜는 자동으로 표시돼요)")), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: newMs.label, onChange: (v) => setNewMs({ ...newMs, label: v }), placeholder: "예: 전세 계약 만기", className: "flex-1" }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      "aria-label": "일정 날짜",
      value: newMs.date,
      onChange: (e) => setNewMs({ ...newMs, date: e.target.value }),
      className: "h-10 px-2.5 rounded-lg bg-[#F5F5F5] border border-transparent text-[13px] font-semibold shrink-0 focus:outline-none focus:bg-white focus:border-[#0A0A0A] transition-colors"
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: addMs, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white font-semibold text-[14px] shrink-0" }, "추가"))))), /* @__PURE__ */ React.createElement(Roadmap, { phases, setPhases }), /* @__PURE__ */ React.createElement("section", { ref: editRef, className: "scroll-mt-4" }, /* @__PURE__ */ React.createElement(Card, { className: `!p-0 overflow-hidden ${privacy ? "privacy-on" : ""}` }, /* @__PURE__ */ React.createElement("button", { onClick: () => setEditOpen((o) => !o), "aria-expanded": editOpen, className: "w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: `shrink-0 text-[#6B6B6B] transition-transform ${editOpen ? "rotate-90" : ""}` }), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "우리 부부 정보 · 자금 배분 입력"), !editOpen && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] truncate" }, "연소득 ", M(`${manWon(hh.income1)} + ${manWon(hh.income2)}`), " · 현금 ", M(`${manWon(cash1)} + ${manWon(cash2)}`), " · 월 저축 ", M(manWon(hh.monthlySave)), " · 배분 ", segs.map((s) => `${s.label} ${pct(s.value)}%`).join(" · "))), /* @__PURE__ */ React.createElement("span", { className: "text-[12px] font-semibold text-[#525252] shrink-0" }, editOpen ? "접기" : "편집")), editOpen && /* @__PURE__ */ React.createElement("div", { className: "px-5 pb-5 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement("div", { className: "pt-4 text-[13px] font-bold text-[#3D3D3D] mb-3" }, "우리 부부 정보 ", /* @__PURE__ */ React.createElement("span", { className: "font-normal text-[#6B6B6B]" }, "· 부동산 진단·대출·정책 판정·가계부 자동 수입에 반영돼요")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-4" }, /* @__PURE__ */ React.createElement(Field, { label: `${hh.label1 || "본인"} 연소득(만원)`, value: hh.income1, onChange: (v) => setHh({ income1: v }) }), /* @__PURE__ */ React.createElement(Field, { label: `${hh.label2 || "배우자"} 연소득(만원)`, value: hh.income2, onChange: (v) => setHh({ income2: v }) }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#525252] mb-1.5 font-medium" }, "현재 순자산(만원)"), /* @__PURE__ */ React.createElement("div", { className: "w-full h-12 px-3.5 rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] text-[16px] font-semibold flex items-center", style: { fontVariantNumeric: "tabular-nums" } }, alloc.totalCash.toLocaleString("ko-KR")), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#8A8A8A] mt-1" }, "부부 현금 합산 · 아래에서 수정")), /* @__PURE__ */ React.createElement(Field, { label: "월 저축 가능액(만원)", value: hh.monthlySave, onChange: (v) => setHh({ monthlySave: v }) }), /* @__PURE__ */ React.createElement(Field, { label: "기존 대출 월 상환액(만원)", value: hh.existingDebtMonthly, onChange: (v) => setHh({ existingDebtMonthly: v }) })), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-wrap items-center gap-x-8 gap-y-1" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "부부 월소득 합산(세전) ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums" } }, M(won(Math.round((hh.income1 + hh.income2) * 1e4 / 12))))), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B]" }, "세후 추정 ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A]", style: { fontVariantNumeric: "tabular-nums" } }, M(won(Math.round((estimateNetAnnual(hh.income1 * 1e4) + estimateNetAnnual(hh.income2 * 1e4)) / 12)))))), /* @__PURE__ */ React.createElement("div", { className: "mt-6 pt-5 border-t border-[#F0F0F0] text-[13px] font-bold text-[#3D3D3D] mb-3" }, "자금 배분"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-[3px] h-3 mb-3" }, segs.map((s) => s.value > 0 && alloc.totalCash > 0 && /* @__PURE__ */ React.createElement("div", { key: s.id, title: `${s.label} ${pct(s.value)}%`, style: { width: `${Math.min(100, pct(s.value))}%`, background: s.color }, className: "h-full rounded-full transition-all" })), /* @__PURE__ */ React.createElement("div", { className: "h-full rounded-full bg-[#F0F0F0] flex-1" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] mb-4" }, segs.map((s) => /* @__PURE__ */ React.createElement("span", { key: s.id, className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] inline-block", style: { background: s.color } }), /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, s.label), /* @__PURE__ */ React.createElement("b", { style: { fontVariantNumeric: "tabular-nums" } }, pct(s.value), "%"), /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B]" }, "· ", M(manWon(s.value))))), /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "w-2.5 h-2.5 rounded-[3px] inline-block bg-[#F0F0F0] border border-[#E0E0E0]" }), /* @__PURE__ */ React.createElement("span", { className: "text-[#525252]" }, over ? "총 현금보다 더 배정함" : "남는 현금(돈 모으기)"), /* @__PURE__ */ React.createElement("b", { className: over ? "text-[#B4533A]" : "", style: { fontVariantNumeric: "tabular-nums" } }, over ? M(`-${manWon(-free)}`) : /* @__PURE__ */ React.createElement(React.Fragment, null, M(manWon(free)), " · ", pct(free), "%")))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-3" }, /* @__PURE__ */ React.createElement(Field, { label: `${hh.label1 || "본인"} 현금(만원)`, value: cash1, onChange: (v) => setCash({ cash1: v }), step: 1e3 }), /* @__PURE__ */ React.createElement(Field, { label: `${hh.label2 || "배우자"} 현금(만원)`, value: cash2, onChange: (v) => setCash({ cash2: v }), step: 1e3 }), /* @__PURE__ */ React.createElement("div", { className: "col-span-2 lg:col-span-3 flex items-end pb-3" }, /* @__PURE__ */ React.createElement("span", { className: "text-[14px] text-[#6B6B6B]" }, "총 현금(부부 합산) ", /* @__PURE__ */ React.createElement("b", { className: "text-[#0A0A0A] text-[16px]", style: { fontVariantNumeric: "tabular-nums" } }, M(manWon(alloc.totalCash)))))), /* @__PURE__ */ React.createElement("div", { className: "mt-1 text-[12px] text-[#6B6B6B]" }, "부부 현금에는 예적금·ISA·연금저축·IRP 잔액까지 모두 포함해 적어요. 연금저축·IRP는 55세 전에 꺼내면 세금이 붙어 내 집 자기자본에서는 빼요."), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 mt-4 border-t border-[#F0F0F0]" }, /* @__PURE__ */ React.createElement(Field, { label: "부동산 배정(만원)", value: alloc.realty, onChange: (v) => setAlloc({ ...alloc, realty: v }), step: 1e3 }), /* @__PURE__ */ React.createElement(Field, { label: "결혼식 배정(만원)", value: alloc.wedding, onChange: (v) => setAlloc({ ...alloc, wedding: v }), step: 500 }))))));
}
function HomeThemeCard({ icon, color, title, chip, metrics, next, warn, onClick }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, className: "w-full text-left h-full" }, /* @__PURE__ */ React.createElement(Card, { className: "hover:border-[#0A0A0A]/50 transition-colors h-full" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0", style: { background: color } }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 17 })), /* @__PURE__ */ React.createElement("div", { className: "text-[16px] font-bold" }, title)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 shrink-0" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold text-white px-2.5 py-1 rounded-full bg-[#0A0A0A]" }, chip), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 18, className: "text-[#6B6B6B]" }))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-3 gap-2 text-center" }, metrics.map(([l, v]) => /* @__PURE__ */ React.createElement("div", { key: l, className: "bg-[#F7F7F7] rounded-xl py-2.5 px-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] mb-0.5" }, l), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold truncate px-1" }, v)))), warn && /* @__PURE__ */ React.createElement("div", { className: "mt-2.5 text-[12px] font-semibold text-[#B4533A]" }, "⚠ ", warn), /* @__PURE__ */ React.createElement("div", { className: "mt-2.5 text-[13px] text-[#525252] truncate" }, next)));
}
function HomeMiniCard({ icon, title, line, onClick }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, className: "w-full text-left" }, /* @__PURE__ */ React.createElement(Card, { className: "!p-4 hover:border-[#0A0A0A]/50 transition-colors flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "w-8 h-8 rounded-lg bg-[#F4F4F5] flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 15 })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, title), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] truncate" }, line)), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "text-[#6B6B6B] shrink-0" })));
}
const LEDGER_CATS = [
  ["food", "🍚 식비"],
  ["cafe", "☕ 카페·간식"],
  ["transport", "🚗 교통·차량"],
  ["shopping", "🛍 쇼핑"],
  ["living", "🧺 생활·마트"],
  ["culture", "🎬 문화·여가"],
  ["medical", "💊 의료·건강"],
  ["event", "💌 경조사·선물"],
  ["house", "🏠 주거·통신"],
  ["save", "🏦 저축·이체"],
  ["etc", "📦 기타"]
];
const LEDGER_INCOME_CATS = [
  ["salary", "💼 급여"],
  ["bonus", "🎁 상여·보너스"],
  ["side", "💡 부수입"],
  ["invest", "📈 금융수입"],
  ["etcin", "📦 기타수입"]
];
const ledgerCatLabel = (id) => (LEDGER_CATS.find((c) => c[0] === id) || LEDGER_INCOME_CATS.find((c) => c[0] === id) || ["", "📦 기타"])[1];
const isIncomeEntry = (e) => e.type === "in";
const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const wonComma = (n) => (Number(n) || 0).toLocaleString() + "원";
const wonCell = (n) => n >= 99995e3 ? Math.round(n / 1e7) / 10 + "억" : n >= 1e6 ? Math.round(n / 1e4) + "만" : n >= 1e4 ? Math.round(n / 1e3) / 10 + "만" : n >= 1e3 ? Math.round(n / 1e3) + "천" : String(n);
function hhIncomeFixed(hh) {
  return [
    hh && hh.income1 > 0 && { id: "hh-inc-1", memo: `${hh && hh.label1 || "본인"} 월급 (홈 연동·세후 추정)`, amount: Math.round(estimateNetAnnual(hh.income1 * 1e4) / 12), cat: "salary", day: 25, type: "in" },
    hh && hh.income2 > 0 && { id: "hh-inc-2", memo: `${hh && hh.label2 || "배우자"} 월급 (홈 연동·세후 추정)`, amount: Math.round(estimateNetAnnual(hh.income2 * 1e4) / 12), cat: "salary", day: 25, type: "in" }
  ].filter(Boolean);
}
function useLedgerAutoFill(hh) {
  const [autoIncome] = usePersist("ledger-auto-income-v1", true);
  const [fixed] = usePersist("ledger-fixed-v1", []);
  const [nowKey, setNowKey] = useState(() => ymKey(/* @__PURE__ */ new Date()));
  useEffect(() => {
    const t = setInterval(() => setNowKey((prev) => {
      const k = ymKey(/* @__PURE__ */ new Date());
      return prev === k ? prev : k;
    }), 10 * 60 * 1e3);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const allFixed = [...autoIncome ? hhIncomeFixed(hh) : [], ...fixed].filter((f) => !f.from || nowKey >= f.from);
    if (!allFixed.length) return;
    const entries = store.get("ledger-entries-v1", []), fixedDone = store.get("ledger-fixed-done-v1", {});
    const done = fixedDone[nowKey] || [];
    const missing = allFixed.filter((f) => !done.includes(f.id) && !entries.some((e) => e.fixedId === f.id && (e.date || "").startsWith(nowKey)));
    if (!missing.length) return;
    const [yy, mm] = nowKey.split("-").map(Number);
    const dim = new Date(yy, mm, 0).getDate();
    setKey("ledger-entries-v1", [...entries, ...missing.map((f) => ({
      // id는 기기마다 같아지도록 결정적으로 — 부부가 월초에 동시에 열어도 id 병합이 하나로 합친다
      id: `fx-${f.id}-${nowKey}`,
      fixedId: f.id,
      date: ymd(yy, mm - 1, Math.min(Math.max(1, Number(f.day) || 1), dim)),
      amount: Number(f.amount) || 0,
      cat: f.cat,
      memo: f.memo,
      at: Date.now(),
      ...f.type === "in" ? { type: "in" } : {}
    }))]);
    const next = { ...fixedDone, [nowKey]: [...done, ...missing.map((f) => f.id)] };
    setKey("ledger-fixed-done-v1", Object.fromEntries(Object.entries(next).sort((x, y) => y[0].localeCompare(x[0])).slice(0, 6)));
  }, [fixed, autoIncome, nowKey, hh && hh.income1, hh && hh.income2]);
}
function LedgerTheme({ privacy, hh }) {
  const today = /* @__PURE__ */ new Date();
  const [entries, setEntries] = usePersist("ledger-entries-v1", []);
  const [fixed, setFixed] = usePersist("ledger-fixed-v1", []);
  const [budget, setBudget] = usePersist("ledger-budget-v1", {});
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selDay, setSelDay] = useState(ymd(today.getFullYear(), today.getMonth(), today.getDate()));
  const [nv, setNv] = useState({ amount: "", cat: "food", memo: "", type: "exp" });
  const [nf, setNf] = useState({ memo: "", amount: "", cat: "house", day: "1", type: "exp" });
  const [autoIncome, setAutoIncome] = usePersist("ledger-auto-income-v1", true);
  const hhIncome = hhIncomeFixed(hh);
  const addFixed = () => {
    const amount = Number(String(nf.amount).replace(/[^0-9]/g, ""));
    if (!amount || !nf.memo.trim()) return;
    setFixed([...fixed, { id: uid(), at: Date.now(), memo: nf.memo.trim(), amount, cat: nf.cat, day: Math.min(31, Math.max(1, Number(nf.day) || 1)), ...nf.type === "in" ? { type: "in" } : {} }]);
    setNf({ memo: "", amount: "", cat: nf.cat, day: nf.day, type: nf.type });
  };
  const moveMonth = (d) => setCur(({ y, m }) => {
    const dt = new Date(y, m + d, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const monthKey = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}`;
  const monthEntries = entries.filter((e) => (e.date || "").startsWith(monthKey));
  const monthExpEntries = monthEntries.filter(isExpenseEntry);
  const monthSave = monthEntries.filter(isSavingEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const byDay = {};
  monthEntries.forEach((e) => {
    const d = Number(e.date.slice(8, 10)), b = byDay[d] || (byDay[d] = { exp: 0, inc: 0, n: 0 });
    if (!isSavingEntry(e)) b[isIncomeEntry(e) ? "inc" : "exp"] += Number(e.amount) || 0;
    b.n += 1;
  });
  const monthExp = monthExpEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthInc = monthEntries.filter(isIncomeEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthTotal = monthExp;
  const daysPassed = cur.y === today.getFullYear() && cur.m === today.getMonth() ? today.getDate() : new Date(cur.y, cur.m + 1, 0).getDate();
  const catTotals = LEDGER_CATS.map(([id, label]) => ({ id, label, sum: monthExpEntries.filter((e) => e.cat === id).reduce((s, e) => s + (Number(e.amount) || 0), 0) })).filter((c) => c.sum > 0).sort((a, b) => b.sum - a.sum);
  const topCat = catTotals[0];
  const totalBudget = Object.values(budget).reduce((s, v) => s + (Number(v) || 0), 0);
  const prevDt = new Date(cur.y, cur.m - 1, 1);
  const prevKey = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, "0")}`;
  const prevExp = entries.filter((e) => (e.date || "").startsWith(prevKey) && isExpenseEntry(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const recentMonths = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(cur.y, cur.m - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    recentMonths.push({ key, label: `${dt.getMonth() + 1}월`, sum: entries.filter((e) => (e.date || "").startsWith(key) && isExpenseEntry(e)).reduce((s, e) => s + (Number(e.amount) || 0), 0) });
  }
  const maxMonth = Math.max(1, ...recentMonths.map((m) => m.sum));
  const exportCsv = () => {
    const rows = [
      ["날짜", "유형", "카테고리", "메모", "금액(원)"],
      ...monthEntries.slice().sort((a2, b) => (a2.date || "").localeCompare(b.date || "")).map((e) => [e.date, isIncomeEntry(e) ? "수입" : isSavingEntry(e) ? "저축" : "지출", ledgerCatLabel(e.cat).replace(/^\S+\s/, ""), String(e.memo || "").replace(/"/g, '""'), e.amount])
    ];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `가계부_${monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4e3);
  };
  const firstDow = new Date(cur.y, cur.m, 1).getDay();
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const dayEntries = entries.filter((e) => e.date === selDay).sort((a, b) => (b.at || 0) - (a.at || 0));
  const addEntry = () => {
    const amount = Number(String(nv.amount).replace(/[^0-9]/g, ""));
    if (!amount) return;
    setEntries([...entries, { id: uid(), date: selDay, amount, cat: nv.cat, memo: nv.memo.trim(), at: Date.now(), ...nv.type === "in" ? { type: "in" } : {} }]);
    setNv({ amount: "", cat: nv.cat, memo: "", type: nv.type });
  };
  const isToday = (d) => cur.y === today.getFullYear() && cur.m === today.getMonth() && d === today.getDate();
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(LedgerLinkedBar, { hh, privacy, monthSave }), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, /* @__PURE__ */ React.createElement(Kpi, { icon: "wallet", label: `${cur.m + 1}월 지출`, value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(monthExp)) }), /* @__PURE__ */ React.createElement(Kpi, { icon: "trending", label: `${cur.m + 1}월 수입`, value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, monthInc > 0 ? "+" + wonComma(monthInc) : "0원"), accent: "#525252" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "calc", label: "수지 (수입−지출)", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, (monthInc - monthExp >= 0 ? "+" : "−") + wonComma(Math.abs(monthInc - monthExp))), accent: "#8A8A8A" }), /* @__PURE__ */ React.createElement(Kpi, { icon: "check2", label: totalBudget > 0 ? monthExp > totalBudget ? "예산 초과" : "남은 예산" : "하루 평균 지출", value: /* @__PURE__ */ React.createElement(Blur, { on: privacy }, totalBudget > 0 ? wonComma(Math.abs(totalBudget - monthExp)) : wonComma(Math.round(monthExp / Math.max(1, daysPassed)))), accent: totalBudget > 0 && monthExp > totalBudget ? "#C96A6A" : "#B0B0B0" }))), /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start" }, /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-3 mb-6 lg:mb-0" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(-1), "aria-label": "이전 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16, className: "rotate-180" })), /* @__PURE__ */ React.createElement("div", { className: "text-[17px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, cur.y, "년 ", cur.m + 1, "월"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React.createElement("button", { onClick: exportCsv, title: "이 달 내역 CSV로 내보내기 (엑셀 호환)", className: "h-9 px-2.5 rounded-lg hover:bg-[#F5F5F5] text-[12px] font-bold text-[#6B6B6B]" }, "엑셀로 내보내기"), /* @__PURE__ */ React.createElement("button", { onClick: () => moveMonth(1), "aria-label": "다음 달", className: "w-9 h-9 rounded-lg hover:bg-[#F5F5F5] flex items-center justify-center" }, /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 16 })))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 text-center text-[11px] font-semibold text-[#6B6B6B] mb-2" }, ["일", "월", "화", "수", "목", "금", "토"].map((d, i) => /* @__PURE__ */ React.createElement("div", { key: d, className: i === 0 ? "text-[#C96A6A]" : "" }, d))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-7 gap-1" }, Array.from({ length: firstDow }).map((_, i) => /* @__PURE__ */ React.createElement("div", { key: "e" + i })), Array.from({ length: daysInMonth }).map((_, i) => {
    const d = i + 1, key = ymd(cur.y, cur.m, d), sel = selDay === key, b = byDay[d];
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: d,
        onClick: () => setSelDay(key),
        "aria-label": `${cur.m + 1}월 ${d}일${b ? ` · 기록 ${b.n}건` : ""}`,
        className: `relative aspect-square rounded-xl flex flex-col items-center justify-center gap-px leading-none transition-colors ${sel ? "bg-[#0A0A0A] text-white" : b ? "bg-[#F7F7F7] hover:bg-[#EDEDED]" : isToday(d) ? "bg-[#F0F0F0] hover:bg-[#E5E5E5]" : "hover:bg-[#F5F5F5]"} ${!sel && isToday(d) ? "ring-1 ring-[#0A0A0A]/30" : ""}`
      },
      b && /* @__PURE__ */ React.createElement("span", { className: `absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${sel ? "bg-white/80" : "bg-[#0A0A0A]"}` }),
      /* @__PURE__ */ React.createElement("span", { className: `text-[13px] font-semibold ${!sel && new Date(cur.y, cur.m, d).getDay() === 0 ? "text-[#C96A6A]" : ""}` }, d),
      b && b.exp > 0 && /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-mono font-semibold ${sel ? "text-white/75" : "text-[#525252]"} ${privacy ? "money-blur" : ""}` }, "-", wonCell(b.exp)),
      b && b.inc > 0 && /* @__PURE__ */ React.createElement("span", { className: `text-[10px] font-mono font-semibold ${sel ? "text-[#9FD8B8]" : "text-[#3E7F5C]"} ${privacy ? "money-blur" : ""}` }, "+", wonCell(b.inc)),
      b && !b.exp && !b.inc && /* @__PURE__ */ React.createElement("span", { className: `text-[10px] ${sel ? "text-white/75" : "text-[#6B6B6B]"}` }, b.n, "건")
    );
  })))), /* @__PURE__ */ React.createElement("section", { className: "lg:col-span-2" }, /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold", style: { fontVariantNumeric: "tabular-nums" } }, Number(selDay.slice(5, 7)), "월 ", Number(selDay.slice(8, 10)), "일"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[13px] font-bold" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(dayEntries.filter(isExpenseEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0)), (() => {
    const inc = dayEntries.filter(isIncomeEntry).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return inc > 0 ? ` · +${wonComma(inc)}` : "";
  })()))), /* @__PURE__ */ React.createElement("div", { className: "space-y-2 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-1.5" }, [["exp", "지출"], ["in", "수입"]].map(([t, l]) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: t,
      onClick: () => setNv({ ...nv, type: t, cat: t === "in" ? "salary" : "food" }),
      className: `h-8 px-3.5 rounded-full text-[12px] font-bold transition-colors ${nv.type === t ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#6B6B6B] hover:bg-[#E5E5E5]"}`
    },
    l
  ))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: nv.amount, onChange: (v) => setNv({ ...nv, amount: v.replace(/[^0-9]/g, "") }), placeholder: "금액(원) *" }), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: nv.cat,
      onChange: (e) => setNv({ ...nv, cat: e.target.value }),
      className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    },
    (nv.type === "in" ? LEDGER_INCOME_CATS : LEDGER_CATS).map(([id, label]) => /* @__PURE__ */ React.createElement("option", { key: id, value: id }, label))
  )), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ React.createElement(TextInput, { value: nv.memo, onChange: (v) => setNv({ ...nv, memo: v }), placeholder: "메모 (예: 점심 · 장보기)", className: "flex-1" }), /* @__PURE__ */ React.createElement("button", { onClick: addEntry, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0 flex items-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " 기입"))), dayEntries.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] py-3 text-center" }, "이 날의 기록이 없어요."), /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F5F5F5]" }, dayEntries.map((e) => /* @__PURE__ */ React.createElement("li", { key: e.id, className: "flex items-center gap-2.5 py-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] shrink-0" }, ledgerCatLabel(e.cat)), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B] flex-1 min-w-0 truncate" }, e.fixedId ? "🔁 " : "", e.memo || "-"), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[13px] font-bold shrink-0" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, isIncomeEntry(e) ? "+" : "", wonComma(e.amount))), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => setEntries(entries.filter((x) => x.id !== e.id)), className: "!w-7 !h-7 shrink-0" }))))))), /* @__PURE__ */ React.createElement("section", { className: "mt-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "매달 자동 기입", title: "고정 수입·지출 (월세·구독·월급 등)" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3 mb-3" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-semibold" }, "🔗 홈 부부 소득 자동 수입 기입"), /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] truncate" }, hhIncome.length ? /* @__PURE__ */ React.createElement(React.Fragment, null, "매월 25일 · ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, hhIncome.map((f) => `${f.memo.split(" (")[0]} +${wonComma(f.amount)}`).join(" · ")), " (세후 추정)") : "홈에서 부부 연소득을 입력하면 세후 추정 월급이 자동 기입돼요")), /* @__PURE__ */ React.createElement("label", { className: "flex items-center gap-1.5 text-[12px] font-bold text-[#3D3D3D] shrink-0 cursor-pointer select-none" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: !!autoIncome, onChange: () => setAutoIncome(!autoIncome), className: "w-4 h-4 accent-[#0A0A0A]" }), "자동 기입")), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-6 gap-2 mb-2" }, /* @__PURE__ */ React.createElement(
    "select",
    {
      value: nf.type,
      onChange: (e) => {
        const t = e.target.value;
        setNf({ ...nf, type: t, cat: t === "in" ? "salary" : "house" });
      },
      className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    },
    /* @__PURE__ */ React.createElement("option", { value: "exp" }, "지출"),
    /* @__PURE__ */ React.createElement("option", { value: "in" }, "수입")
  ), /* @__PURE__ */ React.createElement(TextInput, { value: nf.memo, onChange: (v) => setNf({ ...nf, memo: v }), placeholder: "항목명 * (예: 월세·월급)" }), /* @__PURE__ */ React.createElement(TextInput, { value: nf.amount, onChange: (v) => setNf({ ...nf, amount: v.replace(/[^0-9]/g, "") }), placeholder: "금액(원) *" }), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: nf.cat,
      onChange: (e) => setNf({ ...nf, cat: e.target.value }),
      className: "h-10 px-2 rounded-lg bg-[#F5F5F5] border border-transparent text-[14px] font-semibold focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
    },
    (nf.type === "in" ? LEDGER_INCOME_CATS : LEDGER_CATS).map(([id, label]) => /* @__PURE__ */ React.createElement("option", { key: id, value: id }, label))
  ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B] shrink-0" }, "매월"), /* @__PURE__ */ React.createElement(TextInput, { value: nf.day, onChange: (v) => setNf({ ...nf, day: v.replace(/[^0-9]/g, "") }), placeholder: "1", className: "!w-14 text-center" }), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] text-[#6B6B6B] shrink-0" }, "일")), /* @__PURE__ */ React.createElement("button", { onClick: addFixed, className: "h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold flex items-center justify-center gap-1" }, /* @__PURE__ */ React.createElement(Icon, { name: "plus", size: 13 }), " 고정 항목 등록")), fixed.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] py-3 text-center" }, "등록된 고정 항목이 없어요. 월세·구독료·통신비·월급 등을 등록하면 매달 자동으로 기입돼요."), /* @__PURE__ */ React.createElement("ul", { className: "divide-y divide-[#F5F5F5]" }, fixed.map((f) => /* @__PURE__ */ React.createElement("li", { key: f.id, className: "flex items-center gap-2.5 py-2.5" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[12px] font-semibold text-[#6B6B6B] shrink-0 w-16" }, "매월 ", f.day, "일"), /* @__PURE__ */ React.createElement("span", { className: "text-[13px] shrink-0" }, ledgerCatLabel(f.cat)), /* @__PURE__ */ React.createElement("span", { className: "text-[14px] font-semibold flex-1 min-w-0 truncate" }, "🔁 ", f.memo), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[13px] font-bold shrink-0" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, f.type === "in" ? "+" : "", wonComma(f.amount))), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "고정 항목 해제(이미 기입된 내역은 남아요)", onClick: () => setFixed(fixed.filter((x) => x.id !== f.id)), className: "!w-7 !h-7 shrink-0" })))), fixed.length > 0 && /* @__PURE__ */ React.createElement("p", { className: "mt-3 text-[12px] text-[#6B6B6B] leading-relaxed" }, "등록하면 이번 달분이 바로 기입되고, 매달 첫 방문 때 그 달 지정일로 자동 기입돼요(🔁 표시). 해제해도 이미 기입된 내역은 남아요."))), /* @__PURE__ */ React.createElement("div", { className: "lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start mt-6" }, /* @__PURE__ */ React.createElement("section", { className: "mb-6 lg:mb-0" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "소비 패턴", title: `${cur.m + 1}월 카테고리별 지출` }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setBudgetEdit(!budgetEdit),
      className: `mb-4 h-8 px-3 rounded-full text-[12px] font-bold shrink-0 transition-colors ${budgetEdit ? "bg-[#0A0A0A] text-white" : "bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"}`
    },
    budgetEdit ? "설정 완료" : "예산 설정"
  )), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] mb-3" }, "지난달 ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(prevExp)), " · 이 달 ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(monthExp)), prevExp > 0 && /* @__PURE__ */ React.createElement("b", { className: `ml-1 ${monthExp > prevExp ? "text-[#C96A6A]" : "text-[#2E7D5B]"}` }, "(지난달보다 ", monthExp >= prevExp ? "+" : "", Math.round((monthExp - prevExp) / prevExp * 100), "%)")), budgetEdit ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mb-2" }, '카테고리별 월 예산(원)을 적어요. 0이면 예산이 없는 거예요. 합계로 위의 "남은 예산"을 계산해요.'), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2" }, LEDGER_CATS.map(([id, label]) => /* @__PURE__ */ React.createElement("div", { key: id, className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[13px] w-24 shrink-0" }, label), /* @__PURE__ */ React.createElement(TextInput, { value: budget[id] ? String(budget[id]) : "", onChange: (v) => setBudget({ ...budget, [id]: Number(v.replace(/[^0-9]/g, "")) || 0 }), placeholder: "월 예산(원)", className: "!h-8 !text-[12px]" }))))) : /* @__PURE__ */ React.createElement(React.Fragment, null, catTotals.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] py-3 text-center" }, "이 달의 기록이 아직 없어요. 달력에서 날짜를 눌러 기입해 보세요."), /* @__PURE__ */ React.createElement("div", { className: "space-y-3" }, catTotals.map((c) => {
    const b = Number(budget[c.id]) || 0, over = b > 0 && c.sum > b;
    return /* @__PURE__ */ React.createElement("div", { key: c.id }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-[13px] mb-1" }, /* @__PURE__ */ React.createElement("span", { className: "font-semibold" }, c.label, over && /* @__PURE__ */ React.createElement("span", { className: "ml-1.5 text-[11px] font-bold text-[#C96A6A]" }, "⚠️ 예산 초과")), /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[#525252]" }, /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(c.sum)), " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#737373]" }, b > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, "/ ", /* @__PURE__ */ React.createElement(Blur, { on: privacy }, wonComma(b))) : `(${Math.round(c.sum / Math.max(1, monthTotal) * 100)}%)`))), /* @__PURE__ */ React.createElement(ProgressBar, { ratio: b > 0 ? Math.min(1, c.sum / b) : c.sum / Math.max(1, monthTotal), color: over ? "#C96A6A" : "#0A0A0A", height: 5 }));
  }))))), /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "추이", title: "최근 6개월 지출" }), /* @__PURE__ */ React.createElement(Card, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-end gap-2 h-36 mb-2" }, recentMonths.map((m) => /* @__PURE__ */ React.createElement("div", { key: m.key, className: "flex-1 flex flex-col items-center gap-1" }, /* @__PURE__ */ React.createElement("span", { className: `font-mono text-[10px] text-[#6B6B6B] ${privacy ? "money-blur" : ""}` }, m.sum > 0 ? wonCell(m.sum) : ""), /* @__PURE__ */ React.createElement("div", { className: "w-full rounded-t-md bg-[#0A0A0A] transition-all", style: { height: `${Math.max(m.sum > 0 ? 6 : 2, Math.round(m.sum / maxMonth * 100))}%`, opacity: m.key === monthKey ? 1 : 0.35 } }), /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold text-[#6B6B6B]" }, m.label)))), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#6B6B6B] leading-relaxed" }, "기록은 자동 저장되고, 로그인 시 부부가 함께 보는 가계부로 동기화돼요.")))), /* @__PURE__ */ React.createElement("div", { className: "masonry mt-6" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "ledger" })));
}
const NEWS_TOPICS = [
  { id: "realty", label: "부동산 정책", q: "부동산 정책 규제 대책" },
  { id: "loan", label: "대출·금리", q: "주택담보대출 DSR 규제 금리" },
  { id: "tax", label: "세금·세제", q: "세제개편 부동산 세금" },
  { id: "apply", label: "청약·분양", q: "아파트 청약 분양" },
  { id: "jeonse", label: "전세·임대차", q: "전세 임대차 정책" },
  { id: "econ", label: "경제 일반", q: "기준금리 가계부채 경제정책" }
];
const POLICY_RADAR_AT = "2026-08-06";
const POLICY_RADAR = [
  {
    date: "2026-08-03",
    topic: "세금",
    status: "정부안 (국회 통과 전)",
    title: "2026 세제개편안 — 부동산 세금이 '실거주' 중심으로",
    body: "종부세: 주택 수 대신 총 가액 기준, 실거주 1주택 공제 12억→14억(시가 약 20억까지 면제) · 비거주 9억으로 축소 · 공정시장가액비율 60→70%. 양도세 장기보유특별공제도 보유→거주 중심 개편 + 상한 신설.",
    us: "무주택인 우리에게 유리한 방향이에요. 사서 실제로 사는 사람은 세금이 줄고, 사 두고 살지 않는 집은 세금이 늘어요. 산 뒤 계속 살아야 세금을 아낄 수 있어요.",
    link: "https://www.korea.kr/news/policyNewsView.do?newsId=148969278"
  },
  {
    date: "2026-09-01",
    topic: "세금",
    status: "정부 확정안 (국회 심의)",
    title: "ISA 개편 — 이월 폐지 철회 + 생산적금융 ISA 신설",
    body: "8/3 정부안의 일반 ISA 이월 폐지·계약 총 5년 제한은 9/1 국무회의 확정안에서 철회 — 현행 유지. 국내주식 전용 '생산적금융 ISA' 신설(이자·배당 전액 비과세, 연 2,000만/총 2억, 중복가입 가능, 이월 허용).",
    us: "올해 안에 몰아 넣을 필요는 없어요. 생산적금융 ISA가 시행되면 일반 ISA와 따로 열어 국내주식 배당을 세금 없이 받아요. 자세한 내용은 돈 모으기 › 내 계좌·절세 › 절세 방법에 있어요.",
    link: "https://www.moef.go.kr"
  },
  {
    date: "2024-12-02",
    topic: "대출",
    status: "시행 중",
    title: "신생아 특례대출 소득요건 — 부부합산 2억 확정",
    body: "맞벌이 부부 연소득 합산 2억 이하(한 사람 1.3억 이하)로 완화돼 지금(2026.9)도 유지돼요. 구입 최대 4억(집값 9억·전용 85㎡ 이하), 특례금리 연 1.80~4.50%예요.",
    us: "부부 연소득 합산이 기준(2억)보다 적어 소득 요건은 통과해요. 다만 신청일 기준 2년 안에 출산한 가구여야 해요. 출산 계획과 매수 시점을 맞추면 이자를 크게 아껴요.",
    link: "https://www.myhome.go.kr"
  },
  {
    date: "2025-07-01",
    topic: "대출",
    status: "시행 중",
    title: "스트레스 DSR 3단계",
    body: "모든 가계대출 한도 산정에 스트레스 가산금리 100% 반영. 연소득 1억·금리 4.2%·30년 변동금리 기준으로 수도권 주담대 한도가 3단계에서 약 5.7억, 10.16 이후 스트레스 금리 3%에서 약 4.9억으로 줄어요. 10.15 대책으로 수도권·규제지역 주담대 스트레스 금리 하한이 1.5%→3%로 상향(금리 4%면 7%로 심사).",
    us: "진단·대출 탭의 'DSR 계산 금리'에 스트레스 금리를 더한 값을 넣어야 실제 한도와 맞아요. 대출 여력은 보수적으로 잡아요.",
    link: "https://www.fsc.go.kr"
  }
];
const OFFICIAL_SOURCES = [
  ["정책브리핑 (korea.kr)", "https://www.korea.kr/news/policyNewsList.do", "범정부 정책 발표 원문 — 가장 빠르고 정확"],
  ["재정경제부 보도자료", "https://www.moef.go.kr/nw/nes/nesdta.do", "세제·재정 — 세제개편안 원문"],
  ["국토교통부 보도자료", "https://www.molit.go.kr/USR/NEWS/m_71/lst.jsp", "주택 공급·청약 제도·정책대출"],
  ["금융위원회 보도자료", "https://www.fsc.go.kr/no010101", "DSR·LTV 등 대출 규제"],
  ["국세청 보도자료", "https://www.nts.go.kr/nts/na/ntt/selectNttList.do?mi=2451&bbsId=1061", "양도세·증여세 집행 기준"],
  ["한국은행 보도자료", "https://www.bok.or.kr/portal/bbs/B0000338/list.do?menuNo=200761", "기준금리 결정 (연 8회)"],
  ["청약홈 공고", "https://www.applyhome.co.kr", "분양 공고 원문"],
  ["주택도시기금", "https://nhuf.molit.go.kr", "디딤돌·버팀목·신생아 특례 조건"]
];
const POLICY_RADAR_FALLBACK = POLICY_RADAR.map((p, i) => ({ id: "base-" + i, title: p.title, summary: p.body, impact: p.us, status: p.status, topic: p.topic || "기타", announcedAt: p.date, source: "기본 자료", url: p.link }));
const radarTone = (s) => /^(시행|확정)/.test(s || "") ? "bg-[#E8F5EC] text-[#1B7F3B]" : /정부/.test(s || "") ? "bg-[#FFF6DB] text-[#8A5A00]" : "bg-[#F2F2F2] text-[#525252]";
function PolicyRadar() {
  const [st, setSt] = useState({ loading: true, data: null, failed: false, note: "" });
  const [topic, setTopic] = useState("");
  const [oldOpen, setOldOpen] = useState(false);
  const load = async (force) => {
    setSt((s) => ({ ...s, loading: true }));
    try {
      const j = await memoLoad("policy-radar", async () => {
        const r = await authFetchApi("/api/policy-radar", force);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }, force);
      if (!j || !Array.isArray(j.items) || !j.items.length) throw new Error("empty");
      setSt((s) => ({ ...s, loading: false, data: j, failed: false }));
    } catch {
      setSt((s) => ({ ...s, loading: false, failed: true }));
    }
  };
  useEffect(() => {
    load(false);
  }, []);
  const refresh = async () => {
    setSt((s) => ({ ...s, note: "갱신을 요청하는 중…" }));
    try {
      const r = await authFetch("/api/policy-radar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh: true }) });
      if (r.status === 202) setSt((s) => ({ ...s, note: "갱신을 시작했어요, 1~2분 뒤 다시 열어 주세요" }));
      else if (r.ok) {
        setSt((s) => ({ ...s, note: "" }));
        load(true);
      } else throw new Error("HTTP " + r.status);
    } catch {
      setSt((s) => ({ ...s, note: "지금은 갱신할 수 없어요 — 잠시 후 다시 시도해 주세요" }));
    }
  };
  const live = !st.failed && st.data;
  const items = (live ? st.data.items : POLICY_RADAR_FALLBACK).slice().sort((a, b) => String(b.announcedAt || "").localeCompare(String(a.announcedAt || "")));
  const topics = [...new Set(items.map((x) => x.topic).filter(Boolean))];
  const shown = items.filter((x) => !topic || x.topic === topic);
  const cutoff = todayYmd(new Date(Date.now() - 60 * 864e5));
  const recent = shown.filter((x) => String(x.announcedAt || "") >= cutoff), old = shown.filter((x) => String(x.announcedAt || "") < cutoff);
  const card = (p) => /* @__PURE__ */ React.createElement(Card, { key: p.id || p.title, className: "h-full flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "font-mono text-[11px] text-[#6B6B6B]" }, "발표 ", p.announcedAt || "—", p.effectiveAt ? ` · 시행 ${p.effectiveAt}` : ""), /* @__PURE__ */ React.createElement("span", { className: `text-[12px] px-2.5 py-0.5 rounded-full font-semibold ${radarTone(p.status)}` }, p.status), p.topic && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] text-[#6B6B6B]" }, "#", p.topic)), /* @__PURE__ */ React.createElement("h4", { className: "text-[15px] font-bold leading-snug mb-2" }, p.title), p.summary && /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed mb-2" }, p.summary), p.impact && /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#3D3D3D] leading-relaxed bg-[#FAFAFA] rounded-lg px-3 py-2 mb-3" }, /* @__PURE__ */ React.createElement("b", null, "우리는:"), " ", p.impact), safeUrl(p.url) ? /* @__PURE__ */ React.createElement("a", { href: safeUrl(p.url), target: "_blank", rel: "noopener noreferrer", className: "mt-auto inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4" }, "출처", p.source && p.source !== "기본 자료" ? ` · ${p.source}` : " 원문", " ", /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 12 })) : p.source ? /* @__PURE__ */ React.createElement("span", { className: "mt-auto text-[12px] text-[#6B6B6B]" }, "출처 · ", p.source) : null);
  return /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end justify-between gap-3 flex-wrap" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: live ? `매일 오전 자동 갱신 · 마지막 갱신 ${hhmm(st.data.at) || "—"}${st.data.stale ? " · 오래된 자료일 수 있어요" : ""}` : st.loading ? "불러오는 중…" : "실시간 자료를 불러오지 못해 기본 자료를 보여 줘요", title: "정책 레이더 — 우리에게 영향 있는 변화" }), /* @__PURE__ */ React.createElement("div", { className: "mb-4 flex items-center gap-2" }, !live && !st.loading && /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-semibold px-2 py-1 rounded-full bg-[#F2F2F2] text-[#525252]" }, "기본 자료(2026-09-29 작성)"), /* @__PURE__ */ React.createElement("button", { onClick: refresh, className: "h-9 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0" }, "지금 새로고침"))), st.note && /* @__PURE__ */ React.createElement("div", { className: "mb-3 text-[13px] text-[#525252] bg-white rounded-xl shadow-sm px-4 py-2.5" }, st.note), topics.length > 1 && /* @__PURE__ */ React.createElement(SegRow, { options: [["", "전체"], ...topics.map((t) => [t, t])], value: topic, onChange: setTopic }), /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, recent.map(card)), recent.length === 0 && /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#6B6B6B]" }, "최근 60일 안에 나온 소식이 없어요."), old.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => setOldOpen(!oldOpen), "aria-expanded": oldOpen, className: "text-[13px] font-semibold text-[#525252] mb-3" }, "지난 소식(발표 60일 지남) ", old.length, "건 ", oldOpen ? "접기 ▲" : "펼치기 ▼"), oldOpen && /* @__PURE__ */ React.createElement("div", { className: "grid lg:grid-cols-2 gap-4 items-stretch" }, old.map(card))));
}
function NewsTheme() {
  const [topic, setTopic] = usePersist("news-topic-v1", "realty");
  const [qInput, setQInput] = useState("");
  const [customQ, setCustomQ] = useState("");
  const t = NEWS_TOPICS.find((x) => x.id === topic) || NEWS_TOPICS[0];
  const runSearch = () => setCustomQ(qInput.trim());
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "실시간 뉴스", title: "주제별 뉴스" }), /* @__PURE__ */ React.createElement(SegRow, { options: NEWS_TOPICS.map((x) => [x.id, x.label]), value: customQ ? "" : topic, onChange: (id) => {
    setTopic(id);
    setCustomQ("");
    setQInput("");
  } }), /* @__PURE__ */ React.createElement("div", { className: "flex gap-2 mb-5" }, /* @__PURE__ */ React.createElement(
    TextInput,
    {
      value: qInput,
      onChange: setQInput,
      placeholder: "직접 검색 (예: 과천 재건축, 특례보금자리)",
      className: "!w-72 !bg-white shadow-sm",
      onKeyDown: (e) => e.key === "Enter" && runSearch()
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: runSearch, className: "h-10 px-4 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold shrink-0" }, "검색"), customQ && /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setCustomQ("");
    setQInput("");
  }, className: "h-10 px-4 rounded-lg bg-white text-[#525252] text-[13px] font-semibold shadow-sm shrink-0" }, "주제별로 돌아가기")), /* @__PURE__ */ React.createElement(NewsPanel, { query: customQ || t.q, eyebrow: customQ ? "직접 검색" : t.label, title: customQ ? `"${customQ}" 뉴스` : `${t.label} 최신 뉴스` })), /* @__PURE__ */ React.createElement(PolicyRadar, null), /* @__PURE__ */ React.createElement("section", { className: "mb-6" }, /* @__PURE__ */ React.createElement(SectionHeader, { eyebrow: "원문이 제일 정확해요", title: "공식 브리핑 바로가기" }), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3" }, OFFICIAL_SOURCES.map(([label, url, desc]) => /* @__PURE__ */ React.createElement(
    "a",
    {
      key: url,
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "rounded-xl bg-white shadow-sm px-4 py-3.5 hover:shadow transition-shadow"
    },
    /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-0.5" }, label),
    /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] leading-snug" }, desc)
  )))), /* @__PURE__ */ React.createElement("div", { className: "masonry" }, /* @__PURE__ */ React.createElement(CustomNotes, { themeId: "news" })));
}
const ADVISOR_THEME_LABEL = { home: "홈", realty: "부동산", saving: "돈 모으기", wedding: "결혼식", kids: "자녀", news: "이슈", ledger: "가계부" };
const ADVISOR_TAB_KEY = { realty: "realty-tab-v1", saving: "saving-tab-v1", wedding: "wedding-tab-v1", kids: "kids-tab-v1" };
const ADVISOR_SUGGESTIONS_BY_THEME = {
  realty: ["우리 조건이면 청약·전세·매매 중 뭐가 맞아?", "과천 59㎡ 전세 시세 알려줘", "특공 소득 기준 통과해?"],
  saving: ["이번 달 가계부 점검해줘", "연금저축·IRP 어떻게 채울까?", "월 저축을 늘리려면 뭘 먼저 봐야 해?"],
  wedding: ["결혼식 예산 어디서 줄일 수 있어?", "지금 해야 할 결혼 준비가 뭐야?", "혼인신고 언제 하는 게 유리해?"]
};
const ADVISOR_SUGGESTIONS = ["지금 우리 최우선 과제가 뭐야?", "이번 달 가계부 점검해줘", "청약 vs 매매, 우리 조건이면 뭐가 맞아?", "결혼식 예산 어디서 줄일 수 있어?"];
const advisorSuggestions = (theme) => [.../* @__PURE__ */ new Set([...ADVISOR_SUGGESTIONS_BY_THEME[theme] || [], ...ADVISOR_SUGGESTIONS])].slice(0, 5);
const clipS = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const noteToPlain = (n) => {
  if (!n || !n.body) return "";
  if (!n.html) return n.body;
  const t = document.createElement("template");
  t.innerHTML = n.body;
  return t.content.textContent || "";
};
const ymKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
function buildAdvisorContext({ hh, theme }) {
  const diag = computeDiagnosis(hh);
  const alloc = store.get("home-alloc-v1", ALLOC_DEFAULT);
  const milestones = store.get("milestones-v1", MILESTONES_DEFAULT).filter((m) => m && m.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12).map((m) => ({ label: m.label, date: m.date, dday: dday(m.date) }));
  const roadmap = (store.get("roadmap-v2", null) || []).map((p) => {
    const c = phaseCalc(p);
    return { title: p.title, start: p.start, end: p.end, done: c.done, total: c.total, timeProgressPct: c.timeR == null ? null : Math.round(c.timeR * 100), status: c.status, behind: c.behind, items: p.items.map((i) => `${i.done ? "✓" : "○"} ${clipS(i.text, 60)}`) };
  });
  const tlDone = store.get("plan-timeline-done-v2", {});
  const flat = timelineFlat();
  const accounts = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT).map((a) => ({ owner: a.owner, type: a.type, balance: a.balance, paidThisYear: a.paid, yearGoal: a.goal }));
  const wInfo = store.get("wedding-info-v1", { date: "", venue: "" });
  const wBudget = store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT).map((b) => ({ cat: budgetCat(b), sub: budgetSub(b), name: b.name, amount: Number(b.spent) > 0 ? Number(b.spent) : b.budget }));
  const wChk = store.get("wedding-checklist-v2", null);
  const wItems = wChk ? wChk.flatMap((g) => g.items || []) : [];
  const entries = store.get("ledger-entries-v1", []);
  const now = /* @__PURE__ */ new Date(), ym = ymKey(now), prevYm = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const catLabel = Object.fromEntries(LEDGER_CATS.map(([k, v]) => [k, v.replace(/^\S+\s/, "")]));
  const sumBy = (list) => {
    const out = { income: 0, expense: 0, byCategory: {} };
    list.forEach((e) => {
      const a = Number(e.amount) || 0;
      if (e.type === "in") out.income += a;
      else if (isExpenseEntry(e)) {
        out.expense += a;
        const c = catLabel[e.cat] || e.cat;
        out.byCategory[c] = (out.byCategory[c] || 0) + a;
      }
    });
    return out;
  };
  const budget = store.get("ledger-budget-v1", {});
  const notes = {};
  Object.keys(ADVISOR_THEME_LABEL).forEach((t) => {
    const ns = store.get(`notes-${t}-v1`, []);
    if (ns.length) notes[ADVISOR_THEME_LABEL[t]] = ns.slice(-6).map((n) => ({ title: clipS(n.title, 40), body: clipS(noteToPlain(n), 200), at: n.at ? todayYmd(new Date(n.at)) : void 0 }));
  });
  const rcDone = store.get("checklist-done-v3", {});
  const rcItems = CHECKLIST_INIT.flatMap((g) => g.items.map((t) => ({ cat: g.cat, text: t, done: !!rcDone[stableKey(g.cat, t)] })));
  const fin = diag.financing;
  return {
    today: todayYmd(),
    units: "부부 정보·홈 자금 배분·돈 모으기 계좌·결혼 예산은 만원, 부동산·가계부 금액은 원",
    loanPolicy: { asOf: policy().loan.asOf, mortgage: policy().loan.mortgage.rules, jeonse: policy().loan.jeonse.rules, programs: policy().loan.programs.map((p) => `${p.name}(${p.deal}): 소득 ${p.incomeMax}만 이하 · ${p.deal === "매매" ? "주택" : "보증금"} ${wonShort(p.priceMax)} 이하 · 한도 ${wonShort(p.limit)} · ${p.cond}`) },
    // (보고 있는 화면은 스냅샷에 넣지 않는다 — 탭만 바꿔도 캐시 접두사가 깨진다. 서버가 volatile 영역에 따로 받는다)
    household: { [hh.label1 || "본인"]: { annualIncome: hh.income1 }, [hh.label2 || "배우자"]: { annualIncome: hh.income2 }, netAssets: hh.assets, monthlySave: hh.monthlySave, existingDebtMonthly: hh.existingDebtMonthly, firstTimeBuyer: hh.firstTime, stressRatePct: hh.rate },
    realty: {
      target: { type: diag.target.label, price: diag.target.price, source: diag.target.key === "custom" ? "직접 입력" : "프리셋" },
      maxLoan: Math.round(diag.maxLoan),
      bindingConstraint: diag.bindingConstraint,
      requiredCash: Math.round(diag.requiredCash),
      cashGap: Math.round(diag.gap),
      monthsToGoal: diag.monthsToGoal,
      financing: { loanType: fin.loanLabel, monthly: Math.round(fin.monthly), monthlyLabel: fin.monthlyLabel, programs: fin.programs.map((p) => `${p.eligible ? "가능" : "불가"} ${p.name} — ${p.reason}`) },
      plan: { done: flat.filter((x) => tlDone[x.key]).length, total: flat.length, undone: flat.filter((x) => !tlDone[x.key]).slice(0, 12).map((x) => x.text) },
      checklist: { done: rcItems.filter((i) => i.done).length, total: rcItems.length, undone: rcItems.filter((i) => !i.done).map((i) => i.text) },
      // 관심 매물 — 상담사가 채팅에서도 비교·언급할 수 있게 요약만
      watchlist: store.get("realty-watchlist-v1", []).slice(-10).map((w) => ({
        title: w.title || w.addr,
        dealType: w.dealType,
        price: w.price,
        rent: w.rent,
        area: w.area,
        addr: w.addr,
        risk: w.review && `${w.review.risk.level}${w.review.risk.score != null ? `(${w.review.risk.score})` : ""}`,
        fit: w.review && `${w.review.fit.level}${w.review.fit.score != null ? `(${w.review.fit.score})` : ""}`
      })),
      eligibilityProfile: (() => {
        const e = resolveElig();
        return { me: e.me, spouse: e.spouse, names: e.names, source: e.auto ? "홈 연소득 ÷ 12 − 비과세(세전)" : "직접 입력", kids: e.kids, fetus: e.fetus, asset: e.asset, car: e.car, household: householdModeLabel(e.householdMode, e.names), residence: (e.residence || []).map((r, i) => `${e.names[i]}: ${r && r.city || "미입력"}${r && r.since ? ` (${r.since} 전입)` : ""}`) };
      })()
    },
    // 화면(홈 자금 흐름·각 탭 연결 바)과 같은 파생 지표 — 상담사가 다른 숫자로 말하지 않게
    derived: (() => {
      const L = ledgerStats();
      return {
        realtyEquityMan: Math.round(diag.equity / 1e4),
        weddingReserveMan: diag.wedding.reserve,
        closingCostMan: Math.round(diag.extra.total / 1e4),
        wedding: { budgetTotal: diag.wedding.total, paid: diag.wedding.paid, remaining: diag.wedding.remaining, overAllocation: diag.wedding.over },
        ledger: { thisMonthNetWon: L.cur.net, thisMonthSaveRatePct: L.saveRate == null ? null : Math.round(L.saveRate * 100), avgMonthlyNetMan3m: L.avgNetMan },
        monthsToGoalByLedger: diag.monthsToGoalActual,
        lockedPensionMan: lockedPensionMan(),
        note: "내 집 자기자본 = 부부 현금 − 결혼 비용(예산·배정 중 큰 값 − 지불 완료) − 연금저축·IRP 잔액(55세 전 인출 시 16.5% 과세라 집에 못 씀). 부족 자금은 부대비용(취득세·중개보수·이사) 포함"
      };
    })(),
    // 돈 모으기는 배정 항목이 아니다 — 부동산·결혼·자녀 배정 후 남는 현금(예전 데이터의 saving은 뺀다)
    homeAllocation: (({ saving, ...a }) => ({
      ...a,
      spareCash: Math.max(0, (Number(a.totalCash) || 0) - (Number(a.realty) || 0) - (Number(a.wedding) || 0) - (Number(a.kids) || 0)),
      cashByPerson: { [hh.label1 || "본인"]: allocCash(a).cash1, [hh.label2 || "배우자"]: allocCash(a).cash2 }
    }))(alloc),
    milestones,
    roadmap,
    saving: { accounts, totalBalance: accounts.reduce((s, a) => s + (a.balance || 0), 0) },
    wedding: {
      date: wInfo.date || null,
      dday: wInfo.date ? dday(wInfo.date) : null,
      venue: wInfo.venue || null,
      confirmedVendors: store.get("wedding-confirmed-v1", {}),
      budget: wBudget,
      totalAmount: wBudget.reduce((s, b) => s + (Number(b.amount) || 0), 0),
      checklist: {
        done: wItems.filter((i) => i.done).length,
        total: wItems.length,
        groups: (wChk || WEDDING_CHECKLIST_DEFAULT).map((g) => g.cat),
        undone: (wChk || []).flatMap((g) => (g.items || []).filter((i) => !i.done).map((i) => `[${g.cat}] ${clipS(i.text, 70)}`)).slice(0, 40)
      },
      guests: store.get("wedding-guests-v1", []).length
    },
    ledger: {
      month: ym,
      thisMonth: sumBy(entries.filter((e) => String(e.date || "").startsWith(ym))),
      prevMonth: (() => {
        const s = sumBy(entries.filter((e) => String(e.date || "").startsWith(prevYm)));
        return { income: s.income, expense: s.expense };
      })(),
      categoryBudget: Object.fromEntries(Object.entries(budget).filter(([, v]) => v > 0).map(([k, v]) => [catLabel[k] || k, v])),
      categoryKeys: Object.fromEntries(LEDGER_CATS.map(([k, v]) => [k, v.replace(/^\S+\s/, "")])),
      fixed: store.get("ledger-fixed-v1", []).map((f) => ({ memo: clipS(f.memo, 30), amount: f.amount, day: f.day, type: f.type === "in" ? "수입" : "지출" })),
      recent: [...entries].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10).map((e) => ({ date: e.date, amount: e.amount, cat: catLabel[e.cat] || e.cat, memo: clipS(e.memo, 30), type: e.type === "in" ? "수입" : "지출" }))
    },
    notes
  };
}
function describeAction(a, hh) {
  const g = a.args || {};
  switch (a.name) {
    case "add_note":
      return { icon: "📝", title: `메모 남기기 · ${ADVISOR_THEME_LABEL[g.theme] || g.theme}`, lines: [g.title, clipS(g.body, 160)] };
    case "set_target":
      return { icon: "🎯", title: "목표 가격 변경", lines: [`${customTargetLabel({ dealType: g.dealType, area: g.area, name: g.name })} → ${won(Number(g.price))}${g.dealType === "월세" && Number(g.rent) > 0 ? ` / 월 ${won(Number(g.rent))}` : ""}`] };
    case "update_household": {
      const L = { income1: `${hh.label1 || "본인"} 연소득`, income2: `${hh.label2 || "배우자"} 연소득`, monthlySave: "월 저축", existingDebtMonthly: "기존 대출 월 상환액", rate: "DSR 계산 금리(%)", firstTime: "생애최초 구입" };
      const lines = Object.keys(L).filter((k) => g[k] !== void 0).map((k) => k === "firstTime" ? `${L[k]}: ${hh[k] ? "예" : "아니오"} → ${g[k] ? "예" : "아니오"}` : k === "rate" ? `${L[k]}: ${hh[k]} → ${g[k]}` : `${L[k]}: ${manWon(hh[k])} → ${manWon(Number(g[k]))}`);
      return { icon: "👫", title: "부부 정보 수정", lines: lines.length ? lines : ["바꿀 항목이 없어요"] };
    }
    case "add_milestone":
      return { icon: "📅", title: "일정 추가", lines: [`${g.label} · ${g.date}`] };
    case "set_checklist_item":
      return { icon: g.done ? "☑" : "☐", title: `${ADVISOR_LIST_LABEL[g.list] || g.list} ${g.done ? "완료 체크" : "체크 해제"}`, lines: [clipS(g.text, 120)] };
    case "add_checklist_item":
      return { icon: "➕", title: `${ADVISOR_LIST_LABEL[g.list] || g.list}에 할 일 추가${g.group ? ` · ${g.group}` : ""}`, lines: [clipS(g.text, 120)] };
    case "set_wedding_budget": {
      const amt = g.amount ?? g.spent ?? g.budget;
      return { icon: "💍", title: `결혼 예산 · ${g.name}`, lines: [amt != null ? `금액 → ${manWon(Number(amt))}` : "", g.cat ? `분류: ${g.cat}${g.sub ? " › " + g.sub : ""}` : ""] };
    }
    case "set_saving_account":
      return { icon: "🏦", title: `계좌 수정 · ${g.owner} ${g.type}`, lines: [g.balance != null ? `잔액 → ${manWon(Number(g.balance))}` : "", g.paid != null ? `올해 납입 → ${manWon(Number(g.paid))}` : "", g.goal != null ? `연 목표 → ${manWon(Number(g.goal))}` : ""] };
    case "set_allocation": {
      const L = { cash1: `${hh.label1 || "본인"} 현금`, cash2: `${hh.label2 || "배우자"} 현금`, realty: "내 집 마련 배정", wedding: "결혼 배정", kids: "자녀 배정" };
      return { icon: "📊", title: "자금 배분 수정", lines: Object.keys(L).filter((k) => g[k] != null).map((k) => `${L[k]} → ${manWon(Number(g[k]))}`) };
    }
    case "set_wedding_info":
      return { icon: "💒", title: "결혼식 정보", lines: [g.date ? `날짜 → ${g.date}` : "", g.venue ? `식장 → ${g.venue}` : ""] };
    case "add_ledger_entry":
      return { icon: "📒", title: `가계부 ${g.type === "in" ? "수입" : "지출"} 기록`, lines: [`${g.date || todayYmd()} · ${won(Number(g.amount))} · ${(LEDGER_CATS.find(([k]) => k === g.cat) || [null, g.cat])[1]}${g.memo ? ` · ${clipS(g.memo, 40)}` : ""}`] };
    case "save_skill":
      return { icon: "🧩", title: `상담 규칙 저장 · ${g.name}`, lines: [`언제 쓰나: ${g.when}`, clipS(g.instructions, 600)] };
    // 저장되는 전체(600자)를 보여준다 — 일부만 보여주면 안 보이는 지시가 승인된다
    case "navigate":
      return { icon: "↗", title: `${ADVISOR_THEME_LABEL[g.theme] || g.theme} 화면으로 이동`, lines: [] };
    default:
      return { icon: "?", title: "알 수 없는 제안이에요", lines: ["이 앱에서 처리할 수 없는 동작이라 적용해도 바뀌지 않아요."] };
  }
}
const ADVISOR_LIST_LABEL = { realty_plan: "부동산 플랜", realty_checklist: "부동산 체크리스트", roadmap: "로드맵", wedding: "결혼 체크리스트", kids: "자녀 체크리스트" };
const normT = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
function matchByText(items, text, get) {
  const t = normT(text);
  if (!t) return null;
  const exact = items.find((i) => normT(get(i)) === t);
  if (exact) return exact;
  const part = items.filter((i) => {
    const n = normT(get(i));
    return n.length >= 2 && (n.includes(t) || t.includes(n));
  });
  return part.length === 1 ? part[0] : null;
}
const setKey = (k, v) => {
  store.set(k, v);
  notifyRemoteKey(k);
};
const groupsOrDefault = (k, def) => store.get(k, null) || def.map((g) => ({ cat: g.cat, items: g.items.map((t) => ({ id: uid(), text: t, done: false })) }));
const numOr = (v) => v == null || v === "" || !Number.isFinite(Number(v)) ? void 0 : Number(v);
function applyAdvisorAction(a, { hh, setHh, setTheme, skills, setSkills }) {
  const g = a.args || {};
  switch (a.name) {
    case "set_checklist_item": {
      const done = !!g.done;
      if (g.list === "realty_plan") {
        const it = matchByText(timelineFlat(), g.text, (x) => x.text);
        if (!it) return false;
        const m = { ...store.get("plan-timeline-done-v2", migratedTimelineDone()) };
        if (done) m[it.key] = true;
        else delete m[it.key];
        setKey("plan-timeline-done-v2", m);
        propagateTask(["plan", it.phase, it.text], done);
        return true;
      }
      if (g.list === "realty_checklist") {
        const all = CHECKLIST_INIT.flatMap((gr) => gr.items.map((t) => ({ cat: gr.cat, text: t })));
        const it = matchByText(all, g.text, (x) => x.text);
        if (!it) return false;
        const m = { ...store.get("checklist-done-v3", {}) };
        const k = stableKey(it.cat, it.text);
        if (done) m[k] = true;
        else delete m[k];
        setKey("checklist-done-v3", m);
        propagateTask(["check", it.cat, it.text], done);
        return true;
      }
      if (g.list === "roadmap") {
        const phases = store.get("roadmap-v2", null) || roadmapInit();
        const flat = phases.flatMap((p) => p.items.map((i) => ({ pid: p.id, ...i })));
        const it = matchByText(flat, g.text, (x) => x.text);
        if (!it) return false;
        setKey("roadmap-v2", phases.map((p) => p.id !== it.pid ? p : { ...p, items: p.items.map((i) => i.id === it.id ? { ...i, done } : i) }));
        const ph = phases.find((p) => p.id === it.pid);
        if (ph && ph.themeId) propagateTask(["roadmap", ph.themeId, it.text], done);
        return true;
      }
      if (g.list === "wedding" || g.list === "kids") {
        const k = g.list === "wedding" ? "wedding-checklist-v2" : "kids-checklist-v1";
        const groups = groupsOrDefault(k, g.list === "wedding" ? WEDDING_CHECKLIST_DEFAULT : KIDS_CHECKLIST_DEFAULT);
        const flat = groups.flatMap((gr, gi) => (gr.items || []).map((i) => ({ gi, ...i })));
        const it = matchByText(flat, String(g.text || "").replace(/^\[[^\]]*\]\s*/, ""), (x) => x.text);
        if (!it) return false;
        setKey(k, groups.map((gr, gi) => gi !== it.gi ? gr : { ...gr, items: gr.items.map((i) => i.id === it.id ? { ...i, done } : i) }));
        if (g.list === "wedding") propagateTask(["wedding", it.text], done);
        return true;
      }
      return false;
    }
    case "add_checklist_item": {
      const text = clipS(g.text, 120);
      if (!text) return false;
      if (g.list === "roadmap") {
        const phases = store.get("roadmap-v2", null) || roadmapInit();
        const p = matchByText(phases, g.group, (x) => x.title) || phases[0];
        if (!p) return false;
        setKey("roadmap-v2", phases.map((x) => x.id !== p.id ? x : { ...x, items: [...x.items, { id: uid(), text, done: false }] }));
        return true;
      }
      if (g.list === "wedding" || g.list === "kids") {
        const k = g.list === "wedding" ? "wedding-checklist-v2" : "kids-checklist-v1";
        const groups = groupsOrDefault(k, g.list === "wedding" ? WEDDING_CHECKLIST_DEFAULT : KIDS_CHECKLIST_DEFAULT);
        const gi = Math.max(0, groups.findIndex((gr) => gr === matchByText(groups, g.group, (x) => x.cat)));
        setKey(k, groups.map((gr, i) => i !== gi ? gr : { ...gr, items: [...gr.items || [], { id: uid(), text, done: false }] }));
        return true;
      }
      return false;
    }
    case "set_wedding_budget": {
      const name = clipS(g.name, 40);
      if (!name) return false;
      const budget = store.get("wedding-budget-v1", WEDDING_BUDGET_DEFAULT);
      const amt = numOr(g.amount) ?? numOr(g.spent) ?? numOr(g.budget);
      if (amt === void 0) return false;
      const cat = clipS(g.cat, 30), sub = clipS(g.sub, 30);
      const hit = matchByText(budget, name, (x) => x.name);
      if (!hit && !cat) return false;
      setKey("wedding-budget-v1", hit ? budget.map((x) => {
        if (x.id !== hit.id) return x;
        const { spent, ...rest } = x;
        return { ...rest, budget: amt };
      }) : [...budget, { id: uid(), cat, sub: sub || "기타", name, budget: amt }]);
      return true;
    }
    case "set_saving_account": {
      const accounts = store.get("saving-accounts-v1", ACCOUNTS_DEFAULT);
      const ownerN = normT(g.owner), typeN = normT(g.type);
      const ownerAlias = { [normT(hh.label1 || "본인")]: "본인", [normT(hh.label2 || "배우자")]: "배우자" };
      const acc = accounts.find((x) => (normT(x.owner) === ownerN || normT(x.owner) === normT(ownerAlias[ownerN] || "")) && normT(x.type) === typeN) || accounts.find((x) => normT(x.type) === typeN && (normT(x.owner).includes(ownerN) || ownerN.includes(normT(x.owner))));
      if (!acc) return false;
      const patch = {};
      ["balance", "paid", "goal"].forEach((k) => {
        const v = numOr(g[k]);
        if (v !== void 0) patch[k] = v;
      });
      if (!Object.keys(patch).length) return false;
      setKey("saving-accounts-v1", accounts.map((x) => x.id === acc.id ? { ...x, ...patch, u: Date.now() } : x));
      return true;
    }
    case "set_allocation": {
      const alloc = { ...ALLOC_DEFAULT, ...store.get("home-alloc-v1", {}) };
      const patch = {};
      ["cash1", "cash2", "realty", "wedding", "kids"].forEach((k) => {
        const v = numOr(g[k]);
        if (v !== void 0) patch[k] = Math.max(0, v);
      });
      if (!Object.keys(patch).length) return false;
      const cash = { ...allocCash(alloc), ..."cash1" in patch ? { cash1: patch.cash1 } : {}, ..."cash2" in patch ? { cash2: patch.cash2 } : {} };
      const totalCash = cash.cash1 + cash.cash2;
      setKey("home-alloc-v1", { ...alloc, ...patch, ...cash, totalCash });
      if (totalCash !== hh.assets) setHh({ assets: totalCash });
      return true;
    }
    case "set_wedding_info": {
      const info = store.get("wedding-info-v1", { date: "", venue: "" });
      const date = g.date ? normYmdStr(g.date) : void 0;
      if (g.date && !date) return false;
      if (date === void 0 && g.venue == null) return false;
      setKey("wedding-info-v1", { ...info, ...date ? { date } : {}, ...g.venue != null ? { venue: clipS(g.venue, 60) } : {} });
      return true;
    }
    case "add_ledger_entry": {
      const amount = Math.round(Number(g.amount) || 0);
      if (!(amount > 0)) return false;
      const cat = LEDGER_CATS.some(([k]) => k === g.cat) ? g.cat : "etc";
      const date = normYmdStr(g.date) || todayYmd();
      setKey("ledger-entries-v1", [...store.get("ledger-entries-v1", []), { id: uid(), date, amount, cat, memo: clipS(g.memo, 60), at: Date.now(), ...g.type === "in" ? { type: "in" } : {} }]);
      return true;
    }
    case "add_note": {
      const t = ADVISOR_THEME_LABEL[g.theme] && g.theme !== "home" ? g.theme : "realty";
      const k = `notes-${t}-v1`;
      store.set(k, [...store.get(k, []), { id: uid(), at: Date.now(), title: clipS(g.title, 80) || "상담 메모", body: clipS(g.body, 160) }]);
      notifyRemoteKey(k);
      return true;
    }
    case "set_target": {
      const price = Number(g.price);
      if (!(price > 0)) return false;
      setHh({ targetKey: "custom", customTarget: { dealType: TARGET_DEAL_TYPES.includes(g.dealType) ? g.dealType : "매매", price: Math.round(price), rent: g.dealType === "월세" ? Math.max(0, Math.round(Number(g.rent) || 0)) : 0, area: Math.round(Number(g.area) || 0), name: clipS(g.name, 40) } });
      return true;
    }
    case "update_household": {
      const patch = {};
      ["income1", "income2", "monthlySave", "existingDebtMonthly", "rate"].forEach((k) => {
        if (g[k] !== void 0 && Number.isFinite(Number(g[k]))) patch[k] = Number(g[k]);
      });
      if (typeof g.firstTime === "boolean") patch.firstTime = g.firstTime;
      if (!Object.keys(patch).length) return false;
      setHh(patch);
      return true;
    }
    case "add_milestone": {
      const date = normYmdStr(g.date);
      if (!date || !g.label) return false;
      store.set("milestones-v1", [...store.get("milestones-v1", MILESTONES_DEFAULT), { id: uid(), at: Date.now(), label: clipS(g.label, 60), date }]);
      notifyRemoteKey("milestones-v1");
      return true;
    }
    case "save_skill": {
      if (!g.name || !g.instructions) return false;
      const name = clipS(g.name, 40);
      setSkills([...skills.filter((s) => s.name !== name), { id: uid(), at: Date.now(), name, when: clipS(g.when, 120), instructions: String(g.instructions).slice(0, 600) }]);
      return true;
    }
    case "navigate": {
      if (!ADVISOR_THEME_LABEL[g.theme]) return false;
      const tk = ADVISOR_TAB_KEY[g.theme];
      if (tk && g.tab) {
        store.set(tk, String(g.tab).slice(0, 20));
        notifyRemoteKey(tk);
      }
      setTheme(g.theme);
      window.scrollTo({ top: 0 });
      return true;
    }
  }
  return false;
}
function AdvisorText({ text }) {
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => seg.startsWith("**") && seg.endsWith("**") ? /* @__PURE__ */ React.createElement("b", { key: i }, seg.slice(2, -2)) : seg);
  const blocks = [];
  let list = null;
  String(text || "").split("\n").forEach((ln, i) => {
    const m = ln.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) {
      if (!list) {
        list = [];
        blocks.push(list);
      }
      list.push(/* @__PURE__ */ React.createElement("li", { key: i }, inline(m[1])));
      return;
    }
    list = null;
    if (ln.trim()) blocks.push(/* @__PURE__ */ React.createElement("p", { key: i }, inline(ln.replace(/^#+\s*/, ""))));
  });
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-1.5 text-[14px] leading-relaxed break-words" }, blocks.map((b, i) => Array.isArray(b) ? /* @__PURE__ */ React.createElement("ul", { key: i, className: "list-disc pl-5 space-y-1" }, b) : b));
}
function ActionCard({ a, hh, onApply, onDismiss }) {
  const d = describeAction(a, hh);
  return /* @__PURE__ */ React.createElement("div", { className: "mt-2 rounded-xl border border-[#E5E5E5] bg-white p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start gap-2" }, /* @__PURE__ */ React.createElement("span", { className: "text-[15px] leading-none mt-0.5" }, d.icon), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold" }, d.title), d.lines.filter(Boolean).map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "text-[12.5px] text-[#525252] leading-relaxed mt-0.5 break-words whitespace-pre-wrap" }, l)), a.external && a.status === "pending" && /* @__PURE__ */ React.createElement("div", { className: "mt-1.5 text-[12px] font-semibold text-[#8A5A00] bg-[#FFF6E5] rounded-lg px-2 py-1" }, "웹 검색 결과를 읽고 나온 제안이에요. 내용을 확인하고 적용해요."))), /* @__PURE__ */ React.createElement("div", { className: "mt-2.5 flex gap-2 items-center" }, a.status === "pending" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { onClick: onApply, className: "h-8 px-3.5 rounded-full bg-[#0A0A0A] text-white text-[12px] font-semibold" }, "적용"), /* @__PURE__ */ React.createElement("button", { onClick: onDismiss, className: "h-8 px-3.5 rounded-full bg-[#F0F0F0] text-[#525252] text-[12px] font-semibold" }, "무시")) : /* @__PURE__ */ React.createElement("span", { className: `text-[12px] font-semibold ${a.status === "done" ? "text-[#1F5D46]" : "text-[#6B6B6B]"}` }, a.status === "done" ? "✓ 적용됨" : a.status === "failed" ? "적용하지 못했어요. 대상 항목을 찾지 못했거나 값이 올바르지 않아요." : "무시함")));
}
const briefHeadline = (t) => String(t || "").split("\n").map((l) => l.replace(/^\s*#+\s*/, "").replace(/^\s*(?:[-*•>]|\d+[.)])\s+/, "").replace(/\*\*/g, "").trim()).find(Boolean) || "";
function Advisor({ user, hh, setHh, theme, setTheme, open, setOpen, onUnread }) {
  const [view, setView] = useState("chat");
  const [chatRaw, setChat] = usePersist("advisor-chat-v1", []);
  const chat = useMemo(() => [...chatRaw].sort((a, b) => (a.at || 0) - (b.at || 0)), [chatRaw]);
  const [skills, setSkills] = usePersist("advisor-skills-v1", []);
  const [brief, setBrief] = usePersist("advisor-brief-v1", { date: "", text: "", at: 0 });
  const [briefSeen, setBriefSeen] = usePersist("advisor-brief-seen-v1", "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [err, setErr] = useState("");
  const [noticeSeen, setNoticeSeen] = usePersist("advisor-notice-seen-v1", false);
  const listRef = useRef(null);
  const taRef = useRef(null);
  const userLabel = user && (user.displayName || String(user.email || "").split("@")[0]) || "사용자";
  const today = todayYmd();
  const unread = brief.date === today && briefSeen !== today && !!brief.text;
  useEffect(() => {
    onUnread && onUnread(unread);
  }, [unread]);
  const actCtx = { hh, setHh, setTheme, skills, setSkills };
  const call = async (mode, messages) => {
    const r = await authFetch("/api/advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        messages,
        context: buildAdvisorContext({ hh, theme }),
        skills: skills.map((s) => ({ name: s.name, when: s.when, instructions: s.instructions })),
        userLabel,
        screen: `${ADVISOR_THEME_LABEL[theme] || theme}${theme === "realty" && store.get("realty-tab-v1", null) ? " · " + store.get("realty-tab-v1", "") : ""}`
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || (r.status === 401 || r.status === 403 ? "허용된 계정으로 로그인해 주세요." : `상담사가 응답하지 못했어요(오류 ${r.status}). 잠시 후 다시 시도해 주세요.`));
    return j;
  };
  const fetchBrief = async (force) => {
    if (briefBusy) return;
    const cur = store.get("advisor-brief-v1", {});
    if (!force && cur.date === today && cur.text) return;
    setBriefBusy(true);
    setErr("");
    try {
      const j = await call("brief", []);
      setBrief({ date: today, text: j.text || "", at: Date.now() });
      if (force) setBriefSeen(today);
    } catch (e) {
      if (force) setErr(String(e && e.message || e));
    } finally {
      setBriefBusy(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => fetchBrief(false), 4e3);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (open && briefOpen && brief.date === today && brief.text) setBriefSeen(today);
  }, [open, briefOpen, brief.date, brief.text]);
  useEffect(() => {
    const down = () => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    };
    down();
    const t = setTimeout(down, 100);
    return () => clearTimeout(t);
  }, [chat.length, open, busy, view]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);
  const send = async (textArg) => {
    const text = String(textArg ?? input).trim();
    if (!text || busy) return;
    setErr("");
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    const um = { id: uid(), at: Date.now(), role: "user", text, by: userLabel };
    const history2 = [...chat.filter((m) => !m.failed), um].slice(-20).map((m) => ({ role: m.role, text: m.text }));
    setChat((prev) => [...prev, um].slice(-80));
    setBusy(true);
    try {
      const j = await call("chat", history2);
      const actions = (j.actions || []).map((a) => ({ id: uid(), name: a.name, args: a.args || {}, status: "pending", ...a.external ? { external: true } : {} }));
      actions.forEach((a) => {
        if (a.name === "navigate") a.status = applyAdvisorAction(a, actCtx) ? "done" : "failed";
      });
      const listings = j.data && Array.isArray(j.data.listings) ? j.data.listings.slice(0, 10) : void 0;
      setChat((prev) => [...prev, { id: uid(), at: Date.now(), role: "model", text: j.text || "", actions, ...listings ? { listings } : {} }].slice(-80));
    } catch (e) {
      const m = String(e && e.message || e);
      setErr(m);
      setChat((prev) => [...prev, { id: uid(), at: Date.now(), role: "model", failed: true, text: `⚠️ 답변을 받지 못했어요. ${m.slice(0, 120)}
같은 질문을 다시 보내 주세요.` }].slice(-80));
    } finally {
      setBusy(false);
    }
  };
  const resolveAction = (msgId, actId, apply) => {
    let ok = false;
    if (apply) {
      const m = chat.find((x) => x.id === msgId);
      const a = m && (m.actions || []).find((x) => x.id === actId);
      ok = !!a && applyAdvisorAction(a, actCtx);
    }
    setChat((prev) => prev.map((m) => m.id !== msgId ? m : { ...m, u: Date.now(), actions: (m.actions || []).map((a) => a.id !== actId ? a : { ...a, status: apply ? ok ? "done" : "failed" : "dismissed" }) }));
  };
  const applyAll = (msgId) => {
    const m = chat.find((x) => x.id === msgId);
    if (!m) return;
    const result = {};
    (m.actions || []).filter((a) => a.status === "pending" && a.name !== "save_skill" && !a.external).forEach((a) => {
      result[a.id] = applyAdvisorAction(a, actCtx) ? "done" : "failed";
    });
    setChat((prev) => prev.map((x) => x.id !== msgId ? x : { ...x, u: Date.now(), actions: (x.actions || []).map((a) => result[a.id] ? { ...a, status: result[a.id] } : a) }));
  };
  const clearChat = () => {
    if (window.confirm("상담 대화를 모두 지울까요? (상대 기기에서도 지워져요)")) {
      setChat([]);
      setErr("");
    }
  };
  const autoGrow = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, open && /* @__PURE__ */ React.createElement("div", { role: "dialog", "aria-label": "우리 전담 상담사", className: "fixed z-40 inset-0 lg:inset-auto lg:right-7 lg:bottom-7 lg:w-[420px] lg:h-[min(720px,calc(100vh-56px))] bg-white lg:rounded-[28px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden", style: { fontFamily: "'Pretendard','Noto Sans KR',sans-serif", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" } }, /* @__PURE__ */ React.createElement("div", { className: "px-4 pt-4 pb-3 border-b border-[#EFEFEF] flex items-center gap-3" }, /* @__PURE__ */ React.createElement("span", { className: "w-9 h-9 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center shrink-0" }, /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 17 })), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[15px] font-bold" }, "우리 전담 상담사"), /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B] truncate" }, "대시보드 전체를 보고 답해요 · 부부 공유 대화")), /* @__PURE__ */ React.createElement("button", { onClick: () => setView(view === "skills" ? "chat" : "skills"), title: "상담사가 따르는 우리 규칙", "aria-label": `상담 규칙 ${skills.length}개`, className: `h-8 px-2.5 rounded-full text-[12px] font-semibold ${view === "skills" ? "bg-[#0A0A0A] text-white" : "bg-[#F0F0F0] text-[#525252]"}` }, "규칙 ", skills.length), view === "chat" && chat.length > 0 && /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "대화 지우기", onClick: clearChat }), /* @__PURE__ */ React.createElement(IconBtn, { name: "x", title: "닫기", onClick: () => setOpen(false) })), view === "chat" && /* @__PURE__ */ React.createElement("div", { className: "border-b border-[#EFEFEF] bg-white" }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
    if (brief.date !== today && !briefBusy) fetchBrief(true);
    setBriefOpen((o) => brief.date !== today ? true : !o);
  }, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[#FAFAFA]" }, /* @__PURE__ */ React.createElement("span", { className: "shrink-0 text-[10.5px] font-bold text-white bg-[#0A0A0A] rounded-full px-2 py-0.5" }, "📌 오늘의 브리핑"), /* @__PURE__ */ React.createElement("span", { className: `flex-1 min-w-0 truncate text-[13px] ${brief.date === today ? "text-[#0A0A0A] font-semibold" : "text-[#6B6B6B]"}` }, briefBusy ? "대시보드를 훑어보고 있어요…" : brief.text ? brief.date === today ? briefHeadline(brief.text) : `${brief.date} 브리핑 · 눌러서 오늘 것 받기` : "오늘 먼저 알려드릴 것을 정리해 드려요"), /* @__PURE__ */ React.createElement(Icon, { name: "chevron", size: 14, className: `shrink-0 text-[#6B6B6B] transition-transform ${briefOpen ? "-rotate-90" : "rotate-90"}` })), briefOpen && /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-3 max-h-[45vh] overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-2 mb-2" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-medium text-[#6B6B6B]" }, "오늘의 브리핑", brief.date ? ` · ${brief.date}` : ""), /* @__PURE__ */ React.createElement("button", { onClick: () => fetchBrief(true), disabled: briefBusy, className: "text-[12px] font-semibold text-[#525252] underline underline-offset-4 disabled:opacity-40" }, briefBusy ? "준비 중…" : brief.text ? "다시 받기" : "브리핑 받기")), brief.text ? /* @__PURE__ */ React.createElement(AdvisorText, { text: brief.text }) : /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#6B6B6B] leading-relaxed" }, "상담사가 대시보드 상태를 보고 지금 중요한 2~3가지를 골라요."))), view === "skills" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto p-4 space-y-3" }, /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#525252] leading-relaxed" }, "규칙은 상담사가 매번 따르는 ", /* @__PURE__ */ React.createElement("b", null, "우리 부부 전용 원칙·점검 절차"), "예요. 대화에서 합의된 원칙을 상담사가 스스로 저장하기도 하고, 여기서 직접 적을 수도 있어요."), skills.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#6B6B6B] bg-[#F7F7F7] rounded-xl p-3" }, '아직 저장된 규칙이 없어요. 예: "전세는 보증보험 가입 가능한 곳만 추천", "월 저축이 목표 미달이면 먼저 경고".'), [...skills].sort((a, b) => (b.at || 0) - (a.at || 0)).map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, className: "rounded-xl border border-[#E5E5E5] p-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] font-bold" }, s.name), s.when && /* @__PURE__ */ React.createElement("div", { className: "text-[12px] text-[#6B6B6B] mt-0.5" }, "언제 쓰나: ", s.when)), /* @__PURE__ */ React.createElement(IconBtn, { name: "trash", title: "삭제", onClick: () => setSkills(skills.filter((x) => x.id !== s.id)) })), /* @__PURE__ */ React.createElement("div", { className: "text-[13px] text-[#525252] leading-relaxed mt-1.5 whitespace-pre-wrap" }, s.instructions)))) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { ref: listRef, className: "flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#FAFAFA]" }, chat.length === 0 && /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold text-[#6B6B6B] mb-2" }, "이렇게 물어보세요"), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-1.5" }, advisorSuggestions(theme).map((s) => /* @__PURE__ */ React.createElement("button", { key: s, onClick: () => send(s), className: "h-8 px-3 rounded-full bg-white border border-[#E5E5E5] text-[12px] font-semibold text-[#525252] hover:border-[#0A0A0A]" }, s)))), chat.map((m) => m.role === "user" ? /* @__PURE__ */ React.createElement("div", { key: m.id, className: "flex flex-col items-end" }, m.by && /* @__PURE__ */ React.createElement("div", { className: "text-[10.5px] text-[#6B6B6B] mb-1 mr-1" }, m.by), /* @__PURE__ */ React.createElement("div", { className: "max-w-[85%] rounded-2xl rounded-br-md bg-[#0A0A0A] text-white px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words" }, m.text)) : /* @__PURE__ */ React.createElement("div", { key: m.id, className: "flex flex-col items-start" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[92%] rounded-2xl rounded-bl-md bg-white border border-[#E5E5E5] px-3.5 py-2.5" }, /* @__PURE__ */ React.createElement(AdvisorText, { text: m.text }), (m.listings || []).length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-2 space-y-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] text-[#6B6B6B]" }, "상담사가 조회한 실거래 ", m.listings.length, "건 · 체결가 기준(현재 매물 아님)"), m.listings.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-[12.5px] flex items-center justify-between gap-2" }, /* @__PURE__ */ React.createElement("div", { className: "min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-semibold truncate" }, l.complex, " ", /* @__PURE__ */ React.createElement("span", { className: "text-[#6B6B6B] font-normal" }, l.dealType, " · ", pyeongText(l.area), l.floor ? ` · ${l.floor}` : "")), /* @__PURE__ */ React.createElement("div", { className: "text-[#6B6B6B] truncate" }, l.region, l.date ? ` · ${l.date}` : "")), /* @__PURE__ */ React.createElement("div", { className: "text-right shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold", style: { fontVariantNumeric: "tabular-nums" } }, wonShort(l.price), l.rent ? /* @__PURE__ */ React.createElement("span", { className: "text-[11px] font-normal text-[#525252]" }, "/월 ", won(l.rent)) : ""), (l.dealType === "매매" || l.dealType === "전세" || l.dealType === "월세") && (hh.targetKey === "custom" && hh.customTarget && Number(hh.customTarget.price) === Math.round(Number(l.price)) && hh.customTarget.name === clipS(l.complex, 40) ? /* @__PURE__ */ React.createElement("span", { className: "mt-1 inline-block h-7 px-2.5 leading-7 rounded-full bg-[#F0F0F0] text-[#1F5D46] text-[11.5px] font-semibold" }, "✓ 현재 목표") : /* @__PURE__ */ React.createElement("button", { onClick: () => applyAdvisorAction({ name: "set_target", args: { dealType: l.dealType, price: l.price, rent: l.rent, area: Math.round(l.area), name: l.complex } }, actCtx), className: "mt-1 h-7 px-2.5 rounded-full bg-[#0A0A0A] text-white text-[11.5px] font-semibold" }, "목표로 설정")))))), (m.actions || []).filter((a) => a.name !== "navigate").map((a) => /* @__PURE__ */ React.createElement(ActionCard, { key: a.id, a, hh, onApply: () => resolveAction(m.id, a.id, true), onDismiss: () => resolveAction(m.id, a.id, false) })), (m.actions || []).filter((a) => a.name !== "navigate" && a.name !== "save_skill" && a.status === "pending" && !a.external).length >= 2 && /* @__PURE__ */ React.createElement("button", { onClick: () => applyAll(m.id), className: "mt-2 w-full h-9 rounded-xl bg-[#0A0A0A] text-white text-[12.5px] font-semibold" }, "제안 ", (m.actions || []).filter((a) => a.name !== "navigate" && a.name !== "save_skill" && a.status === "pending" && !a.external).length, "건 모두 적용")))), busy && /* @__PURE__ */ React.createElement("div", { className: "flex" }, /* @__PURE__ */ React.createElement("div", { className: "rounded-2xl rounded-bl-md bg-white border border-[#E5E5E5] px-3.5 py-2.5 text-[13px] text-[#6B6B6B]" }, "대시보드를 보고 생각 중…")), err && /* @__PURE__ */ React.createElement("div", { className: "text-[12.5px] text-[#A8451F] bg-[#FDF3EE] rounded-xl px-3 py-2 leading-relaxed" }, err)), /* @__PURE__ */ React.createElement("div", { className: "p-3 border-t border-[#EFEFEF] bg-white", style: { paddingBottom: "calc(12px + env(safe-area-inset-bottom))" } }, /* @__PURE__ */ React.createElement("div", { className: "flex items-end gap-2 bg-[#F5F5F5] rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#0A0A0A]" }, /* @__PURE__ */ React.createElement(
    "textarea",
    {
      ref: taRef,
      value: input,
      onChange: (e) => {
        setInput(e.target.value);
        autoGrow(e.target);
      },
      rows: 1,
      placeholder: "무엇이든 물어보세요",
      "aria-label": "상담사에게 질문",
      onKeyDown: (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          send();
        }
      },
      className: "flex-1 bg-transparent resize-none text-[14px] leading-relaxed focus:outline-none py-1.5 max-h-32"
    }
  ), /* @__PURE__ */ React.createElement("button", { onClick: () => send(), disabled: busy || !input.trim(), title: "보내기", className: "w-9 h-9 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center shrink-0 disabled:opacity-30" }, /* @__PURE__ */ React.createElement(Icon, { name: "send", size: 15 }))), noticeSeen ? /* @__PURE__ */ React.createElement("button", { onClick: () => setNoticeSeen(false), className: "mt-1.5 text-[11px] text-[#6B6B6B] underline underline-offset-2" }, "ⓘ 데이터 전송 안내") : /* @__PURE__ */ React.createElement("p", { className: "mt-2 text-[12px] text-[#6B6B6B] leading-relaxed" }, "대화와 대시보드 요약(소득·자산 포함)이 Anthropic Claude API로 전송돼요(학습에 쓰이지 않는 유료 API). 참고용 상담이며 계약·대출·증여 실행 전 전문가 확인을 권해요. ", /* @__PURE__ */ React.createElement("button", { onClick: () => setNoticeSeen(true), className: "underline underline-offset-2 font-semibold" }, "확인"))))));
}
const NAV = [
  { id: "home", label: "홈", icon: "grid", color: "#0A0A0A" },
  ...THEMES.filter((t) => !t.hidden),
  { id: "news", label: "이슈", icon: "news", color: "#3D3D3D", desc: "실시간 경제·정책 뉴스 · 정책 레이더 · 공식 브리핑" }
];
function App({ user }) {
  const [theme, setTheme] = usePersist("active-theme-v1", "home");
  useEffect(() => {
    if (themeOf(theme) && themeOf(theme).hidden) setTheme("home");
  }, [theme]);
  useEffect(() => {
    if (theme === "ledger") {
      store.set("saving-tab-v1", "ledger");
      notifyRemoteKey("saving-tab-v1");
      setTheme("saving");
    }
  }, [theme]);
  useEffect(() => {
    const t = setTimeout(() => {
      reconcileTaskLinks();
      const ms = store.get("milestones-v1", null);
      if (ms && ms.some((m) => m.id === "m1" && m.label === "과천 4단지 청약 접수(예상)"))
        setKey("milestones-v1", ms.map((m) => m.id === "m1" && m.label === "과천 4단지 청약 접수(예상)" ? { ...m, ...MILESTONES_DEFAULT.find((d) => d.id === "m1"), u: Date.now() } : m));
    }, 2500);
    return () => clearTimeout(t);
  }, []);
  useStoreTick(DERIVED_KEYS);
  useEffect(() => {
    const h = (e) => {
      setTheme(e.detail);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener(GO_THEME_EVT, h);
    return () => window.removeEventListener(GO_THEME_EVT, h);
  }, []);
  const [mapKey, setMapKey] = useState(() => store.get("map-key-v1", null));
  const [vapidKey, setVapidKey] = useState("");
  const [privacy, setPrivacy] = usePersist("privacy-mode-v1", false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [advisorUnread, setAdvisorUnread] = useState(false);
  const [policyDoc, setPolicyDoc] = useState(null);
  useEffect(() => {
    if (user) fetchPolicyProposals().then((d) => d && setPolicyDoc(d));
  }, [user && user.email]);
  const att = policyAttention(policyDoc, store.get(POLICY_OVERRIDES_KEY, {}), store.get(POLICY_DISMISSED_KEY, {}));
  const policyDot = att.pending > 0 || att.overdue > 0;
  const [policyBusy, setPolicyBusy] = useState({});
  const [policyErr, setPolicyErr] = useState("");
  const runPolicyReview = async (keys) => {
    const secs = (window.POLICY_DEFAULT || {}).sections || {};
    const todo = keys.filter((k) => !policyBusy[k]);
    if (!todo.length) return;
    setPolicyErr("");
    setPolicyBusy((b) => ({ ...b, ...Object.fromEntries(todo.map((k) => [k, true])) }));
    const clear = (ks) => setPolicyBusy((b) => {
      const n = { ...b };
      ks.forEach((k) => delete n[k]);
      return n;
    });
    try {
      const r = await withTimeout(authFetch("/api/policy-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sections: todo }) }), 2e4, "점검 요청이 지연돼요");
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.jobId) throw new Error(j.message || `점검을 요청하지 못했어요(오류 ${r.status}).`);
      const started = Date.now(), finished = /* @__PURE__ */ new Set();
      while (finished.size < todo.length && Date.now() - started < 10 * 60 * 1e3) {
        await new Promise((res) => setTimeout(res, 4e3));
        const jr = await authFetch(`/api/policy-job?id=${encodeURIComponent(j.jobId)}`).catch(() => null);
        if (!jr || !jr.ok) continue;
        const job = await jr.json().catch(() => null);
        if (!job) continue;
        const newly = todo.filter((k) => !finished.has(k) && (job.state[k] === "done" || job.state[k] === "failed"));
        if (!newly.length) continue;
        newly.forEach((k) => finished.add(k));
        clear(newly);
        const fresh = await fetchPolicyProposals();
        if (fresh) setPolicyDoc(fresh);
        const errs = todo.filter((k) => job.state[k] === "failed").map((k) => `${(secs[k] || {}).label || k}: ${(job.errors || {})[k] || "점검 실패"}`);
        setPolicyErr(errs.join("\n"));
      }
      if (finished.size < todo.length) setPolicyErr((e) => (e ? e + "\n" : "") + "일부 항목이 10분 안에 끝나지 않았어요. 잠시 후 설정을 다시 열어 확인해 주세요.");
    } catch (e) {
      setPolicyErr(String(e && e.message || e));
    } finally {
      clear(todo);
    }
  };
  const policyRunning = Object.keys(policyBusy).length > 0;
  const cur = NAV.find((n) => n.id === theme) || NAV[0];
  useEffect(() => {
    let alive = true;
    const settle = () => setMapKey((k) => k ?? "");
    const tryLoad = (n) => fetch(api("/api/config")).then((r) => r.ok ? r.json() : Promise.reject(new Error("config_" + r.status))).then((c) => {
      if (!alive || !c || !(c.naverMapKey || c.fcmVapidKey)) throw new Error("config_empty");
      if (c.naverMapKey) {
        setMapKey(c.naverMapKey);
        store.set("map-key-v1", c.naverMapKey);
      } else settle();
      if (c.fcmVapidKey) setVapidKey(c.fcmVapidKey);
    }).catch(() => {
      if (alive && n < 3) return setTimeout(() => tryLoad(n + 1), 2e3 * (n + 1));
      if (alive) settle();
    });
    tryLoad(0);
    return () => {
      alive = false;
    };
  }, []);
  const [pushOn, setPushOn] = useState(() => !!store.get("push-token-v1", ""));
  const [pushBusy, setPushBusy] = useState(false);
  const enablePush = async () => {
    try {
      setPushBusy(true);
      if (!(window.firebase && firebase.messaging && window.FIREBASE_CONFIG)) throw new Error("여기서는 알림을 켤 수 없어요. 배포된 사이트에서 켜 주세요.");
      if (!vapidKey) throw new Error("서버에 알림용 키가 아직 설정되지 않았어요(관리자 확인 필요).");
      if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("이 브라우저는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 뒤 그 앱에서 켜 주세요.");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.");
      const reg = await withTimeout(navigator.serviceWorker.register("./firebase-messaging-sw.js").then(() => navigator.serviceWorker.ready), 15e3, "알림 준비(서비스워커 등록)가 늦어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
      const token = await withTimeout(firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: reg }), 25e3, "알림 등록이 늦어요. 브라우저 알림 권한과 Windows 알림 설정(집중 지원·알림 끄기)을 확인하고 다시 시도해 주세요.");
      if (!token) throw new Error("알림 등록 정보를 받지 못했어요. 다시 시도해 주세요.");
      const r = await withTimeout(authFetch("/api/push-register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, ua: navigator.userAgent.slice(0, 200) }) }), 15e3, "서버 등록이 늦어요. 잠시 후 다시 시도해 주세요.");
      if (!r.ok) throw new Error("서버에 등록하지 못했어요. 잠시 후 다시 시도해 주세요.");
      store.set("push-token-v1", token);
      setPushOn(true);
      authFetch("/api/push-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => {
      });
    } catch (e) {
      console.error("push_enable_failed:", e);
      alert("알림을 켜지 못했어요.\n" + (e && e.message || e));
    } finally {
      setPushBusy(false);
    }
  };
  const disablePush = async () => {
    const token = store.get("push-token-v1", "");
    try {
      setPushBusy(true);
      if (token) {
        const r = await withTimeout(authFetch("/api/push-register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, remove: true }) }), 15e3, "서버 응답이 늦어요.");
        if (!r.ok) throw new Error("서버에서 알림을 해제하지 못했어요.");
      }
      try {
        await firebase.messaging().deleteToken();
      } catch {
      }
      store.set("push-token-v1", "");
      setPushOn(false);
    } catch (e) {
      alert("알림을 끄지 못했어요. " + (e && e.message || e) + "\n네트워크를 확인하고 다시 시도해 주세요.");
    } finally {
      setPushBusy(false);
    }
  };
  useEffect(() => {
    if (!pushOn || !(window.firebase && firebase.messaging && window.FIREBASE_CONFIG)) return;
    let off = null;
    try {
      off = firebase.messaging().onMessage((p) => {
        const d = p && p.data || {};
        if (Notification.permission !== "granted") return;
        navigator.serviceWorker.ready.then((reg) => reg.showNotification(d.title || "우리 라이프 플랜", { body: d.body || "", icon: "./icon-192.png", tag: d.tag || "realty-notice" })).catch(() => {
        });
      });
    } catch {
    }
    return () => {
      if (typeof off === "function") off();
    };
  }, [pushOn]);
  const [hh, setHhRaw] = useState(() => ({ ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) }));
  const setHh = (patch) => setHhRaw((p) => {
    const n = { ...p, ...patch };
    store.set("household-inputs-v2", n);
    return n;
  });
  useLedgerAutoFill(hh);
  useEffect(() => {
    const h = (e) => {
      if (e.detail === "household-inputs-v2") setHhRaw({ ...HH_DEFAULT, ...store.get("household-inputs-v2", {}) });
    };
    window.addEventListener(REMOTE_EVT, h);
    return () => window.removeEventListener(REMOTE_EVT, h);
  }, []);
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen bg-[#F4F4F5] text-[#0A0A0A]", style: { fontFamily: "'Pretendard','Noto Sans KR',sans-serif" } }, /* @__PURE__ */ React.createElement("aside", { className: "hidden lg:flex fixed inset-y-0 left-0 w-60 bg-[#0A0A0A] text-white flex-col z-30" }, /* @__PURE__ */ React.createElement("div", { className: "px-7 pt-9 pb-10" }, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-medium text-white/60" }, "2026 · 우리 둘의 계획"), /* @__PURE__ */ React.createElement("div", { className: "text-[19px] font-bold tracking-tight mt-2" }, "우리 라이프 플랜")), /* @__PURE__ */ React.createElement("div", { className: "px-4 space-y-1.5 flex-1" }, NAV.map((t) => {
    const active = theme === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        "aria-current": theme === t.id ? "page" : void 0,
        onClick: () => {
          setTheme(t.id);
          window.scrollTo({ top: 0 });
        },
        className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-colors ${active ? "bg-white text-[#0A0A0A] font-bold" : "text-white/50 hover:text-white hover:bg-white/5 font-semibold"}`
      },
      /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 16 }),
      t.label
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "px-4 pb-7" }, user && /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2.5 px-4 py-3 mb-1 rounded-xl bg-white/5" }, user.photoURL ? /* @__PURE__ */ React.createElement("img", { src: user.photoURL, referrerPolicy: "no-referrer", alt: "", className: "w-7 h-7 rounded-full shrink-0" }) : /* @__PURE__ */ React.createElement("span", { className: "w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold shrink-0" }, (user.email || "?")[0].toUpperCase()), /* @__PURE__ */ React.createElement("div", { className: "min-w-0 flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "text-[12px] font-semibold truncate" }, user.displayName || user.email), /* @__PURE__ */ React.createElement("div", { className: "text-[10px] text-white/35" }, "클라우드 동기화 중")), /* @__PURE__ */ React.createElement("button", { onClick: () => window.confirm("로그아웃하면 이 기기에 저장된 데이터를 지워요 (클라우드에서 다시 불러옵니다). 계속할까요?") && signOutAndWipe(), className: "text-[11px] font-semibold text-white/60 hover:text-white shrink-0" }, "로그아웃")), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: pushOn ? disablePush : enablePush,
      disabled: pushBusy,
      title: "신규 청약·LH 공고를 매일 아침 푸시로 (기기별 설정)",
      className: `w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${pushOn ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"} ${pushBusy ? "opacity-50" : ""}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "bell", size: 15 }),
    pushBusy ? "알림 설정 중…" : pushOn ? "공고 알림 끄기 (지금 켜짐)" : "공고 알림 켜기"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setPrivacy(!privacy),
      title: "소득·자산 등 부부 정보 블러",
      className: `w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${privacy ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: privacy ? "eyeOff" : "eye", size: 15 }),
    privacy ? "금액 다시 보기 (지금 가림)" : "금액 가리기"
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setAdvisorOpen((o) => !o),
      "aria-expanded": advisorOpen,
      className: `w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold transition-colors ${advisorOpen ? "bg-white text-[#0A0A0A]" : "text-white hover:bg-white/10"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 15 }),
    "AI 상담사",
    advisorUnread && !advisorOpen && /* @__PURE__ */ React.createElement("span", { className: "ml-auto w-2 h-2 rounded-full bg-[#E5484D]", "aria-label": "새 브리핑" })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      className: "w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 15 }),
    "설정",
    policyRunning ? /* @__PURE__ */ React.createElement("span", { className: "ml-auto text-[11px] text-white/70" }, "점검 중…") : policyDot && /* @__PURE__ */ React.createElement("span", { className: "ml-auto w-2 h-2 rounded-full bg-[#E5484D]", "aria-label": "정책 데이터 확인 필요" })
  ))), /* @__PURE__ */ React.createElement("div", { className: "lg:pl-60" }, /* @__PURE__ */ React.createElement("header", { className: "px-5 pt-5 sm:pt-9 pb-1 sm:px-10", style: { paddingTop: "max(20px, env(safe-area-inset-top))" } }, /* @__PURE__ */ React.createElement("div", { className: "max-w-[1160px] mx-auto flex items-start justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", { className: "text-[24px] sm:text-[34px] font-bold leading-tight tracking-tight" }, theme === "home" ? "우리 라이프 플랜" : cur.label === "부동산" ? "과천 내 집 마련" : cur.label), /* @__PURE__ */ React.createElement("p", { className: "hidden sm:block mt-1.5 text-[14px] text-[#6B6B6B]" }, theme === "home" ? "총 자금 배분 · 테마 요약 · 통합 타임라인" : cur.desc)), /* @__PURE__ */ React.createElement("div", { className: "lg:hidden flex items-center gap-2 shrink-0" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: pushOn ? disablePush : enablePush,
      disabled: pushBusy,
      title: pushOn ? "공고 알림 켜져 있음 — 누르면 꺼요" : "공고 알림 켜기",
      "aria-label": pushOn ? "공고 알림 끄기" : "공고 알림 켜기",
      "aria-pressed": pushOn,
      className: `w-11 h-11 rounded-full flex items-center justify-center border ${pushOn ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"} ${pushBusy ? "opacity-50" : ""}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "bell", size: 17 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setPrivacy(!privacy),
      title: privacy ? "금액을 가리고 있어요 — 누르면 다시 보여요" : "소득·자산 금액 가리기",
      "aria-label": privacy ? "금액 다시 보기" : "금액 가리기",
      "aria-pressed": privacy,
      className: `w-11 h-11 rounded-full flex items-center justify-center border ${privacy ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white text-[#525252] border-[#E5E5E5]"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: privacy ? "eyeOff" : "eye", size: 17 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setSettingsOpen(true),
      title: "설정",
      className: "relative w-11 h-11 rounded-full flex items-center justify-center border bg-white text-[#525252] border-[#E5E5E5]"
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 17 }),
    (policyRunning || policyDot) && /* @__PURE__ */ React.createElement("span", { className: `absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${policyRunning ? "bg-[#0A0A0A] animate-pulse" : "bg-[#E5484D]"}`, "aria-label": policyRunning ? "정책 점검 중" : "정책 데이터 확인 필요" })
  ), user && (user.photoURL ? /* @__PURE__ */ React.createElement("img", { src: user.photoURL, referrerPolicy: "no-referrer", alt: "", title: user.email + " · 탭하면 로그아웃", onClick: () => window.confirm("로그아웃할까요?") && signOutAndWipe(), className: "w-11 h-11 rounded-full border border-[#E5E5E5] cursor-pointer" }) : /* @__PURE__ */ React.createElement("button", { onClick: () => window.confirm("로그아웃할까요?") && signOutAndWipe(), className: "w-11 h-11 rounded-full bg-[#0A0A0A] text-white text-[13px] font-bold" }, (user.email || "?")[0].toUpperCase()))))), /* @__PURE__ */ React.createElement("main", { className: "max-w-[1160px] mx-auto px-5 sm:px-10 py-7 space-y-6" }, theme === "home" && /* @__PURE__ */ React.createElement(HomeTheme, { setTheme, hh, setHh, privacy }), theme === "realty" && /* @__PURE__ */ React.createElement(RealtyTheme, { mapKey, hh, setHh, setTheme, privacy }), theme === "saving" && /* @__PURE__ */ React.createElement(SavingTheme, { hh, privacy }), theme === "wedding" && /* @__PURE__ */ React.createElement(WeddingTheme, { hh, privacy }), theme === "news" && /* @__PURE__ */ React.createElement(NewsTheme, null)), /* @__PURE__ */ React.createElement("footer", { className: "text-center text-[12px] text-[#737373] pb-32 lg:pb-10 px-5 leading-relaxed" }, "이 도구는 참고용 시뮬레이션이에요. 법률·세무·투자 자문이 아니니, 실행 전에 은행·세무사·청약 전문가에게 확인해요.")), /* @__PURE__ */ React.createElement("nav", { className: "lg:hidden fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full bg-[#0A0A0A]/95 backdrop-blur px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28)]", style: { bottom: "calc(20px + env(safe-area-inset-bottom))" } }, NAV.map((t) => {
    const active = theme === t.id;
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        "aria-current": active ? "page" : void 0,
        onClick: () => {
          setTheme(t.id);
          window.scrollTo({ top: 0 });
        },
        className: `flex flex-col items-center gap-0.5 rounded-2xl min-w-[46px] px-1.5 py-1.5 transition-colors ${active ? "bg-white text-[#0A0A0A]" : "text-white/70 hover:text-white"}`
      },
      /* @__PURE__ */ React.createElement(Icon, { name: t.icon, size: 17 }),
      /* @__PURE__ */ React.createElement("span", { className: "text-[10.5px] font-semibold whitespace-nowrap" }, t.label)
    );
  }), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setAdvisorOpen((o) => !o),
      "aria-expanded": advisorOpen,
      "aria-label": "AI 상담사",
      className: `relative flex flex-col items-center gap-0.5 rounded-2xl min-w-[46px] px-1.5 py-1.5 transition-colors ${advisorOpen ? "bg-white text-[#0A0A0A]" : "text-white/70 hover:text-white"}`
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "sparkle", size: 17 }),
    /* @__PURE__ */ React.createElement("span", { className: "text-[10.5px] font-semibold" }, "상담"),
    advisorUnread && !advisorOpen && /* @__PURE__ */ React.createElement("span", { className: "absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-[#E5484D]", "aria-label": "새 브리핑" })
  )), /* @__PURE__ */ React.createElement(SettingsModal, { open: settingsOpen, onClose: () => setSettingsOpen(false), hh, setHh, policyDoc, policyBusy, policyErr, onPolicyReview: runPolicyReview }), /* @__PURE__ */ React.createElement(Advisor, { user, hh, setHh, theme, setTheme, open: advisorOpen, setOpen: setAdvisorOpen, onUnread: setAdvisorUnread }));
}
async function checkAllowed() {
  try {
    const r = await withTimeout(authFetch("/api/me"), 15e3, "me_timeout");
    if (r.status === 401 || r.status === 403) return false;
    return true;
  } catch {
    return true;
  }
}
function useAuth() {
  const [auth, setAuth] = useState({ status: cloud.enabled ? "loading" : "local", user: null });
  useEffect(() => {
    if (!cloud.enabled) return;
    cloud.init();
    let seq = 0;
    return firebase.auth().onAuthStateChanged(async (u) => {
      const my = ++seq;
      cloud.user = u;
      if (!u) {
        setAuth({ status: "signedout", user: null });
        return;
      }
      const allowed = await checkAllowed();
      if (my !== seq) return;
      if (!allowed) {
        setAuth({ status: "denied", user: u });
        return;
      }
      await cloud.pullOnce();
      if (my !== seq) return;
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
    alert("주소가 복사됐어요. Safari(또는 Chrome)를 직접 열고 주소창에 붙여넣어 접속해 주세요.");
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
  return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "text-[11px] font-medium text-[#6B6B6B]" }, "2026 · 우리 둘의 계획"), /* @__PURE__ */ React.createElement("h1", { className: "text-2xl font-bold tracking-tight mt-2 mb-1.5" }, "우리 라이프 플랜"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#6B6B6B] mb-7" }, "허용된 계정만 접근할 수 있어요."), inApp && /* @__PURE__ */ React.createElement("div", { className: "mb-5 text-left bg-[#F5F5F5] rounded-xl p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-[13px] font-bold mb-1" }, "지금 앱 안의 브라우저로 열려 있어요"), /* @__PURE__ */ React.createElement("p", { className: "text-[12px] text-[#525252] leading-relaxed mb-3" }, "구글 보안 정책상 카카오톡·인스타 등 앱 안의 브라우저에서는 구글 로그인이 막혀 있어요. 외부 브라우저(Safari·Chrome)로 열면 로그인돼요."), /* @__PURE__ */ React.createElement("button", { onClick: openExternal, className: "w-full h-10 rounded-lg bg-[#0A0A0A] text-white text-[13px] font-semibold" }, "외부 브라우저로 열기")), /* @__PURE__ */ React.createElement("button", { onClick: login, className: "w-full h-12 rounded-xl bg-[#0A0A0A] text-white font-semibold flex items-center justify-center gap-2.5" }, /* @__PURE__ */ React.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24" }, /* @__PURE__ */ React.createElement("path", { fill: "#fff", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".7", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".5", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), /* @__PURE__ */ React.createElement("path", { fill: "#fff", opacity: ".85", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })), "Google로 로그인"), err && /* @__PURE__ */ React.createElement("p", { className: "mt-4 text-[12px] text-[#525252] bg-[#F5F5F5] rounded-lg px-3 py-2 break-all" }, err));
}
function DeniedScreen({ user }) {
  return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 22 })), /* @__PURE__ */ React.createElement("h1", { className: "text-xl font-bold tracking-tight mb-1.5" }, "접근 권한이 없어요"), /* @__PURE__ */ React.createElement("p", { className: "text-[14px] text-[#6B6B6B] mb-1 break-all" }, user && user.email), /* @__PURE__ */ React.createElement("p", { className: "text-[13px] text-[#6B6B6B] mb-6 leading-relaxed" }, "이 계정은 허용 목록에 없어요. 관리자에게 이 계정을 허용 목록(", /* @__PURE__ */ React.createElement("code", { className: "font-mono text-[11px] bg-[#F5F5F5] px-1 rounded" }, "functions/.env"), "·firestore.rules)에 추가해 달라고 요청해 주세요."), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    try {
      firebase.auth().signOut();
    } catch {
    }
  }, className: "w-full h-11 rounded-xl border border-[#E5E5E5] font-semibold text-[#525252]" }, "다른 계정으로 로그인"));
}
function useCloudStatus() {
  const [st, setSt] = useState(cloud.status);
  useEffect(() => {
    const h = () => setSt(cloud.status);
    window.addEventListener(CLOUD_STATUS_EVT, h);
    return () => window.removeEventListener(CLOUD_STATUS_EVT, h);
  }, []);
  return st;
}
const CLOUD_ERR_HINT = { "permission-denied": "저장 권한이 없어요. 허용 계정과 Firestore 규칙을 확인해 주세요", "invalid-argument": "저장 문서가 너무 크거나(최대 1MB) 형식이 잘못됐어요" };
function Root() {
  const auth = useAuth();
  const cs = useCloudStatus();
  useEffect(() => {
    if (auth.status !== "ok") return;
    return cloud.subscribe(() => {
    });
  }, [auth.status]);
  if (auth.status === "loading") return /* @__PURE__ */ React.createElement(AuthShell, null, /* @__PURE__ */ React.createElement("div", { className: "text-[14px] text-[#6B6B6B] py-6" }, "로그인 확인 중…"));
  if (auth.status === "signedout") return /* @__PURE__ */ React.createElement(LoginScreen, null);
  if (auth.status === "denied") return /* @__PURE__ */ React.createElement(DeniedScreen, { user: auth.user });
  return /* @__PURE__ */ React.createElement(React.Fragment, null, cloud.enabled && !cloud.hydrated && /* @__PURE__ */ React.createElement("div", { className: "fixed top-0 inset-x-0 z-50 bg-[#8A5A00] text-white text-[12px] font-semibold px-4 py-2 text-center" }, "클라우드에 연결하지 못했어요. 지금은 이 기기에만 저장되고 상대방과 동기화되지 않아요. 새로고침해 주세요."), cloud.enabled && cloud.hydrated && cs.error && /* @__PURE__ */ React.createElement("div", { className: "fixed top-0 inset-x-0 z-50 bg-[#A8451F] text-white text-[12px] font-semibold px-4 py-2 text-center" }, "클라우드에 저장하지 못해 데이터가 동기화되지 않아요", cs.permanent ? ` (${CLOUD_ERR_HINT[cs.error] || cs.error}). 다시 시도하지 않고 멈췄어요. 새로고침 후에도 계속되면 관리자에게 문의해 주세요.` : ". 자동으로 다시 시도하고 있어요…"), cloud.enabled && cloud.hydrated && !cs.error && cs.sizeBytes > DOC_SIZE_WARN_BYTES && /* @__PURE__ */ React.createElement("div", { className: "fixed top-0 inset-x-0 z-50 bg-[#8A5A00] text-white text-[12px] font-semibold px-4 py-2 text-center" }, "클라우드 문서가 커지고 있어요 (약 ", Math.round(cs.sizeBytes / 1024).toLocaleString(), "KB / 상한 1,024KB). 곧 저장이 실패할 수 있어요. 오래된 가계부 기록·메모를 정리해 주세요."), /* @__PURE__ */ React.createElement(App, { user: auth.user }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Root, null));
