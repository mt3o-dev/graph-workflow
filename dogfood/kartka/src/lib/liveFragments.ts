// Hand-built HTML fragment renderers pushed over the live-quiz WebSocket
// (slice 11). Same pattern as src/lib/fragments.ts (server-owns-the-markup,
// no client templating), but every fragment here is wrapped for htmx-ext-ws's
// out-of-band swap (`hx-swap-oob="true"` on the #live-room container id) —
// see docs/ADR-live-transport.md for the full message-shape documentation.
import { t, type Locale } from "../i18n";
import { escapeHtml } from "./html";
import type { RoomState, PublicLiveQuestion, LiveQuestion, ScoreboardEntry } from "../core/domain/liveQuiz";
import { toPublicQuestion } from "../core/domain/liveQuiz";
import type { MultipleChoicePayload, TrueFalsePayload, TypeAnswerPayload } from "../core/domain/types";

// LiveQuestion's payload field is a distributed conditional type keyed on a
// generic default (LiveCardType, itself a union) rather than a true
// discriminated union, so `switch (question.type)` alone doesn't narrow
// `question.payload` for TS — same reason core/domain/liveQuiz.ts's
// isAnswerCorrect casts per-branch instead of relying on narrowing.
function correctAnswerDisplay(question: LiveQuestion, locale: Locale): string {
  switch (question.type) {
    case "multiple_choice": {
      const p = question.payload as MultipleChoicePayload;
      return p.options[p.correctIndex] ?? "";
    }
    case "true_false": {
      const p = question.payload as TrueFalsePayload;
      return p.isTrue ? t("live.room.question.trueLabel", locale) : t("live.room.question.falseLabel", locale);
    }
    case "type_answer": {
      const p = question.payload as TypeAnswerPayload;
      return p.acceptedAnswers[0] ?? "";
    }
  }
}

function scoreboardListHtml(entries: ScoreboardEntry[], locale: Locale): string {
  return `<ol class="stack" style="list-style:decimal;padding-left:1.5em">${entries
    .map((e) => `<li>${escapeHtml(e.displayName)} — <strong>${escapeHtml(t("live.room.scoreboard.points", locale, { score: e.score }))}</strong></li>`)
    .join("")}</ol>`;
}

/** Wraps inner markup for an out-of-band swap targeting the #live-room container. */
function oob(inner: string): string {
  return `<div id="live-room" hx-swap-oob="true" class="stack">${inner}</div>`;
}

export function renderLobbyFragment(opts: { room: RoomState; locale: Locale; isHost: boolean }): string {
  const { room, locale, isHost } = opts;
  const playerCount = Object.keys(room.players).length;
  const startButton = isHost
    ? `<form ws-send><input type="hidden" name="type" value="advance"/><button type="submit" class="btn-primary">${escapeHtml(t("live.room.lobby.startButton", locale))}</button></form>`
    : "";
  return oob(
    `<h2>${escapeHtml(t("live.room.title", locale))}</h2>
     <p>${escapeHtml(t("live.room.code", locale, { code: room.code }))}</p>
     <p><small>${escapeHtml(t("live.room.shareHint", locale))}</small></p>
     <p>${escapeHtml(t("live.room.lobby.waiting", locale))}</p>
     <p>${escapeHtml(t("live.room.lobby.playerCount", locale, { count: playerCount }))}</p>
     ${startButton}`,
  );
}

