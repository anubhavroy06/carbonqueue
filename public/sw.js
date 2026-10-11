const VERSION = "carbonqueue-1.0.1";
const ASSETS = /*ASSETS*/ [];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("carbonqueue-") && k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (e) => {
  if (e.data === "ACTIVATE_UPDATE") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (event.request.method !== "GET" || u.origin !== self.location.origin)
    return;
  event.respondWith(
    caches.open(VERSION).then(async (c) => {
      const cached = await c.match(event.request);
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (e) {
        if (event.request.mode === "navigate") {
          const base = new URL("./index.html", self.registration.scope).href;
          const shell = await c.match(base);
          if (shell) return shell;
        }
        throw e;
      }
    }),
  );
});
