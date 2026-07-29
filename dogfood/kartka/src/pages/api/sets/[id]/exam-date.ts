import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { setExamDate } from "../../../../core/usecases/setUsecases";
import { previewCramSession } from "../../../../core/usecases/cramUsecases";
import { renderCramControlFragment } from "../../../../lib/fragments";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";

// Owner-only: reuses setExamDate -> getOwnedSet, so a non-owner request
// (even a logged-in one) is rejected with 403, and an unknown set id with
// 404, before any write happens — same shape as visibility.ts.
export const POST: APIRoute = async ({ params, cookies, request, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const raw = String(form.get("examDate") ?? "").trim();
  const examDate = raw === "" ? null : new Date(raw);

  const { setRepo, cardRepo, scheduler, fsrsScheduler } = await getContainer();
  const setId = params.id!;

  try {
    await setExamDate(setRepo, setId, user.id, examDate);
    const summary = await previewCramSession(cardRepo, setRepo, { sm2: scheduler, fsrs: fsrsScheduler }, setId, user.id, user.schedulerPreference);
    const locale = resolveLocale({
      queryLang: url.searchParams.get("lang"),
      acceptLanguage: request.headers.get("accept-language"),
    });
    const html = renderCramControlFragment({ summary, locale });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (err) {
    if (err instanceof DomainError) {
      const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 400;
      return new Response(err.message, { status });
    }
    throw err;
  }
};
