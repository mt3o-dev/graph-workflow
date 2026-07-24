/**
 * Review screen ("The Scriptorium") load + actions — P4, through the P3
 * loader contract only (`loadReviewQueue`/`loadSettings`/`performAssign`/
 * `performSuggest`/`performPromoteRule`). `loadSettings` also supplies
 * `groups` for the assign multi-select (the review loader itself only
 * returns the queue, per the P3 contract).
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';
import { getContainer } from '$lib/server/ui/container-singleton.js';
import { loadReviewQueue, loadSettings, performAssign, performPromoteRule, performSuggest } from '$lib/server/ui/loaders.js';
import type { TransactionDto } from '$lib/server/ui/dto.js';

export const load: PageServerLoad = async () => {
	const container = await getContainer();
	const [queue, settings] = await Promise.all([loadReviewQueue(container), loadSettings(container)]);
	return { queue, groups: settings.groups };
};

function parseTx(form: FormData): TransactionDto {
	const raw = form.get('tx');
	if (typeof raw !== 'string') {
		throw new Error('missing tx field');
	}
	return JSON.parse(raw) as TransactionDto;
}

export const actions: Actions = {
	assign: async ({ request }) => {
		const form = await request.formData();
		try {
			const tx = parseTx(form);
			const groupIds = form.getAll('groupIds').map(String);
			const container = await getContainer();
			await performAssign(container, tx, groupIds);
			return { assigned: true };
		} catch {
			return fail(400, { error: true });
		}
	},
	suggest: async ({ request }) => {
		const form = await request.formData();
		try {
			const tx = parseTx(form);
			const container = await getContainer();
			const suggestions = await performSuggest(container, tx);
			return { suggested: { contentHash: tx.contentHash, suggestions } };
		} catch {
			return fail(400, { error: true });
		}
	},
	promote: async ({ request }) => {
		const form = await request.formData();
		try {
			const tx = parseTx(form);
			const groupIds = form.getAll('groupIds').map(String);
			const container = await getContainer();
			const rule = await performPromoteRule(container, tx, groupIds);
			return { promoted: rule };
		} catch {
			return fail(400, { error: true });
		}
	}
};
