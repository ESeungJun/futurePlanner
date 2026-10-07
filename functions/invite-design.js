/*
 * 청첩장 시안 에이전트 — 부부가 고른 레퍼런스 사진·대화로 모바일/종이 청첩장 HTML 시안을 만들고 고친다.
 * 결과 HTML 은 자리표시({{groom}}·{{photo1}} 등)를 쓰고, 앱이 정보·사진을 채워 미리보기·공개 링크로 보여 준다.
 * 출력은 스크립트 없는 HTML 조각만 — sanitizeInviteHtml 로 한 번 더 걸러 저장·공개한다.
 */

const TOKENS = {
  groom: "신랑 이름", bride: "신부 이름",
  groomFather: "신랑 아버지", groomMother: "신랑 어머니", brideFather: "신부 아버지", brideMother: "신부 어머니",
  groomOrder: "신랑 서열(예: 장남)", brideOrder: "신부 서열(예: 차녀)",
  date: "예식 날짜(예: 2027년 5월 22일 토요일)", time: "예식 시간(예: 오후 1시)",
  venue: "예식장 이름", hall: "홀 이름", address: "예식장 주소", transport: "교통·주차 안내",
  greeting: "혼주용 인사말(혼주 명의, 여러 줄)", friendGreeting: "친구용 인사말(두 사람 명의, 여러 줄)",
  groomAccount: "신랑측 계좌", brideAccount: "신부측 계좌", groomParentAccount: "신랑 혼주 계좌", brideParentAccount: "신부 혼주 계좌",
  groomPhone: "신랑 연락처", bridePhone: "신부 연락처", mapLink: "지도 링크 주소(a href 에만)",
};

const AUDIENCE = {
  parents: [
    "## 받는 사람: 혼주용 (양가 부모님이 지인·친척·직장 동료에게 보내는 청첩장)",
    "- 격식 있고 단정하게. 혼주를 앞세운다: '{{groomFather}} · {{groomMother}} 의 {{groomOrder}} {{groom}}' 처럼 혼주 이름 줄을 또렷하게.",
    "- 인사말은 {{greeting}}(혼주 명의 존댓말). 비어 있으면 혼주가 하객께 드리는 정중한 인사말을 직접 짓는다(이때만 글로 써도 된다).",
    "- 마음 전하실 곳은 {{groomParentAccount}}·{{brideParentAccount}}(혼주 계좌) — 비어 있으면 {{groomAccount}}·{{brideAccount}}.",
    "- 어르신이 읽기 쉽게: 모바일 본문 17px 이상·이름 24px 이상, 종이 본문 10pt 이상. 영문 장식 문구와 유행 표현은 최소로, 사진은 0~1장.",
    "- 날짜·시간·장소·오시는 길을 가장 크게, 찾아오기 쉽게.",
  ].join("\n"),
  friends: [
    "## 받는 사람: 친구용 (신랑·신부가 직접 친구·동료에게 보내는 청첩장)",
    "- 두 사람이 주인공: 이름과 사진을 앞세우고 밝고 감각적인 톤. 영문 장식 문구, 사진 갤러리(사진이 여러 장이면) 적극 사용.",
    "- 인사말은 {{friendGreeting}}(두 사람 명의) — 비어 있으면 {{greeting}}. 둘 다 비어 있으면 두 사람이 친구에게 하듯 다정한 인사말을 직접 짓는다(이때만 글로 써도 된다).",
    "- 혼주 줄은 작게 한 줄로(혼주 정보가 비어 있으면 뺀다). 마음 전하실 곳은 {{groomAccount}}·{{brideAccount}}, 연락처는 신랑·신부.",
  ].join("\n"),
};

