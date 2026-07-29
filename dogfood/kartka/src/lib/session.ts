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

/**
 * Slice 11 (live quiz): same verification as getCurrentUser, but for callers
 * that only have a raw `Cookie` header string — the WebSocket sidecar
 * (live-server.ts) isn't an Astro route and has no AstroCookies object, but
 * still needs to authenticate the same signed session cookie the browser
 * already carries (cookies are host-scoped, not port-scoped, so the browser
 * sends this cookie to the sidecar's port too — see docs/ADR-live-transport.md).
 */
export async function getUserFromCookieHeader(cookieHeader: string | null): Promise<User | null> {
  if (!cookieHeader) return null;
  const raw = parseCookie(cookieHeader, SESSION_COOKIE);
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

function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
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
