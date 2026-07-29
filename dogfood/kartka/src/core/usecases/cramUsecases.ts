// Cram-mode session orchestration (slice 8). See core/domain/cramPlanner.ts
// for the pure selection algorithm and its safety-constraint header comment.
//
// SAFETY: neither function below ever calls scheduler.upsert — both only
// read scheduler state (scheduler.get) to feed the planner, then hand back a
// priority-ordered list of Cards. Actual review submissions for those cards
// still go through the exact same submitReview() usecase (reviewUsecases.ts)
// as any normal review — see /api/review/answer.ts and /api/review/rate.ts,
// which are unmodified by this slice.
import type { CardRepoPort } from "../ports/cardRepoPort";
import type { SetRepoPort } from "../ports/setRepoPort";
import type { Card, CardSet, SchedulerPreference } from "../domain/types";
import { planCramSession, type CramCardInput, type CramPlannerResult } from "../domain/cramPlanner";
import { getOwnedSet } from "./setUsecases";
import type { Schedulers } from "./reviewUsecases";

async function computeCramPlan(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  schedulers: Schedulers,
  setId: string,
  ownerId: string,
  schedulerPreference: SchedulerPreference,
  now: Date,
): Promise<{ set: CardSet; cards: Card[]; plan: CramPlannerResult }> {
  // Ownership check first — reused from setUsecases, so a non-owner (even a
  // logged-in one) 403s before any scheduler state is read. This class of
  // bug (missing/forgettable ownership check on a new endpoint) has been the
  // single most common review finding across this project.
  const set = await getOwnedSet(setRepo, setId, ownerId);
  const cards = await cardRepo.listAllBySet(setId);

  const scheduler = schedulerPreference === "fsrs" ? schedulers.fsrs : schedulers.sm2;
  const cramInputs: CramCardInput[] = await Promise.all(
    cards.map(async (card) => ({ cardId: card.id, state: await scheduler.get(card.id, ownerId) })),
  );

  const plan = planCramSession({ cards: cramInputs, examDate: set.examDate, now });
  return { set, cards, plan };
}

export interface CramSessionSummary {
  set: CardSet;
  daysUntilExam: number | null;
  selectedCount: number;
  deprioritizedCount: number;
}

/**
 * Owner-only, read-only preview of what a cram session would look like right
 * now — used by the set detail page to show the countdown + "N cards won't
 * get proper attention" warning without actually starting a review session.
 */
export async function previewCramSession(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  schedulers: Schedulers,
  setId: string,
  ownerId: string,
  schedulerPreference: SchedulerPreference,
  now: Date = new Date(),
): Promise<CramSessionSummary> {
  const { set, plan } = await computeCramPlan(cardRepo, setRepo, schedulers, setId, ownerId, schedulerPreference, now);
  return {
    set,
    daysUntilExam: plan.daysUntilExam,
    selectedCount: plan.selected.length,
    deprioritizedCount: plan.deprioritized.length,
  };
}

export interface CramSessionResult {
  set: CardSet;
  daysUntilExam: number | null;
  /** Cram-prioritized cards, in priority order, capped — feed straight into the same review-flow rendering as a normal session (renderCardFragmentRich). */
  cards: Card[];
  deprioritizedCount: number;
}

/**
 * Owner-only: builds today's cram session for `setId` — the actual card list
 * the /review page renders. Requires set.examDate to be set (cram mode is
 * explicit opt-in); if it isn't, the planner itself returns an empty/inactive
 * result (see planCramSession) rather than throwing, so callers can decide
 * how to handle "cram requested on a set with no exam date" (the /review
 * page falls back to normal review session in that case).
 */
export async function startCramSession(
  cardRepo: CardRepoPort,
  setRepo: SetRepoPort,
  schedulers: Schedulers,
  setId: string,
  ownerId: string,
  schedulerPreference: SchedulerPreference,
  now: Date = new Date(),
): Promise<CramSessionResult> {
  const { set, cards, plan } = await computeCramPlan(cardRepo, setRepo, schedulers, setId, ownerId, schedulerPreference, now);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const selectedCards = plan.selected.map((id) => cardById.get(id)).filter((c): c is Card => c !== undefined);

  return {
    set,
    daysUntilExam: plan.daysUntilExam,
    cards: selectedCards,
    deprioritizedCount: plan.deprioritized.length,
  };
}
