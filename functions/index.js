/*
 * Firebase Functions(2nd gen) — 대시보드 API
 *
 * Hosting rewrites가 /api/** 를 `api` 함수로 라우팅한다(프론트와 같은 도메인 → CORS 없음).
 *   /api/cheongyak   청약홈 공공데이터 프록시 (CHEONGYAK_KEY)
 *   /api/naver-land  네이버 부동산 비공식 API 프록시
 *   /api/news        구글뉴스 RSS (키 불필요)
 *   /api/geocode     주소→좌표 폴백 (NCP REST → OSM Nominatim, 키 없어도 동작)
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
const setCache = (res, sec, force) => (force ? noStore(res) : res.set("Cache-Control", `public, max-age=${sec}`));

// ---------- 인증 (허용 계정만) ----------
// 이 API는 Hosting rewrite로 전 세계에 공개되는데 앱 자체는 구글 로그인 + 이메일 화이트리스트다.
// 비용이 큰 경로(리서치 = Gemini·네이버 호출)와 상태를 바꾸는 경로(푸시 등록/발송)는
// Firebase ID 토큰을 요구해서, 캐시 키를 변형해 쿼터를 태우거나 토큰을 무한 등록하는 걸 막는다.
// 조회 전용 프록시(청약·실거래·LH·장기전세·뉴스·config)는 캐시 + Cache-Control로 흡수되므로 공개 유지.
const ALLOWED_EMAILS = () => env("ALLOWED_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function verifyCaller(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.get("authorization") || ""));
  if (!m) { const e = new Error("no_token"); e.code = 401; throw e; }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch { const e = new Error("bad_token"); e.code = 401; throw e; }
  const allow = ALLOWED_EMAILS();
  const email = String(decoded.email || "").toLowerCase();
  // 목록이 비어 있으면(미설정) 로그인만 확인 — 설정돼 있으면 목록 대조까지.
  // email_verified도 요구 — 미인증 이메일 발급 로그인 방식으로 화이트리스트 주소를 사칭하는 우회 차단 (firestore.rules와 동일 기준)
  if (allow.length && (!decoded.email_verified || !allow.includes(email))) { const e = new Error("not_allowed"); e.code = 403; throw e; }
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
async function fetchCheongyakList(key, since, maxPages = 4) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${APPLYHOME_BASE}/getAPTLttotPblancDetail?page=${page}&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) { if (page === 1) { const e = new Error(`upstream_${r.status}`); e.status = r.status; throw e; } break; }
    const raw = await r.json();
    const data = raw.data || [];
    out.push(...data);
    // 조건 일치 건수는 matchCount — totalCount는 데이터셋 전체라 종료 판정에 쓸 수 없다
    const total = Number(raw.matchCount ?? raw.totalCount) || out.length;
    if (!data.length || out.length >= total) break;
    if (page === maxPages) console.warn(`cheongyak_truncated: ${out.length}/${total}건만 읽음`);
  }
  return out;
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
    // 빈 목록은 캐시하지 않는다 — 업스트림이 잠깐 0건을 주면 그 응답이 CDN에 5분 박혀서
    // 새로고침으로도 못 벗어난다(프론트는 빈 목록을 샘플 폴백으로 처리한다).
    if (items.length) {
      cheongyakCache = { at: Date.now(), payload };
      setCache(res, 300, force);
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
// 임의 lawd를 그대로 받으면 요청 1건이 업스트림 12건으로 증폭되므로 이 테이블에 있는 코드만 허용한다.
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

async function fetchMolit(lawd) {
  const KEY = env("MOLIT_KEY") || env("CHEONGYAK_KEY");
  // 일자를 1로 고정해서 계산 — setMonth로 빼면 31일에 "4월 31일"이 5월로 롤오버되어 한 달이 통째로 빠진다
  // 기준월은 KST — 서버 로컬(UTC)로 계산하면 매월 1일 00~09시(KST)에 새 달이 창에서 빠진다
  const base = new Date(Date.now() + 9 * 3600e3);
  const months = [0, 1, 2].map((i) => { const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1)); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
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
const geoSrvCache = new Map(); // q → {lat,lng} — 주소 좌표는 불변. 공개 엔드포인트라 상한을 둔다 (무한 성장 방지)
const GEO_CACHE_MAX = 500;
let lastNominatimAt = 0; // Nominatim 이용정책(1 req/s) 준수 — 인스턴스 단위 최소 간격
async function handleGeocode(res, query) {
  const q = String(query.q || "").trim().slice(0, 120);
  if (!q) return res.status(400).json({ error: "q_required" });
  if (geoSrvCache.has(q)) { setCache(res, 86400); return res.json(geoSrvCache.get(q)); }
  const variants = [q];
  const noJibun = q.replace(/\s+\d[\d-]*\s*$/, "").trim(); // 지번 상세 실패 대비 동 단위 재시도
  if (noJibun && noJibun !== q) variants.push(noJibun);
  let out = null;
  const id = env("NAVER_MAP_KEY"), secret = env("NAVER_MAP_SECRET");
  for (const v of variants) {
    if (out) break;
    if (id && secret) {
      try {
        const r = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(v)}`,
          { headers: { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret }, signal: AbortSignal.timeout(8000) });
        if (r.ok) { const j = await r.json(); const a = j && j.addresses && j.addresses[0]; if (a) { out = { lat: Number(a.y), lng: Number(a.x) }; break; } }
      } catch {}
    }
    try {
      const wait = 1100 - (Date.now() - lastNominatimAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastNominatimAt = Date.now();
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(v)}`,
        { headers: { "User-Agent": "futurePlanner/1.0 (personal dashboard)" }, signal: AbortSignal.timeout(8000) });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j[0]) out = { lat: Number(j[0].lat), lng: Number(j[0].lon) }; }
    } catch {}
  }
  if (!out) { noStore(res); return res.status(404).json({ error: "not_found" }); }
  if (geoSrvCache.size >= GEO_CACHE_MAX) geoSrvCache.delete(geoSrvCache.keys().next().value); // 가장 오래된 항목부터 방출
  geoSrvCache.set(q, out);
  setCache(res, 86400);
  res.json(out);
}

// 매물·실거래 통합: ① 국토부 실거래가(공식) → ② 네이버(비공식, 5초 타임아웃) → ③ 503(프론트 샘플 폴백)
async function handleRealty(res, query) {
  // 지원 지역만 허용 — 임의 lawd를 받으면 요청 1건이 업스트림 12건으로 증폭되어 공용 키 쿼터가 소진된다
  const lawd = LAWD_NAMES[query.lawd] ? String(query.lawd) : "41290";
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
      // 실패도 짧게 캐시 — 안 하면 업스트림 장애·미신청 상태에서 매 요청이 12건 fan-out을 반복한다
      molitCache.set(lawd, { at: Date.now() - 4.5 * 60 * 1000, negative: true, payload: null });
    }
  }
  return handleNaverLand(res, query); // 폴백 (대부분 차단되지만 시도)
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
      if (!name) continue;
      // 당첨자/심사 발표·취소는 결과 안내, 운영기관 모집은 입주자 대상이 아니라 제외
      if (/발표|서류심사|당첨자|취소|운영기관/.test(name)) continue;
      out.push({
        id: `sh-${seq[1]}`, name, agency: "SH", category: "", type: shNoticeType(name), region: "서울특별시",
        postedAt: cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) || "",
        closeAt: "", status: "공고문 확인", // 게시판 목록에는 접수기간이 없다 — 마감 판단은 프론트에서 게시일 기준
        url: `${SH_BRD}/view.do?seq=${seq[1]}`,
      });
    }
  }
  return out;
}
async function handleLhNotices(res, query) {
  // 목록 조회가 최대 10페이지 fan-out이라 force 하한은 넉넉히 (연타 방어)
  const force = isForce(query);
  if (lhCache.payload && Date.now() - lhCache.at < (force ? 3 * 60 * 1000 : 10 * 60 * 1000)) {
    noStore(res); // 이 엔드포인트는 오리진 캐시만 쓴다 — CDN이 끼면 새로고침이 흡수된다
    return res.json(lhCache.payload);
  }
  const [lh, sh] = await Promise.allSettled([fetchLhList(), fetchShNotices()]);
  const items = [], sources = [];
  if (lh.status === "fulfilled") { items.push(...lh.value.map((i) => ({ ...i, agency: "LH" }))); sources.push("LH"); }
  else console.error("lh_failed:", String(lh.reason && lh.reason.message || lh.reason).slice(0, 200));
  if (sh.status === "fulfilled") { items.push(...sh.value); sources.push("SH"); }
  else console.error("sh_notices_failed:", String(sh.reason && sh.reason.message || sh.reason).slice(0, 200));
  noStore(res);
  if (!items.length) {
    const unauthorized = lh.status === "rejected" && lh.reason && lh.reason.code === 503;
    return res.status(unauthorized ? 503 : 502).json({ error: unauthorized ? "unauthorized" : "fetch_failed", message: unauthorized ? "LH 공고 API 활용신청이 필요합니다." : "LH·SH 공고 조회에 모두 실패했어요." });
  }
  items.sort((a, b) => normLooseYmd(b.postedAt).localeCompare(normLooseYmd(a.postedAt))); // LH·SH를 게시일 최신순으로 섞는다
  const warning = lh.status === "rejected" ? "LH 공고를 불러오지 못해 SH 공고만 표시 중이에요."
    : sh.status === "rejected" ? "SH 공고를 불러오지 못해 LH 공고만 표시 중이에요." : undefined;
  const payload = { source: "live", sources, items, warning, fetchedAt: new Date().toISOString() };
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
    res.set("Cache-Control", "public, max-age=600");
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
    res.set("Cache-Control", "public, max-age=600");
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
  // 장기전세주택 공고는 LLM 리서치에서 /api/longlease(SH 게시판 + LH 공식 API)로 교체됐다.
  // LLM은 접수 끝난 공고와 존재하지 않는 단지를 만들어냈고 링크도 목록 페이지로만 갔다.
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
    // e.code가 HTTP 상태코드가 아닐 수 있다 (예: DOMException TimeoutError의 code=23) — 그대로 넣으면 res.status가 던져 500이 된다
    const httpCode = Number.isInteger(e.code) && e.code >= 400 && e.code <= 599 ? e.code : 502;
    res.status(httpCode).json({ error: "research_failed", message: String(e.message || e).slice(0, 300) });
  }
}

// ---------- HTTP 엔트리 (Hosting rewrites: /api/** → api) ----------
exports.api = onRequest({ timeoutSeconds: 300, memory: "512MiB", secrets: SECRETS }, async (req, res) => {
  const p = req.path.replace(/\/+$/, "");
  try { // 핸들러가 던지면 여기서 500을 돌려준다 — 안 잡으면 클라이언트가 Hosting 타임아웃(504)까지 기다린다
    if (p === "/api/cheongyak") return await handleCheongyak(res, req.query);
    if (p === "/api/realty") return await handleRealty(res, req.query);
    if (p === "/api/lh-notices") return await handleLhNotices(res, req.query);
    if (p === "/api/longlease") return await handleLonglease(res, req.query);
    if (p === "/api/naver-land") return await handleNaverLand(res, req.query);
    if (p === "/api/news") return await handleNews(res, req.query);
    if (p === "/api/geocode") return await handleGeocode(res, req.query);
    if (p === "/api/config") return res.json({ naverMapKey: env("NAVER_MAP_KEY"), fcmVapidKey: env("FCM_VAPID_KEY") });
    // --- 아래는 로그인 필요 (비용·상태 변경 경로) ---
    if (p === "/api/push-register" || p === "/api/push-test" || p === "/api/research") {
      await verifyCaller(req);
      if (p === "/api/push-register") return await handlePushRegister(req, res);
      if (p === "/api/push-test") return await handlePushTest(req, res);
      return await handleResearch(res, req.query);
    }
    res.status(404).json({ error: "not_found", path: p });
  } catch (e) {
    const code = e && e.code;
    if (code === 401 || code === 403) {
      return res.status(code).json({ error: code === 401 ? "unauthorized" : "forbidden", message: "허용된 계정으로 로그인해 주세요." });
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
