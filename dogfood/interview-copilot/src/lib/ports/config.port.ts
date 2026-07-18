/** Read-only access to the layered application configuration. */
export interface ConfigPort {
	/** Dotted-path lookup, e.g. `get<number>('contextWindow.maxSeconds')`. */
	get<T>(path: string): T | undefined;
	/** Like `get`, but throws when the path is missing. */
	require<T>(path: string): T;
}

export class MissingConfigError extends Error {
	constructor(readonly path: string) {
		super(`Missing required config value: ${path}`);
		this.name = 'MissingConfigError';
	}
}
