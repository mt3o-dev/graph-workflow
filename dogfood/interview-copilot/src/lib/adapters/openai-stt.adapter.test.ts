import { describe, expect, it } from 'vitest';
import { describeTranscriptionContract } from '../../test/contracts/transcription.contract.ts';
import { MockWebSocket } from '../../test/mocks/mock-websocket.ts';
import type { TranscriptSegment } from '../ports/types.ts';
import { OpenAiSttAdapter } from './openai-stt.adapter.ts';

function makeHarness() {
	const ws = new MockWebSocket();
	let now = 0;
	const adapter = new OpenAiSttAdapter({
		apiKey: 'test-key',
		wsFactory: () => ws,
		clock: () => (now += 100)
	});
	return { ws, adapter };
}

describeTranscriptionContract('OpenAiSttAdapter (mocked Realtime socket)', () => {
	const { ws, adapter } = makeHarness();
	return {
		port: adapter,
		pushTranscript(text: string) {
			ws.message({ type: 'conversation.item.input_audio_transcription.delta', delta: text });
			ws.message({
				type: 'conversation.item.input_audio_transcription.completed',
				transcript: text
			});
		}
	};
});

describe('OpenAiSttAdapter protocol specifics', () => {
	async function started() {
		const harness = makeHarness();
		const received: TranscriptSegment[] = [];
		harness.adapter.onSegment((s) => received.push(s));
		await harness.adapter.start();
		return { ...harness, received };
	}

	it('configures a transcription session on open', async () => {
		const { ws } = await started();
		const config = JSON.parse(ws.sent[0] as string) as {
			type: string;
			session: { input_audio_transcription: { model: string } };
		};
		expect(config.type).toBe('transcription_session.update');
		expect(config.session.input_audio_transcription.model).toBe('gpt-4o-mini-transcribe');
	});

	it('accumulates deltas as interim segments, completed as final', async () => {
		const { ws, received } = await started();
		ws.message({ type: 'conversation.item.input_audio_transcription.delta', delta: 'Can you ' });
		ws.message({ type: 'conversation.item.input_audio_transcription.delta', delta: 'explain ACID' });
		ws.message({
			type: 'conversation.item.input_audio_transcription.completed',
			transcript: 'Can you explain ACID?'
		});
		expect(received.map((s) => [s.text, s.final])).toEqual([
			['Can you ', false],
			['Can you explain ACID', false],
			['Can you explain ACID?', true]
		]);
		const final = received.at(-1)!;
		expect(final.startMs).toBe(received[0]!.startMs);
		expect(final.endMs).toBeGreaterThan(final.startMs);
	});

	it('resets utterance state after completion', async () => {
		const { ws, received } = await started();
		ws.message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'one' });
		ws.message({ type: 'conversation.item.input_audio_transcription.delta', delta: 'two' });
		expect(received[1]!.text).toBe('two');
		expect(received[1]!.startMs).toBeGreaterThan(received[0]!.endMs);
	});

	it('base64-encodes audio into input_audio_buffer.append events', async () => {
		const { ws, adapter } = await started();
		adapter.sendAudio(new Uint8Array([1, 2, 3, 255]));
		const event = JSON.parse(ws.sent.at(-1) as string) as { type: string; audio: string };
		expect(event.type).toBe('input_audio_buffer.append');
		expect(event.audio).toBe(btoa(String.fromCharCode(1, 2, 3, 255)));
	});

	it('ignores unrelated event types', async () => {
		const { ws, received } = await started();
		ws.message({ type: 'session.updated' });
		ws.message({ type: 'input_audio_buffer.speech_started' });
		expect(received).toHaveLength(0);
	});
});
