import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard, listCardsInSet } from "../src/core/usecases/cardUsecases";

const dbPath = `./data/test-${crypto.randomUUID()}.db`;
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

describe("createSet -> addCard -> listCardsInSet (sqlite driver, temp db)", () => {
  test("full flow with pagination", async () => {
    await migrateSqlite(db as never);

    const setRepo = createSetRepoSqlite(db as never);
    const cardRepo = createCardRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const user = await userRepo.create({
      email: "student@example.com",
      passwordHash: "hash",
      displayName: "Student",
    });

    const set = await createSet(setRepo, { ownerId: user.id, title: "Biology 101", description: "Cells" });
    expect(set.title).toBe("Biology 101");
    expect(set.visibility).toBe("private");

    for (let i = 0; i < 15; i++) {
      await addCard(cardRepo, setRepo, {
        setId: set.id,
        ownerId: user.id,
        type: "basic",
        payload: { front: `Front ${i}`, back: `Back ${i}` },
      });
    }

    const page1 = await listCardsInSet(cardRepo, setRepo, set.id, user.id, {
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortDir: "asc",
    });
    expect(page1.total).toBe(15);
    expect(page1.items).toHaveLength(10);
    expect(page1.page).toBe(1);

    const page2 = await listCardsInSet(cardRepo, setRepo, set.id, user.id, {
      page: 2,
      pageSize: 10,
      sortBy: "createdAt",
      sortDir: "asc",
    });
    expect(page2.items).toHaveLength(5);
    expect(page2.total).toBe(15);
  });

  test("addCard rejects invalid payloads (hexagonal validation runs before persistence)", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const cardRepo = createCardRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const user = await userRepo.create({
      email: "student2@example.com",
      passwordHash: "hash",
      displayName: "Student 2",
    });
    const set = await createSet(setRepo, { ownerId: user.id, title: "Empty options set", description: "" });

    await expect(
      addCard(cardRepo, setRepo, {
        setId: set.id,
        ownerId: user.id,
        type: "multiple_choice",
        payload: { question: "2+2?", options: ["4"], correctIndex: 0 },
      }),
    ).rejects.toThrow();
  });

  test("addCard rejects when the set is not owned by the requester", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const cardRepo = createCardRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const owner = await userRepo.create({ email: "owner@example.com", passwordHash: "h", displayName: "Owner" });
    const intruder = await userRepo.create({ email: "intruder@example.com", passwordHash: "h", displayName: "Intruder" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Private set", description: "" });

    await expect(
      addCard(cardRepo, setRepo, {
        setId: set.id,
        ownerId: intruder.id,
        type: "basic",
        payload: { front: "f", back: "b" },
      }),
    ).rejects.toThrow();
  });
});
