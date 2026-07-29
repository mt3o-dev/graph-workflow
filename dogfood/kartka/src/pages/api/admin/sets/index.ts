import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { requireAdminApi } from "../../../../lib/adminGuard";
import { listSetsForAdmin } from "../../../../core/usecases/adminUsecases";
import { parsePageQuery } from "../../../../lib/pageQuery";
import { renderAdminSetsTableFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const actor = gate;

  const { setRepo } = await getContainer();
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  const data = await listSetsForAdmin(setRepo, actor, query);
  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const html = renderAdminSetsTableFragment({ data, sortBy: query.sortBy, sortDir: query.sortDir, locale });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
