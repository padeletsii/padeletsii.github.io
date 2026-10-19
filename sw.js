const CACHE_NAME = "liga-etsii-v5";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Solo cachea archivos estáticos del propio sitio (HTML/manifest/iconos).
// Las llamadas a la API (Google Apps Script) y fuentes externas van directas a la red,
// para que la clasificación y los resultados siempre estén al día.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // La página (HTML) va primero a la red: así al subir una versión nueva se ve
  // al momento. Solo si no hay conexión se usa la copia guardada.
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, clone)); }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---- Notificaciones push ----
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Liga Pádel ETSII", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png",
    tag: d.tag || undefined, data: { url: d.url || "./" },
  }));
});
// Al tocarla: si la web ya está abierta, se enfoca y se lleva a "Mis partidos"; si no, se abre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ type: "open-url", url }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
