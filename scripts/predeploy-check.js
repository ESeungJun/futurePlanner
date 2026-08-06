// firebase deploy predeploy 가드 — gitignore된 설정 파일이 없는 머신에서의 배포를 차단한다.
// (파일이 없는 채 배포하면 배포본에서 로그인 설정·지도 키·푸시 키가 조용히 빠진다 — dashboard/README.md 참고)
// 사용: node scripts/predeploy-check.js hosting|functions
const fs = require("fs");
const required = process.argv[2] === "functions" ? "functions/.env" : "dashboard/firebase-config.js";
if (!fs.existsSync(required)) {
  console.error(`[predeploy] ${required} 가 없습니다 — 이대로 배포하면 배포본에서 해당 설정이 빠집니다. 이 머신에 파일을 먼저 복원하세요.`);
  process.exit(1);
}
