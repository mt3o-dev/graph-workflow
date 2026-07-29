import type { APIRoute } from "astro";
import { getCurrentUser } from "../../../lib/session";
import { renderPreview } from "../../../lib/richReviewFragments";
import { payloadFromForm } from "../../../lib/cardForm";
import { resolveLocale, t } from "../../../i18n";
import { escapeHtml } from "../../../lib/html";
import type { CardType } from "../../../core/domain/types";

// Render-only preview for the card create/edit form's "Preview" button
// (slice 7). Deliberately does NOT call addCard/validateCardPayload — a
// preview must tolerate incomplete in-progress input (missing back text,
// no options yet, etc.) without erroring, it never persists anything, and
// the rendered output goes through the exact same renderRichText Layer-2
// sanitizer as every other render surface. Login is still required (not a
// public endpoint) to keep it from being an open, ownership-free "render
// arbitrary text as sanitized HTML" utility for anonymous callers.
export const POST: APIRoute = async ({ request, cookies, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });

  const form = await request.formData();
  const type = String(form.get("type") ?? "basic") as CardType;
  const payload = payloadFromForm(type, form);
  const html = await renderPreview(type, payload);

  return new Response(
    `<div id="card-preview" class="card">${html || `<p class="empty-state">${escapeHtml(t("cards.preview.empty", locale))}</p>`}</div>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
};
