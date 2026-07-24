import { describe, expect, it, vi } from 'vitest';
import { createAuthHandle, isExemptPath, unauthenticatedResponse, wantsHtml } from './handle.js';
import { issueSession } from './session.js';
import { SESSION_COOKIE_NAME } from './constants.js';

const SECRET = 'test-hook-secret';

interface FakeEventOptions {
	pathname: string;
	method?: string;
	accept?: string;
	cookieValue?: string;
}

function fakeEvent({ pathname, method = 'GET', accept = 'text/html', cookieValue }: FakeEventOptions) {
	const headers = new Headers();
	if (accept) headers.set('accept', accept);
	const request = new Request(`https://example.test${pathname}`, { method, headers });
	return {
		url: new URL(`https://example.test${pathname}`),
		request,
		cookies: { get: (name: string) => (name === SESSION_COOKIE_NAME ? cookieValue : undefined) },
		locals: {} as { authenticated?: boolean }
	};
}

describe('isExemptPath', () => {
	it('exempts /login and static asset prefixes', () => {
		expect(isExemptPath('/login')).toBe(true);
		expect(isExemptPath('/_app/immutable/foo.js')).toBe(true);
		expect(isExemptPath('/favicon.ico')).toBe(true);
	});

	it('does not exempt other routes, including /api and /login-adjacent paths', () => {
		expect(isExemptPath('/')).toBe(false);
		expect(isExemptPath('/api/import')).toBe(false);
		expect(isExemptPath('/logout')).toBe(false);
	});
});

describe('wantsHtml', () => {
	it('true for an Accept header containing text/html', () => {
		expect(wantsHtml(new Request('https://x.test', { headers: { accept: 'text/html,application/xhtml+xml' } }))).toBe(true);
	});

	it('false for a JSON-only Accept header or none at all', () => {
		expect(wantsHtml(new Request('https://x.test', { headers: { accept: 'application/json' } }))).toBe(false);
		expect(wantsHtml(new Request('https://x.test'))).toBe(false);
	});
});

describe('unauthenticatedResponse: gated 401 vs 303 redirect, by path/method/Accept', () => {
	it('401s an unauthenticated /api/** request regardless of Accept', () => {
		const res = unauthenticatedResponse('/api/import', new Request('https://x.test/api/import', { headers: { accept: 'text/html' } }));
		expect(res.status).toBe(401);
	});

	it('401s an unauthenticated non-GET page request', () => {
		const res = unauthenticatedResponse(
			'/settings',
			new Request('https://x.test/settings', { method: 'POST', headers: { accept: 'text/html' } })
		);
		expect(res.status).toBe(401);
	});

	it('401s a GET request that does not accept HTML', () => {
		const res = unauthenticatedResponse('/settings', new Request('https://x.test/settings', { headers: { accept: 'application/json' } }));
		expect(res.status).toBe(401);
	});

	it('303-redirects to /login for an unauthenticated browser page GET', () => {
		try {
			unauthenticatedResponse('/settings', new Request('https://x.test/settings', { headers: { accept: 'text/html' } }));
			expect.unreachable('expected a redirect throw');
		} catch (e) {
			expect((e as { status: number; location: string }).status).toBe(303);
			expect((e as { status: number; location: string }).location).toBe('/login');
		}
	});
});

describe('createAuthHandle', () => {
	const resolve = vi.fn(async () => new Response('ok'));

	it('exempt paths resolve without checking auth', async () => {
		resolve.mockClear();
		const handle = createAuthHandle({ sessionSecret: SECRET });
		const event = fakeEvent({ pathname: '/login' });
		const res = await handle({ event: event as never, resolve });
		expect(res.status).toBe(200);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('a valid session cookie authenticates, sets locals.authenticated, and resolves', async () => {
		resolve.mockClear();
		const now = Date.now();
		const cookieValue = issueSession(SECRET, 1000 * 60, now);
		const handle = createAuthHandle({ sessionSecret: SECRET, now: () => now });
		const event = fakeEvent({ pathname: '/', cookieValue });

		const res = await handle({ event: event as never, resolve });

		expect(res.status).toBe(200);
		expect(event.locals.authenticated).toBe(true);
	});

	it('a missing/invalid session cookie on a page GET redirects to /login (303) and marks locals.authenticated false', async () => {
		resolve.mockClear();
		const handle = createAuthHandle({ sessionSecret: SECRET });
		const event = fakeEvent({ pathname: '/' });

		await expect(handle({ event: event as never, resolve })).rejects.toMatchObject({ status: 303, location: '/login' });
		expect(event.locals.authenticated).toBe(false);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('a missing session cookie on /api/** 401s', async () => {
		resolve.mockClear();
		const handle = createAuthHandle({ sessionSecret: SECRET });
		const event = fakeEvent({ pathname: '/api/import' });

		const res = await handle({ event: event as never, resolve });

		expect(res.status).toBe(401);
		expect(resolve).not.toHaveBeenCalled();
	});

	it('a tampered session cookie is rejected the same as a missing one', async () => {
		resolve.mockClear();
		const now = Date.now();
		const cookieValue = issueSession(SECRET, 1000 * 60, now) + 'tampered';
		const handle = createAuthHandle({ sessionSecret: SECRET, now: () => now });
		const event = fakeEvent({ pathname: '/api/import', cookieValue });

		const res = await handle({ event: event as never, resolve });

		expect(res.status).toBe(401);
	});
});
