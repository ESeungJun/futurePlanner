/*
 * 정책 점검 — 대시보드 정책 값(policy.js 기본값 + 부부가 반영한 변경)을 Claude 웹 검색으로 공식 자료와 대조해
 * "바뀐 것 같은 값" 후보를 만든다. 서버는 값을 직접 바꾸지 않는다 — 후보는 policy/proposals 문서에 쌓이고,
 * 부부가 앱에서 [반영]을 눌러야 policy-overrides-v1(클라우드 동기화 키)에 들어간다.
 *
 * policy-default.js 는 배포 때 dashboard/policy.js 를 복사한 파일이다(scripts/predeploy-check.js functions).
 */
const crypto = require("crypto");
const { POLICY_DEFAULT } = require("./policy-default.js");

// 경로 조각은 자기 속성만 — "__proto__"·"constructor"로 프로토타입을 건드리는 경로 차단 (overrides는 클라이언트가 올린 값)
const BAD_KEY = new Set(["__proto__", "constructor", "prototype"]);
const own = (o, k) => o != null && typeof o === "object" && !BAD_KEY.has(k) && Object.prototype.hasOwnProperty.call(o, k);
const getPath = (obj, path) => path.split(".").reduce((o, k) => (own(o, k) ? o[k] : undefined), obj);
function setPath(obj, path, value) {
  const ks = path.split("."); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { if (!own(o, ks[i]) || o[ks[i]] == null || typeof o[ks[i]] !== "object") return false; o = o[ks[i]]; }
  if (!own(o, ks[ks.length - 1])) return false;
  o[ks[ks.length - 1]] = value; return true;
}
const kind = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);

// households/main 의 policy-overrides-v1 (클라이언트가 JSON 문자열로 올린다) → 실제로 쓰는 정책
function effectivePolicy(overridesRaw) {
  const val = JSON.parse(JSON.stringify(POLICY_DEFAULT));
  let ov = {};
  try { ov = typeof overridesRaw === "string" ? JSON.parse(overridesRaw) || {} : overridesRaw || {}; } catch {}
  Object.entries(ov).forEach(([path, o]) => { if (o && "value" in o) setPath(val, path, o.value); });
  return val;
}

function sectionSlice(policy, key) {
  const sec = POLICY_DEFAULT.sections[key];
  const out = {};
  sec.paths.forEach((p) => { out[p] = policy[p]; });
  return out;
}

function buildPrompt(key, policy, today) {
  const sec = POLICY_DEFAULT.sections[key];
  const labels = Object.fromEntries(Object.entries(POLICY_DEFAULT.labels).filter(([p]) => sec.paths.some((sp) => p === sp || p.startsWith(sp + "."))));
  return [
    `오늘은 ${today}이다. 너는 한국 부동산·세무 정책 데이터 검증 담당이다.`,
    `아래는 신혼부부 재무 대시보드가 계산에 쓰는 "${sec.label}" 정책 값(JSON)이다. 경로 이름표: ${JSON.stringify(labels)}`,
    `참고 출처: ${sec.sources.join(", ")}`,
    "```json", JSON.stringify(sectionSlice(policy, key)), "```",
    "",
    "web_search로 정부·공공기관 공식 자료(금융위·국토부·기재부·국세청·복지부·주택도시기금·HF·HUG·청약홈·법령)와 그에 근거한 최신 보도를 찾아 각 숫자가 지금 현행 값인지 확인해라.",
    "규칙:",
    "- 공식 근거로 현행 값이 다르다고 확인될 때만 변경을 제안한다. 발표만 되고 시행 전인 값은 시행일이 3개월 이내일 때만, reason에 시행일을 적는다.",
    "- 확신이 없으면 제안하지 말고 notes에 적는다. 지어내지 마라.",
    "- path는 위 JSON의 전체 경로(예: loan.mortgage.ltvRegular). 없는 경로를 만들지 마라. 배열·객체 값(구간표 등)은 바뀐 경우 그 경로의 값 전체를 같은 형태로 제안한다.",
    "- 단위를 지켜라: …Won 원, …Man 만원, 비율은 소수(0.4 = 40%), …Pct는 퍼센트 숫자.",
    "- rules 같은 설명 문구 배열도 사실이 바뀌었으면 고친 배열을 제안해도 된다.",
    "- reason·notes·rules 문구는 짧아도 뜻이 분명하게: 전문용어는 처음 나올 때 괄호로 짧게 뜻을 풀고, 기간은 기준일과 방향을 적고(예: \"2026.10.19 신청분부터\"), 숫자는 누구 값이고 무엇과 비교하는지 적어라(예: \"부부 연소득 합산 8,500만원 이하\"). 화살표(→) 나열로 인과를 암시하지 말고 짧은 완결 문장으로 써라.",
    "",
    "마지막 답변은 아래 JSON 하나만 출력한다(다른 글 없이):",
    '{"changes":[{"path":"…","proposed":…,"reason":"무엇이 언제 바뀌었는지 한 문장","source":"URL","sourceDate":"YYYY-MM-DD","confidence":"high|medium"}],"confirmed":["현행과 같다고 확인한 경로"],"notes":"확인 못 한 것·곧 바뀔 예정인 것"}',
  ].join("\n");
}

