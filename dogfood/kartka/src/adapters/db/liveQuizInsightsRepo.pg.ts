import { eq, asc } from "drizzle-orm";
import type { PgDb } from "./index";
import { liveQuizAnswerRecords } from "./schema.pg";
import type { LiveQuizInsightsRepoPort } from "../../core/ports/liveQuizInsightsRepoPort";
import type { LiveQuizAnswerRecord } from "../../core/domain/types";
import { newId } from "./ids";

function toDomain(row: typeof liveQuizAnswerRecords.$inferSelect): LiveQuizAnswerRecord {
  return {
    id: row.id,
    roomCode: row.roomCode,
    setId: row.setId,
    hostId: row.hostId,
    cardId: row.cardId,
    userId: row.userId,
    correct: row.correct,
    finishedAt: row.finishedAt,
  };
}

export function createLiveQuizInsightsRepoPg(db: PgDb): LiveQuizInsightsRepoPort {
  return {
    async recordRoundResults(records) {
      if (records.length === 0) return;
      const rows = records.map((r) => ({
        id: newId(),
        roomCode: r.roomCode,
        setId: r.setId,
        hostId: r.hostId,
        cardId: r.cardId,
        userId: r.userId,
        correct: r.correct,
        finishedAt: r.finishedAt,
      }));
      // Same DB-level graceful-conflict handling as the sqlite adapter — see
      // that file's header comment.
      await db.insert(liveQuizAnswerRecords).values(rows).onConflictDoNothing();
    },

    async listBySetId(setId) {
      // ORDER BY id: defense-in-depth alongside aggregateStudentStats' own
      // id-tiebreak — see the matching comment in liveQuizInsightsRepo.sqlite.ts.
      const rows = await db.select().from(liveQuizAnswerRecords).where(eq(liveQuizAnswerRecords.setId, setId)).orderBy(asc(liveQuizAnswerRecords.id));
      return rows.map(toDomain);
    },
  };
}
