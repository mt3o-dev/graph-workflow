import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { requireAdminApi } from "../../../../lib/adminGuard";
import { listUsersForAdmin } from "../../../../core/usecases/adminUsecases";
import { parsePageQuery } from "../../../../lib/pageQuery";
import { renderAdminUsersTableFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";

// htmx pagination/sort partial for /admin/users. Auth check re-run here
// (defense in depth) — the page itself is also gated by requireAdminPage.
export const GET: APIRoute = async ({ request, cookies, url }) => {
  const gate = await requireAdminApi(cookies);
  if (gate instanceof Response) return gate;
  const user = gate;

  const { userRepo } = await getContainer();
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  const data = await listUsersForAdmin(userRepo, user, query);
  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });
  const html = renderAdminUsersTableFragment({ data, sortBy: query.sortBy, sortDir: query.sortDir, currentUserId: user.id, locale });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
