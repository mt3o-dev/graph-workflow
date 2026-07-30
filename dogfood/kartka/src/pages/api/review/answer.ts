import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { submitReview } from "../../../core/usecases/reviewUsecases";
import { getOwnedCard } from "../../../core/usecases/cardUsecases";
import { ForbiddenError, NotFoundError } from "../../../core/domain/errors";
import { qualityFromCorrectness } from "../../../core/domain/quality";
import { matchesAnyAccepted } from "../../../core/domain/levenshtein";
import { parseQueue } from "../../../lib/reviewFragments";
import { feedbackFragmentRich } from "../../../lib/richReviewFragments";
import { resolveLocale, t, type Locale } from "../../../i18n";
import type {
  MultipleChoicePayload,
  TrueFalsePayload,
  TypeAnswerPayload,
} from "../../../core/domain/types";

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const cardId = String(form.get("cardId") ?? "");
  const type = String(form.get("type") ?? "");
  const queue = parseQueue(String(form.get("queue") ?? ""));
  const total = Number(form.get("total") ?? 0);
  const current = Number(form.get("current") ?? 1);
  const locale = (String(form.get("lang") ?? "") as Locale) || resolveLocale({ queryLang: null, acceptLanguage: request.headers.get("accept-language") });

  const { cardRepo, setRepo, scheduler, fsrsScheduler, liveStreakBonusRepo } = await getContainer();
  let card;
  try {
    card = await getOwnedCard(cardRepo, setRepo, cardId, user.id);
  } catch (err) {
    if (err instanceof NotFoundError) return new Response("Card not found", { status: 404 });
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }

  let correct = false;
  let correctAnswerText = "";

  if (type === "multiple_choice") {
    const payload = card.payload as MultipleChoicePayload;
    const answer = Number(form.get("answer") ?? -1);
    correct = answer === payload.correctIndex;
    correctAnswerText = payload.options[payload.correctIndex] ?? "";
  } else if (type === "true_false") {
    const payload = card.payload as TrueFalsePayload;
    const answer = form.get("answer") === "true";
    correct = answer === payload.isTrue;
    correctAnswerText = payload.isTrue ? t("review.trueFalse.true", locale) : t("review.trueFalse.false", locale);
  } else if (type === "type_answer") {
    const payload = card.payload as TypeAnswerPayload;
    const answer = String(form.get("answer") ?? "");
    correct = matchesAnyAccepted(answer, payload.acceptedAnswers);
    correctAnswerText = payload.acceptedAnswers[0] ?? "";
  }

  await submitReview(
    { sm2: scheduler, fsrs: fsrsScheduler },
    { cardId, userId: user.id, quality: qualityFromCorrectness(correct), schedulerPreference: user.schedulerPreference },
    liveStreakBonusRepo,
  );

  const html = await feedbackFragmentRich({ correct, correctAnswerText, queue, total, reviewed: current, locale });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
