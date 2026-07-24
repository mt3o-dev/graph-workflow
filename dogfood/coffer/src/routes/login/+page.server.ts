/**
 * `/login` form action ([node:d8caed23]): verifies the passphrase, sets the
 * signed session cookie on success, 303-redirects home. On failure, returns
 * a `fail(401, ...)` the page renders as an error (i18n'd by P4).
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { attemptLogin } from '$lib/server/auth/login.js';
import { authPassword, sessionSecret } from '$lib/server/auth/runtime.js';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const passphrase = String(form.get('passphrase') ?? '');

		const ok = attemptLogin({ passphrase, configuredPassword: authPassword, sessionSecret, cookies });
		if (!ok) {
			return fail(401, { error: true });
		}

		throw redirect(303, '/');
	}
};
