import { describe, expect, it, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	LayeredConfigAdapter,
	deepMerge,
	envToObject,
	parseEnvValue,
	type EnvSource
} from './layered-config.adapter.js';

/** Create an isolated temp config dir with the given layer files written into it. */
function makeConfigDir(files: Record<string, unknown>): string {
	const dir = mkdtempSync(join(tmpdir(), 'coffer-config-test-'));
	for (const [name, contents] of Object.entries(files)) {
		writeFileSync(join(dir, name), JSON.stringify(contents), 'utf-8');
	}
	return dir;
}

const tempDirs: string[] = [];
function trackedConfigDir(files: Record<string, unknown>): string {
	const dir = makeConfigDir(files);
	tempDirs.push(dir);
	return dir;
}

afterAll(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe('deepMerge', () => {
	it('merges nested objects key-by-key rather than replacing them wholesale', () => {
		const base = { db: { path: 'a', pool: 5 }, locale: { default: 'en' } };
		const source = { db: { path: 'b' } };
		const result = deepMerge(base, source);
		expect(result).toEqual({ db: { path: 'b', pool: 5 }, locale: { default: 'en' } });
	});

	it('replaces arrays wholesale instead of merging element-wise', () => {
		const base = { import: { enabledParsers: ['csv', 'ofx'] } };
		const source = { import: { enabledParsers: ['csv'] } };
		expect(deepMerge(base, source)).toEqual({ import: { enabledParsers: ['csv'] } });
	});

	it('replaces primitives with the overriding value', () => {
		expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
	});

	it('does not mutate the base object', () => {
		const base = { db: { path: 'a' } };
		deepMerge(base, { db: { path: 'b' } });
		expect(base).toEqual({ db: { path: 'a' } });
	});
});

describe('parseEnvValue', () => {
	it('parses booleans', () => {
		expect(parseEnvValue('true')).toBe(true);
		expect(parseEnvValue('false')).toBe(false);
	});

	it('parses numbers', () => {
		expect(parseEnvValue('42')).toBe(42);
		expect(parseEnvValue('3.14')).toBe(3.14);
	});

	it('parses JSON arrays and objects', () => {
		expect(parseEnvValue('["csv","ofx"]')).toEqual(['csv', 'ofx']);
		expect(parseEnvValue('{"a":1}')).toEqual({ a: 1 });
	});

	it('falls back to the raw string when not valid JSON', () => {
		expect(parseEnvValue('heuristic')).toBe('heuristic');
		expect(parseEnvValue('./data/coffer.db')).toBe('./data/coffer.db');
	});

	it('preserves quoted-string JSON as the unwrapped string', () => {
		expect(parseEnvValue('"heuristic"')).toBe('heuristic');
	});
});

describe('envToObject', () => {
	it('builds a nested object from prefixed, __-separated env keys', () => {
		const env: EnvSource = {
			COFFER_db__path: '/data/x.db',
			COFFER_assist__enabled: 'true',
			IRRELEVANT_VAR: 'nope'
		};
		expect(envToObject(env, 'COFFER_')).toEqual({
			db: { path: '/data/x.db' },
			assist: { enabled: true }
		});
	});

	it('supports arbitrarily deep nesting via multiple __ separators', () => {
		const env: EnvSource = { COFFER_a__b__c: '1' };
		expect(envToObject(env, 'COFFER_')).toEqual({ a: { b: { c: 1 } } });
	});

	it('ignores keys without the prefix and undefined values', () => {
		const env: EnvSource = { COFFER_db__path: undefined, OTHER: 'x' };
		expect(envToObject(env, 'COFFER_')).toEqual({});
	});

	it('coerces types for each leaf independently', () => {
		const env: EnvSource = {
			COFFER_import__enabledParsers: '["csv","ofx"]',
			COFFER_locale__default: 'pl'
		};
		expect(envToObject(env, 'COFFER_')).toEqual({
			import: { enabledParsers: ['csv', 'ofx'] },
			locale: { default: 'pl' }
		});
	});
});

describe('LayeredConfigAdapter — precedence and merge', () => {
	it('uses default.json alone when no env file or env vars are present', () => {
		const configDir = trackedConfigDir({
			'default.json': { db: { path: 'default-path' }, locale: { default: 'en' } }
		});
		const adapter = new LayeredConfigAdapter({ configDir, env: 'development', envSource: {} });
		expect(adapter.get<string>('db.path')).toBe('default-path');
		expect(adapter.get<string>('locale.default')).toBe('en');
	});

	it('lets the env-file layer override matching keys from default.json', () => {
		const configDir = trackedConfigDir({
			'default.json': { db: { path: 'default-path' }, locale: { default: 'en' } },
			'development.json': { db: { path: 'dev-path' } }
		});
		const adapter = new LayeredConfigAdapter({ configDir, env: 'development', envSource: {} });
		expect(adapter.get<string>('db.path')).toBe('dev-path');
		// untouched key from default.json survives the merge
		expect(adapter.get<string>('locale.default')).toBe('en');
	});

	it('lets a COFFER_ env var override both default.json and the env file (highest precedence)', () => {
		const configDir = trackedConfigDir({
			'default.json': { db: { path: 'default-path' } },
			'development.json': { db: { path: 'dev-path' } }
		});
		const adapter = new LayeredConfigAdapter({
			configDir,
			env: 'development',
			envSource: { COFFER_db__path: 'env-var-path' }
		});
		expect(adapter.get<string>('db.path')).toBe('env-var-path');
	});

	it('deep-merges nested objects across all three layers instead of replacing siblings', () => {
		const configDir = trackedConfigDir({
			'default.json': {
				assist: { adapter: 'heuristic', enabled: false }
			},
			'development.json': {
				assist: { enabled: true }
			}
		});
		const adapter = new LayeredConfigAdapter({
			configDir,
			env: 'development',
			envSource: { COFFER_assist__adapter: 'llm' }
		});
		// adapter comes from env var, enabled comes from env file, both survive together
		expect(adapter.getAll().assist).toEqual({ adapter: 'llm', enabled: true });
	});

	it('tolerates a missing env-specific file (falls back to defaults only)', () => {
		const configDir = trackedConfigDir({
			'default.json': { db: { path: 'default-path' } }
			// no "production.json" written
		});
		const adapter = new LayeredConfigAdapter({ configDir, env: 'production', envSource: {} });
		expect(adapter.get<string>('db.path')).toBe('default-path');
	});

	it('honors an injected fake env object and never touches the real process.env', () => {
		const realCofferKeysBefore = Object.keys(process.env).filter((k) => k.startsWith('COFFER_'));
		const configDir = trackedConfigDir({ 'default.json': { db: { path: 'default-path' } } });

		const fakeEnv: EnvSource = { COFFER_db__path: 'fake-env-path' };
		const adapter = new LayeredConfigAdapter({ configDir, env: 'development', envSource: fakeEnv });

		expect(adapter.get<string>('db.path')).toBe('fake-env-path');
		const realCofferKeysAfter = Object.keys(process.env).filter((k) => k.startsWith('COFFER_'));
		expect(realCofferKeysAfter).toEqual(realCofferKeysBefore);
	});

	it('get() returns the provided default when the path is missing', () => {
		const configDir = trackedConfigDir({ 'default.json': { db: { path: 'x' } } });
		const adapter = new LayeredConfigAdapter({ configDir, env: 'development', envSource: {} });
		expect(adapter.get<number>('nope.nested', 42)).toBe(42);
	});

	it('get() throws for a missing path with no default provided', () => {
		const configDir = trackedConfigDir({ 'default.json': { db: { path: 'x' } } });
		const adapter = new LayeredConfigAdapter({ configDir, env: 'development', envSource: {} });
		expect(() => adapter.get('nope.nested')).toThrow(/Config path not found/);
	});

	it('getAll() returns the fully merged typed AppConfig shape', () => {
		const configDir = trackedConfigDir({
			'default.json': {
				db: { path: './data/coffer.db' },
				locale: { default: 'en' },
				import: { enabledParsers: ['csv', 'ofx'] },
				assist: { adapter: 'heuristic', enabled: false }
			}
		});
		const adapter = new LayeredConfigAdapter({ configDir, env: 'test', envSource: {} });
		expect(adapter.getAll()).toEqual({
			db: { path: './data/coffer.db' },
			locale: { default: 'en' },
			import: { enabledParsers: ['csv', 'ofx'] },
			assist: { adapter: 'heuristic', enabled: false }
		});
	});
});

describe('LayeredConfigAdapter — real config/ files', () => {
	it('loads the committed config/default.json + config/test.json layers cleanly', () => {
		const adapter = new LayeredConfigAdapter({ env: 'test', envSource: {} });
		const config = adapter.getAll();
		expect(config.db.path).toBe(':memory:');
		expect(config.locale.default).toBe('en');
		expect(config.import.enabledParsers).toEqual(['csv', 'ofx', 'generic-tabular-pdf']);
		expect(config.assist).toEqual({ adapter: 'heuristic', enabled: false });
	});
});
