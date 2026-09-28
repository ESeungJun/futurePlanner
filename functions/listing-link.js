/*
 * 네이버 부동산 매물 링크 → 매물 정보. (관심 매물 카드의 빈 칸을 채운다)
 *
 * - naver.me 단축 링크는 fin.land.naver.com 지도 주소로 리다이렉트된다. 지도 주소의 layer 파라미터(lz-string 압축 JSON)에
 *   선택한 매물(article_detail.articleId)이 들어 있다. /articles/{id} 주소면 바로 쓴다.
 * - 매물 페이지(fin.land.naver.com/articles/{id})는 모바일 UA로 받으면 서버 렌더링 HTML 안에 react-query 상태(JSON)가 실려 온다.
 *   정해진 키(priceInfo·spaceInfo·sizeInfo 등)를 정규식으로 뽑는다 — 사이트가 바뀌면 조용히 빈 값이 된다(없는 값은 지어내지 않는다).
 * - SSRF 방지: 허용한 네이버 호스트만 요청하고, 리다이렉트도 한 번씩 직접 따라가며 호스트를 다시 검사한다.
 */
const LZ = require("lz-string");

const ALLOWED = new Set(["naver.me", "fin.land.naver.com", "new.land.naver.com", "m.land.naver.com", "land.naver.com"]);
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const TRADE = { A1: "매매", B1: "전세", B2: "월세", B3: "월세" };
const BLDG = { A01: "아파트", A02: "오피스텔", A06: "빌라", A07: "빌라", C02: "빌라", C01: "단독·다가구", C03: "단독·다가구" };

function allowedUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" && ALLOWED.has(x.hostname) ? x : null; } catch { return null; }
}

// 단축 링크 → 최종 주소 (최대 3번, 매 단계 호스트 검사)
async function resolveUrl(url) {
  let cur = allowedUrl(url);
  for (let i = 0; cur && i < 3; i++) {
    if (cur.hostname !== "naver.me") return cur;
    const r = await fetch(cur.href, { redirect: "manual", headers: { "User-Agent": MOBILE_UA }, signal: AbortSignal.timeout(8000) });
    const loc = r.headers.get("location");
    if (!loc) return null;
    cur = allowedUrl(new URL(loc, cur.href).href);
  }
  return cur;
}

function articleIdOf(u) {
  const m = /\/articles?\/(\d{6,})/.exec(u.pathname) || /\/article\/info\/(\d{6,})/.exec(u.pathname);
  if (m) return m[1];
  for (const k of ["articleId", "articleNo", "articleNumber"]) { const v = u.searchParams.get(k); if (/^\d{6,}$/.test(v || "")) return v; }
  const layer = u.searchParams.get("layer");
  if (layer) {
    try {
      const arr = JSON.parse(LZ.decompressFromEncodedURIComponent(layer) || "[]");
      const art = (Array.isArray(arr) ? arr : []).reverse().find((x) => x && x.id === "article_detail" && x.params && /^\d{6,}$/.test(String(x.params.articleId)));
      if (art) return String(art.params.articleId);
    } catch {}
  }
  return null;
}

