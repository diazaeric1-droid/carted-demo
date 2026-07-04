const CACHE = "carted-v38";
const SHELL = [
  "./",
  "index.html",
  "icon-192.png",
  "icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Pass through all third-party API calls (Overpass, Nominatim, Google Fonts).
  // Same-origin check works on any host (github.io OR cartedapp.com).
  if (url.origin !== location.origin) return;
  // Let the HTTP cache handle dish photos — keeps SW cache small
  if (url.pathname.includes("/menus/")) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});

// Push notification handler (ready for when backend sends streak reminders)
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : { title: "Carted 🔥", body: "Your streak is waiting." };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "carted-streak",
      renotify: true,
      data: { url: "./" }
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
