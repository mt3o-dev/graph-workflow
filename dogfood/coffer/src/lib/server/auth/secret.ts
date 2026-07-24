/**
 * Session-signing secret sourcing ([node:512a3d11]): `auth.secret` /
 * `COFFER_AUTH__SECRET` is required in production; if absent in dev, a
 * random per-boot secret is generated (sessions die on restart — acceptable
 * for dev). Production refuses to boot without it — fail-closed.
 *
 * `createSecretResolver` is a factory (not a module-level singleton) so
 * tests get an isolated cache per call instead of leaking a generated dev
 * secret across test cases.
 */
import { randomBytes } from 'node:crypto';

export interface SecretResolverDeps {
	/** Injectable for tests; defaults to `node:crypto`'s `randomBytes`. */
	randomBytes?: (size: number) => Buffer;
	/** Injectable for tests; defaults to `console.warn`. */
	warn?: (message: string) => void;
}

const DEV_SECRET_WARNING =
	'coffer: no auth.secret configured — using a random per-boot dev secret. ' +
	'Sessions will not survive a restart. Set auth.secret / COFFER_AUTH__SECRET before deploying.';

const PRODUCTION_MISSING_SECRET_ERROR =
	'coffer: auth.secret / COFFER_AUTH__SECRET is required in production and was not configured — refusing to boot.';

export type ResolveSessionSecret = (configuredSecret: string | undefined, isProduction: boolean) => string;

/**
 * Build a `resolveSessionSecret(configuredSecret, isProduction)` function.
 * The returned function memoizes the generated dev-mode secret across calls
 * on THIS instance only (mirrors "random per boot" — one process, one
 * instance, one secret for its lifetime).
 */
export function createSecretResolver(deps: SecretResolverDeps = {}): ResolveSessionSecret {
	const generateRandomBytes = deps.randomBytes ?? randomBytes;
	const warn = deps.warn ?? console.warn;
	let devSecret: string | undefined;

	return function resolveSessionSecret(configuredSecret, isProduction) {
		if (configuredSecret) {
			return configuredSecret;
		}
		if (isProduction) {
			throw new Error(PRODUCTION_MISSING_SECRET_ERROR);
		}
		if (!devSecret) {
			devSecret = generateRandomBytes(32).toString('hex');
			warn(DEV_SECRET_WARNING);
		}
		return devSecret;
	};
}
