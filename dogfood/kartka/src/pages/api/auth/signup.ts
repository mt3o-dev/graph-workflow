import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { signup } from "../../../core/usecases/authUsecases";
import { login } from "../../../core/usecases/authUsecases";
import { setSessionCookie } from "../../../lib/session";
import { ConflictError, ValidationError } from "../../../core/domain/errors";
import type { Locale } from "../../../core/domain/types";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const displayName = String(form.get("displayName") ?? "");
  const locale = (String(form.get("locale") ?? "pl") as Locale);

  const { userRepo, auth } = await getContainer();
  try {
    await signup(userRepo, auth, { email, password, displayName, locale });
  } catch (err) {
    if (err instanceof ConflictError) return redirect("/signup?error=emailTaken", 303);
    if (err instanceof ValidationError) return redirect("/signup?error=invalidEmail", 303);
    throw err;
  }

  const { session } = await login(userRepo, auth, { email, password });
  await setSessionCookie(cookies, session.id);
  return redirect("/sets", 303);
};
