import { getServerConfig } from '$lib/server/container.server';
import type { LayoutServerLoad } from './$types.ts';

/** Adapter names for the status footer — config read only, no adapter constructed. */
export const load: LayoutServerLoad = async () => {
	const config = await getServerConfig();
	return {
		sttAdapter: config.get<string>('stt.adapter') ?? 'unknown',
		embeddingsAdapter: config.get<string>('embeddings.adapter') ?? 'unknown',
		answerAdapter: config.get<string>('answer.adapter') ?? 'unknown'
	};
};
