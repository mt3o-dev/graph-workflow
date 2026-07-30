import type { APIRoute } from "astro";
import { getContainer } from "../../../../di/container";
import { getCurrentUser } from "../../../../lib/session";
import { createHomeworkAssignment } from "../../../../core/usecases/liveHomeworkUsecases";
import { resolveLocale } from "../../../../i18n";
import { DomainError } from "../../../../core/domain/errors";

// Owner-only (slice 17): publishes one of the host's own sets as an async
// homework assignment. Reuses createHomeworkAssignment -> getOwnedSet, so a
// non-owner request (even a logged-in one) is rejected with 403 and an unknown
// set id with 404 before anything is written — same ownership discipline as
// visibility.ts / exam-date.ts. A plain full-page form POST (no htmx/fetch):
// on success it 303-redirects the owner straight to the new assignment's
// status page; on a domain error it redirects back to the set page with an
// error marker so the message can be shown in the owner's locale.
export const POST: APIRoute = async ({ params, cookies, request, url }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const locale = resolveLocale({
    queryLang: url.searchParams.get("lang"),
    acceptLanguage: request.headers.get("accept-language"),
  });

  const setId = params.id!;
  const form = await request.formData();
  const raw = String(form.get("deadline") ?? "").trim();
  const deadlineDate = raw === "" ? new Date(NaN) : new Date(raw);

  const { setRepo, cardRepo, liveHomeworkRepo } = await getContainer();

  try {
    const assignment = await createHomeworkAssignment(
      { homeworkRepo: liveHomeworkRepo, setRepo, cardRepo },
      { setId, hostId: user.id, deadlineDate },
    );
    return new Response(null, { status: 303, headers: { Location: `/homework/${assignment.code}/status?lang=${locale}` } });
  } catch (err) {
    if (err instanceof DomainError) {
      if (err.code === "FORBIDDEN") return new Response(err.message, { status: 403 });
      if (err.code === "NOT_FOUND") return new Response(err.message, { status: 404 });
      // Validation (bad/past deadline, no eligible cards): back to the set page with a flag.
      return new Response(null, { status: 303, headers: { Location: `/sets/${setId}?lang=${locale}&homeworkError=1` } });
    }
    throw err;
  }
};
