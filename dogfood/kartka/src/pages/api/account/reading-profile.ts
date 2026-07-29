import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { getCurrentUser } from "../../../lib/session";
import { changeReadingProfile } from "../../../core/usecases/authUsecases";
import { DomainError } from "../../../core/domain/errors";
import type { ReadingFont, TextSize, LineSpacing, Contrast } from "../../../core/domain/types";

// Self-service only — same ownership pattern as scheduler-preference.ts /
// quiet-hours.ts: changeReadingProfile always writes to the requesting
// user's own id, never a target id taken from the request body.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const readingFont = String(form.get("readingFont") ?? "") as ReadingFont;
  const textSize = String(form.get("textSize") ?? "") as TextSize;
  const lineSpacing = String(form.get("lineSpacing") ?? "") as LineSpacing;
  const contrast = String(form.get("contrast") ?? "") as Contrast;

  const { userRepo } = await getContainer();
  try {
    await changeReadingProfile(userRepo, user.id, { readingFont, textSize, lineSpacing, contrast });
  } catch (err) {
    if (err instanceof DomainError) return new Response(err.message, { status: 400 });
    throw err;
  }

  return redirect("/account/settings?saved=1", 303);
};
