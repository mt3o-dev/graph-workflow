// Live quiz (slice 11): pure domain types + logic for a Kahoot-style room.
// Zero imports from adapters/*, astro:*, or any framework/transport code —
// see docs/architecture.md's hexagonal boundary rule. Everything in this
// file is testable with plain values and no socket/network in sight.
//
// Scope (per context/foundation/roadmap.md "Live quiz architecture"):
// only the three already-auto-scored question types play in live mode.
// cloze/basic/image_occlusion are excluded at the usecase layer (see
// liveQuizUsecases.createLiveSession) before a RoomState is ever built.
// A live round is ungraded practice — it NEVER reads or writes
// ReviewState/FsrsReviewState. See docs/TODO.md for the deferred
// "exposure log" idea (not built in this slice).

import type { MultipleChoicePayload, TrueFalsePayload, TypeAnswerPayload } from "./types";
import { matchesAnyAccepted } from "./levenshtein";
import { NotFoundError, ValidationError } from "./errors";

/** The only card types eligible for a live round — see roadmap's scope cut. */
export type LiveCardType = "multiple_choice" | "true_false" | "type_answer";
export const LIVE_CARD_TYPES: readonly LiveCardType[] = ["multiple_choice", "true_false", "type_answer"];

export function isLiveEligibleType(type: string): type is LiveCardType {
  return (LIVE_CARD_TYPES as readonly string[]).includes(type);
}

export type LiveQuestionPayload<TType extends LiveCardType = LiveCardType> = TType extends "multiple_choice"
  ? MultipleChoicePayload
  : TType extends "true_false"
    ? TrueFalsePayload
    : TType extends "type_answer"
      ? TypeAnswerPayload
      : never;

/** A live-quiz question, including the correct answer — server-side/authoritative shape. */
export interface LiveQuestion<TType extends LiveCardType = LiveCardType> {
  cardId: string;
  type: TType;
  payload: LiveQuestionPayload<TType>;
}

/**
 * The client-safe view of a question: same as LiveQuestion but with the
 * correct-answer field stripped, so it's safe to push to every player over
 * the socket *before* they've answered. See toPublicQuestion.
 */
export type PublicLiveQuestion =
  | { cardId: string; type: "multiple_choice"; question: string; options: string[] }
  | { cardId: string; type: "true_false"; statement: string }
  | { cardId: string; type: "type_answer"; prompt: string };

export function toPublicQuestion(q: LiveQuestion): PublicLiveQuestion {
  switch (q.type) {
    case "multiple_choice": {
      const p = q.payload as MultipleChoicePayload;
      return { cardId: q.cardId, type: "multiple_choice", question: p.question, options: p.options };
    }
    case "true_false": {
      const p = q.payload as TrueFalsePayload;
      return { cardId: q.cardId, type: "true_false", statement: p.statement };
    }
    case "type_answer": {
      const p = q.payload as TypeAnswerPayload;
      return { cardId: q.cardId, type: "type_answer", prompt: p.prompt };
    }
  }
}

/**
 * Correctness check per question type. Multiple_choice/true_false are plain
 * equality checks intrinsic to their shape (not a "quality" judgment — see
 * core/domain/quality.ts's header comment: that module maps an *already
 * known* correct/incorrect boolean onto the 0-5 SM-2 quality scale used by
 * spaced-repetition review, which this slice deliberately never touches).
 * type_answer reuses the existing fuzzy-match helper (levenshtein.ts) rather
 * than reimplementing typo tolerance — per the roadmap's explicit reuse
 * instruction.
 */
export function isAnswerCorrect(question: LiveQuestion, rawAnswer: string): boolean {
  switch (question.type) {
    case "multiple_choice": {
      const idx = Number.parseInt(rawAnswer, 10);
      return Number.isInteger(idx) && idx === (question.payload as MultipleChoicePayload).correctIndex;
    }
    case "true_false": {
      const chosenTrue = rawAnswer === "true" || rawAnswer === "1";
      return chosenTrue === (question.payload as TrueFalsePayload).isTrue;
    }
    case "type_answer": {
      return matchesAnyAccepted(rawAnswer, (question.payload as TypeAnswerPayload).acceptedAnswers);
    }
    default: {
      const _exhaustive: never = question.type;
      return _exhaustive;
    }
  }
}

