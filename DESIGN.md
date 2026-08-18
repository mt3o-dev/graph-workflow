---
name: pmview
description: The Control Room — a calm, dependency-free supervisory board for steering an agentic dev workflow.
colors:
  surface-page: "#f6f7f9"
  surface-panel: "#ffffff"
  ink: "#171a1f"
  ink-muted: "#667085"
  line: "#e3e6ea"
  accent: "#2f6fdb"
  warn: "#b54708"
  danger: "#b42318"
  ok: "#067647"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "0.01em"
  section-label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.06em"
  subhead:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  stat:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.2
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  pill: "999px"
spacing:
  3xs: "4px"
  2xs: "6px"
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  2xl: "20px"
  3xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  input-search:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  stat-tile:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  tab-active:
    backgroundColor: "{colors.surface-page}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
---

# Design System: pmview

## Overview

**Creative North Star: "The Control Room"**

pmview is the surface a human watches while autonomous agents work. Its job is to let a supervisor scan the whole state of a change-and-memory workflow and act on the one thing that needs them — so the interface stays calm, legible, and out of the way. Nothing shouts; hierarchy is carried by weight, tonal panels, and hairline rules rather than color or ornament. The accent blue appears only where something is interactive or selected, so it never competes with the data.

The world is light-and-dark twins that share one set of shape, spacing, and motion tokens and swap only their color primitives. Surfaces are flat at rest — a whisper of ambient shadow in light, fully flat in dark — and depth is a *response to intent*: cards and list items lift a single pixel with a soft shadow the moment the operator hovers a target. That restraint plus one honest motion moment is the whole personality: a serious tool that feels responsive under the hand.

Density is comfortable-compact: a nine-step spacing scale keeps tight groups tight and gives headings and sections room to breathe. Identifiers and measurements are set in mono; everything else is the platform sans, because the fastest thing to read on a control board is the system font the operator already reads all day.

**Key Characteristics:**
- Flat at rest, one-pixel lift on hover — depth means "actionable."
- Accent used sparingly: interactive and selected states only.
- Tonal panels + 1px lines do the structural work, in both themes.
- One motion grammar: `ease-out`, 120–180ms, honored down to `prefers-reduced-motion`.
- System sans for reading, mono strictly for identifiers and data.

## Colors

A near-neutral gray-blue field with a single confident accent and a three-tone status set; both themes are generated from the same nine primitives.

### Primary
- **Signal Blue** (`#2f6fdb`): the only accent. Interactive borders on hover, selected filter/tab state, focus rings, primary-button fill, and the search focus glow. It marks "you can act here," nothing decorative.

### Neutral
- **Page** (`#f6f7f9`): the app field behind all panels; also the recessed fill of active tabs and read-only body blocks.
- **Panel** (`#ffffff`): every raised surface — cards, list items, stat tiles, inputs, the detail drawer.
- **Ink** (`#171a1f`): primary text and the toast background.
- **Ink Muted** (`#667085`): secondary text, metadata, pill labels, section labels, and the caret/scrollbar tint.
- **Line** (`#e3e6ea`): the 1px borders and dividers that carry most of the structure.

### Status
- **Warn** (`#b54708`): alert stat values and warning lines.
- **Danger** (`#b42318`): destructive actions, contradicted/negative events, error toasts.
- **Ok** (`#067647`): confirmed / healthy states.

**The Accent-Is-A-Verb Rule.** Signal Blue only appears on something the operator can interact with or has selected. If a blue element does nothing, it's a bug.

**The Twin-World Rule.** Light and dark differ only in the nine color primitives; shape, spacing, type, and motion tokens are shared. Never fork a component's geometry per theme.

## Typography

**Body / UI Font:** platform system sans (`ui-sans-serif, system-ui, …`)
**Data Font:** platform monospace (`ui-monospace, SFMono-Regular, Menlo, …`)

**Character:** unadorned and legible — the type gets out of the way so status reads instantly. Weight and a compact scale, not decorative faces, create hierarchy.

### Hierarchy
- **Title** (650, 15px, 0.01em): the product title in the top bar.
- **Section Label** (600, 13px, 0.06em, **uppercase**): column and section headers ("BOARD", "FLAGGED"). Set in Ink Muted so it labels without dominating.
- **Subhead** (600, 14px): drawer sub-section headings.
- **Body** (400, 14px/1.5): default reading text.
- **Meta** (400, 12px): metadata, pill text, goals, events, warn lines — always Ink Muted.
- **Stat** (650, 19px): the number on a stat tile; its label rides below in Meta.
- **Mono** (400, 12px): node ids, edge kinds, and other identifiers/measurements only.

