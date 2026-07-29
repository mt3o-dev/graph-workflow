import type { APIRoute } from "astro";
import { getContainer } from "../../../../../di/container";
import { requireAdminApi } from "../../../../../lib/adminGuard";
import { deleteSetAsAdmin } from "../../../../../core/usecases/adminUsecases";
import { DomainError } from "../../../../../core/domain/errors";

// Admin-bypass delete: does NOT go through setUsecases.deleteSet/getOwnedSet
// (ownership doesn't matter here — see adminUsecases.deleteSetAsAdmin's doc
// comment for why that's an explicit separate function, not a shortcut).
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const actor = gate;

  const { setRepo } = await getContainer();
  try {
    await deleteSetAsAdmin(setRepo, actor, params.id!);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    throw err;
  }
  return redirect("/admin/sets", 303);
};
