import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { createSet, listSets } from "../../../core/usecases/setUsecases";
import { parsePageQuery } from "../../../lib/pageQuery";
import { renderSetsTableFragment } from "../../../lib/fragments";
import { DomainError } from "../../../core/domain/errors";

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { setRepo } = await getContainer();
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  const data = await listSets(setRepo, user.id, query);
  const html = await renderSetsTableFragment({ data, sortBy: query.sortBy, sortDir: query.sortDir, request });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const { setRepo } = await getContainer();
  try {
    await createSet(setRepo, {
      ownerId: user.id,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }
  return redirect("/sets", 303);
};
