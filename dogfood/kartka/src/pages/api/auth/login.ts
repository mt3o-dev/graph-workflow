import type { APIRoute } from "astro";
import { getContainer } from "../../../di/container";
import { login, InvalidCredentialsError, BannedUserError } from "../../../core/usecases/authUsecases";
import { setSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/sets");

  const { userRepo, auth } = await getContainer();
  try {
    const { session } = await login(userRepo, auth, { email, password });
    await setSessionCookie(cookies, session.id);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return redirect("/login?error=invalidCredentials", 303);
    if (err instanceof BannedUserError) return redirect("/login?error=banned", 303);
    throw err;
  }
  return redirect(next.startsWith("/") ? next : "/sets", 303);
};
