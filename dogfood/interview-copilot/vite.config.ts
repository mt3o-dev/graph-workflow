import { defineConfig } from 'vitest/config';
import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

// The Tauri shell (src-tauri/, tauri.conf.json) needs a fully static build it
// can embed in the webview — SvelteKit's SPA-fallback static adapter — while
// the plain-web dev/CI flow keeps using adapter-auto (tech-stack.md decision 1:
// the TS/Svelte app must stand on its own, verifiable with pnpm alone, and the
// Tauri packaging is a separate concern layered on top).
//
// `pnpm tauri build`/`pnpm tauri dev` set TAURI_BUILD=1 (see package.json
// "tauri" script and src-tauri/tauri.conf.json beforeBuildCommand/
// beforeDevCommand) so this file picks adapter-static with an SPA fallback
// (index.html) matching tauri.conf.json's `frontendDist: "../build"`. Every
// other invocation (`pnpm build`, `pnpm dev`, CI) is unaffected.
const isTauriBuild = process.env.TAURI_BUILD === '1';

const adapter = isTauriBuild
	? adapterStatic({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
	: adapterAuto();

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			// Swapped for adapter-static (SPA fallback) under TAURI_BUILD=1 — see comment above.
			adapter
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}'],
					exclude: [
						'src/**/*.svelte.{test,spec}.{js,ts}',
						// Scaffold leftover; not part of the suite (deletion blocked by sandbox policy).
						'src/lib/vitest-examples/**'
					]
				}
			},
			{
				extends: './vite.config.ts',
				resolve: {
					conditions: ['browser']
				},
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./src/test/setup-client.ts']
				}
			}
		]
	}
});
