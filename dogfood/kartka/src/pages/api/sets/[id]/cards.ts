import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { addCard, listCardsInSet } from "../../../../core/usecases/cardUsecases";
import { parsePageQuery } from "../../../../lib/pageQuery";
import { renderCardsTableFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";
import type { CardPayload, CardType } from "../../../../core/domain/types";

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

function payloadFromForm(type: CardType, form: FormData): CardPayload {
  switch (type) {
    case "basic":
      return { front: String(form.get("front") ?? ""), back: String(form.get("back") ?? "") };
    case "cloze":
      return { text: String(form.get("text") ?? "") };
    case "multiple_choice": {
      const options = form.getAll("options").map(String).filter((o) => o.trim().length > 0);
      return {
        question: String(form.get("question") ?? ""),
        options,
        correctIndex: Number(form.get("correctIndex") ?? 0),
      };
    }
    case "true_false":
      return { statement: String(form.get("statement") ?? ""), isTrue: form.get("isTrue") === "on" };
    case "type_answer":
      return {
        prompt: String(form.get("prompt") ?? ""),
        acceptedAnswers: String(form.get("acceptedAnswers") ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "image_occlusion": {
      const xs = form.getAll("region_x").map(Number);
      const ys = form.getAll("region_y").map(Number);
      const ws = form.getAll("region_w").map(Number);
      const hs = form.getAll("region_h").map(Number);
      const labels = form.getAll("region_label").map(String);
      const regions = xs.map((x, i) => ({ x, y: ys[i] ?? 0, w: ws[i] ?? 0, h: hs[i] ?? 0, label: labels[i] ?? "" }));
      return { imageUrl: String(form.get("imageUrl") ?? ""), regions };
    }
  }
}

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
