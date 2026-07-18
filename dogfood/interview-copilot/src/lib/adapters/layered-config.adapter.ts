import { MissingConfigError, type ConfigPort } from '../ports/config.port.ts';

/** Reads a JSON file; returns null when the file does not exist. */
export interface ConfigSourceReader {
	readJson(path: string): Record<string, unknown> | null;
}

export interface LayeredConfigOptions {
	/** Directory holding default.json and <env>.json. */
	configDir: string;
	/** Environment name selecting `<configDir>/<envName>.json`. */
	envName: string;
	/** Absolute path of the user config file (e.g. ~/.config/interview-copilot/config.json). */
	userConfigPath: string;
	reader: ConfigSourceReader;
	/** Process environment (injected; tests never touch the real env). */
	env: Readonly<Record<string, string | undefined>>;
	/** Env var prefix. Default "IC_". */
	envPrefix?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursive merge: objects merge key-by-key; arrays and scalars are replaced. */
export function deepMerge(
	base: Record<string, unknown>,
	override: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		const existing = result[key];
		result[key] =
			isPlainObject(existing) && isPlainObject(value)
				? deepMerge(existing, value)
				: structuredClone(value);
	}
	return result;
}

/**
 * Turns `IC_`-prefixed env vars into a nested object.
 * `__` is the nesting separator: `IC_contextWindow__maxSeconds=15` →
 * `{ contextWindow: { maxSeconds: 15 } }`. Values are JSON-parsed when
 * possible (numbers, booleans, null, arrays), otherwise kept as strings.
 */
export function envToObject(
	env: Readonly<Record<string, string | undefined>>,
	prefix: string
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [name, raw] of Object.entries(env)) {
		if (!name.startsWith(prefix) || raw === undefined) continue;
		const path = name.slice(prefix.length).split('__').filter(Boolean);
		if (path.length === 0) continue;
		let parsed: unknown = raw;
		try {
			parsed = JSON.parse(raw);
		} catch {
			// keep the raw string
		}
		let node = result;
		for (const key of path.slice(0, -1)) {
			if (!isPlainObject(node[key])) node[key] = {};
			node = node[key] as Record<string, unknown>;
		}
		node[path.at(-1)!] = parsed;
	}
	return result;
}

/**
 * Layered configuration [dec:9], lowest to highest precedence:
 * `config/default.json` < `config/<env>.json` < user config file < `IC_` env vars.
 * All sources are injected, so unit tests never touch the real fs/env.
 */
export class LayeredConfigAdapter implements ConfigPort {
	private readonly data: Record<string, unknown>;

	constructor(options: LayeredConfigOptions) {
		const prefix = options.envPrefix ?? 'IC_';
		const layers: Array<Record<string, unknown>> = [
			options.reader.readJson(`${options.configDir}/default.json`) ?? {},
			options.reader.readJson(`${options.configDir}/${options.envName}.json`) ?? {},
			options.reader.readJson(options.userConfigPath) ?? {},
			envToObject(options.env, prefix)
		];
		this.data = layers.reduce((merged, layer) => deepMerge(merged, layer), {});
	}

	get<T>(path: string): T | undefined {
		let node: unknown = this.data;
		for (const key of path.split('.')) {
			if (!isPlainObject(node) || !(key in node)) return undefined;
			node = node[key];
		}
		return node as T;
	}

	require<T>(path: string): T {
		const value = this.get<T>(path);
		if (value === undefined) throw new MissingConfigError(path);
		return value;
	}
}

/**
 * Node-backed ConfigSourceReader (adapter-side convenience; not used in unit
 * tests). Dynamic import keeps `node:fs` out of any browser bundle graph.
 */
export async function createNodeConfigReader(): Promise<ConfigSourceReader> {
	const { readFileSync, existsSync } = await import('node:fs');
	return {
		readJson(path: string): Record<string, unknown> | null {
			if (!existsSync(path)) return null;
			return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
		}
	};
}
