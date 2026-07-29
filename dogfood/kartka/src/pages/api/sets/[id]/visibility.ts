import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { setVisibility } from "../../../../core/usecases/setUsecases";
import { renderVisibilityControlFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";
import type { Visibility } from "../../../../core/domain/types";

// Owner-only: reuses setVisibility -> getOwnedSet, so a non-owner request
// (even a logged-in one) is rejected with 403, and an unknown set id with
// 404, before any write happens.
export const POST: APIRoute = async ({ params, cookies, request, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const visibility = String(form.get("visibility") ?? "") as Visibility;
  const { setRepo } = await getContainer();

  try {
    const set = await setVisibility(setRepo, params.id!, user.id, visibility);
    const locale = resolveLocale({
      queryLang: url.searchParams.get("lang"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    const html = renderVisibilityControlFragment({ set, locale });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    if (err instanceof DomainError) {
      const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return new Response(err.message, { status });
    }
    throw err;
  }
};
