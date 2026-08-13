---
name: gw-wireframe
description: Drive UI creation from wireframes semi-interactively with the user — screen inventory, low-fidelity wireframes reviewed one screen at a time, then a build plan. Detects and obeys an existing design system (tokens, components, a11y rules) and refuses to invent one silently; grounds every screen in the domain model and recalled UX constraints. Use before building or redesigning any UI surface. Trigger phrases "wireframe this", "design the screens", "what should the UI look like", "sketch the UI", "/gw-wireframe".
---

# gw-wireframe

UI work fails in this workflow the same way it fails everywhere: an agent generates
plausible screens in one shot, the user reacts to the finished thing, and the rework costs
more than the design would have. This skill trades that for a **semi-interactive loop** —
you propose one screen's structure at a time, in text, and the user redirects before any
component is written.

Two commitments make it fit the graph-workflow rather than being a generic design prompt:

- **The design system is law when one exists.** Wireframes name existing components and
  tokens, never new ones. A screen that needs a component the system lacks is a
  *design-system decision*, surfaced as such — not a quietly-added one-off.
- **Screens are made of domain entities.** Every screen states which entities it shows and
  which it lets the user act on, using the ratified names from `domain_model()`. A UI that
  invents its own vocabulary is how a product ends up with three words for one thing.

Fidelity stops at **structure and behavior** — regions, hierarchy, states, flows. No
pixels, no colour choices, no copywriting beyond placeholder intent. Those belong to the
design system (if it exists) or to a human designer (if it does not).

## Preconditions

- A change is open with `memory_goal` in `change.md` (`/gw-new` if not). Wireframing is
  design work: its decisions are exactly the kind that must be captured.
- Run **before** `/gw-plan`, not after. The wireframe is an input to the plan; a plan
  written first will have already guessed the screens.

---

## Step 1 — Ground yourself (no output to the user yet)

```
recall_context(query="<the UI surface> screens layout states", goal_ref=<goal_node_id>)
domain_model(status="confirmed")
```

From the recall, pull out and keep: accessibility requirements, responsive/breakpoint
rules, i18n constraints (string externalization, RTL, text expansion), prior UI decisions,
and any `disputed` UX node — a contested UX decision must be surfaced with both sides, not
silently taken.

`domain_model()` gives you the nouns. If it comes back empty on a project that clearly has
a domain, say so and offer `/gw-domain` — wireframing against unnamed entities is how the
UI vocabulary and the code vocabulary drift apart on day one.

## Step 2 — Detect the design system

Look, in this order, and report what you found:

1. A design-system directory (`**/design-system/`, `**/ui/primitives/`, `**/components/ui/`)
   and any `design-system.md` beside it.
2. A token file (`tokens.css`, `theme.ts`, `tailwind.config.*`, a Figma token export).
3. A component library dependency (shadcn/ui, MUI, Chakra, Bootstrap, Radix) in the
   manifest.
4. Graph knowledge: recalled `decision`/`constraint` nodes about UI conventions.

Then declare the mode, explicitly, before wireframing anything:

| Found | Mode | What it means for every wireframe |
|---|---|---|
| A project design system | **System-bound** | Name only its existing components and tokens. Read its doc first — it usually states its own rules (theming, a11y floors, what components may not do). |
| A third-party library, no project layer | **Library-bound** | Name only that library's components. Flag anywhere the project will need a wrapper. |
| Nothing | **Unstyled** | Wireframe in plain semantic structure (regions, roles, headings). Do **not** invent a design system as a side effect — offer it as separate work. |

**The gap rule (system-bound and library-bound).** When a screen needs something the
system does not have, stop and say so:

> Screen *Import review* needs a multi-select data table with row actions. The design
> system has `Table` (display-only) and `Button`. Options: (a) extend `Table` with a
> selection API — a design-system change with its own blast radius; (b) compose
> `Table` + `Checkbox` per row in this screen only, accepting the inconsistency;
> (c) change the interaction so bulk actions are not needed. Which?

Never silently pick (b). Silent one-offs are how a design system dies.

## Step 3 — Screen inventory (first user checkpoint)

Before any wireframe, propose the **list** of screens/states and get it agreed. This is the
cheapest correction point in the whole skill.

```
| Screen           | Purpose (one line)                    | Entities shown      | Entry point        |
|------------------|---------------------------------------|---------------------|--------------------|
| Import           | Upload a statement, see what parsed   | Statement, Transaction | nav, empty dashboard |
| Review           | Classify unclassified transactions    | Transaction, Group  | dashboard alert    |
| Dashboard        | Cashflow and category breakdown       | Transaction, Group  | home               |
```

