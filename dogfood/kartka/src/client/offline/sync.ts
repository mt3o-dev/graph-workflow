// Slice 6 (offline review): sync-on-reconnect + the visible sync-status
// indicator. Loaded from BaseLayout (see src/layouts/BaseLayout.astro) so it
// runs on every page, not just /review — a user can queue offline reviews on
// /review and then navigate elsewhere before reconnecting, and the indicator
// / reliable-fallback sync still needs to fire.
import { getQueue, clearQueueItems, queueCount, isIndexedDbAvailable } from "./db";
import { t } from "../../i18n";

const INDICATOR_ID = "offline-sync-indicator";
const SYNCED_DISPLAY_MS = 2500;

let syncing = false;

function locale(): "pl" | "en" {
  return document.documentElement.lang === "en" ? "en" : "pl";
}

function ensureIndicator(): HTMLElement {
  let el = document.getElementById(INDICATOR_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = INDICATOR_ID;
    el.className = "offline-sync-indicator";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

async function refreshIndicator(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  const count = await queueCount();
  const el = ensureIndicator();
  el.classList.remove("is-success");
  if (count > 0) {
    el.hidden = false;
    el.textContent = t("offline.pendingSync", locale(), { count });
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

function showSyncedBriefly(): void {
  const el = ensureIndicator();
  el.hidden = false;
  el.classList.add("is-success");
  el.textContent = t("offline.syncComplete", locale());
  setTimeout(() => void refreshIndicator(), SYNCED_DISPLAY_MS);
}

/**
 * POSTs the whole local queue to /api/review/sync and clears it locally.
 * The server makes a final applied/skipped decision on every item it
 * receives (see reviewUsecases.syncOfflineReviews) — a "skipped" item (e.g.
 * a card that no longer belongs to this user) has no retriable resolution,
 * so on any successful (2xx) response the full batch that was sent is
 * cleared, not just the applied subset. A network failure leaves the queue
 * untouched for the next trigger (online event / next app load / background
 * sync).
 */
export async function attemptSync(): Promise<void> {
  if (syncing || !isIndexedDbAvailable()) return;
  if (!navigator.onLine) return;

  const items = await getQueue();
  if (items.length === 0) {
    await refreshIndicator();
    return;
  }

  syncing = true;
  try {
    const res = await fetch("/api/review/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reviews: items.map((i) => ({ cardId: i.cardId, quality: i.quality, answeredAt: i.answeredAt })),
      }),
    });
    if (!res.ok) return; // stay offline-queued, retry on the next trigger

    await clearQueueItems(items.map((i) => i.queueId));
    showSyncedBriefly();
  } catch {
    // fetch threw (still offline, or reconnect was momentary) — leave the
    // queue intact, the online-event/app-load path will retry.
  } finally {
    syncing = false;
  }
}

/** Wires the reliable fallback (online event + app load) and, opportunistically, the Background Sync API. Call once, from BaseLayout. */
export function initSyncIndicator(): void {
  if (!isIndexedDbAvailable()) return;

  void refreshIndicator();

  // Reliable fallback #1: the browser tells us we're back online.
  window.addEventListener("online", () => void attemptSync());

  // Reliable fallback #2: next app load, if the queue is non-empty and we
  // happen to already be online (e.g. the tab was closed offline and
  // reopened after reconnecting — no 'online' event fires in that case).
  if (navigator.onLine) void attemptSync();

  // Something on this page (src/client/offline/controller.ts) just queued a
  // review — refresh the visible count immediately rather than waiting for
  // the next sync trigger.
  window.addEventListener("kartka:offline-review-queued", () => void refreshIndicator());

  // Opportunistic Background Sync: not universally supported (notably
  // Safari/iOS), so it's a bonus path, never the only path. When it fires,
  // the service worker (public/sw.js) does the actual IndexedDB read +
  // POST + cleanup itself (so it can run without this page open), then
  // messages any open clients — we just refresh the indicator on that
  // message rather than re-syncing (the SW already cleared the queue).
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => {
        const withSync = reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
        return withSync.sync?.register("kartka-offline-review-sync");
      })
      .catch(() => {
        // Background Sync registration failing is fine — the online-event/app-load fallback above still covers it.
      });
    navigator.serviceWorker.addEventListener("message", (event) => {
      if ((event.data as { type?: string } | undefined)?.type === "kartka-sync-complete") {
        showSyncedBriefly();
      }
    });
  }
}