function skillPrompt({ format, size, photoCount, filled, today, audience }) {
  const paper = format === "paper";
  return [
    `오늘은 ${today}. 너는 한국 결혼식 청첩장을 만드는 시니어 디자이너다. 부부와 대화하며 ${paper ? `종이 인쇄 청첩장(재단 크기 ${size.w}×${size.h}mm)` : "모바일 청첩장(휴대폰으로 링크를 열어 세로로 스크롤하는 한 페이지)"} 시안을 HTML/CSS로 만들고 고친다.`,
    "",
    "## 출력 형식 (꼭 지킨다)",
    "1) 첫 줄: 이번에 무엇을 만들었거나 바꿨는지 한국어 한두 문장(부부에게 하는 말, 존댓말 '~했어요').",
    "2) 그 다음 줄에 <<<HTML 을 쓰고, HTML 조각 전체, 마지막 줄에 HTML>>> 를 쓴다. 이 둘 밖에는 다른 글을 쓰지 않는다.",
    "HTML 조각 = (선택) Google Fonts <link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?...\"> + <style>…</style> + 본문 마크업. <html>·<head>·<body> 태그는 쓰지 않는다.",
    "",
    "## 금지",
    "- <script>, onclick 같은 on* 속성, javascript: 주소, <iframe>·<form>·<object>·<embed>·<base>, 외부 이미지 주소. 이미지는 {{photo1}}~{{photo" + Math.max(1, photoCount) + "}} 자리표시만(<img src=\"{{photo1}}\"> 또는 CSS background-image:url('{{photo1}}')).",
    photoCount ? `- 부부가 올린 사진은 ${photoCount}장이다. 그보다 큰 번호는 쓰지 않는다.` : "- 부부가 아직 사진을 안 올렸다. 사진 자리는 {{photo1}} 하나만 쓰고, 나머지 장식은 CSS·인라인 SVG(꽃·선·도형)로 그린다.",
    "- 레퍼런스 이미지 속 글자·로고·인물을 그대로 베끼지 않는다. 분위기(색감·여백·배치·글씨체 느낌·장식 방식)만 가져온다.",
    "- 글꼴은 Google Fonts 의 한글 글꼴(Noto Serif KR, Nanum Myeongjo, Gowun Batang, Gowun Dodum, Noto Sans KR, Song Myung, Hahmlet 등)과 영문 장식체만. 다른 웹폰트 주소는 쓰지 않는다.",
    "",
    AUDIENCE[audience === "friends" ? "friends" : "parents"],
    "",
    "## 정보는 자리표시로",
    "이름·날짜·장소·계좌 같은 정보는 글자로 직접 쓰지 말고 아래 자리표시를 쓴다(부부가 정보를 고치면 바로 반영되게). 여러 줄 정보(greeting·transport·계좌)는 줄바꿈이 <br>로 들어간다.",
    Object.entries(TOKENS).map(([k, v]) => `{{${k}}} = ${v}`).join("\n"),
    `지금 채워진 정보: ${filled.length ? filled.join(", ") : "없음"}. 비어 있는 정보의 칸은 넣지 않는다(예: 계좌가 비어 있으면 '마음 전하실 곳'을 빼고, 부부가 채우면 다음 수정 때 넣는다).`,
    "",
    paper ? [
      "## 종이 청첩장 규칙",
      `- 각 면은 <section class="page"> 하나. 크기는 정확히 width:${size.w}mm; height:${size.h}mm; overflow:hidden; position:relative. 기본은 앞면·뒷면 두 장(부부가 원하면 한 장).`,
      `- <style> 안에 @page { size: ${size.w}mm ${size.h}mm; margin: 0 } 와 .page { page-break-after: always; break-after: page } 를 넣는다.`,
      "- 중요한 글자·사진은 재단선에서 5mm 이상 안쪽에. 배경색·배경 사진은 끝까지 채운다(인쇄소가 3mm 여유를 더한다).",
      "- 글씨는 7pt 이상, 본문 9~11pt, 이름 14pt 이상. 단위는 mm·pt 를 쓴다.",
      "- 앞면: 인사말·두 사람·혼주·일시·장소. 뒷면: 오시는 길(주소·교통 글로), 필요하면 마음 전하실 곳. 종이에는 링크 대신 글로 쓴다.",
      "- 인쇄 느낌을 살린다: 넉넉한 여백, 2~3가지 색, 얇은 선.",
    ].join("\n") : [
      "## 모바일 청첩장 규칙",
      "- 가운데 정렬 한 줄 구성, 최대 폭 430px(margin:0 auto), 화면 폭 360~430px 에서 깨지지 않게. 단위는 px·%·rem.",
      "- 섹션 순서 예: 첫 화면(큰 사진 + 두 사람 이름 + 날짜) → 인사말 → 혼주 → 일시·장소 → 오시는 길(주소, <a href=\"{{mapLink}}\">지도 보기</a>, 교통) → 사진 갤러리(사진이 여러 장일 때) → 마음 전하실 곳(계좌, 글자를 길게 눌러 복사할 수 있게 user-select:text) → 마무리 문구.",
      "- 연락처는 <a href=\"tel:{{groomPhone}}\"> 처럼 링크로. 버튼·링크는 손가락으로 누르기 좋게 44px 이상.",
      "- 섹션 사이 여백을 넉넉히, 본문 15~16px, 줄간격 1.7 이상.",
    ].join("\n"),
    "",
    "## 수정 요청일 때",
    "지금 시안 HTML이 함께 오면 그것을 바탕으로 요청한 곳만 고치고 나머지는 그대로 둔다. 매번 전체 HTML을 다시 출력한다.",
    "부부가 '레퍼런스처럼'이라고 하면 첨부한 레퍼런스 이미지들의 공통 분위기를 우선한다.",
  ].join("\n");
}

