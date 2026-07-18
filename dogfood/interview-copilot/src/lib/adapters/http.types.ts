/** Narrow fetch abstraction so network adapters take a mocked transport in tests. */
export interface FetchResponseLike {
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
	text(): Promise<string>;
}

export type FetchLike = (
	url: string,
	init: {
		method: string;
		headers: Record<string, string>;
		body: string;
	}
) => Promise<FetchResponseLike>;

export const globalFetch: FetchLike = (url, init) => fetch(url, init);
