// Hand-written service worker: cache-first for static assets/app shell,
// network-first for API/data routes (so review/session data is never stale
// behind a cache while still working offline for the shell + assets).
//
// Slice 6 (offline review) additions: a "sync" handler opportunistically
// flushes the offline-review queue via the Background Sync API (see
// src/client/offline/sync.ts for the reliable online-event/app-load
// fallback this backs up, since Background Sync isn't universally
// supported). Cache bumped to v2.
//
// /review is deliberately NOT in the eager precache list below: it 302s to
// /login for a logged-out visitor, and `cache.addAll` throws on a redirected
// response (Cache Storage spec) — for an all-or-nothing addAll call, that
// would silently fail precaching for EVERY entry, including the previously-
// safe "/", not just /review. Instead /review is cached opportunistically
// the normal way: the network-first page-navigation handler below caches it
// the first time an authenticated user actually visits it, which is exactly
// when the response is a real 200, not a redirect.
const CACHE_NAME = "kartka-v2";
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

// --- Slice 6: opportunistic Background Sync for the offline-review queue ---
// Mirrors the IndexedDB schema owned by src/client/offline/db.ts (db name,
// version, and the "queue" store's shape) — kept in sync by hand since a
// plain sw.js can't import that module. If the schema there ever changes,
// update these constants too.
const OFFLINE_DB_NAME = "kartka-offline";
const OFFLINE_DB_VERSION = 1;
const QUEUE_STORE = "queue";

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // No onupgradeneeded here on purpose: the page (db.ts) owns schema
    // creation. If this DB doesn't exist yet there's nothing queued to sync.
  });
}

async function backgroundSyncQueue() {
  let db;
  try {
    db = await openOfflineDb();
  } catch {
    return; // no offline DB yet — nothing queued
  }
  if (!db.objectStoreNames.contains(QUEUE_STORE)) {
    db.close();
    return;
  }

  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!items || items.length === 0) {
    db.close();
    return;
  }

  try {
    const res = await fetch("/api/review/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reviews: items.map((i) => ({ cardId: i.cardId, quality: i.quality, answeredAt: i.answeredAt })),
      }),
    });
    if (!res.ok) {
      db.close();
      return;
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      for (const item of items) store.delete(item.queueId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const clients = await self.clients.matchAll();
    for (const client of clients) client.postMessage({ type: "kartka-sync-complete" });
  } catch {
    // best-effort — the reliable online-event/app-load fallback in
    // src/client/offline/sync.ts covers this the next time a page is open.
  } finally {
    db.close();
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "kartka-offline-review-sync") {
    event.waitUntil(backgroundSyncQueue());
  }
});
