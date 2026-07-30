import { describe, test, expect, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { unlinkSync } from "node:fs";
import * as schema from "../src/adapters/db/schema.sqlite";
import { migrateSqlite } from "../src/adapters/db/migrateSqlite";
import { createSetRepoSqlite } from "../src/adapters/db/setRepo.sqlite";
import { createCardRepoSqlite } from "../src/adapters/db/cardRepo.sqlite";
import { createUserRepoSqlite } from "../src/adapters/db/userRepo.sqlite";
import { createLiveHomeworkRepoSqlite } from "../src/adapters/db/liveHomeworkRepo.sqlite";
import { createSet } from "../src/core/usecases/setUsecases";
import { addCard } from "../src/core/usecases/cardUsecases";
import {
  createHomeworkAssignment,
  getHomeworkPlayState,
  submitHomeworkAnswer,
  getHomeworkStatus,
  getHomeworkResult,
  listHomeworkAssignmentsForSet,
} from "../src/core/usecases/liveHomeworkUsecases";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/core/domain/errors";

const dbPath = `./data/test-homework-${crypto.randomUUID()}.db`;
const sqlite = new Database(dbPath, { create: true });
const db = drizzle(sqlite, { schema });
await migrateSqlite(db as never);

const setRepo = createSetRepoSqlite(db as never);
const cardRepo = createCardRepoSqlite(db as never);
const userRepo = createUserRepoSqlite(db as never);
const homeworkRepo = createLiveHomeworkRepoSqlite(db as never);

const repos = { homeworkRepo, setRepo, cardRepo };
const statusDeps = { homeworkRepo, setRepo, cardRepo, userRepo };

afterAll(() => {
  sqlite.close();
  try {
    unlinkSync(dbPath);
    unlinkSync(`${dbPath}-shm`);
    unlinkSync(`${dbPath}-wal`);
  } catch {
    // best-effort cleanup
  }
});

async function makeUser(email: string) {
  return userRepo.create({ email, passwordHash: "h", displayName: email.split("@")[0]! });
}

/** A set with 3 live-eligible cards (all correct-answer index 1) plus 1 non-eligible basic card. */
async function makeQuizSet(ownerId: string) {
  const set = await createSet(setRepo, { ownerId, title: "Homework source set" });
  const cardA = await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "multiple_choice", payload: { question: "QA", options: ["w", "right", "w2"], correctIndex: 1 } });
  const cardB = await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "true_false", payload: { statement: "SB", isTrue: true } });
  const cardC = await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "type_answer", payload: { prompt: "PC", acceptedAnswers: ["paris"] } });
  await addCard(cardRepo, setRepo, { setId: set.id, ownerId, type: "basic", payload: { front: "f", back: "b" } });
  return { set, cardA, cardB, cardC };
}

const FUTURE = new Date("2026-09-01"); // date-input value (UTC midnight)
const NOW = new Date("2026-07-30T14:37:12.000Z"); // real clock time, mid-afternoon

describe("createHomeworkAssignment — ownership + deadline validation", () => {
  test("owner can create; a non-owner is rejected with ForbiddenError before anything is written", async () => {
    const owner = await makeUser(`hw-own-${crypto.randomUUID()}@e.com`);
    const stranger = await makeUser(`hw-str-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);

    const assignment = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });
    expect(assignment.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(assignment.hostId).toBe(owner.id);
    expect(assignment.deadline.toISOString()).toBe("2026-09-01T23:59:59.999Z"); // end of the chosen UTC day

    await expect(
      createHomeworkAssignment(repos, { setId: set.id, hostId: stranger.id, deadlineDate: FUTURE, now: NOW }),
    ).rejects.toThrow(ForbiddenError);
  });

  test('a "today" deadline is accepted despite a real (non-midnight) clock time on now — slice 8 timezone class of bug does not recur', async () => {
    const owner = await makeUser(`hw-today-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    const today = new Date("2026-07-30"); // same UTC calendar day as NOW, but NOW has a clock time
    const assignment = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: today, now: NOW });
    expect(assignment.deadline.toISOString()).toBe("2026-07-30T23:59:59.999Z");
  });

  test("a past deadline is rejected", async () => {
    const owner = await makeUser(`hw-past-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    await expect(
      createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: new Date("2026-07-29"), now: NOW }),
    ).rejects.toThrow(ValidationError);
  });

  test("a set with no live-eligible cards is rejected", async () => {
    const owner = await makeUser(`hw-noelig-${crypto.randomUUID()}@e.com`);
    const set = await createSet(setRepo, { ownerId: owner.id, title: "Basic-only" });
    await addCard(cardRepo, setRepo, { setId: set.id, ownerId: owner.id, type: "basic", payload: { front: "f", back: "b" } });
    await expect(
      createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW }),
    ).rejects.toThrow(ValidationError);
  });

  test("listHomeworkAssignmentsForSet is owner-gated", async () => {
    const owner = await makeUser(`hw-list-own-${crypto.randomUUID()}@e.com`);
    const stranger = await makeUser(`hw-list-str-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });
    expect(await listHomeworkAssignmentsForSet(repos, set.id, owner.id)).toHaveLength(1);
    await expect(listHomeworkAssignmentsForSet(repos, set.id, stranger.id)).rejects.toThrow(ForbiddenError);
  });
});

