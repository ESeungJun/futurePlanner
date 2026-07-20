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
const RESEARCH_TOPICS = {
  venues: {
    prompt: () => `오늘은 ${today()}. 웹을 검색해서 지금 시점 서울에서 가장 인기 있는 결혼식장(웨딩홀) 10곳을 조사해줘. 호텔/하우스/채플/컨벤션 유형을 골고루. 최근 후기·보도 기준 1인 식대와 대관료(추정치면 값에 '추정' 표기), 수용 인원, 왜 인기인지 한 줄. 한국어로.`,
    schema: objSchema({
      name: { type: "string" }, area: { type: "string", description: "구 단위 지역" },
      type: { type: "string", enum: ["호텔", "하우스", "채플", "컨벤션", "기타"] },
      meal: { type: "string", description: "1인 식대 (예: 8~11만)" }, fee: { type: "string", description: "대관료 (예: 750~980만)" },
      cap: { type: "string", description: "수용 인원" }, note: { type: "string", description: "인기 이유 한 줄" },
    }, ["name", "area", "type", "meal", "fee", "cap", "note"]),
  },
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
  if (!ANTHROPIC_API_KEY) return sendJSON(res, 503, { error: "no_key", message: "ANTHROPIC_API_KEY 미설정 — 기본 데이터를 사용하세요." });
  const cached = researchCache[topic];
  if (query.get("force") !== "1" && cached && Date.now() - cached.at < RESEARCH_TTL_MS) {
    return sendJSON(res, 200, cached.payload);
  }
  try {
    const data = await callClaudeResearch(t.prompt(query), t.schema);
    const payload = { source: "live", topic, items: data.items || [], fetchedAt: new Date().toISOString() };
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
  console.log(`  실시간 리서치(식장/정책/금리): ${ANTHROPIC_API_KEY ? "활성(ANTHROPIC_API_KEY 감지)" : "비활성 — ANTHROPIC_API_KEY 설정 시 활성화"}\n`);
});
