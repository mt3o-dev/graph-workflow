import { describe, expect, it } from 'vitest';
import { MissingConfigError } from '../ports/config.port.ts';
import {
	deepMerge,
	envToObject,
	LayeredConfigAdapter,
	type ConfigSourceReader
} from './layered-config.adapter.ts';

function fakeReader(files: Record<string, Record<string, unknown>>): ConfigSourceReader {
	return { readJson: (path) => files[path] ?? null };
}

function makeAdapter(options: {
	files?: Record<string, Record<string, unknown>>;
	env?: Record<string, string>;
	envName?: string;
}) {
	return new LayeredConfigAdapter({
		configDir: 'config',
		envName: options.envName ?? 'test',
		userConfigPath: '/home/user/.config/interview-copilot/config.json',
		reader: fakeReader(options.files ?? {}),
		env: options.env ?? {}
	});
}

describe('deepMerge', () => {
	it('merges nested objects key-by-key', () => {
		expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3, z: 4 } })).toEqual({
			a: { x: 1, y: 3, z: 4 }
		});
	});

	it('replaces arrays and scalars instead of concatenating', () => {
		expect(deepMerge({ tags: [1, 2], n: 1 }, { tags: [3], n: 2 })).toEqual({ tags: [3], n: 2 });
	});
});

describe('envToObject', () => {
	it('nests on __ and JSON-parses values', () => {
		expect(
			envToObject(
				{ IC_contextWindow__maxSeconds: '15', IC_stt__adapter: 'openai', IC_debug: 'true' },
				'IC_'
			)
		).toEqual({ contextWindow: { maxSeconds: 15 }, stt: { adapter: 'openai' }, debug: true });
	});

	it('ignores non-prefixed variables', () => {
		expect(envToObject({ PATH: '/usr/bin', IC_a: '1' }, 'IC_')).toEqual({ a: 1 });
	});
});

describe('LayeredConfigAdapter precedence [dec:9]', () => {
	const defaultJson = {
		vad: { silenceMs: 700 },
		retrieval: { topK: 4 },
		stt: { adapter: 'whisper-local' }
	};

	it('serves defaults when no other layer overrides', () => {
		const config = makeAdapter({ files: { 'config/default.json': defaultJson } });
		expect(config.get<number>('vad.silenceMs')).toBe(700);
		expect(config.get<string>('stt.adapter')).toBe('whisper-local');
	});

	it('env config file overrides default.json', () => {
		const config = makeAdapter({
			files: {
				'config/default.json': defaultJson,
				'config/test.json': { vad: { silenceMs: 500 } }
			}
		});
		expect(config.get<number>('vad.silenceMs')).toBe(500);
		expect(config.get<number>('retrieval.topK')).toBe(4);
	});

	it('user config overrides the env config file', () => {
		const config = makeAdapter({
			files: {
				'config/default.json': defaultJson,
				'config/test.json': { vad: { silenceMs: 500 } },
				'/home/user/.config/interview-copilot/config.json': { vad: { silenceMs: 300 } }
			}
		});
		expect(config.get<number>('vad.silenceMs')).toBe(300);
	});

	it('IC_ env vars override every file layer', () => {
		const config = makeAdapter({
			files: {
				'config/default.json': defaultJson,
				'config/test.json': { vad: { silenceMs: 500 } },
				'/home/user/.config/interview-copilot/config.json': { vad: { silenceMs: 300 } }
			},
			env: { IC_vad__silenceMs: '250' }
		});
		expect(config.get<number>('vad.silenceMs')).toBe(250);
	});

	it('missing files are simply skipped', () => {
		const config = makeAdapter({ files: {} });
		expect(config.get('anything')).toBeUndefined();
	});

	it('selects the env file by envName', () => {
		const config = makeAdapter({
			envName: 'development',
			files: {
				'config/default.json': defaultJson,
				'config/development.json': { stt: { adapter: 'openai' } }
			}
		});
		expect(config.get<string>('stt.adapter')).toBe('openai');
	});

	it('require throws MissingConfigError on absent paths', () => {
		const config = makeAdapter({ files: { 'config/default.json': defaultJson } });
		expect(() => config.require('does.not.exist')).toThrow(MissingConfigError);
		expect(config.require<number>('retrieval.topK')).toBe(4);
	});
});
