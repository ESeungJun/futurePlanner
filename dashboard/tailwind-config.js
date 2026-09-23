// Tailwind 런타임 설정 — index.html 인라인 스크립트였으나 CSP(script-src 'self')를 위해 파일로 분리.
// vendor/tailwind-*.js 다음에 로드돼야 한다.
if (window.tailwind) tailwind.config = { theme: { extend: { fontFamily: { mono: ["'JetBrains Mono'", "ui-monospace", "monospace"] } } } };
