import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { deleteSet } from "../../../../core/usecases/setUsecases";
import { DomainError } from "../../../../core/domain/errors";

export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { setRepo } = await getContainer();
  try {
    await deleteSet(setRepo, params.id!, user.id);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    throw err;
  }
  return redirect("/sets", 303);
};
