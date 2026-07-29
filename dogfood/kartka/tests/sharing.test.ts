import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createSet, setVisibility, getSharedSet, cloneSharedSet, listPublicSets } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import { generateSlug, isValidSlug, SLUG_LENGTH } from "../src/core/domain/slug";
import { NotFoundError, ForbiddenError } from "../src/core/domain/errors";

const dbPath = `./data/test-sharing-${crypto.randomUUID()}.db`;
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

describe("generateSlug (pure domain function)", () => {
  test("produces URL-safe base62 strings of the expected length", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateSlug();
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect(slug).toMatch(/^[0-9A-Za-z]+$/);
      expect(isValidSlug(slug)).toBe(true);
    }
  });

  test("is practically unique across many calls (no collisions in a large sample)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateSlug());
    expect(seen.size).toBe(5000);
  });

  test("isValidSlug rejects malformed input", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("too-short")).toBe(false);
    expect(isValidSlug("has spaces!")).toBe(false);
    expect(isValidSlug("a".repeat(SLUG_LENGTH + 1))).toBe(false);
  });
});

describe("set sharing (sqlite driver, temp db)", () => {
  test("setRepo.create assigns a unique, valid slug and defaults to private visibility", async () => {
    await migrateSqlite(db as never);
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const owner = await userRepo.create({ email: "slug-owner@example.com", passwordHash: "h", displayName: "Owner" });
    const setA = await createSet(setRepo, { ownerId: owner.id, title: "Set A" });
    const setB = await createSet(setRepo, { ownerId: owner.id, title: "Set B" });

    expect(setA.visibility).toBe("private");
    expect(isValidSlug(setA.slug)).toBe(true);
    expect(setA.slug).not.toBe(setB.slug);

    const found = await setRepo.findBySlug(setA.slug);
    expect(found?.id).toBe(setA.id);
  });

  test("only the owner can change visibility; a non-owner is forbidden", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);

    const owner = await userRepo.create({ email: "vis-owner@example.com", passwordHash: "h", displayName: "Owner" });
    const intruder = await userRepo.create({ email: "vis-intruder@example.com", passwordHash: "h", displayName: "Intruder" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Vis set" });

    await expect(setVisibility(setRepo, set.id, intruder.id, "public")).rejects.toThrow(ForbiddenError);

    const updated = await setVisibility(setRepo, set.id, owner.id, "public");
    expect(updated.visibility).toBe("public");
  });

  test("setVisibility rejects an invalid value", async () => {
    const setRepo = createSetRepoSqlite(db as never);
    const userRepo = createUserRepoSqlite(db as never);
    const owner = await userRepo.create({ email: "vis-bad@example.com", passwordHash: "h", displayName: "Owner" });
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Bad vis" });

    await expect(setVisibility(setRepo, set.id, owner.id, "supersecret" as never)).rejects.toThrow();
  });

  // The security-critical matrix: visibility x viewer, for the /s/{slug}
  // share-page lookup (getSharedSet). Anonymous is modeled by simply never
  // passing a userId into the usecase — getSharedSet takes none, by design
  // (see the "private -> 404, no 403" note in setUsecases.ts / pages/s/[slug].astro).
  describe("getSharedSet visibility matrix", () => {
    test.each([
      ["private", false],
      ["unlisted", true],
      ["public", true],
    ] as const)("visibility=%s -> accessible via share link: %s", async (visibility, shouldBeAccessible) => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({
        email: `matrix-${visibility}@example.com`,
        passwordHash: "h",
        displayName: "Matrix Owner",
      });
      const set = await createSet(setRepo, { ownerId: owner.id, title: `Matrix ${visibility}` });
      await setVisibility(setRepo, set.id, owner.id, visibility);

      if (shouldBeAccessible) {
        const view = await getSharedSet(setRepo, cardRepo, userRepo, set.slug);
        expect(view.set.id).toBe(set.id);
        expect(view.ownerDisplayName).toBe("Matrix Owner");
      } else {
        await expect(getSharedSet(setRepo, cardRepo, userRepo, set.slug)).rejects.toThrow(NotFoundError);
      }
    });

    test("an unknown slug 404s the same way a private one does", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      await expect(getSharedSet(setRepo, cardRepo, userRepo, "not-a-real-slug")).rejects.toThrow(NotFoundError);
    });

    test("card count and type breakdown reflect the set's actual cards", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({ email: "breakdown@example.com", passwordHash: "h", displayName: "Breakdown Owner" });
      const set = await createSet(setRepo, { ownerId: owner.id, title: "Breakdown set" });
      await setVisibility(setRepo, set.id, owner.id, "public");

      await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f1", back: "b1" } });
      await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f2", back: "b2" } });
      await addCard(cardRepo, setRepo, {
        setId: set.id,
        ownerId: owner.id,
        type: "true_false",
        payload: { statement: "s", isTrue: true },
      });

      const view = await getSharedSet(setRepo, cardRepo, userRepo, set.slug);
      expect(view.cardCount).toBe(3);
      expect(view.typeBreakdown.basic).toBe(2);
      expect(view.typeBreakdown.true_false).toBe(1);
    });
  });

  describe("cloneSharedSet (clone-on-import)", () => {
    test("clones title/description/cards under the new owner; source is untouched", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({ email: "clone-owner@example.com", passwordHash: "h", displayName: "Clone Owner" });
      const cloner = await userRepo.create({ email: "clone-cloner@example.com", passwordHash: "h", displayName: "Cloner" });

      const source = await createSet(setRepo, { ownerId: owner.id, title: "Original", description: "Desc" });
      await setVisibility(setRepo, source.id, owner.id, "public");
      const card1 = await addCard(cardRepo, setRepo, {
        setId: source.id,
        ownerId: owner.id,
        type: "basic",
        payload: { front: "Front", back: "Back" },
      });
      await addCard(cardRepo, setRepo, {
        setId: source.id,
        ownerId: owner.id,
        type: "cloze",
        payload: { text: "The {{c1::answer}}" },
      });

      const cloned = await cloneSharedSet(setRepo, cardRepo, { slug: source.slug, newOwnerId: cloner.id });

      // New Set: right owner, same content, brand-new id/slug, always private.
      expect(cloned.ownerId).toBe(cloner.id);
      expect(cloned.id).not.toBe(source.id);
      expect(cloned.slug).not.toBe(source.slug);
      expect(cloned.title).toBe("Original");
      expect(cloned.description).toBe("Desc");
      expect(cloned.visibility).toBe("private");

      // Cards: duplicated with correct payloads, new ids, correct new setId.
      const clonedCards = await cardRepo.listAllBySet(cloned.id);
      expect(clonedCards).toHaveLength(2);
      const clonedBasic = clonedCards.find((c) => c.type === "basic")!;
      expect(clonedBasic.id).not.toBe(card1.id);
      expect(clonedBasic.setId).toBe(cloned.id);
      expect(clonedBasic.payload).toEqual({ front: "Front", back: "Back" });

      // Source untouched.
      const sourceCardsAfter = await cardRepo.listAllBySet(source.id);
      expect(sourceCardsAfter).toHaveLength(2);
      const sourceAfter = await setRepo.findById(source.id);
      expect(sourceAfter?.ownerId).toBe(owner.id);
      expect(sourceAfter?.title).toBe("Original");

      // No ReviewState exists yet for the new owner's cloned cards — review
      // state is created lazily on first review (see reviewUsecases.submitReview),
      // never eagerly on clone.
      const allReviewStates = await db.select().from(schema.reviewStates);
      expect(allReviewStates.filter((r) => r.userId === cloner.id)).toHaveLength(0);
    });

    test("cloning a private set is rejected (not found)", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({ email: "clone-private-owner@example.com", passwordHash: "h", displayName: "Owner" });
      const cloner = await userRepo.create({ email: "clone-private-cloner@example.com", passwordHash: "h", displayName: "Cloner" });
      const set = await createSet(setRepo, { ownerId: owner.id, title: "Stays private" });
      // visibility defaults to "private" — no setVisibility call.

      await expect(cloneSharedSet(setRepo, cardRepo, { slug: set.id, newOwnerId: cloner.id })).rejects.toThrow(NotFoundError);
      await expect(cloneSharedSet(setRepo, cardRepo, { slug: set.slug, newOwnerId: cloner.id })).rejects.toThrow(NotFoundError);
    });

    test("cloning an unlisted set works without the source owner's approval", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const cardRepo = createCardRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({ email: "unlisted-owner@example.com", passwordHash: "h", displayName: "Owner" });
      const cloner = await userRepo.create({ email: "unlisted-cloner@example.com", passwordHash: "h", displayName: "Cloner" });
      const set = await createSet(setRepo, { ownerId: owner.id, title: "Unlisted" });
      await setVisibility(setRepo, set.id, owner.id, "unlisted");

      const cloned = await cloneSharedSet(setRepo, cardRepo, { slug: set.slug, newOwnerId: cloner.id });
      expect(cloned.ownerId).toBe(cloner.id);
    });
  });

  describe("listPublicSets", () => {
    test("only returns public sets, with owner display names, paginated", async () => {
      const setRepo = createSetRepoSqlite(db as never);
      const userRepo = createUserRepoSqlite(db as never);

      const owner = await userRepo.create({ email: "discover-owner@example.com", passwordHash: "h", displayName: "Discover Owner" });
      const pub1 = await createSet(setRepo, { ownerId: owner.id, title: "Public 1" });
      await setVisibility(setRepo, pub1.id, owner.id, "public");
      const pub2 = await createSet(setRepo, { ownerId: owner.id, title: "Public 2" });
      await setVisibility(setRepo, pub2.id, owner.id, "public");
      const unlisted = await createSet(setRepo, { ownerId: owner.id, title: "Unlisted" });
      await setVisibility(setRepo, unlisted.id, owner.id, "unlisted");
      await createSet(setRepo, { ownerId: owner.id, title: "Private" }); // stays private

      // pageSize is large enough to comfortably include this test's own sets
      // even though this db is shared across the whole file (other tests in
      // this file also create a handful of public/unlisted sets along the way).
      const page = await listPublicSets(setRepo, { page: 1, pageSize: 100, sortBy: "createdAt", sortDir: "asc" });
      const titles = page.items.map((s) => s.title);
      expect(titles).toContain("Public 1");
      expect(titles).toContain("Public 2");
      expect(titles).not.toContain("Unlisted");
      expect(titles).not.toContain("Private");

      const ours = page.items.filter((s) => s.title === "Public 1" || s.title === "Public 2");
      expect(ours.every((s) => s.ownerDisplayName === "Discover Owner")).toBe(true);
    });
  });
});
