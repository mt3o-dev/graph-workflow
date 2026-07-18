/**
 * Minimal WebSocket abstraction shared by the STT adapters so tests can
 * inject a scripted transport instead of a live socket.
 */
export interface WebSocketLike {
	send(data: string | Uint8Array): void;
	close(): void;
	addEventListener(
		type: 'open' | 'message' | 'close' | 'error',
		listener: (event: { data?: unknown }) => void
	): void;
}

export type WebSocketFactory = (url: string, protocols?: string[]) => WebSocketLike;

/** Default factory: the platform WebSocket (global in Node >= 22 and browsers). */
export const globalWebSocketFactory: WebSocketFactory = (url, protocols) =>
	new WebSocket(url, protocols) as unknown as WebSocketLike;
