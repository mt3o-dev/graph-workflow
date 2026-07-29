import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { subscribeToPush } from "../../../core/usecases/reminderUsecases";
import { DomainError } from "../../../core/domain/errors";

/**
 * Slice 9 (due-card reminders): stores one browser/device's Web Push
 * subscription for the requesting user.
 *
 * Ownership: `subscribeToPush` always writes `userId: user.id` (the
 * authenticated session's own id) — there is no way for the request body to
 * name a different owner, so this endpoint can never register a
 * subscription on someone else's account no matter what it's sent. See
 * core/usecases/reminderUsecases.ts.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { endpoint?: unknown; p256dhKey?: unknown; authKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dhKey = typeof body.p256dhKey === "string" ? body.p256dhKey : "";
  const authKey = typeof body.authKey === "string" ? body.authKey : "";

  const { pushSubscriptionRepo } = await getContainer();
  try {
    await subscribeToPush(pushSubscriptionRepo, user.id, { endpoint, p256dhKey, authKey });
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json; charset=utf-8" } });
};
