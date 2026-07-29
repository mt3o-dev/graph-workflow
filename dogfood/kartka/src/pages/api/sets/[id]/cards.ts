import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { addCard, listCardsInSet } from "../../../../core/usecases/cardUsecases";
import { parsePageQuery } from "../../../../lib/pageQuery";
import { renderCardsTableFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";
import type { CardType } from "../../../../core/domain/types";
import { payloadFromForm } from "../../../../lib/cardForm";

export const GET: APIRoute = async ({ params, cookies, url, request }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { setRepo, cardRepo } = await getContainer();
  const query = parsePageQuery(url.searchParams, { defaultSortBy: "createdAt" });
  try {
    const data = await listCardsInSet(cardRepo, setRepo, params.id!, user.id, query);
    const locale = resolveLocale({ queryLang: url.searchParams.get("lang"), acceptLanguage: request.headers.get("accept-language") });
    const html = await renderCardsTableFragment({ setId: params.id!, data, sortBy: query.sortBy, sortDir: query.sortDir, locale });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: err.code === "FORBIDDEN" ? 403 : 404 });
    throw err;
  }
};

export const POST: APIRoute = async ({ params, cookies, request, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const type = String(form.get("type") ?? "basic") as CardType;
  const { setRepo, cardRepo } = await getContainer();

  try {
    await addCard(cardRepo, setRepo, {
      setId: params.id!,
      ownerId: user.id,
      type,
      payload: payloadFromForm(type, form),
    });
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }
  return redirect(`/sets/${params.id}`, 303);
};
