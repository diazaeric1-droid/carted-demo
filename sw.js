const CACHE = "carted-v14";
const SHELL = [
  "/carted-demo/",
  "/carted-demo/index.html",
  "/carted-demo/icon-192.png",
  "/carted-demo/icon-512.png",
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
  // Pass through all third-party API calls (Overpass, Nominatim, Google Fonts)
  if (!url.hostname.includes("github.io")) return;
  // Let the HTTP cache handle baked place + dish photos — keeps SW cache small
  if (url.pathname.includes("/places/photos/") || url.pathname.includes("/menus/") || url.pathname.includes("/activities/")) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match("/carted-demo/index.html"));
    })
  );
});

// Push notification handler (ready for when backend sends streak reminders)
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : { title: "Carted 🔥", body: "Your streak is waiting." };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/carted-demo/icon-192.png",
      badge: "/carted-demo/icon-192.png",
      tag: "carted-streak",
      renotify: true,
      data: { url: "/carted-demo/" }
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
