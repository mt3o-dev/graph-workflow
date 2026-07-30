import { eq, and, isNull, desc, asc } from "drizzle-orm";
import type { PgDb } from "./index";
import { liveHomeworkAssignments, liveHomeworkAttempts, liveHomeworkAnswers } from "./schema.pg";
import type { LiveHomeworkRepoPort } from "../../core/ports/liveHomeworkRepoPort";
import type { HomeworkAssignment, HomeworkAttempt, HomeworkAnswer } from "../../core/domain/liveHomework";
import { newId } from "./ids";

// Mirrors liveHomeworkRepo.sqlite.ts — see that file's header comments for the
// concurrency rationale (no onConflict on createAttempt so the race surfaces;
// onConflictDoNothing on recordAnswer; WHERE-completedAt-IS-NULL on complete).

function toAssignment(row: typeof liveHomeworkAssignments.$inferSelect): HomeworkAssignment {
  return { id: row.id, setId: row.setId, hostId: row.hostId, code: row.code, deadline: row.deadline, createdAt: row.createdAt };
}
function toAttempt(row: typeof liveHomeworkAttempts.$inferSelect): HomeworkAttempt {
  return { id: row.id, assignmentId: row.assignmentId, userId: row.userId, score: row.score, completedAt: row.completedAt ?? null, createdAt: row.createdAt };
}
function toAnswer(row: typeof liveHomeworkAnswers.$inferSelect): HomeworkAnswer {
  return { id: row.id, attemptId: row.attemptId, cardId: row.cardId, correct: row.correct, answeredAt: row.answeredAt };
}

export function createLiveHomeworkRepoPg(db: PgDb): LiveHomeworkRepoPort {
  return {
    async createAssignment(input) {
      const row = { id: newId(), setId: input.setId, hostId: input.hostId, code: input.code, deadline: input.deadline, createdAt: new Date() };
      await db.insert(liveHomeworkAssignments).values(row);
      return toAssignment(row);
    },

    async findAssignmentByCode(code) {
      const [row] = await db.select().from(liveHomeworkAssignments).where(eq(liveHomeworkAssignments.code, code)).limit(1);
      return row ? toAssignment(row) : null;
    },

    async findAssignmentById(id) {
      const [row] = await db.select().from(liveHomeworkAssignments).where(eq(liveHomeworkAssignments.id, id)).limit(1);
      return row ? toAssignment(row) : null;
    },

    async listAssignmentsBySet(setId) {
      const rows = await db
        .select()
        .from(liveHomeworkAssignments)
        .where(eq(liveHomeworkAssignments.setId, setId))
        .orderBy(desc(liveHomeworkAssignments.createdAt));
      return rows.map(toAssignment);
    },

    async findAttempt(assignmentId, userId) {
      const [row] = await db
        .select()
        .from(liveHomeworkAttempts)
        .where(and(eq(liveHomeworkAttempts.assignmentId, assignmentId), eq(liveHomeworkAttempts.userId, userId)))
        .limit(1);
      return row ? toAttempt(row) : null;
    },

    async createAttempt(input) {
      const row = { id: newId(), assignmentId: input.assignmentId, userId: input.userId, score: 0, completedAt: null, createdAt: new Date() };
      await db.insert(liveHomeworkAttempts).values(row);
      return toAttempt(row);
    },

    async listAttemptsByAssignment(assignmentId) {
      const rows = await db
        .select()
        .from(liveHomeworkAttempts)
        .where(eq(liveHomeworkAttempts.assignmentId, assignmentId))
        .orderBy(asc(liveHomeworkAttempts.id));
      return rows.map(toAttempt);
    },

    async completeAttempt(attemptId, score, completedAt) {
      await db
        .update(liveHomeworkAttempts)
        .set({ score, completedAt })
        .where(and(eq(liveHomeworkAttempts.id, attemptId), isNull(liveHomeworkAttempts.completedAt)));
    },

    async recordAnswer(input) {
      const row = { id: newId(), attemptId: input.attemptId, cardId: input.cardId, correct: input.correct, answeredAt: input.answeredAt };
      await db.insert(liveHomeworkAnswers).values(row).onConflictDoNothing();
    },

    async listAnswers(attemptId) {
      const rows = await db.select().from(liveHomeworkAnswers).where(eq(liveHomeworkAnswers.attemptId, attemptId)).orderBy(asc(liveHomeworkAnswers.id));
      return rows.map(toAnswer);
    },

    async listAnswersByAssignment(assignmentId) {
      const rows = await db
        .select({ answer: liveHomeworkAnswers })
        .from(liveHomeworkAnswers)
        .innerJoin(liveHomeworkAttempts, eq(liveHomeworkAnswers.attemptId, liveHomeworkAttempts.id))
        .where(eq(liveHomeworkAttempts.assignmentId, assignmentId));
      return rows.map((r) => toAnswer(r.answer));
    },
  };
}
