import { getServerConfig } from '$lib/server/container.server';
import type { PageServerLoad } from './$types.ts';

/**
 * Configured adapter names + numbers, for the Live Session screen's
 * adapter-status indicators and context-window meter defaults. Display only —
 * the session itself always runs in demo mode (see live-session.svelte.ts).
 */
export const load: PageServerLoad = async () => {
	const config = await getServerConfig();
	return {
		configured: {
			sttAdapter: config.get<string>('stt.adapter') ?? 'unknown',
			embeddingsAdapter: config.get<string>('embeddings.adapter') ?? 'unknown',
			answerAdapter: config.get<string>('answer.adapter') ?? 'unknown'
		},
		contextWindow: {
			maxSeconds: config.get<number>('contextWindow.maxSeconds') ?? 30,
			maxUtterances: config.get<number>('contextWindow.maxUtterances') ?? 6
		},
		vadSilenceMs: config.get<number>('vad.silenceMs') ?? 700
	};
};