**The Mono-Means-Data Rule.** Monospace is for identifiers, data, and measurements — never as a costume for "technical." Prose is always sans.

## Layout

A sticky top bar (tabs + project selector) sits over a single scrollable work area padded at 16px. The Board view is a horizontal row of fixed 300px columns that scroll sideways; Issues and Search are single vertical lists. Detail opens in a right-side drawer, `min(620px, 100vw)`, over a dark scrim — full-width on phones. Spacing follows a nine-step scale (`4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 40`): 4–8px binds tight groups (rows, pills, card internals), 12–16px separates cards and sections, and there's always more space above a heading than below it.

## Elevation & Depth

Flat by default; depth is earned by interaction. In light, panels rest on a barely-there ambient shadow; in dark, they rest fully flat and rely on tonal contrast between Page and Panel plus 1px Lines. On hover, cards and list items raise one pixel and take the stronger `shadow-raised`, so lift reads as "clickable target." The toast is the only always-raised element.

### Shadow Vocabulary
- **Ambient** (`0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.05)`): resting elevation for panels in light mode; `none` in dark.
- **Raised** (`0 6px 18px rgba(16,24,40,.12), 0 2px 6px rgba(16,24,40,.08)`; dark `0 8px 24px rgba(0,0,0,.5)`): hover lift on cards/items and the toast.
- **Scrim** (`rgba(16,24,40,.35)`, token `--scrim`): the translucent veil behind the modal detail drawer. An overlay utility, deliberately outside the brand palette — a scrim is dimming, not color.

**The Flat-Until-Touched Rule.** A surface is flat at rest. Shadow appears as a response to hover, focus, or the toast — never as static decoration.

## Shapes

Three radii and nothing sharp: **10px** (`md`) is the house corner for cards, list items, stat tiles, inputs, and the drawer body; **8px** (`sm`) softens the smaller controls (buttons, the project select); **999px** (`pill`) fully rounds the status/label pills, filter and tab chips, and the toast. Borders are a uniform 1px in Line — no colored `border-left` accents, no zero-blur block shadows. Status pills carry their meaning by tinting *both* their text and their border to the status hue (`currentColor`), keeping the fill transparent.

## Components

### Buttons
- **Shape:** softly rounded (8px `sm`).
- **Primary:** Signal Blue fill, white text, 6px 12px padding.
- **Secondary:** transparent with a 1px Line border and Ink text.
- **Hover / Focus:** primary brightens ~6% and lifts 1px with an ambient shadow; secondary shifts its border and text to accent. `:active` settles back to 0 and dims slightly. Keyboard focus shows the 2px accent focus ring.
- **Disabled:** 50% opacity, no lift, no shadow.

### Chips (pills, filters, tabs)
- **Style:** fully rounded (`pill`), 1px border. Status pills tint text+border to their hue; label pills stay Ink Muted.
- **State:** filters and tabs are muted at rest, go Ink on hover, and show an accent border (filters) or a recessed Page fill (tabs) when active.

### Cards / Containers
- **Corner:** 10px (`md`).
- **Background:** Panel; **Border:** 1px Line.
- **Shadow:** Ambient at rest → Raised on hover (see Elevation).
- **Internal padding:** 12px (`md`).

### Inputs / Fields
- **Style:** Panel (search) or Page (drawer body/textarea) fill, 1px Line, 10px radius.
- **Focus:** border shifts to accent with a 3px accent-tinted glow ring; the default outline is suppressed only where the glow replaces it.

### Navigation
- **Style:** pill tabs in a sticky top bar; project `<select>` pushed to the right. Active tab = recessed Page fill + Line border + Ink text; inactive = Ink Muted, Ink on hover.

### Detail Drawer (signature)
Panel over a dark scrim, `min(620px, 100vw)`, generous 20/20/40px padding, with muted controls top-right (close, dock) that go Ink on hover. Holds body blocks, facet pills, edge rows, and the journal event grid.
- **Docking:** defaults right-anchored (`border-left`); a dock button flips it left (`border-right`), the icon mirroring to show the side. The choice persists in `localStorage`.
- **Resize:** an 8px grab strip on the docked edge shows a 2px accent line on hover and drags the width (clamped 360px–95vw); the width persists. On the opposite edge when docked left.
- **The Persisted-Chrome Rule.** Width and dock side are user state, not layout defaults — remember them across opens, never reset them on navigation.