/**
 * Scoring formula (kept intentionally simple):
 *   - wrong (or unanswered/timed-out) answer: 0 points.
 *   - correct answer: BASE_POINTS, plus a linear speed bonus of up to
 *     MAX_SPEED_BONUS extra points for answering instantly, decaying to 0
 *     bonus right at the time limit. elapsedMs is clamped to
 *     [0, questionTimeLimitMs] so a late/out-of-range submission never goes
 *     negative or above the max.
 *
 *     speedBonus = MAX_SPEED_BONUS * (1 - elapsedMs / questionTimeLimitMs)
 */
export const BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 500;
export const QUESTION_TIME_LIMIT_MS = 20_000;

export interface LiveAnswerResult {
  correct: boolean;
  points: number;
}

export function scoreAnswer(
  question: LiveQuestion,
  rawAnswer: string,
  elapsedMs: number,
  questionTimeLimitMs: number = QUESTION_TIME_LIMIT_MS,
): LiveAnswerResult {
  const correct = isAnswerCorrect(question, rawAnswer);
  if (!correct) return { correct: false, points: 0 };
  const clampedElapsed = Math.min(Math.max(elapsedMs, 0), questionTimeLimitMs);
  const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - clampedElapsed / questionTimeLimitMs));
  return { correct: true, points: BASE_POINTS + speedBonus };
}

/** Round phase state machine: lobby -> (question-live <-> reveal)* -> finished. */
export type RoomPhase = "lobby" | "question-live" | "reveal" | "finished";

export interface RoomPlayerAnswer {
  cardId: string;
  correct: boolean;
  points: number;
  submittedAtMs: number;
}

export interface RoomPlayer {
  userId: string;
  displayName: string;
  score: number;
  /** Keyed by cardId — at most one recorded answer per question per player. */
  answers: Record<string, RoomPlayerAnswer>;
  /**
   * Slice 12 (teams): null while team mode isn't configured for this room
   * (or a player joined after teams were cleared/never set up) — see
   * RoomState.teamIds' header comment. Teams are opt-in and additive: a
   * room that never calls configureTeams behaves exactly like slice 11.
   */
  teamId: string | null;
}

export interface RoomState {
  code: string;
  hostId: string;
  setId: string;
  questions: LiveQuestion[];
  /** -1 while phase is "lobby" (no question started yet). */
  currentQuestionIndex: number;
  phase: RoomPhase;
  players: Record<string, RoomPlayer>;
  /** ms epoch the current question went live; null in lobby/finished. */
  questionStartedAtMs: number | null;
  createdAt: Date;
  /**
   * Slice 12 (teams): the ordered list of team ids currently configured for
   * this room, e.g. ["team-1", "team-2", "team-3"]. Empty means "team mode
   * not configured" — individual-only, exactly slice 11's behavior. Ids are
   * plain positional slugs (not translated display strings) because the
   * domain layer must stay framework/locale-free; the UI derives a
   * human label ("Team {n}") from the id's position via i18n at render time
   * (see liveFragments.ts), the same way every other UI string in this app
   * is kept out of core/domain.
   */
  teamIds: string[];
}

export interface ScoreboardEntry {
  userId: string;
  displayName: string;
  score: number;
}

/**
 * Slice 12: one row of the team-ranked leaderboard. `score` is the SUM of
 * its members' individual scores (not an average) — chosen because this is
 * a classroom tool: a team that recruits/keeps more engaged players should
 * rank higher, which rewards participation the same way a real team-based
 * classroom activity would. An average would instead reward small teams
 * for having one strong player, which undermines the "get everyone
 * playing" point of team mode. Per-player scores are completely unaffected
 * by team mode (see recordAnswer) — this is purely a read-side aggregation.
 */
export interface TeamScoreboardEntry {
  teamId: string;
  score: number;
  playerCount: number;
}

// --- Room codes -------------------------------------------------------
// Short, human-typeable, NOT a security boundary (a shared classroom code is
// inherently guessable/shareable by design — see roadmap). Excludes visually
// ambiguous characters (0/O, 1/I/L) and is generated from crypto randomness
// so codes aren't trivially sequential, without over-engineering entropy for
// what is fundamentally a "read it off the projector" identifier.
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function isValidRoomCode(value: string): boolean {
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(value.toUpperCase());
}

