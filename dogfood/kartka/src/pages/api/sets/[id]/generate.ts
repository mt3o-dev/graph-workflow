import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { generateCardDrafts } from "../../../../core/usecases/llmUsecases";
import { renderLlmNotConfiguredFragment, renderLlmErrorFragment, renderLlmDraftsFragment } from "../../../../lib/llmFragments";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" };
const ALLOWED_ATTACHMENT_EXT = [".txt", ".md"];

// POST /api/sets/:id/generate — slice 2's "AI-assisted cards" endpoint.
// Ownership check: generateCardDrafts() calls getOwnedSet() before ever
// touching the LLM port, so a request for a set the caller doesn't own fails
// closed (ForbiddenError/NotFoundError below) instead of leaking a draft list.
export const POST: APIRoute = async ({ params, cookies, request, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });

  const { setRepo, llmGenerator } = await getContainer();
  const setId = params.id!;

  if (!llmGenerator) {
    return new Response(renderLlmNotConfiguredFragment(locale), { headers: HTML_HEADERS });
  }

  const form = await request.formData();
  let sourceText = String(form.get("sourceText") ?? "").trim();
  const attachment = form.get("attachment");

  if (!sourceText && attachment instanceof File && attachment.size > 0) {
    const name = attachment.name.toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXT.some((ext) => name.endsWith(ext))) {
      return new Response(renderLlmErrorFragment(locale, "onlyTextFiles"), { status: 400, headers: HTML_HEADERS });
    }
    sourceText = (await attachment.text()).trim();
  }

  if (!sourceText) {
    return new Response(renderLlmErrorFragment(locale, "sourceRequired"), { status: 400, headers: HTML_HEADERS });
  }

  try {
    const drafts = await generateCardDrafts(llmGenerator, setRepo, { setId, ownerId: user.id, sourceText });
    return new Response(renderLlmDraftsFragment({ setId, drafts, locale }), { headers: HTML_HEADERS });
  } catch (err) {
    if (err instanceof DomainError) {
      const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return new Response(renderLlmErrorFragment(locale, "generic"), { status, headers: HTML_HEADERS });
    }
    // OpenRouter/network failure — already logged to llm_call_log by the adapter.
    return new Response(renderLlmErrorFragment(locale, "generic"), { status: 502, headers: HTML_HEADERS });
  }
};
