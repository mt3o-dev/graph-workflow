import type { APIRoute } from "astro";
import { getContainer } from "../../../../../di/container";
import { requireAdminApi } from "../../../../../lib/adminGuard";
import { deleteCardAsAdmin } from "../../../../../core/usecases/adminUsecases";
import { DomainError } from "../../../../../core/domain/errors";

// Admin-bypass delete — same rationale as /api/admin/sets/[id]/delete.ts.
export const POST: APIRoute = async ({ params, cookies, request }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const actor = gate;

  const { cardRepo } = await getContainer();
  let card;
  try {
    card = await deleteCardAsAdmin(cardRepo, actor, params.id!);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    throw err;
  }
  const referer = request.headers.get("referer");
  const back = `/admin/sets/${card.setId}/cards`;
  return Response.redirect(referer ?? new URL(back, request.url), 303);
};
