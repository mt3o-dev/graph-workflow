import type { LiveSessionPort } from "../ports/liveSessionPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { UserRepoPort } from "../ports/userRepoPort";
import type { Sm2SchedulerPort, FsrsSchedulerPort } from "../ports/schedulerPort";
import type { CardSet, Locale, ReviewState, FsrsReviewState, SchedulerPreference } from "../domain/types";
import { computeMissedQuestionsForPlayer } from "../domain/liveQuiz";
import { sm2InitialState, addDays } from "../domain/sm2";
import { fsrsInitialState } from "../domain/fsrs";
import { NotFoundError, ValidationError } from "../domain/errors";

/**
 * Slice 15: turns a FINISHED live-quiz room into real spaced-repetition
 * practice for every player who joined it — "the slice that makes full
 * Kahoot-mode a learning feature rather than a detour" (roadmap.md). Every
 * question a player got wrong, never answered, or answered correctly but
 * slowly (see core/domain/liveQuiz.ts's computeMissedQuestionsForPlayer) is
 * CLONED into that player's own personal practice set (reusing slice 3's
 * cloneSharedSet clone-card shape) and seeded with a fresh, shortened-due
 * ReviewState/FsrsReviewState — never a raw ReviewState row for someone
 * else's card, since a live round's questions come from the HOST's set and
 * players are never required to own it (see roadmap's key design note).
 *
 * Nothing here writes to the SOURCE set/card — only new, player-owned
 * copies are created, mirroring cloneSharedSet's non-mutation guarantee.
 */

/**
 * Marker stored in the practice set's `description` field (never shown in
 * any UI) so this set can be found-or-created exactly once per player and
 * reused across every future live round, regardless of which locale the
 * player was using when it was first created — see
 * SetRepoPort.findByOwnerAndDescription's doc comment for why a description
 * match (not a title match, which IS locale-translated and user-visible) is
 * the right lookup key here.
 */
export const PRACTICE_SET_MARKER = "kartka:live-quiz-review-practice-set";

/**
 * True if `err` is a UNIQUE-constraint violation from either driver, at any
 * wrapping depth. Drizzle's `db.insert()`/`db.run()` wraps the underlying
 * bun:sqlite/postgres error in its own error type whose OWN `.message` is
 * generic ("Failed to run the query...") — the real driver text lives on
 * `err.cause.message` one level down (same wrapping behavior that made
 * migrateSqlite.ts's original duplicate-column guards silently dead code
 * before slice 11's fix; checked both levels here from the start instead of
 * repeating that mistake). SQLite says "UNIQUE constraint failed", Postgres
 * says "duplicate key value violates unique constraint" — check both.
 */
function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const pattern = /unique constraint|duplicate key/i;
  if (pattern.test(err.message)) return true;
  const cause = (err as { cause?: unknown }).cause;
  return cause instanceof Error && pattern.test(cause.message);
}

/**
 * Shortened initial due date for a freshly-imported card, in hours from the
 * moment of import. Deliberately far short of the shortest interval SM-2's
 * OWN formula (sm2.ts) ever produces on a card's first real review — every
 * first-touch review, pass or fail, resolves to `interval = 1` (one full
 * day, see sm2()'s branches) — so a freshly-imported card always surfaces
 * for review sooner than an equivalent freshly-reviewed real card would.
 * "A few hours" (rather than e.g. 15 minutes) is picked so the reinforcement
 * lands the same day without feeling like a nagging immediate re-quiz —
 * these are cards the player was JUST exposed to minutes ago, not cards
 * that need instant re-drilling.
 */
export const IMPORTED_CARD_DUE_HOURS = 4;

/** Both scheduler implementations, bundled — mirrors reviewUsecases.ts's Schedulers. */
export interface Schedulers {
  sm2: Sm2SchedulerPort;
  fsrs: FsrsSchedulerPort;
}

/**
 * Finds this player's existing personal "live quiz review" practice set (see
 * PRACTICE_SET_MARKER), or creates it if this is their first-ever import.
 * Lazy, find-or-create — never creates a second one for the same owner, so
 * every future round's imports land in the same reused set rather than
 * sprawling into one new set per round.
 */
