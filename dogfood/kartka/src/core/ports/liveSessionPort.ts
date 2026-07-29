import type { LiveAnswerResult, LiveQuestion, RoomState, ScoreboardEntry } from "../domain/liveQuiz";

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
}
