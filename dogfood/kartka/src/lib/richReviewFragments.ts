// Rich (markdown+KaTeX+syntax-highlighted-code) equivalents of the plain
// fragment renderers in reviewFragments.ts — kept in a SEPARATE file on
// purpose. reviewFragments.ts is imported by src/client/offline/render.ts
// and therefore gets bundled into the browser for the offline-review path
// (slice 6); this file imports src/core/domain/richContent.ts, which pulls
// in marked/katex/shiki/sanitize-html — real parser/highlighter libraries
// that must stay server-side only. Nothing in src/client/** may import from
// this file. Only server-rendered pages/API routes (src/pages/**) do.
import type { Card, CardPayload, CardType } from "../core/domain/types";
import type { CardRepoPort } from "../core/ports/cardRepoPort";
import { t, type Locale } from "../i18n";
import { escapeHtml } from "./html";
import { renderClozeHidden, renderClozeRevealed } from "../core/domain/cloze";
import { renderRichText, renderRichTextInline } from "../core/domain/richContent";
import { AUTO_CHECKED, renderSessionDone } from "./reviewFragments";

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

/** Rich, fully sanitized version of reviewFragments.ts's renderCardBody — used by every server-rendered review surface. */
export async function renderCardBodyRich(card: Card, locale: Locale): Promise<string> {
  const p = card.payload as Record<string, unknown>;
  switch (card.type) {
    case "basic": {
      const [front, back] = await Promise.all([renderRichText(String(p.front)), renderRichText(String(p.back))]);
      return `<div class="flip-card" id="flip"><div class="flip-card-inner"><div class="flip-card-face flip-card-front rich-content">${front}</div><div class="flip-card-face flip-card-back rich-content">${back}</div></div></div>`;
    }
    case "cloze": {
      const text = String(p.text);
      const [hidden, revealed] = await Promise.all([
        renderRichText(renderClozeHidden(text)),
        renderRichText(renderClozeRevealed(text)),
      ]);
      return `<div class="flip-card" id="flip"><div class="flip-card-inner"><div class="flip-card-face flip-card-front rich-content">${hidden}</div><div class="flip-card-face flip-card-back rich-content">${revealed}</div></div></div>`;
    }
    case "image_occlusion": {
      // Region labels are stored in a `data-label` attribute (no current UI
      // renders them as HTML — see richContent.ts / the slice report), so
      // they stay plain-escaped-attribute here; write-time sanitization
      // still applies to them uniformly via sanitizeCardPayload.
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
      const [question, renderedOptions] = await Promise.all([
        renderRichText(String(p.question)),
        Promise.all(options.map((o) => renderRichText(o))),
      ]);
      return `<div class="rich-content">${question}</div><div class="mc-options">${renderedOptions
        .map((o, i) => `<label class="row"><input type="radio" name="answer" value="${i}" required/> <span class="rich-content">${o}</span></label>`)
        .join("")}</div>`;
    }
    case "true_false": {
      const statement = await renderRichText(String(p.statement));
      return `<div class="rich-content">${statement}</div><div class="row"><label><input type="radio" name="answer" value="true" required/> ${escapeHtml(t("review.trueFalse.true", locale))}</label><label><input type="radio" name="answer" value="false"/> ${escapeHtml(t("review.trueFalse.false", locale))}</label></div>`;
    }
    case "type_answer": {
      const prompt = await renderRichText(String(p.prompt));
      return `<div class="rich-content">${prompt}</div><input name="answer" placeholder="${escapeHtml(t("review.typeAnswer.placeholder", locale))}" autocomplete="off" required/>`;
    }
    default:
      return "";
  }
}

/**
 * Modest render-only preview for the card create/edit form's "Preview"
 * button (slice 7 spec item 5) — renders exactly what renderCardBodyRich
 * would show, minus the interactive review-only chrome (radio inputs,
 * flip-card animation), since this is just a WYSIWYG-ish sanity check while
 * authoring, not a second flashcard UI.
 */
