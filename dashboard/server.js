/*
 * 선택적 프록시 + 정적 서버 (의존성 없음, Node 18+)
 *
 *   node server.js            → http://localhost:5173
 *   CHEONGYAK_KEY=xxx node server.js   → 청약 실데이터 활성화
 *
 * 왜 필요한가: 청약홈(공공데이터) API와 네이버 부동산 내부 API는 브라우저에서
 * 직접 호출 시 CORS/인증으로 막힌다. 이 서버가 대리 호출 후 정규화해서 넘긴다.
 * 키가 없으면 각 엔드포인트는 503을 반환하고, 프론트는 샘플데이터로 폴백한다.
 *
 * ⚠️ /api/naver-land 는 네이버의 비공식 내부 API를 호출한다. 개인 참고용으로만
 *    사용하고, 서비스 약관/차단 정책을 유의할 것.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

// env 파일 자동 로드 (같은 폴더, 의존성 없음). 우선순위: 실제 환경변수 > env.product > .env.product > .env
for (const name of ["env.product", ".env.product", ".env"]) {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, name), "utf8");
    envFile.split("\n").forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
    console.log(`  env 로드: ${name}`);
  } catch {}
}

const PORT = process.env.PORT || 5173;
const CHEONGYAK_KEY = process.env.CHEONGYAK_KEY || ""; // data.go.kr serviceKey (decoded)
const ROOT = __dirname;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function sendJSON(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
}

// --- 청약홈 APT 분양정보 (공공데이터포털 ApplyhomeInfoDetailSvc/v1) ---
// 공고 상세(getAPTLttotPblancDetail) + 주택형별(getAPTLttotPblancMdl)을 조합해
// 평형·분양가·특공(신혼/생애최초/신생아) 세대수까지 정규화한다.
const APPLYHOME_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
let cheongyakCache = { at: 0, payload: null }; // 일일 호출량 보호용 캐시 (5분)

function ymToDash(ym) { // "202906" → "2029-06"
  const s = String(ym || "");
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : (s || null);
}

async function handleCheongyak(res) {
  if (!CHEONGYAK_KEY) return sendJSON(res, 503, { error: "no_key", message: "CHEONGYAK_KEY 미설정 — 샘플데이터를 사용하세요." });
  if (cheongyakCache.payload && Date.now() - cheongyakCache.at < 5 * 60 * 1000) {
    return sendJSON(res, 200, cheongyakCache.payload);
  }
  try {
    const key = `serviceKey=${encodeURIComponent(CHEONGYAK_KEY)}`;
    // 최근 6개월 모집공고만
    const since = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10);
    const listUrl = `${APPLYHOME_BASE}/getAPTLttotPblancDetail?page=1&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    const r = await fetch(listUrl, { headers: { Accept: "application/json" } });
    if (!r.ok) return sendJSON(res, 502, { error: "upstream", status: r.status });
    const raw = await r.json();
    const list = (raw.data || []).slice(0, 60);

    // 공고별 주택형(평형·분양가·특공 세대수) 병렬 조회
    const models = await Promise.all(list.map((d) =>
      fetch(`${APPLYHOME_BASE}/getAPTLttotPblancMdl?page=1&perPage=50&cond[HOUSE_MANAGE_NO::EQ]=${encodeURIComponent(d.HOUSE_MANAGE_NO)}&cond[PBLANC_NO::EQ]=${encodeURIComponent(d.PBLANC_NO)}&${key}`,
        { headers: { Accept: "application/json" } })
        .then((mr) => (mr.ok ? mr.json() : { data: [] }))
        .catch(() => ({ data: [] }))
    ));

    const items = list.map((d, i) => {
      const mdl = (models[i] && models[i].data) || [];
      const areas = [...new Set(mdl.map((m) => Math.floor(parseFloat(m.HOUSE_TY)) || null).filter(Boolean))].sort((a, b) => a - b);
      const prices = mdl.map((m) => Number(m.LTTOT_TOP_AMOUNT) || 0).filter((v) => v > 0);
      const sum = (k) => mdl.reduce((s, m) => s + (Number(m[k]) || 0), 0);
      const types = [];
      if (sum("SUPLY_HSHLDCO") > 0) types.push("일반공급");
      if (sum("NWWDS_HSHLDCO") > 0) types.push("신혼특공");
      if (sum("LFE_FRST_HSHLDCO") > 0) types.push("생애최초");
      if (sum("NWBB_HSHLDCO") > 0) types.push("신생아");
      return {
        id: d.PBLANC_NO || d.HOUSE_MANAGE_NO,
        name: d.HOUSE_NM || d.BSNS_MBY_NM || "분양단지",
        region: d.SUBSCRPT_AREA_CODE_NM || "",
        addr: d.HSSPLY_ADRES || "",
        types: types.length ? types : [d.HOUSE_DTL_SECD_NM || d.HOUSE_SECD_NM || "일반공급"],
        areas,
        priceMin: prices.length ? Math.min(...prices) * 10000 : null,
        priceMax: prices.length ? Math.max(...prices) * 10000 : null,
        totalUnits: Number(d.TOT_SUPLY_HSHLDCO) || null,
        specialUnits: sum("SPSPLY_HSHLDCO") || null,
        applyStart: d.RCEPT_BGNDE || d.SPSPLY_RCEPT_BGNDE || null,
        applyEnd: d.RCEPT_ENDDE || null,
        announceDate: d.PRZWNER_PRESNATN_DE || null,
        moveIn: ymToDash(d.MVN_PREARNGE_YM),
        constructor: d.CNSTRCT_ENTRPS_NM || null,
        priceCap: d.PARCPRC_ULS_AT === "Y", // 분양가상한제
        lat: null, lng: null, // 좌표 미제공 API — 지도 마커는 샘플/직접 입력만
        url: d.PBLANC_URL || "https://www.applyhome.co.kr",
      };
    }).sort((a, b) => (b.applyStart || "").localeCompare(a.applyStart || ""));

    const payload = { source: "live", items, fetchedAt: new Date().toISOString() };
    cheongyakCache = { at: Date.now(), payload };
    sendJSON(res, 200, payload);
  } catch (e) {
    sendJSON(res, 502, { error: "fetch_failed", message: String(e) });
  }
}

// --- 국토부 아파트 실거래가 (매매+전월세) — data.go.kr 공식 API ---
// 네이버 비공식 API가 봇 차단(429/행)으로 사실상 막혀서 공식 실거래가로 전환.
// 키는 data.go.kr 계정 공용(MOLIT_KEY 없으면 CHEONGYAK_KEY 재사용) — 두 실거래가 API 활용신청 필요.
const MOLIT_KEY = process.env.MOLIT_KEY || CHEONGYAK_KEY;
const LAWD_NAMES = { 41290: "경기도 과천시" };
let molitCache = { key: "", at: 0, payload: null }; // 5분 메모리 캐시
const xmlPick = (block, ...tags) => {
  for (const t of tags) { const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); if (m) return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(); }
  return "";
};
const molitNum = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

async function fetchMolit(lawd) {
  // 일자를 1로 고정 — setMonth로 빼면 31일에 롤오버가 나서 한 달이 통째로 빠진다
  const nowM = new Date();
  const months = [0, 1, 2].map((i) => { const d = new Date(nowM.getFullYear(), nowM.getMonth() - i, 1); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const key = encodeURIComponent(MOLIT_KEY);
  const reqs = [];
  for (const ym of months) {
    reqs.push(["trade", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    reqs.push(["rent", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    // 빌라(연립·다세대) 매매·전월세
    reqs.push(["trade", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    reqs.push(["rent", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
  }
  const items = [];
  const xmls = await Promise.all(reqs.map(async ([kind, bldg, u]) => {
    try { return [kind, bldg, await (await fetch(u, { signal: AbortSignal.timeout(12000) })).text()]; }
    catch { return [kind, bldg, ""]; } // 개별 API 실패(미신청 등)해도 나머지는 계속
  }));
  let unauthorized = 0;
  for (const [kind, bldg, xml] of xmls) {
    if (!xml.includes("<item>")) {
      if (/SERVICE_KEY|Unauthorized|등록되지 않은|SERVICE ERROR/i.test(xml)) unauthorized++;
      continue; // 해당 월 거래 없음 또는 미신청
    }
    for (const block of xml.split("<item>").slice(1)) {
      const apt = xmlPick(block, "aptNm", "mhouseNm", "아파트", "연립다세대");
      if (!apt) continue;
      const umd = xmlPick(block, "umdNm", "법정동");
      const jibun = xmlPick(block, "jibun", "지번");
      const areaEx = parseFloat(xmlPick(block, "excluUseAr", "전용면적")) || 0;
      const floor = xmlPick(block, "floor", "층");
      const built = molitNum(xmlPick(block, "buildYear", "건축년도")) || null;
      const dy = xmlPick(block, "dealYear", "년"), dm = xmlPick(block, "dealMonth", "월"), dd = xmlPick(block, "dealDay", "일");
      const dateStr = `${dy}-${String(dm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const base = {
        complex: apt, region: umd.trim(), addr: `${LAWD_NAMES[lawd] || ""} ${umd} ${jibun}`.trim(),
        area: Math.round(areaEx), exclusive: areaEx, floor: floor ? `${floor}층` : "", built, bldg,
        lat: null, lng: null, tags: [`${dateStr} 실거래`], _d: dateStr,
      };
      if (kind === "trade") {
        items.push({ ...base, id: `t${bldg}${apt}${dateStr}${items.length}`, dealType: "매매", price: molitNum(xmlPick(block, "dealAmount", "거래금액")) * 10000, rent: 0, priceText: null });
      } else {
        const rent = molitNum(xmlPick(block, "monthlyRent", "월세금액"));
        items.push({ ...base, id: `r${bldg}${apt}${dateStr}${items.length}`, dealType: rent > 0 ? "월세" : "전세", price: molitNum(xmlPick(block, "deposit", "보증금액")) * 10000, rent: rent * 10000, priceText: null });
      }
    }
  }
  if (!items.length && unauthorized > 0) throw new Error("molit_unauthorized: data.go.kr에서 실거래가 API(아파트·연립다세대) 활용신청 필요");
  items.sort((a, b) => (b._d || "").localeCompare(a._d || ""));
  return items.slice(0, 200);
}

// 매물·실거래 통합: ① 국토부 실거래가(공식) → ② 네이버(비공식, 5초 타임아웃) → ③ 503(프론트 샘플 폴백)
async function handleRealty(res, query) {
  const lawd = LAWD_NAMES[query.get("lawd")] ? String(query.get("lawd")) : "41290"; // 지원 지역만 (요청 1건 = 업스트림 12건)
  if (molitCache.payload && molitCache.key === lawd && Date.now() - molitCache.at < 5 * 60 * 1000) {
    return sendJSON(res, 200, molitCache.payload);
  }
  if (MOLIT_KEY) {
    try {
      const items = await fetchMolit(lawd);
      if (items.length) {
        const payload = { source: "live", kind: "molit", items, fetchedAt: new Date().toISOString() };
        molitCache = { key: lawd, at: Date.now(), payload };
        return sendJSON(res, 200, payload);
      }
    } catch (e) { console.error("molit_failed:", String(e).slice(0, 200)); }
  }
  return handleNaverLand(res, query); // 폴백 (대부분 차단되지만 시도)
}

// --- LH 분양·임대 공고 (data.go.kr B552555) — 행복주택·국민임대·공공분양 등 실시간 공고 ---
// 활용신청: 「한국토지주택공사_분양임대공고문 조회 서비스」 (키는 data.go.kr 계정 공용)
let lhCache = { at: 0, payload: null };
async function handleLhNotices(res) {
  const KEY = process.env.LH_KEY || CHEONGYAK_KEY;
  if (!KEY) return sendJSON(res, 503, { error: "no_key", message: "CHEONGYAK_KEY/LH_KEY 미설정 — 안내 링크를 사용하세요." });
  if (lhCache.payload && Date.now() - lhCache.at < 10 * 60 * 1000) return sendJSON(res, 200, lhCache.payload);
  try {
    const r = await fetch(`https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${encodeURIComponent(KEY)}&PG_SZ=100&PAGE=1`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: "application/json" },
    });
    const text = await r.text();
    const t = text.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) {
      return sendJSON(res, 503, { error: "unauthorized", message: "LH 공고 API 미신청 — data.go.kr에서 「LH 분양임대공고문 조회」 활용신청 필요" });
    }
    const j = JSON.parse(t);
    const list = Array.isArray(j) ? j.flatMap((o) => (o && o.dsList) ? o.dsList : []) : (j.dsList || []);
    const items = list.map((d) => ({
      id: d.PAN_ID || d.PAN_NM,
      name: d.PAN_NM || "",
      category: d.UPP_AIS_TP_NM || "", // 임대주택/분양주택 등 대분류
      type: d.AIS_TP_CD_NM || "",      // 행복주택/국민임대/공공분양 등
      region: d.CNP_CD_NM || "",
      postedAt: d.PAN_NT_ST_DT || "",
      closeAt: d.CLSG_DT || "",
      status: d.PAN_SS || "",          // 공고 상태 (접수중 등)
      url: d.DTL_URL || "",
    })).filter((x) => x.name && !/토지|상가|점포|주차|용지|사무|근생/.test(`${x.category} ${x.type}`)); // 주택 공고만 (토지·상가 제외)
    if (!items.length) return sendJSON(res, 502, { error: "empty", message: "LH 응답에 공고가 없습니다." });
    const payload = { source: "live", items, fetchedAt: new Date().toISOString() };
    lhCache = { at: Date.now(), payload };
    sendJSON(res, 200, payload);
  } catch (e) {
    sendJSON(res, 502, { error: "fetch_failed", message: String(e).slice(0, 200) });
  }
}

// --- 네이버 부동산 (비공식 내부 API) ---
async function handleNaverLand(res, query) {
  const raw = query.get("cortarNo") || "";
  const cortarNo = /^\d{4,12}$/.test(raw) ? raw : "4129010700"; // 숫자 코드만 허용 (URL 파라미터 주입 방지), 기본: 과천 별양동
  try {
    const url = `https://new.land.naver.com/api/articles?cortarNo=${cortarNo}&order=rank&realEstateType=APT&tradeType=&page=1`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 데이터센터 IP는 응답 없이 행 걸리는 경우가 많아 짧게 제한
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://new.land.naver.com/",
        Accept: "application/json",
      },
    });
    if (!r.ok) return sendJSON(res, 502, { error: "upstream", status: r.status, message: "네이버가 차단했을 수 있습니다. 샘플데이터를 사용하세요." });
    const raw = await r.json();
    const items = (raw.articleList || []).map((a) => ({
      id: a.articleNo,
      complex: a.articleName,
      region: a.divisionName || "",
      addr: a.detailAddress || "",
      dealType: a.tradeTypeName,
      area: Math.round(Number(a.area2) || 0),
      exclusive: Number(a.area2) || null,
      price: null, rent: 0,
      priceText: a.dealOrWarrantPrc,
      floor: a.floorInfo,
      built: null,
      lat: Number(a.latitude) || null, lng: Number(a.longitude) || null,
      tags: a.tagList || [],
    }));
    sendJSON(res, 200, { source: "live", items });
  } catch (e) {
    sendJSON(res, 502, { error: "fetch_failed", message: String(e) });
  }
}

// --- 은행 주담대 금리 — 금감원 「금융상품 한눈에」 공시 API (FSS_KEY, 무료) ---
// LLM 추정치가 아닌 공시값. 키가 있으면 bankloans 토픽은 Claude 대신 이쪽을 쓴다.
const FSS_KEY = process.env.FSS_KEY || "";
const FSS_BASE = "https://finlife.fss.or.kr/finlifeapi";
const FSS_LINK = "https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007";

async function fetchFssBankloans() {
  const base = [], opts = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${FSS_BASE}/mortgageLoanProductsSearch.json?auth=${encodeURIComponent(FSS_KEY)}&topFinGrpNo=020000&pageNo=${page}`);
    if (!r.ok) throw new Error("fss_upstream_" + r.status);
    const j = (await r.json()).result;
    if (!j || (j.err_cd && j.err_cd !== "000")) throw new Error(`fss_err_${j && j.err_cd}: ${(j && j.err_msg) || ""}`);
    base.push(...(j.baseList || []));
    opts.push(...(j.optionList || []));
    if (page >= Number(j.max_page_no || 1)) break;
  }
  const byProduct = new Map();
  for (const o of opts) {
    const k = `${o.fin_co_no}|${o.fin_prdt_cd}`;
    if (!byProduct.has(k)) byProduct.set(k, []);
    byProduct.get(k).push(o);
  }
  const products = base.map((b) => {
    const all = byProduct.get(`${b.fin_co_no}|${b.fin_prdt_cd}`) || [];
    const apt = all.filter((o) => o.mrtg_type === "A"); // 아파트 담보 우선
    const use = apt.length ? apt : all;
    const mins = use.map((o) => Number(o.lend_rate_min)).filter((v) => v > 0);
    const maxs = use.map((o) => Number(o.lend_rate_max)).filter((v) => v > 0);
    if (!mins.length || !maxs.length) return null;
    const rateTypes = [...new Set(use.map((o) => o.lend_rate_type_nm).filter(Boolean))];
    const rpays = [...new Set(use.map((o) => o.rpay_type_nm).filter(Boolean))];
    const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
    return {
      bank: clean(b.kor_co_nm),
      product: clean(b.fin_prdt_nm),
      rateMin: Math.min(...mins),
      rateMax: Math.max(...maxs),
      rateType: [rateTypes.join("/"), rpays.join("·")].filter(Boolean).join(" · ").slice(0, 60),
      feature: [b.loan_lmt && `한도 ${clean(b.loan_lmt)}`, b.erly_rpay_fee && `중도상환 ${clean(b.erly_rpay_fee)}`]
        .filter(Boolean).join(" · ").slice(0, 100) || "금감원 공시 상품",
      link: FSS_LINK,
    };
  }).filter(Boolean);
  const byBank = new Map(); // 은행별 대표 1개 (아파트 최저금리 기준)
  for (const p of products) {
    const cur = byBank.get(p.bank);
    if (!cur || p.rateMin < cur.rateMin) byBank.set(p.bank, p);
  }
  const items = [...byBank.values()].sort((a, b) => a.rateMin - b.rateMin);
  if (!items.length) throw new Error("fss_empty");
  return items;
}

// --- 실시간 리서치 (Gemini API — 무료 티어, aistudio.google.com/apikey) ---
// 하드코딩된 기본 데이터 대신, 요청 시 Gemini가 웹을 검색해 최신 정보를 JSON으로 정리한다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
// 모델 후보 — 앞에서부터 시도, 404(모델 종료·미제공)면 다음 후보로 자동 전환.
// ⚠️ gemini-flash-latest 별칭은 무료 쿼터가 없는 모델을 가리킬 수 있어 제외.
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean);
let geminiModelIdx = 0;
const RESEARCH_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 캐시 (수동 새로고침은 force=1)
const RESEARCH_CACHE_FILE = path.join(__dirname, "data", "research-cache.json");
let researchCache = {};
try { researchCache = JSON.parse(fs.readFileSync(RESEARCH_CACHE_FILE, "utf8")); } catch {}

function objSchema(itemProps, required) {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: { type: "object", properties: itemProps, required, additionalProperties: false } },
    },
    required: ["items"],
    additionalProperties: false,
  };
}

const today = () => new Date().toISOString().slice(0, 10);
// 쿼리 파라미터는 LLM 프롬프트에 삽입되므로 길이 제한 + 공백 정규화 (프롬프트 인젝션·비용 남용 방지)
const qstr = (q, k, max = 40) => String((q && q.get(k)) || "").replace(/\s+/g, " ").trim().slice(0, max);
const qnum = (q, k, cap = 99999) => Math.max(0, Math.min(cap, Number((q && q.get(k)) || 0) || 0));
// 결혼식 준비 업체(스튜디오/드레스/메이크업) 공통 스키마 — 프론트 WeddingVendorTab과 필드 일치
const vendorSchema = objSchema({
  name: { type: "string" }, area: { type: "string", description: "구·동 단위 지역" },
  price: { type: "string", description: "대표 가격대 (예: 패키지 180~250만, 추정이면 '추정' 표기)" },
  note: { type: "string", description: "인기 이유·스타일 한 줄" },
}, ["name", "area", "price", "note"]);
const vendorPrompt = (label, extra) => (q) => {
  const area = qstr(q, "area");
  return `오늘은 ${today()}. 웹을 검색해서 지금 시점 ${area || "서울"}에서 예비부부가 실제로 많이 계약하는 인기 ${label} 8~10곳을 조사해줘. ${extra} 최근 후기 기준 대표 가격대(추정치면 '추정' 표기)와 지역, 왜 인기인지 한 줄. 한국어로.`;
};
const RESEARCH_TOPICS = {
  venues: {
    verify: "웨딩홀",
    prompt: (q) => {
      const vtype = qstr(q, "vtype", 10);
      const area = qstr(q, "area");
      const maxMeal = qnum(q, "maxMeal", 999);
      return `오늘은 ${today()}. 웹을 검색해서 지금 시점 ${area || "서울"}에서 평범한 직장인 커플이 실제로 많이 계약하는 인기 결혼식장(웨딩홀) 10곳을 조사해줘. ${vtype ? `유형은 ${vtype} 위주로.` : "하우스/채플/컨벤션 위주로 골고루."} ${maxMeal > 0 ? `1인 식대 ${maxMeal}만원 이하인 곳만.` : "(특급호텔 등 1인 식대 13만원 이상인 최고가 식장은 제외)"} 최근 후기·보도 기준 1인 식대와 대관료(추정치면 값에 '추정' 표기), 수용 인원, 왜 인기인지 한 줄. 한국어로.`;
    },
    schema: objSchema({
      name: { type: "string" }, area: { type: "string", description: "구 단위 지역" },
      type: { type: "string", enum: ["호텔", "하우스", "채플", "컨벤션", "기타"] },
      meal: { type: "string", description: "1인 식대 (예: 8~11만)" }, fee: { type: "string", description: "대관료 (예: 750~980만)" },
      cap: { type: "string", description: "수용 인원" }, note: { type: "string", description: "인기 이유 한 줄" },
    }, ["name", "area", "type", "meal", "fee", "cap", "note"]),
  },
  // 장기전세주택 공고 (SH 시프트·미리내집, GH, LH) — 온디맨드 리서치 + 링크·마감일 서버 검증
  longlease: {
    verifyLinks: true,
    prompt: () => `오늘은 ${today()}. 웹을 검색해서 ${today().slice(0, 7)} 기준으로 접수 중이거나 접수 예정인 수도권(서울·과천·경기) 장기전세주택 공고를 5~10건 조사해줘. SH 장기전세주택(시프트)과 장기전세주택Ⅱ(미리내집), GH·LH 장기전세형 임대를 포함해. ⚠️ 이미 접수가 끝난 과거 공고는 절대 포함하지 마. link는 실제 접속 가능한 공식 페이지가 확실할 때만 넣고 조금이라도 불확실하면 빈 문자열("")로 둬. 맞벌이 신혼부부 관점 소득·자산 기준 요약, 접수 일정, 공급 규모 포함. 확실하지 않은 값은 '추정' 또는 '공고 확인 필요'로 표기. 한국어로.`,
    schema: objSchema({
      name: { type: "string", description: "단지·공고명" },
      agency: { type: "string", description: "공급기관 (SH/GH/LH 등)" },
      area: { type: "string", description: "지역 (구·시)" },
      deadline: { type: "string", description: "접수 기간·공고 상태" },
      supply: { type: "string", description: "공급 호수·평형 요약" },
      income: { type: "string", description: "신혼부부 소득·자산 기준 요약" },
      note: { type: "string", description: "특이사항 한 줄 (미리내집 여부 등)" },
      link: { type: "string", description: "공고 URL" },
    }, ["name", "agency", "area", "deadline", "supply", "income", "note", "link"]),
  },
  studios: { verify: "웨딩 스튜디오", prompt: vendorPrompt("웨딩 촬영 스튜디오·스냅팀", "인스타그램에서 화제인 감성 스냅·화보 스타일 위주로. 인물/감성/필름/야외 등 스타일과 인스타 계정을 note에 표기."), schema: vendorSchema },
  dresses: { verify: "웨딩드레스", prompt: vendorPrompt("웨딩드레스샵", "실루엣·분위기(클래식/모던 등)를 note에 표기."), schema: vendorSchema },
  makeup: { verify: "웨딩 메이크업", prompt: vendorPrompt("웨딩 헤어·메이크업샵", "인스타그램에서 인기 있는 감각적인 샵을 포함해 청담 등 주요 상권 위주로, 신부 메이크업 스타일을 note에 표기."), schema: vendorSchema },
  policies: {
    prompt: (q) => `오늘은 ${today()}. 웹을 검색해서 대한민국 신혼부부/예비부부가 지금 받을 수 있는 저축·세제·주거 정책 혜택을 10~14개 조사해줘. 기준: 부부합산 연소득 ${qnum(q, "income", 999999) || 15700}만원 맞벌이 무주택 신혼부부. 각 정책의 대상 조건과 혜택(구체적 숫자), 이 부부 기준 실제 적용 가능 여부를 판정해줘. fit은 good(가능)/warn(조건부·부분가능)/bad(소득 등 요건 초과)/neutral(확인필요). link는 공식 안내 URL. 한국어로.`,
    schema: objSchema({
      name: { type: "string" }, target: { type: "string", description: "대상 조건 요약" },
      benefit: { type: "string", description: "혜택 요약 (숫자 포함)" },
      fit: { type: "string", enum: ["good", "warn", "bad", "neutral"] },
      fitText: { type: "string", description: "짧은 판정 라벨 (예: 가능, 소득 초과)" },
      why: { type: "string", description: "판정 이유" }, link: { type: "string" },
    }, ["name", "target", "benefit", "fit", "fitText", "why", "link"]),
  },
  bankloans: {
    prompt: () => `오늘은 ${today()}. 웹을 검색해서 한국 주요 은행 8곳(KB국민·신한·하나·우리·NH농협·IBK기업·카카오뱅크·케이뱅크)의 아파트 구입자금 주택담보대출 대표 상품과 현재 금리 범위를 조사해줘. 최근 공시·기사 기준(추정치면 feature에 '추정' 표기). rateMin/rateMax는 % 숫자. 한국어로.`,
    schema: objSchema({
      bank: { type: "string" }, product: { type: "string" },
      rateMin: { type: "number" }, rateMax: { type: "number" },
      rateType: { type: "string", description: "금리 유형 (변동/혼합 등)" },
      feature: { type: "string", description: "특징 한 줄" }, link: { type: "string" },
    }, ["bank", "product", "rateMin", "rateMax", "rateType", "feature", "link"]),
  },
};

// Gemini responseSchema는 OpenAPI 서브셋 — additionalProperties 등 미지원 키워드 제거
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === "additionalProperties") continue;
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

async function callGemini(body, { retry429 = true } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = GEMINI_MODELS[Math.min(geminiModelIdx, GEMINI_MODELS.length - 1)];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (r.status === 404 && geminiModelIdx < GEMINI_MODELS.length - 1) { geminiModelIdx++; continue; } // 모델 종료 → 다음 후보
    if (r.status === 429 && retry429 && attempt < 3) { await new Promise((s) => setTimeout(s, 20000)); continue; } // 분당 제한 → 잠시 후 재시도
    if (!r.ok) throw new Error(`gemini_${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return parts.map((p) => p.text || "").join("");
  }
  throw new Error("gemini_retry_limit: 무료 티어 분당 제한 — 1~2분 뒤 다시 시도하세요.");
}

// ① Google 검색 grounding으로 웹 조사 시도(무료 티어는 검색 쿼터가 없어 429가 날 수 있음 → 건너뜀)
// ② 조사 결과(있으면) 또는 모델 자체 지식으로 responseSchema에 맞는 JSON 생성.
//    grounding과 JSON 강제 출력은 한 호출에서 함께 못 써서 단계를 나눈다.
async function callGeminiResearch(prompt, schema) {
  let research = "";
  try {
    research = await callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }, { retry429: false }); // 검색 쿼터 없으면 즉시 폴백 (재시도로 시간 낭비 X)
  } catch (e) {
    console.warn("gemini_search_skip:", String(e).slice(0, 120)); // best-effort — 실패 시 모델 지식으로 진행
  }
  const structured = await callGemini({
    contents: [{ role: "user", parts: [{ text: research.trim()
      ? `아래는 웹 조사 결과야. 원 요청의 항목들을 스키마에 맞는 JSON으로 정리해줘. 조사 결과에 없는 내용은 지어내지 말고, 값이 불확실하면 '추정'을 표기해. 한국어로.\n\n[원 요청]\n${prompt}\n\n[조사 결과]\n${research}`
      : `${prompt}\n\n(웹 검색 도구 없이 네가 알고 있는 최신 정보 기준으로 답해. 실존하는 곳만 담고, 가격 등 불확실한 값에는 '추정'을 표기해.)` }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
  });
  return JSON.parse(structured);
}

// --- 업체 실존 검증 (네이버 지역검색 API — developers.naver.com, 무료 25,000회/일) ---
// LLM이 웹 검색 없이 생성한 업체명은 환각일 수 있어, 네이버에 실제 등록된 업소인지 확인한다.
// 키 미설정 시 검증 생략(기존 동작). 검증 실패 업체는 제외하되, 남는 게 4곳 미만이면
// '실존 미확인' 표기로 유지해 리스트가 비지 않게 한다.
const NAVER_SEARCH_ID = process.env.NAVER_SEARCH_CLIENT_ID || "";
const NAVER_SEARCH_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET || "";
const normName = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\([^)]*\)/g, "").replace(/[\s·.&\-_'"]/g, "").toLowerCase();
// "클로드 스튜디오" ↔ "스튜디오클로드"처럼 어순·접미어가 달라도 매칭되도록 업종 공통어 제거 후 핵심 이름 비교
const CORE_STRIP = /(웨딩|스튜디오|드레스|메이크업|헤어|살롱|샵|컨벤션|웨딩홀|studio|wedding|salon|dress|makeup|hall)/g;
const coreName = (s) => normName(s).replace(CORE_STRIP, "");
const nameMatch = (a, b) => {
  const na = normName(a), nb = normName(b);
  if (na && nb && (na.includes(nb) || nb.includes(na))) return true;
  const ca = coreName(a), cb = coreName(b);
  if (ca.length >= 2 && cb.length >= 2 && (ca.includes(cb) || cb.includes(ca))) return true;
  let p = 0; while (p < ca.length && p < cb.length && ca[p] === cb[p]) p++;
  return p >= 4; // 브랜드는 같고 지점만 다른 경우 (예: 아펠가모 선릉 ↔ 반포)
};

const naverApiHeaders = () => ({ "X-Naver-Client-Id": NAVER_SEARCH_ID, "X-Naver-Client-Secret": NAVER_SEARCH_SECRET });

// 네이버 OpenAPI는 초당 호출 제한이 있어(업체 수×2건 동시 요청 시 429) 재시도 + 동시성 제한을 둔다
async function naverFetch(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { headers: naverApiHeaders() });
    if (r.status !== 429) return r;
    await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
  }
  return fetch(url, { headers: naverApiHeaders() });
}
async function mapLimit(arr, limit, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (i < arr.length) { const idx = i++; out[idx] = await fn(arr[idx], idx); }
  }));
  return out;
}

// 네이버 이미지검색으로 대표 썸네일 1장 (실패해도 무해 — 프론트가 플레이스홀더 표시)
async function vendorThumb(name, suffix) {
  try {
    const r = await naverFetch(`https://openapi.naver.com/v1/search/image?display=1&filter=large&query=${encodeURIComponent(`${name} ${suffix}`)}`);
    if (!r.ok) return "";
    const j = await r.json();
    return (j.items && j.items[0] && (j.items[0].thumbnail || j.items[0].link)) || "";
  } catch { return ""; }
}

async function verifyVendors(items, suffix) {
  if (!NAVER_SEARCH_ID || !NAVER_SEARCH_SECRET) return items;
  const checked = await mapLimit(items || [], 3, async (it) => {
    try {
      const q = `${String(it.name || "").replace(/\([^)]*\)/g, "").trim()} ${suffix}`;
      const r = await naverFetch(`https://openapi.naver.com/v1/search/local.json?display=5&query=${encodeURIComponent(q)}`);
      if (!r.ok) return { it, ok: null }; // API 오류 → 판단 보류(통과)
      const j = await r.json();
      const hit = (j.items || []).find((x) => nameMatch(x.title, it.name));
      const ok = !!hit;
      if (ok !== false && !it.img) it = { ...it, img: await vendorThumb(it.name, suffix) }; // 통과 업체는 썸네일 채움
      return { it, ok };
    } catch { return { it, ok: null }; }
  });
  const passed = checked.filter((c) => c.ok !== false).map((c) => c.it);
  const dropped = checked.filter((c) => c.ok === false);
  if (dropped.length) console.log(`verify: ${dropped.length}곳 실존 미확인 제외 — ${dropped.map((c) => c.it.name).join(", ")}`);
  if (passed.length >= 4) return passed;
  return checked.map((c) => (c.ok === false ? { ...c.it, note: `${c.it.note || ""} · ⚠️ 실존 미확인` } : c.it));
}

// --- 공고 리서치 신뢰성 검증 — AI가 만든 공고는 과거 데이터·깨진 URL이 섞일 수 있다 ---
// ① link는 접속해서 "그 공고 본문이 맞는지"까지 확인된 것만 남김 ② 마감일이 과거로 파싱되면 항목 제외
// ⚠️ SH·LH 게시판은 없는 글 번호에도 404가 아니라 목록 페이지를 200으로 준다 → 200만 보면 검증이 안 된다.
const NOTICE_STOPWORDS = /^(공고|모집|입주자|주택|장기전세|임대|아파트|단지|차|제|년|월|신청|접수|안내|공공)$/;
function noticeNameTokens(name) {
  return String(name || "")
    .replace(/[()[\]{}<>,·∙・|]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^(제)?\d+차?$/, "").trim())
    .filter((w) => w.length >= 2 && !NOTICE_STOPWORDS.test(w));
}
async function verifyNoticeLinks(items) {
  const todayStr = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const checked = await mapLimit(items || [], 3, async (it) => {
    // 기간("07.01 ~ 08.10")으로 오는 경우가 많아 가장 늦은 날짜를 마감일로 본다 (시작일을 집으면 접수 중 공고가 지워짐)
    const dates = [...String(it.deadline || "").matchAll(/(20\d{2})[.\-\/년\s]*(\d{1,2})[.\-\/월\s]*(\d{1,2})/g)]
      .map((m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`)
      .sort();
    if (dates.length && dates[dates.length - 1] < todayStr) return null; // 이미 마감된 과거 공고 제외
    let linkOk = false;
    if (it.link && /^https?:\/\//.test(it.link)) {
      try {
        const r = await fetch(it.link, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
        if (r.ok) {
          const body = (await r.text()).replace(/<[^>]+>/g, " ");
          const tokens = noticeNameTokens(it.name);
          const hit = tokens.filter((t) => body.includes(t)).length;
          const need = tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.6));
          linkOk = tokens.length > 0 && hit >= need;
        }
      } catch {}
    }
    return {
      ...it,
      link: linkOk ? it.link : "", // 접속 안 되는 링크는 제거 (프론트는 네이버 검색으로 폴백)
      linkVerified: linkOk,
      deadline: dates.length ? it.deadline : `${it.deadline || "일정 미상"} · ⚠️ 공식 공고로 확인 필요`,
    };
  });
  const alive = checked.filter(Boolean);
  console.log(`verifyNotices: ${items.length}건 중 과거 마감 ${items.length - alive.length}건 제외, 링크 검증 ${alive.filter(x => x.linkVerified).length}건 통과`);
  return alive;
}

// 프롬프트가 조건(지역·유형·가격대·소득)에 따라 달라지므로 캐시 키에 조건을 포함 —
// 다른 조건으로 갱신했는데 이전 조건의 캐시가 반환되는 것을 방지
function researchCacheKey(topic, query) {
  const sig = ["area", "vtype", "maxMeal", "income"]
    .map((k) => { const v = qstr(query, k); return v ? `${k}=${v}` : ""; })
    .filter(Boolean).join("&");
  return sig ? `${topic}?${sig}` : topic;
}

async function handleResearch(res, query) {
  const topic = query.get("topic");
  const t = RESEARCH_TOPICS[topic];
  if (!t) return sendJSON(res, 400, { error: "unknown_topic", topics: Object.keys(RESEARCH_TOPICS) });
  const useFss = topic === "bankloans" && FSS_KEY;
  if (!useFss && !GEMINI_API_KEY) {
    return sendJSON(res, 503, { error: "no_key", message: (topic === "bankloans" ? "FSS_KEY/" : "") + "GEMINI_API_KEY 미설정 (aistudio.google.com/apikey에서 무료 발급) — 기본 데이터를 사용하세요." });
  }
  const cacheKey = researchCacheKey(topic, query);
  const cached = researchCache[cacheKey];
  if (query.get("force") !== "1" && cached && Date.now() - cached.at < RESEARCH_TTL_MS) {
    return sendJSON(res, 200, cached.payload);
  }
  try {
    let items = null, source = "live";
    if (useFss) {
      try { items = await fetchFssBankloans(); source = "fss"; }
      catch (e) { // 키 미승인(err 010) 등 — Gemini 폴백 가능하면 계속 진행
        console.error("fss_failed:", String(e).slice(0, 200));
        if (!GEMINI_API_KEY) throw e;
      }
    }
    if (!items) items = (await callGeminiResearch(t.prompt(query), t.schema)).items || [];
    if (t.verify) items = await verifyVendors(items, t.verify); // 네이버 지역검색으로 실존 업체만 통과
    if (t.verifyLinks) items = await verifyNoticeLinks(items); // 링크 실접속 확인 + 과거 마감 제외
    const payload = { source, topic, items, fetchedAt: new Date().toISOString() };
    researchCache[cacheKey] = { at: Date.now(), payload };
    try { fs.writeFileSync(RESEARCH_CACHE_FILE, JSON.stringify(researchCache)); } catch {}
    sendJSON(res, 200, payload);
  } catch (e) {
    sendJSON(res, 502, { error: "research_failed", message: String(e).slice(0, 300) });
  }
}

// --- 프론트 설정 (env → 클라이언트) ---
function handleConfig(res) {
  sendJSON(res, 200, { naverMapKey: process.env.NAVER_MAP_KEY || "", fcmVapidKey: process.env.FCM_VAPID_KEY || "" });
}

// --- 뉴스 (구글뉴스 RSS — 키 불필요) ---
function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").trim(); }

async function newsFromGoogleRss(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("rss_upstream_" + r.status);
  const xml = await r.text();
  const items = [];
  const blocks = xml.split("<item>").slice(1, 13);
  for (const b of blocks) {
    const pick = (tag) => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "") : ""; };
    const rawTitle = stripTags(pick("title"));
    const src = stripTags(pick("source"));
    const pub = pick("pubDate");
    items.push({
      title: src && rawTitle.endsWith(" - " + src) ? rawTitle.slice(0, -(" - " + src).length) : rawTitle,
      desc: "",
      link: stripTags(pick("link")),
      date: pub ? new Date(pub).toISOString().slice(0, 10) : null,
      ts: pub ? new Date(pub).toISOString() : null, // 발행 시각 — 최신순 정렬용
      source: src || "Google뉴스",
    });
  }
  return items;
}

async function handleNews(res, query) {
  const q = (query.get("q") || "부동산").slice(0, 60);
  try {
    const items = await newsFromGoogleRss(q);
    sendJSON(res, 200, { source: "live", q, items });
  } catch (e) {
    sendJSON(res, 502, { error: "fetch_failed", message: String(e) });
  }
}

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const filePath = path.join(ROOT, path.normalize(p));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  // 비밀값 파일 차단 — .env/.env.product/env.product 등이 ROOT에 있어 정적 서빙되면 API 키가 유출된다
  const rel = path.relative(ROOT, filePath);
  const blocked = rel.split(path.sep).some((seg) => seg.startsWith(".")) || /^env(\.|$)/i.test(path.basename(filePath)) || path.basename(filePath) === "server.js";
  if (blocked) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === "/api/cheongyak") return handleCheongyak(res);
  if (u.pathname === "/api/realty") return handleRealty(res, u.searchParams);
  if (u.pathname === "/api/lh-notices") return handleLhNotices(res);
  if (u.pathname === "/api/push-register" || u.pathname === "/api/push-test") return sendJSON(res, 501, { error: "local_unsupported", message: "푸시 알림은 배포된 사이트(Firebase)에서만 동작해요." });
  if (u.pathname === "/api/naver-land") return handleNaverLand(res, u.searchParams);
  if (u.pathname === "/api/news") return handleNews(res, u.searchParams);
  if (u.pathname === "/api/config") return handleConfig(res);
  if (u.pathname === "/api/research") return handleResearch(res, u.searchParams);
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`\n  대시보드: http://localhost:${PORT}`);
  console.log(`  청약 실데이터: ${CHEONGYAK_KEY ? "활성(CHEONGYAK_KEY 감지)" : "비활성(샘플 폴백) — CHEONGYAK_KEY 설정 시 활성화"}`);
  console.log(`  네이버 매물: 프록시 경유(비공식). 차단 시 샘플 폴백`);
  console.log(`  뉴스: 구글뉴스 RSS (키 불필요)`);
  console.log(`  네이버 지도: ${process.env.NAVER_MAP_KEY ? "활성(NAVER_MAP_KEY 감지)" : "미설정 — 화면 ⚙️ 설정 입력 또는 NAVER_MAP_KEY 설정"}`);
  console.log(`  은행 금리(금감원 공시): ${FSS_KEY ? "활성(FSS_KEY 감지)" : "미설정 — Claude 리서치로 폴백"}`);
  console.log(`  실시간 리서치(식장/스드메/정책): ${GEMINI_API_KEY ? `활성 — Gemini ${GEMINI_MODELS[0]} (무료 티어)` : "비활성 — GEMINI_API_KEY(무료, aistudio.google.com/apikey) 설정 시 활성화"}`);
  console.log(`  업체 실존 검증(네이버 지역검색): ${NAVER_SEARCH_ID && NAVER_SEARCH_SECRET ? "활성" : "미설정 — developers.naver.com에서 검색 API 키 발급 시 활성화 (권장)"}\n`);
});
