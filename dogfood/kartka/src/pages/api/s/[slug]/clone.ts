import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { cloneSharedSet } from "../../../../core/usecases/setUsecases";
import { DomainError } from "../../../../core/domain/errors";

// Clone-on-import (slice 3). Auth is required: a logged-out POST here gets a
// plain 401 like every other mutation endpoint in this app (see
// api/sets/index.ts, api/cards/[id]/delete.ts) — the "redirect to /login"
// behavior lives on the *page* (pages/s/[slug].astro only renders the clone
// form when a user is present), not on the API route.
//
// cloneSharedSet re-checks visibility itself (private/unknown slug -> 404),
// so a logged-in non-owner cannot clone a private set even if they somehow
// have its slug (e.g. it leaked before being switched to private).
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { setRepo, cardRepo } = await getContainer();
  try {
    const cloned = await cloneSharedSet(setRepo, cardRepo, { slug: params.slug!, newOwnerId: user.id });
    return redirect(`/sets/${cloned.id}`, 303);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "NOT_FOUND" ? 404 : 400 });
    throw err;
  }
};