// --- Pure room-state transitions ---------------------------------------
// These are the only functions that touch RoomState shape; the in-memory
// adapter (src/adapters/liveQuiz/inMemoryLiveSessionPort.ts) is a thin Map
// wrapper around them — all the actual rules live here, framework-free.

export function createRoomState(input: {
  code: string;
  hostId: string;
  setId: string;
  questions: LiveQuestion[];
  now?: Date;
}): RoomState {
  if (input.questions.length === 0) {
    throw new ValidationError("A live session needs at least one eligible question");
  }
  return {
    code: input.code,
    hostId: input.hostId,
    setId: input.setId,
    questions: input.questions,
    currentQuestionIndex: -1,
    phase: "lobby",
    players: {},
    questionStartedAtMs: null,
    createdAt: input.now ?? new Date(),
    teamIds: [],
  };
}

/** Idempotent: rejoining (e.g. after a reconnect) keeps the existing score and team assignment. */
export function addPlayer(room: RoomState, player: { userId: string; displayName: string }): RoomState {
  const existing = room.players[player.userId];
  const nextPlayer: RoomPlayer = existing
    ? { ...existing, displayName: player.displayName }
    : { userId: player.userId, displayName: player.displayName, score: 0, answers: {}, teamId: null };
  return { ...room, players: { ...room.players, [player.userId]: nextPlayer } };
}

export function currentQuestion(room: RoomState): LiveQuestion | null {
  return room.questions[room.currentQuestionIndex] ?? null;
}

/**
 * Host-driven transition. From "lobby" or "reveal", moves to the next
 * question ("question-live"), or to "finished" if the questions are
 * exhausted. From "question-live", moves to "reveal" for the current
 * question instead of advancing the index — see liveQuizUsecases.advanceLiveQuestion
 * for why both of these are exposed through the same "advance" action.
 */
export function advancePhase(room: RoomState, now: Date): RoomState {
  if (room.phase === "question-live") {
    return { ...room, phase: "reveal" };
  }
  if (room.phase === "finished") return room;

  const nextIndex = room.currentQuestionIndex + 1;
  if (nextIndex >= room.questions.length) {
    return { ...room, phase: "finished", currentQuestionIndex: room.questions.length, questionStartedAtMs: null };
  }
  return { ...room, phase: "question-live", currentQuestionIndex: nextIndex, questionStartedAtMs: now.getTime() };
}

/**
 * Records one player's answer to the room's current question. Throws
 * ValidationError if the room isn't in "question-live", if cardId doesn't
 * match the current question, or if this player already answered it (no
 * double-scoring). Returns the updated room plus the scoring result for the
 * answer just recorded.
 */
export function recordAnswer(
  room: RoomState,
  userId: string,
  cardId: string,
  rawAnswer: string,
  now: Date,
): { room: RoomState; result: LiveAnswerResult } {
  if (room.phase !== "question-live" || room.questionStartedAtMs === null) {
    throw new ValidationError("No question is currently live");
  }
  const question = currentQuestion(room);
  if (!question || question.cardId !== cardId) {
    throw new ValidationError("Answer does not match the current question");
  }
  const player = room.players[userId];
  if (!player) throw new NotFoundError("Player");
  if (player.answers[cardId]) throw new ValidationError("Already answered this question");

  const elapsedMs = now.getTime() - room.questionStartedAtMs;
  const result = scoreAnswer(question, rawAnswer, elapsedMs);
  const answer: RoomPlayerAnswer = { cardId, correct: result.correct, points: result.points, submittedAtMs: now.getTime() };
  const updatedPlayer: RoomPlayer = {
    ...player,
    score: player.score + result.points,
    answers: { ...player.answers, [cardId]: answer },
  };
  return {
    room: { ...room, players: { ...room.players, [userId]: updatedPlayer } },
    result,
  };
}