function extractJson(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// 모델 제안 검증 — 섹션 밖 경로·없는 경로·타입이 바뀐 값·터무니없는 크기 변화는 버린다
function validateChanges(key, policy, changes) {
  const sec = POLICY_DEFAULT.sections[key];
  const out = [];
  (Array.isArray(changes) ? changes : []).slice(0, 30).forEach((c) => {
    if (!c || typeof c.path !== "string") return;
    const path = c.path.trim();
    if (!sec.paths.some((sp) => path === sp || path.startsWith(sp + "."))) return;
    const def = getPath(POLICY_DEFAULT, path), cur = getPath(policy, path);
    if (def === undefined || !("proposed" in c)) return;
    if (kind(c.proposed) !== kind(def)) return;
    if (JSON.stringify(c.proposed) === JSON.stringify(cur)) return;
    if (typeof cur === "number" && cur !== 0) { const r = c.proposed / cur; if (!(r > 0.2 && r < 5)) return; }
    const src = String(c.source || "");
    if (!/^https?:\/\//.test(src)) return; // 근거 링크 없는 제안은 받지 않는다
    out.push({
      // 제안값 전체의 해시 — base64 앞 24자는 앞부분이 같은 배열·객체(구간표 등)끼리 id가 겹쳤다
      id: `${key}:${path}:${crypto.createHash("sha1").update(JSON.stringify(c.proposed)).digest("hex")}`,
      section: key, path, current: cur, proposed: c.proposed,
      reason: String(c.reason || "").slice(0, 300), source: src.slice(0, 500),
      sourceDate: String(c.sourceDate || "").slice(0, 10), confidence: c.confidence === "high" ? "high" : "medium",
    });
  });
  return out;
}

/**
 * 한 섹션 점검. client: Anthropic SDK 인스턴스(maxRetries 0 권장). deadlineMs 안에 끝낸다.
 * @returns {{ section, items, confirmed, notes, at }}
 */
async function reviewSection({ client, model, key, overridesRaw, today, deadlineMs }) {
  if (!POLICY_DEFAULT.sections[key]) throw Object.assign(new Error("unknown_section"), { code: 400 });
  const policy = effectivePolicy(overridesRaw);
  const msgs = [{ role: "user", content: buildPrompt(key, policy, today) }];
  let text = "", stop = "";
  for (let i = 0; i < 4; i++) {
    const left = deadlineMs - Date.now();
    if (left < 5000) { stop = "timeout"; break; }
    const msg = await client.messages.create({
      model, max_tokens: 6000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }],
      output_config: { effort: "medium" },
      messages: msgs,
    }, { timeout: left });
    text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") || text;
    stop = msg.stop_reason;
    if (stop !== "pause_turn") break;
    msgs.push({ role: "assistant", content: msg.content }); // 서버 도구가 길어져 멈춤 → 그대로 이어받기
  }
  // 끝까지 못 갔거나(max_tokens·pause_turn 반복·시간 부족) JSON이 깨졌으면 실패로 — 빈 결과로 합치면 기존 후보가 지워진다
  if (stop !== "end_turn") throw new Error(`policy_incomplete: ${stop || "none"}`);
  const j = extractJson(text);
  if (!j) throw new Error("policy_parse_failed");
  return {
    section: key,
    items: validateChanges(key, policy, j.changes),
    confirmed: (Array.isArray(j.confirmed) ? j.confirmed : []).filter((p) => typeof p === "string").slice(0, 60),
    notes: String(j.notes || "").slice(0, 800),
    at: new Date().toISOString(),
  };
}

// 점검 결과를 policy/proposals 문서에 합친다 — 같은 섹션의 옛 후보는 새 결과로 교체
function mergeProposals(doc, result) {
  const d = doc || {};
  const items = (d.items || []).filter((it) => it.section !== result.section).concat(result.items);
  return {
    items, updatedAt: result.at,
    checked: { ...(d.checked || {}), [result.section]: { at: result.at, confirmed: result.confirmed, notes: result.notes, found: result.items.length } },
  };
}

module.exports = { reviewSection, mergeProposals, effectivePolicy, POLICY_DEFAULT, SECTION_KEYS: Object.keys(POLICY_DEFAULT.sections) };
