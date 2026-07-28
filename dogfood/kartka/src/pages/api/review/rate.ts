import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { submitReview } from "../../../core/usecases/reviewUsecases";
import { getOwnedCard } from "../../../core/usecases/cardUsecases";
import { ForbiddenError, NotFoundError } from "../../../core/domain/errors";
import { qualityFromSelfRating, type SelfRating } from "../../../core/domain/quality";
import { parseQueue, renderNext } from "../../../lib/reviewFragments";
import { resolveLocale, type Locale } from "../../../i18n";

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const cardId = String(form.get("cardId") ?? "");
  const rating = String(form.get("rating") ?? "good") as SelfRating;
  const queue = parseQueue(String(form.get("queue") ?? ""));
  const total = Number(form.get("total") ?? 0);
  const current = Number(form.get("current") ?? 1);
  const locale = (String(form.get("lang") ?? "") as Locale) || resolveLocale({ queryLang: null, acceptLanguage: request.headers.get("accept-language") });

  const { scheduler, cardRepo, setRepo } = await getContainer();
  try {
    await getOwnedCard(cardRepo, setRepo, cardId, user.id);
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Card not found", { status: 404 });
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }
  await submitReview(scheduler, { cardId, userId: user.id, quality: qualityFromSelfRating(rating) });

  const html = await renderNext(cardRepo, queue, total, current, locale);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