describe("playing an assignment", () => {
  test("scoring is base correctness only (reuses isAnswerCorrect); completing gives the final score", async () => {
    const owner = await makeUser(`hw-play-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-play-stu-${crypto.randomUUID()}@e.com`);
    const { set, cardA, cardB, cardC } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });

    // Answer A correct, B wrong, C correct.
    let state = await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardA.id, rawAnswer: "1", now: NOW });
    expect(state.finished).toBe(false);
    expect(state.correctCount).toBe(1);
    state = await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardB.id, rawAnswer: "false", now: NOW });
    expect(state.correctCount).toBe(1); // B was wrong (statement isTrue=true, answered false)
    state = await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardC.id, rawAnswer: "Paris", now: NOW });

    expect(state.finished).toBe(true);
    expect(state.currentQuestion).toBeNull();
    expect(state.correctCount).toBe(2);
    expect(state.attempt.completedAt).not.toBeNull();
    expect(state.attempt.score).toBe(2);
  });

  test("getHomeworkPlayState presents questions one at a time and never leaks the correct answer", async () => {
    const owner = await makeUser(`hw-one-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-one-stu-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });

    const state = await getHomeworkPlayState(repos, { code: a.code, userId: student.id, now: NOW });
    expect(state.totalQuestions).toBe(3);
    expect(state.answeredCount).toBe(0);
    expect(state.currentQuestion).not.toBeNull();
    // multiple_choice public view carries options but NOT correctIndex.
    expect(JSON.stringify(state.currentQuestion)).not.toContain("correctIndex");
  });

  test("one attempt only: a completed student cannot resubmit", async () => {
    const owner = await makeUser(`hw-resub-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-resub-stu-${crypto.randomUUID()}@e.com`);
    const { set, cardA, cardB, cardC } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });

    for (const [cardId, raw] of [[cardA.id, "1"], [cardB.id, "true"], [cardC.id, "paris"]] as const) {
      await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId, rawAnswer: raw, now: NOW });
    }
    await expect(
      submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardA.id, rawAnswer: "0", now: NOW }),
    ).rejects.toThrow(ValidationError);
  });

  test("a non-participant never sees another student's attempt (getHomeworkResult is per-student)", async () => {
    const owner = await makeUser(`hw-iso-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-iso-stu-${crypto.randomUUID()}@e.com`);
    const other = await makeUser(`hw-iso-oth-${crypto.randomUUID()}@e.com`);
    const { set, cardA } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });
    await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardA.id, rawAnswer: "1", now: NOW });

    // `other` never started an attempt — asking for their result 404s (they
    // can't read `student`'s attempt).
    await expect(getHomeworkResult(statusDeps, a.code, other.id, NOW)).rejects.toThrow(NotFoundError);
    // `student`'s own result reflects only their own answers.
    const mine = await getHomeworkResult(statusDeps, a.code, student.id, NOW);
    expect(mine.correctCount).toBe(1);
  });

  test("deadline enforcement: no new answers accepted after the deadline passes (server-side)", async () => {
    const owner = await makeUser(`hw-dl-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-dl-stu-${crypto.randomUUID()}@e.com`);
    const { set, cardA, cardB } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: new Date("2026-08-01"), now: NOW });

    // Answer one question before the deadline...
    await submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardA.id, rawAnswer: "1", now: new Date("2026-08-01T10:00:00Z") });
    // ...then the deadline passes: a further answer is rejected.
    const past = new Date("2026-08-02T00:00:00Z");
    await expect(
      submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardB.id, rawAnswer: "true", now: past }),
    ).rejects.toThrow(ValidationError);

    // The in-progress attempt is scored as-is on the leaderboard (1 correct),
    // even though it never completed.
    const status = await getHomeworkStatus(statusDeps, a.code, owner.id, past);
    expect(status.deadlinePassed).toBe(true);
    const row = status.leaderboard.find((e) => e.userId === student.id);
    expect(row?.score).toBe(1);
    expect(row?.completedAt).toBeNull();
  });

  test("an unknown code 404s on play and submit", async () => {
    const student = await makeUser(`hw-unk-${crypto.randomUUID()}@e.com`);
    await expect(getHomeworkPlayState(repos, { code: "ZZZZZ", userId: student.id, now: NOW })).rejects.toThrow(NotFoundError);
    await expect(
      submitHomeworkAnswer(repos, { code: "ZZZZZ", userId: student.id, cardId: "x", rawAnswer: "1", now: NOW }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("host status view aggregation", () => {
  test("completion count, attempt count, and leaderboard math", async () => {
    const owner = await makeUser(`hw-stat-own-${crypto.randomUUID()}@e.com`);
    const s1 = await makeUser(`hw-stat-s1-${crypto.randomUUID()}@e.com`);
    const s2 = await makeUser(`hw-stat-s2-${crypto.randomUUID()}@e.com`);
    const { set, cardA, cardB, cardC } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });

    // s1 finishes all 3, all correct (score 3). s2 answers only 1 (in progress, score 1).
    for (const [cardId, raw] of [[cardA.id, "1"], [cardB.id, "true"], [cardC.id, "paris"]] as const) {
      await submitHomeworkAnswer(repos, { code: a.code, userId: s1.id, cardId, rawAnswer: raw, now: NOW });
    }
    await submitHomeworkAnswer(repos, { code: a.code, userId: s2.id, cardId: cardA.id, rawAnswer: "1", now: NOW });

    const status = await getHomeworkStatus(statusDeps, a.code, owner.id, NOW);
    expect(status.totalQuestions).toBe(3);
    expect(status.attemptCount).toBe(2);
    expect(status.completedCount).toBe(1); // only s1 finished
    expect(status.deadlinePassed).toBe(false);
    expect(status.leaderboard.map((e) => e.userId)).toEqual([s1.id, s2.id]); // s1 (3) ahead of s2 (1)
    expect(status.leaderboard[0]!.score).toBe(3);
    expect(status.leaderboard[1]!.score).toBe(1);
  });

  test("the host status page is owner-only", async () => {
    const owner = await makeUser(`hw-statown-${crypto.randomUUID()}@e.com`);
    const stranger = await makeUser(`hw-statstr-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });
    await expect(getHomeworkStatus(statusDeps, a.code, stranger.id, NOW)).rejects.toThrow(ForbiddenError);
  });
});

