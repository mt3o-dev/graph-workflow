import { describe, expect, it } from 'vitest';
import type { TranscriptionPort } from '../../lib/ports/transcription.port.ts';
import type { TranscriptSegment } from '../../lib/ports/types.ts';

export interface TranscriptionHarness {
	port: TranscriptionPort;
	/** Simulate the remote service producing a final transcript line. */
	pushTranscript(text: string): void;
}

/**
 * Shared TranscriptionPort contract. Each implementation provides a harness
 * that drives its transport (fake: direct emit; WS adapters: scripted socket).
 */
export function describeTranscriptionContract(
	name: string,
	factory: () => Promise<TranscriptionHarness> | TranscriptionHarness
) {
	describe(`TranscriptionPort contract: ${name}`, () => {
		it('delivers final segments to subscribed listeners after start', async () => {
			const { port, pushTranscript } = await factory();
			const received: TranscriptSegment[] = [];
			port.onSegment((segment) => received.push(segment));
			await port.start();
			pushTranscript('hello world');
			const finals = received.filter((s) => s.final);
			expect(finals).toHaveLength(1);
			expect(finals[0]!.text).toContain('hello world');
			expect(finals[0]!.endMs).toBeGreaterThanOrEqual(finals[0]!.startMs);
			await port.stop();
		});

		it('supports multiple listeners and unsubscribe', async () => {
			const { port, pushTranscript } = await factory();
			const a: string[] = [];
			const b: string[] = [];
			const unsubA = port.onSegment((s) => {
				if (s.final) a.push(s.text);
			});
			port.onSegment((s) => {
				if (s.final) b.push(s.text);
			});
			await port.start();
			pushTranscript('first');
			unsubA();
			pushTranscript('second');
			expect(a).toHaveLength(1);
			expect(b).toHaveLength(2);
			await port.stop();
		});

		it('accepts audio after start and stop resolves cleanly', async () => {
			const { port } = await factory();
			await port.start();
			expect(() => port.sendAudio(new Uint8Array([1, 2, 3]))).not.toThrow();
			await expect(port.stop()).resolves.toBeUndefined();
		});
	});
}
