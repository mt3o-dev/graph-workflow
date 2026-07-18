import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import TranscriptBubble from './TranscriptBubble.svelte';

describe('TranscriptBubble', () => {
	it('labels interviewer speech and formats the timestamp', () => {
		render(TranscriptBubble, {
			props: { speaker: 'interviewer', text: 'Tell me about ACID.', timestampMs: 65_000 }
		});
		expect(screen.getByText('Interviewer')).toBeInTheDocument();
		expect(screen.getByText('Tell me about ACID.')).toBeInTheDocument();
		expect(screen.getByText('1:05')).toBeInTheDocument();
	});

	it('labels interviewee speech as "You"', () => {
		render(TranscriptBubble, { props: { speaker: 'interviewee', text: 'Sure, so ACID means...' } });
		expect(screen.getByText('You')).toBeInTheDocument();
	});

	it('applies the highlighted class for a detected question', () => {
		const { container } = render(TranscriptBubble, {
			props: { speaker: 'interviewer', text: 'What is CAP theorem?', highlighted: true }
		});
		expect(container.querySelector('.bubble.highlighted')).not.toBeNull();
	});
});
