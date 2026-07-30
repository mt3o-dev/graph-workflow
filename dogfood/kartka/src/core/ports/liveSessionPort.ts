import type { HintReveal, LiveAnswerResult, LiveQuestion, RoomState, ScoreboardEntry, TeamScoreboardEntry } from "../domain/liveQuiz";

/**
 * Storage/lifecycle port for live-quiz rooms (slice 11). The only
 * implementation shipped in this slice is an in-memory
 * `Map<roomCode, RoomState>` adapter (single-instance MVP — documented
 * limitation, not a blocker per the roadmap's own note); a future
 * `Bun.redis` pub/sub adapter could implement this same interface for
 * multi-instance scale-out without touching usecases.
 */
export interface LiveSessionPort {
  /** Generates a fresh, unique room code internally and creates the room. */
  createRoom(input: { hostId: string; setId: string; questions: LiveQuestion[] }): Promise<RoomState>;
  getRoom(code: string): Promise<RoomState | null>;
  /** Idempotent join (rejoining keeps existing score) — see domain.addPlayer. */
  joinRoom(code: string, player: { userId: string; displayName: string }): Promise<RoomState>;
  submitAnswer(
    code: string,
    userId: string,
    cardId: string,
    rawAnswer: string,
    now: Date,
  ): Promise<{ room: RoomState; result: LiveAnswerResult }>;
  /** Advances lobby/reveal -> next question-live, or question-live -> reveal. See domain.advancePhase. */
  advanceQuestion(code: string, now: Date): Promise<RoomState>;
  getScoreboard(code: string): Promise<ScoreboardEntry[]>;
  /**
   * Slice 12 (teams). Auto-splits currently joined players into `teamCount`
   * teams (shuffle + round-robin — see domain.configureTeams). Safe to call
   * again before the round starts to reshuffle/rebalance.
   */
  configureTeams(code: string, teamCount: number): Promise<RoomState>;
  /** Slice 12 (teams): manual override of one player's team, see domain.assignPlayerTeam. */
  assignPlayerTeam(code: string, userId: string, teamId: string | null): Promise<RoomState>;
  /** Slice 12 (teams): team-ranked leaderboard, see domain.teamScoreboard. Empty array if teams aren't configured. */
  getTeamScoreboard(code: string): Promise<TeamScoreboardEntry[]>;
  /**
   * Slice 14 (hints): self-service, scoped to the requesting player's own
   * answer/hint state only — see domain.requestHint. Idempotent per
   * (player, question): a repeated request for the same card returns the
   * already-revealed hint without a second charge.
   */
  requestHint(code: string, userId: string, cardId: string): Promise<{ room: RoomState; hint: HintReveal }>;
}
