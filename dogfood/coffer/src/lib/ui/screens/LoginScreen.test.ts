// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoginScreen from './LoginScreen.svelte';

describe('LoginScreen', () => {
	it('renders every visible string through the i18n catalog, in English', () => {
		render(LoginScreen, { locale: 'en' });

		expect(screen.getByText('Speak the Passphrase')).toBeInTheDocument();
		expect(screen.getByText('Only the Steward of this Treasury may enter')).toBeInTheDocument();
		expect(screen.getByLabelText('Passphrase')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cross the Threshold' })).toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('renders the Polish catalog for locale=pl', () => {
		render(LoginScreen, { locale: 'pl' });

		expect(screen.getByText('Wypowiedz Hasło')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Przekrocz Próg' })).toBeInTheDocument();
	});

	it('shows the login error message when the previous attempt failed', () => {
		render(LoginScreen, { locale: 'en', error: true });
		expect(screen.getByRole('alert')).toHaveTextContent('The wards reject that phrase — try again');
	});
});
