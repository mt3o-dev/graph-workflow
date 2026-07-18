import type { TranscriptionPort } from '../../lib/ports/transcription.port.ts';
import type { TranscriptSegment, Unsubscribe } from '../../lib/ports/types.ts';

/** In-memory TranscriptionPort; tests drive it by calling `emit`. */
export class FakeTranscription implements TranscriptionPort {
	started = false;
	stopped = false;
	readonly audioChunks: Uint8Array[] = [];
	private readonly listeners = new Set<(segment: TranscriptSegment) => void>();

	async start(): Promise<void> {
		this.started = true;
		this.stopped = false;
	}

	async stop(): Promise<void> {
		this.stopped = true;
	}

	sendAudio(chunk: Uint8Array): void {
		this.audioChunks.push(chunk);
	}

	onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Test hook: emit a segment as if it came from the STT service. */
	emit(segment: TranscriptSegment): void {
		for (const listener of this.listeners) listener(segment);
	}
}
