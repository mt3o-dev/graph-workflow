import { computeProvenance } from '$lib/server/config-provenance.server';
import { createNodeConfigReader } from '$lib/adapters/layered-config.adapter';
import type { PageServerLoad } from './$types';

const DISPLAYED_PATHS = [
	'stt.adapter',
	'stt.whisper.url',
	'stt.whisper.language',
	'stt.whisper.model',
	'stt.openai.url',
	'stt.openai.model',
	'embeddings.adapter',
	'embeddings.openai.model',
	'embeddings.openai.baseUrl',
	'answer.adapter',
	'answer.anthropic.model',
	'answer.anthropic.baseUrl',
	'answer.anthropic.maxTokens',
	'contextWindow.maxSeconds',
	'contextWindow.maxUtterances',
	'vad.silenceMs',
	'retrieval.topK',
	'index.adapter',
	'sessionLog.adapter',
	'kb.adapter',
	'kb.dir',
	'db.file'
] as const;

/**
 * Config-layer provenance for every field the Settings screen surfaces
 * [dec:9]. Read-only by construction: `ConfigPort` has no write method, so
 * there is nothing here to persist — the screen only ever displays.
 */
export const load: PageServerLoad = async () => {
	const reader = await createNodeConfigReader();
	const fields = computeProvenance(DISPLAYED_PATHS, {
		configDir: 'config',
		envName: process.env.NODE_ENV ?? 'development',
		userConfigPath: 'config/local.json',
		reader,
		env: process.env
	});
	return { fields };
};
