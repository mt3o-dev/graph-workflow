# Interview Copilot design system

`src/lib/ui/design-system/` is the only source of visual primitives for the
app. Screens (`src/routes/**`) compose these tokens and components; they must
not introduce ad-hoc styling beyond page layout (flex/grid wrappers, spacing
between panels).

## Tokens (`tokens.css`)

Loaded once, globally, from the root layout. All values are CSS custom
properties on `:root`.

- **Color scale** — `--color-neutral-{0..950}`, `--color-brand-{50..900}`,
  plus semantic scales `success` / `warning` / `danger` / `info`
  (`-500` = base, `-600` = hover/emphasis, `-100` = subtle background).
- **Semantic aliases** — `--color-bg`, `--color-bg-raised`, `--color-bg-sunken`,
  `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-border`,
  `--color-border-strong`. Components reference **only** aliases, never the
  raw numbered scale, so retheming means editing the alias block once.
- **Domain palettes** — `--color-cat-*` (KB category), `--color-diff-*` (KB
  difficulty), `--color-exp-*` (KB expertise), `--color-speaker-*`
  (interviewer/interviewee). Each has a paired `-bg` subtle background. Used
  exclusively by `MetaTag` and `TranscriptBubble` so every chip/bubble kind
  has a visually distinct, WCAG-AA hue in both themes.
- **Spacing** — `--space-{0,1,2,3,4,5,6,8,10,12,16}` on a 4px base.
- **Type scale** — `--text-{xs,sm,base,md,lg,xl,2xl}`, `--leading-*`,
  `--weight-*`, `--font-sans`, `--font-mono`.
- **Radii** — `--radius-{sm,md,lg,full}`.
- **Shadows** — `--shadow-{sm,md,lg}` (tuned separately per theme — higher
  opacity in dark mode so elevation stays visible on dark surfaces).
- **Motion** — `--duration-{fast,base,slow}`, `--ease-standard`. All
  transitions/animations are disabled under `prefers-reduced-motion: reduce`
  (global rule in `tokens.css`).

### Theming

Light values live on `:root`. `@media (prefers-color-scheme: dark)`
overrides them for OS-level dark mode. `:root[data-theme="light"]` and
`:root[data-theme="dark"]` override *both* directions — the app shell's theme
toggle stamps `data-theme` on `<html>` and that selector always wins,
regardless of the OS preference. This is what lets a user pick "light" while
their OS is in dark mode, and vice versa.

## Components

| Component | Purpose | Key props |
|---|---|---|
| `Button` | Actions | `variant` (primary/secondary/ghost/danger), `size`, `loading`, `disabled`, `onclick` |
| `Badge` | Small status label | `tone` (neutral/brand/success/warning/danger/info) |
| `Card` | Generic elevated/bordered container | `padding`, `elevated` |
| `Panel` | Titled section with header actions slot | `title`, `subtitle`, `actions` snippet |
| `Input` | Text field | `label`, `value` (bindable), `type`, `error` |
| `Select` | Native select | `label`, `value` (bindable), `options: SelectOption[]` |
| `Toggle` | Boolean switch | `label`, `checked` (bindable), `onchange` |
| `Tabs` | Tab strip (roving tabindex, arrow-key nav) | `tabs: TabItem[]`, `active` (bindable), `onchange` |
| `EmptyState` | No-data placeholder | `icon`, `title`, `description`, `actions` snippet |
| `Kbd` | Keyboard-shortcut glyph | slot content |
| `Spinner` | Loading indicator (`role="status"`) | `size`, `label` |
| `TranscriptBubble` | One speaker turn in the live transcript | `speaker` (interviewer/interviewee), `text`, `timestampMs`, `highlighted`, `interim` |
| `AnswerCard` | Drafted answer + source cites + confidence | `questionText`, `answerText`, `sources: RetrievedDoc[]`, `loading` |
| `MetaTag` | KB facet chip | `kind` (category/difficulty/expertise), `value` |

Import from the barrel: `import { Button, Card, MetaTag } from '$lib/ui/design-system';`

## Usage rules

1. **No ad-hoc colors, spacing, or radii in route files.** Every visual value
   in a page comes from a token (via a component, or `var(--space-*)` etc. in
   a page's own layout-only CSS).
2. **Speaker attribution is a UI heuristic, not diarization.** `TranscriptBubble`
   takes `speaker` directly; the live-session store derives it from the
   question/statement classification (question → interviewer, statement →
   interviewee) since there is no diarization port (PRD accepted gap).
3. **Confidence is derived, not a port concept.** `AnswerCard`'s confidence
   badge is the top retrieved-doc cosine score; there is no separate
   confidence field on `AnswerDraft`.
4. **Accessibility baseline**: every interactive component has a visible
   `:focus-visible` ring (global rule in `tokens.css`), decorative icons/
   spinners inside a labelled control are `aria-hidden`, and all colored
   text/background pairs meet WCAG AA contrast in both themes (verified by
   eye against the token pairs above — `-500`/`-600` foregrounds are chosen
   against their `-100`/`-subtle` backgrounds and against `--color-bg-raised`).
5. **Svelte 5 runes only** — `$props()`, `$state`, `$derived`, `$bindable()`.
   No Svelte 4 `export let` / stores-as-props idioms in new components.
