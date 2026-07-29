import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { unsubscribeFromPush } from "../../../core/usecases/reminderUsecases";
import { DomainError } from "../../../core/domain/errors";

/**
 * Slice 9 (due-card reminders): removes one push subscription.
 *
 * Ownership — the important one, per the spec's explicit warning: this
 * unsubscribes only the REQUESTING user's own subscription matching the
 * given endpoint. `unsubscribeFromPush` calls
 * pushSubscriptionRepo.deleteByUserAndEndpoint(user.id, endpoint), which
 * deletes iff both the owning userId AND the endpoint match — supplying
 * another user's endpoint (guessed or otherwise obtained) deletes nothing,
 * never that other user's row. There is no "subscription id" taken from the
 * request body at all, exactly to close off that class of IDOR.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";

  const { pushSubscriptionRepo } = await getContainer();
  let removed: boolean;
  try {
    removed = await unsubscribeFromPush(pushSubscriptionRepo, user.id, endpoint);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }

  return new Response(JSON.stringify({ removed }), { headers: { "content-type": "application/json; charset=utf-8" } });
};
