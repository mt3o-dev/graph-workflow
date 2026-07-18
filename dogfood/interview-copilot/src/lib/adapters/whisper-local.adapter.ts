import type { TranscriptionPort } from '../ports/transcription.port.ts';
import type { TranscriptSegment, Unsubscribe } from '../ports/types.ts';
import {
	globalWebSocketFactory,
	type WebSocketFactory,
	type WebSocketLike
} from './websocket.types.ts';

export interface WhisperLocalOptions {
	/** WebSocket URL of a WhisperLive-protocol server, e.g. ws://localhost:9090. */
	url: string;
	language?: string;
	model?: string;
	uid?: string;
	wsFactory?: WebSocketFactory;
}

interface WhisperLiveSegment {
	start: string | number;
	end: string | number;
	text: string;
	completed?: boolean;
}

interface WhisperLiveMessage {
	uid?: string;
	message?: string;
	segments?: WhisperLiveSegment[];
}

const toMs = (seconds: string | number): number => Math.round(Number(seconds) * 1000);

/**
 * STT adapter speaking the WhisperLive streaming protocol [dec:5]: any
 * server implementing it (faster-whisper in Docker, etc.) works. The client
 * sends a JSON config on open, then raw audio chunks; the server repeatedly
 * sends the current segment list, marking finished segments `completed`.
 */
export class WhisperLocalAdapter implements TranscriptionPort {
	private ws: WebSocketLike | null = null;
	private readonly listeners = new Set<(segment: TranscriptSegment) => void>();
	private readonly emittedFinal = new Set<string>();
	private readonly uid: string;

	constructor(private readonly options: WhisperLocalOptions) {
		this.uid = options.uid ?? `ic-${Math.random().toString(36).slice(2)}`;
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			const factory = this.options.wsFactory ?? globalWebSocketFactory;
			const ws = factory(this.options.url);
			this.ws = ws;
			ws.addEventListener('open', () => {
				ws.send(
					JSON.stringify({
						uid: this.uid,
						language: this.options.language ?? 'en',
						task: 'transcribe',
						model: this.options.model ?? 'small',
						use_vad: true
					})
				);
			});
			ws.addEventListener('message', (event) => {
				const message = this.parse(event.data);
				if (!message) return;
				if (message.message === 'SERVER_READY') {
					resolve();
					return;
				}
				this.handleSegments(message);
			});
			ws.addEventListener('error', () => {
				reject(new Error(`WhisperLive connection failed: ${this.options.url}`));
			});
		});
	}

	async stop(): Promise<void> {
		this.ws?.send('END_OF_AUDIO');
		this.ws?.close();
		this.ws = null;
	}

	sendAudio(chunk: Uint8Array): void {
		if (!this.ws) throw new Error('WhisperLocalAdapter not started');
		this.ws.send(chunk);
	}

	onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private parse(data: unknown): WhisperLiveMessage | null {
		if (typeof data !== 'string') return null;
		try {
			return JSON.parse(data) as WhisperLiveMessage;
		} catch {
			return null;
		}
	}

	private handleSegments(message: WhisperLiveMessage): void {
		if (message.uid !== undefined && message.uid !== this.uid) return;
		for (const raw of message.segments ?? []) {
			const segment: TranscriptSegment = {
				text: raw.text,
				startMs: toMs(raw.start),
				endMs: toMs(raw.end),
				final: raw.completed === true
			};
			if (segment.final) {
				// WhisperLive resends the full list each time; emit each final once.
				const key = `${segment.startMs}:${segment.endMs}:${segment.text}`;
				if (this.emittedFinal.has(key)) continue;
				this.emittedFinal.add(key);
			}
			this.emit(segment);
		}
	}

	private emit(segment: TranscriptSegment): void {
		for (const listener of this.listeners) listener(segment);
	}
}
