import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../../lib/session";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await clearSessionCookie(cookies);
  return redirect("/", 303);
};
