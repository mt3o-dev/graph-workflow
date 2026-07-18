/**
 * Question vs statement classification [dec:8].
 * The interface is port-shaped so an LLM classifier can replace the
 * heuristic one later without touching the orchestrator.
 */
export interface QuestionClassifierPort {
	isQuestion(text: string): boolean;
}

const INTERROGATIVE_STARTERS = new Set([
	'what',
	'why',
	'how',
	'when',
	'where',
	'who',
	'whom',
	'which',
	'whose',
	'can',
	'could',
	'would',
	'should',
	'shall',
	'will',
	'do',
	'does',
	'did',
	'is',
	'are',
	'was',
	'were',
	'have',
	'has',
	'had'
]);

const IMPERATIVE_PROMPTS = [
	'tell me',
	'tell us',
	'explain',
	'describe',
	'walk me through',
	'walk us through',
	'compare',
	'define',
	'give me an example',
	'give an example',
	'talk about',
	'talk me through'
];

export class HeuristicQuestionClassifier implements QuestionClassifierPort {
	isQuestion(text: string): boolean {
		const trimmed = text.trim();
		if (trimmed.length === 0) return false;
		if (trimmed.endsWith('?')) return true;
		const lower = trimmed.toLowerCase();
		if (IMPERATIVE_PROMPTS.some((p) => lower.startsWith(p))) return true;
		const firstWord = lower.split(/[^a-z']+/, 1)[0] ?? '';
		return INTERROGATIVE_STARTERS.has(firstWord);
	}
}
