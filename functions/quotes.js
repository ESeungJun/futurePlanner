/*
 * 주식·ETF 현재가 (/api/quotes) — 소스 순서
 *   국내: ① KIS 한국투자증권 오픈API(공식, 키 있을 때만) → ② 네이버 폴링(비공식) → ③ 야후(.KS/.KQ, 비공식) → ④ 금융위 주식시세정보(공식, 전일 종가)
 *   해외: ① KIS → ② 야후
 * 환율 USDKRW는 야후 KRW=X(비공식), 해외 종목이 있을 때만.
 * KIS 접근토큰은 발급 제한(분당 1회)이 있어 Firestore kisToken/current 에 만료시각과 함께 두고 재사용한다(클라이언트 접근은 rules catch-all 이 막는다).
 * 필드명은 koreainvestment/open-trading-api examples_llm(domestic_stock/inquire_price, overseas_stock/price, kis_auth.py) 기준.
 */
const KIS_BASE = "https://openapi.koreainvestment.com:9443";
const UA = { "User-Agent": "Mozilla/5.0" };
const DOMESTIC = /^\d[0-9A-Z]{5}$/; // 6자리 숫자, ETF·ETN 신규 코드(예: 0091P0)는 영숫자
const OVERSEAS = /^[A-Z][A-Z.]{0,5}$/;
const TTL_MS = 60 * 1000, FAIL_TTL_MS = 15 * 1000;

