import { describe, expect, it } from 'vitest';
import { describeTranscriptionContract } from '../../test/contracts/transcription.contract.ts';
import { MockWebSocket } from '../../test/mocks/mock-websocket.ts';
import type { TranscriptSegment } from '../ports/types.ts';
import { WhisperLocalAdapter } from './whisper-local.adapter.ts';

const UID = 'test-uid';

function makeHarness() {
	const ws = new MockWebSocket();
	// Script the WhisperLive server: acknowledge the JSON config with SERVER_READY.
	ws.onSend = (data) => {
		if (typeof data === 'string' && data.startsWith('{')) {
			ws.message({ uid: UID, message: 'SERVER_READY' });
		}
	};
	const adapter = new WhisperLocalAdapter({
		url: 'ws://localhost:9090',
		uid: UID,
		wsFactory: () => ws
	});
	return { ws, adapter };
}

describeTranscriptionContract('WhisperLocalAdapter (mocked WhisperLive socket)', () => {
	const { ws, adapter } = makeHarness();
	let t = 0;
	return {
		port: adapter,
		pushTranscript(text: string) {
			t += 2;
			ws.message({ uid: UID, segments: [{ start: t, end: t + 1, text, completed: true }] });
		}
	};
});

describe('WhisperLocalAdapter protocol specifics', () => {
	async function started() {
		const harness = makeHarness();
		const received: TranscriptSegment[] = [];
		harness.adapter.onSegment((s) => received.push(s));
		await harness.adapter.start();
		return { ...harness, received };
	}

	it('sends the WhisperLive config JSON on open', async () => {
		const { ws } = await started();
		const config = JSON.parse(ws.sent[0] as string) as Record<string, unknown>;
		expect(config).toMatchObject({ uid: UID, task: 'transcribe', language: 'en' });
	});

	it('converts seconds to ms and maps completed to final', async () => {
		const { ws, received } = await started();
		ws.message({
			uid: UID,
			segments: [
				{ start: '1.500', end: '2.750', text: 'done part', completed: true },
				{ start: '2.750', end: '3.000', text: 'still going' }
			]
		});
		expect(received).toEqual([
			{ text: 'done part', startMs: 1500, endMs: 2750, final: true },
			{ text: 'still going', startMs: 2750, endMs: 3000, final: false }
		]);
	});

	it('emits each completed segment only once across resends', async () => {
		const { ws, received } = await started();
		const segments = [{ start: 1, end: 2, text: 'stable', completed: true }];
		ws.message({ uid: UID, segments });
		ws.message({ uid: UID, segments: [...segments, { start: 2, end: 3, text: 'next' }] });
		expect(received.filter((s) => s.final)).toHaveLength(1);
	});

	it('ignores messages for another uid', async () => {
		const { ws, received } = await started();
		ws.message({ uid: 'someone-else', segments: [{ start: 0, end: 1, text: 'x', completed: true }] });
		expect(received).toHaveLength(0);
	});

	it('sends END_OF_AUDIO and closes on stop', async () => {
		const { ws, adapter } = await started();
		await adapter.stop();
		expect(ws.sent.at(-1)).toBe('END_OF_AUDIO');
		expect(ws.closed).toBe(true);
	});

	it('forwards raw audio chunks', async () => {
		const { ws, adapter } = await started();
		const chunk = new Uint8Array([9, 8, 7]);
		adapter.sendAudio(chunk);
		expect(ws.sent.at(-1)).toBe(chunk);
	});
});
