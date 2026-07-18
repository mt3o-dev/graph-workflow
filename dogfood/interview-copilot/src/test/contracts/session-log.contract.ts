import { describe, expect, it } from 'vitest';
import type { SessionLogPort } from '../../lib/ports/session-log.port.ts';
import type { Utterance } from '../../lib/ports/types.ts';

const utt = (id: string, text: string): Utterance => ({ id, text, startMs: 0, endMs: 1000 });

/** Shared SessionLogPort contract. */
export function describeSessionLogContract(
	name: string,
	/** Must return a FRESH, empty log every call. */
	factory: () => Promise<SessionLogPort> | SessionLogPort
) {
	describe(`SessionLogPort contract: ${name}`, () => {
		it('startSession returns distinct ids listed by listSessions', async () => {
			const log = await factory();
			const a = await log.startSession(100);
			const b = await log.startSession(200);
			expect(a).not.toBe(b);
			const sessions = await log.listSessions();
			expect(sessions.map((s) => s.id)).toEqual([a, b]);
			expect(sessions.map((s) => s.startedAtMs)).toEqual([100, 200]);
		});

		it('records utterances, retrievals and answers in order', async () => {
			const log = await factory();
			const id = await log.startSession(0);
			await log.logUtterance(id, utt('u1', 'We use Kafka.'), 'statement');
			await log.logUtterance(id, utt('u2', 'What is a closure?'), 'question');
			await log.logRetrieval(id, 'u2', [
				{ id: 'fe-closures', score: 0.9 },
				{ id: 'th-acid', score: 0.4 }
			]);
			await log.logAnswer(id, 'u2', { text: 'A closure is...', sourceIds: ['fe-closures'] });

			const record = await log.getSession(id);
			expect(record).not.toBeNull();
			expect(record!.startedAtMs).toBe(0);
			expect(record!.utterances.map((u) => u.utterance.id)).toEqual(['u1', 'u2']);
			expect(record!.utterances.map((u) => u.kind)).toEqual(['statement', 'question']);
			expect(record!.retrievals).toEqual([
				{
					utteranceId: 'u2',
					results: [
						{ id: 'fe-closures', score: 0.9 },
						{ id: 'th-acid', score: 0.4 }
					]
				}
			]);
			expect(record!.answers).toEqual([
				{ utteranceId: 'u2', draft: { text: 'A closure is...', sourceIds: ['fe-closures'] } }
			]);
		});

		it('keeps sessions isolated and returns null for unknown ids', async () => {
			const log = await factory();
			const a = await log.startSession(0);
			const b = await log.startSession(0);
			await log.logUtterance(a, utt('u1', 'hello'), 'statement');
			expect((await log.getSession(b))!.utterances).toHaveLength(0);
			expect(await log.getSession('nope')).toBeNull();
		});
	});
}