// 위험한 태그·속성을 걷어 낸다(미리보기·공개 페이지 모두 스크립트가 돌지 않게 한 번 더) — 앱 sanitizeInvite 와 같은 코드
// 겹쳐 쓴 태그(<scr<script>ipt>)는 바뀌지 않을 때까지 반복, 주소는 허용 목록(사진 자리·data:image·/i/ 사진·tel:·지도·글꼴)만 남긴다
const INV_BAD_TAG = /<\s*\/?\s*(script|iframe|object|embed|form|base|meta|frame|frameset|applet|noscript|template|portal|set|animate|animatemotion|animatetransform|foreignobject)\b[^<>]*>?/gi;
const INV_IMG_OK = /^(\{\{photo\d{1,2}\}\}|data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+|\/i\/[A-Za-z0-9]{12,32}\/img\/\d{1,2}(\?v=[a-z0-9]{1,12})?|#[\w-]*)$/i;
const INV_LINK_OK = /^(\{\{\w+\}\}|#[\w-]*|(tel|sms):[\w+\-.{}() ]*|https:\/\/map\.naver\.com\/[^\s"'<>\\]*|https:\/\/fonts\.googleapis\.com\/[^\s"'<>\\]*)$/i;
function invDecode(v) {
  return String(v).replace(/^["']|["']$/g, "")
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) % 0x110000))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d) % 0x110000))
    .replace(/&(colon|tab|newline|quot|apos|lpar|rpar|amp);?/gi, (_, n) => ({ colon: ":", tab: "", newline: "", quot: "", apos: "", lpar: "(", rpar: ")", amp: "&" })[n.toLowerCase()])
    .replace(/[\u0000-\u0020\u007f-\u00a0]+/g, (m, i, all) => (i === 0 || i + m.length === all.length ? "" : " "));
}
const invUrlOk = (v, img) => { const d = invDecode(v); return INV_IMG_OK.test(d) || (!img && INV_LINK_OK.test(d)); };
function sanitizeInviteHtml(html) {
  let s = String(html || "");
  for (let n = 0; n < 6; n++) {
    const before = s;
    s = s.replace(INV_BAD_TAG, "");
    s = s.replace(/([\s"'\/])on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1");
    s = s.replace(/([\s"'\/])(srcdoc|ping|codebase|dynsrc|lowsrc|attributename)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1");
    s = s.replace(/([\s"'\/])(src|srcset|poster|background|data|(?:xlink:)?href|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (m, pre, a, v) => (invUrlOk(v, !/href|action/i.test(a)) ? m : `${pre}${a}="#"`));
    s = s.replace(/url\(\s*("[^"()]*"|'[^'()]*'|[^()]*)\s*\)|url\(/gi, (m, v) => (v === undefined ? "none(" : invUrlOk(v, true) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\/[^\s"'<>()\\]*$/i.test(invDecode(v)) ? m : "none"));
    s = s.replace(/image-set\s*\(|-webkit-image-set\s*\(|expression\s*\(/gi, "(");
    s = s.replace(/@import\s*(?:url\(\s*)?("[^"]*"|'[^']*'|[^\s;)]*)\s*\)?[^;{}]*;?/gi, (m, v) => (/^https:\/\/fonts\.googleapis\.com\/[^\s"'<>()\\]*$/i.test(invDecode(v)) ? m : ""));
    s = s.replace(/<link\b[^<>]*>?/gi, (m) => (/^<link(\s+(rel|href|crossorigin)\s*=\s*("[^"]*"|'[^']*'))+\s*\/?>$/i.test(m) && /\srel\s*=\s*["']stylesheet["']/i.test(m)
      && /\shref\s*=\s*["']https:\/\/fonts\.googleapis\.com\/[^"'<>\s]*["']/i.test(m) ? m : ""));
    if (s === before) break;
  }
  return s;
}

// 모델 응답 → { note, html }
function parseInviteResponse(text) {
  const t = String(text || "");
  const a = t.indexOf("<<<HTML"), b = t.lastIndexOf("HTML>>>");
  let html = a >= 0 && b > a ? t.slice(a + 7, b) : "";
  if (!html) { const m = /```html\s*([\s\S]*?)```/i.exec(t); if (m) html = m[1]; }
  if (html.length > 250000) return null; // 자르면 태그가 깨진다 — 너무 길면 실패로
  html = sanitizeInviteHtml(html.trim());
  const note = (a >= 0 ? t.slice(0, a) : t.split("\n")[0] || "").replace(/```[\s\S]*$/, "").trim().slice(0, 600);
  return html.length > 50 ? { note, html } : null;
}

module.exports = { TOKENS, skillPrompt, sanitizeInviteHtml, parseInviteResponse };

if (require.main === module) { // node invite-design.js — 정리 함수 자체 점검
  const assert = require("assert");
  const dirty = '<link rel="stylesheet" href="https://evil.com/x.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR"><script>alert(1)</script><div onclick="x()" style="a">hi</div><a href="javascript:alert(1)">x</a><iframe src="https://x"></iframe><img src="{{photo1}}" onerror=alert(1)>';
  const c = sanitizeInviteHtml(dirty);
  assert(!/script|onclick|onerror|javascript:|iframe|evil\.com/i.test(c), c);
  assert(/fonts\.googleapis\.com/.test(c) && /\{\{photo1\}\}/.test(c));
  const r = parseInviteResponse('첫 시안을 만들었어요.\n<<<HTML\n<style>.a{}</style><div class="a">{{groom}} ♥ {{bride}} 결혼합니다 — 오래 기다렸어요</div>\nHTML>>>');
  assert.strictEqual(r.note, "첫 시안을 만들었어요."); assert(/\{\{groom\}\}/.test(r.html));
  assert.strictEqual(parseInviteResponse("미안해요"), null);
  const evil = [
    "<scr<scr<script>ipt>ipt>alert(1)</script>", "<me<me<meta>ta>ta http-equiv=refresh content='0;url=https://evil.example'>",
    '<img/onerror=alert(1) src=x>', '<a href="&#106;avascript:alert(1)">x</a>', '<a href="https://evil.example/pay">송금</a>',
    '<img src="https://evil.example/c?a=1">', '<div style="background:url(https://evil.example/b)">', "<div style=\"background:url(&quot;https://evil.example/q&quot;)\">",
    '<link href="https://evil.example/x.css" rel="stylesheet" title="href=\'https://fonts.googleapis.com/x\'">', "<style>@import 'https://evil.example/a.css';</style>",
    '<div style="background:url(https://evil.example/a(b).png)">', '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
  ];
  const t0 = Date.now(); sanitizeInviteHtml("<script ".repeat(30000) + "<a " + "on".repeat(20000)); assert(Date.now() - t0 < 3000, "느린 입력"); // ReDoS 점검
  for (const e of evil) { const o = sanitizeInviteHtml(e); assert(!/<script|<meta|onerror|javascript:|(src|href)\s*=\s*["']?https?:\/\/evil|url\(\s*["']?https?:\/\/evil|@import[^;]*evil/i.test(o), `${e} → ${o}`); }
  const font = '<style>@import url("https://fonts.googleapis.com/css2?family=Noto+Serif+KR");@import url(https://fonts.googleapis.com/css2?family=Gowun+Batang);body{margin:0}</style>';
  assert.strictEqual(sanitizeInviteHtml(font), font);
  assert.strictEqual(sanitizeInviteHtml("<style>@import url(https://evil.example/a.css);body{margin:0}</style>"), "<style>body{margin:0}</style>");
  const keep = '<a href="tel:{{groomPhone}}">전화</a><a href="{{mapLink}}">지도</a><img src="{{photo2}}"><div style="background-image:url(\'{{photo1}}\')"></div><img src="/i/AbCdEfGhJkLm23/img/3?v=k2x9"><a href="https://map.naver.com/p/search/%EC%84%9C">지도</a>';
  assert.strictEqual(sanitizeInviteHtml(keep), keep);
  console.log("invite-design ok");
}
