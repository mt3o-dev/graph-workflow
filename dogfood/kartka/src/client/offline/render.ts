// Slice 6 (offline review): client-side rendering for the offline review
// path. Reuses renderCardBody (the actual per-question-type HTML, cloze
// blanking, flip-card markup, i18n'd labels) straight from
// src/lib/reviewFragments.ts — the exact same function the SSR /review page
// uses — so offline review looks and feels identical to online review, per
// the slice spec ("don't design a visibly-different offline mode UI").
// Only the *actions* differ: instead of hx-post forms hitting the server,
// these render plain buttons/forms wired up by src/client/offline/controller.ts
// to score and queue the review locally.
import type { Card } from "../../core/domain/types";
import type { Locale } from "../../i18n";
import { t } from "../../i18n";
import { escapeHtml } from "../../lib/html";
import { renderCardBody, AUTO_CHECKED } from "../../lib/reviewFragments";
import type { StoredCard } from "./db";

function toCard(stored: StoredCard): Card {
  // StoredCard is the IndexedDB-persisted shape (id/setId/type/payload only,
  // no createdAt — the review UI never needs it). Safe to widen back to Card
  // for renderCardBody's purposes, which only reads type/payload.
  return { ...stored, createdAt: new Date(0) } as Card;
}

function offlineBanner(locale: Locale): string {
  return `<p class="offline-banner" role="status">${escapeHtml(t("offline.reviewingOffline", locale))}</p>`;
}

function progressLine(current: number, total: number, locale: Locale): string {
  return `<p class="review-progress">${escapeHtml(t("review.progress", locale, { current, total }))}</p>`;
}

export function renderOfflineCard(stored: StoredCard, current: number, total: number, locale: Locale): string {
  const card = toCard(stored);
  const body = renderCardBody(card, locale);

  if (AUTO_CHECKED.has(card.type)) {
    return `<div class="review-shell">
      ${offlineBanner(locale)}
      ${progressLine(current, total, locale)}
      <form data-offline-answer-form data-card-type="${card.type}" class="card stack">
        ${body}
        <button type="submit" class="btn-primary">${escapeHtml(t("review.submitAnswer", locale))}</button>
      </form>
    </div>`;
  }

  return `<div class="review-shell">
    ${offlineBanner(locale)}
    ${progressLine(current, total, locale)}
    <div class="card">${body}</div>
    <div class="row" style="margin-top: var(--space-4)">
      <button type="button" class="btn-secondary" onclick="document.getElementById('flip').classList.toggle('is-flipped')">${escapeHtml(t("review.showAnswer", locale))}</button>
    </div>
    <div class="review-actions" data-offline-rating>
      <button type="button" class="btn rating-again" data-rating="again">${escapeHtml(t("review.again", locale))}</button>
      <button type="button" class="btn rating-hard" data-rating="hard">${escapeHtml(t("review.hard", locale))}</button>
      <button type="button" class="btn rating-good" data-rating="good">${escapeHtml(t("review.good", locale))}</button>
      <button type="button" class="btn rating-easy" data-rating="easy">${escapeHtml(t("review.easy", locale))}</button>
    </div>
  </div>`;
}

export function renderOfflineFeedback(correct: boolean, correctAnswerText: string, locale: Locale): string {
  const message = correct ? t("review.correct", locale) : t("review.incorrect", locale);
  const detail =
    !correct && correctAnswerText ? `<p>${escapeHtml(t("review.correctAnswerWas", locale, { answer: correctAnswerText }))}</p>` : "";
  return `<div class="review-shell">
    <div class="card ${correct ? "flash-correct" : ""}" role="status" aria-live="polite">
      <p><strong>${escapeHtml(message)}</strong></p>
      ${detail}
    </div>
    <div class="row" style="margin-top: var(--space-4)">
      <button type="button" class="btn-primary" data-offline-next>${escapeHtml(t("review.next", locale))}</button>
    </div>
  </div>`;
}

export function renderOfflineDone(reviewedCount: number, locale: Locale): string {
  return `<div class="review-shell" role="status" aria-live="polite">
    <p class="empty-state">${escapeHtml(t("review.sessionDone", locale, { count: reviewedCount }))}</p>
    <p class="offline-banner">${escapeHtml(t("offline.doneOfflineNotice", locale))}</p>
  </div>`;
}

export function renderOfflineEmpty(locale: Locale): string {
  return `<div class="review-shell">
    ${offlineBanner(locale)}
    <p class="empty-state">${escapeHtml(t("offline.bundleUnavailable", locale))}</p>
  </div>`;
}
