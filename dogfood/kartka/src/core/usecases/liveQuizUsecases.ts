import type { LiveSessionPort } from "../ports/liveSessionPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { LiveStreakBonusRepoPort } from "../ports/liveStreakBonusRepoPort";
import type { HintReveal, LiveAnswerResult, LiveCardType, LiveQuestion, RoomState, ScoreboardEntry, TeamScoreboardEntry } from "../domain/liveQuiz";
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
 *
 * Slice 14: when the recorded answer crosses the streak-bonus threshold
 * (`result.streakBonusAwarded`), creates the durable "pending" bonus record
 * for (userId, cardId) that reviewUsecases.submitReview later confirms or
 * forfeits — see core/ports/liveStreakBonusRepoPort.ts. `bonusRepo` is
 * optional so callers that don't care about bonus persistence (e.g. existing
 * tests exercising only the in-round scoring path) don't need to supply one;
 * production wiring (live-server.ts) always passes the real repo. Per the
 * roadmap's "don't over-award" rule: if an unresolved pending record already
 * exists for this exact (userId, cardId) pair (e.g. the player streaked into
 * the same card again in a later round before their previous bonus on it
 * resolved), no second record is created — the existing one still stands.
 */
export async function submitLiveAnswer(
  port: LiveSessionPort,
  input: SubmitLiveAnswerInput,
  bonusRepo?: LiveStreakBonusRepoPort,
): Promise<{ room: RoomState; result: LiveAnswerResult }> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (!room.players[input.userId]) throw new ForbiddenError("Join the room before answering");
  const outcome = await port.submitAnswer(input.code, input.userId, input.cardId, input.rawAnswer, input.now ?? new Date());

  if (bonusRepo && outcome.result.streakBonusAwarded) {
    const existing = await bonusRepo.findUnresolvedByUserAndCard(input.userId, input.cardId);
    if (!existing) {
      await bonusRepo.createPending({
        userId: input.userId,
        cardId: input.cardId,
        roomCode: input.code,
        points: outcome.result.points,
      });
    }
  }

  return outcome;
}

export interface RequestLiveHintInput {
  code: string;
  userId: string;
  cardId: string;
}

/**
 * Self-service (slice 14): the requesting player spends points for a
 * type-appropriate partial reveal of their own current question — see
 * domain.requestHint. No host/ownership check beyond "must have joined the
 * room" (mirrors submitLiveAnswer) since this only ever touches the
 * requesting player's own state.
 */
export async function requestLiveHint(port: LiveSessionPort, input: RequestLiveHintInput): Promise<{ room: RoomState; hint: HintReveal }> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (!room.players[input.userId]) throw new ForbiddenError("Join the room before requesting a hint");
  return port.requestHint(input.code, input.userId, input.cardId);
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

// --- Teams (slice 12) ---------------------------------------------------

export interface SetLiveTeamsInput {
  code: string;
  hostId: string;
  teamCount: number;
}

/**
 * Host-only: auto-splits the room's currently joined players into
 * `teamCount` teams (see domain.configureTeams). Reuses the exact
 * "check hostId against room.hostId, throw ForbiddenError otherwise"
 * pattern advanceLiveQuestion already uses — this is the single most
 * common review finding across this project, see roadmap.md/architecture.md.
 * Safe to call repeatedly before the round starts to reshuffle/rebalance;
 * domain.configureTeams itself rejects the call once the room has left
 * "lobby".
 */
export async function setLiveTeams(port: LiveSessionPort, input: SetLiveTeamsInput): Promise<RoomState> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (room.hostId !== input.hostId) throw new ForbiddenError("Only the host can configure teams");
  return port.configureTeams(input.code, input.teamCount);
}

export interface AssignLiveTeamInput {
  code: string;
  hostId: string;
  userId: string;
  teamId: string | null;
}

/** Host-only: manual override of one player's team (see domain.assignPlayerTeam). Same ownership pattern as setLiveTeams. */
export async function assignLiveTeam(port: LiveSessionPort, input: AssignLiveTeamInput): Promise<RoomState> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  if (room.hostId !== input.hostId) throw new ForbiddenError("Only the host can reassign teams");
  return port.assignPlayerTeam(input.code, input.userId, input.teamId);
}

/** Anyone in the room can read the team leaderboard — same visibility as the individual scoreboard. */
export async function computeTeamScoreboard(port: LiveSessionPort, code: string): Promise<TeamScoreboardEntry[]> {
  const room = await port.getRoom(code);
  if (!room) throw new NotFoundError("Room");
  return port.getTeamScoreboard(code);
}

// --- Host screen (slice 13) ---------------------------------------------

export interface IsLiveHostInput {
  code: string;
  userId: string;
}

/**
 * Read-only version of the `room.hostId === userId` check every other
 * host-only action here already enforces (advanceLiveQuestion, setLiveTeams,
 * assignLiveTeam) — a boolean query instead of a throw, since the callers
 * (the dedicated host-screen HTTP check in live-server.ts, and its WebSocket
 * upgrade handler) need to decide whether to render/upgrade at all, not to
 * perform a mutation. Still throws NotFoundError for an unknown code, same
 * as every other room lookup in this module — this is a real access-control
 * gate, not a "fail open on missing room" convenience.
 */
export async function isLiveHost(port: LiveSessionPort, input: IsLiveHostInput): Promise<boolean> {
  const room = await port.getRoom(input.code);
  if (!room) throw new NotFoundError("Room");
  return room.hostId === input.userId;
}
