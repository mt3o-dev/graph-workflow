/**
 * ConfigPort — typed access to the layered application configuration
 * ([dec:11]: config/default.json < config/<env>.json < COFFER_-prefixed env
 * vars, deep-merged).
 *
 * This file is imported by core, so it MUST stay import-clean: no adapter,
 * no framework, no node builtin, no bare package. Types + a plain interface
 * only (enforced by boundary-lint).
 */

/** Which assist adapter backs the (future, slice-2+) categorization assist. */
export type AssistAdapterKind = 'heuristic' | 'llm';

/** Identifiers for the statement-parser adapters the import pipeline may use. */
export type ParserId = 'csv' | 'ofx' | 'generic-tabular-pdf' | (string & {});

export interface DbConfig {
	/** Filesystem path (or ':memory:') for the SQLite database file. */
	path: string;
}

export interface LocaleConfig {
	/** BCP-47 default locale, e.g. "en" or "pl". */
	default: string;
}

export interface ImportConfig {
	/** Ordered set of statement-parser adapter ids enabled for import. */
	enabledParsers: ParserId[];
}

export interface AssistConfig {
	/** Which AssistPort adapter to construct when assist is enabled. */
	adapter: AssistAdapterKind;
	/** Assist is opt-in and off by default ([dec:7]). */
	enabled: boolean;
}

/**
 * Auth config ([node:74be155e]/[node:d8caed23]/[node:512a3d11]): both fields
 * are optional and fail-closed when absent — no password configured means
 * every login attempt is rejected; no secret configured means dev generates
 * a random per-boot secret while production refuses to boot.
 */
export interface AuthConfig {
	/** The single passphrase (env `COFFER_AUTH__PASSWORD`). Absent = fail-closed (no login possible). */
	password?: string;
	/** HMAC session-signing secret (env `COFFER_AUTH__SECRET`). Required in production. */
	secret?: string;
}

/** The full, typed application configuration shape. */
export interface AppConfig {
	db: DbConfig;
	locale: LocaleConfig;
	import: ImportConfig;
	assist: AssistConfig;
	auth: AuthConfig;
}

/**
 * Port for reading the layered, merged application configuration.
 *
 * `get<T>(path)` reads a dot-separated path into the merged config tree
 * (e.g. `get<string>('db.path')`); `getAll()` returns the fully typed
 * `AppConfig`. Implementations MUST resolve precedence and merging entirely
 * inside the adapter — core code only ever sees the resulting value(s).
 */
export interface ConfigPort {
	/**
	 * Read a single value by dot-separated path (e.g. "assist.enabled").
	 * If the path is missing and `defaultValue` is provided, it is returned
	 * instead; otherwise a missing path is an error.
	 */
	get<T>(path: string, defaultValue?: T): T;

	/** Read the whole, typed configuration tree. */
	getAll(): AppConfig;
}
