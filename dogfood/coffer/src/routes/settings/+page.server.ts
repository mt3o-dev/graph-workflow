/**
 * Settings screen ("The Steward's Study") load — P4, through the P3 loader
 * contract only (`loadSettings`). Read-only-ish v1 per plan.
 */
import type { PageServerLoad } from './$types.js';
import { getContainer } from '$lib/server/ui/container-singleton.js';
import { loadSettings } from '$lib/server/ui/loaders.js';

export const load: PageServerLoad = async () => {
	const container = await getContainer();
	return loadSettings(container);
};
