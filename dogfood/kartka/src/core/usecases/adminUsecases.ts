import type { UserRepoPort } from "../ports/userRepoPort";
import type { SetRepoPort, SetWithOwnerAndCardCount } from "../ports/setRepoPort";
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { Sm2SchedulerPort, FsrsSchedulerPort } from "../ports/schedulerPort";
import type { LlmCallLogRepoPort } from "../ports/llmCallLogRepoPort";
import type { Card, CardSet, PageQuery, Paginated, Role, User, UserWithSetCount } from "../domain/types";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../domain/errors";
import { aggregateLlmCosts, type LlmCostAggregation } from "../domain/adminAnalytics";

/** Minimal shape needed to authorize an admin action, so call sites don't need a full User object. */
export interface AdminActor {
  id: string;
  role: Role;
}

function assertAdmin(actor: AdminActor): void {
  if (actor.role !== "admin") throw new ForbiddenError("Admin access required");
}

export async function listUsersForAdmin(
  userRepo: UserRepoPort,
  actor: AdminActor,
  query: PageQuery,
): Promise<Paginated<UserWithSetCount>> {
  assertAdmin(actor);
  return userRepo.listAll(query);
}

/**
 * Ban/unban a user. Every admin mutation in this module takes an explicit
 * `actor: AdminActor` and re-checks role here (never trust the page-level
 * gate alone — see docs/architecture.md's boundary rule and the slice 4
 * spec's "re-verify role on the actual mutating endpoint" requirement).
 *
 * Lockout guard: refuses to ban the last remaining non-banned admin, and
 * refuses to let an admin ban their own account (both would-be ways to lock
 * everyone out of /admin — see roadmap.md slice 4 scope).
 */
export async function setUserBanned(
  userRepo: UserRepoPort,
  actor: AdminActor,
  targetUserId: string,
  banned: boolean,
): Promise<User> {
  assertAdmin(actor);
  if (actor.id === targetUserId) {
    throw new ValidationError("You cannot change your own ban status");
  }

  const target = await userRepo.findById(targetUserId);
  if (!target) throw new NotFoundError("User");

  if (banned && target.role === "admin") {
    const remainingActiveAdmins = await userRepo.countActiveAdmins(target.id);
    if (remainingActiveAdmins === 0) {
      throw new ConflictError("Cannot ban the last remaining admin account");
    }
  }

  return userRepo.setBanned(targetUserId, banned);
}

export async function listSetsForAdmin(
  setRepo: SetRepoPort,
  actor: AdminActor,
  query: PageQuery,
): Promise<Paginated<SetWithOwnerAndCardCount>> {
  assertAdmin(actor);
  return setRepo.listAllAdmin(query);
}

/**
 * Admin-bypass set delete. Deliberately NOT built on setUsecases.getOwnedSet
 * — that helper's contract is "the caller owns this", which would be false
 * for an admin acting on someone else's set. Passing the admin's own id as
 * if they owned it would corrupt the intent of the check (and silently
 * "work" only because getOwnedSet would reject it — an easy landmine for a
 * future edit). This function's name/signature make the bypass explicit.
 */
export async function deleteSetAsAdmin(setRepo: SetRepoPort, actor: AdminActor, setId: string): Promise<CardSet> {
  assertAdmin(actor);
  const set = await setRepo.findById(setId);
  if (!set) throw new NotFoundError("Set");
  await setRepo.delete(setId);
  return set;
}

export interface AdminCardsView {
  set: CardSet;
  data: Paginated<Card>;
}

/** Admin drill-in: cards of one set, regardless of who owns it — the nested moderation view for a specific set (slice 4 scope note). */
export async function listCardsForAdmin(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  actor: AdminActor,
  setId: string,
  query: PageQuery,
): Promise<AdminCardsView> {
  assertAdmin(actor);
  const set = await setRepo.findById(setId);
  if (!set) throw new NotFoundError("Set");
  const data = await cardRepo.listBySet(setId, query);
  return { set, data };
}

/** Admin-bypass card delete — same rationale as deleteSetAsAdmin. */
export async function deleteCardAsAdmin(cardRepo: CardRepoPort, actor: AdminActor, cardId: string): Promise<Card> {
  assertAdmin(actor);
  const card = await cardRepo.findById(cardId);
  if (!card) throw new NotFoundError("Card");
  await cardRepo.delete(cardId);
  return card;
}

export interface AdminAnalytics {
  activeUsers7d: number;
  activeUsers30d: number;
  reviewsLast7d: number;
  reviewsLast30d: number;
  llm: LlmCostAggregation;
}

/**
 * Simple summary dashboard, not full BI (slice 4 scope). Data-availability
 * note: slice 1 never introduced a separate review-event log — the only
 * signal is ReviewState.lastReviewedAt (SM-2) / FsrsReviewState.lastReviewedAt
 * (FSRS, slice 5), one timestamp per (card,user) that gets overwritten on
 * every review. So:
 *  - "active users" = distinct users with >=1 state row (either scheduler)
 *    whose lastReviewedAt falls in the window, summed across both
 *    schedulers' countActiveUsersSince. This can double-count a user who
 *    reviewed under both SM-2 and FSRS cards in the same window (e.g. right
 *    after switching preference) — an edge case narrow enough not to
 *    justify a cross-scheduler distinct-user query for a slice-4-scope
 *    dashboard, but worth knowing about if the number looks slightly high.
 *  - "review volume" = count of state rows (both schedulers, summed) whose
 *    lastReviewedAt falls in the window — this UNDERCOUNTS true review
 *    volume, since a card reviewed twice in the same window only
 *    contributes once (its row's timestamp is just overwritten by the
 *    later review). Both are proxies, not exact event counts; see the
 *    matching doc comments on SchedulerPort.
 * LLM cost figures, by contrast, come straight from llm_call_log (slice 2),
 * which *was* built as an append-only per-call log, so those numbers are exact.
 */
export async function getAdminAnalytics(
  scheduler: Sm2SchedulerPort,
  fsrsScheduler: FsrsSchedulerPort,
  llmCallLogRepo: LlmCallLogRepoPort,
  actor: AdminActor,
  now: Date = new Date(),
): Promise<AdminAnalytics> {
  assertAdmin(actor);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    sm2ActiveUsers7d,
    fsrsActiveUsers7d,
    sm2ActiveUsers30d,
    fsrsActiveUsers30d,
    sm2Reviews7d,
    fsrsReviews7d,
    sm2Reviews30d,
    fsrsReviews30d,
    logs,
  ] = await Promise.all([
    scheduler.countActiveUsersSince(since7d),
    fsrsScheduler.countActiveUsersSince(since7d),
    scheduler.countActiveUsersSince(since30d),
    fsrsScheduler.countActiveUsersSince(since30d),
    scheduler.countReviewedSince(since7d),
    fsrsScheduler.countReviewedSince(since7d),
    scheduler.countReviewedSince(since30d),
    fsrsScheduler.countReviewedSince(since30d),
    llmCallLogRepo.listAll(),
  ]);

  return {
    activeUsers7d: sm2ActiveUsers7d + fsrsActiveUsers7d,
    activeUsers30d: sm2ActiveUsers30d + fsrsActiveUsers30d,
    reviewsLast7d: sm2Reviews7d + fsrsReviews7d,
    reviewsLast30d: sm2Reviews30d + fsrsReviews30d,
    llm: aggregateLlmCosts(logs),
  };
}
