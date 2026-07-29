import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { syncOfflineReviews, type OfflineReviewItem } from "../../../core/usecases/reviewUsecases";
import type { ReviewQuality } from "../../../core/domain/types";

/** Hard cap on one sync batch — generous for a realistic offline session, cheap guard against an abusive payload. */
const MAX_BATCH_SIZE = 500;

interface RawReviewItem {
  cardId?: unknown;
  quality?: unknown;
  answeredAt?: unknown;
}

/**
 * Slice 6 (offline review): accepts the client's IndexedDB-queued reviews
 * and replays each through the existing submitReview usecase, in
 * chronological order per card, via reviewUsecases.syncOfflineReviews — see
 * that function's docstring for the exact timestamp-clamping rule.
 *
 * Ownership: every cardId in the batch is ownership-checked (per distinct
 * card, once) inside syncOfflineReviews before any review for it is applied
 * — a card that isn't this user's own is skipped entirely (reason
 * "not_owned"), never a 500 or a partial write to someone else's state.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  let payload: { reviews?: unknown };
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const rawReviews = Array.isArray(payload.reviews) ? (payload.reviews as RawReviewItem[]) : null;
  if (!rawReviews) return new Response("`reviews` must be an array", { status: 400 });
  if (rawReviews.length > MAX_BATCH_SIZE) return new Response("Batch too large", { status: 400 });

  const items: OfflineReviewItem[] = [];
  for (const raw of rawReviews) {
    const cardId = typeof raw.cardId === "string" ? raw.cardId : null;
    const quality = typeof raw.quality === "number" ? raw.quality : NaN;
    const answeredAt = typeof raw.answeredAt === "string" ? new Date(raw.answeredAt) : new Date(NaN);
    if (!cardId) continue; // malformed row, nothing meaningful to skip-report per-card — just dropped
    items.push({ cardId, quality: quality as ReviewQuality, answeredAt });
  }

  const { cardRepo, setRepo, scheduler, fsrsScheduler } = await getContainer();
  const result = await syncOfflineReviews(
    cardRepo,
    setRepo,
    { sm2: scheduler, fsrs: fsrsScheduler },
    user.id,
    user.schedulerPreference,
    items,
  );

  const body = JSON.stringify({
    applied: result.applied.map((a) => ({ cardId: a.cardId, answeredAt: a.answeredAt.toISOString() })),
    skipped: result.skipped,
    serverNow: new Date().toISOString(),
  });

  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
};
