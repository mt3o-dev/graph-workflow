import type { APIRoute } from "astro";
import { getContainer } from "../../di/container";
import { listPublicSets } from "../../core/usecases/setUsecases";
import { parsePageQuery } from "../../lib/pageQuery";
import { renderPublicSetsFragment } from "../../lib/fragments";
import { resolveLocale } from "../../i18n";

// No auth check — /discover and its htmx pagination partial are public by
// design (only visibility:"public" sets are ever returned by listPublicSets).
export const GET: APIRoute = async ({ request, url }) => {
  const { setRepo } = await getContainer();
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  const data = await listPublicSets(setRepo, query);
  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const html = await renderPublicSetsFragment({ data, sortBy: query.sortBy, sortDir: query.sortDir, locale });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
