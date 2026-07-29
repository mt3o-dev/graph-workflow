import type { APIRoute } from "astro";
import { getContainer } from "../../../../../di/container";
import { requireAdminApi } from "../../../../../lib/adminGuard";
import { setUserBanned } from "../../../../../core/usecases/adminUsecases";
import { DomainError } from "../../../../../core/domain/errors";

const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
};

// Role re-checked here, not just on the /admin/users page — see slice 4 spec:
// "a user could otherwise POST directly to a mutation endpoint."
export const POST: APIRoute = async ({ params, cookies, request }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const actor = gate;

  const { userRepo } = await getContainer();
  try {
    await setUserBanned(userRepo, actor, params.id!, true);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: STATUS_BY_CODE[err.code] ?? 400 });
    throw err;
  }
  const referer = request.headers.get("referer");
  return Response.redirect(referer ?? new URL("/admin/users", request.url), 303);
};
