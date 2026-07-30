import { eq, asc } from "drizzle-orm";
import type { SqliteDb } from "./index";
import { liveQuizAnswerRecords } from "./schema.sqlite";
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

export function createLiveQuizInsightsRepoSqlite(db: SqliteDb): LiveQuizInsightsRepoPort {
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
      // DB-level graceful conflict handling (roadmap point 1) against the
      // unique index on (room_code, card_id, user_id) — see
      // migrateSqlite.ts. A concurrent call inserting the SAME row loses the
      // race silently here rather than throwing; a genuinely NEW row from a
      // different call still inserts normally.
      await db.insert(liveQuizAnswerRecords).values(rows).onConflictDoNothing();
    },

    async listBySetId(setId) {
      // ORDER BY id: defense-in-depth alongside aggregateStudentStats' own
      // id-tiebreak (see that function's doc comment) — an unordered SELECT
      // isn't a guaranteed-stable row order in SQLite or Postgres, and this
      // repo's job is to hand the usecase/domain layer a deterministic view.
      const rows = await db.select().from(liveQuizAnswerRecords).where(eq(liveQuizAnswerRecords.setId, setId)).orderBy(asc(liveQuizAnswerRecords.id));
      return rows.map(toDomain);
    },
  };
}
