/*
 * Firebase Functions(2nd gen) — 대시보드 API
 *
 * Hosting rewrites가 /api/** 를 `api` 함수로 라우팅한다(프론트와 같은 도메인 → CORS 없음).
 *   /api/cheongyak   [로그인 필요] 청약홈 공공데이터 프록시 (CHEONGYAK_KEY)
 *   /api/realty      [로그인 필요] 국토부 실거래가 프록시 (lawd 필수 목록 — 모르는 코드는 400)
 *   /api/lh-notices  [로그인 필요] LH·SH 공고
 *   (naver-land: 공개 라우트 없음 — handleRealty 내부 폴백 전용)
 *   /api/news        [로그인 필요] 구글뉴스 RSS (키 불필요)
 *   /api/geocode     [로그인 필요] 주소→좌표 폴백 (NCP REST → OSM Nominatim 직렬 큐, 키 없어도 동작)
 *   /api/me          [로그인 필요] 허용 계정 판정 {allowed:true} — 프론트 접근 게이트
 *   /api/config      프론트 설정 (네이버 지도 키)
 *   /api/research    topic=bankloans → 금감원 공시 API(FSS_KEY) 우선
 *                    topic=venues|studios|dresses|snaps|makeup|policies → Gemini 웹검색
 *                    (GEMINI_API_KEY — 무료 티어, aistudio.google.com/apikey)
 *   /api/advisor     [POST·로그인 필요] AI 상담사 — 대시보드 상태 + 대화 → Claude 답변·액션 제안
 *                    (Gemini 무료 티어 폴백은 ALLOW_GEMINI_FALLBACK=1 일 때만)
 *                    (프롬프트·도구 정의는 ./advisor.js)
 *   /api/policy-*    [로그인 필요] 정책 값 점검(Claude 웹 검색 — policyReviewJob 트리거가 실행)
 *   /api/sub-*       [로그인 필요] 청약 공고문 PDF 분석(Claude — subAnalyzeJob 트리거가 실행)
 *   /api/listing-*   [로그인 필요] 관심 매물 추출·판단·등기부 판독(Claude) + 시세·건축물대장 조회
 *   /api/quotes      [로그인 필요] 주식·ETF 현재가 ?codes=005930,AAPL (quotes.js — KIS → 네이버 → 야후 → 금융위)
 *   /api/fx [로그인 필요] 한국수출입은행 매매기준율 (KOREAEXIM_KEY — research/fx 6시간 캐시)
 *   /api/saving-rates [로그인 필요] 은행 예금·적금 12/24개월 금리 (금감원 공시 API, FSS_KEY — research/saving-rates 하루 캐시)
 *   /api/policy-radar [로그인 필요] 최근 60일 정책 발표 (GET 캐시, POST {refresh:true} → policyRadarJob 트리거가 Claude 웹 검색)
 *   /api/vendor-lookup [POST·로그인 필요] 스드메 업체 사진(네이버 이미지 검색)·컨셉 요약(Claude 웹 검색) (vendor-lookup.js)
 *   /api/ref-fetch [POST·로그인 필요] 결혼 레퍼런스 — 인스타그램 이미지 서버 사진만 받아 data URL로(호스트 고정, 리다이렉트 안 따라감)
 *   /api/vendor-photos [POST·로그인 필요] 스냅 작가별 작업 사진(네이버 이미지 검색, 최대 20곳·16장, vendorPhotos 7일 캐시)
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
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// 서버 전용 키는 Secret Manager 관리 (firebase functions:secrets:set <KEY>).
// 함수 옵션 secrets에 바인딩하면 런타임에 process.env로 주입되어 env() 헬퍼가 그대로 동작한다.
// NAVER_MAP_KEY·FCM_VAPID_KEY는 /api/config로 클라이언트에 노출되는 공개 키라 .env에 유지.
const SECRETS = ["CHEONGYAK_KEY", "FSS_KEY", "GEMINI_API_KEY", "NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET", "ANTHROPIC_API_KEY", "KIS_APP_KEY", "KIS_APP_SECRET", "KOREAEXIM_KEY"].map(defineSecret);

// Hosting rewrites가 지원하는 리전은 us-central1/us-east1/us-west1/europe-west1/asia-east1 뿐
// — 서울(asia-northeast3)은 라우팅 불가라 가장 가까운 asia-east1(대만) 사용
setGlobalOptions({ region: "asia-east1", maxInstances: 4 });
admin.initializeApp();
const db = admin.firestore();

const env = (k) => process.env[k] || "";

// ---------- 강제 갱신 (새로고침 버튼) ----------
// 조회 프록시는 public Cache-Control로 CDN·브라우저 캐시에 응답을 흡수시킨다. 그래서 새로고침
// 요청이 그냥 나가면 캐시가 응답해 버려 아무 일도 일어나지 않고, 빈 응답이 한 번 캐시되면
// max-age 동안 벗어날 수 없다(프론트는 이걸 샘플 폴백으로 처리 → "새로고침이 안 먹는" 증상).
// 프론트가 force=1을 붙이면 ① 오리진 메모리 캐시를 건너뛰고 ② no-store로 응답해
// CDN·브라우저가 강제 갱신 결과를 재사용하지 못하게 한다.
const isForce = (query) => String((query && query.force) || "") === "1";
// force도 최소 이 간격은 캐시를 준다 — 공개 엔드포인트라 force=1 연타로 업스트림 fan-out을
// 유발할 수 있다. 조회가 비싼 핸들러는 더 긴 하한을 넘겨 쓴다.
const FORCE_FLOOR_MS = 60 * 1000;
const noStore = (res) => res.set("Cache-Control", "no-store");
// 로그인이 필요한 경로(라우터가 res.locals.private를 켬)는 private — Authorization이 붙은 요청의 응답을
// public으로 내보내면 공유 캐시(CDN)가 저장해 비로그인 요청에도 그대로 내려준다 (RFC 9111 §3.5).
const setCache = (res, sec, force) => (force ? noStore(res) : res.set("Cache-Control", `${res.locals && res.locals.private ? "private" : "public"}, max-age=${sec}`));

// ---------- 인증 (허용 계정만) ----------
// 이 API는 Hosting rewrite로 전 세계에 공개되는데 앱 자체는 구글 로그인 + 이메일 화이트리스트다.
// 비용이 큰 경로(리서치 = Gemini·네이버 호출, 상담 = Anthropic 과금)와 상태를 바꾸는 경로(푸시 등록/발송),
// 그리고 요청 1건이 업스트림 수십 건으로 증폭되는 조회 프록시(청약·실거래·LH·지오코딩 — data.go.kr 일일 쿼터,
// Nominatim 1req/s 정책)는 Firebase ID 토큰을 요구한다. 장기전세·config만 캐시로 흡수되는 공개 경로.
const ALLOWED_EMAILS = () => env("ALLOWED_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function verifyCaller(req) {
  // fail-closed — 허용 목록이 비어 있으면(.env 누락) 로그인만으로 통과시키지 않고 전부 503으로 거절한다.
  // 예전엔 "로그인만 확인"으로 열어 두었는데, 그러면 구글 계정 아무나 Anthropic 과금 경로를 쓸 수 있다.
  const allow = ALLOWED_EMAILS();
  if (!allow.length) {
    console.error("verifyCaller: ALLOWED_EMAILS 가 비어 있어 인증 경로를 전부 503으로 거절합니다 — functions/.env 에 허용 계정을 설정하고 재배포하세요 (scripts/predeploy-check.js 가 막아줍니다)");
    const e = new Error("allowlist_unconfigured"); e.code = 503; throw e;
  }
  const m = /^Bearer\s+(.+)$/i.exec(String(req.get("authorization") || ""));
  if (!m) { const e = new Error("no_token"); e.code = 401; throw e; }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1], true); // checkRevoked — '모든 기기 로그아웃'·계정 비활성화 즉시 반영
  } catch { const e = new Error("bad_token"); e.code = 401; throw e; }
  const email = String(decoded.email || "").toLowerCase();
  // email_verified도 요구 — 미인증 이메일 발급 로그인 방식으로 화이트리스트 주소를 사칭하는 우회 차단 (firestore.rules와 동일 기준)
  if (!decoded.email_verified || !allow.includes(email)) { const e = new Error("not_allowed"); e.code = 403; throw e; }
  return email;
}

// ---------- 청약홈 APT 분양정보 (공공데이터포털 ApplyhomeInfoDetailSvc/v1) ----------
const APPLYHOME_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
let cheongyakCache = { at: 0, payload: null }; // 인스턴스 메모리 캐시 (5분)
let cheongyakFailedAt = 0; // 최근 실패 시각 — 실패 직후 반복 호출로 업스트림을 두드리지 않게 한다
const FAIL_COOLDOWN_MS = 60 * 1000;

function ymToDash(ym) { // "202906" → "2029-06"
  const s = String(ym || "");
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : (s || null);
}

// 전국 공고는 6개월치가 100건을 넘는다 — totalCount를 보고 필요한 페이지까지 이어 읽는다.
// 1페이지만 읽으면 API 정렬 순서에 따라 최신 공고가 조용히 빠지고, notifyDaily의 "신규" 판정도 왜곡된다.
// deadlineAt(ms epoch)이 있으면 그 안에서만 읽는다. 2페이지 이후 실패·시간 초과로 잘리면 out.truncated = true
async function fetchCheongyakList(key, since, maxPages = 4, path = "getAPTLttotPblancDetail", deadlineAt = 0) {
  const out = [];
  const tmo = () => AbortSignal.timeout(Math.max(1000, Math.min(12000, deadlineAt ? deadlineAt - Date.now() : 12000)));
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && deadlineAt && deadlineAt - Date.now() < 2000) { out.truncated = true; break; }
    const url = `${APPLYHOME_BASE}/${path}?page=${page}&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    let r;
    try {
      r = await fetch(url, { headers: { Accept: "application/json" }, signal: tmo() });
      if (r.status === 429) { // odcloud 순간 요청 제한 — 잠깐 쉬고 한 번만 재시도
        await new Promise((s) => setTimeout(s, 1500));
        r = await fetch(url, { headers: { Accept: "application/json" }, signal: tmo() });
      }
    } catch (e) { if (page === 1) throw e; out.truncated = true; break; }
    if (!r.ok) { if (page === 1) { const e = new Error(`upstream_${r.status}`); e.status = r.status; throw e; } out.truncated = true; break; }
    const raw = await r.json();
    const data = raw.data || [];
    out.push(...data);
    // 조건 일치 건수는 matchCount뿐 — totalCount는 데이터셋 전체라 종료 판정에 못 쓴다.
    // matchCount가 없으면 빈 페이지가 나올 때까지 읽는다 (전체 건수를 종료 조건으로 오용하지 않음)
    const total = Number(raw.matchCount) || 0;
    if (!data.length || (total && out.length >= total)) break;
    if (page === maxPages && total && out.length < total) console.warn(`cheongyak_truncated: ${out.length}/${total}건만 읽음`);
  }
  return out;
}

// APT 무순위/취소후재공급 (줍줍) — 같은 서비스의 별도 엔드포인트, 같은 키.
// 접수기간 필드가 일반 분양(RCEPT_*)과 다르게 SUBSCRPT_RCEPT_*로 오는 케이스가 있어 둘 다 본다.
// 목록 조회는 주택형(Mdl) 조회 폭주 전에 먼저 한다 — odcloud 순간 요청 제한(429)에 걸리면 목록째 날아간다.
async function fetchRemndrList(key, since, deadlineAt = 0) {
  // 전국 6개월치가 200건을 넘을 수 있고 API 정렬이 최신순 보장이 아니다 — 3페이지까지 읽어 최신 누락을 줄인다
  const all = await fetchCheongyakList(key, since, 3, "getRemndrLttotPblancDetail", deadlineAt);
  const out = all.sort((a, b) => String(b.RCRIT_PBLANC_DE || "").localeCompare(String(a.RCRIT_PBLANC_DE || ""))).slice(0, 30);
  out.truncated = all.truncated;
  return out;
}
// 공고별 주택형 조회 — 마감(deadlineAt)이 지나면 더 부르지 않고 빈 값 (onLate로 잘림 표시)
const fetchMdl = (op, key, d, deadlineAt, onLate) => {
  const left = deadlineAt - Date.now();
  if (left < 2000) { onLate(); return Promise.resolve({ data: [] }); }
  return fetch(`${APPLYHOME_BASE}/${op}?page=1&perPage=50&cond[HOUSE_MANAGE_NO::EQ]=${encodeURIComponent(d.HOUSE_MANAGE_NO)}&cond[PBLANC_NO::EQ]=${encodeURIComponent(d.PBLANC_NO)}&${key}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(Math.min(12000, left)) })
    .then((mr) => (mr.ok ? mr.json() : { data: [] })).catch(() => ({ data: [] }));
};
async function mapRemndr(key, list, deadlineAt, onLate) {
  const models = await mapLimit(list, 8, (d) => fetchMdl("getRemndrLttotPblancMdl", key, d, deadlineAt, onLate));
  return list.map((d, i) => {
    const mdl = (models[i] && models[i].data) || [];
    const areas = [...new Set(mdl.map((m) => Math.floor(parseFloat(m.HOUSE_TY)) || null).filter(Boolean))].sort((a, b) => a - b);
    const prices = mdl.map((m) => Number(m.LTTOT_TOP_AMOUNT) || 0).filter((v) => v > 0);
    return {
      id: `r-${d.PBLANC_NO || d.HOUSE_MANAGE_NO}`, kind: "무순위",
      name: d.HOUSE_NM || d.BSNS_MBY_NM || "무순위 공급",
      region: d.SUBSCRPT_AREA_CODE_NM || "", addr: d.HSSPLY_ADRES || "",
      types: ["무순위"], areas,
      priceMin: prices.length ? Math.min(...prices) * 10000 : null,
      priceMax: prices.length ? Math.max(...prices) * 10000 : null,
      totalUnits: Number(d.TOT_SUPLY_HSHLDCO) || null, specialUnits: null,
      applyStart: d.RCEPT_BGNDE || d.SUBSCRPT_RCEPT_BGNDE || null,
      applyEnd: d.RCEPT_ENDDE || d.SUBSCRPT_RCEPT_ENDDE || null,
      announceDate: d.PRZWNER_PRESNATN_DE || null,
      moveIn: ymToDash(d.MVN_PREARNGE_YM), constructor: d.CNSTRCT_ENTRPS_NM || null,
      priceCap: false, lat: null, lng: null,
      url: d.PBLANC_URL || "https://www.applyhome.co.kr",
    };
  });
}

async function handleCheongyak(res, query) {
  const KEY = env("CHEONGYAK_KEY");
  if (!KEY) return res.status(503).json({ error: "no_key", message: "CHEONGYAK_KEY 미설정 — 샘플데이터를 사용하세요." });
  const force = isForce(query);
  if (cheongyakCache.payload && Date.now() - cheongyakCache.at < (force ? FORCE_FLOOR_MS : 5 * 60 * 1000)) {
    setCache(res, 300, force);
    return res.json(cheongyakCache.payload);
  }
  // 미스 1건이 업스트림 최대 64건(4페이지 + 모델 60건)이라, 실패 직후 재시도 폭주를 막는다
  if (Date.now() - cheongyakFailedAt < FAIL_COOLDOWN_MS) {
    // 만료된 캐시라도 있으면 stale로 준다 — 502를 주면 프론트가 샘플로 떨어진다
    if (cheongyakCache.payload) { setCache(res, 60, force); return res.json(cheongyakCache.payload); }
    noStore(res); // 실패 응답이 CDN에 남으면 재시도 자체가 막힌다
    return res.status(502).json({ error: "fetch_failed", retryAfter: 60 });
  }
  try {
    const key = `serviceKey=${encodeURIComponent(KEY)}`;
    const since = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10);
    // 전체 45초 마감 — Hosting 60초 안에 응답하고, 마감으로 잘린 결과는 1분만 캐시한다
    const deadlineAt = Date.now() + 45000;
    let truncated = false;
    const onLate = () => { truncated = true; };
    const all = await fetchCheongyakList(key, since, 4, undefined, deadlineAt);
    // 무순위 목록은 주택형 조회 폭주 전에 먼저 받아둔다 (odcloud 순간 요청 제한 429 회피)
    let remndrList = [];
    try { remndrList = await fetchRemndrList(key, since, deadlineAt); }
    catch (e) { truncated = true; console.error("remndr_failed:", String(e.message || e).slice(0, 150)); }
    if (all.truncated || remndrList.truncated) truncated = true;
    // 최신 공고가 잘려나가지 않도록 공고일 내림차순으로 정렬한 뒤 자른다
    const list = all.sort((a, b) => String(b.RCRIT_PBLANC_DE || "").localeCompare(String(a.RCRIT_PBLANC_DE || ""))).slice(0, 60);

    // 공고별 주택형 조회 — 동시 8건 제한 (전체 병렬은 429를 부른다)
    const models = await mapLimit(list, 8, (d) => fetchMdl("getAPTLttotPblancMdl", key, d, deadlineAt, onLate));

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
        kind: "일반",
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
    });

    // 무순위(줍줍)도 합친다 — 실패해도 일반 분양 목록은 그대로 낸다
    let remndr = [];
    try { remndr = await mapRemndr(key, remndrList, deadlineAt, onLate); }
    catch (e) { truncated = true; console.error("remndr_mdl_failed:", String(e.message || e).slice(0, 150)); }
    const merged = [...items, ...remndr].sort((a, b) => (b.applyStart || "").localeCompare(a.applyStart || ""));

    const payload = { source: "live", items: merged, fetchedAt: new Date().toISOString() };
    // 빈 목록은 캐시하지 않는다 — 업스트림이 잠깐 0건을 주면 그 응답이 CDN에 5분 박혀서
    // 새로고침으로도 못 벗어난다(프론트는 빈 목록을 샘플 폴백으로 처리한다).
    // 일반 분양이 비면 캐시하지 않는다 — 무순위만 담긴 응답을 캐시하면 일시적 0건이 TTL 동안 박제된다
    // 페이지 중간 실패·마감으로 잘린 결과는 1분만 (오리진 5분 TTL에서 4분 뺀 시각으로 저장)
    if (items.length) {
      if (truncated) console.warn("cheongyak_partial: 일부 페이지·주택형 조회가 빠져 1분만 캐시");
      cheongyakCache = { at: truncated ? Date.now() - 4 * 60 * 1000 : Date.now(), payload };
      setCache(res, truncated ? 60 : 300, force);
    } else {
      noStore(res);
    }
    res.json(payload);
  } catch (e) {
    console.error("cheongyak_failed:", String(e.message || e).slice(0, 300));
    cheongyakFailedAt = Date.now(); // 실패 후 1분은 재시도 안 함 (아래 쿨다운 검사)
    noStore(res);
    res.status(502).json({ error: "fetch_failed" }); // 업스트림 상세는 로그로만 (정찰·키 에코 방지)
  }
}

// ---------- 국토부 아파트 실거래가 (매매+전월세) — data.go.kr 공식 API ----------
// 네이버 비공식 API가 봇 차단(GCP IP는 응답 없이 행)으로 막혀서 공식 실거래가로 전환.
// 키는 data.go.kr 계정 공용(MOLIT_KEY 없으면 CHEONGYAK_KEY 재사용) — 두 실거래가 API 활용신청 필요.
// 지원 지역 = 수도권 시/군/구 (법정동코드 앞 5자리 → 주소 표기용 풀네임).
// 임의 lawd를 그대로 받으면 요청 1건이 업스트림 18건(6종 × 3개월, 거래 많은 구는 페이지만큼 더)으로 증폭되므로 이 테이블에 있는 코드만 허용한다.
// 프론트 dashboard/app.jsx의 LAWD_REGIONS와 같이 관리.
const LAWD_NAMES = {
  // 서울특별시
  11110: "서울특별시 종로구", 11140: "서울특별시 중구", 11170: "서울특별시 용산구", 11200: "서울특별시 성동구",
  11215: "서울특별시 광진구", 11230: "서울특별시 동대문구", 11260: "서울특별시 중랑구", 11290: "서울특별시 성북구",
  11305: "서울특별시 강북구", 11320: "서울특별시 도봉구", 11350: "서울특별시 노원구", 11380: "서울특별시 은평구",
  11410: "서울특별시 서대문구", 11440: "서울특별시 마포구", 11470: "서울특별시 양천구", 11500: "서울특별시 강서구",
  11530: "서울특별시 구로구", 11545: "서울특별시 금천구", 11560: "서울특별시 영등포구", 11590: "서울특별시 동작구",
  11620: "서울특별시 관악구", 11650: "서울특별시 서초구", 11680: "서울특별시 강남구", 11710: "서울특별시 송파구",
  11740: "서울특별시 강동구",
  // 경기도
  41111: "경기도 수원시 장안구", 41113: "경기도 수원시 권선구", 41115: "경기도 수원시 팔달구", 41117: "경기도 수원시 영통구",
  41131: "경기도 성남시 수정구", 41133: "경기도 성남시 중원구", 41135: "경기도 성남시 분당구",
  41150: "경기도 의정부시", 41171: "경기도 안양시 만안구", 41173: "경기도 안양시 동안구", 41190: "경기도 부천시",
  41210: "경기도 광명시", 41220: "경기도 평택시", 41250: "경기도 동두천시",
  41271: "경기도 안산시 상록구", 41273: "경기도 안산시 단원구",
  41281: "경기도 고양시 덕양구", 41285: "경기도 고양시 일산동구", 41287: "경기도 고양시 일산서구",
  41290: "경기도 과천시", 41310: "경기도 구리시", 41360: "경기도 남양주시", 41370: "경기도 오산시",
  41390: "경기도 시흥시", 41410: "경기도 군포시", 41430: "경기도 의왕시", 41450: "경기도 하남시",
  41461: "경기도 용인시 처인구", 41463: "경기도 용인시 기흥구", 41465: "경기도 용인시 수지구",
  41480: "경기도 파주시", 41500: "경기도 이천시", 41550: "경기도 안성시", 41570: "경기도 김포시",
  41590: "경기도 화성시", 41610: "경기도 광주시", 41630: "경기도 양주시", 41650: "경기도 포천시",
  41670: "경기도 여주시", 41800: "경기도 연천군", 41820: "경기도 가평군", 41830: "경기도 양평군",
  // 인천광역시
  28110: "인천광역시 중구", 28140: "인천광역시 동구", 28177: "인천광역시 미추홀구", 28185: "인천광역시 연수구",
  28200: "인천광역시 남동구", 28237: "인천광역시 부평구", 28245: "인천광역시 계양구", 28260: "인천광역시 서구",
  28710: "인천광역시 강화군", 28720: "인천광역시 옹진군",
};
const molitCache = new Map(); // lawd → { at, payload } 인스턴스 캐시 (5분). 단일 슬롯이면 지역을 번갈아 호출해 무력화됨
const xmlPick = (block, ...tags) => {
  for (const t of tags) { const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); if (m) return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(); }
  return "";
};
const molitNum = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;
const MOLIT_ROWS = 1000, MOLIT_MAX_PAGES = 5; // 요청당 1000건 × 최대 5페이지 — 넘으면 molit_truncated 로그

async function fetchMolit(lawd) {
  const KEY = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
  // 일자를 1로 고정해서 계산 — setMonth로 빼면 31일에 "4월 31일"이 5월로 롤오버되어 한 달이 통째로 빠진다
  // 기준월은 KST — 서버 로컬(UTC)로 계산하면 매월 1일 00~09시(KST)에 새 달이 창에서 빠진다
  const base = new Date(Date.now() + 9 * 3600e3);
  const months = [0, 1, 2].map((i) => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1)); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
  const key = encodeURIComponent(KEY);
  const reqs = [];
  for (const ym of months) {
    reqs.push(["trade", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
    reqs.push(["rent", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
    // 빌라(연립·다세대) 매매·전월세
    reqs.push(["trade", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
    reqs.push(["rent", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
    // 오피스텔 매매·전월세 — 별도 활용신청 필요(키 공용), 미신청이면 조용히 건너뛴다
    reqs.push(["trade", "offi", `https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
    reqs.push(["rent", "offi", `https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=${MOLIT_ROWS}`]);
  }
  const items = [];
  // 개별 API 실패(미신청 등)해도 나머지는 계속
  const getXml = async (u, ms) => { try { return await (await fetch(u, { signal: AbortSignal.timeout(ms) })).text(); } catch { return ""; } };
  // 한 달 전월세가 1000건을 넘는 구가 있다 — totalCount를 보고 나머지 페이지를 병렬로 (최대 MOLIT_MAX_PAGES, 첫 페이지 12초 + 나머지 10초)
  const xmls = await Promise.all(reqs.map(async ([kind, bldg, u]) => {
    const first = await getXml(u, 12000);
    const total = Number(xmlPick(first, "totalCount")) || 0;
    if (total > MOLIT_ROWS * MOLIT_MAX_PAGES) console.warn(`molit_truncated ${lawd} ${kind}/${bldg}: ${MOLIT_ROWS * MOLIT_MAX_PAGES}/${total}건만 읽음`);
    const pages = Math.min(MOLIT_MAX_PAGES, Math.ceil(total / MOLIT_ROWS));
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getXml(`${u}&pageNo=${i + 2}`, 10000)));
    return [kind, bldg, [first, ...rest].join("\n")];
  }));
  let unauthorized = 0;
  for (const [kind, bldg, xml] of xmls) {
    if (!xml.includes("<item>")) {
      if (/SERVICE_KEY|Unauthorized|등록되지 않은|SERVICE ERROR/i.test(xml)) unauthorized++;
      continue; // 해당 월 거래 없음 또는 미신청
    }
    for (const block of xml.split("<item>").slice(1)) {
      const apt = xmlPick(block, "aptNm", "mhouseNm", "offiNm", "아파트", "연립다세대", "오피스텔");
      if (!apt) continue;
      // 계약 해제(취소)된 거래 제외 — 해제 건이 남으면 "없는 거래"가 목록에 계속 소개된다
      if (/o/i.test(xmlPick(block, "cdealType", "해제여부"))) continue;
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
  // 전체 상한만 두면 거래량 많은 아파트·빌라가 오피스텔을 밀어낸다 — 유형별 상한(최신순 150건)으로 대체
  const cnt = {};
  return items.filter((it) => (cnt[it.bldg] = (cnt[it.bldg] || 0) + 1) <= 150);
}

// ---------- K-apt 공동주택 단지 세대수 — 아파트 실거래 항목에 units 필드 부착 ----------
// data.go.kr 「공동주택 단지 목록제공 서비스」 + 「공동주택 기본 정보제공 서비스」 활용신청 필요(키 공용).
// 미신청이면 조용히 건너뛴다 — 프론트는 세대수 필터에 안내 문구를 띄운다.
const kaptCache = new Map(); // lawd → { at, map: {정규화단지명: 세대수} } (24시간)
const kaptInflight = new Map(); // lawd → 진행 중 프로미스 — 없으면 첫 수집(최대 수백 콜) 중 동시 요청마다 크롤이 중복 실행된다
const kaptNorm = (s) => String(s || "").replace(/\s+/g, "").replace(/[()·．.-]/g, "").toLowerCase();
async function fetchKaptMap(lawd, force) {
  const hit = kaptCache.get(lawd);
  // 성공 결과는 24시간 재사용. 실패/빈 결과(미신청·상세 API만 실패)는 force(새로고침)로 즉시 재시도 가능 —
  // 사용자가 방금 API를 활용신청한 직후 1시간을 기다리지 않게 한다. ({}도 실패로 취급해야 force가 뚫린다)
  const isEmpty = !hit || !hit.map || !Object.keys(hit.map).length;
  if (hit && Date.now() - hit.at < 24 * 3600e3 && !(force && isEmpty)) return hit.map;
  if (kaptInflight.has(lawd)) return kaptInflight.get(lawd);
  const p = fetchKaptMapInner(lawd).finally(() => kaptInflight.delete(lawd));
  kaptInflight.set(lawd, p);
  return p;
}
async function fetchKaptMapInner(lawd) {
  const KEY = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
  if (!KEY) return null;
  const key = encodeURIComponent(KEY);
  const map = {};
  // data.go.kr K-apt 응답은 기본이 JSON({response:{body:{items|item}}}) — XML로 와도 처리한다
  const parseItems = (t) => {
    if (t.includes("<kaptCode>")) return t.split("<item>").slice(1).map((b) => ({ code: xmlPick(b, "kaptCode"), name: xmlPick(b, "kaptName") }));
    try {
      const body = JSON.parse(t).response?.body;
      let arr = body && body.items;
      if (arr && !Array.isArray(arr)) arr = arr.item;
      if (arr && !Array.isArray(arr)) arr = [arr];
      return (arr || []).map((x) => ({ code: x.kaptCode, name: x.kaptName }));
    } catch { return null; } // 파싱 불가 = 에러 응답 (미신청 등)
  };
  try {
    // 단지 목록 (AptListService3 — 큰 구는 300건 초과라 최대 3페이지)
    const complexes = []; let lastResp = "";
    for (let page = 1; page <= 3; page++) {
      let arr = null;
      try {
        const r = await fetch(`https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3?serviceKey=${key}&sigunguCode=${lawd}&pageNo=${page}&numOfRows=300`, { signal: AbortSignal.timeout(10000) });
        const t = await r.text();
        arr = parseItems(t);
        if (arr === null) lastResp = t.replace(/\s+/g, " ").slice(0, 250);
      } catch (e) { lastResp = String(e.message || e).slice(0, 120); }
      if (!arr || !arr.length) break;
      complexes.push(...arr.filter((c) => c.code));
      if (arr.length < 300) break;
    }
    if (!complexes.length) { // 미신청/장애 — 1시간 뒤 재시도하도록 짧게 캐시. 사유는 로그로 (미신청/키오류 구분용)
      console.error("kapt_list_empty:", lawd, lastResp.replace(/serviceKey=[^&\s"]+/gi, "serviceKey=***"));
      kaptCache.set(lawd, { at: Date.now() - 23 * 3600e3, map: null });
      return null;
    }
    for (let i = 0; i < complexes.length; i += 10) { // 상세(세대수)는 단지당 1콜 — 10개씩 배치, 24시간 캐시라 부담 없음
      await Promise.all(complexes.slice(i, i + 10).map(async (c) => {
        try {
          const r = await fetch(`https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?serviceKey=${key}&kaptCode=${encodeURIComponent(c.code)}`, { signal: AbortSignal.timeout(10000) });
          const t = await r.text();
          let n = Number(xmlPick(t, "kaptdaCnt"));
          if (!n) { try { n = Number(JSON.parse(t).response?.body?.item?.kaptdaCnt); } catch {} }
          if (n) map[kaptNorm(c.name)] = n;
        } catch {}
      }));
    }
  } catch (e) { console.error("kapt_failed:", String(e.message || e).slice(0, 200)); }
  // 목록은 됐는데 상세(세대수)가 전부 실패해 빈 맵이면 성공 캐시(24h) 대신 1시간짜리로 — force로도 재시도 가능
  kaptCache.set(lawd, { at: Object.keys(map).length ? Date.now() : Date.now() - 23 * 3600e3, map });
  return map;
}
function attachUnits(items, kmap) {
  if (!kmap) return items;
  const keys = Object.keys(kmap);
  if (!keys.length) return items;
  return items.map((it) => {
    if (it.bldg !== "apt") return it;
    const n = kaptNorm(it.complex);
    let u = kmap[n];
    // 표기 차이(주공1단지 vs 1단지) 부분일치 보정 — 단 4자 미만("삼성"·"현대")은 엉뚱한 단지에 붙으므로 제외
    if (!u && n.length >= 4) { const k = keys.find((x) => x.length >= 4 && (x.includes(n) || n.includes(x))); if (k) u = kmap[k]; }
    return u ? { ...it, units: u } : it;
  });
}

// ---------- 주소 지오코딩 — 카드 클릭 → 지도 이동의 서버 폴백 ----------
// 프론트의 네이버 SDK 지오코더는 NCP 앱에 Geocoding 사용 설정이 없으면 실패한다.
// ① NCP REST(NAVER_MAP_SECRET 설정 시) ② OSM Nominatim(키 불필요, 동 단위 정확도) 순서로 폴백.
// 청약홈 주소는 "289-29번지 일원"·"외 N필지"·"공공주택지구 내 B-1BL"처럼 지오코더가 못 읽는
// 꼬리 표기가 붙는다 — 정밀한 형태부터 행정구역 단위까지 차례로 시도 (dashboard/app.jsx와 이름·본문 동일 유지)
function geoVariants(q) {
  const out = [];
  const push = (v) => { v = String(v || "").replace(/\s+/g, " ").trim(); if (v && !out.includes(v)) out.push(v); };
  push(q);
  const noBunji = q.replace(/(\d+[\d-]*)\s*번지.*$/, "$1"); // "289-29번지 일원" → "289-29"
  push(noBunji);
  push(q.replace(/\s*(?:일원|번지|외\s*\d+\s*필지|공공주택지구|도시개발|택지개발|지구\s*내).*$/, "")); // 꼬리 표기 절단
  push(noBunji.replace(/\s+\d[\d-]*\s*$/, "")); // 지번 떼고 동 단위
  const gu = q.match(/^\S+(?:특별시|광역시|특별자치시|특별자치도|도|시)\s+\S+?(?:시|군|구)(?:\s+\S+?(?:구|군))?/); // 최후엔 시/군/구 단위
  if (gu) push(gu[0]);
  return out;
}

const geoSrvCache = new Map(); // q → {lat,lng} 또는 {miss:true, at} — 성공 좌표는 불변, 실패는 10분 뒤 재시도
const GEO_CACHE_MAX = 500;
const GEO_MISS_TTL = 10 * 60 * 1000;
// Nominatim 이용정책(1 req/s) 준수 — 인스턴스 단위 직렬 큐. 동시 요청이 들어와도 프로미스 체인에 줄을 세워
// 실제 fetch 사이 간격이 1.1초 미만이 되지 않게 한다 (타임스탬프만 보면 동시 진입한 요청들이 같은 대기시간을 계산해 함께 나간다).
let lastNominatimAt = 0;
let nominatimChain = Promise.resolve();
function nominatimFetch(v) {
  const run = nominatimChain.then(async () => {
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimAt = Date.now();
    return fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(v)}`,
      { headers: { "User-Agent": "futurePlanner/1.0 (personal dashboard)" }, signal: AbortSignal.timeout(8000) });
  });
  nominatimChain = run.catch(() => {}); // 한 건이 실패해도 큐는 계속 흐른다
  return run;
}
async function handleGeocode(res, query) {
  const q = String(query.q || "").trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: "q_required" });
  const cached = geoSrvCache.get(q);
  if (cached && !(cached.miss && Date.now() - cached.at > GEO_MISS_TTL)) {
    if (cached.miss) { noStore(res); return res.status(404).json({ error: "not_found" }); } // 실패도 기억 — 같은 주소 재클릭마다 변형 탐색을 반복하지 않게
    setCache(res, 86400);
    return res.json(cached);
  }
  const variants = geoVariants(q);
  let out = null;
  let definitive = false; // 업스트림이 정상 응답으로 "결과 없음"을 준 적이 있는가 — 일시 장애를 10분 404로 박제하지 않기 위해
  const id = env("NAVER_MAP_KEY"), secret = env("NAVER_MAP_SECRET");
  if (id && secret) { // ① NCP REST — 빠르므로 전 변형을 먼저 훑는다
    for (const v of variants) {
      try {
        const r = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(v)}`,
          { headers: { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret }, signal: AbortSignal.timeout(8000) });
        if (r.ok) { definitive = true; const j = await r.json(); const a = j && j.addresses && j.addresses[0]; if (a) { out = { lat: Number(a.y), lng: Number(a.x) }; break; } }
      } catch {}
    }
  }
  // ② OSM Nominatim — 1.1초/건 페이싱이 있어 최대 3변형만: 지번 정리본 → 동 단위 → 시/군/구
  //    (원 주소는 꼬리 표기 탓에 가장 실패하기 쉬워 4개 이상일 때 뺀다)
  const nomiTries = variants.length > 3 ? [variants[1], variants[variants.length - 2], variants[variants.length - 1]] : variants;
  for (const v of nomiTries) {
    if (out) break;
    try {
      const r = await nominatimFetch(v);
      if (r.ok) { definitive = true; const j = await r.json(); if (Array.isArray(j) && j[0]) out = { lat: Number(j[0].lat), lng: Number(j[0].lon) }; }
    } catch {}
  }
  if (geoSrvCache.size >= GEO_CACHE_MAX) geoSrvCache.delete(geoSrvCache.keys().next().value); // 가장 오래된 항목부터 방출
  if (!out) {
    if (definitive) geoSrvCache.set(q, { miss: true, at: Date.now() }); // 진짜 "없는 주소"만 기억 — 타임아웃·429는 다음 요청에서 재시도
    noStore(res);
    return res.status(404).json({ error: "not_found" });
  }
  geoSrvCache.set(q, out);
  setCache(res, 86400);
  res.json(out);
}

// 매물·실거래 통합: ① 국토부 실거래가(공식) → ② 네이버(비공식, 5초 타임아웃) → ③ 503(프론트 샘플 폴백)
async function handleRealty(res, query) {
  // 지원 지역만 허용 — 임의 lawd를 받으면 요청 1건이 업스트림 18건 이상으로 증폭되어 공용 키 쿼터가 소진된다.
  // 모르는 코드는 과천으로 조용히 바꾸지 않고 400 — 프론트가 다른 지역을 요청했는데 과천 데이터가 "live"로 보이면 지역이 뒤섞인다.
  const rawLawd = String(query.lawd || "");
  if (rawLawd && !Object.prototype.hasOwnProperty.call(LAWD_NAMES, rawLawd)) { noStore(res); return res.status(400).json({ error: "unknown_lawd" }); }
  const lawd = rawLawd || "41290";
  const force = isForce(query);
  const hit = molitCache.get(lawd);
  if (hit && Date.now() - hit.at < (force ? FORCE_FLOOR_MS : 5 * 60 * 1000)) {
    // 네거티브 엔트리는 오리진에서만 흡수한다 — 그대로 응답하면서 Cache-Control을 붙이면
    // CDN이 빈 결과를 5분 고정해 오리진 TTL 1분이 무력화되고 폴백도 막힌다
    if (hit.negative) return handleNaverLand(res, query);
    setCache(res, 300, force);
    return res.json(hit.payload);
  }
  if (env("MOLIT_KEY") || env("CHEONGYAK_KEY")) {
    try {
      let items = await fetchMolit(lawd);
      if (items.length) {
        // 아파트 단지 세대수 부착 — K-apt 첫 수집이 느려도 실거래 응답을 25초 이상 잡지 않는다
        try { items = attachUnits(items, await Promise.race([fetchKaptMap(lawd, force), new Promise((r) => setTimeout(() => r(null), 25000))])); } catch {}
        const payload = { source: "live", kind: "molit", items, fetchedAt: new Date().toISOString() };
        molitCache.set(lawd, { at: Date.now(), payload });
        setCache(res, 300, force);
        return res.json(payload);
      }
      // 빈 결과도 짧게 캐시 — 안 하면 거래 없는 달마다 매 요청이 그대로 업스트림으로 나간다
      // (at을 4분 과거로 두어 유효 TTL 1분). negative 표시로 CDN 캐시·거짓 라벨을 피한다
      molitCache.set(lawd, { at: Date.now() - 4 * 60 * 1000, negative: true, payload: null });
    } catch (e) {
      console.error("molit_failed:", String(e.message || e).slice(0, 200));
      // 실패도 짧게 캐시 — 안 하면 업스트림 장애·미신청 상태에서 매 요청이 18건 fan-out을 반복한다
      molitCache.set(lawd, { at: Date.now() - 4.5 * 60 * 1000, negative: true, payload: null });
    }
  }
  return handleNaverLand(res, query); // 폴백 — cortarNo가 있을 때만 시도(대부분 차단), 없으면 502
}

// 본문은 앞부분만 읽는다 — 상한이 없으면 대용량 응답에 함수 메모리가 날아간다
async function readCapped(r, maxBytes = 256 * 1024) {
  const reader = r.body && r.body.getReader ? r.body.getReader() : null;
  if (!reader) return (await r.text()).slice(0, maxBytes);
  const chunks = [];
  let n = 0;
  try {
    while (n < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.length;
    }
  } finally { try { await reader.cancel(); } catch {} }
  return Buffer.concat(chunks).toString("utf8");
}

// ---------- LH 분양·임대 공고 (data.go.kr B552555) — 행복주택·국민임대·공공분양 등 실시간 공고 ----------
// 활용신청: 「한국토지주택공사_분양임대공고문 조회 서비스」 (키는 data.go.kr 계정 공용)
let lhCache = { at: 0, payload: null };
async function fetchLhList() { // 공고 목록 — API 미신청/오류 시 throw
  const KEY = env("LH_KEY") || env("CHEONGYAK_KEY");
  if (!KEY) { const e = new Error("CHEONGYAK_KEY/LH_KEY 미설정 — 안내 링크를 사용하세요."); e.code = 503; throw e; }
  const PG_SZ = 100, MAX_PAGES = 10; // 상한 = 최근 1,000건 — 전 지역이 담기고도 남고, data.go.kr 트래픽도 지킨다
  const fetchPage = async (page) => {
    const r = await fetch(`https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1?serviceKey=${encodeURIComponent(KEY)}&PG_SZ=${PG_SZ}&PAGE=${page}`, {
      signal: AbortSignal.timeout(12000), headers: { Accept: "application/json" },
    });
    const t = (await r.text()).trim();
    if (!t.startsWith("{") && !t.startsWith("[")) {
      const e = new Error("LH 공고 API 미신청 — data.go.kr에서 「LH 분양임대공고문 조회」 활용신청 필요"); e.code = 503; throw e;
    }
    const j = JSON.parse(t);
    const arr = Array.isArray(j) ? j : [j];
    return {
      rows: arr.flatMap((o) => (o && o.dsList) ? o.dsList : []),
      total: Number(arr.flatMap((o) => (o && o.dsCount) ? o.dsCount : [])
        .map((c) => c && (c.COUNT ?? c.DS_CNT ?? c.TOT_CNT)).find((n) => Number(n) > 0)) || 0,
    };
  };
  // 최신순 1페이지(100건)만 보면 공고가 뜸한 지역(서울 등)이 통째로 빠진다 — 총 건수 기준으로 전체 페이지네이션.
  // 1페이지로 총 건수를 확인하고 나머지 페이지는 병렬 조회 (보강 페이지는 실패해도 무시)
  const first = await fetchPage(1);
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil((first.total || PG_SZ * MAX_PAGES) / PG_SZ)));
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetchPage(i + 2).then((p) => p.rows).catch(() => [])));
  const seen = new Set();
  const list = [first.rows, ...rest].flat().filter((d) => {
    const k = d.PAN_ID || d.PAN_NM;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
// ---------- SH 분양·임대 모집공고 — 공식 API가 없어 SH 청약시스템 공고 게시판을 파싱한다 (장기전세 파싱과 같은 게시판, isRecrnoti=Y가 모집공고 필터) ----------
// 게시판 목록에는 유형 컬럼이 없어 공고명 키워드로 분류한다 (미매칭은 "기타 모집")
const SH_TYPE_RULES = [
  [/장기전세|시프트|미리내집/, "장기전세"], [/청년안심/, "청년안심주택"], [/행복주택/, "행복주택"],
  [/재개발임대/, "재개발임대"], [/도시형생활/, "도시형생활주택"], [/전세임대/, "전세임대"],
  [/매입임대|수요자맞춤|예술인주택|청년주택/, "매입임대"], [/장기안심/, "장기안심주택"], [/희망하우징/, "희망하우징"],
  [/두레주택/, "두레주택"], [/사회주택/, "사회주택"], [/국민임대|공공임대|영구임대/, "국민·공공임대"],
  [/분양|뉴:?홈|신혼희망/, "공공분양"],
];
const shNoticeType = (name) => (SH_TYPE_RULES.find(([re]) => re.test(name)) || [null, "기타 모집"])[1];
// 당첨자/심사 발표는 결과 안내, 운영기관 모집은 입주자 대상이 아니라 제외.
// '취소'는 공고 취소 안내만 걸러낸다 — '취소분 재공급' 모집공고는 실제 신청 대상이라 남긴다.
const shNoticeExcluded = (name) => /발표|서류심사|당첨자|운영기관/.test(name) || (/취소/.test(name) && !/재공급/.test(name));
// ---------- 청년안심주택 접수기간 보강 (서울시 포털 soco.seoul.go.kr) ----------
// SH 게시판에는 접수기간이 없다(첨부 PDF에만 존재) — "오늘부터 접수" 같은 핵심 정보가 빠진다.
// 서울시 청년안심주택 포털 JSON이 청약신청일(optn4)과 본문(접수기간 텍스트)을 구조화해 주므로
// ① SH 공공임대 공고에 마감일을 보강하고 ② SH 게시판에 안 올라오는 민간임대 공고를 별도 항목으로 추가한다.
const SOCO_BASE = "https://soco.seoul.go.kr";
const SOCO_VIEW = (id) => `${SOCO_BASE}/youth/bbs/BMSR00015/view.do?boardId=${id}&menuNo=400008`;
const mdShort = (v) => { const [, m, d] = String(v).split("-"); return `${Number(m)}/${Number(d)}`; };
// 본문에서 접수/신청 기간을 뽑는다. 형식 변형이 많다:
//   "청약 접수일 : 2026. 08. 11. (화) 10:00 ~ 2026. 08. 13. (목) 17:00"
//   "■신청 : ‘26. 08. 09. (일) 00:00 ~ 08. 10. (월) 23:00"  (끝 날짜에 연도 없음)
//   "■신청 : ‘26. 08. 10. (월) 10:00 ~ 16:00"                (당일 마감 — 끝이 시각뿐)
function socoApplyRange(content) {
  const seg = (shTxt(content).match(/(?:청약\s*)?(?:접수일?|신청)\s*[::][^■]{0,90}/) || [])[0];
  if (!seg) return null;
  const yy = (y) => { const n = Number(String(y).replace(/[‘’']/g, "")); return n < 100 ? 2000 + n : n; };
  const dates = [...seg.matchAll(/(?:(20\d{2}|[‘’']\d{2})[.\s]+)?(\d{1,2})[.\s]+(\d{1,2})(?=[.\s(])/g)]
    .map((m) => ({ y: m[1] ? yy(m[1]) : null, m: Number(m[2]), d: Number(m[3]) }))
    .filter((x) => x.m >= 1 && x.m <= 12 && x.d >= 1 && x.d <= 31);
  if (!dates.length || !dates[0].y) return null;
  const fmt = (x, fy) => `${x.y || fy}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;
  const start = fmt(dates[0], dates[0].y);
  if (!seg.includes("~")) return { start, end: "" };
  // 끝 날짜의 월·일이 시작일보다 앞서면 해를 넘긴 기간(12/30 ~ 1/2)이다 (연도가 명시돼 있으면 fmt이 그 값을 쓴다)
  const rolls = dates[1] && (dates[1].m < dates[0].m || (dates[1].m === dates[0].m && dates[1].d < dates[0].d));
  return { start, end: dates[1] ? fmt(dates[1], dates[0].y + (rolls ? 1 : 0)) : start }; // 끝 날짜가 없으면(시각만) 당일 마감
}
async function fetchSocoYouth() {
  const r = await fetch(`${SOCO_BASE}/youth/pgm/home/yohome/bbsListJson.json`, {
    method: "POST", signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "bbsId=BMSR00015&pageIndex=1",
  });
  if (!r.ok) { const e = new Error("soco_upstream_" + r.status); e.code = 502; throw e; }
  const t = await readCapped(r, 1024 * 1024);
  return (JSON.parse(t).resultList || []).map((x) => ({
    boardId: String(x.boardId || ""), name: shTxt(x.nttSj),
    minkan: String(x.optn2) === "2", // 구분 1=공공임대(SH), 2=민간임대(민간사업자)
    postedAt: String(x.optn1 || ""), applyStart: String(x.optn4 || ""),
    range: socoApplyRange(x.content),
  })).filter((x) => x.boardId && x.name);
}
// SH 목록에 청년안심주택 접수기간을 보강하고 민간임대 공고를 추가 — 포털 실패 시 원본 그대로 (예외처리)
async function enrichShWithSoco(out) {
  let soco;
  try { soco = await fetchSocoYouth(); }
  catch (e) { console.error("soco_failed:", String(e.message || e).slice(0, 150)); return out; }
  // 같은 날 1차·2차가 함께 나올 수 있어 게시일만으로는 매칭이 충돌한다 — 연도·차수 토큰까지 맞춘다
  const socoKey = (nm) => `${(String(nm).match(/(20\d{2})\s*년/) || [])[1] || ""}|${(String(nm).match(/(\d+)\s*차/) || [])[1] || ""}`;
  for (const it of out) {
    if (it.type !== "청년안심주택") continue;
    const hit = soco.find((s) => !s.minkan && /청년안심/.test(s.name)
      && String(s.postedAt).slice(0, 10) === String(it.postedAt).slice(0, 10) // 시각 접미사가 붙어도 날짜만 비교
      && socoKey(s.name) === socoKey(it.name));
    if (!hit || !hit.range || !hit.range.end) continue;
    // 상태 문구는 표시용, 날짜 판단은 applyStart/End·closeAt 필드로 — 캘린더가 접수시작 이벤트도 찍을 수 있다
    it.applyStart = hit.range.start;
    it.applyEnd = hit.range.end;
    it.closeAt = hit.range.end;
    it.status = `신청 ${mdShort(hit.range.start)}~${mdShort(hit.range.end)}`;
  }
  for (const s of soco) {
    if (!s.minkan || shNoticeExcluded(s.name)) continue; // 게시판 경로와 같은 제외 규칙 — 발표 글이 '진행 중 공고'로 둔갑하지 않게
    const end = (s.range && s.range.end) || "";
    const start = (s.range && s.range.start) || s.applyStart;
    out.push({
      id: `soco-${s.boardId}`, name: s.name, agency: "서울시", category: "", type: "청년안심주택",
      region: "서울특별시", postedAt: s.postedAt, applyStart: start || "", applyEnd: end, closeAt: end,
      status: start && end ? `신청 ${mdShort(start)}~${mdShort(end)}` : "공고문 확인",
      url: SOCO_VIEW(s.boardId),
    });
  }
  return out;
}
async function fetchShNotices() {
  const SH_PAGES = 3; // 페이지당 10건 — 3페이지면 최근 2~3개월 모집공고가 담긴다
  const fetchPage = async (page) => {
    const r = await fetch(`${SH_BRD}/list.do?isRecrnoti=Y&page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) { const e = new Error("sh_upstream_" + r.status); e.code = 502; throw e; }
    return await readCapped(r, 512 * 1024);
  };
  // 1페이지는 필수, 보강 페이지는 실패해도 무시 (LH 페이지네이션과 같은 정책)
  const pages = [await fetchPage(1), ...await Promise.all(Array.from({ length: SH_PAGES - 1 }, (_, i) => fetchPage(i + 2).catch(() => "")))];
  const out = [], seen = new Set();
  for (const html of pages) {
    for (const row of html.split(/<tr[^>]*>/).slice(1)) {
      const seq = row.match(/getDetailView\('(\d+)'\)/);
      if (!seq || seen.has(seq[1])) continue;
      seen.add(seq[1]);
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => shTxt(m[1]));
      const name = cells[1] || "";
      if (!name || shNoticeExcluded(name)) continue;
      out.push({
        id: `sh-${seq[1]}`, name, agency: "SH", category: "", type: shNoticeType(name), region: "서울특별시",
        postedAt: cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) || "",
        closeAt: "", status: "공고문 확인", // 게시판 목록에는 접수기간이 없다 — 마감 판단은 프론트에서 게시일 기준
        url: `${SH_BRD}/view.do?seq=${seq[1]}`,
      });
    }
  }
  return enrichShWithSoco(out);
}
async function handleLhNotices(res, query) {
  // 목록 조회가 최대 10페이지 fan-out이라 force 하한은 넉넉히 (연타 방어).
  // 부분 실패(한쪽 소스 누락) 응답은 2분만 캐시 — 소스가 복구됐는데 10분씩 빠져 보이지 않게.
  const force = isForce(query);
  const ttl = lhCache.payload && lhCache.payload.sources.length < 2 ? 2 * 60 * 1000 : (force ? 3 * 60 * 1000 : 10 * 60 * 1000);
  if (lhCache.payload && Date.now() - lhCache.at < ttl) {
    noStore(res); // 이 엔드포인트는 오리진 캐시만 쓴다 — CDN이 끼면 새로고침이 흡수된다
    return res.json(lhCache.payload);
  }
  const [lh, sh] = await Promise.allSettled([fetchLhList(), fetchShNotices()]);
  const ok = (r) => r.status === "fulfilled" && r.value.length > 0; // 0건 응답도 실패로 취급 (빈 목록 박제 방지)
  const why = (r) => String(r.status === "rejected" ? (r.reason && r.reason.message) || r.reason : "empty").slice(0, 200);
  const items = [], sources = [];
  if (ok(lh)) { items.push(...lh.value.map((i) => ({ ...i, agency: "LH" }))); sources.push("LH"); }
  else console.error("lh_failed:", why(lh));
  if (ok(sh)) { items.push(...sh.value); sources.push("SH"); }
  else console.error("sh_notices_failed:", why(sh));
  noStore(res);
  const lhUnauthorized = lh.status === "rejected" && lh.reason && lh.reason.code === 503;
  if (!items.length) {
    return res.status(lhUnauthorized ? 503 : 502).json({ error: lhUnauthorized ? "unauthorized" : "fetch_failed", message: lhUnauthorized ? "LH 공고 API 활용신청이 필요합니다." : "LH·SH 공고 조회에 모두 실패했어요." });
  }
  items.sort((a, b) => normLooseYmd(b.postedAt).localeCompare(normLooseYmd(a.postedAt))); // LH·SH를 게시일 최신순으로 섞는다
  const warning = !ok(lh) ? "LH 공고를 불러오지 못해 SH 공고만 표시 중이에요."
    : !ok(sh) ? "SH 공고를 불러오지 못해 LH 공고만 표시 중이에요." : undefined;
  // lhError: 키 미신청(503)이면 프론트가 활용신청 안내를 띄울 수 있게 사유를 함께 준다
  const payload = { source: "live", sources, items, warning, lhError: lhUnauthorized ? "unauthorized" : undefined, fetchedAt: new Date().toISOString() };
  lhCache = { at: Date.now(), payload };
  res.json(payload);
}

// ---------- 장기전세 공고 (SH 게시판 파싱 + LH 전세형) ----------
// SH 장기전세는 공공데이터포털에 실시간 공고 API가 없다(정적 파일 데이터셋만 존재).
// 그래서 SH 청약시스템 공고 게시판을 직접 파싱한다 — splyTy=03이 장기전세주택, isRecrnoti=Y가 모집공고.
// ⚠️ 이전에는 이 탭이 LLM(Gemini) 리서치였는데, 접수 끝난 공고와 존재하지 않는 단지("S-x 블록")를
//    만들어내고 링크도 목록 페이지로만 가서 신뢰할 수 없었다. 실제 공고만 보여주도록 교체했다.
const SH_BRD = "https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247";
let longleaseCache = { at: 0, payload: null };
// LH closeAt은 "2026.08.05" / "2026.7.5" 등 형식이 섞여 온다 — 비교 전에 정규화
const normLooseYmd = (v) => { const m = String(v || "").match(/(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : ""; };
const shTxt = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function fetchShLonglease() {
  const r = await fetch(`${SH_BRD}/list.do?splyTy=03&isRecrnoti=Y&page=1`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) { const e = new Error("sh_upstream_" + r.status); e.code = 502; throw e; }
  const html = await readCapped(r, 512 * 1024);
  const out = [];
  for (const row of html.split(/<tr[^>]*>/).slice(1)) {
    const seq = row.match(/getDetailView\('(\d+)'\)/);
    if (!seq) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => shTxt(m[1]));
    const name = cells[1] || "";
    if (!name) continue;
    // 당첨자/서류심사 발표는 신청 대상이 아니라 결과 안내라 제외
    if (/발표|서류심사|당첨자|취소|정정/.test(name)) continue;
    out.push({
      id: `sh-${seq[1]}`,
      name,
      agency: "SH 서울주택도시공사",
      region: "서울",
      postedAt: cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) || "",
      url: `${SH_BRD}/view.do?seq=${seq[1]}`,
      kind: /미리내집|장기전세주택2|장기전세주택Ⅱ/.test(name) ? "장기전세Ⅱ(미리내집)" : "장기전세(시프트)",
    });
  }
  // 15개월 넘은 공고는 제외 — SH 모집공고는 부정기적이라 남겨두면 몇 년 전 공고가 목록을 채운다
  const cut = kstYmd(Date.now() - 460 * 86400e3);
  return out.filter((x) => !x.postedAt || x.postedAt >= cut);
}

// 공고문 본문에서 공급호수를 뽑는다 (일정은 형식이 제각각이라 표기하지 않고 공고문 확인으로 안내)
async function enrichShNotice(it) {
  try {
    const r = await fetch(it.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return it;
    const body = shTxt(await readCapped(r, 512 * 1024));
    const supply = body.match(/공급\s*호수[^\d]{0,12}([\d,]+)\s*세대/);
    return { ...it, supply: supply ? `총 ${supply[1]}세대` : null };
  } catch { return it; }
}

// 베리굿웨딩 사진 중계 — 사진 서버(vgwed.kr)에 https가 없어 https 앱·CSP(img-src https:)에서 안 보인다.
// 공개 경로라 남용을 막으려고: 고정 호스트·고정 폴더만, 경로 모양 검사(YYYYMM/파일명.확장자), 이미지·5MB 이하만, CDN 7일 캐시
const VG_IMG_BASE = "http://vgwed.kr/admin/contentsImg/client/";
async function handleVgImg(req, res) {
  const p = String((req.query && req.query.p) || "");
  if (!/^\d{6}\/[^/?#\\]{1,120}\.(jpe?g|png|gif|webp)$/i.test(p) || p.includes("..")) return res.status(400).end();
  try {
    const [dir, file] = p.split("/");
    const r = await fetch(VG_IMG_BASE + dir + "/" + encodeURIComponent(file), { redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "image/*" } });
    const type = r.headers.get("content-type") || "";
    if (r.status !== 200 || !/^image\//i.test(type)) { res.set("Cache-Control", "public, max-age=600"); return res.status(404).end(); }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return res.status(413).end();
    res.set("Content-Type", type).set("Cache-Control", "public, max-age=604800, s-maxage=604800, immutable");
    return res.send(buf);
  } catch { res.set("Cache-Control", "no-store"); return res.status(502).end(); }
}

async function handleLonglease(res, query) {
  // SH 게시판 + 본문 6건 + LH 목록까지 미스 1건이 업스트림 十여 건이라 force 하한을 5분으로 둔다
  const force = isForce(query);
  if (longleaseCache.payload && Date.now() - longleaseCache.at < (force ? 5 * 60 * 1000 : 30 * 60 * 1000)) {
    setCache(res, 1800, force);
    return res.json(longleaseCache.payload);
  }
  const today = kstYmd();
  const items = [];
  const sources = [];
  // ① SH 장기전세 모집공고
  try {
    const sh = await fetchShLonglease();
    const top = await mapLimit(sh.slice(0, 6), 3, enrichShNotice); // 최신 6건만 본문 조회 (지연 제한)
    items.push(...top.map((x) => ({ ...x, closeAt: null, status: "공고문 확인" })), ...sh.slice(6).map((x) => ({ ...x, supply: null, closeAt: null, status: "공고문 확인" })));
    sources.push("SH");
  } catch (e) { console.error("longlease_sh_failed:", String(e.message || e).slice(0, 150)); }
  // ② LH 전세형(든든전세·전세형 매입임대 등) — 이쪽은 마감일·상태가 공식 API로 온다
  try {
    const lh = (await fetchLhList()).filter((i) => /전세/.test(`${i.name} ${i.type}`) && /서울|경기|인천/.test(i.region));
    items.push(...lh.map((i) => ({
      id: `lh-${i.id}`, name: i.name, agency: "LH 한국토지주택공사", region: i.region,
      postedAt: i.postedAt, closeAt: i.closeAt, status: i.status, supply: null, url: i.url, kind: "LH 전세형",
    })));
    sources.push("LH");
  } catch (e) { console.error("longlease_lh_failed:", String(e.message || e).slice(0, 150)); }

  if (!items.length) { noStore(res); return res.status(502).json({ error: "fetch_failed", message: "공고 조회에 실패했어요. 공식 사이트에서 확인해 주세요." }); }
  // 접수 중인 공고를 맨 위로 — 지난 공고만 먼저 보이면 "다 지난 것들" 인상을 준다
  const openRank = (x) => (x.closeAt && normLooseYmd(x.closeAt) >= kstYmd() ? 0 : 1);
  items.sort((a, b) => openRank(a) - openRank(b) || String(b.postedAt || "").localeCompare(String(a.postedAt || "")));
  const payload = { source: "live", sources, today, items, fetchedAt: new Date().toISOString() };
  longleaseCache = { at: Date.now(), payload };
  setCache(res, 1800, force);
  res.json(payload);
}

// ---------- 웹 푸시 알림 (FCM) — 신규 청약·LH 공고를 매일 아침 폰으로 ----------
// FCM 토큰 형식 — Firestore 문서 ID로 쓰므로 "/"·"__x__" 같은 불허 문자를 미리 걸러낸다.
// 상한은 실제 토큰 길이(~160~180자) 기준 1000자 — Firestore 문서 ID 1500바이트 한도보다 낮게 잡아
// set()이 throw해서 500이 나가는 경로를 없앤다.
const FCM_TOKEN_RE = /^[A-Za-z0-9_:.\-]{100,1000}$/;
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
  // merge 필수 — 덮어쓰면 push-test의 lastTest가 지워져 재등록만으로 쿨다운을 무한 우회할 수 있다
  await db.collection("pushTokens").doc(token).set({ at: Date.now(), ua: String(ua || "").slice(0, 200) }, { merge: true });
  res.json({ ok: true });
}

async function handlePushTest(req, res) {
  // 토큰은 POST 본문으로만 받는다 — 쿼리스트링은 Hosting·Cloud Logging 접근 로그에 평문으로 남는다
  const token = String((req.body && req.body.token) || "");
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
  const cortarNo = String(query.cortarNo || "");
  // 숫자 코드만 허용 (URL 파라미터 주입 방지). 없으면 폴백하지 않는다 — 예전엔 과천 기본값을 "live"로 내려 다른 지역 요청에 과천 매물이 섞였다
  if (!/^\d{4,12}$/.test(cortarNo)) { noStore(res); return res.status(502).json({ error: "fetch_failed" }); }
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
    console.error("naver_land_failed:", String(e.message || e).slice(0, 200));
    res.status(502).json({ error: "fetch_failed" }); // 업스트림 상세는 로그로만
  }
}

// ---------- 뉴스 (구글뉴스 RSS — 키 불필요) ----------
function stripTags(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").trim(); }

// 검색어별 인스턴스 캐시 — 프론트가 캐시버스터(_=timestamp)를 붙여 CDN 캐시를 우회하므로
// 서버에도 캐시가 없으면 같은 검색어가 매번 업스트림으로 나간다. 엔트리 수는 상한을 둔다.
const newsCache = new Map();
const NEWS_CACHE_MAX = 40, NEWS_TTL_MS = 10 * 60 * 1000;

async function handleNews(res, query) {
  const q = String(query.q || "부동산").slice(0, 60);
  const cached = newsCache.get(q);
  if (cached && Date.now() - cached.at < NEWS_TTL_MS) {
    setCache(res, 600); // 인증 경로 — private
    return res.json(cached.payload);
  }
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
    const payload = { source: "live", q, items };
    if (newsCache.size >= NEWS_CACHE_MAX) newsCache.delete(newsCache.keys().next().value); // 가장 오래된 항목 제거
    newsCache.set(q, { at: Date.now(), payload });
    setCache(res, 600); // 인증 경로 — private
    res.json(payload);
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

// ---------- 은행 예금·적금 금리 (/api/saving-rates) — 같은 금감원 공시 API ----------
// 정기예금 depositProductsSearch, 적금 savingProductsSearch. rate = intr_rate(기본), rateMax = intr_rate2(최고 우대).
// 상품마다 기간이 같은 옵션이 여럿(단리/복리, 정액/자유적립)이면 기본금리가 높은 것 하나. top은 은행별 대표 1개씩 5곳.
const SAVING_LINK = "https://finlife.fss.or.kr/finlife/svings/fdrmDpst/list.do?menuNo=700002";
async function fetchFssList(key, op) {
  const base = [], opts = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`${FSS_BASE}/${op}?auth=${encodeURIComponent(key)}&topFinGrpNo=020000&pageNo=${page}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("fss_upstream_" + r.status);
    const j = (await r.json()).result;
    if (!j || (j.err_cd && j.err_cd !== "000")) throw new Error(`fss_err_${j && j.err_cd}: ${(j && j.err_msg) || ""}`);
    base.push(...(j.baseList || []));
    opts.push(...(j.optionList || []));
    if (page >= Number(j.max_page_no || 1)) break;
  }
  return { base, opts };
}
function summarizeTerm({ base, opts }, term) {
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const names = new Map(base.map((b) => [`${b.fin_co_no}|${b.fin_prdt_cd}`, b]));
  const best = new Map(); // 상품 → 기본금리 최고 옵션
  for (const o of opts) {
    if (String(o.save_trm) !== String(term)) continue;
    const rate = Number(o.intr_rate), k = `${o.fin_co_no}|${o.fin_prdt_cd}`;
    if (!(rate > 0) || !names.has(k)) continue;
    const cur = best.get(k);
    if (!cur || rate > cur.rate) best.set(k, { bank: clean(names.get(k).kor_co_nm), product: clean(names.get(k).fin_prdt_nm), rate, rateMax: Number(o.intr_rate2) > 0 ? Number(o.intr_rate2) : rate });
  }
  const all = [...best.values()];
  if (!all.length) return null;
  const byBank = new Map();
  for (const p of all.sort((a, b) => b.rate - a.rate || b.rateMax - a.rateMax)) if (!byBank.has(p.bank)) byBank.set(p.bank, p);
  return { avg: +(all.reduce((s, p) => s + p.rate, 0) / all.length).toFixed(2), max: all[0].rate, count: all.length, top: [...byBank.values()].slice(0, 5) };
}
async function fetchSavingRates(key) {
  const [dep, sav] = await Promise.all([fetchFssList(key, "depositProductsSearch.json"), fetchFssList(key, "savingProductsSearch.json")]);
  const out = { deposit: { term12: summarizeTerm(dep, 12) }, saving: { term12: summarizeTerm(sav, 12), term24: summarizeTerm(sav, 24) },
    at: new Date().toISOString(), source: "금융감독원 금융상품 한눈에", link: SAVING_LINK };
  if (!out.deposit.term12 && !out.saving.term12) throw new Error("fss_saving_empty");
  return out;
}
// ---------- 환율 (/api/fx) — 한국수출입은행 현재환율 API, 매매기준율 ----------
// 영업일 11시 전·주말은 빈 배열을 준다 → 하루씩 앞으로 최대 7일
async function fetchFx(key) {
  for (let back = 0; back < 7; back++) {
    const d = new Date(Date.now() + 9 * 3600e3 - back * 86400e3).toISOString().slice(0, 10).replace(/-/g, "");
    const r = await fetch(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${encodeURIComponent(key)}&searchdate=${d}&data=AP01`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => null);
    if (!Array.isArray(j) || !j.length) continue;
    if (j[0].result !== 1) throw new Error("fx_result_" + j[0].result);
    const rates = {};
    for (const x of j) {
      const m = /^([A-Z]{3})(\(100\))?$/.exec(String(x.cur_unit || "").trim());
      const v = Number(String(x.deal_bas_r || "").replace(/,/g, ""));
      if (m && v > 0 && m[1] !== "KRW") rates[m[1]] = { krw: m[2] ? v / 100 : v, name: String(x.cur_nm || "").slice(0, 20) }; // 엔·루피아는 100단위 → 1단위로
    }
    return { rates, date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, at: new Date().toISOString(), source: "한국수출입은행 매매기준율" };
  }
  throw new Error("fx_empty");
}
async function handleFx(res) {
  noStore(res);
  const cached = await readResearchCache("fx");
  if (cached && cached.payload && Date.now() - cached.at < 6 * 3600e3) return res.json(cached.payload);
  if (!env("KOREAEXIM_KEY")) return res.status(503).json({ error: "no_key", message: "KOREAEXIM_KEY가 설정되지 않아 환율을 불러올 수 없어요." });
  try {
    const payload = await fetchFx(env("KOREAEXIM_KEY"));
    await writeResearchCache("fx", payload);
    res.json(payload);
  } catch (e) {
    console.error("fx_failed:", String(e.message || e).slice(0, 200));
    if (cached && cached.payload) return res.json(cached.payload);
    res.status(502).json({ error: "fetch_failed", message: "한국수출입은행 환율 조회에 실패했어요 — 잠시 후 다시 시도해 주세요." });
  }
}
async function handleSavingRates(res) {
  noStore(res); // 하루 캐시는 Firestore가 맡는다
  const cached = await readResearchCache("saving-rates");
  if (cached && cached.payload && Date.now() - cached.at < 24 * 3600e3) return res.json(cached.payload);
  if (!env("FSS_KEY")) return res.status(503).json({ error: "no_key", message: "FSS_KEY가 설정되지 않아 은행 금리를 불러올 수 없어요." });
  try {
    const payload = await fetchSavingRates(env("FSS_KEY"));
    await writeResearchCache("saving-rates", payload);
    res.json(payload);
  } catch (e) {
    console.error("saving_rates_failed:", String(e.message || e).slice(0, 200));
    if (cached && cached.payload) return res.json(cached.payload); // 오래된 캐시라도 준다
    res.status(502).json({ error: "fetch_failed", message: "금감원 금리 조회에 실패했어요 — 잠시 후 다시 시도해 주세요." });
  }
}

// ---------- 실시간 리서치 (Gemini + 구글 검색 grounding) ----------
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
  // 장기전세주택 공고는 LLM 리서치에서 /api/longlease(SH 게시판 + LH 공식 API)로 교체됐다.
  // LLM은 접수 끝난 공고와 존재하지 않는 단지를 만들어냈고 링크도 목록 페이지로만 갔다.
  // 스드메 — 사용자가 버튼을 눌렀을 때만 조사 (daily 스케줄 제외)
  studios: { daily: false, verify: "웨딩 스튜디오", prompt: vendorPrompt("웨딩 촬영 스튜디오·스냅팀", "인스타그램에서 화제인 감성 스냅·화보 스타일 위주로. 인물/감성/필름/야외 등 스타일과 인스타 계정을 note에 표기."), schema: vendorSchema },
  dresses: { daily: false, verify: "웨딩드레스", prompt: vendorPrompt("웨딩드레스샵", "실루엣·분위기(클래식/모던 등)를 note에 표기."), schema: vendorSchema },
  snaps: { daily: false, verify: "웨딩 스냅", prompt: vendorPrompt("웨딩 스냅 작가·스냅 스튜디오(본식·야외·필름 스냅)", "인스타그램에서 활동하는 작가 위주로. 스타일(필름/자연광/다큐 등)과 인스타 계정을 note에 표기."), schema: vendorSchema },
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

// 응답 parts 원형을 돌려준다 — 텍스트만 필요한 리서치는 callGemini, functionCall까지 봐야 하는 상담은 이걸 쓴다
// deadlineAt(ms epoch)이 있으면 남은 시간 안에서만 시도한다 — 스케줄 리서치의 토픽별 예산(researchDaily 참고)
async function callGeminiParts(body, { retry429 = true, timeoutMs = 120000, deadlineAt = 0 } = {}) {
  const models = GEMINI_MODELS();
  const remaining = () => (deadlineAt ? deadlineAt - Date.now() : Infinity);
  // 일시적 404로 인스턴스 수명 내내 하위 모델에 고착되지 않도록 30분마다 선호 모델을 재시도
  if (geminiModelIdx > 0 && Date.now() - geminiDowngradedAt > 30 * 60 * 1000) geminiModelIdx = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (remaining() < 3000) throw new Error("gemini_deadline");
    const model = models[Math.min(geminiModelIdx, models.length - 1)];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(1000, Math.min(timeoutMs, remaining()))), // 리서치는 길지만 무한 대기는 막는다
    });
    if (r.status === 404 && geminiModelIdx < models.length - 1) { geminiModelIdx++; geminiDowngradedAt = Date.now(); continue; } // 모델 종료 → 다음 후보
    if (r.status === 429 && retry429 && attempt < 3 && remaining() > 25000) { await new Promise((s) => setTimeout(s, 20000)); continue; } // 분당 제한 → 잠시 후 재시도 (예산 안에서만)
    if (!r.ok) {
      // 업스트림 오류 본문은 로그로만 — 그대로 던지면 advisor/research 응답에 실려 클라이언트로 나간다 (#12)
      console.error(`gemini_${r.status} ${model}:`, (await r.text().catch(() => "")).slice(0, 300));
      throw new Error(`gemini_${r.status}`);
    }
    const j = await r.json();
    return (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  }
  throw new Error("gemini_retry_limit");
}
async function callGemini(body, opts) {
  return (await callGeminiParts(body, opts)).map((p) => p.text || "").join("");
}

// ---------- AI 상담사 (/api/advisor — 로그인 필요) ----------
// 프론트가 대시보드 상태 요약 + 대화 기록을 보내면 Claude(opt-in 시 Gemini 폴백)가 상담 답변과 액션 제안(tool_use)을 돌려준다.
// 액션은 서버가 실행하지 않고 프론트가 [적용]으로 확정한다 (functions/advisor.js 상단 주석 참고).
const advisor = require("./advisor");
// Anthropic SDK는 상담 요청에서만 필요하다 — 콜드스타트 비용을 아끼려고 지연 로드
let AnthropicSDK = null;
const anthropicSdk = () => AnthropicSDK || (AnthropicSDK = require("@anthropic-ai/sdk"));

// ---- 상담사 조회 도구 — 기존 프록시 핸들러(res 기반)를 값으로 받아 재사용 ----
// 핸들러를 고치지 않고 가짜 res로 감싼다: 캐시·쿼터 보호·폴백 로직을 그대로 탄다.
function captureHandler(handler, query, timeoutMs = 20000) {
  return Promise.race([
    new Promise((resolve) => {
      const res = {
        statusCode: 200, headersSent: false,
        set() { return this; }, get() { return ""; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
        send(b) { this.headersSent = true; resolve({ status: this.statusCode, body: b }); return this; },
        end() { resolve({ status: this.statusCode, body: null }); return this; },
      };
      Promise.resolve().then(() => handler(res, query)).catch((e) => { console.error("tool_handler_failed:", String((e && e.message) || e).slice(0, 200)); resolve({ status: 500, body: { error: "handler_failed" } }); });
    }),
    new Promise((resolve) => setTimeout(() => resolve({ status: 504, body: { error: "timeout", message: "조회가 오래 걸려요 — 잠시 후 다시 물어보면 캐시로 빨리 답해요." } }), timeoutMs)),
  ]);
}
const normK = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
const SIDO_SHORT = { 서울특별시: "서울", 경기도: "경기", 인천광역시: "인천" };
// "과천시"·"안양 동안구"·"서울 강남구" 같은 자연어 지역명 → 토큰(시/구/군 접미사 제거)이 모두 들어 있는 LAWD 코드 전부.
// 부분 문자열 매칭은 하지 않는다("남구" → 강남구 오매칭). "고양시"·"수원"·"서울"처럼 여러 구에 걸치면 후보가 여러 개다.
function lawdMatches(region) {
  const raw = String(region || "").trim();
  if (!raw) return [];
  if (Object.prototype.hasOwnProperty.call(LAWD_NAMES, raw)) return [raw];
  const tok = (s) => s.split(/\s+/).map((t) => SIDO_SHORT[t] || t.replace(/(시|구|군)$/, "")).filter(Boolean);
  const want = tok(raw);
  return Object.entries(LAWD_NAMES).filter(([, name]) => { const have = tok(name); return want.every((w) => have.includes(w)); }).map(([code]) => code);
}
// 딱 하나로 정해질 때만 코드, 모호하거나 없으면 null
const resolveLawd = (region) => { const m = lawdMatches(region); return m.length === 1 ? m[0] : null; };
// maxMs: 호출부의 남은 예산 — 각 조회의 고정 타임아웃보다 짧으면 그걸 쓴다
async function runServerTool(name, input, maxMs = Infinity) {
  const a = input && typeof input === "object" ? input : {};
  const lim = (d) => Math.min(15, Math.max(1, Number(a.limit) || d));
  const nk = normK(a.keyword || a.q);
  const tm = (ms) => Math.max(1000, Math.min(ms, maxMs));
  if (name === "search_realty") {
    const m = lawdMatches(a.region);
    if (m.length > 1) return { error: "ambiguous_region", message: `'${a.region}'에 해당하는 시/군/구가 여러 개예요. 아래 후보 중 하나(구 이름까지)로 다시 조회하세요.`, candidates: m.map((c) => LAWD_NAMES[c]).slice(0, 30) };
    const lawd = m[0];
    if (!lawd) return { error: "unknown_region", message: `'${a.region}'은 지원 지역이 아니에요. 서울·경기·인천의 시/군/구 이름으로 다시 조회하세요.` };
    const r = await captureHandler(handleRealty, { lawd }, tm(28000));
    if (r.status >= 400) return { error: "fetch_failed", message: (r.body && r.body.message) || "실거래가 조회 실패" };
    const nq = normK(a.q);
    const items = ((r.body && r.body.items) || []).filter((i) =>
      (!a.dealType || i.dealType === a.dealType) && (!a.bldg || (i.bldg || "apt") === a.bldg)
      && (!a.minPrice || i.price >= Number(a.minPrice)) && (!a.maxPrice || i.price <= Number(a.maxPrice))
      && (!a.minArea || (i.exclusive || i.area || 0) >= Number(a.minArea)) && (!a.maxArea || (i.exclusive || i.area || 0) <= Number(a.maxArea))
      && (!nq || normK(i.complex).includes(nq) || normK(i.region).includes(nq) || normK(i.addr).includes(nq)));
    const listings = items.slice(0, lim(10)).map((i) => ({
      complex: i.complex, region: `${LAWD_NAMES[lawd]} ${i.region || ""}`.trim(), addr: i.addr, dealType: i.dealType,
      area: Math.round((i.exclusive || i.area || 0) * 10) / 10, price: i.price, rent: i.rent || 0, built: i.built, floor: i.floor,
      date: i._d || ((i.tags || [])[0] || "").replace(" 실거래", ""), bldg: i.bldg || "apt", units: i.units || null,
    }));
    return { region: LAWD_NAMES[lawd], source: (r.body && r.body.source) || "unknown", matched: items.length, note: "국토부 실거래가 최근 3개월 체결가 — 현재 매물이 아님. 금액은 원.", listings };
  }
  if (name === "search_cheongyak") {
    const r = await captureHandler(handleCheongyak, {}, tm(30000));
    if (r.status >= 400) return { error: "fetch_failed", message: (r.body && r.body.message) || "청약 공고 조회 실패" };
    const nr = normK(a.region);
    const items = ((r.body && r.body.items) || []).filter((i) => (!nr || normK(i.region).includes(nr) || normK(i.addr).includes(nr) || normK(i.name).includes(nr)) && (!nk || normK(i.name).includes(nk)));
    return { matched: items.length, note: "청약홈 최근 6개월 공고. 금액은 원.", items: items.slice(0, lim(10)).map((i) => ({
      name: i.name, kind: i.kind, region: i.region, addr: i.addr, types: i.types, areas: i.areas, priceMin: i.priceMin, priceMax: i.priceMax,
      totalUnits: i.totalUnits, applyStart: i.applyStart, applyEnd: i.applyEnd, announceDate: i.announceDate, moveIn: i.moveIn })) };
  }
  if (name === "search_public_notices") {
    const r = await captureHandler(handleLhNotices, {}, tm(25000));
    if (r.status >= 400) return { error: "fetch_failed", message: (r.body && r.body.message) || "LH·SH 공고 조회 실패" };
    const nr = normK(a.region);
    const items = ((r.body && r.body.items) || []).filter((i) => (!nr || normK(i.region).includes(nr) || normK(i.name).includes(nr)) && (!nk || normK(i.name).includes(nk) || normK(i.type).includes(nk)));
    return { matched: items.length, sources: r.body && r.body.sources, items: items.slice(0, lim(10)).map((i) => ({ name: i.name, type: i.type, region: i.region, agency: i.agency, closeAt: i.closeAt, openAt: i.openAt, link: i.url })) };
  }
  if (name === "search_news") {
    const r = await captureHandler(handleNews, { q: String(a.q || "부동산").slice(0, 60) }, tm(15000));
    if (r.status >= 400) return { error: "fetch_failed", message: "뉴스 조회 실패" };
    return { items: ((r.body && r.body.items) || []).slice(0, 8).map((i) => ({ title: i.title, source: i.source, date: i.date || i.pubDate, link: i.link })) };
  }
  return { error: "unknown_tool" };
}

// 상담사 1일 호출 상한(계정별, KST) — 토큰 유출·브라우저 탈취 시 Anthropic 비용 폭주를 막는 바닥. ADVISOR_DAILY_LIMIT 로 조정
// 기본 50회/일 — 1회 요청이 Claude 최대 4번 + 웹 검색 최대 3번이라 150회면 최악 하루 수백 달러가 가능했다
// kind별 한도 env — 예전엔 advisor 외 전부가 RESEARCH_DAILY_LIMIT 하나를 같이 썼다
const QUOTA_ENV = { advisor: "ADVISOR_DAILY_LIMIT", research: "RESEARCH_DAILY_LIMIT", policy: "POLICY_DAILY_LIMIT", lookup: "LOOKUP_DAILY_LIMIT", subAnalyze: "SUB_ANALYZE_DAILY_LIMIT" };
const usageRef = (email, kind, day) => db.collection("usage").doc(kind === "advisor" ? `${email}_${day}` : `${kind}_${email}_${day}`);
// 계정 무관 전역 상한(LLM 호출 경로만, lookup 제외) — 허용 계정 여러 개가 동시에 털려도 하루 총량을 묶는다. GLOBAL_DAILY_LIMIT 로 조정
const globalRef = (kind, day) => (kind === "lookup" ? null : db.collection("usage").doc(`global_${day}`));
// n: 한 번에 차감할 건수(정책 점검 = 섹션 수) — 전부 들어갈 때만 차감한다
async function takeAdvisorQuota(email, kind = "advisor", limitDefault = 50, n = 1) {
  const limit = Number(env(QUOTA_ENV[kind] || "")) || limitDefault;
  const glimit = Number(env("GLOBAL_DAILY_LIMIT")) || 300;
  const day = kstYmd();
  const ref = usageRef(email, kind, day), gref = globalRef(kind, day);
  return db.runTransaction(async (t) => {
    const [snap, gsnap] = gref ? await t.getAll(ref, gref) : [await t.get(ref), null];
    const cnt = (s) => (s && s.exists ? Number(s.data().n) || 0 : 0);
    const v = cnt(snap) + n, g = cnt(gsnap) + n;
    if (v > limit || (gref && g > glimit)) return false;
    const at = admin.firestore.FieldValue.serverTimestamp();
    t.set(ref, { n: v, day, at }, { merge: true });
    if (gref) t.set(gref, { n: g, day, at }, { merge: true });
    return true;
  });
}
// 호출이 실패하면 차감을 되돌린다 (계정·전역 둘 다). 실패해도 무시 — 한도가 조금 덜 남을 뿐이다
async function refundQuota(email, kind = "advisor", n = 1) {
  if (!email) return;
  const day = kstYmd(), inc = { n: admin.firestore.FieldValue.increment(-n) }, gref = globalRef(kind, day);
  await Promise.all([usageRef(email, kind, day).set(inc, { merge: true }), gref && gref.set(inc, { merge: true })]).catch(() => {});
}
// 대화 이력 총 글자 수 상한 — 최신 메시지부터 채우고 넘치면 앞쪽(오래된 것)을 버린다
function capMessages(msgs, maxChars) {
  const out = []; let n = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const len = String((msgs[i] && msgs[i].text) || "").length;
    if (out.length && n + len > maxChars) break;
    out.unshift(msgs[i]); n += len;
  }
  return out;
}
// ---------- 정책 점검 (policy-review.js) ----------
const policyReview = require("./policy-review.js");
const proposalsRef = () => db.doc("policy/proposals");
const policyJobsRef = () => db.collection("policyJobs");
async function readOverridesRaw() {
  const snap = await db.collection("households").doc("main").get().catch(() => null);
  return snap && snap.exists ? (snap.data() || {})["policy-overrides-v1"] : null;
}
async function runPolicyReview(key, deadlineMs) {
  const Anthropic = anthropicSdk();
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), maxRetries: 0 });
  const result = await policyReview.reviewSection({ client, model: env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT, key, overridesRaw: await readOverridesRaw(), today: kstYmd(), deadlineMs });
  const ref = proposalsRef();
  await db.runTransaction(async (t) => { const snap = await t.get(ref); t.set(ref, policyReview.mergeProposals(snap.exists ? snap.data() : null, result)); });
  console.log(`policy_review ${key}: 후보 ${result.items.length}건, 확인 ${result.confirmed.length}건`);
  return result;
}
async function handlePolicy(req, res, email, p) {
  noStore(res);
  if (p === "/api/policy-proposals") {
    const snap = await proposalsRef().get().catch(() => null);
    return res.json(snap && snap.exists ? snap.data() : { items: [], checked: {} });
  }
  if (p === "/api/policy-job") { // 작업 진행 상황 — 앱이 몇 초마다 확인한다
    const id = String((req.query && req.query.id) || "");
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: "bad_id" });
    const snap = await policyJobsRef().doc(id).get().catch(() => null);
    return snap && snap.exists ? res.json(snap.data()) : res.status(404).json({ error: "not_found" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!env("ANTHROPIC_API_KEY")) return res.status(503).json({ error: "no_key", message: "ANTHROPIC_API_KEY가 설정되지 않아 점검할 수 없어요." });
  const b = req.body || {};
  const keys = [...new Set((Array.isArray(b.sections) ? b.sections : [b.section]).map(String))].filter((k) => policyReview.SECTION_KEYS.includes(k));
  if (!keys.length) return res.status(400).json({ error: "unknown_section" });
  // 섹션 1개 = 1건 — 필요한 수를 트랜잭션 한 번에 확인·차감 (예전엔 1건씩 차감하다 중간에 막히면 앞 차감분만 날아갔다)
  if (!(await takeAdvisorQuota(email, "policy", 40, keys.length))) return res.status(429).json({ error: "daily_limit", message: "오늘 정책 점검 한도를 다 썼어요 — 내일 다시 시도해 주세요." });
  // 웹 검색 대조는 섹션당 1~3분 걸려 Hosting 60초 안에 못 끝난다 — 작업 문서만 만들고 바로 응답,
  // 실제 점검은 policyReviewJob(Firestore 트리거, 최대 9분)이 돌린다. 앱은 /api/policy-job 으로 진행을 본다.
  const ref = await policyJobsRef().add({ sections: keys, state: Object.fromEntries(keys.map((k) => [k, "queued"])), errors: {}, by: email, createdAt: new Date().toISOString() });
  res.status(202).json({ jobId: ref.id, sections: keys });
}

// ---------- 청약 공고 분석 (sub-analyze.js) ----------
// POST /api/sub-analyze { houseManageNo, pblancNo, detailPath?, pdf?: "data:application/pdf;base64,…", context } → 202 { jobId }
// GET  /api/sub-job?id= → { state: queued|running|done|failed, result?, error? }
// PDF 분석은 1~3분이라 Hosting 60초를 넘긴다 — 정책 점검처럼 작업 문서만 만들고 subAnalyzeJob 트리거가 실행한다.
const subAnalyze = require("./sub-analyze.js");
const subJobsRef = () => db.collection("subJobs");
const PART_CHARS = 900000; // 업로드 PDF(base64)는 문서 1MB 한도 때문에 subJobs/{id}/parts/{i} 로 나눠 둔다
async function handleSub(req, res, email, p) {
  noStore(res);
  if (p === "/api/sub-job") {
    const id = String((req.query && req.query.id) || "");
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: "bad_id" });
    const snap = await subJobsRef().doc(id).get().catch(() => null);
    if (!snap || !snap.exists) return res.status(404).json({ error: "not_found" });
    const d = snap.data() || {};
    if (d.by && d.by !== email) return res.status(404).json({ error: "not_found" }); // 내가 만든 작업만
    return res.json({ state: d.state, result: d.result || null, error: d.error || "", noPdf: !!d.noPdf, source: d.source || "", finishedAt: d.finishedAt || null });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!env("ANTHROPIC_API_KEY")) return res.status(503).json({ error: "no_key", message: "ANTHROPIC_API_KEY가 설정되지 않아 분석할 수 없어요." });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const hno = String(b.houseManageNo || ""), pno = String(b.pblancNo || "");
  const context = String(typeof b.context === "string" ? b.context : JSON.stringify(b.context || {})).slice(0, 20000);
  let pdfUrl = null, parts = [];
  if (b.pdf) { // 부부가 올린 PDF (LH·SH 공고 등)
    const m = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.pdf));
    if (!m) return res.status(400).json({ error: "bad_file", message: "공고문 PDF 파일을 올려 주세요." });
    // Claude 요청 한도(32MB)와 Hosting 요청 크기 때문에 base64 24M자(원본 약 18MB)까지
    if (m[1].length > 24_000_000) return res.status(413).json({ error: "too_large", message: "PDF가 너무 커요(18MB 이하) — 자격·공급 부분만 남겨 올려 주세요." });
    for (let i = 0; i < m[1].length; i += PART_CHARS) parts.push(m[1].slice(i, i + PART_CHARS));
  } else {
    if (!/^\d{5,20}$/.test(hno) || !/^\d{5,20}$/.test(pno)) return res.status(400).json({ error: "bad_id", message: "공고 번호를 찾지 못했어요 — 공고문 PDF를 올려 주세요." });
    pdfUrl = await subAnalyze.findNoticePdf(hno, pno, String(b.detailPath || "")).catch((e) => { console.error("sub_pdf_find_failed:", String(e.message).slice(0, 120)); return null; });
    if (!pdfUrl) return res.status(422).json({ error: "no_pdf", message: "청약홈에서 공고문 PDF를 찾지 못했어요 — 공고문 PDF를 올려 주세요." });
  }
  if (!(await takeAdvisorQuota(email, "subAnalyze", 20))) return res.status(429).json({ error: "daily_limit", message: "오늘 공고 분석 한도를 다 썼어요 — 내일 다시 시도해 주세요." });
  const ref = subJobsRef().doc();
  try {
    // 트리거는 본 문서가 생길 때 돈다 — 조각을 먼저 다 쓰고 본 문서를 만든다
    await Promise.all(parts.map((data, i) => ref.collection("parts").doc(String(i)).set({ data })));
    await ref.set({ state: "queued", by: email, createdAt: new Date().toISOString(), houseManageNo: hno, pblancNo: pno, pdfUrl, parts: parts.length, context });
  } catch (e) {
    await refundQuota(email, "subAnalyze");
    console.error("sub_job_create_failed:", String(e.message).slice(0, 120));
    return res.status(502).json({ error: "job_failed", message: "분석 작업을 만들지 못했어요 — 다시 시도해 주세요." });
  }
  res.status(202).json({ jobId: ref.id, source: pdfUrl ? "applyhome" : "upload" });
}

// ---------- 관심 매물 (listing.js) ----------
// 주소에서 시/군/구를 찾아 같은 지역·비슷한 면적(±10㎡) 매매 실거래를 모은다 — 전세가율·시세 비교용
// 주소 기반 매매 시세 — 국토부 실거래(최근 3개월)에서 ① 같은 번지(같은 건물) ② 같은 동·비슷한 면적(±10㎡) ③ 같은 시군구·비슷한 면적 순으로 찾고,
// ㎡당 중앙값 × 이 매물 면적으로 추정한다. 전세가율·시세 비교에 쓴다
async function marketCompare(L) {
  const toks = String(L.addr || "").split(/\s+/).filter(Boolean);
  const di = toks.findIndex((t) => /(동|가|리)$/.test(t) && !/(시|구|군)$/.test(t));
  const dong = di >= 0 ? toks[di] : "";
  let lawd = null, amb = null;
  for (let i = 0; i < toks.length && !lawd; i++) {
    let m = toks[i + 1] && /구$/.test(toks[i + 1]) ? lawdMatches(`${toks[i]} ${toks[i + 1]}`) : [];
    if (!m.length && /(시|구|군)$/.test(toks[i])) m = lawdMatches(toks[i]);
    if (m.length === 1) lawd = m[0]; else if (m.length > 1 && !amb) amb = m;
  }
  // "고양시 식사동"·"중구 신포동"처럼 구가 여럿이면 동 이름이 있는 구로 좁힌다 (bjd-capital.json 법정동 목록)
  if (!lawd && amb && dong) {
    const inDong = amb.filter((c) => Object.entries(BJD_CODES).some(([k, v]) => v.startsWith(c) && k.split("|")[1] === dong));
    if (inDong.length === 1) lawd = inDong[0];
  }
  if (!lawd && amb) return { note: `주소의 시/군/구가 여러 곳에 해당해 시세 조회를 건너뜀 — 구 이름까지 적어 주세요 (후보: ${amb.map((c) => LAWD_NAMES[c]).slice(0, 5).join(", ")})` };
  if (!lawd) return { note: "주소로 시/군/구를 못 찾아 시세 조회를 건너뜀" };
  const jibun = di >= 0 && /^\d+(-\d+)?$/.test(toks[di + 1] || "") ? toks[di + 1] : "";
  const bldg = { 아파트: "apt", 오피스텔: "offi", 빌라: "villa" }[L.bldg];
  const area = Number(L.area) || 0;
  const r = await captureHandler(handleRealty, { lawd }, 20000);
  if (r.status >= 400) return { note: (r.body && r.body.message) || "공공데이터 서버(국토부 실거래) 연결이 잠시 끊겨 실거래를 못 불러왔어요 — 1~2분 뒤 [매매 시세 조회]를 다시 눌러 주세요." };
  const all = ((r.body && r.body.items) || []).filter((i) => i.dealType === "매매" && i.price > 0 && (!bldg || (i.bldg || "apt") === bldg));
  const ar = (i) => i.exclusive || i.area || 0;
  const near = (i) => !area || Math.abs(ar(i) - area) <= 10;
  const sameB = jibun ? all.filter((i) => i.region === dong && String(i.addr || "").endsWith(` ${jibun}`)) : [];
  const sameD = all.filter((i) => dong && i.region === dong && near(i));
  const region = all.filter(near);
  const [tier, deals, basis] = sameB.length ? ["same", sameB, `같은 번지(${dong} ${jibun}) 매매`] : sameD.length ? ["dong", sameD, `${dong} · 전용 ${area ? `${area - 10}~${area + 10}㎡` : "전체"} 매매`] : ["region", region, `${LAWD_NAMES[lawd]} · 전용 ${area ? `${area - 10}~${area + 10}㎡` : "전체"} 매매`];
  const per = deals.filter((i) => ar(i) > 0).map((i) => i.price / ar(i)).sort((x, y) => x - y);
  const med = per.length ? per[Math.floor(per.length / 2)] : null;
  return {
    region: LAWD_NAMES[lawd], tier, basis: `최근 3개월 ${basis} ${deals.length}건`,
    estimateWon: med && area ? Math.round(med * area / 1e6) * 1e6 : null, perM2Won: med ? Math.round(med) : null,
    deals: deals.slice(0, 10).map((i) => ({ complex: i.complex, addr: i.addr, area: Math.round(ar(i) * 10) / 10, price: i.price, floor: i.floor, date: i._d, built: i.built })),
  };
}
const listing = require("./listing.js");
const listingDocs = require("./listing-docs.js");
const BJD_CODES = require("./bjd-capital.json").codes; // "시군구|읍면동[|리]" → 법정동코드 10자리
// POST /api/listing-extract { text?, image?: "data:image/jpeg;base64,..." } → 매물 필드
// POST /api/listing-review  { listing, context } → 위험도·적합도 (search_realty 로 시세 조회 가능)
async function handleListing(req, res, email, p) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const limited = () => res.status(429).json({ error: "daily_limit", message: "오늘 조회·상담 한도를 다 썼어요 — 내일 다시 이용해 주세요." });
  // 시세·건축물대장은 Claude는 안 쓰지만 data.go.kr 쿼터를 태우므로 가벼운 일일 한도(lookup)
  if ((p === "/api/listing-market" || p === "/api/listing-building") && !(await takeAdvisorQuota(email, "lookup", 200))) return limited();
  if (p === "/api/listing-market") { // 주소 기반 매매 시세 (Claude 안 씀)
    try { return res.json(await marketCompare({ addr: String(b.addr || "").slice(0, 120), area: Number(b.area) || 0, bldg: String(b.bldg || "") })); }
    catch (e) { console.error("market_failed:", String(e.message).slice(0, 120)); return res.status(502).json({ error: "market_failed", message: "실거래 조회에 실패했어요 — 잠시 후 다시 시도해 주세요." }); }
  }
  if (p === "/api/listing-building") { // 건축물대장 표제부 (Claude 안 씀)
    const key = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
    if (!key) return res.status(503).json({ error: "no_key", message: "공공데이터 키가 없어요." });
    // 주소 글자에서 바로 법정동코드·번지를 뽑는다 (bjd-capital.json, 서울·경기·인천)
    const c = listingDocs.parseAddrCodes(String(b.addr || "").slice(0, 120));
    if (!c) return res.status(400).json({ error: "bad_addr", message: "주소에서 시군구·동을 못 찾았어요 — '과천시 문원동 15-109'처럼 동과 번지까지 적어 주세요(서울·경기·인천)." });
    if (!c.bun) return res.status(400).json({ error: "no_bunji", message: `${c.dong}까지만 있어요 — 번지(예: 15-109)를 넣어야 건축물대장을 찾을 수 있어요.` });
    // 한 번 받은 표제부는 30일 저장 — 공공데이터 서버가 잠깐 연결을 끊어도(2026-09-30 연결 시간 초과 확인) 저장본을 보여 준다
    const q = { sigunguCd: c.sigunguCd, bjdongCd: c.bjdongCd, platGbCd: c.san ? "1" : "0", bun: c.bun, ji: c.ji };
    const cref = db.collection("bldCache").doc([q.sigunguCd, q.bjdongCd, q.platGbCd, q.bun, q.ji].join("_"));
    const cached = await cref.get().then((s) => (s.exists ? s.data() : null)).catch(() => null);
    if (cached && cached.payload && Date.now() - cached.at < 30 * 86400000) return res.json({ ...cached.payload, cachedAt: new Date(cached.at).toISOString() });
    try {
      const payload = await listingDocs.fetchBuildingRegister(key, q);
      if (payload.items && payload.items.length) cref.set({ at: Date.now(), payload }).catch(() => {});
      return res.json(payload);
    }
    catch (e) {
      if (e.code === 400) return res.status(400).json({ error: "bad_code", message: "주소의 법정동코드·번지를 찾지 못했어요 — 편집에서 주소의 동·번지(예: 문원동 15-109)를 확인해 주세요." });
      console.error("building_failed:", String(e.message).slice(0, 120), String((e.cause && e.cause.code) || ""));
      if (cached && cached.payload) return res.json({ ...cached.payload, cachedAt: new Date(cached.at).toISOString(), stale: true }); // 오래된 저장본이라도
      if (e.transient || /timeout|fetch failed/i.test(String(e.message))) return res.status(503).json({ error: "upstream_unavailable", message: "공공데이터 서버(건축HUB) 연결이 잠시 끊겼어요 — 1~2분 뒤 [건축물대장 다시 조회]를 눌러 주세요." });
      return res.status(502).json({ error: "building_failed", message: e.denied ? "건축물대장 API 사용 신청이 필요해요 — data.go.kr에서 「국토교통부_건축HUB_건축물대장정보 서비스」를 활용신청해 주세요." : "건축물대장 조회에 실패했어요 — 잠시 후 다시 시도해 주세요." });
    }
  }
  if (!env("ANTHROPIC_API_KEY")) return res.status(503).json({ error: "no_key", message: "ANTHROPIC_API_KEY가 설정되지 않았어요." });
  // 상담 한도는 입력 검증을 통과한 뒤에 차감하고, Claude 호출이 실패하면 되돌린다
  let charged = false;
  const charge = async () => (charged = await takeAdvisorQuota(email));
  const Anthropic = anthropicSdk();
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), timeout: 52000, maxRetries: 0 });
  const model = env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT;
  try {
    if (p === "/api/listing-registry") { // 등기부등본 PDF·캡처 → 권리관계
      const m = /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.file || ""));
      if (!m) return res.status(400).json({ error: "bad_file", message: "등기부등본 PDF나 캡처 이미지를 올려 주세요." });
      if (m[2].length > 8_000_000) return res.status(413).json({ error: "too_large", message: "파일이 너무 커요(6MB 이하) — 필요한 쪽만 올려 주세요." });
      if (!(await charge())) return limited();
      const doc = m[1] === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: m[2] } } : { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
      const msg = await client.messages.create({ model, max_tokens: 3000, output_config: { effort: "low" }, messages: [{ role: "user", content: [doc, { type: "text", text: listingDocs.registryPrompt() }] }] });
      const out = (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
      const reg = listingDocs.cleanRegistry(listing.extractJson(out));
      if (!reg) { console.error("registry_parse_failed:", out.slice(0, 200)); return res.status(502).json({ error: "registry_failed", message: "등기부를 읽지 못했어요 — 선명한 PDF(인터넷등기소 열람본)로 다시 올려 주세요." }); }
      return res.json({ registry: { ...reg, at: new Date().toISOString() } });
    }
    if (p === "/api/listing-extract") {
      const content = [];
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
      if (m) { if (m[2].length > 2_800_000) return res.status(413).json({ error: "too_large", message: "이미지가 너무 커요 — 캡처를 조금 줄여 주세요." }); content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }); }
      const text = String(b.text || "").slice(0, 8000);
      if (!m && !text.trim()) return res.status(400).json({ error: "empty", message: "매물 글을 붙여넣거나 캡처를 올려 주세요." });
      if (!(await charge())) return limited();
      content.push({ type: "text", text: listing.extractPrompt(text) });
      const msg = await client.messages.create({ model, max_tokens: 1500, output_config: { effort: "low" }, messages: [{ role: "user", content }] });
      const out = (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
      return res.json({ fields: listing.cleanFields(listing.extractJson(out)) });
    }
    // 판단 — 시세 비교용 실거래는 서버가 먼저 직접 조회하고(최대 15초), Claude는 한 번만 부른다.
    // 예전엔 Claude가 도구로 조회해 [Claude → 조회(최대 28초) → Claude]가 Hosting 60초를 넘겨 빈 결과로 실패했다.
    const L = b.listing && typeof b.listing === "object" ? b.listing : {};
    if (!(await charge())) return limited();
    const started = Date.now(); // 실거래 조회 시간도 60초 예산에 넣는다
    const market = L.marketPrice > 0 ? null : await Promise.race([marketCompare(L), new Promise((r) => setTimeout(() => r({ note: "실거래 조회 시간 초과" }), 15000))]).catch(() => null);
    const ctx = typeof b.context === "string" ? b.context : JSON.stringify(b.context || {});
    const prompt = listing.reviewPrompt(L, ctx, kstYmd())
      + (market ? `\n\n<market>\n${JSON.stringify(market).slice(0, 5000)}\n</market>` : "");
    const ask = async (msgs) => {
      const left = 54000 - (Date.now() - started);
      // 2500이면 판단 JSON이 중간에 잘려 파싱 실패했다(동시에 두 개 돌리면 느려져 재시도도 못 함) — 한도를 넉넉히, 길이는 프롬프트로 줄인다
      const msg = await client.messages.create({ model, max_tokens: 5000, output_config: { effort: "low" }, messages: msgs }, { timeout: Math.max(5000, left) });
      if (msg.stop_reason === "max_tokens") console.error("listing_review_truncated");
      return (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
    };
    let text = await ask([{ role: "user", content: prompt }]);
    if (!listing.extractJson(text) && Date.now() - started < 30000) { // JSON이 깨졌으면 한 번 더 — 형식만 요구
      text = await ask([{ role: "user", content: prompt }, { role: "assistant", content: text || "(빈 응답)" }, { role: "user", content: "위 판단을 지정한 JSON 형식 하나로만 다시 출력해라. 다른 글 없이." }]);
    }
    if (!listing.extractJson(text)) console.error("listing_review_parse_failed:", String(text).slice(0, 300));
    const review = listing.cleanReview(listing.extractJson(text));
    if (!review) return res.status(502).json({ error: "review_failed", message: "판단 결과를 만들지 못했어요 — 다시 시도해 주세요." });
    res.json({ review: { ...review, at: new Date().toISOString() } });
  } catch (e) {
    if (charged) await refundQuota(email);
    console.error("listing_failed:", p, String((e && e.message) || e).slice(0, 200));
    res.status(502).json({ error: "listing_failed", message: /timed out/i.test(String(e && e.message)) ? "시간이 오래 걸려 끊겼어요 — 다시 시도해 주세요." : "매물 분석 중 오류가 났어요 — 잠시 후 다시 시도해 주세요." });
  }
}

// ---------- 스드메 업체 정보 찾기 (vendor-lookup.js) ----------
// POST /api/vendor-lookup { kind, name, area } → { images:[{thumb,link,title}], info?, at }
// 사진(네이버 이미지 검색)과 요약(Claude 웹 검색)을 동시에 — 한쪽만 되면 그만큼만 준다. Hosting 60초 안에 끝내려고 45초 예산
const vendorLookup = require("./vendor-lookup.js");
async function handleVendorLookup(req, res, email) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const kind = String(b.kind || ""), name = String(b.name || "").trim(), area = String(b.area || "").trim();
  const handle = /^[A-Za-z0-9._]{1,30}$/.test(String(b.handle || "")) ? String(b.handle) : ""; // 인스타 계정(플래너 찾기에 쓴다)
  if (!Object.prototype.hasOwnProperty.call(vendorLookup.KINDS, kind) || name.length < 1 || name.length > 40 || area.length > 20) {
    return res.status(400).json({ error: "bad_request", message: "업체 이름(40자 이내)과 지역(20자 이내)을 확인해 주세요." });
  }
  const hasNaver = !!(env("NAVER_SEARCH_CLIENT_ID") && env("NAVER_SEARCH_CLIENT_SECRET")), hasClaude = !!env("ANTHROPIC_API_KEY");
  if (!hasNaver && !hasClaude) return res.status(503).json({ error: "no_key", message: "검색 키가 설정되지 않아 찾을 수 없어요 — 관리자에게 네이버 검색·Claude 키 설정을 요청해 주세요." });
  if (!(await takeAdvisorQuota(email, "research", 30))) return res.status(429).json({ error: "daily_limit", message: "오늘 정보 찾기 한도를 다 썼어요 — 내일 다시 시도해 주세요." });
  const deadlineMs = Date.now() + 45000;
  const q = vendorLookup.KINDS[kind].q;
  const imagesP = !hasNaver ? Promise.resolve([]) : naverFetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(`${name} ${q}`)}&display=8&sort=sim&filter=large`)
    .then(async (r) => (r.ok ? vendorLookup.cleanImages(await r.json()) : (console.error("vendor_lookup_naver:", r.status), [])))
    .catch((e) => { console.error("vendor_lookup_naver:", String((e && e.message) || e).slice(0, 120)); return []; });
  const infoP = !hasClaude ? Promise.resolve(null) : (async () => {
    const Anthropic = anthropicSdk();
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), maxRetries: 0 });
    return vendorLookup.runLookup({ client, model: env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT, kind, name, area, handle, today: kstYmd(), deadlineMs });
  })().catch((e) => { console.error("vendor_lookup_claude:", String((e && e.message) || e).slice(0, 200)); return { failed: /timeout|timed out|abort/i.test(String((e && e.message) || e)) ? "timeout" : "error" }; });
  const [images, infoR] = await Promise.all([imagesP, infoP]);
  const info = infoR && !infoR.failed ? infoR : null;
  if (!images.length && !info) {
    await refundQuota(email, "research");
    return res.status(502).json({ error: "lookup_failed", message: infoR && infoR.failed === "timeout"
      ? "검색이 45초를 넘겨 멈췄어요 — 1~2분 뒤 [다시 찾기]를 눌러 주세요."
      : "사진·후기를 찾지 못했어요 — 업체 이름을 정확히 고치거나(예: 지점명 빼기) 잠시 후 다시 눌러 주세요." });
  }
  const out = { images, at: new Date().toISOString() };
  if (info) out.info = info;
  else if (hasClaude) out.note = "사진만 찾았어요 — 컨셉·후기 요약은 이번에 못 가져왔어요. 잠시 후 [다시 찾기]를 눌러 보세요.";
  res.json(out);
}

// ---------- 청첩장 시안 에이전트 (invite-design.js) ----------
// POST /api/invite-design { format: mobile|paper, size:{w,h}, html, messages:[{role,text}], refs:[data URL], photoCount, filled:[토큰] } → 202 { jobId }
// GET  /api/invite-job?id= → { state, html?, note?, error? }  — HTML 생성은 1~3분이라 Hosting 60초를 넘겨 inviteDesignJob 트리거가 실행
const inviteDesign = require("./invite-design.js");
const inviteJobsRef = () => db.collection("inviteJobs");
async function handleInvite(req, res, email, p) {
  noStore(res);
  if (p === "/api/invite-job") {
    const id = String((req.query && req.query.id) || "");
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: "bad_id" });
    const snap = await inviteJobsRef().doc(id).get().catch(() => null);
    if (!snap || !snap.exists) return res.status(404).json({ error: "not_found" });
    const d = snap.data() || {};
    return res.json({ state: d.state, html: d.state === "done" ? d.html || "" : "", note: d.note || "", error: d.error || "" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!env("ANTHROPIC_API_KEY")) return res.status(503).json({ error: "no_key", message: "ANTHROPIC_API_KEY가 설정되지 않아 시안을 만들 수 없어요." });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const format = b.format === "paper" ? "paper" : "mobile";
  const w = Math.round(Number(b.size && b.size.w) || 148), h = Math.round(Number(b.size && b.size.h) || 210);
  if (format === "paper" && !(w >= 60 && w <= 300 && h >= 60 && h <= 300)) return res.status(400).json({ error: "bad_size", message: "종이 크기는 60~300mm 사이로 적어 주세요." });
  if (String(b.html || "").length > 250000) return res.status(400).json({ error: "too_long", message: "지금 시안이 너무 길어요 — 새 시안으로 시작해 주세요." });
  const html = inviteDesign.sanitizeInviteHtml(String(b.html || ""));
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-12).map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", text: String((m && m.text) || "").slice(0, 2000) })).filter((m) => m.text);
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "empty", message: "요청을 적어 주세요." });
  const refs = (Array.isArray(b.refs) ? b.refs : []).slice(0, 4).map(String).filter((u) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 400000);
  const filled = (Array.isArray(b.filled) ? b.filled : []).map(String).filter((k) => Object.prototype.hasOwnProperty.call(inviteDesign.TOKENS, k));
  const photoCount = Math.max(0, Math.min(12, Number(b.photoCount) || 0));
  if (!(await takeAdvisorQuota(email, "invite", 80))) return res.status(429).json({ error: "daily_limit", message: "오늘 시안 만들기 한도를 다 썼어요 — 내일 다시 해 주세요." });
  const ref = inviteJobsRef().doc();
  try {
    await ref.set({ state: "queued", by: email, createdAt: new Date().toISOString(), format, size: { w, h }, html, messages, refs, filled, photoCount });
  } catch (e) {
    await refundQuota(email, "invite");
    console.error("invite_job_create_failed:", String(e.message).slice(0, 120));
    return res.status(502).json({ error: "job_failed", message: "시안 작업을 만들지 못했어요 — 첨부한 레퍼런스를 줄여 다시 해 주세요." });
  }
  res.status(202).json({ jobId: ref.id });
}

// ---------- 모바일 청첩장 공개 링크 (/i/{코드}) ----------
// 로그인 없이 열린다 — 앱이 publicInvites/{코드}(정보·사진 주소를 채운 HTML)와 publicInviteImgs/{코드}_{n}(사진)을 써 두면 여기서 보여 준다.
// 코드는 추측하기 어려운 무작위 12자 이상, 클라이언트는 이 문서를 읽을 수 없다(서버만 읽음). HTML은 한 번 더 걸러 스크립트 없이 내보낸다
const escAttr = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function handleInvitePublic(req, res, p) {
  // Hosting 의 보안 헤더는 함수 응답에 안 붙는다 — 공개 페이지는 스크립트를 아예 막는 CSP를 직접 단다
  // sandbox(allow-scripts 없음)는 meta refresh 이동까지 막는다, img-src 에 https: 가 없어 외부 이미지로 정보를 빼낼 수 없다
  res.set("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-popups allow-popups-to-escape-sandbox");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  const m = /^\/i\/([A-Za-z0-9]{12,32})(?:\/img\/([0-9]{1,2}))?$/.exec(p);
  const notFound = () => { res.set("Cache-Control", "public, max-age=60"); return res.status(404).type("html").send("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>청첩장</title><p style='font-family:sans-serif;text-align:center;margin-top:30vh;color:#666'>청첩장을 찾을 수 없어요.</p>"); };
  if (!m) return notFound();
  const slug = m[1];
  if (m[2] != null) { // 사진
    const snap = await db.collection("publicInviteImgs").doc(`${slug}_${m[2]}`).get().catch(() => null);
    const d = snap && snap.exists ? snap.data() : null;
    const mm = d && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d.data || ""));
    if (!mm) return res.status(404).end();
    res.set("Cache-Control", "public, max-age=300"); // 주소에 ?v= 가 붙어 바뀐 사진은 새 주소 — 링크를 지우면 5분 안에 사라진다
    return res.type(mm[1]).send(Buffer.from(mm[2], "base64"));
  }
  const snap = await db.collection("publicInvites").doc(slug).get().catch(() => null);
  const d = snap && snap.exists ? snap.data() : null;
  if (!d || !d.html) return notFound();
  const html = inviteDesign.sanitizeInviteHtml(d.html);
  const title = String(d.title || "결혼합니다").slice(0, 80), desc = String(d.desc || "").slice(0, 160);
  const og = d.ogImg != null ? `https://${req.get("host")}/i/${slug}/img/${Number(d.ogImg)}` : "";
  res.set("Cache-Control", "public, max-age=60");
  res.set("X-Robots-Tag", "noindex, nofollow");
  return res.type("html").send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${escAttr(title)}</title><meta property="og:type" content="website"><meta property="og:title" content="${escAttr(title)}"><meta property="og:description" content="${escAttr(desc)}">${og ? `<meta property="og:image" content="${escAttr(og)}">` : ""}
<style>html,body{margin:0;padding:0;background:#fff;-webkit-text-size-adjust:100%}img{max-width:100%}</style></head><body>${html}</body></html>`);
}

// ---------- 결혼 레퍼런스 사진 가져오기 (/api/ref-fetch) ----------
// POST { url } 또는 { code } → { data: "data:image/jpeg;base64,…" } — 인스타그램 이미지 서버(https://*.cdninstagram.com, *.fbcdn.net)의 사진만 받아 준다.
// code(게시물 코드)면 공개 게시물의 대표 사진 주소(/p/{code}/media/?size=l 의 리다이렉트)를 먼저 찾는다 — 리다이렉트 대상도 같은 호스트만
// 브라우저는 인스타 사진을 CORS 때문에 직접 못 읽는다. 호스트를 고정하고 리다이렉트를 따라가지 않아 다른 주소로 새지 않는다
const REF_HOST = /^(?:[a-z0-9-]+\.)*(?:cdninstagram\.com|fbcdn\.net)$/i;
async function handleRefFetch(req, res, email) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  let u;
  const code = String((req.body && req.body.code) || "");
  if (/^[A-Za-z0-9_-]{5,40}$/.test(code)) {
    try {
      const r0 = await fetch(`https://www.instagram.com/p/${code}/media/?size=l`, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "user-agent": "facebookexternalhit/1.1" } });
      u = new URL(String(r0.headers.get("location") || ""));
    } catch { u = null; }
    if (!u) return res.status(502).json({ error: "fetch_failed", message: "게시물 사진 주소를 못 찾았어요 — 비공개거나 지워진 게시물일 수 있어요." });
  } else {
    try { u = new URL(String((req.body && req.body.url) || "")); } catch { u = null; }
  }
  if (!u || u.protocol !== "https:" || !REF_HOST.test(u.hostname) || u.port) return res.status(400).json({ error: "bad_url", message: "인스타그램 사진 주소만 가져올 수 있어요." });
  if (!(await takeAdvisorQuota(email, "lookup", 400))) return res.status(429).json({ error: "daily_limit", message: "오늘 가져오기 한도를 다 썼어요 — 내일 다시 해 주세요." });
  try {
    const r = await fetch(u.href, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const type = String(r.headers.get("content-type") || "").split(";")[0].trim();
    if (!r.ok || !/^image\/(jpeg|png|webp|heic)$/i.test(type)) return res.status(502).json({ error: "fetch_failed", message: `사진을 못 받았어요(${r.status}) — 주소가 만료됐을 수 있어요.` });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "too_large", message: "사진이 너무 커요." });
    res.json({ data: `data:${type.toLowerCase()};base64,${buf.toString("base64")}` });
  } catch (e) {
    console.error("ref_fetch_failed:", String((e && e.message) || e).slice(0, 120));
    res.status(502).json({ error: "fetch_failed", message: "사진을 받다가 끊겼어요 — 다시 시도해 주세요." });
  }
}

// ---------- 스냅 작가 작업 사진 (/api/vendor-photos) ----------
// POST { kind, vendors:[{id, name, handle?}] } → { items:{[id]:{images, at, cached}}, errors:[{id, message}] }
// 인스타그램은 로그인 벽·약관상 수집 금지라 네이버 이미지 검색(후기·블로그 사진)으로 모은다. 업체마다 "이름 웨딩스냅" + "핸들 웨딩" 두 번 검색해 합친다.
// vendorPhotos/{kind}_{이름} 7일 캐시(catch-all 규칙이 클라이언트 접근을 막는다). 쿼터는 요청당 lookup 1회
const VENDOR_PHOTOS_TTL = 7 * 86400e3;
async function handleVendorPhotos(req, res, email) {
  noStore(res);
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const kind = String(b.kind || "");
  const vendors = (Array.isArray(b.vendors) ? b.vendors : []).slice(0, 20).map((v) => ({
    id: String((v && v.id) || "").slice(0, 60), name: String((v && v.name) || "").trim(),
    handle: /^[A-Za-z0-9._]{1,30}$/.test(String((v && v.handle) || "")) ? String(v.handle) : "",
  })).filter((v) => v.id && v.name.length >= 1 && v.name.length <= 40);
  if (!Object.prototype.hasOwnProperty.call(vendorLookup.KINDS, kind) || !vendors.length) return res.status(400).json({ error: "bad_request", message: "업체 목록(최대 20곳, 이름 40자 이내)을 확인해 주세요." });
  if (!(env("NAVER_SEARCH_CLIENT_ID") && env("NAVER_SEARCH_CLIENT_SECRET"))) return res.status(503).json({ error: "no_key", message: "네이버 검색 키가 없어 사진을 못 찾아요 — 관리자에게 키 설정을 요청해 주세요." });
  if (!(await takeAdvisorQuota(email, "lookup", 1000))) return res.status(429).json({ error: "daily_limit", message: "오늘 사진 찾기 한도를 다 썼어요 — 내일 다시 시도해 주세요." });
  const search = (q) => naverFetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(q)}&display=12&sort=sim&filter=large`)
    .then(async (r) => (r.ok ? ((await r.json()).items || []) : (console.error("vendor_photos_naver:", r.status), [])));
  const items = {}, errors = [];
  await mapLimit(vendors, 3, async (v) => {
    const ref = db.collection("vendorPhotos").doc(`${kind}_${v.name.replace(/[\s/]+/g, "").toLowerCase()}`.slice(0, 200));
    try {
      const snap = await ref.get().catch(() => null);
      const c = snap && snap.exists ? snap.data() : null;
      if (c && Date.now() - Date.parse(c.at) < VENDOR_PHOTOS_TTL) { items[v.id] = { images: c.images || [], at: c.at, cached: true }; return; }
      const [a, h] = await Promise.all([search(`${v.name} ${vendorLookup.KINDS[kind].q}`), v.handle ? search(`${v.handle} ${kind === "snap" || kind === "bsnap" ? "웨딩" : vendorLookup.KINDS[kind].q}`) : []]);
      const images = vendorLookup.cleanImages({ items: [...a, ...h] }, 16), at = new Date().toISOString();
      if (images.length) await ref.set({ images, at, name: v.name }).catch(() => {});
      items[v.id] = { images, at, cached: false };
    } catch (e) { errors.push({ id: v.id, message: String((e && e.message) || e).slice(0, 120) }); }
  });
  res.json({ items, errors });
}

async function handleAdvisor(req, res, email) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const useClaude = !!env("ANTHROPIC_API_KEY");
  // Gemini 폴백은 opt-in(ALLOW_GEMINI_FALLBACK=1) — 상담 요청에는 부부 연소득·자산·메모(최대 수만 자)가 그대로 실리는데,
  // 무료 티어는 입력이 학습에 쓰일 수 있다. 키가 빠졌다고 조용히 무료 티어로 흘려보내지 않고 명확히 503을 낸다.
  const allowGemini = env("ALLOW_GEMINI_FALLBACK") === "1" && !!env("GEMINI_API_KEY");
  if (!useClaude && !allowGemini) {
    console.error(`advisor_unavailable: ANTHROPIC_API_KEY 미설정${env("GEMINI_API_KEY") ? " (GEMINI_API_KEY 는 있지만 ALLOW_GEMINI_FALLBACK=1 이 아니라 폴백 안 함)" : ""} — firebase functions:secrets:set ANTHROPIC_API_KEY`);
    noStore(res);
    return res.status(503).json({ error: "no_key", message: "상담사를 사용할 수 없어요(키 미설정) — 관리자에게 ANTHROPIC_API_KEY 설정을 요청해 주세요." });
  }
  // 키 확인 뒤에 차감 — 키가 없어 503인 요청까지 한도를 깎지 않는다. 호출 실패 시 아래 catch에서 되돌린다
  if (!(await takeAdvisorQuota(email))) { noStore(res); return res.status(429).json({ error: "daily_limit", message: "오늘 상담 한도를 다 썼어요 — 내일 다시 이용해 주세요." }); }
  const b = (req.body && typeof req.body === "object") ? req.body : {};
  // 본문 상한 — 대화 이력·컨텍스트가 무한정 커지면 토큰 비용과 지연이 함께 늘어난다
  const input = {
    messages: capMessages(Array.isArray(b.messages) ? b.messages.slice(-24) : [], 20000),
    context: b.context, skills: Array.isArray(b.skills) ? b.skills.slice(0, 20) : [],
    mode: b.mode === "brief" ? "brief" : "chat",
    today: kstYmd(), userLabel: String(b.userLabel || email || "").slice(0, 30),
    screen: String(b.screen || "").slice(0, 60), // 캐시 접두사 밖(volatile)에 들어간다
  };
  noStore(res);
  try {
    let out, provider, model;
    const data = {};
    if (useClaude) {
      const Anthropic = anthropicSdk();
      // Hosting 경유 60초 하드 타임아웃 — 그 안에 결말을 내야 브라우저가 답을 받는다 (SDK 재시도도 끈다)
      const started = Date.now();
      const BUDGET_MS = 52000;
      const req = advisor.buildClaudeRequest({ ...input, model: env("ANTHROPIC_MODEL") || undefined });
      const msgs = req.messages;
      out = { text: "", actions: [] }; provider = "claude";
      const usedLookup = { web: false, server: false }; // 외부 데이터(웹·공고·뉴스)를 읽었는가 — 인젝션 방어에 쓴다
      const usage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }; // 캐시 적중 검증용 — 응답에 실어 프론트 콘솔에서 볼 수 있다
      // 수동 도구 루프: 조회 도구(search_*)는 서버가 실행해 결과를 돌려주고, 대시보드 수정 액션은 실행하지 않고
      // 프론트 카드로 넘긴다(사용자 [적용] 필요). 두 종류가 섞여 SDK 툴 러너 대신 직접 돈다.
      for (let iter = 0; iter < 4; iter++) {
        const remaining = BUDGET_MS - (Date.now() - started);
        if (remaining < 8000) { if (!out.text) out.text = "조회가 길어져 답을 마무리하지 못했어요 — 다시 물어보면 방금 조회한 캐시로 빨리 답해요."; break; }
        const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), timeout: remaining, maxRetries: 0 });
        // 도구 목록은 반복 내내 그대로 둔다 — 이력에 web_search 블록이 남아 있는데 도구를 빼면 이어받기(pause_turn)가 깨질 수 있다.
        // 검색 비용 상한은 max_uses(호출당 2회) × 루프 4회로 묶인다
        const msg = await client.beta.messages.create({
          ...req, messages: msgs,
          betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", // 안전 분류기가 거절하면 서버가 대체 모델로 같은 요청을 이어간다
        });
        model = msg.model;
        if (msg.usage) { usage.input += msg.usage.input_tokens || 0; usage.cacheRead += msg.usage.cache_read_input_tokens || 0; usage.cacheWrite += msg.usage.cache_creation_input_tokens || 0; usage.output += msg.usage.output_tokens || 0; }
        if ((msg.content || []).some((b) => b.type === "server_tool_use" || b.type === "web_search_tool_result")) usedLookup.web = true;
        const parsed = advisor.parseClaudeMessage(msg);
        if (parsed.text) out.text += (out.text ? "\n\n" : "") + parsed.text;
        out.actions.push(...parsed.actions);
        // 웹 검색(서버 도구)이 길어지면 pause_turn으로 멈춘다 — 받은 내용을 그대로 붙여 다시 보내면 이어서 진행한다
        if (msg.stop_reason === "pause_turn") { msgs.push({ role: "assistant", content: msg.content }); continue; }
        const toolUses = (msg.content || []).filter((b) => b.type === "tool_use");
        if (msg.stop_reason !== "tool_use" || !toolUses.length) break;
        msgs.push({ role: "assistant", content: msg.content });
        // 조회 도구는 병렬로 — 순차면 조회 두세 개가 60초 예산을 다 먹는다. 각 조회는 남은 예산에서 마무리 호출 몫(10초)을 뺀 만큼만
        const toolMs = BUDGET_MS - (Date.now() - started) - 10000;
        const results = await Promise.all(toolUses.map(async (tu) => {
          if (!advisor.SERVER_TOOL_NAMES.has(tu.name)) return { type: "tool_result", tool_use_id: tu.id, content: "제안 카드로 등록됨 — 사용자가 채팅에서 [적용]을 눌러야 반영된다. 그 전제로 답변을 마무리해라." };
          let r;
          usedLookup.server = true;
          try { r = await runServerTool(tu.name, tu.input, toolMs); } catch (e) { console.error(`tool_failed ${tu.name}:`, String((e && e.message) || e).slice(0, 200)); r = { error: "tool_failed", message: "조회에 실패했어요 — 잠시 후 다시 시도" }; }
          if (tu.name === "search_realty" && Array.isArray(r.listings)) data.listings = [...(data.listings || []), ...r.listings].slice(0, 15);
          return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(r).slice(0, 12000) };
        }));
        msgs.push({ role: "user", content: results });
      }
      // 외부 데이터를 읽은 턴의 스킬 저장 제안은 버린다 — 검색 결과·공고명에 숨은 지시가 이후 모든 상담의 system 프롬프트로 굳는 경로.
      // 나머지 데이터 수정 제안은 남기되 external:true 를 붙여 프론트가 "외부 자료를 읽은 뒤 나온 제안"임을 표시하게 한다 (navigate는 수정이 아니라 제외)
      if (usedLookup.web || usedLookup.server) out.actions = out.actions.filter((a) => a.name !== "save_skill").map((a) => (a.name === "navigate" ? a : { ...a, external: true }));
      // 도구 루프 반복마다 같은 제안이 다시 올 수 있다 — 같은 이름·인자는 한 장만
      const seenAct = new Set();
      out.actions = out.actions.filter((a) => { const key = a.name + JSON.stringify(a.args); if (seenAct.has(key)) return false; seenAct.add(key); return true; }).slice(0, 8);
      data.usage = usage;
      console.log(`advisor_claude ${model} in=${usage.input} cacheRead=${usage.cacheRead} cacheWrite=${usage.cacheWrite} out=${usage.output} ${Date.now() - started}ms`);
    } else {
      const parts = await callGeminiParts(advisor.buildAdvisorBody(input), { retry429: false, timeoutMs: 50000 });
      out = advisor.parseAdvisorParts(parts); provider = "gemini";
    }
    if (!out.text && !out.actions.length) out.text = "답변을 만들지 못했어요. 질문을 조금 바꿔 다시 물어봐 주세요.";
    res.json({ ...out, data, provider, model, at: new Date().toISOString() });
  } catch (e) {
    await refundQuota(email); // 상담 호출 실패 — 차감 되돌림
    const A = AnthropicSDK;
    if (A && e instanceof A.RateLimitError) return res.status(429).json({ error: "advisor_failed", message: "요청이 몰려 잠시 제한됐어요 — 1분 뒤 다시 보내주세요." });
    if (A && e instanceof A.AuthenticationError) return res.status(502).json({ error: "advisor_failed", message: "ANTHROPIC_API_KEY가 유효하지 않아요 — 시크릿을 확인해 주세요." });
    if (A && e instanceof A.APIConnectionTimeoutError) return res.status(504).json({ error: "advisor_failed", message: "답변이 60초를 넘겼어요 — 질문을 짧게 나눠 다시 보내주세요." });
    if (A && e instanceof A.APIError) { console.error("advisor_claude:", e.status, String(e.message).slice(0, 200)); return res.status(502).json({ error: "advisor_failed", message: `Claude API 오류 (${e.status}) — 잠시 후 다시 시도해 주세요.` }); }
    const msg = String((e && e.message) || e);
    const code = /gemini_429|retry_limit/.test(msg) ? 429 : /Timeout|abort|deadline/i.test(msg) ? 504 : 502;
    console.error(`advisor_failed ${code}:`, msg.slice(0, 300)); // 상세는 로그로만 — 업스트림 오류 본문을 클라이언트에 그대로 내보내지 않는다 (#12)
    res.status(code).json({ error: "advisor_failed", message: code === 429 ? "요청 제한에 걸렸어요 — 1분 뒤 다시 보내주세요." : code === 504 ? "답변이 60초를 넘겼어요 — 질문을 짧게 나눠 다시 보내주세요." : "상담 서버 오류 — 잠시 후 다시 시도해 주세요." });
  }
}

// ① Google 검색 grounding으로 웹 조사 시도(무료 티어는 검색 쿼터가 없어 429가 날 수 있음 → 건너뜀)
// ② 조사 결과(있으면) 또는 모델 자체 지식으로 responseSchema에 맞는 JSON 생성.
//    grounding과 JSON 강제 출력은 한 호출에서 함께 못 써서 단계를 나눈다.
//    Flash 모델이라 빨라서 Hosting 60초 타임아웃 안에도 대부분 완료된다.
async function callGeminiResearch(prompt, schema, deadlineAt = 0) {
  let research = "";
  try {
    research = await callGemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }, { retry429: false, deadlineAt }); // 검색 쿼터 없으면 즉시 폴백 (재시도로 시간 낭비 X)
  } catch (e) {
    console.warn("gemini_search_skip:", String(e.message || e).slice(0, 120)); // best-effort — 실패 시 모델 지식으로 진행
  }
  const structured = await callGemini({
    contents: [{ role: "user", parts: [{ text: research.trim()
      ? `아래는 웹 조사 결과야. 원 요청의 항목들을 스키마에 맞는 JSON으로 정리해줘. 조사 결과에 없는 내용은 지어내지 말고, 값이 불확실하면 '추정'을 표기해. 한국어로.\n\n[원 요청]\n${prompt}\n\n[조사 결과]\n${research}`
      : `${prompt}\n\n(웹 검색 도구 없이 네가 알고 있는 최신 정보 기준으로 답해. 실존하는 곳만 담고, 가격 등 불확실한 값에는 '추정'을 표기해.)` }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
  }, { deadlineAt });
  return JSON.parse(structured);
}

// ---------- 업체 실존 검증 (네이버 지역검색 API — developers.naver.com, 무료 25,000회/일) ----------
// LLM이 웹 검색 없이 생성한 업체명은 환각일 수 있어, 네이버에 실제 등록된 업소인지 확인한다.
// 키 미설정 시 검증 생략(기존 동작). 검증 실패 업체는 제외하되, 남는 게 4곳 미만이면
// '실존 미확인' 표기로 유지해 리스트가 비지 않게 한다.
const normName = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/\([^)]*\)/g, "").replace(/[\s·.&\-_'"]/g, "").toLowerCase();
// "클로드 스튜디오" ↔ "스튜디오클로드"처럼 어순·접미어가 달라도 매칭되도록 업종 공통어 제거 후 핵심 이름 비교
const CORE_STRIP = /(웨딩|스튜디오|드레스|메이크업|헤어|살롱|샵|컨벤션|웨딩홀|스냅|studio|wedding|salon|dress|makeup|hall|snap)/g;
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

// deadlineAt: 이 시각(ms epoch)까지 끝내야 한다 — 스케줄 실행의 토픽별 예산. 0이면 무제한(온디맨드 요청은 Hosting 60초가 자른다)
async function runResearch(topic, query, deadlineAt = 0) {
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
  const data = await callGeminiResearch(t.prompt(query), t.schema, deadlineAt);
  let items = data.items || [];
  if (t.verify) items = await verifyVendors(items, t.verify); // 네이버 지역검색으로 실존 업체만 통과
  // LLM이 만든 link는 스킴을 확인한 것만 남긴다 (프론트가 href로 쓰므로 javascript:·data: 차단)
  items = items.map((it) => (it && it.link && !/^https?:\/\//i.test(String(it.link)) ? { ...it, link: "" } : it));
  return { source: "live", topic, items, fetchedAt: new Date().toISOString() };
}

async function handleResearch(res, query, email) {
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
  // 캐시를 못 쓰는 새 조사만 하루 상한을 센다 — area 등 파라미터를 바꿔 캐시를 우회하며 Gemini·네이버를 계속 태우는 것 방지
  if (email && !(await takeAdvisorQuota(email, "research", 30))) {
    if (cached && cached.payload) return res.json(cached.payload);
    return res.status(429).json({ error: "daily_limit", message: "오늘 리서치 한도를 다 썼어요 — 기본 데이터를 표시해요." });
  }
  try {
    const payload = await runResearch(topic, query);
    await writeResearchCache(cacheKey, payload);
    res.json(payload);
  } catch (e) {
    await refundQuota(email, "research"); // 조사 실패 — 차감 되돌림
    if (e.code === 503 && cached && cached.payload) return res.json(cached.payload); // 키가 빠져도 옛 캐시라도 준다
    // e.code가 HTTP 상태코드가 아닐 수 있다 (예: DOMException TimeoutError의 code=23) — 그대로 넣으면 res.status가 던져 500이 된다
    const httpCode = Number.isInteger(e.code) && e.code >= 400 && e.code <= 599 ? e.code : 502;
    console.error(`research_failed ${topic} ${httpCode}:`, String(e.message || e).slice(0, 300)); // 상세는 로그로만 (#12)
    res.status(httpCode).json({ error: "research_failed", message: httpCode === 503
      ? "리서치 키가 설정되지 않았어요 — 기본 데이터를 표시해요."
      : /gemini_429|retry_limit/.test(String(e.message)) ? "요청 제한에 걸렸어요 — 1~2분 뒤 다시 시도해 주세요." : "리서치에 실패했어요 — 시간 초과면 1~2분 뒤 다시 시도해 주세요." });
  }
}

// ---------- 주식·ETF 현재가 (/api/quotes — quotes.js) ----------
const quotes = require("./quotes.js");
const quotesApi = quotes.createQuotes({ env, db, mapLimit });
async function handleQuotes(res, query, email) {
  const codes = quotes.parseCodes(query && query.codes);
  if (!codes) { noStore(res); return res.status(400).json({ error: "bad_codes", message: "종목 코드는 국내 6자리 또는 해외 영문 티커로, 최대 30개까지 쉼표로 구분해 주세요." }); }
  if (!(await takeAdvisorQuota(email, "lookup", 500))) { noStore(res); return res.status(429).json({ error: "daily_limit", message: "오늘 시세 조회 한도를 다 썼어요 — 내일 다시 시도해 주세요." }); }
  const out = await quotesApi.getQuotes(codes);
  if (out.items.length) setCache(res, 30); else noStore(res); // 인증 경로라 private
  res.json(out);
}

// ---------- 정책 레이더 (/api/policy-radar — policy-radar.js) ----------
// GET → research/policy-radar 캐시 { items, at, stale } (+ ?job=ID 로 새로고침 진행 확인)
// POST {refresh:true, context} → radarJobs 작업 생성(202) — policyRadarJob 트리거가 Claude 웹 검색으로 갱신
const policyRadar = require("./policy-radar.js");
const radarJobsRef = () => db.collection("radarJobs");
const RADAR_KEY = "policy-radar";
// 부부 조건 — 짧은 객체만 (프롬프트에 그대로 들어간다)
function radarContext(c) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const s = JSON.stringify(c);
  return s.length <= 1000 ? c : null;
}
async function runRadarJob(context, deadlineMs) {
  const Anthropic = anthropicSdk();
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), maxRetries: 0 });
  const items = await policyRadar.runRadar({ client, model: env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT, context, today: kstYmd(), deadlineMs });
  if (!items.length) throw new Error("radar_empty"); // 빈 결과로 기존 목록을 지우지 않는다
  const at = new Date().toISOString();
  await cacheDoc(RADAR_KEY).set({ at: Date.now(), payload: { items, at }, context: context || null });
  return items.length;
}
async function handleRadar(req, res, email) {
  noStore(res);
  const q = req.query || {};
  if (req.method === "GET" && q.job) {
    const id = String(q.job);
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return res.status(400).json({ error: "bad_id" });
    const snap = await radarJobsRef().doc(id).get().catch(() => null);
    return snap && snap.exists ? res.json(snap.data()) : res.status(404).json({ error: "not_found" });
  }
  const cached = await readResearchCache(RADAR_KEY);
  const payload = (cached && cached.payload) || { items: [], at: null };
  const view = { items: payload.items || [], at: payload.at, stale: !payload.at || Date.now() - Date.parse(payload.at) > 36 * 3600e3 };
  if (req.method === "GET") return res.json(view);
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const b = req.body || {};
  if (!b.refresh) return res.status(400).json({ error: "bad_request" });
  if (!env("ANTHROPIC_API_KEY")) return res.status(503).json({ error: "no_key", message: "ANTHROPIC_API_KEY가 설정되지 않아 새로고침할 수 없어요." });
  // 진행 중인 작업(10분 이내)이 있으면 새로 만들지 않고 그 작업을 알려준다 — 연타로 과금되지 않게
  const last = await radarJobsRef().orderBy("createdAt", "desc").limit(1).get().catch(() => null);
  const lj = last && !last.empty ? last.docs[0] : null;
  if (lj && ["queued", "running"].includes(lj.data().state) && Date.now() - Date.parse(lj.data().createdAt) < 10 * 60e3) return res.status(202).json({ ...view, jobId: lj.id });
  if (!(await takeAdvisorQuota(email, "research", 30))) return res.status(429).json({ error: "daily_limit", message: "오늘 새로고침 한도를 다 썼어요 — 내일 다시 시도해 주세요." });
  const ref = await radarJobsRef().add({ state: "queued", by: email, context: radarContext(b.context), createdAt: new Date().toISOString() });
  res.status(202).json({ ...view, jobId: ref.id });
}

// 로컬 단위 테스트용 (배포 함수 아님)
exports._advisorInternals = { resolveLawd, lawdMatches, marketCompare, runServerTool, captureHandler, summarizeTerm };

// ---------- HTTP 엔트리 (Hosting rewrites: /api/** → api) ----------
// timeout 120초 — Hosting이 60초에 끊으므로 그 뒤는 캐시를 남기는 정도의 여유만 (300초면 끊긴 요청이 5분씩 인스턴스를 잡았다)
exports.api = onRequest({ timeoutSeconds: 120, memory: "512MiB", secrets: SECRETS }, async (req, res) => {
  const p = req.path.replace(/\/+$/, "");
  try { // 핸들러가 던지면 여기서 500을 돌려준다 — 안 잡으면 클라이언트가 Hosting 타임아웃(504)까지 기다린다
    if (p === "/api/longlease") return await handleLonglease(res, req.query);
    if (p === "/api/config") return res.json({ naverMapKey: env("NAVER_MAP_KEY"), fcmVapidKey: env("FCM_VAPID_KEY") });
    if (p === "/api/vg-img") return await handleVgImg(req, res);
    if (p.startsWith("/i/")) return await handleInvitePublic(req, res, p); // 모바일 청첩장 공개 링크 — 로그인 없음
    // --- 아래는 로그인 필요 (비용·상태 변경 경로 + 업스트림 증폭이 큰 조회 프록시) ---
    const AUTHED = ["/api/push-register", "/api/push-test", "/api/research", "/api/advisor", "/api/me", "/api/news",
      "/api/cheongyak", "/api/realty", "/api/lh-notices", "/api/geocode", "/api/policy-proposals", "/api/policy-review", "/api/policy-job", "/api/listing-extract", "/api/listing-review", "/api/listing-building", "/api/listing-registry", "/api/listing-market", "/api/sub-analyze", "/api/sub-job", "/api/quotes", "/api/saving-rates", "/api/fx", "/api/policy-radar", "/api/vendor-lookup", "/api/vendor-photos", "/api/ref-fetch", "/api/invite-design", "/api/invite-job"];
    if (AUTHED.includes(p)) {
      const email = await verifyCaller(req);
      res.locals.private = true; // setCache가 public 대신 private를 쓴다 — 인증 응답을 CDN이 비로그인 요청에 재사용하지 않게
      if (p === "/api/me") { noStore(res); return res.json({ allowed: true, email }); } // 프론트 접근 판정 — 허용 목록을 정적 파일에 두지 않기 위해
      if (p === "/api/news") return await handleNews(res, req.query);
      if (p === "/api/cheongyak") return await handleCheongyak(res, req.query);
      if (p === "/api/realty") return await handleRealty(res, req.query);
      if (p === "/api/lh-notices") return await handleLhNotices(res, req.query);
      if (p === "/api/geocode") return await handleGeocode(res, req.query);
      if (p === "/api/push-register") return await handlePushRegister(req, res);
      if (p === "/api/push-test") return await handlePushTest(req, res);
      if (p === "/api/advisor") return await handleAdvisor(req, res, email);
      if (p === "/api/policy-proposals" || p === "/api/policy-review" || p === "/api/policy-job") return await handlePolicy(req, res, email, p);
      if (p === "/api/listing-extract" || p === "/api/listing-review" || p === "/api/listing-building" || p === "/api/listing-registry" || p === "/api/listing-market") return await handleListing(req, res, email, p);
      if (p === "/api/sub-analyze" || p === "/api/sub-job") return await handleSub(req, res, email, p);
      if (p === "/api/quotes") return await handleQuotes(res, req.query, email);
      if (p === "/api/saving-rates") return await handleSavingRates(res);
      if (p === "/api/fx") return await handleFx(res);
      if (p === "/api/policy-radar") return await handleRadar(req, res, email);
      if (p === "/api/vendor-lookup") return await handleVendorLookup(req, res, email);
      if (p === "/api/vendor-photos") return await handleVendorPhotos(req, res, email);
      if (p === "/api/ref-fetch") return await handleRefFetch(req, res, email);
      if (p === "/api/invite-design" || p === "/api/invite-job") return await handleInvite(req, res, email, p);
      return await handleResearch(res, req.query, email);
    }
    res.status(404).json({ error: "not_found" });
  } catch (e) {
    const code = e && e.code;
    if (code === 401 || code === 403) {
      noStore(res);
      return res.status(code).json({ error: code === 401 ? "unauthorized" : "forbidden", message: "허용된 계정으로 로그인해 주세요." });
    }
    if (code === 503 && e.message === "allowlist_unconfigured") {
      noStore(res);
      return res.status(503).json({ error: "allowlist_unconfigured", message: "서버 허용 목록이 설정되지 않아 잠시 이용할 수 없어요 — 관리자에게 문의하세요." });
    }
    console.error(`api_unhandled ${p}:`, String((e && e.message) || e).slice(0, 300));
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  }
});

// ---------- 스케줄 알림 (매일 08:30 KST) — 신규 청약·LH 공고·마감 임박 푸시 ----------
exports.notifyDaily = onSchedule({ schedule: "30 8 * * *", timeZone: "Asia/Seoul", timeoutSeconds: 120, memory: "256MiB", secrets: SECRETS }, async () => {
  // limit — 무인증 등록으로 토큰이 폭증해도 스케줄러가 OOM/타임아웃으로 죽지 않게 상한을 둔다
  const tokensSnap = await db.collection("pushTokens").orderBy("at", "desc").limit(2000).get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  const stateRef = db.doc("notify/state");
  const state = (await stateRef.get()).data() || {};
  const seenC = new Set(state.seenCheongyak || []);
  const seenL = new Set(state.seenLh || []);
  const todayStr = kstYmd(); // 모듈 스코프 today() 함수를 가리지 않도록 별도 이름
  const tomorrowStr = kstYmd(Date.now() + 86400e3);
  const lines = [];
  // ① 청약홈 신규 공고 + 마감 임박
  try {
    const KEY = env("CHEONGYAK_KEY");
    const since = kstYmd(Date.now() - 60 * 86400e3);
    const list = await fetchCheongyakList(`serviceKey=${encodeURIComponent(KEY)}`, since, 3);
    const isFirstRun = seenC.size === 0; // 첫 실행은 전부 신규라 알림 폭주 방지 — 상태만 저장
    // 최근 7일 공고만 "신규"로 본다 — 상태가 오래 멈춰 있었어도 옛 공고가 한꺼번에 쏟아지지 않게
    const cutoff = kstYmd(Date.now() - 7 * 86400e3);
    const fresh = isFirstRun ? [] : list.filter((d) => d.PBLANC_NO && !seenC.has(d.PBLANC_NO) && String(d.RCRIT_PBLANC_DE || "") >= cutoff);
    fresh.slice(0, 3).forEach((d) => lines.push(`🆕 청약: ${d.HOUSE_NM} (${d.SUBSCRPT_AREA_CODE_NM || ""} · 접수 ${d.RCEPT_BGNDE || "?"}~)`));
    if (fresh.length > 3) lines.push(`… 외 신규 청약 ${fresh.length - 3}건`);
    list.filter((d) => d.RCEPT_ENDDE === todayStr || d.RCEPT_ENDDE === tomorrowStr)
      .slice(0, 3).forEach((d) => lines.push(`⏰ 접수 마감 임박: ${d.HOUSE_NM} (~${d.RCEPT_ENDDE})`));
    list.forEach((d) => d.PBLANC_NO && seenC.add(d.PBLANC_NO));
  } catch (e) { console.error("notifyDaily cheongyak:", String(e.message || e).slice(0, 150)); }
  // ①-2 무순위/취소후재공급(줍줍) 신규 + 마감 임박 — 접수기간이 짧아(1~3일) 놓치기 쉬운 유형
  try {
    const KEY = env("CHEONGYAK_KEY");
    const since = kstYmd(Date.now() - 30 * 86400e3);
    const list = await fetchCheongyakList(`serviceKey=${encodeURIComponent(KEY)}`, since, 2, "getRemndrLttotPblancDetail");
    const rid = (d) => `R:${d.PBLANC_NO}`; // 일반 분양과 같은 seen 집합을 쓰므로 접두사로 충돌 방지
    const isFirstRun = ![...seenC].some((k) => k.startsWith("R:"));
    const cutoff = kstYmd(Date.now() - 7 * 86400e3);
    const fresh = isFirstRun ? [] : list.filter((d) => d.PBLANC_NO && !seenC.has(rid(d)) && String(d.RCRIT_PBLANC_DE || "") >= cutoff);
    fresh.slice(0, 3).forEach((d) => lines.push(`🎯 줍줍: ${d.HOUSE_NM} (${d.SUBSCRPT_AREA_CODE_NM || ""} · 접수 ${d.RCEPT_BGNDE || d.SUBSCRPT_RCEPT_BGNDE || "?"}~)`));
    if (fresh.length > 3) lines.push(`… 외 신규 줍줍 ${fresh.length - 3}건`);
    list.filter((d) => [todayStr, tomorrowStr].includes(d.RCEPT_ENDDE || d.SUBSCRPT_RCEPT_ENDDE))
      .slice(0, 2).forEach((d) => lines.push(`⏰ 줍줍 마감 임박: ${d.HOUSE_NM} (~${d.RCEPT_ENDDE || d.SUBSCRPT_RCEPT_ENDDE})`));
    list.forEach((d) => d.PBLANC_NO && seenC.add(rid(d)));
  } catch (e) { console.error("notifyDaily remndr:", String(e.message || e).slice(0, 150)); }
  // ② LH 수도권 주택 신규 공고
  try {
    const metro = (await fetchLhList()).filter((i) => /서울|경기|인천/.test(i.region));
    const isFirstRun = seenL.size === 0;
    const fresh = isFirstRun ? [] : metro.filter((i) => !seenL.has(String(i.id)));
    fresh.slice(0, 3).forEach((i) => lines.push(`🏠 LH: [${i.type}] ${i.name.slice(0, 32)} (~${i.closeAt || "?"})`));
    if (fresh.length > 3) lines.push(`… 외 LH 신규 ${fresh.length - 3}건`);
    metro.forEach((i) => seenL.add(String(i.id)));
  } catch (e) { console.error("notifyDaily lh:", String(e.message || e).slice(0, 150)); }
  const saveState = () => stateRef.set({ seenCheongyak: [...seenC].slice(-800), seenLh: [...seenL].slice(-800), at: Date.now() }); // 무순위(R: 접두사)까지 한 집합에 담으므로 상한을 넉넉히
  if (!tokens.length) { await saveState(); return console.log("notifyDaily: 등록된 기기 없음 — 상태만 전진"); }
  if (!lines.length) { await saveState(); return console.log("notifyDaily: 새 소식 없음"); }
  // 발송이 성공한 뒤에 seen을 저장한다 — 먼저 저장하면 FCM 장애 때 그 공고는 다음 날도 알려주지 않는다.
  // 단 전 토큰이 무효로 정리된 경우는 받을 기기가 없다는 뜻이므로 상태를 전진시킨다(무한 동결 방지).
  const r = await sendPush(tokens, { title: "📋 오늘의 부동산 공고", body: lines.slice(0, 6).join("\n"), tag: "daily-notice" });
  if (r.ok > 0 || r.bad === tokens.length) await saveState();
  else console.warn("notifyDaily: 전 기기 발송 실패 — seen 상태를 저장하지 않고 다음 실행에 재시도");
  console.log(`notifyDaily: ${lines.length}줄 → ${r.ok}기기 발송 (실패 ${r.failed}, 정리 ${r.bad})`);
});

// ---------- 스케줄 리서치 (매일 06:30 KST) ----------
// 토픽별 시간 예산 — 함수 전체 540초 안에서 남은 시간을 남은 토픽 수로 나눠 쓴다(앞 토픽이 빨리 끝나면 뒤로 이월).
// 예산이 없으면 한 토픽의 Gemini 429 재시도(20초×3)·검색·검증이 겹쳐 뒤 토픽이 실행도 못 하고 함수가 타임아웃으로 죽었다.
const RESEARCH_DAILY_TOTAL_MS = 500 * 1000; // 540초 중 캐시 쓰기·로그 여유 40초
// 매주 월요일 — 전 섹션 정책 점검, 새 후보가 생기면 푸시. 값은 바꾸지 않는다(부부가 앱에서 반영)
exports.policyReviewWeekly = onSchedule({ schedule: "0 7 * * 1", timeZone: "Asia/Seoul", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async () => {
  if (!env("ANTHROPIC_API_KEY")) return console.warn("policyReviewWeekly: ANTHROPIC_API_KEY 없음 — 건너뜀");
  const keys = policyReview.SECTION_KEYS, deadline = Date.now() + 480000; // 섹션 동시 실행 — 순차면 9분 안에 다 못 돈다
  const before = new Set((((await proposalsRef().get().catch(() => null)) || { data: () => null }).data() || { items: [] }).items.map((it) => it.id));
  await Promise.all(keys.map((k) => runPolicyReview(k, deadline).catch((e) => console.error(`policyReviewWeekly ${k} 실패:`, String((e && e.message) || e).slice(0, 200)))));
  const after = ((await proposalsRef().get()).data() || { items: [] }).items;
  const fresh = after.filter((it) => !before.has(it.id));
  if (!fresh.length) return;
  const tokens = (await db.collection("pushTokens").limit(50).get()).docs.map((d) => d.id);
  await sendPush(tokens, { title: "정책 값 변경 후보", body: `${fresh.length}건 — ${fresh.slice(0, 2).map((it) => (policyReview.POLICY_DEFAULT.labels[it.path] || it.path)).join(", ")}${fresh.length > 2 ? " 등" : ""}. 설정 › 정책 데이터에서 확인해 주세요.`, tag: "policy-review" });
});

// 정책 점검 작업 — /api/policy-review 가 만든 policyJobs 문서를 받아 섹션을 동시에 점검한다.
// Firestore 트리거는 DB와 같은 지역이어야 해서 이 함수만 asia-northeast3(서울)에 둔다.
exports.policyReviewJob = onDocumentCreated({ document: "policyJobs/{id}", region: "asia-northeast3", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async (event) => {
  const snap = event.data; if (!snap) return;
  const ref = snap.ref, keys = (snap.data() || {}).sections || [];
  const deadline = Date.now() + 480000;
  await Promise.all(keys.map(async (k) => {
    await ref.update({ [`state.${k}`]: "running" }).catch(() => {});
    try {
      const r = await runPolicyReview(k, deadline);
      await ref.update({ [`state.${k}`]: "done", [`found.${k}`]: r.items.length });
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 200);
      console.error("policy_review_failed:", k, msg);
      await refundQuota((snap.data() || {}).by, "policy"); // 앱에서 요청한 작업만 by가 있다
      await ref.update({ [`state.${k}`]: "failed", [`errors.${k}`]: /timed out|timeout/i.test(msg) ? "시간 초과 — 다시 시도해 주세요" : "점검 중 오류" }).catch(() => {});
    }
  }));
  await ref.update({ finishedAt: new Date().toISOString() }).catch(() => {});
});

// 청약 공고 분석 작업 — /api/sub-analyze 가 만든 subJobs 문서를 받아 공고문 PDF를 Claude로 읽는다.
exports.subAnalyzeJob = onDocumentCreated({ document: "subJobs/{id}", region: "asia-northeast3", timeoutSeconds: 540, memory: "1GiB", secrets: SECRETS }, async (event) => {
  const snap = event.data; if (!snap) return;
  const ref = snap.ref, d = snap.data() || {};
  if (d.state !== "queued") return; // 트리거 중복 실행 방지
  const partsRef = ref.collection("parts");
  const dropParts = () => partsRef.get().then((s) => Promise.all(s.docs.map((x) => x.ref.delete()))).catch(() => {});
  await ref.update({ state: "running", startedAt: new Date().toISOString() }).catch(() => {});
  try {
    let data;
    if (d.parts > 0) { // 올린 PDF — 조각을 순서대로 합치고 바로 지운다
      const ps = await partsRef.get();
      data = ps.docs.sort((a, b) => Number(a.id) - Number(b.id)).map((x) => x.data().data || "").join("");
      await dropParts();
      if (ps.size !== d.parts) throw Object.assign(new Error("parts_missing"), { ko: "올린 PDF 일부가 저장되지 않았어요 — 다시 올려 주세요." });
    } else {
      const buf = await subAnalyze.downloadPdf(d.pdfUrl).catch((e) => { throw Object.assign(e, { ko: /too_large/.test(e.message) ? "공고문 PDF가 30MB를 넘어요 — 필요한 쪽만 올려 주세요." : "청약홈에서 공고문 PDF를 받지 못했어요 — PDF를 직접 올려 주세요." }); });
      data = buf.toString("base64");
    }
    if (data.length > 31_000_000) throw Object.assign(new Error("too_large_for_claude"), { ko: "공고문이 너무 커서 분석할 수 없어요(약 23MB 이하) — 자격·공급 부분만 올려 주세요." });
    const Anthropic = anthropicSdk();
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), timeout: 420000, maxRetries: 0 });
    const model = env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT;
    const first = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }, { type: "text", text: subAnalyze.analyzePrompt(d.context, kstYmd()) }];
    const started = Date.now();
    const ask = async (msgs) => {
      const msg = await client.messages.create({ model, max_tokens: 8000, output_config: { effort: "low" }, messages: msgs }, { timeout: Math.max(30000, 480000 - (Date.now() - started)) });
      if (msg.stop_reason === "max_tokens") console.error("sub_analyze_truncated");
      return (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
    };
    let text = await ask([{ role: "user", content: first }]);
    if (!subAnalyze.extractJson(text) && Date.now() - started < 300000) { // JSON이 깨졌으면 한 번 더 — 형식만 요구
      text = await ask([{ role: "user", content: first }, { role: "assistant", content: text || "(빈 응답)" }, { role: "user", content: "위 분석을 지정한 JSON 형식 하나로만 다시 출력해라. 다른 글 없이." }]);
    }
    const result = subAnalyze.cleanSubAnalysis(subAnalyze.extractJson(text));
    if (!result) { console.error("sub_analyze_parse_failed:", String(text).slice(0, 300)); throw Object.assign(new Error("parse_failed"), { ko: "분석 결과를 만들지 못했어요 — 다시 시도해 주세요." }); }
    await ref.update({ state: "done", result, source: d.parts > 0 ? "upload" : "applyhome", finishedAt: new Date().toISOString() });
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 200);
    console.error("sub_analyze_failed:", msg);
    await dropParts();
    await refundQuota(d.by, "subAnalyze");
    const ko = e.ko || (/timed out|timeout/i.test(msg) ? "시간이 오래 걸려 끊겼어요 — 다시 시도해 주세요." : /page|pdf|document/i.test(msg) ? "Claude가 이 PDF를 읽지 못했어요(쪽수가 너무 많거나 스캔본) — 자격·공급 부분만 올려 주세요." : "분석 중 오류가 났어요 — 잠시 후 다시 시도해 주세요.");
    await ref.update({ state: "failed", error: ko, noPdf: !d.parts && !!/받지 못했/.test(ko), finishedAt: new Date().toISOString() }).catch(() => {});
  }
});

// 청첩장 시안 작업 — /api/invite-design 이 만든 inviteJobs 문서를 받아 Claude로 HTML 시안을 만든다
exports.inviteDesignJob = onDocumentCreated({ document: "inviteJobs/{id}", region: "asia-northeast3", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async (event) => {
  const snap = event.data; if (!snap) return;
  const ref = snap.ref, d = snap.data() || {};
  if (d.state !== "queued") return;
  // 같은 이벤트가 두 번 와도 한 번만 — 문서를 다시 읽어 queued 일 때만 running 으로 바꾸고 진행
  const claimed = await db.runTransaction(async (tx) => { const cur = await tx.get(ref); if (!cur.exists || cur.get("state") !== "queued") return false; tx.update(ref, { state: "running", startedAt: new Date().toISOString() }); return true; }).catch(() => false);
  if (!claimed) return;
  let called = false; // 모델을 부른 뒤의 실패는 할당량을 돌려주지 않는다(비용은 이미 났다)
  try {
    const Anthropic = anthropicSdk();
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY"), timeout: 480000, maxRetries: 0 });
    const model = env("INVITE_MODEL") || env("ANTHROPIC_MODEL") || advisor.CLAUDE_MODEL_DEFAULT;
    const system = inviteDesign.skillPrompt({ format: d.format, size: d.size || { w: 148, h: 210 }, photoCount: d.photoCount || 0, filled: d.filled || [], today: kstYmd() });
    const msgs = (d.messages || []).map((m) => ({ role: m.role, content: m.text }));
    while (msgs.length && msgs[0].role !== "user") msgs.shift(); // 첫 메시지는 user 여야 한다
    const last = msgs.pop();
    const content = [];
    (d.refs || []).forEach((u) => { const mm = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(u); if (mm) content.push({ type: "image", source: { type: "base64", media_type: mm[1], data: mm[2] } }); });
    if ((d.refs || []).length) content.push({ type: "text", text: `(위 ${d.refs.length}장은 부부가 이번 요청에 첨부한 레퍼런스예요)` });
    content.push({ type: "text", text: (d.html ? `지금 시안 HTML:\n<<<HTML\n${d.html}\nHTML>>>\n\n` : "아직 시안이 없어요 — 첫 시안을 만들어 주세요.\n\n") + `요청: ${last ? last.content : ""}` });
    // 같은 역할이 이어지면 합친다(API는 user/assistant 번갈아 와야 한다)
    const merged = [];
    for (const m of [...msgs, { role: "user", content }]) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === m.role && typeof prev.content === "string" && typeof m.content === "string") prev.content += "\n" + m.content;
      else merged.push(m);
    }
    called = true;
    const msg = await client.messages.create({ model, max_tokens: 20000, system, messages: merged });
    const text = (msg.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
    if (msg.stop_reason === "max_tokens") { console.error("invite_design_truncated"); throw Object.assign(new Error("truncated"), { ko: "시안이 너무 길어 끝까지 못 그렸어요 — 장식이나 섹션을 줄여 달라고 다시 요청해 주세요." }); }
    const out = inviteDesign.parseInviteResponse(text);
    if (!out) { console.error("invite_parse_failed:", String(text).slice(0, 300)); throw Object.assign(new Error("parse_failed"), { ko: "시안을 만들지 못했어요 — 요청을 조금 바꿔 다시 해 주세요." }); }
    await ref.update({ state: "done", html: out.html, note: out.note, refs: [], finishedAt: new Date().toISOString() });
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 200);
    console.error("invite_design_failed:", msg);
    if (!called) await refundQuota(d.by, "invite");
    const ko = e.ko || (/timed out|timeout/i.test(msg) ? "시간이 오래 걸려 끊겼어요 — 다시 시도해 주세요." : "시안을 만드는 중 오류가 났어요 — 잠시 후 다시 시도해 주세요.");
    await ref.update({ state: "failed", error: ko, refs: [], finishedAt: new Date().toISOString() }).catch(() => {});
  }
});

// 정책 레이더 작업 — /api/policy-radar POST 또는 researchDaily 가 만든 radarJobs 문서를 받아 실행
exports.policyRadarJob = onDocumentCreated({ document: "radarJobs/{id}", region: "asia-northeast3", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async (event) => {
  const snap = event.data; if (!snap) return;
  const ref = snap.ref, d = snap.data() || {};
  if (d.state !== "queued") return; // 트리거 중복 실행 방지
  await ref.update({ state: "running", startedAt: new Date().toISOString() }).catch(() => {});
  try {
    const n = await runRadarJob(d.context || null, Date.now() + 480000);
    await ref.update({ state: "done", found: n, finishedAt: new Date().toISOString() });
    console.log(`policy_radar: ${n}건`);
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 200);
    console.error("policy_radar_failed:", msg);
    if (d.by) await refundQuota(d.by, "research");
    await ref.update({ state: "failed", error: /timed out|timeout/i.test(msg) ? "시간 초과 — 다시 시도해 주세요" : /radar_empty/.test(msg) ? "출처가 확인된 새 발표를 찾지 못했어요 — 기존 목록을 유지해요" : "정책 수집 중 오류", finishedAt: new Date().toISOString() }).catch(() => {});
  }
});

exports.researchDaily = onSchedule({ schedule: "30 6 * * *", timeZone: "Asia/Seoul", timeoutSeconds: 540, memory: "512MiB", secrets: SECRETS }, async () => {
  // 정책 레이더는 작업 문서만 만든다 — 웹 검색은 policyRadarJob 트리거가 자기 9분 안에서 돌린다(지난 조건 context 재사용)
  if (env("ANTHROPIC_API_KEY")) {
    const prev = await readResearchCache(RADAR_KEY);
    await radarJobsRef().add({ state: "queued", by: null, context: (prev && prev.context) || null, createdAt: new Date().toISOString() }).catch((e) => console.error("researchDaily radar job 실패:", String(e.message || e).slice(0, 200)));
  }
  if (env("FSS_KEY")) { // 은행 예적금 금리 — 몇 초짜리 공시 조회
    try { await writeResearchCache("saving-rates", await fetchSavingRates(env("FSS_KEY"))); console.log("researchDaily saving-rates: 갱신"); }
    catch (e) { console.error("researchDaily saving-rates 실패:", String(e.message || e).slice(0, 200)); }
  }
  const startedAt = Date.now();
  const topics = Object.keys(RESEARCH_TOPICS).filter((t) => RESEARCH_TOPICS[t].daily !== false); // 온디맨드 전용 토픽은 스케줄 제외
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const left = startedAt + RESEARCH_DAILY_TOTAL_MS - Date.now();
    const budget = Math.floor(left / (topics.length - i));
    if (budget < 15000) { console.warn(`researchDaily ${topic}: 예산 부족(${Math.round(left / 1000)}초) — 건너뜀, 캐시 유지`); continue; }
    const deadlineAt = Date.now() + budget;
    const topicStarted = Date.now();
    try {
      // 하드 백스톱 — 네이버 검증 등 deadline을 모르는 단계가 길어져도 다음 토픽 차례를 빼앗지 않는다
      const payload = await Promise.race([
        runResearch(topic, {}, deadlineAt),
        new Promise((_, rej) => setTimeout(() => rej(new Error("topic_budget_exceeded")), budget)),
      ]);
      if (payload.items && payload.items.length) {
        await writeResearchCache(topic, payload);
        console.log(`researchDaily ${topic}: ${payload.items.length}건 (${payload.source}) ${Math.round((Date.now() - topicStarted) / 1000)}초/예산 ${Math.round(budget / 1000)}초`);
      } else {
        console.warn(`researchDaily ${topic}: 빈 결과 — 캐시 유지`);
      }
    } catch (e) {
      console.error(`researchDaily ${topic} 실패 (${Math.round((Date.now() - topicStarted) / 1000)}초/예산 ${Math.round(budget / 1000)}초):`, String(e.message || e).slice(0, 300));
    }
  }
});


