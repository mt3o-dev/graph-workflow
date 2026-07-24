/**
 * Boot-time auth wiring ([node:d8caed23]/[node:512a3d11]): reads
 * `auth.password` / `auth.secret` off the same layered config the rest of
 * the app uses, and resolves the session-signing secret ONCE per process.
 *
 * Module-singleton by design (Node caches this module across every
 * importer), so `hooks.server.ts`, the `/login` action, and `/logout`
 * share one resolved secret without re-reading config per request. In
 * production, importing this module throws when `auth.secret` /
 * `COFFER_AUTH__SECRET` is unset — the app refuses to boot ([node:512a3d11]).
 */
import { LayeredConfigAdapter } from '../../adapters/config/layered-config.adapter.js';
import { createSecretResolver } from './secret.js';

const config = new LayeredConfigAdapter();
const resolveSessionSecret = createSecretResolver();
const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

// `get(path, defaultValue)` treats an explicit `undefined` default the same
// as "no default" and throws — so optional `auth.*` fields are read off
// `getAll()` instead, where a missing key is just `undefined`, not a throw.
const authConfig = config.getAll().auth ?? {};

/** The configured passphrase, or `undefined` when unset (fail-closed: login always rejects). */
export const authPassword = authConfig.password;

/** The resolved session-signing secret (throws at import time if production + unset). */
export const sessionSecret = resolveSessionSecret(authConfig.secret, isProduction);
