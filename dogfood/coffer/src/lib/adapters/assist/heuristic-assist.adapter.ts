/**
 * Default AssistPort implementation ([node:9117c159], [node:b94a5c28]): a
 * pure, local heuristic — no store/db/network access of any kind. Ranks
 * candidate groups from `AssistContext.classified` (the past-classified
 * corpus) by token overlap with the target transaction's description,
 * weighted by how often a group recurs among the overlapping entries.
 *
 * Tokenization reuses the core `normalizeForHash` function ([node:303587fe])
 * so matching is locale/whitespace/diacritic-stable and consistent with the
 * rest of the system's description handling — this file does not roll its
 * own normalization.
 */
import type { Transaction } from '../../core/model/transaction.js';
import { normalizeForHash } from '../../core/normalize/description.js';
import type { AssistContext, AssistPort, Suggestion } from '../../ports/assist.port.js';

interface GroupScore {
	/** Sum of per-entry token-overlap counts across every corpus entry assigning this group. */
	totalOverlap: number;
	/** How many corpus entries (with nonzero overlap) assigned this group. */
	matches: number;
	/** Best single-entry Jaccard overlap ratio seen for this group. */
	bestOverlapRatio: number;
}

/** Tokenize a raw description via the shared hash-normalization function. */
function tokenize(description: string): Set<string> {
	const normalized = normalizeForHash(description);
	return normalized.length === 0 ? new Set() : new Set(normalized.split(' ').filter((token) => token.length > 0));
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
	let count = 0;
	for (const token of a) {
		if (b.has(token)) {
			count += 1;
		}
	}
	return count;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Local heuristic assist adapter: frequency/similarity ranking over the
 * corpus supplied via `AssistContext`. Pure computation only — takes no
 * dependencies, performs no I/O, and never writes anything (the
 * assist-never-commits invariant, [node:efd6891c]/[dec:7]).
 */
export class HeuristicAssistAdapter implements AssistPort {
	async suggest(tx: Transaction, ctx: AssistContext): Promise<Suggestion[]> {
		const targetTokens = tokenize(tx.description);
		if (targetTokens.size === 0 || ctx.classified.length === 0) {
			return [];
		}

		const scores = new Map<string, GroupScore>();

		for (const entry of ctx.classified) {
			const entryTokens = tokenize(entry.tx.description);
			const overlap = intersectionSize(targetTokens, entryTokens);
			if (overlap === 0) {
				continue;
			}
			const unionSize = targetTokens.size + entryTokens.size - overlap;
			const overlapRatio = unionSize === 0 ? 0 : overlap / unionSize;

			for (const groupId of entry.groupIds) {
				const existing = scores.get(groupId) ?? { totalOverlap: 0, matches: 0, bestOverlapRatio: 0 };
				existing.totalOverlap += overlap;
				existing.matches += 1;
				existing.bestOverlapRatio = Math.max(existing.bestOverlapRatio, overlapRatio);
				scores.set(groupId, existing);
			}
		}

		if (scores.size === 0) {
			return [];
		}

		const maxMatches = Math.max(...[...scores.values()].map((score) => score.matches));

		const suggestions: Suggestion[] = [...scores.entries()].map(([groupId, score]) => {
			const frequencyBoost = score.matches / maxMatches;
			const confidence = clamp01(0.7 * score.bestOverlapRatio + 0.3 * frequencyBoost);
			const reason = `${score.matches} similar description${score.matches === 1 ? '' : 's'} previously classified into this group`;
			return { groupId, confidence, reason };
		});

		suggestions.sort((a, b) => b.confidence - a.confidence);
		return suggestions;
	}
}
