import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { RetrievedDoc } from '../../ports/types.ts';
import AnswerCard from './AnswerCard.svelte';

function doc(id: string, score: number): RetrievedDoc {
	return {
		score,
		doc: {
			id,
			question: `Question ${id}`,
			category: 'theory',
			difficulty: 'medium',
			expertise: 'mid',
			tags: [],
			answer: 'Some prepared answer.'
		}
	};
}

describe('AnswerCard', () => {
	it('shows an empty state when there is no answer yet', () => {
		render(AnswerCard, { props: {} });
		expect(screen.getByText('No question detected yet.')).toBeInTheDocument();
	});

	it('shows a loading indicator while drafting', () => {
		render(AnswerCard, { props: { loading: true, questionText: 'Explain ACID.' } });
		expect(screen.getByText('Drafting an answer…')).toBeInTheDocument();
		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	it('renders the answer text with source-cite chips and a confidence badge', () => {
		render(AnswerCard, {
			props: {
				questionText: 'Explain ACID.',
				answerText: 'Atomicity, consistency, isolation, durability.',
				sources: [doc('th-acid', 0.82), doc('th-cap', 0.5)]
			}
		});
		expect(screen.getByText('Atomicity, consistency, isolation, durability.')).toBeInTheDocument();
		expect(screen.getByText('th-acid')).toBeInTheDocument();
		expect(screen.getByText('th-cap')).toBeInTheDocument();
		expect(screen.getByText('confidence 82%')).toBeInTheDocument();
	});
});