// "key":값 첫 등장 (문자열이면 따옴표 안, 아니면 숫자·불리언)
const pick = (h, key) => { const m = new RegExp(`"${key}":(?:"([^"]*)"|(-?[\\d.]+|true|false))`).exec(h); return m ? (m[1] !== undefined ? m[1] : m[2]) : undefined; };
const pickIn = (h, anchor, key) => { const i = h.indexOf(`"${anchor}"`); return i < 0 ? undefined : pick(h.slice(i, i + 4000), key); };
const numOr = (v) => (v === undefined || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

function parseArticle(html) {
  const h = html.replace(/\\"/g, '"').replace(/\\\\n/g, "\n");
  const og = (p) => { const m = new RegExp(`<meta property="og:${p}" content="([^"]*)"`).exec(html); return m ? m[1] : ""; };
  const trade = pickIn(h, "priceInfo", "tradeType");
  const dealType = TRADE[trade];
  const warranty = numOr(pickIn(h, "priceInfo", "warrantyAmount")), rent = numOr(pickIn(h, "priceInfo", "rentAmount"));
  const deal = numOr(pickIn(h, "priceInfo", "dealAmount")) ?? numOr(pickIn(h, "priceInfo", "dealPrice"));
  const loan = numOr(pickIn(h, "priceInfo", "loan"));
  const region = pick(h, "regionName") || pick(h, "fullAddress") || "";
  const jibun = pickIn(h, "address", "jibun");
  const exposedJibun = pick(h, "isJibunAddressExposed") !== "false";
  const target = pickIn(h, "floorInfo", "targetFloor"), total = pickIn(h, "floorInfo", "totalFloor");
  const conj = pick(h, "buildingConjunctionDate");
  const rooms = pick(h, "roomCount"), baths = pick(h, "bathRoomCount");
  const maint = (() => { const i = h.indexOf('"fixDetailList"'); if (i < 0) return undefined; const m = /"type":"01","unitType":"01","amount":(\d+)/.exec(h.slice(i, i + 1500)); return m ? Number(m[1]) : undefined; })();
  const moveDate = pick(h, "movingInDate"), moveNeg = pick(h, "movingInNegotiation") === "true";
  const illegal = pick(h, "isIllegalBuilding"), hugSafe = pick(h, "isSafeLessorOfHug");
  const x = numOr(pickIn(h, "detailInfo", "xCoordinate")) ?? numOr(pick(h, "xCoordinate")), y = numOr(pickIn(h, "detailInfo", "yCoordinate")) ?? numOr(pick(h, "yCoordinate"));
  const reType = pickIn(h, "articleDetailInfo", "realEstateType") || pick(h, "realEstateType");
  const feature = pick(h, "articleFeatureDescription") || "";
  const desc = (pick(h, "articleDescription") || "").slice(0, 600);
  const out = {
    title: pick(h, "complexName") || og("title") || undefined,
    addr: (region + (jibun && exposedJibun ? ` ${jibun}` : "")).trim() || undefined,
    dealType,
    price: dealType === "매매" ? deal : warranty,
    rent: dealType === "월세" ? rent : undefined,
    area: numOr(pick(h, "exclusiveSpace")),
    floor: target ? `${target}/${total || "?"}층` : undefined,
    built: conj && /^\d{4}/.test(conj) ? Number(conj.slice(0, 4)) : undefined,
    bldg: BLDG[reType] || (/아파트/.test(og("title")) ? "아파트" : /오피스텔/.test(og("title")) ? "오피스텔" : /빌라|다세대|연립/.test(og("title")) ? "빌라" : undefined),
    maintenance: maint,
    rooms: rooms ? `${rooms}/${baths || "?"}` : undefined,
    moveIn: moveDate ? `${moveDate}${moveNeg ? " (협의 가능)" : ""}` : moveNeg ? "협의" : undefined,
    options: [feature, hugSafe === "true" ? "HUG 안심임대인" : ""].filter(Boolean).join(" · ") || undefined,
    broker: pick(h, "brokerageName") || undefined,
    violation: illegal === "true" ? "있음" : illegal === "false" ? "없음" : undefined,
    seniorDebt: loan > 0 ? loan : undefined, // 매물에 표시된 융자금 — 등기부 채권최고액과 다를 수 있다
    lat: y, lng: x,
    description: desc || undefined,
  };
  Object.keys(out).forEach((k) => { if (out[k] === undefined || out[k] === "" || Number.isNaN(out[k])) delete out[k]; });
  return out;
}

async function fetchListingFromLink(url) {
  const u = await resolveUrl(url);
  if (!u) return { error: "unsupported", message: "네이버 부동산 링크만 읽을 수 있어요." };
  const id = articleIdOf(u);
  if (!id) return { error: "no_article", message: "매물 한 건을 가리키는 링크가 아니에요 — 지도에서 매물을 눌러 연 뒤 공유 링크를 붙여넣어 주세요." };
  const r = await fetch(`https://fin.land.naver.com/articles/${id}`, { headers: { "User-Agent": MOBILE_UA, "Accept-Language": "ko-KR" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) return { error: "fetch_failed", message: `매물 페이지를 열지 못했어요 (${r.status}) — 잠시 후 다시 시도해 주세요.` };
  const fields = parseArticle(await r.text());
  if (!fields.price && !fields.area) return { error: "parse_failed", message: "매물 정보를 읽지 못했어요 — 내려간 매물이거나 페이지 형식이 바뀌었을 수 있어요.", articleId: id };
  return { articleId: id, url: `https://fin.land.naver.com/articles/${id}`, fields };
}

module.exports = { fetchListingFromLink, parseArticle, articleIdOf, allowedUrl };
