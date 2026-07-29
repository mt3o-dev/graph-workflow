import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { changeReadingProfile } from "../src/core/usecases/authUsecases";
import { ValidationError } from "../src/core/domain/errors";

const dbPath = `./data/test-authusecases-${crypto.randomUUID()}.db`;
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

const userRepo = createUserRepoSqlite(db as never);

describe("changeReadingProfile (slice 10) — sqlite driver, temp db", () => {
  test("a freshly-created user defaults to system/normal/normal/normal", async () => {
    await migrateSqlite(db as never);

    const user = await userRepo.create({ email: "fresh@example.com", passwordHash: "h", displayName: "Fresh" });
    expect(user.readingFont).toBe("system");
    expect(user.textSize).toBe("normal");
    expect(user.lineSpacing).toBe("normal");
    expect(user.contrast).toBe("normal");
  });

  test("persists a valid combination", async () => {
    const user = await userRepo.create({ email: "reader@example.com", passwordHash: "h", displayName: "Reader" });

    const updated = await changeReadingProfile(userRepo, user.id, {
      readingFont: "opendyslexic",
      textSize: "xlarge",
      lineSpacing: "loose",
      contrast: "high",
    });
    expect(updated.readingFont).toBe("opendyslexic");
    expect(updated.textSize).toBe("xlarge");
    expect(updated.lineSpacing).toBe("loose");
    expect(updated.contrast).toBe("high");

    const reloaded = await userRepo.findById(user.id);
    expect(reloaded!.readingFont).toBe("opendyslexic");
    expect(reloaded!.textSize).toBe("xlarge");
    expect(reloaded!.lineSpacing).toBe("loose");
    expect(reloaded!.contrast).toBe("high");
  });

  test("rejects an invalid readingFont value", async () => {
    const user = await userRepo.create({ email: "bad-font@example.com", passwordHash: "h", displayName: "Bad Font" });
    await expect(
      changeReadingProfile(userRepo, user.id, {
        readingFont: "comic-sans" as never,
        textSize: "normal",
        lineSpacing: "normal",
        contrast: "normal",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects an invalid textSize value", async () => {
    const user = await userRepo.create({ email: "bad-size@example.com", passwordHash: "h", displayName: "Bad Size" });
    await expect(
      changeReadingProfile(userRepo, user.id, {
        readingFont: "system",
        textSize: "huge" as never,
        lineSpacing: "normal",
        contrast: "normal",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects an invalid lineSpacing value", async () => {
    const user = await userRepo.create({ email: "bad-spacing@example.com", passwordHash: "h", displayName: "Bad Spacing" });
    await expect(
      changeReadingProfile(userRepo, user.id, {
        readingFont: "system",
        textSize: "normal",
        lineSpacing: "cramped" as never,
        contrast: "normal",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects an invalid contrast value", async () => {
    const user = await userRepo.create({ email: "bad-contrast@example.com", passwordHash: "h", displayName: "Bad Contrast" });
    await expect(
      changeReadingProfile(userRepo, user.id, {
        readingFont: "system",
        textSize: "normal",
        lineSpacing: "normal",
        contrast: "extreme" as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("is self-service: always writes to the requesting user's own id, never affects another user", async () => {
    const userA = await userRepo.create({ email: "a@example.com", passwordHash: "h", displayName: "A" });
    const userB = await userRepo.create({ email: "b@example.com", passwordHash: "h", displayName: "B" });

    await changeReadingProfile(userRepo, userA.id, {
      readingFont: "opendyslexic",
      textSize: "large",
      lineSpacing: "relaxed",
      contrast: "high",
    });

    const reloadedB = await userRepo.findById(userB.id);
    expect(reloadedB!.readingFont).toBe("system");
    expect(reloadedB!.textSize).toBe("normal");
    expect(reloadedB!.lineSpacing).toBe("normal");
    expect(reloadedB!.contrast).toBe("normal");
  });
});
