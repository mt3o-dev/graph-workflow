# Coffer design system — BG/Forgotten-Realms register

`src/lib/ui/design-system/` — P1 of `coffer-ui-i18n` (slice 4). Implements
dec:12 / [node:57af6589]: parchment (light) and candlelit (dark) chrome,
serif display + readable sans, ornamental framing that never touches data
legibility. **String-free by construction** — no component in this folder
contains a hardcoded user-facing string; every label/caption/title is a
prop the caller fills in from the P2 i18n catalog ([node:4a03791d],
[node:aeb2d1f6]).

## Theme resolution

`tokens.css` defines the full token set on `:root`, a `@media
(prefers-color-scheme: dark)` block for the OS-driven default, and
`:root[data-theme='light' | 'dark']` overrides that win in **both**
directions over the media query (last-selector-wins is not enough on its
own — the explicit attribute selectors are written after the media query
and repeat every token so an override always applies regardless of OS
preference). SSR is expected (P6) to stamp `data-theme` on `<html>` from a
`coffer_theme` cookie to avoid FOUC; `ThemeToggle` (this phase) manages that
cookie client-side and can run standalone before P6 wires the server side.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Chrome color | `--cf-color-bg`, `-surface`, `-surface-raised`, `-border`, `-border-subtle`, `-text`, `-text-muted`, `-text-on-accent`, `-accent(-hover/-active)`, `-success`, `-danger`, `-warning`, `-info`, `-focus-ring` | Themed (light/dark differ) |
| Data color | `--cf-color-data-bg`, `-data-text`, `-data-grid`, `-data-positive`, `-data-negative`, `-data-unclassified(-pattern)` | Themed but independently tuned to stay sober/high-contrast in both palettes — never receives ornamental treatment (dec:12) |
| Chart palette | `--cf-color-chart-1..6` | Distinct hues per theme; excludes the unclassified color so the synthetic `__unclassified__` series always reads as "other" ([node:0b08fbef], [node:167451f0]) |
| Type | `--cf-font-display/-body` (serif, Cormorant), `--cf-font-ui/-data` (sans, Source Sans 3), size scale `-xs..-display`, line-height, weight, `--cf-font-variant-numeric: tabular-nums` | Serif is chrome-only; all data/number rendering uses the sans + tabular-nums pair |
| Spacing | `--cf-space-1..8` | 4px base scale |
| Radii | `--cf-radius-sm/md/lg/full` | |
| Shadows | `--cf-shadow-sm/md/lg`, `--cf-shadow-ornament` | Warm parchment shadow in light, deeper + faint candle-glow accent halo in dark |
| Motion | `--cf-motion-fast/normal/slow`, `--cf-motion-ease` | Zeroed under `prefers-reduced-motion: reduce` |

### Contrast verification (WCAG AA)

Computed via the standard relative-luminance formula (sRGB → linearized →
`0.2126R + 0.7152G + 0.0722B`; ratio `(L1+0.05)/(L2+0.05)`). Body text needs
≥4.5:1, non-text UI components (e.g. a border used as the sole affordance)
need ≥3:1.

| Pair | Light | Dark |
|---|---|---|
| bg / text | 14.02:1 | 14.66:1 |
| bg / text-muted | 7.57:1 | 9.35:1 |
| surface / text | 13.05:1 | 13.76:1 |
| bg / accent (link/action text) | 9.69:1 | 8.43:1 |
| accent-bg / text-on-accent | 9.75:1 | 8.35:1 |
| bg / border (non-text, ≥3:1) | 3.79:1 | 3.86:1 |
| bg / success text | 6.79:1 | 7.95:1 |
| bg / danger text | 7.77:1 | 5.52:1 |
| bg / warning text | 6.29:1 | 8.52:1 |
| data-bg / data-text | 17.10:1 | 16.39:1 |
| data-bg / data-negative | 8.54:1 | 7.05:1 |
| data-bg / data-positive | 7.46:1 | 10.21:1 |
| data-bg / unclassified | 5.67:1 | 6.07:1 |

All pairs clear their required threshold in both themes. The dark-theme
border color was tuned specifically to clear the 3:1 non-text floor
(`#84714f`, 3.86:1) — an earlier candidate (`#6b5a3f`) only reached 2.74:1
and was rejected.

## Components

All components are Svelte 5 (runes: `$props`, `$state`, `$bindable`,
snippets). None import `$lib/i18n` or call `Intl.*` — formatting/strings
are P2's job; these primitives only take pre-formatted values/labels.

| Component | Purpose | Key props |
|---|---|---|
| `Button.svelte` | Action trigger | `variant` (primary/secondary/danger/ghost), `size`, `loading`, `disabled`, `children` snippet |
| `Input.svelte` | Text field | `id`, `value` (bindable), `type`, `size`, `invalid` |
| `Select.svelte` | Choice field | `id`, `value` (bindable), `options: {value,label}[]`, `size` |
| `Card.svelte` | Panel container | `frame: 'plain' \| 'ornamental'` (decorative corner flourishes, `aria-hidden`), `padded`, `children` |
| `Badge.svelte` | Inline status chip | `tone` (neutral/success/danger/warning/info), `children` |
| `Tabs.svelte` | Tabbed navigation | `tabs: {id,label,content: Snippet}[]`, `selected` (bindable); full roving-tabindex keyboard nav (arrow keys), `role="tablist/tab/tabpanel"` |
| `Table.svelte` | Data grid | `columns: {key,header,numeric?}[]`, `rows: Record<string,string>[]` (values already display-formatted), `caption?`; numeric columns get `tabular-nums` + right alignment |
| `EmptyState.svelte` | Zero-data placeholder | `title`, `description?`, `icon?`/`action?` snippets |
| `Spinner.svelte` | Loading indicator | `size`, `label` (accessible name, `role="status"`) |
| `Dialog.svelte` | Modal | `open`, `title`, `onclose`, `children`; deliberately NOT `<dialog>.showModal()` — jsdom (this project's component-test substrate) doesn't implement it, so it's a manually-managed `role="dialog"` overlay (backdrop click + Escape close) |
| `ThemeToggle.svelte` | Light/dark switch | `label` (accessible name), `initial?`; flips `data-theme` on `<html>` + writes the `coffer_theme` cookie (`role="switch"`, `aria-checked`) |
| `ModeLabel.svelte` | Always-visible attribution-mode chip | `mode: 'overlap' \| 'partition'`, `label`; `data-testid="mode-label"` + `data-mode` for chart tests ([node:167451f0]) |
| `AmountText.svelte` | Money/number display | `value` (preformatted string, **no Intl call inside**), `sign` (positive/negative/neutral for color only); tabular-nums, sober data-color tokens regardless of theme |

`types.ts` holds shared prop unions (`Variant`, `Size`, `AttributionMode`,
`AmountSign`) — no strings, no business logic.

## Component tests

`@testing-library/svelte` + jsdom, one spec per component with tests
(`Button.test.ts`, `Table.test.ts`, `ModeLabel.test.ts`,
`ThemeToggle.test.ts`). Each spec file opens with the `// @vitest-environment
jsdom` pragma (no `vite.config.ts` change needed — this keeps server-side
tests elsewhere in the tree on the default `node` environment) and imports
`@testing-library/jest-dom/vitest` directly for the extended matchers
(`toBeInTheDocument`, `toHaveClass`, …), so no global setup file is
required either.

## Non-goals of this phase

No i18n catalog, no `Intl` calls, no route/page markup, no chart
components (P4), no auth screens (P5). Components here accept slots/props
for all copy; nothing renders English (or Polish) text of its own.