Include the states that get forgotten and cause the most rework: **empty, loading, error,
partial/degraded, and permission-denied**. Ask which the product actually needs — not every
screen needs all five, and guessing inflates the build.

**Wait for the user.** They will strike screens, merge two, and name one you missed. That
is the checkpoint working.

## Step 4 — Wireframe one screen at a time (the loop)

For each agreed screen, in priority order the user sets. **One screen per turn.** Do not
batch three because they seem similar — the user's correction on screen 1 usually changes
screens 2 and 3, and batching throws that away.

Per screen, produce:

**a. The layout sketch** — ASCII or nested-list structure. Regions, hierarchy, what sits
where. Keep it small enough to read in one screen of terminal.

```
┌─ AppShell ──────────────────────────────────────────┐
│ [Nav: Dashboard | Import | Review(3) | Settings]    │
├─────────────────────────────────────────────────────┤
│  H1  Review                                         │
│  ┌ Card ─────────────────────────────────────────┐  │
│  │ Table: date | description | amount | group ▾  │  │
│  │        ...rows, group is an inline Select     │  │
│  └───────────────────────────────────────────────┘  │
│  [Button primary: Apply]  [Button ghost: Skip all]  │
└─────────────────────────────────────────────────────┘
```

**b. The component map** — every region bound to a real component:

```
AppShell → layout (no component; +layout.svelte)
Nav      → existing? NO — gap, see below
Card     → Card (frame="plain")
Table    → Table (columns, rows; values pre-formatted by the caller)
group ▾  → Select (inline, per row)
Apply    → Button (variant="primary")
```

**c. States** — what each of empty/loading/error/partial renders, in one line each.

**d. Behavior** — what each action does, and what the user sees after it. Name the domain
operation, not the HTTP call.

**e. Constraints honored** — cite the recalled `[node:<id>]` for each UX/a11y/i18n rule the
screen obeys, and say plainly where you could not obey one.

**f. Open questions** — at most three, the ones that actually block. Ask them; do not
answer them yourself.

Then **stop and wait.** Iterate the same screen until the user is satisfied before moving
on.

## Step 5 — Capture the design decisions

Wireframes are decisions in a diagram. At the end of the wireframing session (or per
screen, if the session is long):

```
capture_artifact(type="decision", goal_ref=..., facets=["ui"],
  content="Review screen classifies inline in the table via a per-row Select, rather than a modal per transaction: the common case is bulk triage of 20+ rows.",
  edges=[{"target": "<transaction-entity-id>", "type": "ABOUT", "direction": "out"}])

capture_artifact(type="constraint", goal_ref=..., facets=["ui"],
  content="Every screen renders an explicit empty state; a zero-row table must never render as a bare header.")
```

Capture: the **structural** decisions and why, the **design-system gaps** the user ruled on
(a `decision`, with a `CONTRADICTS` edge if it overrides an existing UI constraint), and
any **new UI constraint** the session settled. Attach `ABOUT` edges to the entities each
screen shows.

Do **not** capture the wireframes themselves — they are sequencing, like plan.md. Write
them to `context/changes/<change-id>/wireframes.md` and let them die with the change; the
decisions are what outlive it.

## Step 6 — Hand off to `/gw-plan`

Report: the screen inventory as agreed, the file with the wireframes, the captured
`[node:<id>]` decisions, the design-system gaps and how the user ruled on each, and any
open question that is now a planning input.

`/gw-plan` turns this into phases. Do not implement here — a wireframing session that
starts writing components has skipped the plan gate.

## Rules

- **One screen per turn, and stop.** The interactivity is the method, not a formality.
  Batching screens optimizes your turn count and costs the user a rework cycle.
- **Never invent a design-system component silently.** Gaps are surfaced as decisions with
  options and a cost for each.
- **Never invent domain vocabulary.** Screen labels use ratified entity names; a term the
  domain model lacks is either a `/gw-domain` proposal or the wrong word.
- **Structure, not style.** No hex codes, no font stacks, no spacing values — if the design
  system defines them, cite the token; if it does not, that is a design decision the
  project has not made, and saying so is more useful than guessing.
- **States are not optional.** Empty and error states are where UI rework concentrates;
  wireframe them or explicitly agree they are out of scope.
- Standing rules apply: recall before deciding, journal one batched `append_events`, honest
  events only, no trust/flag/tier mutation, `context/archive/` untouched.
