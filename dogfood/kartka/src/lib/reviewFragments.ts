import type { Card } from "../core/domain/types";
import type { CardRepoPort } from "../core/ports/cardRepoPort";
import { t, type Locale } from "../i18n";
import { escapeHtml } from "./html";
import { renderClozeHidden } from "../core/domain/cloze";

// Exported so src/client/offline/render.ts (slice 6) can reuse the exact same
// auto-checked/self-rated split client-side, instead of re-deciding it.
export const AUTO_CHECKED = new Set(["multiple_choice", "true_false", "type_answer"]);

// IMPORTANT — bundle-safety constraint (slice 7):
// This file is imported by src/client/offline/render.ts and therefore gets
// bundled straight into the *browser* for the offline-review path (slice 6).
// It must NEVER import src/core/domain/richContent.ts (or anything that
// pulls in marked/katex/shiki/sanitize-html) — those libraries are meant to
// run server-side only. A first pass at this slice added that import here
// and it silently dragged Shiki's entire per-language grammar set (multiple
// megabytes) into the client bundle, because a module with side-effecting
// top-level code (richContent.ts constructs a Marked instance at import
// time) can't be tree-shaken away just because only some of its exports are
// used. The rich-rendering equivalents of the functions below live in
// src/lib/richReviewFragments.ts instead, which only server-rendered pages
// import. See that file's header comment and the slice report for the
// disclosed limitation this implies for offline-queued reviews (plain
// escaped text only, no markdown/math/code, while offline).
function progressLine(current: number, total: number, locale: Locale): string {
  return `<p class="review-progress">${escapeHtml(t("review.progress", locale, { current, total }))}</p>`;
}

function selfRatingButtonsLocalized(cardId: string, queue: string, current: number, total: number, locale: Locale): string {
  const common = `hx-post="/api/review/rate" hx-target="#review-area" hx-swap="innerHTML"`;
  const hidden = `<input type="hidden" name="cardId" value="${cardId}"/><input type="hidden" name="queue" value="${escapeHtml(queue)}"/><input type="hidden" name="current" value="${current}"/><input type="hidden" name="total" value="${total}"/><input type="hidden" name="lang" value="${locale}"/>`;
  const btn = (rating: string, label: string, cls: string) =>
    `<form ${common}>${hidden}<input type="hidden" name="rating" value="${rating}"/><button type="submit" class="btn rating-${cls}">${escapeHtml(label)}</button></form>`;
  return `<div class="review-actions">${btn("again", t("review.again", locale), "again")}${btn("hard", t("review.hard", locale), "hard")}${btn("good", t("review.good", locale), "good")}${btn("easy", t("review.easy", locale), "easy")}</div>`;
}

export function renderCardBody(card: Card, locale: Locale): string {
  const p = card.payload as Record<string, unknown>;
  switch (card.type) {
    case "basic":
      return `<div class="flip-card" id="flip"><div class="flip-card-inner"><div class="flip-card-face flip-card-front">${escapeHtml(String(p.front))}</div><div class="flip-card-face flip-card-back">${escapeHtml(String(p.back))}</div></div></div>`;
    case "cloze":
      return `<div class="flip-card" id="flip"><div class="flip-card-inner"><div class="flip-card-face flip-card-front">${escapeHtml(renderClozeHidden(String(p.text)))}</div><div class="flip-card-face flip-card-back">${escapeHtml(String(p.text).replace(/\{\{c\d+::(.+?)\}\}/g, "$1"))}</div></div></div>`;
    case "image_occlusion": {
      const regions = (p.regions as Array<{ x: number; y: number; w: number; h: number; label: string }>) ?? [];
      const overlays = regions
        .map(
          (r) =>
            `<div style="position:absolute;left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;background:var(--color-teal);opacity:0.85;border-radius:4px;" data-label="${escapeHtml(r.label)}"></div>`,
        )
        .join("");
      return `<div style="position:relative;display:inline-block;max-width:100%"><img src="${escapeHtml(String(p.imageUrl))}" alt="" style="max-width:100%"/>${overlays}</div>`;
    }
    case "multiple_choice": {
      const options = (p.options as string[]) ?? [];
      return `<p>${escapeHtml(String(p.question))}</p><div class="mc-options">${options
        .map((o, i) => `<label class="row"><input type="radio" name="answer" value="${i}" required/> ${escapeHtml(o)}</label>`)
        .join("")}</div>`;
    }
    case "true_false":
      return `<p>${escapeHtml(String(p.statement))}</p><div class="row"><label><input type="radio" name="answer" value="true" required/> ${escapeHtml(t("review.trueFalse.true", locale))}</label><label><input type="radio" name="answer" value="false"/> ${escapeHtml(t("review.trueFalse.false", locale))}</label></div>`;
    case "type_answer":
      return `<p>${escapeHtml(String(p.prompt))}</p><input name="answer" placeholder="${escapeHtml(t("review.typeAnswer.placeholder", locale))}" autocomplete="off" required/>`;
    default:
      return "";
  }
}

