import type { APIRoute } from "astro";
import { getContainer } from "../../../../../di/container";
import { requireAdminApi } from "../../../../../lib/adminGuard";
import { listCardsForAdmin } from "../../../../../core/usecases/adminUsecases";
import { parsePageQuery } from "../../../../../lib/pageQuery";
import { renderAdminCardsTableFragment } from "../../../../../lib/fragments";
import { resolveLocale } from "../../../../../i18n";
import { DomainError } from "../../../../../core/domain/errors";

// htmx pagination/sort partial for /admin/sets/[id]/cards.
export const GET: APIRoute = async ({ params, request, cookies, url }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const actor = gate;

  const { setRepo, cardRepo } = await getContainer();
  const setId = params.id!;
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  let view;
  try {
    view = await listCardsForAdmin(cardRepo, setRepo, actor, setId, query);
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    throw err;
  }
  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const html = renderAdminCardsTableFragment({ setId, data: view.data, sortBy: query.sortBy, sortDir: query.sortDir, locale });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
