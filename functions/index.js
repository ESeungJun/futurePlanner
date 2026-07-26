/*
 * Firebase Functions(2nd gen) — 대시보드 API
 *
 * Hosting rewrites가 /api/** 를 `api` 함수로 라우팅한다(프론트와 같은 도메인 → CORS 없음).
 *   /api/cheongyak   청약홈 공공데이터 프록시 (CHEONGYAK_KEY)
 *   /api/naver-land  네이버 부동산 비공식 API 프록시
 *   /api/news        구글뉴스 RSS (키 불필요)
 *   /api/config      프론트 설정 (네이버 지도 키)
 *   /api/research    topic=bankloans → 금감원 공시 API(FSS_KEY) 우선
 *                    topic=venues|studios|dresses|makeup|policies → Gemini 웹검색
 *                    (GEMINI_API_KEY — 무료 티어, aistudio.google.com/apikey)
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
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// 서버 전용 키는 Secret Manager 관리 (firebase functions:secrets:set <KEY>).
// 함수 옵션 secrets에 바인딩하면 런타임에 process.env로 주입되어 env() 헬퍼가 그대로 동작한다.
// NAVER_MAP_KEY·FCM_VAPID_KEY는 /api/config로 클라이언트에 노출되는 공개 키라 .env에 유지.
const SECRETS = ["CHEONGYAK_KEY", "FSS_KEY", "GEMINI_API_KEY", "NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET"].map(defineSecret);

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

// 전국 공고는 6개월치가 100건을 넘는다 — totalCount를 보고 필요한 페이지까지 이어 읽는다.
// 1페이지만 읽으면 API 정렬 순서에 따라 최신 공고가 조용히 빠지고, notifyDaily의 "신규" 판정도 왜곡된다.
async function fetchCheongyakList(key, since, maxPages = 4) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${APPLYHOME_BASE}/getAPTLttotPblancDetail?page=${page}&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) { if (page === 1) { const e = new Error(`upstream_${r.status}`); e.status = r.status; throw e; } break; }
    const raw = await r.json();
    const data = raw.data || [];
    out.push(...data);
    const total = Number(raw.totalCount) || out.length;
    if (data.length < 100 || out.length >= total) break;
  }
  return out;
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
    const all = await fetchCheongyakList(key, since);
    // 최신 공고가 잘려나가지 않도록 공고일 내림차순으로 정렬한 뒤 자른다
    const list = all.sort((a, b) => String(b.RCRIT_PBLANC_DE || "").localeCompare(String(a.RCRIT_PBLANC_DE || ""))).slice(0, 60);

    const models = await Promise.all(list.map((d) =>
      fetch(`${APPLYHOME_BASE}/getAPTLttotPblancMdl?page=1&perPage=50&cond[HOUSE_MANAGE_NO::EQ]=${encodeURIComponent(d.HOUSE_MANAGE_NO)}&cond[PBLANC_NO::EQ]=${encodeURIComponent(d.PBLANC_NO)}&${key}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) })
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
    res.set("Cache-Control", "public, max-age=300");
    res.json(payload);
  } catch (e) {
    console.error("cheongyak_failed:", String(e.message || e).slice(0, 300));
    res.status(502).json({ error: "fetch_failed" }); // 업스트림 상세는 로그로만 (정찰·키 에코 방지)
  }
}

// ---------- 국토부 아파트 실거래가 (매매+전월세) — data.go.kr 공식 API ----------
// 네이버 비공식 API가 봇 차단(GCP IP는 응답 없이 행)으로 막혀서 공식 실거래가로 전환.
// 키는 data.go.kr 계정 공용(MOLIT_KEY 없으면 CHEONGYAK_KEY 재사용) — 두 실거래가 API 활용신청 필요.
const LAWD_NAMES = { 41290: "경기도 과천시" };
const molitCache = new Map(); // lawd → { at, payload } 인스턴스 캐시 (5분). 단일 슬롯이면 지역을 번갈아 호출해 무력화됨
const xmlPick = (block, ...tags) => {
  for (const t of tags) { const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); if (m) return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(); }
  return "";
};
const molitNum = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

async function fetchMolit(lawd) {
  const KEY = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
  // 일자를 1로 고정해서 계산 — setMonth로 빼면 31일에 "4월 31일"이 5월로 롤오버되어 한 달이 통째로 빠진다
  const base = new Date();
  const months = [0, 1, 2].map((i) => { const d = new Date(base.getFullYear(), base.getMonth() - i, 1); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const key = encodeURIComponent(KEY);
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
  // 지원 지역만 허용 — 임의 lawd를 받으면 요청 1건이 업스트림 12건으로 증폭되어 공용 키 쿼터가 소진된다
  const lawd = LAWD_NAMES[query.lawd] ? String(query.lawd) : "41290";
  const hit = molitCache.get(lawd);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) {
    res.set("Cache-Control", "public, max-age=300");
    return res.json(hit.payload);
  }
  if (env("MOLIT_KEY") || env("CHEONGYAK_KEY")) {
    try {
      const items = await fetchMolit(lawd);
      if (items.length) {
        const payload = { source: "live", kind: "molit", items, fetchedAt: new Date().toISOString() };
        molitCache.set(lawd, { at: Date.now(), payload });
        res.set("Cache-Control", "public, max-age=300");
        return res.json(payload);
      }
      // 빈 결과도 짧게 캐시 — 안 하면 거래 없는 달마다 매 요청이 그대로 업스트림으로 나간다
      molitCache.set(lawd, { at: Date.now() - 4 * 60 * 1000, payload: { source: "live", kind: "molit", items: [], fetchedAt: new Date().toISOString() } });
    } catch (e) { console.error("molit_failed:", String(e.message || e).slice(0, 200)); }
  }
  return handleNaverLand(res, query); // 폴백 (대부분 차단되지만 시도)
}

// ---------- LH 분양·임대 공고 (data.go.kr B552555) — 행복주택·국민임대·공공분양 등 실시간 공고 ----------
// 활용신청: 「한국토지주택공사_분양임대공고문 조회 서비스」 (키는 data.go.kr 계정 공용)
let lhCache = { at: 0, payload: null };
async function fetchLhList() { // 공고 목록 — API 미신청/오류 시 throw
  const KEY = env("LH_KEY") || env("CHEONGYAK_KEY");
  if (!KEY) { const e = new Error("CHEONGYAK_KEY/LH_KEY 미설정 — 안내 링크를 사용하세요."); e.code = 503; throw e; }
  const r = await fetch(`https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${encodeURIComponent(KEY)}&PG_SZ=100&PAGE=1`, {
    signal: AbortSignal.timeout(12000), headers: { Accept: "application/json" },
  });
  const t = (await r.text()).trim();
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const e = new Error("LH 공고 API 미신청 — data.go.kr에서 「LH 분양임대공고문 조회」 활용신청 필요"); e.code = 503; throw e;
  }
  const j = JSON.parse(t);
  const list = Array.isArray(j) ? j.flatMap((o) => (o && o.dsList) ? o.dsList : []) : (j.dsList || []);
  return list.map((d) => ({
    id: d.PAN_ID || d.PAN_NM,
    name: d.PAN_NM || "",
    category: d.UPP_AIS_TP_NM || "",
    type: d.AIS_TP_CD_NM || "",
    region: d.CNP_CD_NM || "",
    postedAt: d.PAN_NT_ST_DT || "",
    closeAt: d.CLSG_DT || "",
    status: d.PAN_SS || "",
    url: d.DTL_URL || "",
  })).filter((x) => x.name && !/토지|상가|점포|주차|용지|사무|근생/.test(`${x.category} ${x.type}`)); // 주택 공고만 (토지·상가 제외)
}
async function handleLhNotices(res) {
  if (lhCache.payload && Date.now() - lhCache.at < 10 * 60 * 1000) return res.json(lhCache.payload);
  try {
    const items = await fetchLhList();
    if (!items.length) return res.status(502).json({ error: "empty", message: "LH 응답에 공고가 없습니다." });
    const payload = { source: "live", items, fetchedAt: new Date().toISOString() };
    lhCache = { at: Date.now(), payload };
    res.json(payload);
  } catch (e) {
    res.status(e.code === 503 ? 503 : 502).json({ error: e.code === 503 ? "unauthorized" : "fetch_failed", message: String(e.message || e).slice(0, 200) });
  }
}

// ---------- 웹 푸시 알림 (FCM) — 신규 청약·LH 공고를 매일 아침 폰으로 ----------
// FCM 토큰 형식 — Firestore 문서 ID로 쓰므로 "/"·"__x__" 같은 불허 문자를 미리 걸러낸다
const FCM_TOKEN_RE = /^[A-Za-z0-9_:.\-]{100,4096}$/;
const MULTICAST_MAX = 500; // sendEachForMulticast 한도 — 초과하면 아무것도 발송되지 않고 throw

async function sendPush(tokens, data) {
  if (!tokens.length) return { ok: 0, bad: 0, failed: 0 };
  const payload = {
    // data-only 메시지 — 표시 여부는 서비스워커가 결정 (자동표시 중복 방지)
    data: { title: data.title || "", body: data.body || "", link: data.link || "https://planner-aa15f.web.app", tag: data.tag || "realty-notice" },
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  };
  const bad = [];
  let ok = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += MULTICAST_MAX) {
    const chunk = tokens.slice(i, i + MULTICAST_MAX);
    try {
      const res = await admin.messaging().sendEachForMulticast({ ...payload, tokens: chunk });
      ok += res.successCount;
      res.responses.forEach((r, j) => {
        if (r.success) return;
        failed++;
        // 페이로드 오류(invalid-argument)로는 지우지 않는다 — 버그 한 번에 전 기기 토큰이 날아갈 수 있다
        if (/not-registered|invalid-registration-token/i.test(String(r.error && r.error.code))) bad.push(chunk[j]);
      });
    } catch (e) { // 청크 단위 격리 — 한 묶음이 실패해도 나머지는 발송
      failed += chunk.length;
      console.error("sendPush_chunk_failed:", String(e.message || e).slice(0, 200));
    }
  }
  await Promise.all(bad.map((t) => db.collection("pushTokens").doc(t).delete().catch(() => {})));
  return { ok, bad: bad.length, failed };
}

async function handlePushRegister(req, res) {
  const { token, ua, remove } = req.body || {};
  if (typeof token !== "string" || !FCM_TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "bad_token" });
  }
  if (remove) { await db.collection("pushTokens").doc(token).delete().catch(() => {}); return res.json({ ok: true, removed: true }); }
  await db.collection("pushTokens").doc(token).set({ at: Date.now(), ua: String(ua || "").slice(0, 200) });
  res.json({ ok: true });
}

async function handlePushTest(req, res) {
  const token = String((req.body && req.body.token) || req.query.token || "");
  if (!FCM_TOKEN_RE.test(token)) return res.status(400).json({ error: "bad_token" });
  const ref = db.collection("pushTokens").doc(token);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "not_registered" }); // 등록된 토큰에만 발송 (남용 방지)
  const last = Number((snap.data() || {}).lastTest || 0);
  if (Date.now() - last < 60000) return res.status(429).json({ error: "too_many", message: "1분 후에 다시 시도하세요." });
  await ref.set({ lastTest: Date.now() }, { merge: true });
  const r = await sendPush([token], { title: "🔔 알림 설정 완료!", body: "매일 아침 8시 30분, 신규 청약·LH 공고와 마감 임박 소식을 이렇게 보내드려요.", tag: "test" });
  res.json(r);
}

// ---------- 네이버 부동산 (비공식 내부 API — 데이터센터 IP는 차단될 수 있음) ----------
async function handleNaverLand(res, query) {
  const raw = query.cortarNo || "";
  const cortarNo = /^\d{4,12}$/.test(raw) ? raw : "4129010700"; // 숫자 코드만 허용 (URL 파라미터 주입 방지)
  try {
    const url = `https://new.land.naver.com/api/articles?cortarNo=${cortarNo}&order=rank&realEstateType=APT&tradeType=&page=1`;
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000), // GCP IP는 응답 없이 행 걸리므로 짧게 제한
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
  const q = String(query.q || "부동산").slice(0, 60);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("rss_upstream_" + r.status);
    const xml = await r.text();
    const items = [];
    const blocks = xml.split("<item>").slice(1, 13);
    for (const b of blocks) {
      const pick = (tag) => { const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "") : ""; };
      const rawTitle = stripTags(pick("title"));
      const src = stripTags(pick("source"));
      const pub = pick("pubDate");
      const pubDt = pub ? new Date(pub) : null; // 날짜 하나가 깨져도 전체를 버리지 않게 가드
      const iso = pubDt && !isNaN(+pubDt) ? pubDt.toISOString() : null;
      items.push({
        title: src && rawTitle.endsWith(" - " + src) ? rawTitle.slice(0, -(" - " + src).length) : rawTitle,
        desc: "",
        link: stripTags(pick("link")),
        date: iso ? iso.slice(0, 10) : null,
        ts: iso, // 발행 시각 — 최신순 정렬용
        source: src || "Google뉴스",
      });
    }
    res.set("Cache-Control", "public, max-age=600");
    res.json({ source: "live", q, items });
  } catch (e) {
    console.error("news_failed:", String(e.message || e).slice(0, 200));
    res.status(502).json({ error: "fetch_failed" });
  }
}

// ---------- 은행 주담대 금리 — 금감원 「금융상품 한눈에」 공시 API ----------
// LLM 추정치가 아닌 공시값. https://finlife.fss.or.kr (오픈API → 인증키 신청, 무료)
const FSS_BASE = "https://finlife.fss.or.kr/finlifeapi";
const FSS_LINK = "https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007";

async function fetchFssBankloans(key) {
  const base = [], opts = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${FSS_BASE}/mortgageLoanProductsSearch.json?auth=${encodeURIComponent(key)}&topFinGrpNo=020000&pageNo=${page}`, { signal: AbortSignal.timeout(12000) });
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

// 함수 리전은 UTC — 사용자 기준일은 항상 KST로 계산해야 "오늘"이 하루 밀리지 않는다
const kstYmd = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const today = () => kstYmd();
// 쿼리 파라미터는 LLM 프롬프트에 삽입되므로 길이 제한 + 공백 정규화 (프롬프트 인젝션·비용 남용 방지)
const qstr = (q, k, max = 40) => String((q && q[k]) || "").replace(/\s+/g, " ").trim().slice(0, max);
const qnum = (q, k, cap = 99999) => Math.max(0, Math.min(cap, Number((q && q[k]) || 0) || 0));
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
    daily: false,
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
  // 스드메 — 사용자가 버튼을 눌렀을 때만 조사 (daily 스케줄 제외)
  studios: { daily: false, verify: "웨딩 스튜디오", prompt: vendorPrompt("웨딩 촬영 스튜디오·스냅팀", "인스타그램에서 화제인 감성 스냅·화보 스타일 위주로. 인물/감성/필름/야외 등 스타일과 인스타 계정을 note에 표기."), schema: vendorSchema },
  dresses: { daily: false, verify: "웨딩드레스", prompt: vendorPrompt("웨딩드레스샵", "실루엣·분위기(클래식/모던 등)를 note에 표기."), schema: vendorSchema },
  makeup: { daily: false, verify: "웨딩 메이크업", prompt: vendorPrompt("웨딩 헤어·메이크업샵", "인스타그램에서 인기 있는 감각적인 샵을 포함해 청담 등 주요 상권 위주로, 신부 메이크업 스타일을 note에 표기."), schema: vendorSchema },
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
  // bankloans는 FSS 공시 API가 우선 처리. FSS 키 문제 시 Gemini 폴백용으로만 유지.
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

// ---------- Gemini 리서치 (GEMINI_API_KEY — 무료 티어, aistudio.google.com/apikey) ----------
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

// 모델 후보 — 앞에서부터 시도, 404(모델 종료·미제공)면 다음 후보로 자동 전환.
// ⚠️ gemini-flash-latest 별칭은 무료 쿼터가 없는 모델을 가리킬 수 있어 제외.
const GEMINI_MODELS = () => [env("GEMINI_MODEL"), "gemini-3-flash-preview", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean);
let geminiModelIdx = 0;
let geminiDowngradedAt = 0; // 404로 내려간 시각 — 일정 시간 뒤 선호 모델을 한 번 더 시도한다

async function callGemini(body, { retry429 = true } = {}) {
  const models = GEMINI_MODELS();
  // 일시적 404로 인스턴스 수명 내내 하위 모델에 고착되지 않도록 30분마다 선호 모델을 재시도
  if (geminiModelIdx > 0 && Date.now() - geminiDowngradedAt > 30 * 60 * 1000) geminiModelIdx = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const model = models[Math.min(geminiModelIdx, models.length - 1)];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000), // 리서치는 길지만 무한 대기는 막는다
    });
    if (r.status === 404 && geminiModelIdx < models.length - 1) { geminiModelIdx++; geminiDowngradedAt = Date.now(); continue; } // 모델 종료 → 다음 후보
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
//    Flash 모델이라 빨라서 Hosting 60초 타임아웃 안에도 대부분 완료된다.
async function callGeminiResearch(prompt, schema) {
  let research = "";
  try {
    research = await callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }, { retry429: false }); // 검색 쿼터 없으면 즉시 폴백 (재시도로 시간 낭비 X)
  } catch (e) {
    console.warn("gemini_search_skip:", String(e.message || e).slice(0, 120)); // best-effort — 실패 시 모델 지식으로 진행
  }
  const structured = await callGemini({
    contents: [{ role: "user", parts: [{ text: research.trim()
      ? `아래는 웹 조사 결과야. 원 요청의 항목들을 스키마에 맞는 JSON으로 정리해줘. 조사 결과에 없는 내용은 지어내지 말고, 값이 불확실하면 '추정'을 표기해. 한국어로.\n\n[원 요청]\n${prompt}\n\n[조사 결과]\n${research}`
      : `${prompt}\n\n(웹 검색 도구 없이 네가 알고 있는 최신 정보 기준으로 답해. 실존하는 곳만 담고, 가격 등 불확실한 값에는 '추정'을 표기해.)` }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
  });
  return JSON.parse(structured);
}

// ---------- 업체 실존 검증 (네이버 지역검색 API — developers.naver.com, 무료 25,000회/일) ----------
// LLM이 웹 검색 없이 생성한 업체명은 환각일 수 있어, 네이버에 실제 등록된 업소인지 확인한다.
// 키 미설정 시 검증 생략(기존 동작). 검증 실패 업체는 제외하되, 남는 게 4곳 미만이면
// '실존 미확인' 표기로 유지해 리스트가 비지 않게 한다.
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

const naverApiHeaders = () => ({ "X-Naver-Client-Id": env("NAVER_SEARCH_CLIENT_ID"), "X-Naver-Client-Secret": env("NAVER_SEARCH_CLIENT_SECRET") });

// 네이버 OpenAPI는 초당 호출 제한이 있어(업체 수×2건 동시 요청 시 429) 재시도 + 동시성 제한을 둔다
async function naverFetch(url) {
  // 타임아웃 시그널은 시도마다 새로 만든다 — 재사용하면 백오프 대기까지 한 예산에 포함돼 뒤 시도가 즉시 취소된다
  const opts = () => ({ headers: naverApiHeaders(), signal: AbortSignal.timeout(8000) });
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, opts());
    if (r.status !== 429) return r;
    await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
  }
  return fetch(url, opts());
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
  if (!env("NAVER_SEARCH_CLIENT_ID") || !env("NAVER_SEARCH_CLIENT_SECRET")) return items;
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

// ---------- 공고 리서치 신뢰성 검증 — AI가 만든 공고는 과거 데이터·깨진 URL이 섞일 수 있다 ----------
// ① link는 실제 접속(6초)해서 200이 확인된 것만 남김 ② 마감일이 과거로 파싱되면 항목 제외
async function verifyNoticeLinks(items) {
  const todayStr = kstYmd();
  const checked = await mapLimit(items || [], 3, async (it) => {
    // "2026.07.01 ~ 2026.08.10 접수"처럼 기간으로 오는 경우가 많다 — 가장 늦은 날짜를 마감일로 본다.
    // 첫 날짜(접수 시작일)를 집으면 접수 중인 공고가 "과거 마감"으로 지워진다.
    const dates = [...String(it.deadline || "").matchAll(/(20\d{2})[.\-\/년\s]*(\d{1,2})[.\-\/월\s]*(\d{1,2})/g)]
      .map((m) => `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`)
      .sort();
    if (dates.length && dates[dates.length - 1] < todayStr) return null; // 이미 마감된 과거 공고 제외
    let linkOk = false;
    if (it.link && /^https?:\/\//.test(it.link)) {
      try {
        const r = await fetch(it.link, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
        linkOk = r.ok;
      } catch {}
    }
    return {
      ...it,
      link: linkOk ? it.link : "", // 접속 안 되는 링크는 제거 (프론트는 네이버 검색으로 폴백)
      linkVerified: linkOk,
      deadline: m ? it.deadline : `${it.deadline || "일정 미상"} · ⚠️ 공식 공고로 확인 필요`,
    };
  });
  const alive = checked.filter(Boolean);
  console.log(`verifyNotices: ${items.length}건 중 과거 마감 ${items.length - alive.length}건 제외, 링크 검증 ${alive.filter(x => x.linkVerified).length}건 통과`);
  return alive;
}

// ---------- 리서치 캐시 (Firestore: research/{topic}) ----------
const RESEARCH_TTL_MS = 12 * 60 * 60 * 1000; // 스케줄이 매일 갱신하므로 사실상 항상 캐시 히트
const FORCE_SKIP_MS = 10 * 60 * 1000; // force=1이어도 10분 내 캐시는 그대로 반환 (504 후 재시도 대응)

// 프롬프트가 조건(지역·유형·가격대·소득)에 따라 달라지므로 캐시 문서 ID에 조건을 포함 —
// 다른 조건으로 갱신했는데 이전 조건의 캐시(force여도 10분 내 재사용)가 반환되는 것을 방지.
// 조건 없는 요청·스케줄 갱신은 기존과 같은 ID(topic)를 그대로 쓴다.
function researchCacheKey(topic, query) {
  const sig = ["area", "vtype", "maxMeal", "income"]
    .map((k) => { const v = qstr(query, k); return v ? `${k}=${v}` : ""; })
    .filter(Boolean).join("&");
  return sig ? `${topic}_${encodeURIComponent(sig)}` : topic; // Firestore 문서 ID에 "/" 불가 → 인코딩
}

const cacheDoc = (key) => db.collection("research").doc(key);
async function readResearchCache(key) {
  const snap = await cacheDoc(key).get().catch(() => null);
  return snap && snap.exists ? snap.data() : null;
}
async function writeResearchCache(key, payload) {
  await cacheDoc(key).set({ at: Date.now(), payload }).catch((e) => console.error("cache_write_failed", e));
}

async function runResearch(topic, query) {
  const t = RESEARCH_TOPICS[topic];
  if (topic === "bankloans" && env("FSS_KEY")) {
    try {
      const items = await fetchFssBankloans(env("FSS_KEY"));
      return { source: "fss", topic, items, fetchedAt: new Date().toISOString() };
    } catch (e) {
      // 키 미승인(err 010) 등 — Gemini 리서치로 폴백 가능하면 계속 진행
      console.error("fss_failed:", String(e.message || e).slice(0, 200));
      if (!env("GEMINI_API_KEY")) throw e;
    }
  }
  if (!env("GEMINI_API_KEY")) {
    const err = new Error((topic === "bankloans" ? "FSS_KEY/" : "") + "GEMINI_API_KEY 미설정 (aistudio.google.com/apikey에서 무료 발급) — 기본 데이터를 사용하세요.");
    err.code = 503;
    throw err;
  }
  const data = await callGeminiResearch(t.prompt(query), t.schema);
  let items = data.items || [];
  if (t.verify) items = await verifyVendors(items, t.verify); // 네이버 지역검색으로 실존 업체만 통과
  if (t.verifyLinks) items = await verifyNoticeLinks(items); // 링크 실접속 확인 + 과거 마감 제외
  // LLM이 만든 link는 스킴을 확인한 것만 남긴다 (프론트가 href로 쓰므로 javascript:·data: 차단)
  items = items.map((it) => (it && it.link && !/^https?:\/\//i.test(String(it.link)) ? { ...it, link: "" } : it));
  return { source: "live", topic, items, fetchedAt: new Date().toISOString() };
}

async function handleResearch(res, query) {
  const topic = query.topic;
  // hasOwnProperty로 확인 — RESEARCH_TOPICS[topic]만 보면 "constructor"·"__proto__"가 통과한다
  if (!Object.prototype.hasOwnProperty.call(RESEARCH_TOPICS, topic)) {
    return res.status(400).json({ error: "unknown_topic", topics: Object.keys(RESEARCH_TOPICS) });
  }
  const cacheKey = researchCacheKey(topic, query);
  const cached = await readResearchCache(cacheKey);
  const age = cached ? Date.now() - cached.at : Infinity;
  const maxAge = query.force === "1" ? FORCE_SKIP_MS : RESEARCH_TTL_MS;
  if (cached && age < maxAge && cached.payload && cached.payload.items && cached.payload.items.length) {
    return res.json(cached.payload);
  }
  try {
    const payload = await runResearch(topic, query);
    await writeResearchCache(cacheKey, payload);
    res.json(payload);
  } catch (e) {
    if (e.code === 503 && cached && cached.payload) return res.json(cached.payload); // 키가 빠져도 옛 캐시라도 준다
    res.status(e.code || 502).json({ error: "research_failed", message: String(e.message || e).slice(0, 300) });
  }
}

// ---------- HTTP 엔트리 (Hosting rewrites: /api/** → api) ----------
exports.api = onRequest({ timeoutSeconds: 300, memory: "512MiB", secrets: SECRETS }, async (req, res) => {
  const p = req.path.replace(/\/+$/, "");
  try { // 핸들러가 던지면 여기서 500을 돌려준다 — 안 잡으면 클라이언트가 Hosting 타임아웃(504)까지 기다린다
    if (p === "/api/cheongyak") return await handleCheongyak(res);
    if (p === "/api/realty") return await handleRealty(res, req.query);
    if (p === "/api/lh-notices") return await handleLhNotices(res);
    if (p === "/api/push-register") return await handlePushRegister(req, res);
    if (p === "/api/push-test") return await handlePushTest(req, res);
    if (p === "/api/naver-land") return await handleNaverLand(res, req.query);
    if (p === "/api/news") return await handleNews(res, req.query);
    if (p === "/api/config") return res.json({ naverMapKey: env("NAVER_MAP_KEY"), fcmVapidKey: env("FCM_VAPID_KEY") });
    if (p === "/api/research") return await handleResearch(res, req.query);
    res.status(404).json({ error: "not_found", path: p });
  } catch (e) {
    console.error(`api_unhandled ${p}:`, String((e && e.message) || e).slice(0, 300));
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  }
});

// ---------- 스케줄 알림 (매일 08:30 KST) — 신규 청약·LH 공고·마감 임박 푸시 ----------
exports.notifyDaily = onSchedule({ schedule: "30 8 * * *", timeZone: "Asia/Seoul", timeoutSeconds: 120, memory: "256MiB", secrets: SECRETS }, async () => {
  const tokensSnap = await db.collection("pushTokens").get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (!tokens.length) return console.log("notifyDaily: 등록된 기기 없음");
  const stateRef = db.doc("notify/state");
  const state = (await stateRef.get()).data() || {};
  const seenC = new Set(state.seenCheongyak || []);
  const seenL = new Set(state.seenLh || []);
  const today = kstYmd();
  const tomorrow = kstYmd(Date.now() + 86400e3);
  const lines = [];
  // ① 청약홈 신규 공고 + 마감 임박
  try {
    const KEY = env("CHEONGYAK_KEY");
    const since = kstYmd(Date.now() - 60 * 86400e3);
    const list = await fetchCheongyakList(`serviceKey=${encodeURIComponent(KEY)}`, since, 3);
    const isFirstRun = seenC.size === 0; // 첫 실행은 전부 신규라 알림 폭주 방지 — 상태만 저장
    const fresh = isFirstRun ? [] : list.filter((d) => d.PBLANC_NO && !seenC.has(d.PBLANC_NO));
    fresh.slice(0, 3).forEach((d) => lines.push(`🆕 청약: ${d.HOUSE_NM} (${d.SUBSCRPT_AREA_CODE_NM || ""} · 접수 ${d.RCEPT_BGNDE || "?"}~)`));
    if (fresh.length > 3) lines.push(`… 외 신규 청약 ${fresh.length - 3}건`);
    list.filter((d) => d.RCEPT_ENDDE === today || d.RCEPT_ENDDE === tomorrow)
      .slice(0, 3).forEach((d) => lines.push(`⏰ 접수 마감 임박: ${d.HOUSE_NM} (~${d.RCEPT_ENDDE})`));
    list.forEach((d) => d.PBLANC_NO && seenC.add(d.PBLANC_NO));
  } catch (e) { console.error("notifyDaily cheongyak:", String(e.message || e).slice(0, 150)); }
  // ② LH 수도권 주택 신규 공고
  try {
    const metro = (await fetchLhList()).filter((i) => /서울|경기|인천/.test(i.region));
    const isFirstRun = seenL.size === 0;
    const fresh = isFirstRun ? [] : metro.filter((i) => !seenL.has(String(i.id)));
    fresh.slice(0, 3).forEach((i) => lines.push(`🏠 LH: [${i.type}] ${i.name.slice(0, 32)} (~${i.closeAt || "?"})`));
    if (fresh.length > 3) lines.push(`… 외 LH 신규 ${fresh.length - 3}건`);
    metro.forEach((i) => seenL.add(String(i.id)));
  } catch (e) { console.error("notifyDaily lh:", String(e.message || e).slice(0, 150)); }
  const saveState = () => stateRef.set({ seenCheongyak: [...seenC].slice(-500), seenLh: [...seenL].slice(-800), at: Date.now() });
  if (!lines.length) { await saveState(); return console.log("notifyDaily: 새 소식 없음"); }
  // 발송이 성공한 뒤에 seen을 저장한다 — 먼저 저장하면 FCM 장애 때 그 공고는 다음 날도 알려주지 않는다
  const r = await sendPush(tokens, { title: "📋 오늘의 부동산 공고", body: lines.slice(0, 6).join("\n"), tag: "daily-notice" });
  if (r.ok > 0) await saveState();
  else console.warn("notifyDaily: 전 기기 발송 실패 — seen 상태를 저장하지 않고 다음 실행에 재시도");
  console.log(`notifyDaily: ${lines.length}줄 → ${r.ok}기기 발송 (실패 ${r.failed}, 정리 ${r.bad})`);
});

// ---------- 스케줄 리서치 (매일 06:30 KST) ----------
exports.researchDaily = onSchedule({ schedule: "30 6 * * *", timeZone: "Asia/Seoul", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async () => {
  for (const topic of Object.keys(RESEARCH_TOPICS)) {
    if (RESEARCH_TOPICS[topic].daily === false) continue; // 온디맨드 전용 토픽은 스케줄 제외
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
