import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { parseQueue, renderNext } from "../../../lib/reviewFragments";
import { resolveLocale, type Locale } from "../../../i18n";

export const GET: APIRoute = async ({ url, cookies, request }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const queue = parseQueue(url.searchParams.get("queue") ?? "");
  const total = Number(url.searchParams.get("total") ?? 0);
  const reviewed = Number(url.searchParams.get("reviewed") ?? 0);
  const locale = (url.searchParams.get("lang") as Locale) || resolveLocale({ queryLang: null, acceptLanguage: request.headers.get("accept-language") });

  const { cardRepo } = await getContainer();
  const html = await renderNext(cardRepo, queue, total, reviewed, locale);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
