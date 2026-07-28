// Hand-built HTML fragment renderers for the "AI-assisted cards" htmx flow
// (slice 2). Mirrors the hand-built-fragment approach already used in
// lib/fragments.ts (see that file's header comment for why).
import { t, type Locale } from "../i18n";
import type {
  CardDraft,
  BasicPayload,
  ClozePayload,
  MultipleChoicePayload,
  TrueFalsePayload,
  TypeAnswerPayload,
} from "../core/domain/types";
import { escapeHtml } from "./html";

export function renderLlmNotConfiguredFragment(locale: Locale): string {
  return `<div id="llm-drafts" class="card"><p class="empty-state">${escapeHtml(t("llm.notConfigured", locale))}</p></div>`;
}

export function renderLlmErrorFragment(locale: Locale, kind: "generic" | "onlyTextFiles" | "sourceRequired"): string {
  const key =
    kind === "onlyTextFiles" ? "llm.error.onlyTextFiles" : kind === "sourceRequired" ? "llm.error.sourceRequired" : "llm.error.generic";
  return `<div id="llm-drafts" class="card"><p class="empty-state">${escapeHtml(t(key as never, locale))}</p></div>`;
}

/**
 * Renders each draft as a small, EDITABLE form pre-filled with the model's
 * proposed payload, posting to the existing (ownership-checked)
 * `POST /api/sets/:id/cards` endpoint. Submitting = "accept" (or "edit then
 * accept", since the fields are just editable inputs); the "reject" button
 * only removes the block from the DOM — nothing was ever persisted, so
 * rejecting needs no server round trip.
 */
export function renderLlmDraftsFragment(opts: { setId: string; drafts: CardDraft[]; locale: Locale }): string {
  const { setId, drafts, locale } = opts;

  if (drafts.length === 0) {
    return `<div id="llm-drafts" class="card"><p class="empty-state">${escapeHtml(t("llm.noDrafts", locale))}</p></div>`;
  }

  const items = drafts
    .map((draft, i) => {
      const confidencePct = Math.round(draft.confidence * 100);
      return `<li class="card llm-draft" id="llm-draft-${i}">
        <div class="llm-draft-meta">
          <span class="badge">${escapeHtml(t(`cards.type.${draft.type}` as never, locale))}</span>
          ${escapeHtml(t("llm.confidence", locale, { pct: confidencePct }))}
          ${draft.rationale ? `— ${escapeHtml(draft.rationale)}` : ""}
        </div>
        <form method="post" action="/api/sets/${escapeHtml(setId)}/cards" class="stack" style="margin-top: var(--space-2)">
          <input type="hidden" name="type" value="${escapeHtml(draft.type)}" />
          ${draftFieldsHtml(draft, locale)}
          <div class="row">
            <button type="submit" class="btn-primary">${escapeHtml(t("llm.accept", locale))}</button>
            <button type="button" class="btn-danger" onclick="document.getElementById('llm-draft-${i}').remove()">${escapeHtml(t("llm.reject", locale))}</button>
          </div>
        </form>
      </li>`;
    })
    .join("");

  return `<div id="llm-drafts"><ul class="stack stagger" style="list-style:none;padding:0">${items}</ul></div>`;
}

function draftFieldsHtml(draft: CardDraft, locale: Locale): string {
  switch (draft.type) {
    case "basic": {
      const p = draft.payload as BasicPayload;
      return `<div class="field">
        <label>${escapeHtml(t("cards.form.front", locale))}</label>
        <textarea name="front">${escapeHtml(p.front)}</textarea>
      </div>
      <div class="field">
        <label>${escapeHtml(t("cards.form.back", locale))}</label>
        <textarea name="back">${escapeHtml(p.back)}</textarea>
      </div>`;
    }
    case "cloze": {
      const p = draft.payload as ClozePayload;
      return `<div class="field">
        <label>${escapeHtml(t("cards.form.clozeText", locale))}</label>
        <textarea name="text">${escapeHtml(p.text)}</textarea>
      </div>`;
    }
    case "multiple_choice": {
      const p = draft.payload as MultipleChoicePayload;
      return `<div class="field">
        <label>${escapeHtml(t("cards.form.question", locale))}</label>
        <input name="question" value="${escapeHtml(p.question)}" />
      </div>
      <div class="field">
        <label>${escapeHtml(t("cards.form.options", locale))}</label>
        ${p.options
          .map(
            (opt, i) => `<div class="row">
              <input type="radio" name="correctIndex" value="${i}" ${i === p.correctIndex ? "checked" : ""} aria-label="${escapeHtml(t("cards.form.correctOption", locale))}" />
              <input name="options" value="${escapeHtml(opt)}" />
            </div>`,
          )
          .join("")}
      </div>`;
    }
    case "true_false": {
      const p = draft.payload as TrueFalsePayload;
      return `<div class="field">
        <label>${escapeHtml(t("cards.form.statement", locale))}</label>
        <input name="statement" value="${escapeHtml(p.statement)}" />
      </div>
      <div class="field row">
        <input type="checkbox" name="isTrue" ${p.isTrue ? "checked" : ""} />
        <label style="margin:0">${escapeHtml(t("cards.form.isTrue", locale))}</label>
      </div>`;
    }
    case "type_answer": {
      const p = draft.payload as TypeAnswerPayload;
      return `<div class="field">
        <label>${escapeHtml(t("cards.form.prompt", locale))}</label>
        <input name="prompt" value="${escapeHtml(p.prompt)}" />
      </div>
      <div class="field">
        <label>${escapeHtml(t("cards.form.acceptedAnswers", locale))}</label>
        <textarea name="acceptedAnswers" rows="3">${escapeHtml(p.acceptedAnswers.join("\n"))}</textarea>
      </div>`;
    }
    default:
      // image_occlusion drafts are filtered out upstream (validateDrafts requires a
      // real imageUrl, which the LLM never has in this text-only slice) — this
      // branch exists only so the switch stays exhaustive-safe.
      return "";
  }
}
