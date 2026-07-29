import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { changeQuietHours } from "../../../core/usecases/authUsecases";
import { DomainError } from "../../../core/domain/errors";

// Self-service only — same ownership pattern as scheduler-preference.ts:
// changeQuietHours always writes to the requesting user's own id, never a
// target id taken from the request body.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const enabled = form.get("quietHoursEnabled") === "1";
  const start = String(form.get("quietHoursStart") ?? "").trim();
  const end = String(form.get("quietHoursEnd") ?? "").trim();

  const { userRepo } = await getContainer();
  try {
    await changeQuietHours(userRepo, user.id, enabled ? start : null, enabled ? end : null);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }

  return redirect("/account/settings?saved=1", 303);
};
