import { getServerContainer } from '$lib/server/container.server';
import type { PageServerLoad } from './$types';

/** Full KB doc list (markdown adapter, local disk reads only — no network). */
export const load: PageServerLoad = async () => {
	const container = await getServerContainer();
	const docs = await container.kb.listDocs();
	return { docs };
};
