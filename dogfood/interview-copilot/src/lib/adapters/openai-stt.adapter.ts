import type { TranscriptionPort } from '../ports/transcription.port.ts';
import type { TranscriptSegment, Unsubscribe } from '../ports/types.ts';
import {
	globalWebSocketFactory,
	type WebSocketFactory,
	type WebSocketLike
} from './websocket.types.ts';

export interface OpenAiSttOptions {
	apiKey: string;
	/** Realtime transcription endpoint. */
	url?: string;
	model?: string;
	wsFactory?: WebSocketFactory;
	/** Monotonic ms clock, injected for tests. Default: performance.now-style wall clock. */
	clock?: () => number;
}

interface RealtimeEvent {
	type?: string;
	delta?: string;
	transcript?: string;
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/**
 * STT adapter for the OpenAI Realtime transcription API [dec:5]
 * (`gpt-4o-mini-transcribe` over WebSocket). Deltas become interim segments,
 * `input_audio_transcription.completed` becomes the final segment. The API
 * carries no word timestamps, so segment times come from the injected clock,
 * measured from `start()`.
 */
export class OpenAiSttAdapter implements TranscriptionPort {
	private ws: WebSocketLike | null = null;
	private readonly listeners = new Set<(segment: TranscriptSegment) => void>();
	private readonly clock: () => number;
	private startedAt = 0;
	private utteranceStartMs: number | null = null;
	private accumulated = '';

	constructor(private readonly options: OpenAiSttOptions) {
		this.clock = options.clock ?? (() => Date.now());
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const factory = this.options.wsFactory ?? globalWebSocketFactory;
			const url =
				this.options.url ?? 'wss://api.openai.com/v1/realtime?intent=transcription';
			const ws = factory(url, [
				'realtime',
				`openai-insecure-api-key.${this.options.apiKey}`,
				'openai-beta.realtime-v1'
			]);
			this.ws = ws;
			ws.addEventListener('open', () => {
				this.startedAt = this.clock();
				ws.send(
					JSON.stringify({
						type: 'transcription_session.update',
						session: {
							input_audio_format: 'pcm16',
							input_audio_transcription: {
								model: this.options.model ?? 'gpt-4o-mini-transcribe'
							},
							turn_detection: { type: 'server_vad' }
						}
					})
				);
				resolve();
			});
			ws.addEventListener('message', (event) => this.handleMessage(event.data));
			ws.addEventListener('error', () => {
				reject(new Error('OpenAI realtime transcription connection failed'));
			});
		});
	}

	async stop(): Promise<void> {
		this.ws?.close();
		this.ws = null;
	}

	sendAudio(chunk: Uint8Array): void {
		if (!this.ws) throw new Error('OpenAiSttAdapter not started');
		this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(chunk) }));
	}

	onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private now(): number {
		return this.clock() - this.startedAt;
	}

	private handleMessage(data: unknown): void {
		if (typeof data !== 'string') return;
		let event: RealtimeEvent;
		try {
			event = JSON.parse(data) as RealtimeEvent;
		} catch {
			return;
		}
		switch (event.type) {
			case 'conversation.item.input_audio_transcription.delta': {
				this.utteranceStartMs ??= this.now();
				this.accumulated += event.delta ?? '';
				this.emit({
					text: this.accumulated,
					startMs: this.utteranceStartMs,
					endMs: this.now(),
					final: false
				});
				break;
			}
			case 'conversation.item.input_audio_transcription.completed': {
				const startMs = this.utteranceStartMs ?? this.now();
				this.emit({
					text: event.transcript ?? this.accumulated,
					startMs,
					endMs: this.now(),
					final: true
				});
				this.utteranceStartMs = null;
				this.accumulated = '';
				break;
			}
			default:
				break;
		}
	}

	private emit(segment: TranscriptSegment): void {
		for (const listener of this.listeners) listener(segment);
	}
}
