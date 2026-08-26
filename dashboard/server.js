/*
 * 선택적 프록시 + 정적 서버 (의존성 없음, Node 18+)
 *
 *   node server.js            → http://localhost:5173
 *
 * ⚠️ 프로덕션(functions/index.js)과의 의도된 차이: /api/research·/api/push-* 는 프로덕션에서
 *    Firebase ID 토큰 + 허용 이메일을 검증한다(ALLOWED_EMAILS). 이 개발 서버는 admin SDK가
 *    없어 검증을 생략하므로 localhost 전용으로만 쓸 것 — 외부에 노출하지 말 것.
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

// 새로고침 버튼(force=1)은 메모리 캐시를 건너뛴다 — 배포판(functions/index.js)과 동작을 맞춘다.
// 단 연타로 업스트림을 두드리지 않게 최소 간격은 캐시를 준다.
const isForce = (query) => (query ? query.get("force") === "1" : false);
const FORCE_FLOOR_MS = 60 * 1000;

// --- 청약홈 APT 분양정보 (공공데이터포털 ApplyhomeInfoDetailSvc/v1) ---
// 공고 상세(getAPTLttotPblancDetail) + 주택형별(getAPTLttotPblancMdl)을 조합해
// 평형·분양가·특공(신혼/생애최초/신생아) 세대수까지 정규화한다.
const APPLYHOME_BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
let cheongyakCache = { at: 0, payload: null }; // 일일 호출량 보호용 캐시 (5분)

function ymToDash(ym) { // "202906" → "2029-06"
  const s = String(ym || "");
  return /^\d{6}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4)}` : (s || null);
}

// 전국 공고는 6개월치가 100건을 넘는다 — matchCount를 보고 필요한 페이지까지 이어 읽는다 (functions/index.js와 동일)
async function fetchCheongyakList(key, since, maxPages = 4, path = "getAPTLttotPblancDetail") {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${APPLYHOME_BASE}/${path}?page=${page}&perPage=100&cond[RCRIT_PBLANC_DE::GTE]=${since}&${key}`;
    let r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (r.status === 429) { // odcloud 순간 요청 제한 — 잠깐 쉬고 한 번만 재시도
      await new Promise((s) => setTimeout(s, 1500));
      r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    }
    if (!r.ok) { if (page === 1) { const e = new Error(`upstream_${r.status}`); e.status = r.status; throw e; } break; }
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

// --- APT 무순위/취소후재공급 (줍줍) — 같은 서비스의 별도 엔드포인트, 같은 키 ---
// 접수기간 필드가 일반 분양(RCEPT_*)과 다르게 SUBSCRPT_RCEPT_*로 오는 케이스가 있어 둘 다 본다.
// 목록 조회는 주택형(Mdl) 조회 폭주 전에 먼저 한다 — odcloud 순간 요청 제한(429)에 걸리면 목록째 날아간다.
async function fetchRemndrList(key, since) {
  // 전국 6개월치가 200건을 넘을 수 있고 API 정렬이 최신순 보장이 아니다 — 3페이지까지 읽어 최신 누락을 줄인다
  return (await fetchCheongyakList(key, since, 3, "getRemndrLttotPblancDetail"))
    .sort((a, b) => String(b.RCRIT_PBLANC_DE || "").localeCompare(String(a.RCRIT_PBLANC_DE || ""))).slice(0, 30);
}
async function mapRemndr(key, list) {
  const models = await mapLimit(list, 8, (d) =>
    fetch(`${APPLYHOME_BASE}/getRemndrLttotPblancMdl?page=1&perPage=50&cond[HOUSE_MANAGE_NO::EQ]=${encodeURIComponent(d.HOUSE_MANAGE_NO)}&cond[PBLANC_NO::EQ]=${encodeURIComponent(d.PBLANC_NO)}&${key}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) })
      .then((mr) => (mr.ok ? mr.json() : { data: [] })).catch(() => ({ data: [] })));
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
  if (!CHEONGYAK_KEY) return sendJSON(res, 503, { error: "no_key", message: "CHEONGYAK_KEY 미설정 — 샘플데이터를 사용하세요." });
  if (cheongyakCache.payload && Date.now() - cheongyakCache.at < (isForce(query) ? FORCE_FLOOR_MS : 5 * 60 * 1000)) {
    return sendJSON(res, 200, cheongyakCache.payload);
  }
  try {
    const key = `serviceKey=${encodeURIComponent(CHEONGYAK_KEY)}`;
    // 최근 6개월 모집공고만
    const since = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10);
    const all = await fetchCheongyakList(key, since);
    // 최신 공고가 잘려나가지 않도록 공고일 내림차순으로 정렬한 뒤 자른다
    const list = all.sort((a, b) => String(b.RCRIT_PBLANC_DE || "").localeCompare(String(a.RCRIT_PBLANC_DE || ""))).slice(0, 60);

    // 무순위 목록은 주택형 조회 폭주 전에 먼저 받아둔다 (odcloud 순간 요청 제한 429 회피)
    let remndrList = [];
    try { remndrList = await fetchRemndrList(key, since); }
    catch (e) { console.error("remndr_failed:", String(e.message || e).slice(0, 150)); }

    // 공고별 주택형(평형·분양가·특공 세대수) 조회 — 동시 8건 제한 (전체 병렬은 429를 부른다)
    const models = await mapLimit(list, 8, (d) =>
      fetch(`${APPLYHOME_BASE}/getAPTLttotPblancMdl?page=1&perPage=50&cond[HOUSE_MANAGE_NO::EQ]=${encodeURIComponent(d.HOUSE_MANAGE_NO)}&cond[PBLANC_NO::EQ]=${encodeURIComponent(d.PBLANC_NO)}&${key}`,
        { headers: { Accept: "application/json" } })
        .then((mr) => (mr.ok ? mr.json() : { data: [] }))
        .catch(() => ({ data: [] })));

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
        priceCap: d.PARCPRC_ULS_AT === "Y", // 분양가상한제
        lat: null, lng: null, // 좌표 미제공 API — 지도 마커는 샘플/직접 입력만
        url: d.PBLANC_URL || "https://www.applyhome.co.kr",
      };
    });

    // 무순위(줍줍)도 합친다 — 실패해도 일반 분양 목록은 그대로 낸다
    let remndr = [];
    try { remndr = await mapRemndr(key, remndrList); }
    catch (e) { console.error("remndr_mdl_failed:", String(e.message || e).slice(0, 150)); }
    const merged = [...items, ...remndr].sort((a, b) => (b.applyStart || "").localeCompare(a.applyStart || ""));

    const payload = { source: "live", items: merged, fetchedAt: new Date().toISOString() };
    // 일반 분양이 비면 캐시하지 않는다 — 무순위만 담긴 응답을 캐시하면 일시적 0건이 TTL 동안 박제된다
    if (items.length) cheongyakCache = { at: Date.now(), payload };
    sendJSON(res, 200, payload);
  } catch (e) {
    sendJSON(res, 502, { error: "fetch_failed", message: String(e) });
  }
}

// --- 국토부 아파트 실거래가 (매매+전월세) — data.go.kr 공식 API ---
// 네이버 비공식 API가 봇 차단(429/행)으로 사실상 막혀서 공식 실거래가로 전환.
// 키는 data.go.kr 계정 공용(MOLIT_KEY 없으면 CHEONGYAK_KEY 재사용) — 두 실거래가 API 활용신청 필요.
const MOLIT_KEY = process.env.MOLIT_KEY || CHEONGYAK_KEY;
// 수도권 시/군/구 — functions/index.js LAWD_NAMES와 같이 관리 (한쪽만 갱신하면 로컬 개발에서 그 지역이 조용히 과천으로 폴백된다)
const LAWD_NAMES = {
  11110: "서울특별시 종로구", 11140: "서울특별시 중구", 11170: "서울특별시 용산구", 11200: "서울특별시 성동구",
  11215: "서울특별시 광진구", 11230: "서울특별시 동대문구", 11260: "서울특별시 중랑구", 11290: "서울특별시 성북구",
  11305: "서울특별시 강북구", 11320: "서울특별시 도봉구", 11350: "서울특별시 노원구", 11380: "서울특별시 은평구",
  11410: "서울특별시 서대문구", 11440: "서울특별시 마포구", 11470: "서울특별시 양천구", 11500: "서울특별시 강서구",
  11530: "서울특별시 구로구", 11545: "서울특별시 금천구", 11560: "서울특별시 영등포구", 11590: "서울특별시 동작구",
  11620: "서울특별시 관악구", 11650: "서울특별시 서초구", 11680: "서울특별시 강남구", 11710: "서울특별시 송파구",
  11740: "서울특별시 강동구",
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
  28110: "인천광역시 중구", 28140: "인천광역시 동구", 28177: "인천광역시 미추홀구", 28185: "인천광역시 연수구",
  28200: "인천광역시 남동구", 28237: "인천광역시 부평구", 28245: "인천광역시 계양구", 28260: "인천광역시 서구",
  28710: "인천광역시 강화군", 28720: "인천광역시 옹진군",
};
let molitCache = { key: "", at: 0, payload: null }; // 5분 메모리 캐시
const xmlPick = (block, ...tags) => {
  for (const t of tags) { const m = block.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); if (m) return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(); }
  return "";
};
const molitNum = (s) => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

async function fetchMolit(lawd) {
  // 일자를 1로 고정 — setMonth로 빼면 31일에 롤오버가 나서 한 달이 통째로 빠진다. 기준월은 KST 고정(머신 타임존 무관)
  const nowM = new Date(Date.now() + 9 * 3600e3);
  const months = [0, 1, 2].map((i) => { const d = new Date(Date.UTC(nowM.getUTCFullYear(), nowM.getUTCMonth() - i, 1)); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
  const key = encodeURIComponent(MOLIT_KEY);
  const reqs = [];
  for (const ym of months) {
    reqs.push(["trade", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    reqs.push(["rent", "apt", `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    // 빌라(연립·다세대) 매매·전월세
    reqs.push(["trade", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    reqs.push(["rent", "villa", `https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    // 오피스텔 매매·전월세 — 별도 활용신청 필요(키 공용), 미신청이면 조용히 건너뛴다
    reqs.push(["trade", "offi", `https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
    reqs.push(["rent", "offi", `https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent?serviceKey=${key}&LAWD_CD=${lawd}&DEAL_YMD=${ym}&numOfRows=300`]);
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

// 매물·실거래 통합: ① 국토부 실거래가(공식) → ② 네이버(비공식, 5초 타임아웃) → ③ 503(프론트 샘플 폴백)
async function handleRealty(res, query) {
  const lawd = LAWD_NAMES[query.get("lawd")] ? String(query.get("lawd")) : "41290"; // 지원 지역만 (요청 1건 = 업스트림 12건)
  if (molitCache.payload && molitCache.key === lawd && Date.now() - molitCache.at < (isForce(query) ? FORCE_FLOOR_MS : 5 * 60 * 1000)) {
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
async function fetchLhList() { // 공고 목록 — 미신청/오류 시 throw (code 503)
  const KEY = process.env.LH_KEY || CHEONGYAK_KEY;
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
    category: d.UPP_AIS_TP_NM || "", // 임대주택/분양주택 등 대분류
    type: d.AIS_TP_CD_NM || "",      // 행복주택/국민임대/공공분양 등
    region: d.CNP_CD_NM || "",
    postedAt: d.PAN_NT_ST_DT || "",
    closeAt: d.CLSG_DT || "",
    status: d.PAN_SS || "",          // 공고 상태 (접수중 등)
    url: d.DTL_URL || "",
  })).filter((x) => x.name && !/토지|상가|점포|주차|용지|사무|근생/.test(`${x.category} ${x.type}`)); // 주택 공고만
}
// --- SH 분양·임대 모집공고 — 공식 API가 없어 SH 청약시스템 공고 게시판을 파싱한다 (장기전세 파싱과 같은 게시판, isRecrnoti=Y가 모집공고 필터) ---
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
// --- 청년안심주택 접수기간 보강 (서울시 포털 soco.seoul.go.kr) ---
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
  return ((await r.json()).resultList || []).map((x) => ({
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
    return await r.text();
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
  // 부분 실패(한쪽 소스 누락) 응답은 2분만 캐시 — 소스가 복구됐는데 10분씩 빠져 보이지 않게
  const ttl = lhCache.payload && lhCache.payload.sources.length < 2 ? 2 * 60 * 1000 : (isForce(query) ? 3 * 60 * 1000 : 10 * 60 * 1000);
  if (lhCache.payload && Date.now() - lhCache.at < ttl) return sendJSON(res, 200, lhCache.payload);
  const [lh, sh] = await Promise.allSettled([fetchLhList(), fetchShNotices()]);
  const ok = (r) => r.status === "fulfilled" && r.value.length > 0; // 0건 응답도 실패로 취급 (빈 목록 박제 방지)
  const why = (r) => String(r.status === "rejected" ? (r.reason && r.reason.message) || r.reason : "empty").slice(0, 200);
  const items = [], sources = [];
  if (ok(lh)) { items.push(...lh.value.map((i) => ({ ...i, agency: "LH" }))); sources.push("LH"); }
  else console.error("lh_failed:", why(lh));
  if (ok(sh)) { items.push(...sh.value); sources.push("SH"); }
  else console.error("sh_notices_failed:", why(sh));
  const lhUnauthorized = lh.status === "rejected" && lh.reason && lh.reason.code === 503;
  if (!items.length) {
    return sendJSON(res, lhUnauthorized ? 503 : 502, { error: lhUnauthorized ? "unauthorized" : "fetch_failed", message: lhUnauthorized ? lh.reason.message : "LH·SH 공고 조회에 모두 실패했어요." });
  }
  items.sort((a, b) => normLooseYmd(b.postedAt).localeCompare(normLooseYmd(a.postedAt))); // LH·SH를 게시일 최신순으로 섞는다
  const warning = !ok(lh) ? "LH 공고를 불러오지 못해 SH 공고만 표시 중이에요."
    : !ok(sh) ? "SH 공고를 불러오지 못해 LH 공고만 표시 중이에요." : undefined;
  // lhError: 키 미신청(503)이면 프론트가 활용신청 안내를 띄울 수 있게 사유를 함께 준다
  const payload = { source: "live", sources, items, warning, lhError: lhUnauthorized ? "unauthorized" : undefined, fetchedAt: new Date().toISOString() };
  lhCache = { at: Date.now(), payload };
  sendJSON(res, 200, payload);
}

// --- 장기전세 공고 (SH 게시판 파싱 + LH 전세형) — functions/index.js와 동일 동작 ---
// SH 장기전세는 실시간 공고 API가 없어 청약시스템 게시판을 파싱한다 (splyTy=03 장기전세, isRecrnoti=Y 모집공고)
const SH_BRD = "https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/brd/m_247";
let longleaseCache = { at: 0, payload: null };
// LH closeAt은 "2026.08.05" / "2026.7.5" 등 형식이 섞여 온다 — 비교 전에 정규화
const normLooseYmd = (v) => { const m = String(v || "").match(/(20\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/); return m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : ""; };
const shTxt = (x) => String(x || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
async function fetchShLonglease() {
  const r = await fetch(`${SH_BRD}/list.do?splyTy=03&isRecrnoti=Y&page=1`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) { const e = new Error("sh_upstream_" + r.status); e.code = 502; throw e; }
  const html = await r.text();
  const out = [];
  for (const row of html.split(/<tr[^>]*>/).slice(1)) {
    const seq = row.match(/getDetailView\('(\d+)'\)/);
    if (!seq) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => shTxt(m[1]));
    const name = cells[1] || "";
    if (!name || /발표|서류심사|당첨자|취소|정정/.test(name)) continue;
    out.push({
      id: `sh-${seq[1]}`, name, agency: "SH 서울주택도시공사", region: "서울",
      postedAt: cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)) || "",
      url: `${SH_BRD}/view.do?seq=${seq[1]}`,
      kind: /미리내집|장기전세주택2|장기전세주택Ⅱ/.test(name) ? "장기전세Ⅱ(미리내집)" : "장기전세(시프트)",
      supply: null, closeAt: null, status: "공고문 확인",
    });
  }
  // 15개월 넘은 공고는 제외 — SH 모집공고는 부정기적이라 남겨두면 몇 년 전 공고가 목록을 채운다
  const cut = kstYmd(Date.now() - 460 * 86400e3);
  return out.filter((x) => !x.postedAt || x.postedAt >= cut);
}
async function handleLonglease(res, query) {
  if (longleaseCache.payload && Date.now() - longleaseCache.at < (isForce(query) ? 5 * 60 * 1000 : 30 * 60 * 1000)) return sendJSON(res, 200, longleaseCache.payload);
  const items = [], sources = [];
  try { items.push(...await fetchShLonglease()); sources.push("SH"); }
  catch (e) { console.error("longlease_sh_failed:", String(e.message || e).slice(0, 150)); }
  try {
    const lh = (await fetchLhList()).filter((i) => /전세/.test(`${i.name} ${i.type}`) && /서울|경기|인천/.test(i.region));
    items.push(...lh.map((i) => ({
      id: `lh-${i.id}`, name: i.name, agency: "LH 한국토지주택공사", region: i.region,
      postedAt: i.postedAt, closeAt: i.closeAt, status: i.status, supply: null, url: i.url, kind: "LH 전세형",
    })));
    sources.push("LH");
  } catch (e) { console.error("longlease_lh_failed:", String(e.message || e).slice(0, 150)); }
  if (!items.length) return sendJSON(res, 502, { error: "fetch_failed", message: "공고 조회에 실패했어요. 공식 사이트에서 확인해 주세요." });
  // 접수 중인 공고를 맨 위로 — 지난 공고만 먼저 보이면 "다 지난 것들" 인상을 준다
  const openRank = (x) => (x.closeAt && normLooseYmd(x.closeAt) >= kstYmd() ? 0 : 1);
  items.sort((a, b) => openRank(a) - openRank(b) || String(b.postedAt || "").localeCompare(String(a.postedAt || "")));
  const payload = { source: "live", sources, today: kstYmd(), items, fetchedAt: new Date().toISOString() };
  longleaseCache = { at: Date.now(), payload };
  sendJSON(res, 200, payload);
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
    const r = await fetch(`${FSS_BASE}/mortgageLoanProductsSearch.json?auth=${encodeURIComponent(FSS_KEY)}&topFinGrpNo=020000&pageNo=${page}`, { signal: AbortSignal.timeout(12000) });
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

// 함수/서버 TZ와 무관하게 KST 기준일 — UTC로 두면 프롬프트의 "오늘"이 하루 밀린다
const kstYmd = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const today = () => kstYmd();
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
  // 장기전세 공고는 LLM이 아니라 /api/longlease(SH 게시판 + LH 공식 API)를 쓴다 — functions/index.js와 동일
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
    const r = await fetch(url, { headers: naverApiHeaders(), signal: AbortSignal.timeout(8000) });
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
  // hasOwnProperty로 검사 — RESEARCH_TOPICS[topic]만 보면 "__proto__"·"constructor"가 통과한다
  if (!Object.prototype.hasOwnProperty.call(RESEARCH_TOPICS, topic)) {
    return sendJSON(res, 400, { error: "unknown_topic", topics: Object.keys(RESEARCH_TOPICS) });
  }
  const t = RESEARCH_TOPICS[topic];
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
    const pubDt = pub ? new Date(pub) : null; // 날짜 하나가 깨져도 피드 전체를 버리지 않게 가드
    const pubIso = pubDt && !isNaN(+pubDt) ? pubDt.toISOString() : null;
    items.push({
      title: src && rawTitle.endsWith(" - " + src) ? rawTitle.slice(0, -(" - " + src).length) : rawTitle,
      desc: "",
      link: stripTags(pick("link")),
      date: pubIso ? pubIso.slice(0, 10) : null,
      ts: pubIso, // 발행 시각 — 최신순 정렬용
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
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("forbidden"); } // 접두사만 검사하면 형제 디렉토리(예: dashboard-evil)가 통과함
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
  if (u.pathname === "/api/cheongyak") return handleCheongyak(res, u.searchParams);
  if (u.pathname === "/api/realty") return handleRealty(res, u.searchParams);
  if (u.pathname === "/api/lh-notices") return handleLhNotices(res, u.searchParams);
  if (u.pathname === "/api/longlease") return handleLonglease(res, u.searchParams);
  if (u.pathname === "/api/push-register" || u.pathname === "/api/push-test") return sendJSON(res, 501, { error: "local_unsupported", message: "푸시 알림은 배포된 사이트(Firebase)에서만 동작해요." });
  if (u.pathname === "/api/naver-land") return handleNaverLand(res, u.searchParams);
  if (u.pathname === "/api/news") return handleNews(res, u.searchParams);
  if (u.pathname === "/api/config") return handleConfig(res);
  if (u.pathname === "/api/research") return handleResearch(res, u.searchParams);
  serveStatic(req, res);
}).listen(PORT, "127.0.0.1", () => { // 루프백 전용 — CORS *에 무인증이라 LAN에 노출되면 아무나 리서치 쿼터를 태울 수 있다
  console.log(`\n  대시보드: http://localhost:${PORT}`);
  console.log(`  청약 실데이터: ${CHEONGYAK_KEY ? "활성(CHEONGYAK_KEY 감지)" : "비활성(샘플 폴백) — CHEONGYAK_KEY 설정 시 활성화"}`);
  console.log(`  네이버 매물: 프록시 경유(비공식). 차단 시 샘플 폴백`);
  console.log(`  뉴스: 구글뉴스 RSS (키 불필요)`);
  console.log(`  네이버 지도: ${process.env.NAVER_MAP_KEY ? "활성(NAVER_MAP_KEY 감지)" : "미설정 — 화면 ⚙️ 설정 입력 또는 NAVER_MAP_KEY 설정"}`);
  console.log(`  은행 금리(금감원 공시): ${FSS_KEY ? "활성(FSS_KEY 감지)" : "미설정 — Claude 리서치로 폴백"}`);
  console.log(`  실시간 리서치(식장/스드메/정책): ${GEMINI_API_KEY ? `활성 — Gemini ${GEMINI_MODELS[0]} (무료 티어)` : "비활성 — GEMINI_API_KEY(무료, aistudio.google.com/apikey) 설정 시 활성화"}`);
  console.log(`  업체 실존 검증(네이버 지역검색): ${NAVER_SEARCH_ID && NAVER_SEARCH_SECRET ? "활성" : "미설정 — developers.naver.com에서 검색 API 키 발급 시 활성화 (권장)"}\n`);
});