/** Highest score first; ties broken alphabetically by display name for determinism. */
export function scoreboard(room: RoomState): ScoreboardEntry[] {
  return Object.values(room.players)
    .map((p) => ({ userId: p.userId, displayName: p.displayName, score: p.score }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}

// --- Teams (slice 12) ---------------------------------------------------
// Opt-in, host-configured grouping of joined players. Nothing here is
// enforced as an ownership/host-only check — that's the usecase layer's job
// (liveQuizUsecases.setLiveTeams/assignPlayerTeam), matching the exact
// pattern advancePhase/advanceLiveQuestion already use: the domain function
// is a pure transition, the usecase is where hostId gets checked against
// room.hostId. Both team functions additionally reject any call once the
// room has left "lobby" — team composition is a pre-game setup step, not
// something that can be changed mid-round (roadmap's "before the round
// starts, during the lobby phase" scope cut).

/** Fisher-Yates using the same crypto.getRandomValues source as generateRoomCode, for real (non-test) randomness. */
function cryptoShuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0]! % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Host-only (enforced by the caller — see usecase): splits every currently
 * joined player into `teamCount` teams as evenly as possible via a shuffle +
 * round-robin assignment. Safe to call more than once before the round
 * starts — each call replaces the previous team configuration and
 * re-shuffles, which is exactly the "shuffle/rebalance before starting" UX
 * the roadmap asks for; there's no separate "shuffle" action; re-running
 * this one does it.
 *
 * `shuffle` is injectable so tests can pass an identity function and assert
 * an exact, deterministic distribution (see tests/liveQuiz.test.ts) instead
 * of asserting on randomness.
 */
export function configureTeams(
  room: RoomState,
  teamCount: number,
  shuffle: <T>(items: readonly T[]) => T[] = cryptoShuffle,
): RoomState {
  if (room.phase !== "lobby") {
    throw new ValidationError("Teams can only be configured during the lobby phase");
  }
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new ValidationError("Team count must be a positive integer");
  }
  const teamIds = Array.from({ length: teamCount }, (_, i) => `team-${i + 1}`);
  const shuffledPlayerIds = shuffle(Object.keys(room.players));

  const nextPlayers: Record<string, RoomPlayer> = { ...room.players };
  shuffledPlayerIds.forEach((userId, i) => {
    const player = nextPlayers[userId];
    if (!player) return;
    nextPlayers[userId] = { ...player, teamId: teamIds[i % teamCount]! };
  });

  return { ...room, teamIds, players: nextPlayers };
}

/**
 * Host-only (enforced by the caller): moves a single player to a different
 * (or no) team, for manual fine-tuning after the auto-split. `teamId` must
 * be one of `room.teamIds`, or `null` to unassign the player from any team.
 */
export function assignPlayerTeam(room: RoomState, userId: string, teamId: string | null): RoomState {
  if (room.phase !== "lobby") {
    throw new ValidationError("Teams can only be reassigned during the lobby phase");
  }
  const player = room.players[userId];
  if (!player) throw new NotFoundError("Player");
  if (teamId !== null && !room.teamIds.includes(teamId)) {
    throw new ValidationError("Unknown team");
  }
  return { ...room, players: { ...room.players, [userId]: { ...player, teamId } } };
}

/**
 * Team-ranked leaderboard: each team's score is the SUM of its members'
 * individual scores (see TeamScoreboardEntry's doc comment for why sum over
 * average). Returns `[]` if team mode isn't configured (room.teamIds is
 * empty) — callers should treat that as "no team leaderboard to show", not
 * an error. Teams with no players currently assigned still appear, with
 * score 0 and playerCount 0, so the host can see an empty team needs
 * rebalancing.
 */
export function teamScoreboard(room: RoomState): TeamScoreboardEntry[] {
  if (room.teamIds.length === 0) return [];
  const totals = new Map<string, { score: number; playerCount: number }>();
  for (const teamId of room.teamIds) totals.set(teamId, { score: 0, playerCount: 0 });
  for (const player of Object.values(room.players)) {
    if (player.teamId === null) continue;
    const bucket = totals.get(player.teamId);
    if (!bucket) continue; // defensive: stale teamId no longer configured
    bucket.score += player.score;
    bucket.playerCount += 1;
  }
  return [...totals.entries()]
    .map(([teamId, v]) => ({ teamId, score: v.score, playerCount: v.playerCount }))
    .sort((a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId));
}
