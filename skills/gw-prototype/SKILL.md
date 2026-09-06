---
name: gw-prototype
description: Turn agreed wireframes into clickable HTML prototypes wearing the project's real design tokens, served by pmview so a human can look at and click a screen before any production code exists. Reads the deck /gw-wireframe agreed, refuses any screen with an unruled component gap, and runs the ask loop through the desk. Use after /gw-wireframe and before /gw-plan, when a screen needs to be seen rather than described. Trigger phrases "make it clickable", "prototype the screens", "let me see it", "mock it up", "/gw-prototype".
---

# gw-prototype

`/gw-wireframe` stops at structure by rule — no hex, no font stacks, no spacing
values. That rule is right, and it leaves a hole: an ASCII box cannot be looked
at or clicked, so the first time anyone *sees* a screen is after it is built.

This skill fills rung 2 of the ladder. It renders the agreed deck into
self-contained HTML that wears the project's **own** stylesheet, served over real
HTTP by pmview, so the human can click the thing before the plan is written.

It invents nothing. Structure comes from the deck; style comes from tokens the
project already decided. **A prototype that introduces a colour, a font or a
spacing value the project has not chosen is a bug, not a draft** — it would then
be committed to git, framed in the Design tab as though it were agreed, and
hardened into a contract by `/gw-review` Part 1b.

## Preconditions

- A change is open with `memory_goal` in `change.md`.
- `/gw-wireframe` has agreed a screen inventory: `context/design/<surface>/deck.json`
  exists and `change.md` names the surface with `design_surface: <slug>`.
- The project has a design system. **With `binding: "unstyled"` — the value
  `/gw-wireframe` writes when it found none — stop at rung 1 and say so** — there is nothing to render a prototype *in*, and inventing a look is
  exactly the decision this lane refuses to make on the user's behalf.

## Step 0 — Drain the desk (every phase, no exceptions)

```sh
desk.py drain --surface <slug>
```

Resolve `desk.py` per `skills/gw-desk/REFERENCE.md`. Exit 0 means human lines are
waiting: read them in order, act, then `ack`. Exit 3 means nothing waiting.
(Exit 4 — nobody is listening — comes from `wait`, not from `drain`.)

**Before capturing anything in response to a redelivered line**, recall by its
thread id — see the dedup rule in the desk reference. A crash between capture and
ack would otherwise leave two conflicting rulings of one question.

## Step 1 — Ground yourself

```
recall_context(query="<surface> tokens components a11y", goal_ref=<goal_node_id>)
```

Then read, in this order:

1. `context/design/<surface>/deck.json` — the agreed screens. **This is
   canonical.** Never re-derive the inventory; if it looks wrong, that is a
   `/gw-wireframe` conversation, not a silent edit.
2. `context/foundation/design-bindings.md` — what pmview may serve. A stylesheet
   that is not on that allowlist has no transport, and a prototype referencing it
   renders unstyled.
3. `DESIGN.md` and `.impeccable/design.json` if present — the token names and the
   rules. Cite token *names*; never copy their values.

If impeccable is vendored, run `node <impeccable-base>/scripts/context.mjs
--target <the surface's target path>` once and follow its directives. If it is
absent, skip it with a named skip line — everything below still works.

## Step 2 — Refuse what you must not invent

**A screen carrying any `GAP:unruled` component cannot be prototyped.** Stop,
name the gap and the deck entry, and route back to `/gw-wireframe`'s gap ruling:

> `Review` needs a multi-select data table with row actions. The deck records it
> as `GAP:unruled — DataTable has no selection API`. I can't prototype this
> screen: rendering the region would mean inventing that component's markup, and
> a committed prototype is read as agreed. Rule it in `/gw-wireframe` — extend
> the component, accept a one-off, or change the interaction — and I'll build it.

Refusing to render leaves a hole exactly where the decision is hardest;
inventing it is *"how a design system dies"*. Where the human rules "(b) compose
in this screen only", write `oneoff:<node-id> — <markup summary>` into the deck's
`components` entry, so Part 1b sees an **accepted** inconsistency rather than
inheriting it as a contract.

Prototype every screen that is clean. Report the refused ones by name.

## Step 3 — Write the prototype

`context/design/<surface>/screens/<screen-id>.html`, one file per screen.
Committed, non-negotiably: impeccable's `isGeneratedFile()` treats any gitignored
path as generated and refuses to write into it, and a gitignored prototype is
invisible in the PR diff where the human already reviews everything else.

**The contract**, enforced here and checked at `/gw-review` Part 1b:

1. Every named region carries `data-gw-region="<label>"` matching a
   `wireframe.regions[].label`. This is what makes a click in the frame resolve
   to a region the deck knows.
2. The file contains `</body>` — impeccable's insertion anchor.
3. The first 300 bytes carry **no** `GENERATED FILE` / `DO NOT EDIT` header, or
   impeccable will refuse to touch it.
4. Style comes only from `/assets/<project>/<allowlisted path>` or a sibling
   `tokens.css`, and references token **names**. No literal hex, font stack or px
   value the project has not already decided.
5. **No inline `<script>`.** Behaviour lives in a sibling `.js` in the same
   directory. The served CSP omits `'unsafe-inline'` from `script-src`, so an
   inline script does not run — this rule is enforced, not advisory.
6. No `fetch`, no storage, no external URL. The frame is sandboxed at an opaque
   origin and cannot reach `/api/*` anyway; do not write code that tries.
7. Real content, never lorem. A prototype of an empty state must *be* the empty
   state, with the copy it will actually ship.

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/<project>/<the allowlisted stylesheet>">
</head><body>
<main class="view" data-gw-screen="review">
  <nav class="surface-rail" data-gw-region="surface rail"> … </nav>
