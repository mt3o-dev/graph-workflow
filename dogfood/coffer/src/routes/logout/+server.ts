/**
 * `/logout` action ([node:d8caed23]): clears the session cookie and
 * 303-redirects to `/login`. POST-only (a GET would be a CSRF-able
 * side-effecting request); the auth gate already requires an authenticated
 * session to reach non-GET routes without a 401, so this is reachable only
 * by an already-logged-in user (or 401s, which is harmless for logout).
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { clearSession } from '$lib/server/auth/login.js';

export const POST: RequestHandler = async ({ cookies }) => {
	clearSession(cookies);
	throw redirect(303, '/login');
};
