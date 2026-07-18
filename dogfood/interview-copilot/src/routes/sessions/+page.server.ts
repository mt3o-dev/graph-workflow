import { getServerContainer } from '$lib/server/container.server';
import type { PageServerLoad } from './$types';

/**
 * Session list + (when `?id=` is present) one session's full timeline, from
 * SqliteSessionLogAdapter — local DB reads only, no network. The Live
 * Session screen always runs in demo mode (in-memory fakes), so real
 * sessions only appear here once the app is wired to a real transcription
 * adapter (Phase 6+); until then this legitimately shows an empty state.
 */
export const load: PageServerLoad = async ({ url }) => {
	const container = await getServerContainer();
	const sessions = await container.sessionLog.listSessions();
	const selectedId = url.searchParams.get('id');
	const session = selectedId ? await container.sessionLog.getSession(selectedId) : null;
	return { sessions, session, selectedId };
};
