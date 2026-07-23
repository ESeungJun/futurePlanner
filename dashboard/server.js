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

// --- 네이버 부동산 (비공식 내부 API) ---
async function handleNaverLand(res, query) {
  const cortarNo = query.get("cortarNo") || "4129010700"; // 기본: 과천 별양동 예시 코드
  try {
    const url = `https://new.land.naver.com/api/articles?cortarNo=${cortarNo}&order=rank&realEstateType=APT&tradeType=&page=1`;
    const r = await fetch(url, {
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

// --- 실시간 리서치 (Claude API + 웹 검색 — ANTHROPIC_API_KEY 필요) ---
// 하드코딩된 기본 데이터 대신, 요청 시 Claude가 웹을 검색해 최신 정보를 JSON으로 정리한다.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
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
// 결혼식 준비 업체(스튜디오/드레스/메이크업) 공통 스키마 — 프론트 WeddingVendorTab과 필드 일치
const vendorSchema = objSchema({
  name: { type: "string" }, area: { type: "string", description: "구·동 단위 지역" },
  price: { type: "string", description: "대표 가격대 (예: 패키지 180~250만, 추정이면 '추정' 표기)" },
  note: { type: "string", description: "인기 이유·스타일 한 줄" },
}, ["name", "area", "price", "note"]);
const vendorPrompt = (label, extra) => (q) => {
  const area = (q && q.get("area")) || "";
  return `오늘은 ${today()}. 웹을 검색해서 지금 시점 ${area || "서울"}에서 예비부부가 실제로 많이 계약하는 인기 ${label} 8~10곳을 조사해줘. ${extra} 최근 후기 기준 대표 가격대(추정치면 '추정' 표기)와 지역, 왜 인기인지 한 줄. 한국어로.`;
};
const RESEARCH_TOPICS = {
  venues: {
    prompt: (q) => {
      const vtype = (q && q.get("vtype")) || "";
      const area = (q && q.get("area")) || "";
      const maxMeal = Number((q && q.get("maxMeal")) || 0);
      return `오늘은 ${today()}. 웹을 검색해서 지금 시점 ${area || "서울"}에서 평범한 직장인 커플이 실제로 많이 계약하는 인기 결혼식장(웨딩홀) 10곳을 조사해줘. ${vtype ? `유형은 ${vtype} 위주로.` : "하우스/채플/컨벤션 위주로 골고루."} ${maxMeal > 0 ? `1인 식대 ${maxMeal}만원 이하인 곳만.` : "(특급호텔 등 1인 식대 13만원 이상인 최고가 식장은 제외)"} 최근 후기·보도 기준 1인 식대와 대관료(추정치면 값에 '추정' 표기), 수용 인원, 왜 인기인지 한 줄. 한국어로.`;
    },
    schema: objSchema({
      name: { type: "string" }, area: { type: "string", description: "구 단위 지역" },
      type: { type: "string", enum: ["호텔", "하우스", "채플", "컨벤션", "기타"] },
      meal: { type: "string", description: "1인 식대 (예: 8~11만)" }, fee: { type: "string", description: "대관료 (예: 750~980만)" },
      cap: { type: "string", description: "수용 인원" }, note: { type: "string", description: "인기 이유 한 줄" },
    }, ["name", "area", "type", "meal", "fee", "cap", "note"]),
  },
  studios: { prompt: vendorPrompt("웨딩 촬영 스튜디오·스냅팀", "인스타그램에서 화제인 감성 스냅·화보 스타일 위주로. 인물/감성/필름/야외 등 스타일과 인스타 계정을 note에 표기."), schema: vendorSchema },
  dresses: { prompt: vendorPrompt("웨딩드레스샵", "실루엣·분위기(클래식/모던 등)를 note에 표기."), schema: vendorSchema },
  makeup: { prompt: vendorPrompt("웨딩 헤어·메이크업샵", "인스타그램에서 인기 있는 감각적인 샵을 포함해 청담 등 주요 상권 위주로, 신부 메이크업 스타일을 note에 표기."), schema: vendorSchema },
  policies: {
    prompt: (q) => `오늘은 ${today()}. 웹을 검색해서 대한민국 신혼부부/예비부부가 지금 받을 수 있는 저축·세제·주거 정책 혜택을 10~14개 조사해줘. 기준: 부부합산 연소득 ${q.get("income") || "15700"}만원 맞벌이 무주택 신혼부부. 각 정책의 대상 조건과 혜택(구체적 숫자), 이 부부 기준 실제 적용 가능 여부를 판정해줘. fit은 good(가능)/warn(조건부·부분가능)/bad(소득 등 요건 초과)/neutral(확인필요). link는 공식 안내 URL. 한국어로.`,
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

async function callClaudeResearch(prompt, schema) {
  const baseMessages = [{ role: "user", content: prompt }];
  let messages = baseMessages;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        output_config: { format: { type: "json_schema", schema } },
        // 프롬프트 캐싱: 마지막 캐시 가능 블록에 자동 배치 — pause_turn 재개 시
        // 재전송되는 대용량 웹검색 결과가 캐시되어 재개 요청 입력 비용 절감
        cache_control: { type: "ephemeral" },
        messages,
      }),
    });
    if (!r.ok) throw new Error(`claude_${r.status}: ${(await r.text()).slice(0, 300)}`);
    const msg = await r.json();
    if (msg.stop_reason === "pause_turn") {
      // 서버측 도구 루프가 일시정지 — 응답을 그대로 이어붙여 재개
      messages = [...baseMessages, { role: "assistant", content: msg.content }];
      continue;
    }
    if (msg.stop_reason === "refusal") throw new Error("claude_refusal");
    const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
  }
  throw new Error("pause_turn_limit");
}

async function handleResearch(res, query) {
  const topic = query.get("topic");
  const t = RESEARCH_TOPICS[topic];
  if (!t) return sendJSON(res, 400, { error: "unknown_topic", topics: Object.keys(RESEARCH_TOPICS) });
  const useFss = topic === "bankloans" && FSS_KEY;
  if (!useFss && !ANTHROPIC_API_KEY) {
    return sendJSON(res, 503, { error: "no_key", message: (topic === "bankloans" ? "FSS_KEY/" : "") + "ANTHROPIC_API_KEY 미설정 — 기본 데이터를 사용하세요." });
  }
  const cached = researchCache[topic];
  if (query.get("force") !== "1" && cached && Date.now() - cached.at < RESEARCH_TTL_MS) {
    return sendJSON(res, 200, cached.payload);
  }
  try {
    let items = null, source = "live";
    if (useFss) {
      try { items = await fetchFssBankloans(); source = "fss"; }
      catch (e) { // 키 미승인(err 010) 등 — Claude 폴백 가능하면 계속 진행
        console.error("fss_failed:", String(e).slice(0, 200));
        if (!ANTHROPIC_API_KEY) throw e;
      }
    }
    if (!items) items = (await callClaudeResearch(t.prompt(query), t.schema)).items || [];
    const payload = { source, topic, items, fetchedAt: new Date().toISOString() };
    researchCache[topic] = { at: Date.now(), payload };
    try { fs.writeFileSync(RESEARCH_CACHE_FILE, JSON.stringify(researchCache)); } catch {}
    sendJSON(res, 200, payload);
  } catch (e) {
    sendJSON(res, 502, { error: "research_failed", message: String(e).slice(0, 300) });
  }
}

// --- 프론트 설정 (env → 클라이언트) ---
function handleConfig(res) {
  sendJSON(res, 200, { naverMapKey: process.env.NAVER_MAP_KEY || "" });
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
  const q = query.get("q") || "부동산";
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
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === "/api/cheongyak") return handleCheongyak(res);
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
  console.log(`  실시간 리서치(식장/정책): ${ANTHROPIC_API_KEY ? "활성(ANTHROPIC_API_KEY 감지)" : "비활성 — ANTHROPIC_API_KEY 설정 시 활성화"}\n`);
});
