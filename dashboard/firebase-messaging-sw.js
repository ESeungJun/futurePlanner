/* 웹 푸시 서비스워커 — 백그라운드에서 부동산 공고 알림 표시 */
self.window = self; // firebase-config.js가 window에 쓰므로 SW 환경에서 별칭 처리
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
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
  // 페이로드의 링크는 스킴을 확인한 뒤에만 연다 (발신 권한이 새더라도 임의 사이트로 유도되지 않게)
  const raw = String((e.notification.data && e.notification.data.link) || "/");
  const link = /^https:\/\/|^\//.test(raw) ? raw : "/";
  e.waitUntil(clients.openWindow(link));
});
