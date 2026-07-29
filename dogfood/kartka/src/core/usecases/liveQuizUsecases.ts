import type { LiveSessionPort } from "../ports/liveSessionPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { LiveAnswerResult, LiveCardType, LiveQuestion, RoomState, ScoreboardEntry } from "../domain/liveQuiz";
import { isLiveEligibleType } from "../domain/liveQuiz";
import { getOwnedSet } from "./setUsecases";
import { ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";

/**
 * Orchestration only — ZERO transport/socket code in this layer (see
 * docs/architecture.md's hexagonal boundary rule and roadmap.md's live-quiz
 * architecture note). Everything here is testable against a fake in-memory
 * LiveSessionPort with no network involved; see tests/liveQuizUsecases.test.ts.
 *
 * This module never reads or writes ReviewState/FsrsReviewState — a live
 * round is ungraded practice, not a second scheduling system.
 */

export interface CreateLiveSessionInput {
  setId: string;
  hostId: string;
}

/**
 * Owner-only: starts a live session from one of the host's own sets.
 * Reuses getOwnedSet so a non-owner (even logged-in) request is rejected
 * before any room is created — this class of ownership bug has been the
 * most common review finding across this project, see docs/architecture.md.
 *
 * Only multiple_choice/true_false/type_answer cards are eligible (per the
 * roadmap's scope cut); basic/cloze/image_occlusion cards in the same set
 * are silently excluded from the question pool, not rejected outright,
 * since a mixed-type set is the normal case.
 */
export async function createLiveSession(
  port: LiveSessionPort,
  setRepo: SetRepoPort,
  cardRepo: CardRepoPort,
  input: CreateLiveSessionInput,
): Promise<RoomState> {
  await getOwnedSet(setRepo, input.setId, input.hostId); // throws NotFoundError/ForbiddenError
  const cards = await cardRepo.listAllBySet(input.setId);
  const eligible = cards.filter((c) => isLiveEligibleType(c.type));
  if (eligible.length === 0) {
    throw new ValidationError("This set has no multiple-choice/true-false/type-answer cards to play live");
  }

  const questions: LiveQuestion[] = eligible.map((c) => ({
    cardId: c.id,
    type: c.type as LiveCardType,
    payload: c.payload as LiveQuestion["payload"],
  }));

  return port.createRoom({ hostId: input.hostId, setId: input.setId, questions });
}

export interface JoinLiveSessionInput {
  code: string;
  userId: string;
  displayName: string;
}

/**
 * Any logged-in user can join an existing room by its code — no ownership
 * check here, that's the whole point of a shared classroom code (see
 * roadmap.md). An unknown/expired code fails cleanly with NotFoundError.
 */
export async function joinLiveSession(port: LiveSessionPort, input: JoinLiveSessionInput): Promise<RoomState> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  return port.joinRoom(input.code, { userId: input.userId, displayName: input.displayName });
}

export interface SubmitLiveAnswerInput {
  code: string;
  userId: string;
  cardId: string;
  rawAnswer: string;
  now?: Date;
}

/**
 * Scores one player's answer against the room's current question, reusing
 * the real domain scoring (core/domain/liveQuiz.ts's recordAnswer/scoreAnswer
 * — which in turn reuses levenshtein.ts for type_answer correctness). A
 * player who hasn't joined the room yet cannot submit an answer.
 */
export async function submitLiveAnswer(
  port: LiveSessionPort,
  input: SubmitLiveAnswerInput,
): Promise<{ room: RoomState; result: LiveAnswerResult }> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (!room.players[input.userId]) throw new ForbiddenError("Join the room before answering");
  return port.submitAnswer(input.code, input.userId, input.cardId, input.rawAnswer, input.now ?? new Date());
}

export interface AdvanceLiveQuestionInput {
  code: string;
  hostId: string;
  now?: Date;
}

/** Host-only: advances lobby/reveal->next question, or question-live->reveal. */
export async function advanceLiveQuestion(port: LiveSessionPort, input: AdvanceLiveQuestionInput): Promise<RoomState> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (room.hostId !== input.hostId) throw new ForbiddenError("Only the host can advance the question");
  return port.advanceQuestion(input.code, input.now ?? new Date());
}

export async function computeScoreboard(port: LiveSessionPort, code: string): Promise<ScoreboardEntry[]> {
  const room = await port.getRoom(code);
  if (!room) throw new NotFoundError("Room");
  return port.getScoreboard(code);
}

export async function getLiveRoom(port: LiveSessionPort, code: string): Promise<RoomState> {
  const room = await port.getRoom(code);
  if (!room) throw new NotFoundError("Room");
  return room;
}