export function renderQuestionFragment(opts: {
  room: RoomState;
  question: LiveQuestion;
  index: number;
  total: number;
  locale: Locale;
  isHost: boolean;
}): string {
  const { question, index, total, locale, isHost } = opts;
  const pub: PublicLiveQuestion = toPublicQuestion(question);

  let answerForm: string;
  if (pub.type === "multiple_choice") {
    answerForm = `<form ws-send class="stack">
      <input type="hidden" name="type" value="answer"/>
      <input type="hidden" name="cardId" value="${escapeHtml(pub.cardId)}"/>
      <p>${escapeHtml(pub.question)}</p>
      ${pub.options
        .map(
          (opt, i) =>
            `<label class="row"><input type="radio" name="rawAnswer" value="${i}" required/> ${escapeHtml(opt)}</label>`,
        )
        .join("")}
      <button type="submit" class="btn-primary">${escapeHtml(t("live.room.question.submit", locale))}</button>
    </form>`;
  } else if (pub.type === "true_false") {
    answerForm = `<form ws-send class="stack">
      <input type="hidden" name="type" value="answer"/>
      <input type="hidden" name="cardId" value="${escapeHtml(pub.cardId)}"/>
      <p>${escapeHtml(pub.statement)}</p>
      <label class="row"><input type="radio" name="rawAnswer" value="true" required/> ${escapeHtml(t("live.room.question.trueLabel", locale))}</label>
      <label class="row"><input type="radio" name="rawAnswer" value="false" required/> ${escapeHtml(t("live.room.question.falseLabel", locale))}</label>
      <button type="submit" class="btn-primary">${escapeHtml(t("live.room.question.submit", locale))}</button>
    </form>`;
  } else {
    answerForm = `<form ws-send class="stack">
      <input type="hidden" name="type" value="answer"/>
      <input type="hidden" name="cardId" value="${escapeHtml(pub.cardId)}"/>
      <p>${escapeHtml(pub.prompt)}</p>
      <input type="text" name="rawAnswer" placeholder="${escapeHtml(t("live.room.question.typeAnswerPlaceholder", locale))}" required/>
      <button type="submit" class="btn-primary">${escapeHtml(t("live.room.question.submit", locale))}</button>
    </form>`;
  }

  const hostControls = isHost
    ? `<form ws-send><input type="hidden" name="type" value="advance"/><button type="submit" class="btn-secondary">${escapeHtml(t("live.room.reveal.nextButton", locale))}</button></form>`
    : "";

  return oob(
    `<h2>${escapeHtml(t("live.room.question.number", locale, { current: index + 1, total }))}</h2>
     ${answerForm}
     <p id="live-answer-status" aria-live="polite"></p>
     ${hostControls}`,
  );
}

/** Sent privately (unicast) to the socket that just submitted an answer — see live-server.ts. */
export function renderAnswerAckFragment(opts: { correct: boolean; points: number; locale: Locale }): string {
  const { correct, points, locale } = opts;
  return `<p id="live-answer-status" hx-swap-oob="true" aria-live="polite">${escapeHtml(t("live.room.question.answered", locale))} ${
    correct ? `(${escapeHtml(t("live.room.reveal.correct", locale))} +${points})` : ""
  }</p>`;
}

export function renderRevealFragment(opts: { room: RoomState; question: LiveQuestion; locale: Locale; isHost: boolean }): string {
  const { room, question, locale, isHost } = opts;
  const board = Object.values(room.players)
    .map((p) => ({ userId: p.userId, displayName: p.displayName, score: p.score }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  const hostControls = isHost
    ? `<form ws-send><input type="hidden" name="type" value="advance"/><button type="submit" class="btn-primary">${escapeHtml(t("live.room.reveal.nextButton", locale))}</button></form>`
    : "";

  return oob(
    `<h2>${escapeHtml(t("live.room.reveal.title", locale))}</h2>
     <p><strong>${escapeHtml(correctAnswerDisplay(question, locale))}</strong></p>
     <h3>${escapeHtml(t("live.room.scoreboard.title", locale))}</h3>
     ${scoreboardListHtml(board, locale)}
     ${hostControls}`,
  );
}

export function renderFinishedFragment(opts: { entries: ScoreboardEntry[]; locale: Locale }): string {
  const { entries, locale } = opts;
  return oob(
    `<h2>${escapeHtml(t("live.room.finished.title", locale))}</h2>
     <h3>${escapeHtml(t("live.room.finished.podium", locale))}</h3>
     ${scoreboardListHtml(entries, locale)}`,
  );
}

export function renderUnknownRoomFragment(locale: Locale): string {
  return oob(`<p role="alert">${escapeHtml(t("live.room.errorUnknownRoom", locale))}</p>`);
}
