// 로드/렌더 오류를 화면에 표시 (콘솔을 못 보는 경우 대비)
// index.html 인라인 스크립트였으나 CSP(script-src 'self')를 위해 파일로 분리 — app.js 보다 먼저 로드한다.
function __showErr(msg) {
  var r = document.getElementById("root");
  if (r && !r.hasChildNodes()) {
    r.innerHTML = '<pre style="margin:24px;padding:16px;background:#fff;border:1px solid #E4DFD3;border-radius:12px;color:#A8451F;white-space:pre-wrap;font-size:13px;line-height:1.6;font-family:monospace">⚠️ 로드 오류\n\n' + String(msg).replace(/</g, "&lt;") + '</pre>';
  }
}
window.addEventListener("error", function (e) { __showErr((e.message || e.error || e) + "\n" + (e.filename || "") + (e.lineno ? ":" + e.lineno : "")); });
window.addEventListener("unhandledrejection", function (e) { __showErr("Promise: " + (e.reason && e.reason.message || e.reason)); });
// React 로드 실패 감지
window.addEventListener("load", function () {
  setTimeout(function () {
    if (typeof React === "undefined") return __showErr("React를 불러오지 못했습니다 (vendor/react-18.3.1.production.min.js). 배포 파일이 누락됐을 수 있어요.");
  }, 300);
});