// "270,000" / "-15,500" / "-5.43" → 숫자 (빈 값·"-" 는 null)
const num = (s) => { const v = parseFloat(String(s == null ? "" : s).replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
// KIS 대비부호: 1 상한 2 상승 3 보합 4 하한 5 하락 — 대비 값이 부호 없이 올 수 있어 부호를 붙인다
const signed = (v, sign) => (v == null ? null : ["4", "5"].includes(String(sign)) ? -Math.abs(v) : ["1", "2"].includes(String(sign)) ? Math.abs(v) : sign === "3" ? 0 : v);
const YAHOO_MKT = { NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NYQ: "NYSE", PCX: "NYSE Arca", ASE: "AMEX", BTS: "BATS", KSC: "KOSPI", KOE: "KOSDAQ" };

// 코드 목록 검증 — 대문자화·중복 제거, 형식이 틀리면 null (라우터가 400)
function parseCodes(raw) {
  const codes = [...new Set(String(raw || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!codes.length || codes.length > 30) return null;
  return codes.every((c) => DOMESTIC.test(c) || OVERSEAS.test(c)) ? codes : null;
}

function parseNaver(j, code) {
  const d = j && Array.isArray(j.datas) && j.datas[0];
  const price = d && num(d.closePrice);
  if (!d || price == null) return null;
  const ex = d.stockExchangeType || {};
  return { code, name: d.stockName || code, market: ex.name || "KRX", currency: "KRW", price,
    change: num(d.compareToPreviousClosePrice), changePct: num(d.fluctuationsRatio),
    time: d.localTradedAt ? new Date(d.localTradedAt).toISOString() : new Date().toISOString(),
    source: "naver", official: false, delayed: Number(ex.delayTime) > 0 };
}

function parseYahoo(j, code) {
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || typeof m.regularMarketPrice !== "number") return null;
  const prev = typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : null;
  const change = prev ? +(m.regularMarketPrice - prev).toFixed(4) : null;
  return { code, name: m.shortName || m.longName || code, market: YAHOO_MKT[m.exchangeName] || m.exchangeName || "", currency: m.currency || "",
    price: m.regularMarketPrice, change, changePct: prev ? +((change / prev) * 100).toFixed(2) : null,
    time: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    source: "yahoo", official: false, delayed: true };
}

function parseFsc(j, code) {
  let items = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item;
  items = (Array.isArray(items) ? items : items ? [items] : []).filter((it) => it.srtnCd === code);
  const it = items.sort((a, b) => String(b.basDt).localeCompare(String(a.basDt)))[0];
  if (!it || num(it.clpr) == null) return null;
  const d = String(it.basDt);
  return { code, name: it.itmsNm || code, market: it.mrktCtg || "KRX", currency: "KRW", price: num(it.clpr), change: num(it.vs), changePct: num(it.fltRt),
    time: new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T15:30:00+09:00`).toISOString(), // 기준일 장 마감
    source: "fsc", official: true, delayed: true };
}

function createQuotes({ env, db, mapLimit }) {
  const cache = new Map(); // code → { at, item, error }
  const getJson = async (url, opts = {}) => {
    const r = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`http_${r.status}`);
    return r.json();
  };

  // ---- KIS ----
  const hasKis = () => !!(env("KIS_APP_KEY") && env("KIS_APP_SECRET"));
  let tokenMem = null, tokenPending = null, tokenFailedAt = 0;
  async function kisToken() {
    if (tokenMem && tokenMem.expiresAt - Date.now() > 10 * 60e3) return tokenMem.token;
    if (tokenPending) return tokenPending;
    if (Date.now() - tokenFailedAt < 60e3) throw new Error("kis_token_cooldown"); // 발급 제한(분당 1회)에 걸리지 않게
    tokenPending = (async () => {
      const ref = db.doc("kisToken/current");
      const snap = await ref.get().catch(() => null);
      const saved = snap && snap.exists ? snap.data() : null;
      if (saved && saved.token && saved.expiresAt - Date.now() > 10 * 60e3) { tokenMem = saved; return saved.token; }
      const r = await fetch(`${KIS_BASE}/oauth2/tokenP`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: env("KIS_APP_KEY"), appsecret: env("KIS_APP_SECRET") }), signal: AbortSignal.timeout(8000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) { tokenFailedAt = Date.now(); throw new Error(`kis_token_${r.status}`); }
      // access_token_token_expired: "YYYY-MM-DD HH:MM:SS"(KST) — 없으면 expires_in(초), 그것도 없으면 24시간
      const exp = Date.parse(String(j.access_token_token_expired || "").replace(" ", "T") + "+09:00");
      tokenMem = { token: j.access_token, expiresAt: Number.isFinite(exp) ? exp : Date.now() + (Number(j.expires_in) || 86400) * 1000, issuedAt: Date.now() };
      await ref.set(tokenMem).catch(() => {});
      return tokenMem.token;
    })().finally(() => { tokenPending = null; });
    return tokenPending;
  }
  async function kisGet(path, trId, params) {
    const token = await kisToken();
    const j = await getJson(`${KIS_BASE}${path}?${new URLSearchParams(params)}`, { headers: { "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`, appkey: env("KIS_APP_KEY"), appsecret: env("KIS_APP_SECRET"), tr_id: trId, custtype: "P" } });
    if (j.rt_cd !== "0") throw new Error(`kis_${j.msg_cd || j.rt_cd}`);
    return j.output || {};
  }
  async function kisDomestic(code) {
    const o = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", { FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code });
    const price = num(o.stck_prpr);
    if (!price) return null;
    return { code, name: code, market: /KOSDAQ|KSQ/i.test(String(o.rprs_mrkt_kor_name || "")) ? "KOSDAQ" : "KOSPI", currency: "KRW", price,
      change: signed(num(o.prdy_vrss), o.prdy_vrss_sign), changePct: signed(num(o.prdy_ctrt), o.prdy_vrss_sign),
      time: new Date().toISOString(), source: "kis", official: true, delayed: false };
  }
  async function kisOverseas(code) {
    for (const [excd, market] of [["NAS", "NASDAQ"], ["NYS", "NYSE"], ["AMS", "AMEX"]]) {
      const o = await kisGet("/uapi/overseas-price/v1/quotations/price", "HHDFS00000300", { AUTH: "", EXCD: excd, SYMB: code }).catch((e) => { if (/token/.test(e.message)) throw e; return {}; });
      const price = num(o.last);
      if (price) return { code, name: code, market, currency: "USD", price, change: signed(num(o.diff), o.sign), changePct: signed(num(o.rate), o.sign),
        time: new Date().toISOString(), source: "kis", official: true, delayed: false };
    }
    return null;
  }

  // ---- 비공식·공공 ----
  const naver = async (code) => parseNaver(await getJson(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`), code);
  const yahoo = async (sym, code) => parseYahoo(await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`), code);
  async function fsc(code) {
    const key = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
    if (!key) return null;
    const since = new Date(Date.now() + 9 * 3600e3 - 14 * 86400e3).toISOString().slice(0, 10).replace(/-/g, "");
    return parseFsc(await getJson(`https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?serviceKey=${encodeURIComponent(key)}&resultType=json&numOfRows=20&pageNo=1&likeSrtnCd=${code}&beginBasDt=${since}`), code);
  }

  async function quoteOne(code) {
    const c = cache.get(code);
    if (c && Date.now() - c.at < (c.item ? TTL_MS : FAIL_TTL_MS)) return c;
    const dom = DOMESTIC.test(code);
    const chain = dom
      ? [hasKis() && (() => kisDomestic(code)), () => naver(code), () => yahoo(`${code}.KS`, code), () => yahoo(`${code}.KQ`, code), () => fsc(code)]
      : [hasKis() && (() => kisOverseas(code)), () => yahoo(code, code)];
    const errs = [];
    for (const f of chain.filter(Boolean)) {
      try { const item = await f(); if (item) { const out = { at: Date.now(), item }; cache.set(code, out); return out; } }
      catch (e) { errs.push(String((e && e.message) || e).slice(0, 60)); }
    }
    const out = { at: Date.now(), item: null, error: errs.length ? errs.join(" / ") : "not_found" };
    cache.set(code, out);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return out;
  }

  let fxCache = null;
  async function usdkrw() {
    if (fxCache && Date.now() - fxCache.at < (fxCache.fx.USDKRW ? TTL_MS : FAIL_TTL_MS)) return fxCache.fx;
    let fx = { USDKRW: null, time: null, source: "yahoo" };
    try { const q = await yahoo("KRW=X", "USDKRW"); if (q) fx = { USDKRW: q.price, time: q.time, source: "yahoo" }; } catch {}
    fxCache = { at: Date.now(), fx };
    return fx;
  }

  async function getQuotes(codes) {
    const rs = await mapLimit(codes, 5, quoteOne);
    const items = [], errors = [];
    rs.forEach((r, i) => (r && r.item ? items.push(r.item) : errors.push({ code: codes[i], message: (r && r.error) || "not_found" })));
    const fx = codes.some((c) => !DOMESTIC.test(c)) ? await usdkrw() : null;
    return { items, fx, at: new Date().toISOString(), errors };
  }

  return { getQuotes };
}

module.exports = { createQuotes, parseCodes, parseNaver, parseYahoo, parseFsc, signed };
