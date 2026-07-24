import { describe, expect, it, vi } from 'vitest';
import { createSecretResolver } from './secret.js';

describe('createSecretResolver', () => {
	it('returns the configured secret unchanged when present, in dev or production', () => {
		const resolve = createSecretResolver();
		expect(resolve('configured-secret', false)).toBe('configured-secret');
		expect(resolve('configured-secret', true)).toBe('configured-secret');
	});

	it('production + no configured secret: throws (refuses to boot)', () => {
		const resolve = createSecretResolver();
		expect(() => resolve(undefined, true)).toThrow(/auth\.secret|COFFER_AUTH__SECRET/);
	});

	it('dev + no configured secret: generates a random per-boot secret and logs a warning', () => {
		const warn = vi.fn();
		const randomBytes = vi.fn((size: number) => Buffer.alloc(size, 7));
		const resolve = createSecretResolver({ warn, randomBytes });

		const secret = resolve(undefined, false);

		expect(secret).toBe(Buffer.alloc(32, 7).toString('hex'));
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toMatch(/random per-boot dev secret/);
	});

	it('dev + no configured secret: memoizes the generated secret across calls on the same instance (one instance = one boot)', () => {
		const randomBytes = vi.fn((size: number) => Buffer.from(`${Math.random()}`.padEnd(size, '0').slice(0, size)));
		const resolve = createSecretResolver({ warn: vi.fn(), randomBytes });

		const first = resolve(undefined, false);
		const second = resolve(undefined, false);

		expect(second).toBe(first);
		expect(randomBytes).toHaveBeenCalledTimes(1);
	});

	it('two independent resolver instances never share a generated dev secret', () => {
		const a = createSecretResolver({ warn: vi.fn() });
		const b = createSecretResolver({ warn: vi.fn() });
		expect(a(undefined, false)).not.toBe(b(undefined, false));
	});
});