export async function renderPreview(type: CardType, payload: CardPayload): Promise<string> {
  const p = payload as Record<string, unknown>;
  switch (type) {
    case "basic": {
      const [front, back] = await Promise.all([
        renderRichText(String(p.front ?? "")),
        renderRichText(String(p.back ?? "")),
      ]);
      return `<div class="rich-content">${front}</div><hr/><div class="rich-content">${back}</div>`;
    }
    case "cloze": {
      const text = String(p.text ?? "");
      const revealed = await renderRichText(renderClozeRevealed(text));
      return `<div class="rich-content">${revealed}</div>`;
    }
    case "multiple_choice": {
      const options = (p.options as string[] | undefined) ?? [];
      const [question, renderedOptions] = await Promise.all([
        renderRichText(String(p.question ?? "")),
        Promise.all(options.map((o) => renderRichText(o))),
      ]);
      return `<div class="rich-content">${question}</div><ul>${renderedOptions.map((o) => `<li class="rich-content">${o}</li>`).join("")}</ul>`;
    }
    case "true_false": {
      const statement = await renderRichText(String(p.statement ?? ""));
      return `<div class="rich-content">${statement}</div>`;
    }
    case "type_answer": {
      const prompt = await renderRichText(String(p.prompt ?? ""));
      const answers = (p.acceptedAnswers as string[] | undefined) ?? [];
      const renderedAnswers = await Promise.all(answers.map((a) => renderRichText(a)));
      return `<div class="rich-content">${prompt}</div><ul>${renderedAnswers.map((a) => `<li class="rich-content">${a}</li>`).join("")}</ul>`;
    }
    case "image_occlusion": {
      const regions = (p.regions as Array<{ label?: string }> | undefined) ?? [];
      const renderedLabels = await Promise.all(regions.map((r) => renderRichText(r.label ?? "")));
      return `<ul>${renderedLabels.map((l) => `<li class="rich-content">${l}</li>`).join("")}</ul>`;
    }
    default:
      return "";
  }
}

/** Rich version of reviewFragments.ts's renderCardFragment. */
export async function renderCardFragmentRich(card: Card, queue: string[], current: number, total: number, locale: Locale): Promise<string> {
  const queueCsv = queue.join(",");
  const body = await renderCardBodyRich(card, locale);

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

/** Rich version of reviewFragments.ts's renderNext. */
export async function renderNextRich(
  cardRepo: CardRepoPort,
  queue: string[],
  total: number,
  reviewed: number,
  locale: Locale,
): Promise<string> {
  if (queue.length === 0) return renderSessionDone(reviewed, locale);
  const [nextId, ...rest] = queue;
  const card = await cardRepo.findById(nextId!);
  if (!card) return renderNextRich(cardRepo, rest, total, reviewed, locale);
  return renderCardFragmentRich(card, rest, reviewed + 1, total, locale);
}

/** Placeholder swapped for the rich-rendered answer text — chosen because it contains no markdown/HTML-special characters, so it can't collide with real translated text. */
const ANSWER_PLACEHOLDER = " ANSWER ";

/** Rich version of reviewFragments.ts's feedbackFragment — rich-renders the "correct answer was: X" text (options/acceptedAnswers content, per the slice spec). */
export async function feedbackFragmentRich(opts: {
  correct: boolean;
  correctAnswerText?: string;
  queue: string[];
  total: number;
  reviewed: number;
  locale: Locale;
}): Promise<string> {
  const { correct, correctAnswerText, queue, total, reviewed, locale } = opts;
  const nextUrl = `/api/review/next?queue=${encodeURIComponent(queue.join(","))}&total=${total}&reviewed=${reviewed}&lang=${locale}`;
  const message = correct ? t("review.correct", locale) : t("review.incorrect", locale);
  let detail = "";
  if (!correct && correctAnswerText) {
    // Render the i18n template with escapeHtml first (protects the
    // surrounding translated text), then splice in the *already-sanitized*
    // rich HTML for the answer itself via a placeholder token — this lets
    // the answer show markdown/math/code formatting without also having to
    // trust (or double-escape) the translated wrapper string.
    const template = t("review.correctAnswerWas", locale, { answer: ANSWER_PLACEHOLDER });
    const richAnswer = await renderRichTextInline(correctAnswerText);
    detail = `<p>${escapeHtml(template).replace(ANSWER_PLACEHOLDER, richAnswer)}</p>`;
  }
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
