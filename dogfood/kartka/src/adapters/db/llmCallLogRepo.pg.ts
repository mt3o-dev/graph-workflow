import { desc } from "drizzle-orm";
import type { PgDb } from "./index";
import { llmCallLog } from "./schema.pg";
import type { LlmCallLogRepoPort } from "../../core/ports/llmCallLogRepoPort";
import type { LlmCallLog } from "../../core/domain/types";
import { newId } from "./ids";

function toDomain(row: typeof llmCallLog.$inferSelect): LlmCallLog {
  return {
    id: row.id,
    userId: row.userId,
    requestedAt: row.requestedAt,
    model: row.model,
    promptTokens: row.promptTokens ?? null,
    completionTokens: row.completionTokens ?? null,
    totalTokens: row.totalTokens ?? null,
    estimatedCostUsd: row.estimatedCostUsd ?? null,
    status: row.status as "success" | "error",
    errorMessage: row.errorMessage ?? null,
  };
}

export function createLlmCallLogRepoPg(db: PgDb): LlmCallLogRepoPort {
  return {
    async logCall(input) {
      const row = {
        id: newId(),
        userId: input.userId,
        requestedAt: new Date(),
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        estimatedCostUsd: input.estimatedCostUsd,
        status: input.status,
        errorMessage: input.errorMessage,
      };
      await db.insert(llmCallLog).values(row);
      return toDomain(row as typeof llmCallLog.$inferSelect);
    },

    async listAll() {
      const rows = await db.select().from(llmCallLog).orderBy(desc(llmCallLog.requestedAt));
      return rows.map(toDomain);
    },
  };
}
