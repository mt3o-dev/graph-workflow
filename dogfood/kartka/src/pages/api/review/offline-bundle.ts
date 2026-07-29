import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { getOfflineBundle, OFFLINE_BUNDLE_LIMIT } from "../../../core/usecases/reviewUsecases";

/**
 * Slice 6 (offline review): returns up to OFFLINE_BUNDLE_LIMIT of the
 * requesting user's own currently-due cards, full payload included (correct
 * answers etc.) so the client can score them without a server round-trip.
 * Ownership: getOfflineBundle only ever reads via cardRepo.listAllForOwner
 * scoped to `user.id` — there is no cardId/setId input from the client here,
 * so there is nothing to IDOR against.
 */
export const GET: APIRoute = async ({ cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { cardRepo, scheduler, fsrsScheduler } = await getContainer();
  const cards = await getOfflineBundle(cardRepo, { sm2: scheduler, fsrs: fsrsScheduler }, user.id, user.schedulerPreference);

  const body = JSON.stringify({
    generatedAt: new Date().toISOString(),
    schedulerPreference: user.schedulerPreference,
    limit: OFFLINE_BUNDLE_LIMIT,
    cards: cards.map((c) => ({ id: c.id, setId: c.setId, type: c.type, payload: c.payload })),
  });

  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
};
