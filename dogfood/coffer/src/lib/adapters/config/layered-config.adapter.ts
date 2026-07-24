/**
 * LayeredConfigAdapter — implements ConfigPort by deep-merging three layers,
 * lowest to highest precedence ([dec:11]):
 *
 *   config/default.json  <  config/<env>.json  <  COFFER_-prefixed env vars
 *
 * Env-var nesting uses `__` as the path separator, e.g.
 * `COFFER_db__path=/data/x.db` sets `db.path`. Env values are parsed with a
 * JSON-first strategy (numbers/booleans/arrays/objects), falling back to the
 * raw string when the value isn't valid JSON.
 *
 * This is an adapter (outside core), so node builtins are fine here. Both
 * the config-file directory/env name AND the env source are constructor-
 * injected so tests never have to mutate the real `process.env`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig, ConfigPort } from '../../ports/config.port.js';

/** A plain string-keyed record shaped like `process.env`. */
export type EnvSource = Record<string, string | undefined>;

/** A JSON-ish plain object used for deep-merging config layers. */
export type ConfigObject = Record<string, unknown>;

export interface LayeredConfigOptions {
	/** Directory containing default.json / <env>.json. Defaults to "config". */
	configDir?: string;
	/** Env layer name, e.g. "development" | "test" | "production". */
	env?: string;
	/** Source of environment variables. Defaults to `process.env`. */
	envSource?: EnvSource;
	/** Prefix identifying config-relevant env vars. Defaults to "COFFER_". */
	envPrefix?: string;
}

function isPlainObject(value: unknown): value is ConfigObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `source` over `base`. Plain objects merge key-by-key
 * recursively; arrays and primitives in `source` replace the value in
 * `base` wholesale (arrays are never element-wise merged).
 */
export function deepMerge<T extends ConfigObject>(base: T, source: ConfigObject): T {
	const result: ConfigObject = { ...base };
	for (const [key, sourceValue] of Object.entries(source)) {
		const baseValue = result[key];
		if (isPlainObject(baseValue) && isPlainObject(sourceValue)) {
			result[key] = deepMerge(baseValue, sourceValue);
		} else {
			result[key] = sourceValue;
		}
	}
	return result as T;
}

/** Parse a raw env-var string into a typed value: JSON-first, else the raw string. */
export function parseEnvValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === '') {
		return raw;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return raw;
	}
}

/**
 * Build a nested config object from every `${envPrefix}`-prefixed key in
 * `envSource`. The remainder of the key (after stripping the prefix) is
 * split on `__` to form the nested path, preserving case, e.g.
 * `COFFER_db__path` -> `{ db: { path: <value> } }`.
 *
 * Case is preserved here; the adapter later normalizes each env segment
 * against the canonical key casing established by the file layers (see
 * {@link normalizeEnvCase}), so the conventional `COFFER_AUTH__SECRET`
 * reaches `auth.secret` and camelCase keys like `enabledParsers` still match
 * their `COFFER_IMPORT__ENABLEDPARSERS` form.
 */
export function envToObject(envSource: EnvSource, envPrefix: string): ConfigObject {
	const result: ConfigObject = {};
	for (const [key, rawValue] of Object.entries(envSource)) {
		if (rawValue === undefined || !key.startsWith(envPrefix)) {
			continue;
		}
		const remainder = key.slice(envPrefix.length);
		if (remainder === '') {
			continue;
		}
		const segments = remainder.split('__').filter((segment) => segment.length > 0);
		if (segments.length === 0) {
			continue;
		}
		const value = parseEnvValue(rawValue);

		let cursor = result;
		for (let i = 0; i < segments.length - 1; i++) {
			const segment = segments[i];
			const existing = cursor[segment];
			if (!isPlainObject(existing)) {
				cursor[segment] = {};
			}
			cursor = cursor[segment] as ConfigObject;
		}
		cursor[segments[segments.length - 1]] = value;
	}
	return result;
}

function readJsonFileIfExists(path: string): ConfigObject {
	if (!existsSync(path)) {
		return {};
	}
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as unknown;
	if (!isPlainObject(parsed)) {
		throw new Error(`Config file did not contain a JSON object: ${path}`);
	}
	return parsed;
}

function getByPath(source: ConfigObject, path: string): unknown {
	const segments = path.split('.').filter((segment) => segment.length > 0);
	let cursor: unknown = source;
	for (const segment of segments) {
		if (!isPlainObject(cursor) || !(segment in cursor)) {
			return undefined;
		}
		cursor = cursor[segment];
	}
	return cursor;
}

/**
 * Re-key an env-derived config object so each segment adopts the casing of a
 * case-insensitively-matching key in `canonical` (the merged file layers).
 * Env vars are conventionally UPPERCASE (`COFFER_AUTH__SECRET`), while config
 * keys are lower/camelCase (`auth.secret`, `import.enabledParsers`) — without
 * this, the env layer silently creates parallel keys and never overrides.
 * Unmatched segments fall back to lowercase (the documented convention for
 * keys that don't exist in any file layer).
 */
export function normalizeEnvCase(env: ConfigObject, canonical: ConfigObject): ConfigObject {
	const result: ConfigObject = {};
	const canonicalByLower = new Map(Object.keys(canonical).map((k) => [k.toLowerCase(), k]));
	for (const [key, value] of Object.entries(env)) {
		const target = canonicalByLower.get(key.toLowerCase()) ?? key.toLowerCase();
		const canonicalChild = canonical[target];
		result[target] =
			isPlainObject(value) && isPlainObject(canonicalChild)
				? normalizeEnvCase(value, canonicalChild)
				: isPlainObject(value)
					? normalizeEnvCase(value, {})
					: value;
	}
	return result;
}

const DEFAULT_ENV = 'development';
const DEFAULT_ENV_PREFIX = 'COFFER_';

export class LayeredConfigAdapter implements ConfigPort {
	private readonly merged: ConfigObject;

	constructor(options: LayeredConfigOptions = {}) {
		const configDir = options.configDir ?? join(process.cwd(), 'config');
		const env = options.env ?? process.env.NODE_ENV ?? DEFAULT_ENV;
		const envSource = options.envSource ?? process.env;
		const envPrefix = options.envPrefix ?? DEFAULT_ENV_PREFIX;

		const defaults = readJsonFileIfExists(join(configDir, 'default.json'));
		const envFile = readJsonFileIfExists(join(configDir, `${env}.json`));
		const envVars = envToObject(envSource, envPrefix);

		const fileLayers = deepMerge(defaults, envFile);
		this.merged = deepMerge(fileLayers, normalizeEnvCase(envVars, fileLayers));
	}

	get<T>(path: string, defaultValue?: T): T {
		const value = getByPath(this.merged, path);
		if (value === undefined) {
			if (defaultValue !== undefined) {
				return defaultValue;
			}
			throw new Error(`Config path not found: "${path}"`);
		}
		return value as T;
	}

	getAll(): AppConfig {
		return this.merged as unknown as AppConfig;
	}
}
