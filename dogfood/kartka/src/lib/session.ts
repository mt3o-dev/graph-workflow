import type { AstroCookies } from "astro";
import { getContainer } from "../di/container";
import type { User } from "../core/domain/types";

export const SESSION_COOKIE = "kartka_session";

export async function getCurrentUser(cookies: AstroCookies): Promise<User | null> {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const { auth, userRepo } = await getContainer();
  const sessionId = auth.verifyCookieValue(raw);
  if (!sessionId) return null;

  const session = await auth.getSession(sessionId);
  if (!session) return null;

  const user = await userRepo.findById(session.userId);
  if (!user || user.banned) return null;
  return user;
}

export async function setSessionCookie(cookies: AstroCookies, sessionId: string): Promise<void> {
  const { auth } = await getContainer();
  const signed = auth.signCookieValue(sessionId);
  cookies.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(cookies: AstroCookies): Promise<void> {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  if (raw) {
    const { auth } = await getContainer();
    const sessionId = auth.verifyCookieValue(raw);
    if (sessionId) await auth.destroySession(sessionId);
  }
  cookies.delete(SESSION_COOKIE, { path: "/" });
}
