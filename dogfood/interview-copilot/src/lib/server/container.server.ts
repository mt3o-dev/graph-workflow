/**
 * Server-only composition root for SvelteKit `load` functions.
 *
 * This is the one place the UI is allowed to reach past ports/core into the
 * real adapters — via `createContainer`, never by importing an adapter
 * directly (hexagonal purity rule). It only runs in `+page.server.ts` /
 * `+layout.server.ts` load functions (SvelteKit enforces `src/lib/server/**`
 * never reaches the client bundle), so native deps (better-sqlite3) and
 * `node:fs` are safe here.
 *
 * No network-calling adapter method is ever invoked from these load
 * functions — only `config`, `kb.listDocs/getDoc`, and `sessionLog.*`, all of
 * which are local (markdown files / SQLite).
 */
import type { Container } from '../di/container.ts';
import { createContainer } from '../di/container.ts';
import { createNodeConfigReader, LayeredConfigAdapter } from '../adapters/layered-config.adapter.ts';
import type { ConfigPort } from '../ports/config.port.ts';

let containerPromise: Promise<Container> | null = null;
let configPromise: Promise<ConfigPort> | null = null;

/**
 * Layered config [dec:9]: `config/default.json` < `config/<env>.json` <
 * `config/local.json` (gitignored, never committed) < `IC_`-prefixed env
 * vars. `NODE_ENV` selects the env layer file; SvelteKit's dev server leaves
 * it unset, so it defaults to `development`.
 */
export async function getServerConfig(): Promise<ConfigPort> {
	configPromise ??= buildConfig();
	return configPromise;
}

/** The full composition-root container, built once per server process. */
export async function getServerContainer(): Promise<Container> {
	containerPromise ??= buildContainer();
	return containerPromise;
}

async function buildConfig(): Promise<ConfigPort> {
	const reader = await createNodeConfigReader();
	return new LayeredConfigAdapter({
		configDir: 'config',
		envName: process.env.NODE_ENV ?? 'development',
		userConfigPath: 'config/local.json',
		reader,
		env: process.env
	});
}

async function buildContainer(): Promise<Container> {
	const config = await getServerConfig();
	return createContainer(config);
}
