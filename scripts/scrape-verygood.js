// 베리굿웨딩(verygoodwedding.co.kr) 제휴 업체 수집 — 스튜디오·드레스·헤어메이크업만.
// 결과: dashboard/data/verygood-vendors.json (화면이 fetch로 읽는다). 로컬에서 가끔 한 번 실행한다.
//   node scripts/scrape-verygood.js
// 예의: 요청 사이 1.2초 대기, 동시 요청 없음, 실패 시 1회 재시도. robots.txt는 전체 허용(Allow: /).
// 개인정보(전화번호 등)는 저장하지 않고, 사진은 내려받지 않고 URL만 둔다.
const fs = require("fs");
const path = require("path");

const BASE = "http://verygoodwedding.co.kr/new/collection/";
// 메뉴 확인(2026-09): 스튜디오 = 코드 없음, 드레스 = 71, 헤어&메이크업 = 73 (72&code2=76 스냅·100,402 영상·74 부케는 수집 안 함)
const KINDS = [["studio", ""], ["dress", "71"], ["makeup", "73"]];
const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
};
const OUT = path.join(__dirname, "..", "dashboard", "data", "verygood-vendors.json");
const IMG_BASE = "http://vgwed.kr/admin/contentsImg/client/";

let requests = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 헤더는 UTF-8이라지만 EUC-KR 페이지가 섞일 수 있다 — UTF-8로 안 풀리면 EUC-KR
const decode = (buf) => { try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("euc-kr").decode(buf); } };
async function get(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(1200);
    requests++;
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
      if (r.ok) return decode(Buffer.from(await r.arrayBuffer()));
      console.warn(`  ${r.status} ${url}`);
    } catch (e) { console.warn(`  실패 ${url}: ${e.message}`); }
  }
  return null;
}

const text = (html) => String(html || "").replace(/\s*\n\s*/g, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;?/g, "\"").replace(/&#0?39;?/g, "'")
  .split("\n").map((s) => s.replace(/\s+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
// 전화번호·이메일은 지운다 (개인정보·연락처 수집 안 함)
const scrub = (s) => s.replace(/0\d{1,2}[-.\s)]*\d{3,4}[-.\s]*\d{4}/g, "").replace(/\b1[5-9]\d{2}[-.\s]?\d{4}\b/g, "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "").replace(/[ \t]{2,}/g, " ").trim();
const abs = (u) => { try { return new URL(u, BASE).href; } catch { return ""; } };
const rel = (u) => (u.startsWith(IMG_BASE) ? u.slice(IMG_BASE.length) : u); // 용량 절약 — 공통 앞부분은 imgBase로

function parseList(html) {
  return [...html.matchAll(/<a href="(collection_detail\.asp\?cIdx=(\d+)[^"]*)"[^>]*class="collection_list_link">([\s\S]*?)<\/a>/g)].map((m) => ({
    id: m[2], detail: abs(m[1].replace(/&amp;/g, "&")),
    img: abs(((/<img src="([^"]+)"/.exec(m[3]) || [])[1]) || ""),
    name: text(((/collection_list_title">([\s\S]*?)<\/div>/.exec(m[3]) || [])[1]) || ""),
  }));
}
function parseDetail(html) {
  const track = (/collection_gallery_track">([\s\S]*?)<\/div>/.exec(html) || [])[1] || (/collection_gallery_wrap">([\s\S]*?)collection_other_list_warp/.exec(html) || [])[1] || "";
  const photos = [...new Set([...track.matchAll(/<img src="([^"]+)"/g)].map((m) => abs(m[1])).filter((u) => /contentsImg/.test(u)))];
  const intro = scrub(text((/hotpoint_inner"[^>]*>([\s\S]*?)<\/div>/.exec(html) || [])[1] || "")).slice(0, 1200);
  const lat = Number((/map_lat\s*=\s*"?([\d.]+)/.exec(html) || /\blat\s*=\s*"([\d.]+)"/.exec(html) || [])[1]);
  const lng = Number((/map_lng\s*=\s*"?([\d.]+)/.exec(html) || /\blng\s*=\s*"([\d.]+)"/.exec(html) || [])[1]);
  const title = text((/class="sub_title">([\s\S]*?)<\/div>/.exec(html) || [])[1] || "");
  return { title, intro, photos, ...(lat > 30 && lat < 40 && lng > 120 && lng < 135 ? { lat, lng } : {}) };
}

(async () => {
  const at = new Date().toISOString();
  const vendors = [];
  for (const [kind, code] of KINDS) {
    const seen = new Set();
    const list = [];
    for (let page = 1; page < 100; page++) {
      const url = `${BASE}collection_list.asp?${code ? `code=${code}&` : ""}gotopage=${page}`;
      const html = await get(url);
      if (!html) { console.warn(`${kind} ${page}쪽 실패 — 여기까지만`); break; }
      if (page === 1) console.log(`${kind}: 페이지 제목 "${text((/sub-title-b">([\s\S]*?)<\/div>/.exec(html) || [])[1] || "").replace(/\s+/g, " ")}"`);
      const items = parseList(html).filter((x) => !seen.has(x.id) && seen.add(x.id));
      if (!items.length) break; // 마지막 쪽을 넘기면 같은 목록이 오거나 비어 있다
      list.push(...items);
      const last = Math.max(page, ...[...html.matchAll(/data="(\d+)"/g)].map((m) => Number(m[1])));
      console.log(`  ${kind} ${page}/${last}쪽 ${items.length}곳`);
      if (page >= last) break;
    }
    for (const it of list) {
      const html = await get(it.detail);
      const d = html ? parseDetail(html) : { photos: [] };
      vendors.push({ id: `vg-${kind}-${it.id}`, kind, name: it.name || d.title, intro: d.intro || "", img: rel(it.img), photos: d.photos.map(rel),
        url: it.detail.replace(/&gotopage=[^&]*|&keyword=[^&]*|&code2=(?=&|$)/g, ""), ...(d.lat ? { lat: d.lat, lng: d.lng } : {}) });
      process.stdout.write(`\r  ${kind} 상세 ${vendors.filter((v) => v.kind === kind).length}/${list.length}   `);
    }
    console.log("");
  }
  const photoN = vendors.reduce((s, v) => s + v.photos.length, 0);
  fs.writeFileSync(OUT, JSON.stringify({ source: "verygoodwedding.co.kr", at, imgBase: IMG_BASE, vendors }));
  console.log(`저장: ${OUT} — 업체 ${vendors.length}곳 (${KINDS.map(([k]) => `${k} ${vendors.filter((v) => v.kind === k).length}`).join(", ")}), 사진 ${photoN}장, 요청 ${requests}건`);
})();
