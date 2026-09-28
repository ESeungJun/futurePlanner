/*
 * 정책 레이더 — 최근 60일 동안 발표된 대출·청약·주택·세금·결혼·출산·저축 정책을 Claude 웹 검색으로 모은다.
 * 정부 보도자료(korea.kr·.go.kr)가 1순위, 공식 발표를 인용한 기사는 보조. 출처 URL 없는 항목은 버린다.
 * 실행: policyRadarJob(Firestore 트리거 radarJobs/{id}) — researchDaily 가 매일, 앱 [새로고침]이 수동으로 작업을 만든다.
 * 결과: research/policy-radar { at, payload: { items, at }, context }
 */
const crypto = require("crypto");

const STATUSES = ["시행 중", "확정(시행 예정)", "정부안·국회 심의", "예고·검토"];
const TOPICS = ["대출", "청약·주택", "세금", "결혼·출산", "저축·투자", "기타"];
const DAY = 86400e3;

function buildRadarPrompt(context, today) {
  return [
    `오늘은 ${today}(KST)이다. 너는 한국 정부 정책 모니터링 담당이다.`,
    "대상: 신혼부부·무주택·과천 거주 예정 부부에게 관련 있는 대출·청약·주택·세금·결혼·출산·저축 정책.",
    `이 부부의 조건(JSON): ${context ? JSON.stringify(context) : "(없음 — 일반적인 신혼 무주택 부부로 가정)"}`,
    "",
    `web_search로 최근 60일(${ymdShift(today, -60)} 이후) 발표를 찾아라.`,
    "출처 규칙:",
    "- 1순위는 정부 보도자료다: korea.kr(정책브리핑), 국토교통부·금융위원회·기획재정부·국세청·행정안전부·보건복지부 등 .go.kr 사이트.",
    "- 언론 기사는 공식 발표를 인용한 경우에만 보조 출처로 쓴다. 출처 URL을 댈 수 없는 항목은 넣지 마라. 지어내지 마라.",
    "상태(status) 규칙 — 반드시 아래 넷 중 하나:",
    `- ${STATUSES.map((s) => `"${s}"`).join(", ")}`,
    "- 정부안·입법예고·검토 단계를 확정처럼 쓰지 마라. 국회 통과·고시·시행령 공포가 확인될 때만 \"확정(시행 예정)\" 또는 \"시행 중\"이다.",
    `분야(topic)는 ${TOPICS.map((s) => `"${s}"`).join(", ")} 중 하나.`,
    "문구 규칙:",
    "- title은 짧게, summary는 무엇이 어떻게 바뀌는지 1~2문장, impact는 이 부부에게 무엇이 달라지는지 한 문장(조건 JSON을 반영).",
    "- 전문용어는 처음 나올 때 괄호로 짧게 뜻을 풀고, 기간은 기준일과 방향을 적어라(예: \"2026.10.19 신청분부터\"). 숫자는 누구 값인지 적어라.",
    "- 한국어로만 쓰고, 영문 변수명·코드명을 문장에 쓰지 마라.",
    "- announcedAt(발표일)은 YYYY-MM-DD 필수, effectiveAt(시행일)은 YYYY-MM-DD 또는 null.",
    "",
    "최대 15건. 마지막 답변은 아래 JSON 하나만 출력한다(다른 글 없이):",
    '{"items":[{"title":"…","summary":"…","impact":"…","status":"…","topic":"…","announcedAt":"YYYY-MM-DD","effectiveAt":"YYYY-MM-DD 또는 null","source":"발표 기관 또는 매체 이름","url":"https://…"}]}',
  ].join("\n");
}

function ymdShift(ymd, days) { return new Date(Date.parse(ymd + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10); }
// 실제 달력 날짜인 YYYY-MM-DD 만 (2026-02-30 같은 값은 거른다)
const validYmd = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

function extractJson(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// 모델 결과 정리 — 필수값(제목·발표일·상태·http(s) URL) 없는 항목은 버리고, 60일 넘은 발표는 status 그대로 두되 뒤로 보낸다
function cleanRadar(raw, today) {
  const cut = ymdShift(today, -60), seen = new Set();
  const items = (raw && Array.isArray(raw.items) ? raw.items : []).slice(0, 40).map((it) => {
    if (!it || typeof it !== "object") return null;
    const url = str(it.url, 500), title = str(it.title, 80);
    if (!/^https?:\/\/[^\s]+$/i.test(url) || !title || !STATUSES.includes(it.status) || !validYmd(it.announcedAt)) return null;
    if (it.announcedAt > today) return null; // 미래 발표일은 오류
    let source = str(it.source, 60);
    if (!source) { try { source = new URL(url).hostname; } catch { return null; } }
    return {
      id: crypto.createHash("sha1").update(url + "|" + title).digest("hex").slice(0, 12),
      title, summary: str(it.summary, 300), impact: str(it.impact, 200), status: it.status,
      topic: TOPICS.includes(it.topic) ? it.topic : "기타",
      announcedAt: it.announcedAt, effectiveAt: validYmd(it.effectiveAt) ? it.effectiveAt : null, source, url,
    };
  }).filter((it) => it && !seen.has(it.id) && seen.add(it.id));
  const old = (it) => (it.announcedAt < cut ? 1 : 0);
  return items.sort((a, b) => old(a) - old(b) || b.announcedAt.localeCompare(a.announcedAt)).slice(0, 20);
}

// client: Anthropic SDK 인스턴스(maxRetries 0). deadlineMs 안에 끝낸다.
async function runRadar({ client, model, context, today, deadlineMs }) {
  const msgs = [{ role: "user", content: buildRadarPrompt(context, today) }];
  let text = "", stop = "";
  for (let i = 0; i < 4; i++) {
    const left = deadlineMs - Date.now();
    if (left < 5000) { stop = "timeout"; break; }
    const msg = await client.messages.create({
      model, max_tokens: 8000,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" } }],
      output_config: { effort: "low" },
      messages: msgs,
    }, { timeout: left });
    text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") || text;
    stop = msg.stop_reason;
    if (stop !== "pause_turn") break;
    msgs.push({ role: "assistant", content: msg.content });
  }
  if (stop !== "end_turn") throw new Error(`radar_incomplete: ${stop || "none"}`);
  const j = extractJson(text);
  if (!j) throw new Error("radar_parse_failed");
  return cleanRadar(j, today);
}

module.exports = { buildRadarPrompt, cleanRadar, runRadar, STATUSES, TOPICS };