export function renderCardFragment(card: Card, queue: string[], current: number, total: number, locale: Locale): string {
  const queueCsv = queue.join(",");
  const body = renderCardBody(card, locale);

  if (AUTO_CHECKED.has(card.type)) {
    return `<div class="review-shell">
      ${progressLine(current, total, locale)}
      <form hx-post="/api/review/answer" hx-target="#review-area" hx-swap="innerHTML" class="card stack">
        <input type="hidden" name="cardId" value="${card.id}"/>
        <input type="hidden" name="type" value="${card.type}"/>
        <input type="hidden" name="queue" value="${escapeHtml(queueCsv)}"/>
        <input type="hidden" name="current" value="${current}"/>
        <input type="hidden" name="total" value="${total}"/>
        <input type="hidden" name="lang" value="${locale}"/>
        ${body}
        <button type="submit" class="btn-primary">${escapeHtml(t("review.submitAnswer", locale))}</button>
      </form>
    </div>`;
  }

  return `<div class="review-shell">
    ${progressLine(current, total, locale)}
    <div class="card">${body}</div>
    <div class="row" style="margin-top: var(--space-4)">
      <button type="button" class="btn-secondary" onclick="document.getElementById('flip').classList.toggle('is-flipped')">${escapeHtml(t("review.showAnswer", locale))}</button>
    </div>
    ${selfRatingButtonsLocalized(card.id, queueCsv, current, total, locale)}
  </div>`;
}

export function renderSessionDone(reviewedCount: number, locale: Locale): string {
  return `<div class="review-shell" role="status" aria-live="polite">
    <p class="empty-state">${escapeHtml(t("review.sessionDone", locale, { count: reviewedCount }))}</p>
    <a href="/sets" class="btn btn-primary">${escapeHtml(t("review.backToSets", locale))}</a>
  </div>`;
}

export function renderEmpty(locale: Locale): string {
  return `<div class="review-shell"><p class="empty-state">${escapeHtml(t("review.empty", locale))}</p><a href="/sets" class="btn btn-primary">${escapeHtml(t("review.backToSets", locale))}</a></div>`;
}

export async function fetchCardOr404(cardRepo: CardRepoPort, cardId: string): Promise<Card | null> {
  return cardRepo.findById(cardId);
}

export function parseQueue(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Renders the next card in the queue (or the session-done state), advancing `reviewed`. Plain/escaped — see richReviewFragments.ts's renderNextRich for the SSR rich equivalent. */
export async function renderNext(
  cardRepo: CardRepoPort,
  queue: string[],
  total: number,
  reviewed: number,
  locale: Locale,
): Promise<string> {
  if (queue.length === 0) return renderSessionDone(reviewed, locale);
  const [nextId, ...rest] = queue;
  const card = await cardRepo.findById(nextId!);
  if (!card) return renderNext(cardRepo, rest, total, reviewed, locale);
  return renderCardFragment(card, rest, reviewed + 1, total, locale);
}

export function feedbackFragment(opts: {
  correct: boolean;
  correctAnswerText?: string;
  queue: string[];
  total: number;
  reviewed: number;
  locale: Locale;
}): string {
  const { correct, correctAnswerText, queue, total, reviewed, locale } = opts;
  const nextUrl = `/api/review/next?queue=${encodeURIComponent(queue.join(","))}&total=${total}&reviewed=${reviewed}&lang=${locale}`;
  const message = correct ? t("review.correct", locale) : t("review.incorrect", locale);
  const detail =
    !correct && correctAnswerText ? `<p>${escapeHtml(t("review.correctAnswerWas", locale, { answer: correctAnswerText }))}</p>` : "";
  return `<div class="review-shell">
    <div class="card ${correct ? "flash-correct" : ""}" role="status" aria-live="polite">
      <p><strong>${escapeHtml(message)}</strong></p>
      ${detail}
    </div>
    <div class="row" style="margin-top: var(--space-4)">
      <button type="button" class="btn-primary" hx-get="${nextUrl}" hx-target="#review-area" hx-swap="innerHTML">${escapeHtml(t("review.next", locale))}</button>
    </div>
  </div>`;
}
