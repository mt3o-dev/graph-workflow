<script lang="ts">
	/**
	 * Client-side theme toggle. Flips `data-theme` on <html> (the override
	 * that wins over prefers-color-scheme in both directions, tokens.css)
	 * and persists the choice in the `coffer_theme` cookie so SSR can read
	 * it on the next request (root-layout wiring is P6's job — this
	 * component only needs to exist and work standalone for P1).
	 */
	type Theme = 'light' | 'dark';

	interface Props {
		/** i18n'd accessible label, e.g. "Toggle theme" / "Przełącz motyw". */
		label: string;
		/** Initial theme, defaults to whatever is already stamped on <html>. */
		initial?: Theme;
	}

	let { label, initial }: Props = $props();

	function readInitialTheme(): Theme {
		if (initial) return initial;
		if (typeof document !== 'undefined') {
			const stamped = document.documentElement.getAttribute('data-theme');
			if (stamped === 'light' || stamped === 'dark') return stamped;
		}
		if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
		return 'light';
	}

	let theme = $state<Theme>(readInitialTheme());

	function applyTheme(next: Theme) {
		theme = next;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', next);
			document.cookie = `coffer_theme=${next}; path=/; max-age=31536000; samesite=lax`;
		}
	}

	function toggle() {
		applyTheme(theme === 'light' ? 'dark' : 'light');
	}
</script>

<button
	type="button"
	class="cf-theme-toggle cf-focus-ring"
	role="switch"
	aria-checked={theme === 'dark'}
	aria-label={label}
	onclick={toggle}
>
	<span class="cf-theme-toggle__icon" aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span>
</button>

<style>
	.cf-theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--cf-radius-full);
		border: 1px solid var(--cf-color-border);
		background: var(--cf-color-surface);
		color: var(--cf-color-text);
		cursor: pointer;
		transition: background-color var(--cf-motion-fast) var(--cf-motion-ease);
	}

	.cf-theme-toggle:hover {
		background: var(--cf-color-surface-raised);
	}

	.cf-theme-toggle__icon {
		font-size: var(--cf-font-size-md);
	}
</style>
