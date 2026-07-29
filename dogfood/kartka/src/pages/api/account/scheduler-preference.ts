import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { changeSchedulerPreference } from "../../../core/usecases/authUsecases";
import { DomainError } from "../../../core/domain/errors";
import type { SchedulerPreference } from "../../../core/domain/types";

// Self-service only: changeSchedulerPreference (authUsecases.ts) always
// writes to the requesting user's own id, never a target id taken from the
// request — so this endpoint can't be used to change anyone else's
// preference no matter what the form body contains. See docs/architecture.md
// / the slice 5 report for why this matters (missing ownership checks have
// been the most common finding in prior slices' reviews).
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const preference = String(form.get("schedulerPreference") ?? "") as SchedulerPreference;

  const { userRepo } = await getContainer();
  try {
    await changeSchedulerPreference(userRepo, user.id, preference);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }

  return redirect("/account/settings?saved=1", 303);
};
