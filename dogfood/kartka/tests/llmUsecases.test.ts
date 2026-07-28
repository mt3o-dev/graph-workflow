import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createLlmCallLogRepoSqlite } from "../src/adapters/db/llmCallLogRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { generateCardDrafts, logLlmCall } from "../src/core/usecases/llmUsecases";
import type { LlmGeneratorPort } from "../src/core/ports/llmGeneratorPort";
import type { CardDraft } from "../src/core/domain/types";

// Fake LlmGeneratorPort — no real network calls, per slice 2's test requirements.
function makeFakeLlmGenerator(drafts: CardDraft[]): LlmGeneratorPort {
  return {
    async generateCards() {
      return drafts;
    },
  };
}

const dbPath = `./data/test-llm-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(dbPath);
    unlinkSync(`${dbPath}-shm`);
    unlinkSync(`${dbPath}-wal`);
  } catch {
    // best-effort cleanup, fine if wal/shm files don't exist
  }
});

describe("generateCardDrafts (fake LLM port, no network)", () => {
  test("returns the fake port's drafts when the requester owns the set", async () => {
    await migrateSqlite(db as never);
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const user = await userRepo.create({ email: "gen@example.com", passwordHash: "h", displayName: "Gen" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "History", description: "" });

    const drafts: CardDraft[] = [
      { type: "basic", payload: { front: "Q", back: "A" }, confidence: 0.8, rationale: "clear pair" },
    ];
    const llmGenerator = makeFakeLlmGenerator(drafts);

    const result = await generateCardDrafts(llmGenerator, setRepo, {
      setId: set.id,
      ownerId: user.id,
      sourceText: "Some source material about history.",
    });

    expect(result).toEqual(drafts);
  });

  test("rejects when the requester does not own the set (ownership check runs before the LLM is ever called)", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const owner = await userRepo.create({ email: "owner2@example.com", passwordHash: "h", displayName: "Owner2" });
    const intruder = await userRepo.create({ email: "intruder2@example.com", passwordHash: "h", displayName: "Intruder2" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Private", description: "" });

    let called = false;
    const llmGenerator: LlmGeneratorPort = {
      async generateCards() {
        called = true;
        return [];
      },
    };

    await expect(
      generateCardDrafts(llmGenerator, setRepo, { setId: set.id, ownerId: intruder.id, sourceText: "text" }),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  test("rejects empty source text without calling the LLM", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);
    const user = await userRepo.create({ email: "empty@example.com", passwordHash: "h", displayName: "Empty" });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Set", description: "" });

    let called = false;
    const llmGenerator: LlmGeneratorPort = {
      async generateCards() {
        called = true;
        return [];
      },
    };

    await expect(
      generateCardDrafts(llmGenerator, setRepo, { setId: set.id, ownerId: user.id, sourceText: "   " }),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });
});

describe("logLlmCall", () => {
  test("persists a success row with token/cost data", async () => {
    const userRepo = createUserRepoSqlite(db as never);
    const llmCallLogRepo = createLlmCallLogRepoSqlite(db as never);
    const user = await userRepo.create({ email: "logger@example.com", passwordHash: "h", displayName: "Logger" });

    const row = await logLlmCall(llmCallLogRepo, {
      userId: user.id,
      model: "anthropic/claude-3.5-haiku",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.00028,
      status: "success",
      errorMessage: null,
    });

    expect(row.status).toBe("success");
    expect(row.totalTokens).toBe(150);
    expect(row.errorMessage).toBeNull();
  });

  test("persists an error row with a null token/cost fields", async () => {
    const userRepo = createUserRepoSqlite(db as never);
    const llmCallLogRepo = createLlmCallLogRepoSqlite(db as never);
    const user = await userRepo.create({ email: "logger2@example.com", passwordHash: "h", displayName: "Logger2" });

    const row = await logLlmCall(llmCallLogRepo, {
      userId: user.id,
      model: "anthropic/claude-3.5-haiku",
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
      status: "error",
      errorMessage: "OpenRouter HTTP 500",
    });

    expect(row.status).toBe("error");
    expect(row.promptTokens).toBeNull();
    expect(row.errorMessage).toBe("OpenRouter HTTP 500");
  });
});
