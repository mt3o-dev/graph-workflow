/**
 * Config-layer provenance for the Settings screen [dec:9].
 *
 * `LayeredConfigAdapter` only exposes the merged result; it does not track
 * which layer set a given value. Rather than modify that adapter, this reads
 * the same four layers independently (via the exported `deepMerge`/
 * `envToObject` helpers) and reports, per dotted path, the last layer that
 * defined it — display-only, never used to mutate config (ConfigPort has no
 * write method: the whole Settings screen is inherently read-only).
 */
import { deepMerge, envToObject, type ConfigSourceReader } from '../adapters/layered-config.adapter.ts';

export type ConfigLayerName = 'default' | 'env-file' | 'user-file' | 'env-var';

export interface ConfigFieldProvenance {
	path: string;
	value: unknown;
	setBy: ConfigLayerName | null;
	/** True once the highest-precedence (env-var) layer set this path — no lower layer can override it. */
	lockedByEnvVar: boolean;
}

const LAYER_ORDER: ConfigLayerName[] = ['default', 'env-file', 'user-file', 'env-var'];

function getAtPath(node: unknown, path: string): unknown {
	let current: unknown = node;
	for (const key of path.split('.')) {
		if (typeof current !== 'object' || current === null || !(key in current)) return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

export interface ProvenanceOptions {
	configDir: string;
	envName: string;
	userConfigPath: string;
	reader: ConfigSourceReader;
	env: Readonly<Record<string, string | undefined>>;
	envPrefix?: string;
}

/** Computes provenance for a fixed set of dotted paths surfaced on the Settings screen. */
export function computeProvenance(
	paths: readonly string[],
	options: ProvenanceOptions
): ConfigFieldProvenance[] {
	const prefix = options.envPrefix ?? 'IC_';
	const layers: Record<ConfigLayerName, Record<string, unknown>> = {
		default: options.reader.readJson(`${options.configDir}/default.json`) ?? {},
		'env-file': options.reader.readJson(`${options.configDir}/${options.envName}.json`) ?? {},
		'user-file': options.reader.readJson(options.userConfigPath) ?? {},
		'env-var': envToObject(options.env, prefix)
	};

	let merged: Record<string, unknown> = {};
	for (const name of LAYER_ORDER) {
		merged = deepMerge(merged, layers[name]);
	}

	return paths.map((path) => {
		let setBy: ConfigLayerName | null = null;
		for (const name of LAYER_ORDER) {
			if (getAtPath(layers[name], path) !== undefined) setBy = name;
		}
		return {
			path,
			value: getAtPath(merged, path),
			setBy,
			lockedByEnvVar: getAtPath(layers['env-var'], path) !== undefined
		};
	});
}
