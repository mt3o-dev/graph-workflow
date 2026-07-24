/**
 * Import screen ("Tally the Takings") load + action — P4, through the P3
 * loader contract only (`loadImportScreen`/`performImport`).
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getContainer } from '$lib/server/ui/container-singleton.js';
import { loadImportScreen, performImport } from '$lib/server/ui/loaders.js';

export const load: PageServerLoad = async () => {
	const container = await getContainer();
	return { importScreen: await loadImportScreen(container) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const sourceAccount = String(form.get('sourceAccount') ?? '');
		const defaultCurrency = String(form.get('defaultCurrency') ?? '').toUpperCase();
		const file = form.get('statement');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: true });
		}

		const container = await getContainer();
		const ctx = { sourceAccount, defaultCurrency };

		try {
			const result = file.name.toLowerCase().endsWith('.pdf')
				? await performImport(container, {
						kind: 'pdf',
						bytes: new Uint8Array(await file.arrayBuffer()),
						ctx,
						sourceLabel: file.name
					})
				: await performImport(container, {
						kind: 'text',
						payload: await file.text(),
						ctx,
						sourceLabel: file.name
					});
			return { result };
		} catch {
			return fail(400, { error: true });
		}
	}
};
