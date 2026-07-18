/**
 * Bridge tests run in the "server"/node vitest project (see vite.config.ts),
 * i.e. NOT inside a Tauri webview and NOT inside jsdom's `window`. That's
 * exactly the "pure-web dev mode" case the bridge is designed to keep
 * working, so these tests assert the isTauri()===false branch of every
 * exported function without mocking `@tauri-apps/api`.
 */
import { describe, expect, it } from 'vitest';
import { getAppDataDir, isTauri, spawnSidecarHint } from './bridge';

describe('tauri bridge (outside Tauri)', () => {
	it('isTauri() is false when window is undefined (node test environment)', () => {
		expect(isTauri()).toBe(false);
	});

	it('getAppDataDir() resolves to a non-throwing failure result', async () => {
		const result = await getAppDataDir();
		expect(result).toEqual({ ok: false, reason: 'not running inside Tauri' });
	});

	it('spawnSidecarHint() resolves to a non-throwing failure result', async () => {
		const result = await spawnSidecarHint();
		expect(result).toEqual({ ok: false, reason: 'not running inside Tauri' });
	});
});
