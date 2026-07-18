import { describe, expect, it } from 'vitest';
import { HeuristicQuestionClassifier } from './question-classifier.ts';

describe('HeuristicQuestionClassifier', () => {
	const classifier = new HeuristicQuestionClassifier();

	it.each([
		'Can you explain the ACID properties of a database transaction?',
		'What is a closure',
		'How would you scale this service',
		'Tell me about a conflict with a colleague.',
		'Walk me through what happens during DNS resolution.',
		'Explain the CAP theorem.',
		'Describe your testing strategy.',
		'Is this API idempotent',
		'Compare TCP and UDP.'
	])('classifies %j as a question', (text) => {
		expect(classifier.isQuestion(text)).toBe(true);
	});

	it.each([
		'We ship a payments platform in TypeScript.',
		'The backend talks to Postgres and Kafka.',
		'Thanks, that makes sense.',
		'I worked on the billing system for two years.',
		''
	])('classifies %j as a statement', (text) => {
		expect(classifier.isQuestion(text)).toBe(false);
	});
});
