// Hand-written service worker: cache-first for static assets/app shell,
// network-first for API/data routes (so review/session data is never stale
// behind a cache while still working offline for the shell + assets).
const CACHE_NAME = "kartka-v1";
const APP_SHELL = ["/", "/manifest.json", "/branding/logo.svg", "/branding/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/sw.js"
  );
}

function isApiOrData(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return; // never intercept mutating requests

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (isApiOrData(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // App shell / page navigations: network-first with cache fallback so a
  // student mid-review with a flaky connection still gets the last shell.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
