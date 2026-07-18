import type { WebSocketLike } from '../../lib/adapters/websocket.types.ts';

type Listener = (event: { data?: unknown }) => void;

/**
 * Scripted WebSocket transport for STT adapter tests. Fires `open`
 * synchronously as soon as an open listener registers (the adapters attach
 * listeners immediately after construction), records outgoing sends, and
 * lets tests dispatch incoming messages.
 */
export class MockWebSocket implements WebSocketLike {
	readonly sent: Array<string | Uint8Array> = [];
	closed = false;
	private readonly listeners = new Map<string, Set<Listener>>();
	/** Optional server script: called on every outgoing send. */
	onSend: ((data: string | Uint8Array, ws: MockWebSocket) => void) | null = null;

	send(data: string | Uint8Array): void {
		this.sent.push(data);
		this.onSend?.(data, this);
	}

	close(): void {
		this.closed = true;
	}

	addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: Listener): void {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type)!.add(listener);
		if (type === 'open') queueMicrotask(() => listener({}));
	}

	dispatch(type: 'message' | 'close' | 'error', event: { data?: unknown } = {}): void {
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}

	/** Convenience: dispatch a JSON message event. */
	message(payload: unknown): void {
		this.dispatch('message', { data: JSON.stringify(payload) });
	}
}
