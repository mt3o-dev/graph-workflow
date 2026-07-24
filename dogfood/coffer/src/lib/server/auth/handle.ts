/**
 * The auth `Handle` factory ([node:d8caed23]) — gates ALL routes except
 * `/login` and static assets. Unauthenticated:
 *   - page GET (Accept: text/html, non-`/api` path) -> `303 /login`
 *   - everything else (`/api/**`, non-GET, non-HTML Accept) -> `401`
 *
 * Kept as a factory over an injected `sessionSecret` + `verifySession`/
 * `isExempt` so it's testable with fake `RequestEvent`s (no real SvelteKit
 * server needed).
 */
import { redirect, type Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME } from './constants.js';
import { verifySession } from './session.js';

const STATIC_EXEMPT_PREFIXES = ['/_app/'];
const STATIC_EXEMPT_PATHS = new Set(['/favicon.ico', '/favicon.png', '/robots.txt']);

/** Routes/assets reachable without authentication. */
export function isExemptPath(pathname: string): boolean {
	if (pathname === '/login') {
		return true;
	}
	if (STATIC_EXEMPT_PATHS.has(pathname)) {
		return true;
	}
	return STATIC_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** True when the request's `Accept` header indicates a browser HTML navigation. */
export function wantsHtml(request: Request): boolean {
	return (request.headers.get('accept') ?? '').includes('text/html');
}

export interface AuthHandleOptions {
	sessionSecret: string;
	isExempt?: (pathname: string) => boolean;
	now?: () => number;
}

/**
 * Decide the unauthenticated response for a given request: a `303` redirect
 * to `/login` for browser page navigations, `401` for everything else
 * (`/api/**`, non-GET, non-HTML Accept). Exposed standalone for direct unit
 * testing against a fake `Request`.
 */
export function unauthenticatedResponse(pathname: string, request: Request): Response {
	const isApi = pathname.startsWith('/api');
	const isGet = request.method === 'GET';
	if (isApi || !isGet || !wantsHtml(request)) {
		return new Response('Unauthorized', { status: 401 });
	}
	throw redirect(303, '/login');
}

export function createAuthHandle(options: AuthHandleOptions): Handle {
	const isExempt = options.isExempt ?? isExemptPath;
	const now = options.now ?? (() => Date.now());

	const handle: Handle = async ({ event, resolve }) => {
		const { pathname } = event.url;

		if (isExempt(pathname)) {
			return resolve(event);
		}

		const cookieValue = event.cookies.get(SESSION_COOKIE_NAME);
		const authenticated = verifySession(options.sessionSecret, cookieValue, now());
		event.locals.authenticated = authenticated;

		if (authenticated) {
			return resolve(event);
		}

		return unauthenticatedResponse(pathname, event.request);
	};

	return handle;
}
