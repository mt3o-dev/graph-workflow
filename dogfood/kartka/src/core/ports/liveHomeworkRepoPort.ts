import type { HomeworkAssignment, HomeworkAttempt, HomeworkAnswer } from "../domain/liveHomework";

export interface CreateHomeworkAssignmentInput {
  setId: string;
  hostId: string;
  code: string;
  deadline: Date;
}

/**
 * Durable storage for slice 17's async homework mode — the persistence model
 * a live-quiz RoomState (in-memory, single-process, minutes-long) deliberately
 * can't provide (see docs/ADR-homework-mode.md). Three tables behind this
 * port: assignments, per-student attempts, and per-question answer records.
 *
 * Invariants the usecase layer owns, backed by DB-level unique indexes (the
 * real guard, same discipline as slices 15/16 — see migrateSqlite.ts):
 *   - one attempt per (assignmentId, userId): createAttempt races resolve to a
 *     single row; the loser re-reads the winner's.
 *   - one answer per (attemptId, cardId): recordAnswer is a silent no-op on a
 *     duplicate (double-submit / double-tab), never a re-score.
 *   - completeAttempt is a one-way, idempotent status transition (only sets
 *     completedAt while it is still null).
 */
export interface LiveHomeworkRepoPort {
  createAssignment(input: CreateHomeworkAssignmentInput): Promise<HomeworkAssignment>;
  findAssignmentByCode(code: string): Promise<HomeworkAssignment | null>;
  findAssignmentById(id: string): Promise<HomeworkAssignment | null>;
  /** Every assignment created from one set, newest first — for the set detail page's list. */
  listAssignmentsBySet(setId: string): Promise<HomeworkAssignment[]>;

  /** This student's existing attempt at this assignment, or null. */
  findAttempt(assignmentId: string, userId: string): Promise<HomeworkAttempt | null>;
  /**
   * Inserts a fresh in-progress attempt. MUST reject a second insert for the
   * same (assignmentId, userId) at the DB level (unique index) — the usecase
   * catches that violation and re-reads the winning row rather than creating a
   * duplicate. No-op-safe for the common "attempt already exists" path only
   * via the usecase's prior findAttempt check.
   */
  createAttempt(input: { assignmentId: string; userId: string }): Promise<HomeworkAttempt>;
  /** All attempts at one assignment — for the host status view + leaderboard. */
  listAttemptsByAssignment(assignmentId: string): Promise<HomeworkAttempt[]>;
  /**
   * One-way idempotent transition to completed: sets completedAt + the snapshot
   * score ONLY while completedAt is still null. A concurrent second call (two
   * tabs finishing at once) is a silent no-op — the first winner stands.
   */
  completeAttempt(attemptId: string, score: number, completedAt: Date): Promise<void>;

  /**
   * Records one answer. MUST gracefully ignore a row that collides with the
   * DB-level unique index on (attemptId, cardId) — onConflictDoNothing — so a
   * double-submit never double-scores or throws. No-op on nothing to insert.
   */
  recordAnswer(input: { attemptId: string; cardId: string; correct: boolean; answeredAt: Date }): Promise<void>;
  listAnswers(attemptId: string): Promise<HomeworkAnswer[]>;
  /** Every answer across every attempt at one assignment — lets the leaderboard/status recompute each attempt's score from source-of-truth records in one query. */
  listAnswersByAssignment(assignmentId: string): Promise<HomeworkAnswer[]>;
}
