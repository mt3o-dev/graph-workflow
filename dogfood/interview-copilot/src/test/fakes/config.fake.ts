import { MissingConfigError, type ConfigPort } from '../../lib/ports/config.port.ts';

/** In-memory ConfigPort backed by a plain nested object. */
export class FakeConfig implements ConfigPort {
	constructor(private readonly data: Record<string, unknown>) {}

	get<T>(path: string): T | undefined {
		let node: unknown = this.data;
		for (const key of path.split('.')) {
			if (typeof node !== 'object' || node === null || !(key in node)) return undefined;
			node = (node as Record<string, unknown>)[key];
		}
		return node as T;
	}

	require<T>(path: string): T {
		const value = this.get<T>(path);
		if (value === undefined) throw new MissingConfigError(path);
		return value;
	}
}
