// Slice 6 (offline review): the client-driven review flow. Mounted only on
// /review (src/pages/review/index.astro). Normal online review is untouched
// — this module never runs its own rendering unless the browser is actually
// offline (at load, or discovered mid-session when an htmx request fails),
// keeping the "client JS is a scoped exception for the offline review path"
// boundary from the slice spec.
import type { StoredCard } from "./db";
import { getBundle, saveBundle, enqueueReview, isIndexedDbAvailable } from "./db";
import { renderOfflineCard, renderOfflineFeedback, renderOfflineDone, renderOfflineEmpty } from "./render";
import { scoreAutoAnswer, scoreSelfRating, type SelfRating } from "./scoring";
import type { Card } from "../../core/domain/types";
import type { Locale } from "../../i18n";

/** StoredCard (the IndexedDB shape) has no createdAt — scoreAutoAnswer only reads type/payload, so a placeholder is fine. */
function toCard(stored: StoredCard): Card {
  return { ...stored, createdAt: new Date(0) } as Card;
}

let queue: StoredCard[] = [];
let idx = 0;
let total = 0;
let reviewedCount = 0;
let offlineModeActive = false;

function locale(): Locale {
  return document.documentElement.lang === "en" ? "en" : "pl";
}

function schedulerPreference(): string {
  return document.documentElement.dataset.schedulerPreference ?? "sm2";
}

async function recordReview(cardId: string, quality: number): Promise<void> {
  await enqueueReview({
    cardId,
    quality,
    answeredAt: new Date().toISOString(),
    schedulerPreference: schedulerPreference(),
  });
  // src/client/offline/sync.ts (loaded on every page via BaseLayout) listens
  // for this to refresh the visible "N reviews pending sync" indicator
  // immediately, without a hard dependency between the two modules.
  window.dispatchEvent(new Event("kartka:offline-review-queued"));
}

function wireCardHandlers(area: HTMLElement, card: StoredCard): void {
  const form = area.querySelector<HTMLFormElement>("[data-offline-answer-form]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const answer = String(new FormData(form).get("answer") ?? "");
      void onAutoAnswer(area, card, answer);
    });
  }

  const ratingGroup = area.querySelector<HTMLElement>("[data-offline-rating]");
  ratingGroup?.querySelectorAll<HTMLButtonElement>("[data-rating]").forEach((btn) => {
    btn.addEventListener("click", () => void onSelfRating(area, card, btn.dataset.rating as SelfRating));
  });
}

async function onAutoAnswer(area: HTMLElement, card: StoredCard, answer: string): Promise<void> {
  const loc = locale();
  const { correct, correctAnswerText, quality } = scoreAutoAnswer(toCard(card), answer, loc);
  await recordReview(card.id, quality);
  area.innerHTML = renderOfflineFeedback(correct, correctAnswerText, loc);
  wireFeedbackNext(area);
}

async function onSelfRating(area: HTMLElement, card: StoredCard, rating: SelfRating): Promise<void> {
  const quality = scoreSelfRating(rating);
  await recordReview(card.id, quality);
  idx += 1;
  reviewedCount += 1;
  renderCurrent(area);
}

function wireFeedbackNext(area: HTMLElement): void {
  const btn = area.querySelector<HTMLButtonElement>("[data-offline-next]");
  btn?.addEventListener("click", () => {
    idx += 1;
    reviewedCount += 1;
    renderCurrent(area);
  });
}

function renderCurrent(area: HTMLElement): void {
  const loc = locale();
  if (total === 0) {
    area.innerHTML = renderOfflineEmpty(loc);
    return;
  }
  if (idx >= queue.length) {
    area.innerHTML = renderOfflineDone(reviewedCount, loc);
    return;
  }
  const card = queue[idx]!;
  area.innerHTML = renderOfflineCard(card, idx + 1, total, loc);
  wireCardHandlers(area, card);
}

async function enterOfflineMode(area: HTMLElement): Promise<void> {
  if (offlineModeActive) return;
  offlineModeActive = true;
  queue = await getBundle();
  total = queue.length;
  idx = 0;
  reviewedCount = 0;
  renderCurrent(area);
}

/** Explicit online-time fetch + IndexedDB cache of the due-cards bundle — see slice spec item 1. Best-effort; a failure here just means offline mode falls back to whatever was cached from a previous visit (or nothing, if this is the very first visit). */
async function refreshBundleIfOnline(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const res = await fetch("/api/review/offline-bundle");
    if (!res.ok) return;
    const data = (await res.json()) as { cards: StoredCard[] };
    await saveBundle(data.cards);
  } catch {
    // best-effort cache warm — offline mode just uses whatever was cached before
  }
}

export function initOfflineReview(): void {
  if (!isIndexedDbAvailable()) return;
  const area = document.getElementById("review-area");
  if (!area) return;

  void refreshBundleIfOnline();

  if (!navigator.onLine) {
    void enterOfflineMode(area);
  }

  // Mid-session fallback: the network drops while the SSR/htmx flow is
  // running an /api/review/answer or /api/review/rate round trip — htmx
  // fires these events when the underlying fetch fails.
  area.addEventListener("htmx:sendError", () => void enterOfflineMode(area));
  area.addEventListener("htmx:responseError", () => void enterOfflineMode(area));
  window.addEventListener("offline", () => void enterOfflineMode(area));
}
