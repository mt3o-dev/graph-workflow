import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { submitHomeworkAnswer } from "../../../../core/usecases/liveHomeworkUsecases";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";

// Student-side (slice 17): records ONE answer to the authenticated student's
// OWN attempt, then 303-redirects back to the play page (Post/Redirect/Get, so
// a browser refresh never re-submits — the same no-client-JS SSR discipline as
// the rest of the app). All the real enforcement (deadline passed, already
// completed, answer belongs to a real question, one-answer-per-question
// idempotency) lives in submitHomeworkAnswer; this route only maps domain
// errors to HTTP status codes.
export const POST: APIRoute = async ({ params, cookies, request, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });

  const code = params.code!;
  const form = await request.formData();
  const cardId = String(form.get("cardId") ?? "");
  const rawAnswer = String(form.get("rawAnswer") ?? "");

  const { setRepo, cardRepo, liveHomeworkRepo } = await getContainer();

  try {
    await submitHomeworkAnswer(
      { homeworkRepo: liveHomeworkRepo, setRepo, cardRepo },
      { code, userId: user.id, cardId, rawAnswer },
    );
    return new Response(null, { status: 303, headers: { Location: `/homework/${code}?lang=${locale}` } });
  } catch (err) {
    if (err instanceof DomainError) {
      if (err.code === "NOT_FOUND") return new Response(err.message, { status: 404 });
      if (err.code === "FORBIDDEN") return new Response(err.message, { status: 403 });
      // Validation (deadline passed / already completed): back to the play
      // page, which will render the appropriate finished/closed state.
      return new Response(null, { status: 303, headers: { Location: `/homework/${code}?lang=${locale}` } });
    }
    throw err;
  }
};
