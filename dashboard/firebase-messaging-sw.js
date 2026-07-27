/* 웹 푸시 서비스워커 — 백그라운드에서 부동산 공고 알림 표시 */
self.window = self; // firebase-config.js가 window에 쓰므로 SW 환경에서 별칭 처리
// index.html과 동일하게 자체 호스팅 SDK 사용 (서드파티 CDN 침해 표면 제거)
importScripts("./vendor/firebase-app-compat-10.14.1.js");
importScripts("./vendor/firebase-messaging-compat-10.14.1.js");
importScripts("./firebase-config.js");

firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// 서버는 data-only 메시지를 보냄 (자동표시와의 중복 방지) — 여기서 직접 표시
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "우리 라이프 플랜", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || "realty-notice",
    data: { link: d.link || "/" },
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // 페이로드의 링크는 같은 오리진만 연다 (발신 권한이 새더라도 임의 사이트로 유도되지 않게).
  // 스킴만 보면 "//evil.com"이 ^\/ 에 걸려 통과하고 브라우저는 https://evil.com으로 해석한다.
  const raw = String((e.notification.data && e.notification.data.link) || "/");
  let link = "/";
  try { const u = new URL(raw, self.location.origin); if (u.origin === self.location.origin) link = u.href; } catch {}
  // 이미 열린 탭이 있으면 그 탭으로 (중복 탭 방지)
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const hit = wins.find((w) => w.url.startsWith(self.location.origin));
    if (hit) { await hit.focus(); if (hit.navigate) await hit.navigate(link).catch(() => {}); return; }
    await clients.openWindow(link);
  })());
});