### Info Popover
A small dialog anchored under its trigger (the header **(i)** button), `min(720px, 100vw − 20px)`, Panel fill, 10px radius, `shadow-raised`. A `popover-head` row carries the title and a muted × close. Body is a two-column `100px / 1fr` key–value grid with hairline row dividers, values in Ink (mono for paths/ids). **Closes only on an explicit action** — its × , the trigger, or Escape — never on outside-click, so it can coexist with overlay tools and be selected.

### Edge Rows & the Edge-Type Legend
A relationship row leads with a **kind badge**: a 12px drawn icon plus the type label, both tinted to one semantic color per edge type — `DEPENDS_ON` accent, `SCOPED_TO` ok, `HAS_FACET` warn, `CONTRADICTS` danger, unknown → a neutral Ink-Muted dot. The node name (path) is set in **Ink** and leads the metadata line; type and short id trail in Ink-Muted mono. **The Name-First Rule.** In any id · type · path line, the human-meaningful name is the darkest, largest-weight token; ids and types recede to muted mono.

### List Toolbar
A `sort` + `filter` control row above a node list: bare Page-fill `<select>`s with muted labels. Re-renders rows in place; the section heading tracks shown/total (e.g. "Captured by this change (4/11)").

### Breadcrumb Trail
When drilling change → node → node, a `crumbs` nav sits at the top of the drawer content. Ancestors are muted button-crumbs (accent + underline on hover) separated by `›`; the current item is Ink and inert. A refresh (save, resolve, tier) never disturbs the trail; closing the drawer clears it.

### Rendered Markdown
Node bodies and change sections render Markdown (`.md`): flow layout, headings pulled back onto the body size (no small-caps), lists, links in accent, `--font-mono` code on a subtle `--ink 8%` tint, and blockquotes as a tonal `--ink 5%` block (no side bar — see the flat-tonal doctrine). Editable bodies are **read-first**: Markdown by default with an Edit ⇄ Preview toggle to the raw textarea. Everything is HTML-escaped before render, and only `http(s)`/`mailto`/relative/anchor links survive.

## Do's and Don'ts

### Do:
- **Do** reach for a spacing, radius, type, or color **token** for every value; the CSS custom properties on `:root` are the source of truth and this frontmatter mirrors them.
- **Do** keep the accent for interactive and selected states only (The Accent-Is-A-Verb Rule).
- **Do** let hover lift signal actionability — 1px translate + `shadow-raised`, on `ease-out` 120–180ms.
- **Do** tint secondary text on any colored surface from that hue or Ink Muted — never a flat gray drop-in.
- **Do** lead every id · type · name line with the name in Ink (The Name-First Rule).
- **Do** persist user-set drawer width and dock side; treat them as state, not defaults.
- **Do** keep light and dark identical except for the nine color primitives.

### Don't:
- **Don't** introduce a build step, framework, CSS-in-JS, or npm dependency — the styling contract is plain CSS + class names shared with `app.js` (a hard project invariant).
- **Don't** add a colored `border-left`/`border-right` above 1px, gradient text, or zero-blur block shadows — depth and emphasis are tonal (blockquotes and code use an `--ink` tint, not a bar).
- **Don't** use monospace as decoration; reserve it for identifiers and data.
- **Don't** render user text as HTML without escaping it first, or allow non-`http(s)`/`mailto` link schemes.
- **Don't** invent a new hue for a category — map edge types and status onto the existing semantic tokens (accent/ok/warn/danger) and differentiate with drawn icons.
- **Don't** rename or drop the component class names — they are the API between `style.css` and `app.js`.
- **Don't** ship a hover/focus state without a resting counterpart, or motion without honoring `prefers-reduced-motion`.

### Do:
- **Do** reach for a spacing, radius, type, or color **token** for every value; the CSS custom properties on `:root` are the source of truth and this frontmatter mirrors them.
- **Do** keep the accent for interactive and selected states only (The Accent-Is-A-Verb Rule).
- **Do** let hover lift signal actionability — 1px translate + `shadow-raised`, on `ease-out` 120–180ms.
- **Do** tint secondary text on any colored surface from that hue or Ink Muted — never a flat gray drop-in.
- **Do** keep light and dark identical except for the nine color primitives.

### Don't:
- **Don't** introduce a build step, framework, CSS-in-JS, or npm dependency — the styling contract is plain CSS + class names shared with `app.js` (a hard project invariant).
- **Don't** add a colored `border-left`/`border-right` above 1px, gradient text, or zero-blur block shadows.
- **Don't** use monospace as decoration; reserve it for identifiers and data.
- **Don't** rename or drop the component class names — they are the API between `style.css` and `app.js`.
- **Don't** ship a hover/focus state without a resting counterpart, or motion without honoring `prefers-reduced-motion`.
