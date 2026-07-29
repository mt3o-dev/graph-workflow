// Slice 6 (offline review): tiny IndexedDB wrapper. Vanilla TS, no framework,
// no server-only imports — this file is bundled straight into the browser
// via a <script type="module"> import (Astro/vite bundles inline module
// scripts, see src/pages/review/index.astro and src/layouts/BaseLayout.astro).
//
// Two object stores in one DB:
//  - "bundle": the cached due-cards payload from GET /api/review/offline-bundle,
//    keyed by card id. Overwritten wholesale on every successful online fetch.
//  - "queue": offline-completed reviews not yet synced to the server, keyed
//    by an auto-incrementing local id ("queueId") so the same card can be
//    queued more than once (see reviewUsecases.syncOfflineReviews's
//    chronological-replay handling of that case).
//
// NOTE ON TEST COVERAGE: this file talks to a real browser IndexedDB, which
// `bun test` cannot provide (no DOM/IndexedDB in the Bun test runtime, and
// the project has no browser-test harness). It is intentionally NOT covered
// by an automated test — see the slice 6 report for how it was verified
// manually instead. The parts with real correctness risk (chronological
// replay + timestamp clamping) are pure server-side logic and ARE unit
// tested, in tests/offlineSync.test.ts.

const DB_NAME = "kartka-offline";
const DB_VERSION = 1;
const BUNDLE_STORE = "bundle";
const QUEUE_STORE = "queue";

export interface StoredCard {
  id: string;
  setId: string;
  type: string;
  payload: unknown;
}

export interface QueuedReview {
  queueId?: number;
  cardId: string;
  /** 0-5, already computed client-side via src/client/offline/scoring.ts (which reuses the real domain quality/levenshtein functions). */
  quality: number;
  /** ISO 8601 timestamp of when the review actually happened, client clock. */
  answeredAt: string;
  /** The scheduler the user was on when this review was queued — informational; the server always replays under the user's *current* schedulerPreference, see reviewUsecases.syncOfflineReviews. */
  schedulerPreference: string;
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BUNDLE_STORE)) {
        db.createObjectStore(BUNDLE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "queueId", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBundle(cards: StoredCard[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readwrite");
    const store = tx.objectStore(BUNDLE_STORE);
    store.clear();
    for (const card of cards) store.put(card);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBundle(): Promise<StoredCard[]> {
  const db = await openDb();
  const cards = await new Promise<StoredCard[]>((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readonly");
    const req = tx.objectStore(BUNDLE_STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredCard[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return cards;
}

export async function enqueueReview(review: QueuedReview): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).add(review);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueue(): Promise<Required<QueuedReview>[]> {
  const db = await openDb();
  const items = await new Promise<Required<QueuedReview>[]>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result as Required<QueuedReview>[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items;
}

export async function queueCount(): Promise<number> {
  const db = await openDb();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return count;
}

export async function clearQueueItems(queueIds: number[]): Promise<void> {
  if (queueIds.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    for (const id of queueIds) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
