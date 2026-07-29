// Shared role-gate for every /admin* page and /api/admin/* route (slice 4).
// Pages and API routes need different "not allowed" shapes (redirect-to-login
// + localized 403 body for pages; plain 401/403 for API routes/htmx partials
// consumed by fetch/hx-get), so two small helpers instead of one, both built
// on the same getCurrentUser() + role check used everywhere else in the app.
import type { AstroCookies } from "astro";
import { getCurrentUser } from "./session";
import { t, type Locale } from "../i18n";
import type { User } from "../core/domain/types";

/**
 * Page-level gate. Returns the current user when they're an admin, otherwise
 * a Response the caller should return immediately (redirect-to-login for
 * anonymous visitors, localized 403 for logged-in non-admins) — mirrors the
 * pattern the slice-1 admin.astro stub already used.
 */
export async function requireAdminPage(cookies: AstroCookies, locale: Locale, nextPath: string): Promise<User | Response> {
  const user = await getCurrentUser(cookies);
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: `/login?next=${encodeURIComponent(nextPath)}` } });
  }
  if (user.role !== "admin") {
    return new Response(t("admin.forbidden", locale), { status: 403 });
  }
  return user;
}

/**
 * API-route gate. Every admin mutation endpoint must call this itself — the
 * page-level gate above only protects the HTML page, not a direct POST to
 * the endpoint (see slice 4 spec: "a user could otherwise POST directly to
 * a mutation endpoint").
 */
export async function requireAdminApi(cookies: AstroCookies): Promise<User | Response> {
  const user = await getCurrentUser(cookies);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "admin") return new Response("Forbidden", { status: 403 });
  return user;
}
