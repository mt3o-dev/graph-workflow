import type { Options } from '@wdio/types';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';

/**
 * WebdriverIO config that drives the Tauri 2 webview through `tauri-driver`,
 * per tech-stack.md decision 11 (Playwright cannot attach to a Tauri
 * webview; tauri-driver is the officially supported WebDriver bridge on
 * Linux/Windows). This is authored and type-checked here but is NOT run on
 * this machine — see e2e/README-e2e.md and docs/deferred-verification.md.
 *
 * `pnpm test:e2e` always runs e2e/preflight.ts first, which exits before
 * this file is ever loaded by wdio if tauri-driver or the debug binary is
 * missing.
 */

const rootDir = join(import.meta.dirname, '..');
const debugBinary = join(rootDir, 'src-tauri', 'target', 'debug', 'interview-copilot');

let tauriDriverProcess: ChildProcessWithoutNullStreams | undefined;

export const config: Options.Testrunner = {
	runner: 'local',
	autoCompileOpts: {
		autoCompile: true,
		tsNodeOpts: {
			transpileOnly: true,
			project: join(rootDir, 'tsconfig.json')
		}
	},
	specs: ['./e2e/*.e2e.ts'],
	maxInstances: 1,
	// tauri-driver speaks WebDriver on this fixed local port by convention;
	// no browser capability — the "browserName" here is required by the
	// WebDriver protocol shape but ignored by tauri-driver, which launches
	// the native binary at `tauri:options.application` instead.
	hostname: '127.0.0.1',
	port: 4444,
	path: '/',
	capabilities: [
		{
			browserName: 'wry',
			// @ts-expect-error -- tauri-driver-specific capability, not in wdio's stock types
			'tauri:options': {
				application: debugBinary
			}
		}
	],
	logLevel: 'info',
	bail: 0,
	waitforTimeout: 10000,
	connectionRetryTimeout: 120000,
	connectionRetryCount: 3,
	framework: 'mocha',
	reporters: ['spec'],
	mochaOpts: {
		ui: 'bdd',
		timeout: 60000
	},

	// Starts tauri-driver before the suite and stops it after — mirrors the
	// standard Tauri wdio example. Requires `tauri-driver` on PATH (installed
	// via `cargo install tauri-driver`); by the time this hook runs,
	// e2e/preflight.ts has already verified that.
	onPrepare: function () {
		tauriDriverProcess = spawn('tauri-driver', [], {
			stdio: [null, process.stdout, process.stderr]
		});
	},

	onComplete: function () {
		tauriDriverProcess?.kill();
	}
};
