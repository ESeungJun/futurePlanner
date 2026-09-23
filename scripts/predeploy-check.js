// firebase deploy predeploy 가드 — gitignore된 설정 파일이 없는 머신에서의 배포를 차단한다.
// (파일이 없는 채 배포하면 배포본에서 로그인 설정·지도 키·푸시 키가 조용히 빠진다 — dashboard/README.md 참고)
// functions 배포는 .env 의 ALLOWED_EMAILS 값까지 확인한다 — 비어 있으면 verifyCaller 가 fail-closed 로
// 인증 경로(상담·리서치·조회 프록시·푸시)를 전부 503 으로 거절하므로, 배포 전에 여기서 막는다.
// 사용: node scripts/predeploy-check.js hosting|functions
const fs = require("fs");
const target = process.argv[2] === "functions" ? "functions" : "hosting";
const required = target === "functions" ? "functions/.env" : "dashboard/firebase-config.js";
if (!fs.existsSync(required)) {
  console.error(`[predeploy] ${required} 가 없습니다 — 이대로 배포하면 배포본에서 해당 설정이 빠집니다. 이 머신에 파일을 먼저 복원하세요.`);
  process.exit(1);
}
if (target === "functions") {
  // KEY=value 한 줄씩 — 주석·빈 줄 무시, 양쪽 따옴표 제거 (dotenv 와 같은 규칙의 최소 구현)
  const envText = fs.readFileSync(required, "utf8");
  const vars = {};
  for (const line of envText.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  const allow = String(vars.ALLOWED_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allow.length) {
    console.error("[predeploy] functions/.env 의 ALLOWED_EMAILS 가 비어 있습니다 — 서버는 fail-closed 라 로그인 경로가 전부 503 이 됩니다. firestore.rules 와 같은 계정 목록을 쉼표로 넣으세요.");
    process.exit(1);
  }
  const bad = allow.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (bad.length) {
    console.error(`[predeploy] ALLOWED_EMAILS 에 이메일 형식이 아닌 항목이 있습니다: ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log(`[predeploy] ALLOWED_EMAILS ${allow.length}개 확인`);
}
