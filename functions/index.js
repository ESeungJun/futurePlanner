/*
 * Firebase Functions(2nd gen) — 대시보드 API
 *
 * Hosting rewrites가 /api/** 를 `api` 함수로 라우팅한다(프론트와 같은 도메인 → CORS 없음).
 *   /api/cheongyak   청약홈 공공데이터 프록시 (CHEONGYAK_KEY)
 *   /api/naver-land  네이버 부동산 비공식 API 프록시
 *   /api/news        구글뉴스 RSS (키 불필요)
 *   /api/config      프론트 설정 (네이버 지도 키)
 *   /api/research    topic=bankloans → 금감원 공시 API(FSS_KEY) 우선
 *                    topic=venues|policies → Claude 웹검색 (ANTHROPIC_API_KEY)
 *
 * `researchDaily` 스케줄 함수가 매일 06:30(KST) 리서치를 미리 실행해 Firestore
 * (research/{topic})에 캐시한다 → 사용자 요청은 대부분 캐시만 읽는다.
 *
 * 키는 functions/.env 에서 로드된다(배포 시 자동 반영). 없는 키의 엔드포인트는
 * 503을 반환하고 프론트가 기본/샘플 데이터로 폴백한다.
 *
 * ⚠️ Hosting 경유 요청은 60초 하드 타임아웃 — venues/policies 강제 갱신(force=1)이
 *    60초를 넘기면 브라우저는 504를 받지만 함수는 계속 실행되어 캐시를 남긴다.
 *    잠시 후 다시 누르면 캐시(10분 이내면 즉시)를 받는다.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// Hosting rewrites가 지원하는 리전은 us-central1/us-east1/us-west1/europe-west1/asia-east1 뿐
// — 서울(asia-northeast3)은 라우팅 불가라 가장 가까운 asia-east1(대만) 사용
setGlobalOptions({ region: "asia-east1", maxInstances: 4 });
admin.initializeApp();
const db = admin.firestore();

const env = (k) => process.env[k] || "";

// ---------- 청약홈 APT 분양정보 (공공데이터포털 ApplyhomeInfoDetailSvc/v1) ----------
const APPLYHOME_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
let cheongyakCache = { at: 0, payload: null }; // 인스턴스 메모리 캐시 (5분)

function ymToDash(ym) { // "202906" → "2029-06"
  const s = String(ym || "");
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : (s || null);
}

async function handleCheongyak(res) {
  const KEY = env("CHEONGYAK_KEY");
  if (!KEY) return res.status(503).json({ error: "no_key", message: "CHEONGYAK_KEY 미설정 — 샘플데이터를 사용하세요." });
  if (cheongyakCache.payload && Date.now() - cheongyakCache.at < 5 * 60 * 1000) {
    return res.json(cheongyakCache.payload);
  }
  try {
    const key = `serviceKey=${encodeURIComponent(KEY)}`;
    const since = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10);
    const listUrl = `${APPLYHOME_BASE}/getAPTLttotPblancDetail?page=1&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    const r = await fetch(listUrl, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(502).json({ error: "upstream", status: r.status });
    const raw = await r.json();
    const list = (raw.data || []).slice(0, 60);

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
        priceCap: d.PARCPRC_ULS_AT === "Y",
        lat: null, lng: null,
        url: d.PBLANC_URL || "https://www.applyhome.co.kr",
      };
    }).sort((a, b) => (b.applyStart || "").localeCompare(a.applyStart || ""));

    const payload = { source: "live", items, fetchedAt: new Date().toISOString() };
    cheongyakCache = { at: Date.now(), payload };
    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: "fetch_failed", message: String(e) });
  }
}

// ---------- 네이버 부동산 (비공식 내부 API — 데이터센터 IP는 차단될 수 있음) ----------
async function handleNaverLand(res, query) {
  const cortarNo = query.cortarNo || "4129010700";
  try {
    const url = `https://new.land.naver.com/api/articles?cortarNo=${cortarNo}&order=rank&realEstateType=APT&tradeType=&page=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://new.land.naver.com/", Accept: "application/json" },
    });
    if (!r.ok) return res.status(502).json({ error: "upstream", status: r.status, message: "네이버가 차단했을 수 있습니다. 샘플데이터를 사용하세요." });
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
    res.json({ source: "live", items });
  } catch (e) {
    res.status(502).json({ error: "fetch_failed", message: String(e) });
  }
}

// ---------- 뉴스 (구글뉴스 RSS — 키 불필요) ----------
function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").trim(); }

async function handleNews(res, query) {
  const q = query.q || "부동산";
  try {
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
    res.json({ source: "live", q, items });
  } catch (e) {
    res.status(502).json({ error: "fetch_failed", message: String(e) });
  }
}

// ---------- 은행 주담대 금리 — 금감원 「금융상품 한눈에」 공시 API ----------
// LLM 추정치가 아닌 공시값. https://finlife.fss.or.kr (오픈API → 인증키 신청, 무료)
const FSS_BASE = "https://finlife.fss.or.kr/finlifeapi";
const FSS_LINK = "https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007";

async function fetchFssBankloans(key) {
  const base = [], opts = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${FSS_BASE}/mortgageLoanProductsSearch.json?auth=${encodeURIComponent(key)}&topFinGrpNo=020000&pageNo=${page}`);
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
  // 은행별 대표 1개 (아파트 최저금리 기준)
  const byBank = new Map();
  for (const p of products) {
    const cur = byBank.get(p.bank);
    if (!cur || p.rateMin < cur.rateMin) byBank.set(p.bank, p);
  }
  const items = [...byBank.values()].sort((a, b) => a.rateMin - b.rateMin);
  if (!items.length) throw new Error("fss_empty");
  return items;
}

// ---------- 실시간 리서치 (Claude API + 웹 검색) ----------
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
    prompt: () => `오늘은 ${today()}. 웹을 검색해서 지금 시점 서울에서 평범한 직장인 커플이 실제로 많이 계약하는 인기 결혼식장(웨딩홀) 10곳을 조사해줘. 하우스/채플/컨벤션 위주로 골고루 (특급호텔 등 1인 식대 13만원 이상인 최고가 식장은 제외). 최근 후기·보도 기준 1인 식대와 대관료(추정치면 값에 '추정' 표기), 수용 인원, 왜 인기인지 한 줄. 한국어로.`,
    schema: objSchema({
      name: { type: "string" }, area: { type: "string", description: "구 단위 지역" },
      type: { type: "string", enum: ["호텔", "하우스", "채플", "컨벤션", "기타"] },
      meal: { type: "string", description: "1인 식대 (예: 8~11만)" }, fee: { type: "string", description: "대관료 (예: 750~980만)" },
      cap: { type: "string", description: "수용 인원" }, note: { type: "string", description: "인기 이유 한 줄" },
    }, ["name", "area", "type", "meal", "fee", "cap", "note"]),
  },
  policies: {
    prompt: (q) => `오늘은 ${today()}. 웹을 검색해서 대한민국 신혼부부/예비부부가 지금 받을 수 있는 저축·세제·주거 정책 혜택을 10~14개 조사해줘. 기준: 부부합산 연소득 ${(q && q.income) || "15700"}만원 맞벌이 무주택 신혼부부. 각 정책의 대상 조건과 혜택(구체적 숫자), 이 부부 기준 실제 적용 가능 여부를 판정해줘. fit은 good(가능)/warn(조건부·부분가능)/bad(소득 등 요건 초과)/neutral(확인필요). link는 공식 안내 URL. 한국어로.`,
    schema: objSchema({
      name: { type: "string" }, target: { type: "string", description: "대상 조건 요약" },
      benefit: { type: "string", description: "혜택 요약 (숫자 포함)" },
      fit: { type: "string", enum: ["good", "warn", "bad", "neutral"] },
      fitText: { type: "string", description: "짧은 판정 라벨 (예: 가능, 소득 초과)" },
      why: { type: "string", description: "판정 이유" }, link: { type: "string" },
    }, ["name", "target", "benefit", "fit", "fitText", "why", "link"]),
  },
  // bankloans는 FSS 공시 API가 우선 처리. ANTHROPIC 폴백용으로만 유지.
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
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        output_config: { format: { type: "json_schema", schema } },
        // 프롬프트 캐싱: 마지막 캐시 가능 블록에 자동 배치. 첫 요청은 프롬프트가 짧아
        // 캐시가 안 걸리지만(무해), pause_turn 재개 시 재전송되는 대용량 웹검색 결과가
        // 캐시되어 다음 재개 요청의 입력 비용이 ~90% 줄어든다.
        cache_control: { type: "ephemeral" },
        messages,
      }),
    });
    if (!r.ok) throw new Error(`claude_${r.status}: ${(await r.text()).slice(0, 300)}`);
    const msg = await r.json();
    if (msg.stop_reason === "pause_turn") {
      messages = [...baseMessages, { role: "assistant", content: msg.content }];
      continue;
    }
    if (msg.stop_reason === "refusal") throw new Error("claude_refusal");
    const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
  }
  throw new Error("pause_turn_limit");
}

// ---------- 리서치 캐시 (Firestore: research/{topic}) ----------
const RESEARCH_TTL_MS = 12 * 60 * 60 * 1000; // 스케줄이 매일 갱신하므로 사실상 항상 캐시 히트
const FORCE_SKIP_MS = 10 * 60 * 1000; // force=1이어도 10분 내 캐시는 그대로 반환 (504 후 재시도 대응)

const cacheDoc = (topic) => db.collection("research").doc(topic);
async function readResearchCache(topic) {
  const snap = await cacheDoc(topic).get().catch(() => null);
  return snap && snap.exists ? snap.data() : null;
}
async function writeResearchCache(topic, payload) {
  await cacheDoc(topic).set({ at: Date.now(), payload }).catch((e) => console.error("cache_write_failed", e));
}

async function runResearch(topic, query) {
  const t = RESEARCH_TOPICS[topic];
  if (topic === "bankloans" && env("FSS_KEY")) {
    try {
      const items = await fetchFssBankloans(env("FSS_KEY"));
      return { source: "fss", topic, items, fetchedAt: new Date().toISOString() };
    } catch (e) {
      // 키 미승인(err 010) 등 — Claude 리서치로 폴백 가능하면 계속 진행
      console.error("fss_failed:", String(e.message || e).slice(0, 200));
      if (!env("ANTHROPIC_API_KEY")) throw e;
    }
  }
  if (!env("ANTHROPIC_API_KEY")) {
    const err = new Error(topic === "bankloans" ? "FSS_KEY/ANTHROPIC_API_KEY 미설정 — 기본 데이터를 사용하세요." : "ANTHROPIC_API_KEY 미설정 — 기본 데이터를 사용하세요.");
    err.code = 503;
    throw err;
  }
  const data = await callClaudeResearch(t.prompt(query), t.schema);
  return { source: "live", topic, items: data.items || [], fetchedAt: new Date().toISOString() };
}

async function handleResearch(res, query) {
  const topic = query.topic;
  if (!RESEARCH_TOPICS[topic]) return res.status(400).json({ error: "unknown_topic", topics: Object.keys(RESEARCH_TOPICS) });
  const cached = await readResearchCache(topic);
  const age = cached ? Date.now() - cached.at : Infinity;
  const maxAge = query.force === "1" ? FORCE_SKIP_MS : RESEARCH_TTL_MS;
  if (cached && age < maxAge && cached.payload && cached.payload.items && cached.payload.items.length) {
    return res.json(cached.payload);
  }
  try {
    const payload = await runResearch(topic, query);
    await writeResearchCache(topic, payload);
    res.json(payload);
  } catch (e) {
    if (e.code === 503 && cached && cached.payload) return res.json(cached.payload); // 키가 빠져도 옛 캐시라도 준다
    res.status(e.code || 502).json({ error: "research_failed", message: String(e.message || e).slice(0, 300) });
  }
}

// ---------- HTTP 엔트리 (Hosting rewrites: /api/** → api) ----------
exports.api = onRequest({ timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
  const p = req.path.replace(/\/+$/, "");
  if (p === "/api/cheongyak") return handleCheongyak(res);
  if (p === "/api/naver-land") return handleNaverLand(res, req.query);
  if (p === "/api/news") return handleNews(res, req.query);
  if (p === "/api/config") return res.json({ naverMapKey: env("NAVER_MAP_KEY") });
  if (p === "/api/research") return handleResearch(res, req.query);
  res.status(404).json({ error: "not_found", path: p });
});

// ---------- 스케줄 리서치 (매일 06:30 KST) ----------
exports.researchDaily = onSchedule({ schedule: "30 6 * * *", timeZone: "Asia/Seoul", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  for (const topic of Object.keys(RESEARCH_TOPICS)) {
    try {
      const payload = await runResearch(topic, {});
      if (payload.items && payload.items.length) {
        await writeResearchCache(topic, payload);
        console.log(`researchDaily ${topic}: ${payload.items.length}건 (${payload.source})`);
      } else {
        console.warn(`researchDaily ${topic}: 빈 결과 — 캐시 유지`);
      }
    } catch (e) {
      console.error(`researchDaily ${topic} 실패:`, String(e.message || e).slice(0, 300));
    }
  }
});