async function findOrCreatePracticeSet(setRepo: SetRepoPort, ownerId: string, title: string): Promise<CardSet> {
  const existing = await setRepo.findByOwnerAndDescription(ownerId, PRACTICE_SET_MARKER);
  if (existing) return existing;
  try {
    return await setRepo.create({ ownerId, title, description: PRACTICE_SET_MARKER });
  } catch (err) {
    // Read-then-create race, one level above the card-clone race this same
    // review found: two concurrent calls for a player's FIRST live round
    // ever can both see "no practice set yet" before either writes. The
    // DB-level partial unique index (migrateSqlite.ts/migratePg.ts) is the
    // real guard; losing this race just means another concurrent call
    // already created the set — re-read and use that one instead of
    // crashing or (worse) silently creating a second practice set.
    if (!isUniqueConstraintError(err)) throw err;
    const winner = await setRepo.findByOwnerAndDescription(ownerId, PRACTICE_SET_MARKER);
    if (!winner) throw err; // shouldn't happen: the constraint fired because a row exists
    return winner;
  }
}

/**
 * Seeds a BRAND-NEW ReviewState/FsrsReviewState row for a just-imported
 * card — deliberately NOT a fork/reuse of reviewUsecases.submitReview, which
 * is an answer-driven UPDATE step that needs a quality score to feed the
 * scheduler. This is the opposite: there is no quality score yet, because
 * the card hasn't been really reviewed at all. Default
 * easiness/difficulty/etc. come from the exact same sm2InitialState()/
 * fsrsInitialState() helpers a genuinely-never-reviewed card would use
 * (matching the player's own schedulerPreference, same dispatch pattern as
 * submitReview) — the ONLY difference from a true "never reviewed" state is
 * `dueAt`, deliberately pulled forward to IMPORTED_CARD_DUE_HOURS from now
 * instead of being immediately due or waiting for a first real interval.
 *
 * After this seed, the card is a completely ordinary row: the player's next
 * REAL review of it goes through submitReview exactly like any other card
 * (see tests/liveQuizPostGameReview.test.ts for the explicit regression
 * proof) — this function is never called again for the same card once it's
 * been seeded, and submitReview's own upsert-by-(cardId,userId) semantics
 * mean it's simply the "existing" row on that next review.
 */
export async function seedReviewStateForImportedCard(
  schedulers: Schedulers,
  cardId: string,
  userId: string,
  schedulerPreference: SchedulerPreference,
  now: Date = new Date(),
): Promise<ReviewState | FsrsReviewState> {
  const dueAt = addDays(now, IMPORTED_CARD_DUE_HOURS / 24);

  if (schedulerPreference === "fsrs") {
    const base = fsrsInitialState();
    const next: FsrsReviewState = {
      cardId,
      userId,
      difficulty: base.difficulty,
      stability: base.stability,
      reps: base.reps,
      dueAt,
      lastReviewedAt: null,
    };
    return schedulers.fsrs.upsert(next);
  }

  const base = sm2InitialState();
  const next: ReviewState = {
    cardId,
    userId,
    easiness: base.easiness,
    interval: base.interval,
    repetitions: base.repetitions,
    dueAt,
    lastReviewedAt: null,
  };
  return schedulers.sm2.upsert(next);
}

export interface ImportPostGameReviewResult {
  userId: string;
  /** How many NEW cards were cloned+seeded for this player on THIS call — 0 for "nothing missed" or "everything was already imported in a prior round/call" (see dedupe below). */
  importedCount: number;
}

export interface ImportPostGameReviewDeps {
  liveSessionPort: LiveSessionPort;
  setRepo: SetRepoPort;
  cardRepo: CardRepoPort;
  userRepo: UserRepoPort;
  schedulers: Schedulers;
}

