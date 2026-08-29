// Deliberately minimal: this app's data is live/dynamic (patient records,
// messages), so we do NOT cache pages or API responses — that would risk
// showing stale clinical data. This service worker exists only to satisfy
// PWA "installability" checks (Chrome/Android and PWABuilder both require
// one to offer "Add to Home Screen" / to package an APK). It just passes
// every request straight through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