</main>
</body></html>
```

Then record it in the deck: `screens[].prototype = "screens/<id>.html"`.

## Step 4 — Show it, and ask

Print the deep link — `http://127.0.0.1:8766/#design/<surface>` — and the ask
titles. **That is the floor and it works with pmview closed.**

Post blocking questions to the desk, at most three per screen, each with options
and *honest costs*:

```sh
desk.py post --surface <slug> --change <id> --goal <memory_goal> --file ask.json
```

`post` reports `human_present`. If true — and `post` reports `human_present: null` when it cannot tell, which
counts as true, since a spurious watcher costs one timed-out task while a
spurious absence strands a human at an open tab —
launch the watcher as a **background** task and **end your turn immediately**:

```sh
desk.py wait --surface <slug> --timeout 900
```

Never block mid-turn. pmview cannot start or wake a process; what resumes you is
this watcher exiting.

**While blocked**, in order: work the next screen with no dependency on an open
ask; do the non-blocking half of the blocked screen; prepare both branches when
`options ≤ 3` so the answer is one click on something already visible; then
`handoff` and end the turn. **Never guess.**

## Step 5 — Capture the rulings

At the phase boundary, not per line:

```
capture_artifact(type="decision", goal_ref=..., facets=["ui"],
  content="Review classifies inline via a per-row Select rather than a modal per
           transaction: the common case is bulk triage of 20+ rows.
           per desk <surface>#<thread-id>",
  edges=[{"target": "<entity-id>", "type": "ABOUT", "direction": "out"}])
```

The `per desk <surface>#<id>` provenance is **required**: it is what the dedup
recall matches on after a crash, and it is what makes a captured ruling traceable
to the conversation that produced it.

An instruction that contradicts a settled `ui` constraint is neither silently
obeyed nor refused: run `impact_of`, capture the ruling, `link(..., type=
"CONTRADICTS")`, ack with `disposition: "contradicts"`, and **stop before
applying**. The human rules via `/gw-resolve` or the review GUI. Do not retire,
archive or re-weight the superseded constraint — none of that is yours to do.

Then one batched `append_events`.

## Step 6 — Hand off

Report: the screens prototyped and their links, the screens refused and which gap
refused them, the captured `[node:<id>]` decisions, and any ask still open.

`/gw-plan` reads the deck and **refuses on an unread desk**. Do not implement
here — a prototyping session that starts editing production components has
skipped the plan gate.

## Optional — impeccable `live` on a prototype

Only when impeccable is vendored, and only with a **per-surface** config. Do not
hand-write it — getting this wrong does not fail loudly, it **edits the real
application**:

```sh
python3 <this skill's dir>/bin/live_setup.py preflight --surface S --screen X
python3 <this skill's dir>/bin/live_setup.py arm       --surface S --screen X
#   … the live session …
python3 <this skill's dir>/bin/live_setup.py teardown  --surface S
```

`arm` writes `context/design/<surface>/.impeccable/live/config.json`; `teardown`
removes it, scans every prototype for session residue, and reports
`git status --porcelain context/design/`. **A non-empty residue list is a
teardown failure, not a warning** — prototypes are git-tracked, so a crashed
session leaves a session token in a file that ships.

This is load-bearing, not tidiness. `isAppRoot()` returns true for any directory
carrying `.impeccable/live/config.json`, and `walkUp` stops at the first hit — so
the app root becomes the design directory, `resolveFramework` returns
`staticHtml` (whose `inject.kind` is `tag`, so `config.files` is honoured at
all), and `findSourceFile`'s walk is confined to the surface directory.

Without it, on any real project here, three things go wrong: a SvelteKit or Next
app root selects the **adapter** branch, which never reads `config.files`; an
unpinned `live-wrap` walks the whole app root and can splice a variant into the
**real application** (rule 4 mandates the project's real class names, so a pick
on `.item` can resolve to a shipping file); and a repo-wide glob dirties every
prototype in the repo with a session token.

So: pass `--file screens/<screen>.html` on **every** wrap call — an unpinned wrap
in this lane is a defect. Open the prototype in its own top-level tab, never
iframed: the sandbox's opaque origin breaks `isLoopbackOrigin` and localStorage.
Over SSH that needs two forwarded ports, 8766 and the resolved helper port, which
this skill prints from the inject journal.

On teardown, run `live-inject.mjs --remove`, delete the per-surface config, and
check `git status --porcelain context/design/`. **A non-empty result is a
teardown failure, not a warning.**

Budget one carbonize turn per accept — `live-complete.mjs` refuses with
`source_dirty` until markers and unbaked `--p-*` vars are gone. Route
behavioural, state-machine and single-exact-value changes away from live
entirely; edit the file.

## Before you ask

**Explore instead of asking**, and **recommend with every question**. Both are in
`skills/gw-desk/REFERENCE.md`; they are repeated here because this is where they
get skipped — a prototype session generates questions faster than any other, and
an ask that could have been a `grep` is the one that costs you the human's
patience.

## Rules

- **Never invent a token.** Cite a name the project already has, or surface the
  absence as a decision. A prototype is not the place to settle a palette.
- **Never invent a component.** An unruled gap stops the screen. Every time.
- **Never invent domain vocabulary.** Labels use ratified entity names.
- **Real content, never lorem.** A prototype exists to be judged; placeholder
  text makes it unjudgeable.
- **One screen per turn when asking.** Batching costs the user a rework cycle, and
  the answer to screen 1 usually changes screens 2 and 3.
- **The prototype is a proposal, not a build.** It never imports from `src/`,
  never runs the app's code, and is never wired to real data.
- Standing rules apply: drain at the gate, recall before deciding, one batched
  `append_events`, honest events only, no trust/flag/tier mutation,
  `context/archive/` untouched.