describe("concurrency guards (applied from the start, per slices 15/16)", () => {
  test("a double/concurrent submit of the SAME question never double-scores (DB unique index + onConflictDoNothing)", async () => {
    const owner = await makeUser(`hw-conc-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-conc-stu-${crypto.randomUUID()}@e.com`);
    const { set, cardA } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });
    // Pre-create the attempt so all 5 concurrent calls race only on the ANSWER
    // insert (the double-submit interleaving this guard targets).
    await getHomeworkPlayState(repos, { code: a.code, userId: student.id, now: NOW });

    // Five genuinely-concurrent submissions of the same correct answer.
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        submitHomeworkAnswer(repos, { code: a.code, userId: student.id, cardId: cardA.id, rawAnswer: "1", now: NOW }),
      ),
    );
    // None threw (Promise.all resolved) and the recorded correctCount is 1, not 5.
    for (const r of results) expect(r.correctCount).toBe(1);

    const attempt = await homeworkRepo.findAttempt(a.id, student.id);
    const answers = await homeworkRepo.listAnswers(attempt!.id);
    expect(answers).toHaveLength(1); // exactly one answer row for the card, never a duplicate
  });

  test("concurrent FIRST plays from two tabs create exactly one attempt (unique index + re-read)", async () => {
    const owner = await makeUser(`hw-attempt-own-${crypto.randomUUID()}@e.com`);
    const student = await makeUser(`hw-attempt-stu-${crypto.randomUUID()}@e.com`);
    const { set } = await makeQuizSet(owner.id);
    const a = await createHomeworkAssignment(repos, { setId: set.id, hostId: owner.id, deadlineDate: FUTURE, now: NOW });

    const states = await Promise.all(
      Array.from({ length: 5 }, () => getHomeworkPlayState(repos, { code: a.code, userId: student.id, now: NOW })),
    );
    const attemptIds = new Set(states.map((s) => s.attempt.id));
    expect(attemptIds.size).toBe(1); // all five resolved to the same single attempt

    const all = await homeworkRepo.listAttemptsByAssignment(a.id);
    expect(all.filter((t) => t.userId === student.id)).toHaveLength(1);
  });
});