/**
 * The impure, DB-writing import step (per the roadmap's explicit split: pure
 * missed/slow detection lives in core/domain/liveQuiz.ts, this orchestrates
 * the clone+seed side effects) — intended to be called once a room's phase
 * has reached "finished" (see live-server.ts). Throws ValidationError if
 * called on a room that hasn't finished yet, since "which questions were
 * missed" isn't a settled question until the round is over.
 *
 * `practiceSetTitleByLocale` is a plain data map (not a t()/i18n call) —
 * core/usecases stays framework/i18n-free per docs/architecture.md's
 * boundary rule; the caller (live-server.ts) resolves the actual localized
 * title strings via src/i18n's t() and hands over the finished map. Falls
 * back to the `pl` entry if a user's locale (an unexpected/legacy value)
 * isn't a key in the map.
 *
 * Idempotent by construction (see the dedupe check below against each
 * player's practice set) — safe to call more than once for the same
 * finished round, e.g. if multiple clients each poll/render the finished
 * screen and each triggers this import.
 */
export async function importPostGameReviewForRoom(
  deps: ImportPostGameReviewDeps,
  code: string,
  practiceSetTitleByLocale: Record<Locale, string>,
  now: Date = new Date(),
): Promise<ImportPostGameReviewResult[]> {
  const room = await deps.liveSessionPort.getRoom(code);
  if (!room) throw new NotFoundError("Room");
  if (room.phase !== "finished") {
    throw new ValidationError("Post-game review import can only run once the room has finished");
  }

  const sourceCards = await deps.cardRepo.listAllBySet(room.setId);
  const sourceCardById = new Map(sourceCards.map((c) => [c.id, c]));

  const results: ImportPostGameReviewResult[] = [];

  for (const player of Object.values(room.players)) {
    const missed = computeMissedQuestionsForPlayer(room, player.userId);
    if (missed.length === 0) {
      results.push({ userId: player.userId, importedCount: 0 });
      continue;
    }

    const user = await deps.userRepo.findById(player.userId);
    if (!user) {
      // Defensive: every joined player should resolve to a real user row.
      results.push({ userId: player.userId, importedCount: 0 });
      continue;
    }

    const title = practiceSetTitleByLocale[user.locale] ?? practiceSetTitleByLocale.pl;
    const practiceSet = await findOrCreatePracticeSet(deps.setRepo, user.id, title);

    // Dedupe/provenance (roadmap point 2): a source card already cloned into
    // this practice set (in an earlier round, or an earlier call for THIS
    // round) is never re-cloned/re-seeded. This is also exactly what makes
    // the whole function idempotent.
    const existingCards = await deps.cardRepo.listAllBySet(practiceSet.id);
    const alreadyImportedSourceIds = new Set(
      existingCards.map((c) => c.sourceCardId).filter((id): id is string => id !== null),
    );

    let importedCount = 0;
    for (const m of missed) {
      if (alreadyImportedSourceIds.has(m.cardId)) continue;
      const sourceCard = sourceCardById.get(m.cardId);
      if (!sourceCard) continue; // defensive: source card deleted since the round was played

      let clone;
      try {
        clone = await deps.cardRepo.create({
          setId: practiceSet.id,
          type: sourceCard.type,
          payload: sourceCard.payload,
          sourceCardId: sourceCard.id,
        });
      } catch (err) {
        // Review found a real (bounded, non-corrupting) race: two concurrent
        // finished-room renders (e.g. a broadcast in flight plus a
        // reconnecting socket) can both read "not yet imported" for this
        // (set, sourceCardId) pair before either writes. The DB-level
        // partial unique index (migrateSqlite.ts/migratePg.ts) is the real
        // guard; losing this race just means another concurrent call
        // already created the clone — skip it here rather than crash the
        // rest of this player's import.
        if (isUniqueConstraintError(err)) {
          alreadyImportedSourceIds.add(m.cardId);
          continue;
        }
        throw err;
      }
      await seedReviewStateForImportedCard(deps.schedulers, clone.id, user.id, user.schedulerPreference, now);

      alreadyImportedSourceIds.add(m.cardId);
      importedCount++;
    }

    results.push({ userId: user.id, importedCount });
  }

  return results;
}
