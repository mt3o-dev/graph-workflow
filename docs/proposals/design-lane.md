# The gw Design Lane — Final Architecture & Implementation Plan

> ## Status: shipped
>
> All seven slices plus v1.1 are implemented on branch `design-lane`
> (`1a08c8e..adb7e47`, 47 files, ~5,600 lines, 73 tests green). Where the build
> found this document wrong, the **code** is right and the deviation is recorded
> in the relevant commit message. Four notable ones:
>
> - **`:277` was not a hardcoded-literal bug.** It creates a real SQLite fixture;
>   renaming it would have made the name lie. Five sites, not six.
> - **The write guard requires JSON but allows a missing `Origin`.** Requiring
>   JSON is what actually defeats browser CSRF (a simple request cannot set it);
>   rejecting a missing Origin only breaks curl and scripts.
> - **The two fingerprint readers disagreed.** `design.py` hashed `name + body`
>   while the distiller hashed `body`, so every rule would have reported stale
>   forever. Both now hash the body alone.
> - **The dogfood `context/README.md` files were left alone.** The checklist said
>   to update their enumeration, but those projects have no `context/design/` —
>   the edit would have made three accurate files lie.
>
> The lane also caught three design-system violations in its own CSS (a 3px
> coloured `border-left` on `.ask` and `.banner`, a 2px radius on `.pin i`),
> breaking the exact Don't distilled into the graph one slice earlier. Fixed to
> the tonal idiom `DESIGN.md` prescribes; detector now reports zero.

*Verified against `build-installable-assets` @ `1a08c8e`. Every line/behaviour citation below was re-checked by reading or executing the file. Where the adversarial review misread the code, it is called out inline under **CORRECTION**.*

---

## 1. Thesis

The design lane is a **surface-keyed deck of screens** that an agent renders into the project's own token system as clickable HTML prototypes, served by pmview over real HTTP into a sandboxed frame, with **one git-tracked append-only log per surface** as the entire agent↔human channel: the agent posts asks and keeps working, the human answers by pointing and clicking in a browser, and a watcher the agent launched before ending its turn wakes it when the answers land. Three files, all in git — the deck is what we agreed, the prototype is what it looks like, the desk is how we talked about it — so nothing lives in a process, nothing is lost when a session dies, and **every forged or unverified input is visible in the same PR diff where the code is already reviewed**. The graph keeps its monopoly on knowledge: a desk line is a *request*, never a capture; every ruling still becomes a `capture_artifact` with a `goal_ref` through the one guarded write path at `:8765`.

---

## 2. What changes, at a glance

| File | Change | Why | Size |
|---|---|---|---|
| **Prerequisites (Slice 0)** | | | |
| `gui/tests/test_pmview.py` | add `store_path(root)` helper; repoint 6 hardcoded `memory-graph.db` literals (`:33 :38 :277 :318 :389 :400`) | 26/41 tests fail today; **widening `STORE_NAMES` alone fixes exactly one** (measured) | ~15 LOC |
| `gui/pmview/server.py` | `STORE_NAMES = ("memory-graph.db", "memory-graph.dump")` | `.db` is gitignored (`.gitignore:16-18`); fresh clones have no store | 1 line |
| `gui/pmview/server.py` | `do_POST` guard: reject missing/foreign `Origin`, require `application/json`, cap `Content-Length` | today any page can drive the write proxy as a no-preflight simple request | ~14 LOC |
| `gui/pmview/server.py` | `_fingerprint`: wrap `p.stat()` in an `OSError`-safe helper | a file deleted mid-glob 500s with a traceback into the human's terminal (`handle_error` is not overridden) | 4 LOC |
| `.github/workflows/test.yml` | **new** — `python3 -m unittest discover -s gui/tests` on push/PR | `release.yml` is the only workflow; it fires on `tags: ["v*"]`. The byte-identity safety test has been erroring unnoticed | ~20 lines |
| **pmview (Slices 1–3)** | | | |
| `gui/pmview/design.py` | **new** — decks, desk fold, presence, design-system read | the whole lane's read/append surface; imports no `memory`, no `graph`, no `board` | ~220 LOC |
| `gui/pmview/server.py` | 8 route branches + `allowed_origins` + `session_token` + `_proto` + `_assets` | serving decks, desk, prototypes, project stylesheets | ~90 LOC |
| `gui/pmview/lifecycle.py` | `Change.design_surfaces: list[str]`, repeated-key preamble scan | Part 1b's trigger is invisible to pmview otherwise | ~12 LOC |
| `gui/pmview/static/index.html` | Design tab button, `<section id="view-design">`, `<meta name="gw-token">`, data-URI favicon | tab machinery is fully data-driven (`showView` app.js:624-633, `boot` app.js:650-652) | +6 lines |
| `gui/pmview/static/app.js` | `renderDesign` + `wireFrame` + ask stack + pulse; **mandatory** edit at `:621` | omit `:621` and `render()` throws a synchronous `TypeError` before `.catch` attaches | ~300 LOC |
| `gui/pmview/static/style.css` | `.design-split .surface-rail .wire .wire-region .protoframe .ask .ask-options .instruction-composer .pin` | every value from the 40 existing `:root` tokens (`style.css:1-52`) | ~70 LOC |
| `gui/pmview/static/_gw/pin.js` | **new** — region picker inside the sandboxed frame | shipped as a package resource so it rides into the `.pyz`; served by existing `_static` | ~75 LOC |
| `gui/tests/test_pmview.py` | +9 tests | traversal/symlink/extension, forged-kind rejection, byte-identity after a desk exercise | ~120 LOC |
| **Skills (Slices 2, 4, 5, 6)** | | | |
| `skills/gw-prototype/SKILL.md` | **new** — 19th skill | resolves gw-wireframe's "Structure, not style" rule rather than re-scoping it | ~190 lines |
| `skills/gw-desk/bin/desk.py` + `REFERENCE.md` | **new**, no `SKILL.md` | plumbing every phase touches, not a phase; ships with zero build changes (`build.py:69` has no `SKILL.md` check, `install-skills.sh:36` globs `gw-*/`) | ~230 LOC |
| `skills/gw-foundation/bin/design_distill.py` | **new** — emits a review file; never touches the graph | gap 2 | ~95 LOC |
| `skills/gw-wireframe/SKILL.md` | Steps 2, 3, 4a, 4f, 5, 6 + Rules | heaviest edit; deck becomes canonical, ASCII rendered from it | ~60 lines changed |
| `skills/gw-{init,new,plan,plan-review,implement,review,archive,foundation,goal,ask,track,fix}/SKILL.md` | targeted edits, §5 | drain-at-gate, routing, Part 1b, residue | ~120 lines total |
| **Docs (Slice 6)** | see §11 — 22 files, both Polish mirrors | | ~250 lines |
| `.gitattributes` | **new** — `context/design/**/asks.jsonl merge=union` | `merge=union` is a **built-in** driver needing no local registration — unlike the `filter=memory-db` clean/smudge filter `.gitignore:16-18` blames for breaking fresh clones | 2 lines |
| `.gitignore` | `.impeccable/live/inject-journal.json` | impeccable writes it into the tree and it is currently untracked-but-not-ignored | 1 line |
| `scripts/build.py`, `scripts/install-skills.sh` | **zero changes** | verified: `copytree` picks up `design.py` + `static/_gw/pin.js`; `tar.add` recurses | — |

**Total: ~1,000 LOC + ~800 lines of skill/doc prose across ~34 files.**

---

## 3. The fidelity ladder

Four rungs. One canonical artifact, one home, one producer, one consumer, one death rule each.

### The surface key — fixed

**CONFIRMED FATAL.** `slugFromTarget` tail-truncates at 50 chars (`lib/target-slug.mjs:32`). Executed:

```
web/src/components/dashboard/widgets/revenue/chart/index.html
mobile/src/components/dashboard/widgets/revenue/chart/index.html
        → both ⇒ "ponents-dashboard-widgets-revenue-chart-index-html"
```

A collision merges `deck.json`, `screens/` and — fatally — `asks.jsonl`, a file the design forbids editing. So gw does **not** use impeccable's slug as its directory key. It uses its own:

```python
def gw_slug(target: str) -> str:
    """Head-kept, digest-suffixed. Identical to impeccable's slug for short paths
    (the common case), collision-proof for long ones."""
    s = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]+", "-",
        re.sub(r"[/\\.]+", "-", target.strip().lower()))).strip("-")
    if len(s) <= 50:
        return s
    return s[:43].rstrip("-") + "-" + hashlib.sha256(target.encode()).hexdigest()[:6]
```

`gui/pmview/static/index.html` → `gui-pmview-static-index-html` — byte-identical to impeccable's, so `.impeccable/surfaces/<slug>.md` still matches. Only paths over 50 kebab-chars diverge, and only there do we carry the digest. `deck.json.target` stores the untruncated target; `design.surfaces()` refuses to load a deck whose directory does not equal `gw_slug(deck.target)` and renders a warning card instead.

### Home

Everything lives under `<Project.root>/context/design/<surface>/` — inside `context/` (`Project.context` is `root/"context"`, `server.py:53-57`) and **not** under `context/changes/`.

> **`/gw-init`'s rule stands verbatim and unamended.** *"Do not create per-change notes/, research/, decisions/ subfolders — that is what the graph replaces."* A surface-keyed directory is not a per-change subfolder. `/gw-init` gains one clarifying sentence, not an exception (§5).

### Rung 0 — Inventory

`context/design/<surface>/deck.json` → `screens[]`. JSON. Committed. Never dies; superseded in place, `git log` is the history. Produced by `/gw-wireframe` Step 3. Consumed by pmview, `/gw-prototype`, `/gw-plan`, `/gw-plan-review`, `/gw-review`.

### Rung 1 — Wireframe (structure, no values)

Same file. The schematic field is named **`wireframe`**, matching `serve-question.mjs:526` (`const frame = option.wireframe`), so those exact bytes are interchangeable at the one place it is cheap to keep true. `cols`/`rows` are always written explicitly (impeccable defaults to 12×**10**, not 12×8). Cap 12 regions — `serve-question.mjs:531` slices at 12.

The JSON is **canonical**; the ASCII box the terminal shows is *rendered from it* by the agent, one direction only.

```json
{
  "v": 1,
  "surface": "gui-pmview-static-index-html",
  "target": "gui/pmview/static/index.html",
  "binding": "system-bound",
  "stylesheet": "/proto/graph-workflow/gui-pmview-static-index-html/tokens.css",
  "screens": [{
    "id": "design-tab",
    "title": "Design tab — default",
    "status": "agreed",
    "agreed_by": [{"change": "pmview-design-lane", "on": "2026-08-24"}],
    "depends_on": [],
    "implements": "gui/pmview/static/index.html#view-design",
    "wireframe": { "cols": 12, "rows": 10, "regions": [
      {"label": "topbar",       "x": 0, "y": 0, "w": 12, "h": 1},
      {"label": "tabs",         "x": 0, "y": 1, "w": 5,  "h": 1, "accent": true},
      {"label": "surface rail", "x": 0, "y": 2, "w": 3,  "h": 8},
      {"label": "prototype",    "x": 3, "y": 2, "w": 5,  "h": 8},
      {"label": "ask stack",    "x": 8, "y": 2, "w": 4,  "h": 8, "accent": true}]},
    "components": {
      "surface rail": "existing:.item/.list",
      "prototype":    "GAP:unruled — Prototype Frame is not in DESIGN.md §Components",
      "ask stack":    "GAP:unruled — Ask Card is not in DESIGN.md §Components"},
    "states": {
      "empty": "no surfaces: one line, the path we looked in",
      "loading": "rail skeleton, centre pane holds its last frame",
      "error": "deck failed to parse: warning row naming the file and the line",
      "partial": "deck present, no prototype: schematic only, toggle disabled",
      "permission-denied": "n/a — local single-user"},
    "behavior": ["Send N → POST /api/design/answers, one batch id, toast names the count"],
    "cites": ["node:c1a2f0", "node:9f7731"],
    "prototype": null
  }]
}
```

`status` ∈ `draft | agreed | superseded`. `components` values are `existing:<selector>` | `library:<Name>` | `GAP:unruled — <why>` | `GAP:ruled:<node-id> — <the ruling>` | `oneoff:<node-id> — <markup summary>`. Malformed decks degrade to a warning card, never an exception — the same forgiving discipline `lifecycle.py` already applies to markdown.

> **CORRECTION — the "strict superset of `serve-question.mjs`" claim is deleted.** The reviewer is right and the evidence is decisive: the real option schema is `{id, label, kicker, lineage, thesis, palette, materials, viewport, risk, case, kept, verdict, comp, hero, board, raised, wireframe}` with `steer`/`reroll`/`buildPath` at payload level (`serve-question.mjs:195-206`); there is no `key`, no `cost`, no per-option `free_text`, no `media`; and `wire()` returns `''` whenever the card has any media (`:526`), so schematic-and-comp are mutually exclusive there. **The desk schema is gw's own. The single documented pmview-down fallback is the terminal**, matching §8's degradation table — the two contradictory fallbacks in the draft are resolved in favour of the terminal.

### Rung 2 — Prototype (structure + the project's real tokens, clickable)

`context/design/<surface>/screens/<screen-id>.html`, plus optional `context/design/<surface>/tokens.css`, `assets/`, and sibling `.js`. Self-contained HTML. **Committed, non-negotiably** — `isGeneratedFile()` treats any gitignored path as generated (`lib/is-generated.mjs:37`) and `live-wrap.mjs` refuses to write into one; and a gitignored prototype is invisible in the PR diff where the human already reviews everything else. Superseded in place; reported (never deleted) at `/gw-archive`.

**Contract**, enforced by `/gw-prototype` and checked at `/gw-review` Part 1b:

1. Every named region carries `data-gw-region="<label>"` matching a `wireframe.regions[].label`.
2. The file contains `</body>` — impeccable's insertion anchor.
3. The first 300 bytes carry **no** `GENERATED FILE` / `DO NOT EDIT` header (`hasGeneratedHeader`, `is-generated.mjs:59-72`).
4. Style comes only from `/assets/<project>/<allowlisted path>` (the project's shipping stylesheet) or `/proto/<project>/<surface>/tokens.css`, referencing token **names**. No literal hex, font stack or px value the project has not already decided.
5. **No inline `<script>`.** Behaviour lives in a sibling `.js` in the same directory. This is what lets `script-src` omit `'unsafe-inline'`.
6. No `fetch`, no storage, no external URL.
7. **A screen with an unruled component gap cannot be prototyped.**

> **CONFIRMED FATAL — the gap rule, extended to rung 2.** A rendered prototype must emit markup for every region, gaps included, and there was no rule for what to render in an unruled one. Refusing to render leaves the prototype blank exactly where the decision is hardest; inventing it is *"how a design system dies"* (`gw-wireframe/SKILL.md:80`), now committed to git and hardened by Part 1b into a contract code must honour. **The rule:** `/gw-prototype` refuses a screen carrying any `GAP:unruled`, names the gap and the deck entry, and routes back to `/gw-wireframe`'s gap ruling. Where the human rules "(b) compose in this screen only", `/gw-prototype` writes `oneoff:<node-id> — <markup summary>` into the deck's `components` entry, so Part 1b sees an *accepted* inconsistency rather than inheriting it as a contract.
>
> **And the architecture stops pre-deciding it.** The `.wire`/`.wire-region`/`.protoframe`/`.ask` CSS below is specified *because DESIGN.md §Components does not enumerate Layout Schematic, Prototype Frame or Ask Card* — 11 components are listed (`DESIGN.md:187-233`) and none of these. The lane's own first act is therefore to run its own gap rule on itself. §6 states the geometry and token mapping as the **proposal** the session rules on, and Slice 1 does not merge until three `decision` nodes exist recording the ruling. If the maintainer would rather skip the ceremony, that is fine — but then record the three decisions before Slice 1, not after.

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/graph-workflow/gui/pmview/static/style.css">
</head><body>
<main class="view" data-gw-screen="design-tab">
  <nav class="surface-rail" data-gw-region="surface rail"> … </nav>
  <section class="design-main" data-gw-region="prototype"> … </section>
  <aside class="ask-stack" data-gw-region="ask stack"> … </aside>
</main>
</body></html>
```

### Rung 3 — Code

The shipped component. `screens[].implements` is the join back; Part 1b check 1 checks it.

### Off-ladder

- **`context/design/<surface>/asks.jsonl`** — the desk. Git-tracked, append-only. §7.
- **`context/foundation/design-bindings.md`** — the per-project binding, the stylesheet allowlist, and the per-rule fingerprint table. §9.
- **`.impeccable/surfaces/<slug>.md`** — a **one-way courtesy publish** to impeccable, never gw's durable home. §9.
- **`.gw-scratch/design/`** — runtime only, already gitignored (`.gitignore:37`, **not `:39`**). `<surface>.presence.json`, `<surface>.waiting.json`.
- **The graph** — every decision, constraint and concept. The only thing that is knowledge.

---

## 4. The redrawn lifecycle

```
                    ┌─ /gw-foundation ──────────────────────────────────────────┐
                    │  + design-system distillation (gap 2)                     │
                    │    .impeccable/design.json → narrative.rules[]  (7, objs) │
                    │                              narrative.donts[] (5, STRINGS)│
                    │                                → constraint, facets:["ui"]│
                    │                              northStar + overview → concept│
                    │    per-rule fp table → context/foundation/design-bindings.md│
                    │    ⚠ 13 human promotions, then `deactivate foundation      │
                    │      --sweep` retires whatever was not promoted            │
                    └────────────────────────────────┬──────────────────────────┘
                                                     │ recalled by every step below
/gw-init ────────────────────────────────────────┐   │
  + context/design/ scaffold                     │   │
  + context/foundation/design-bindings.md        │   │
  + .gitattributes (merge=union)                 v   v
                                                     
/gw-new ──> is this a UI surface?
   │            │                    [step 0 of EVERY phase below: desk.py drain]
   │            yes
   │            v
   │      /gw-wireframe ───────────────────── the deck (rung 0+1) ─────────┐
   │       Step 2  recall ui constraints, THEN context.mjs probe            │
   │               column header: "design-system binding" (not "Mode")      │
   │       Step 3  inventory → writes design_surface: <slug> into change.md │
   │       Step 4a wireframe JSON  (ASCII rendered from it)                 │
   │       Step 4f ≤3 blocking asks ─> desk ─> pmview ─> human ─> desk ──┐  │
   │       Step 5  capture (content=, direction=) + courtesy brief        │  │
   │       Step 6  three-way routing ──────────┐                         │  │
   │                                           │                         │  │
   │              needs to be clicked?         │                         │  │
   │                    yes                    │ no                      │  │
   │                     v                     │                         │  │
   │       **/gw-prototype**  (NEW, 19th)      │                         │  │
   │         rung 2 ─> pmview /proto/ ─> sandboxed iframe                 │  │
   │         region pins, asks, both-branch prep                          │  │
   │         refuses any screen with GAP:unruled                          │  │
   │         optional: impeccable live (per-surface appRoot, v1.1)        │  │
   │                     │                     │                         │  │
   │                     └──────────┬──────────┘                         │  │
   no                               v                                    │  │
   │                           /gw-plan  ◄── drain; REFUSE on unread ─────┘  │
   │                               │     ◄── read every deck change.md names ┘
   │                               v
   │                        /gw-plan-review   (+ screen-coverage check)
   │                               v
   └───────────────────────> /gw-implement    (prototype is the reference;
                                   │           drain at each phase boundary;
                                   │           impeccable live sanctioned HERE
                                   │           against the real app)
                                   │
     /gw-fix ─────────────────────>│  (dirty files match a deck's implements?
       + one ground line           │   → name the surface, drain, write
       + one report line           │     design_surface: so Part 1b fires)
                                   v
                             /gw-review
                               + Part 1b  Design review (gap 3), 8 checks
                                   │
                                   v
                             /gw-archive
                               + last-call capture: hang every live deck's
                                 cites[] on the change-summary via DEPENDS_ON
                               + residue report (counts + path; human deletes)
                               + context/design/ is NOT moved
```

**New:** one skill (`/gw-prototype`, 18 → **19**), one shared dir (`skills/gw-desk/`, no `SKILL.md`, no routing row), one doc (`docs/DESK.md`).

**Changed:** `gw-init`, `gw-new`, `gw-wireframe` (heaviest), `gw-plan`, `gw-plan-review`, `gw-implement`, `gw-review`, `gw-archive`, `gw-foundation`, `gw-goal`, `gw-ask`, `gw-track`, **`gw-fix`** (moved out of Unchanged — see §5).

**Unchanged:** `gw-research`, `gw-domain`, `gw-ideate`, `gw-consolidate`, `gw-resolve`.

---

## 5. Skill changes — the exact edits

### 5.0 The desk-path resolution rule (quoted verbatim into every calling skill)

```
Resolve desk.py in this order and use the first that exists:
  1. $GW_DESK
  2. <this skill's own base directory, as the runtime reports it>/../gw-desk/bin/desk.py
  3. `command -v gw-desk`
Never hardcode `.claude/skills/...`. The skills are vendored into four runtimes
here (.claude, .agent, .kiro, .opencode — 148 tracked files each, VERIFIED).
```

> **Slice-1 acceptance gate:** empirically confirm that a `SKILL.md`-less directory under `~/.claude/skills/` loads without a warning. Packaging is verified (`build.py:69` globs `p.is_dir() and p.name.startswith("gw-")` with no `SKILL.md` check; `install-skills.sh:36` does `for skill in "$SRC"/gw-*/ … cp -R`), **runtime is not**. If any runtime warns, give `gw-desk` a minimal `SKILL.md` whose description says *"internal plumbing — not a command; see REFERENCE.md"*, and accept the 20th row.

### 5.1 `skills/gw-init/SKILL.md`

**Step 1 now reads (added lines marked +):**

Currently:
> ```
> context/
>   changes/     # active changes: <change-id>/{change.md, plan.md}
>   archive/     # immutable, append-only — no skill ever writes here
>   foundation/  # PRD, roadmap, tech-stack — long-lived documents
> ```
> Add a `context/README.md` stating the split: *files = lifecycle artifacts, graph = knowledge*. Do not create per-change notes/, research/, decisions/ subfolders — that is what the graph replaces.

Becomes:
```
context/
  changes/     # active changes: <change-id>/{change.md, plan.md}
  archive/     # immutable, append-only — no skill ever writes here
  foundation/  # PRD, roadmap, tech-stack — long-lived documents
+ design/      # RENDERINGS, keyed by SURFACE not by change — decks,
+              # prototypes, and the per-surface ask log. Holds no knowledge.
```
```
+ `context/design/` is keyed by surface, not by change, and holds renderings
+ rather than knowledge. Delete the whole directory and nothing is lost but
+ pixels — that is the test the "graph replaces folders" rule intends. If you
+ find yourself writing `context/design/<change-id>/`, stop: you have re-created
+ the folder-as-memory pattern the graph replaces.
```

**Step 3 gains (the `.gitattributes` sentence — the finding's own fix, made explicit):**
```
+ Create `.gitattributes` with one line:
+
+     context/design/**/asks.jsonl merge=union
+
+ `merge=union` is a git BUILT-IN merge driver. It needs no `.git/config` entry
+ and no local registration, which is exactly what distinguishes it from the
+ `filter=memory-db` clean/smudge filter this step tells you to remove — that
+ one needed local config git never clones, and silently broke every fresh
+ checkout. A union merge concatenates both sides of an append-only log with no
+ conflict markers, which is the correct semantics for a file nobody renumbers.
```

**Step 6 gains a second binding:** write `context/foundation/design-bindings.md` (design system present? which one? which stylesheet paths may be served to prototypes?). `design: none` is a complete answer.

### 5.2 `skills/gw-new/SKILL.md`

**Step 2 template** currently:
```markdown
status: open
created: <YYYY-MM-DD>
epic: <epic-id>          # only when the change is a slice of a registered epic
```
becomes:
```markdown
status: open
created: <YYYY-MM-DD>
epic: <epic-id>          # only when the change is a slice of a registered epic
design_surface:          # repeatable — one line per UI surface this change
                         # touches. /gw-wireframe Step 3 writes these; a change
                         # touching three surfaces gets three lines.
```

**Step 8 routing bullet** currently:
> - `/gw-wireframe` first if the change builds or redesigns a UI surface — the wireframe is an input to the plan, not an output of it;

becomes:
> - `/gw-wireframe` first if the change builds or redesigns a UI surface — the wireframe is an input to the plan, not an output of it. If a deck already exists for that surface (`context/design/<surface>/deck.json`), say so and drain its desk before wireframing: another change may have left questions or instructions on it.

### 5.3 `skills/gw-wireframe/SKILL.md` — the heaviest edit

**Step 2.** Currently the detection order is a filesystem sniff (`**/design-system/`, `tokens.css`/`theme.ts`/`tailwind.config.*`, a library dependency, then graph knowledge) and the table's column is headed **`Mode`**.

Three edits:
1. **Recall first.** Insert as item 0: `recall_context(query="design system tokens components", goal_ref=<goal>)` filtered to `type="constraint"`, facet `ui`. After gap 2 lands, the design system **is** in the graph and no file sniffing is needed for it.
2. Insert as item 1: `node <skill-base-dir>/scripts/context.mjs --target <primary-target>` when impeccable is vendored — resolving the base dir the runtime reports; **never** hardcode a vendor path. The existing sniff survives as items 2–4, the degraded path: note in the skill that it *does not look for `DESIGN.md` or `.impeccable/design.json` at all*, the two files that actually define a project's system here.
3. **Rename the column `Mode` → `design-system binding`.** impeccable's `Mode` is the visitor axis (Persuade | Operate | Read | Experience) — a different axis entirely, and the collision would confuse readers and agents permanently once the two are wired together.

**Step 2 also gains the `shape` ruling** (new subsection, ~6 lines):
> **`/gw-wireframe` vs `impeccable shape`.** `shape` is impeccable's Build-phase discovery interview; its brief covers job/audience, outcome, direction, scope, **states and ranges**, and **interaction and layout** — the same ground as Steps 1–6 with different nouns. Rule: **`/gw-wireframe` owns the screen inventory, the deck and the graph capture.** `shape` is invoked only for the visual-world / direction question this skill deliberately does not answer, and its brief is an **input** to Step 4 (read from `.impeccable/surfaces/<slug>.md`), never a parallel deliverable. Leaving this unstated guarantees two design systems of record.

**Step 3** gains a final paragraph:
```
+ Once the inventory is agreed, write `design_surface: <surface-slug>` into the
+ change.md preamble (beside `epic:`), one line per surface, and create
+ `context/design/<surface>/deck.json` with the agreed screens at
+ `status: draft`. This is the field /gw-review Part 1b keys off; without it the
+ design gate never fires, silently.
```

**Step 4a** currently: *"The layout sketch — ASCII or nested-list structure."* Becomes:
```
+ **a. The layout sketch.** Author `screens[].wireframe` in deck.json as grid
+ regions ({cols, rows, regions:[{label,x,y,w,h,accent?}]}, ≤12 regions, cols and
+ rows always explicit). Then RENDER the ASCII box from that JSON for the terminal.
+ The JSON is canonical and the ASCII is a view of it — never author the two
+ separately, or they drift inside a single session.
```

**Step 4f** currently: *"Open questions — at most three, the ones that actually block. Ask them; do not answer them yourself."* Becomes:
```
+ **f. Open questions** — at most three, the ones that actually block. Ask them;
+ do not answer them yourself. Post each as an `ask` line via
+ `desk.py post` (§ desk-path rule) carrying `blocks: [<screen-id>]`, options
+ with honest costs, and `media: {kind:"wire", screen:"<id>"}` so the human sees
+ the schematic beside the question. `post` prints the deep link and
+ `{"human_present": bool}`. Print the link and the ask titles in the terminal
+ REGARDLESS — that path works with pmview closed.
```

**Step 5** gains, after the existing `capture_artifact` block:
```
+ Every capture uses `content=` (NOT `body=` — capture_artifact's required args
+ are content/type/goal_ref) and every edge carries `direction`.
+ Then publish the durable prose as a ONE-WAY COURTESY to impeccable:
+   node <skill-base-dir>/scripts/surface-brief.mjs write <target> <body-file> [related…]
+ ALL gw metadata goes in the BODY. `writeSurfaceBrief` re-emits exactly
+ version/slug/primary_target/related_targets and destroys anything else in the
+ frontmatter, and it is a whole-file `fs.writeFileSync` with no append mode —
+ so a concurrent impeccable session or an `impeccable doctor` repair may drop
+ what you wrote. Nothing gw needs back may live only there.
```

**Step 6** becomes three-way:
```
Report the inventory, the deck path, the captured [node:<id>] decisions, the
design-system gaps and how the user ruled on each, and every ask still open.
Then route:
+  - `/gw-prototype` if any agreed screen needs to be CLICKED before it is
+    planned — an interaction whose feel is the question, a density judgement, a
+    state machine the human has to walk. It renders the deck into the project's
+    real tokens and serves it. It refuses any screen still carrying an
+    unruled component gap.
   - `/gw-plan` if structure was the whole question.
   - back to Step 4 if screens remain.
Do not implement here.
```

**Rules** — the `Structure, not style` bullet is re-scoped:
> - **Structure, not style — in this skill.** No hex codes, no font stacks, no spacing values. If the design system defines them, cite the token; if it does not, that is a design decision the project has not made, and saying so is more useful than guessing. **Committing style is `/gw-prototype`'s job, and only inside the project's own token system.**

Plus one new rule:
> - **Never self-answer a desk ask.** An ask the human has not answered is an ask. Guessing produces a `decision` node the human never made, and the goal-mandatory write makes it permanent.

### 5.4 `skills/gw-prototype/SKILL.md` — new (~190 lines)

Steps: (0) drain the desk. (1) ground — read the deck, `recall_context` the `ui` constraints, resolve the binding from `context/foundation/design-bindings.md`. (2) **refuse any screen carrying `GAP:unruled`**, naming the gap and routing back. (3) render one screen per turn into `screens/<id>.html` under the rung-2 contract. (4) print `http://<host>:<port>/#design/<surface>/<screen>`; post asks with `media:{kind:"proto"}`. (5) region pins arrive as `instruction` lines; each gets an `ack`. (6) **prepare both branches** when `options ≤ 3` — publish `x.html` and `x--optB.html` so the answer is one click on something visible. (7) capture; batched `append_events`. (8) hand off to `/gw-plan`.

Rules: one screen per turn; never inline `<script>`; never a literal colour/px the project has not decided; never `fetch`/storage/external URLs; a `GAP:unruled` stops the session; **never headless** (same reason as `/gw-wireframe`); live-mode rules per §8.

### 5.5 `skills/gw-plan/SKILL.md`

Step 1 currently: *"read `research.md` and `wireframes.md` if present."* Becomes:
```
read `research.md`, and EVERY deck named by a `design_surface:` line in
change.md (`context/design/<surface>/deck.json`). `wireframes.md`, where an
older change left one, is now a pointer list to those decks.

Then run `desk.py drain` for each of those surfaces. If any ask is still `open`
and not `declined`, STOP AND REPORT — planning past an unread design question
produces a plan that guesses the screen. This is a refusal, not a warning.
```

### 5.6 `skills/gw-plan-review/SKILL.md`

One check added to the existing list: *"Screen coverage — every deck screen at `status: agreed` and `agreed_by` naming this change appears in some phase of plan.md. An agreed screen with no phase is a plan gap, not a design gap."*

### 5.7 `skills/gw-implement/SKILL.md`

Two additions: (a) *"Where a screen has a rung-2 prototype, the prototype is the reference — the built markup carries the same `data-gw-region` labels and the same states. A divergence is a finding for `/gw-review`, not a silent improvement."* (b) *"At each phase boundary, `desk.py drain` for every surface the change binds; report what you read before acting."* (c) impeccable `live` is sanctioned **here and only here** against the real running app.

### 5.8 `skills/gw-review/SKILL.md` — Part 1b (gap 3)

Sited between Part 1 and Part 2. **Runs only when change.md names a `design_surface:`**; iterates every one. Eight checks, each degrading to a **named skip line**, never a failure:

1. **Screen coverage** — every deck screen with `status: agreed` **and `agreed_by` naming this change** has a live `implements:` target that exists. *A wireframe decision silently not honored in code is a finding.* (Scoping to `agreed_by` is what stops change B reporting change A's unbuilt screen.)
2. **State coverage** — every state the deck lists actually renders, the empty state especially.
3. **Cited constraints** — every `[node:<id>]` in `cites` is honored in the built markup. **A dormant cited node emits a named skip, not an unhonored-constraint finding** (see §9's archive rule).
4. **Mechanical** — `node <skill-base-dir>/scripts/detect.mjs` over the change's dirty markup/style files. Bundled, offline, no npx (`detect.mjs` resolves `./detector/detect-antipatterns.mjs`). Honor `.impeccable/config.json`'s `detector.ignoreRules`, `ignoreFiles` **and `ignoreValues`** — this repo's one real entry (`--scrim`) is under **`ignoreValues`**, and `ignoreRules` is `[]`. Skip on ios/android surfaces.
5. **Rule drift** — recompute the per-rule fingerprints in `context/foundation/design-bindings.md`. A mismatch names the rule, the node id, **and whether that node is dormant**: *"The Accent-Is-A-Verb Rule changed, and [node:7c1a…] is dormant — reactivate, re-promote, then amend."* Report, never re-capture.
6. **Live residue** — no `impeccable-live-start` marker (`live/frameworks/tag-strategy.mjs:18`), no `data-p-*`, no unbaked `--p-*` in any tracked file under `context/design/`. A crashed live session leaves a session token in a git-tracked file.
7. **Citation tier** — every node id cited by a *live* deck that is still `short-term`/`mid-term`. These are the nodes the next archive will retire out from under a permanent deck.
8. **Desk provenance** — every node captured this change whose content carries `per desk <surface>#<id>`, listed with its thread id; plus the count of asks still `open` (neither answered nor declined) and the `asks.jsonl` diffstat.

**Banned at every gate, with reasons inline:** `impeccable doctor` (Tier 2; walks workspaces, shells out to git, and its own reference says it *repairs* persisted surface briefs); `impeccable document` (regenerates DESIGN.md **wholesale** — after gap 2 lands, a gate that ran it would silently invalidate every captured constraint node and every fingerprint row in one shot).

**Journal verbs** — `REVIEWED` is the default. `CONFIRMED` requires an executed check whose failure would have been detectable (`detect.mjs` reporting zero hits on the files a token constraint governs; a passing test). Looking at a rendered screen and judging it matches is `REVIEWED`. This gate fires on every PR; the existing rule at `SKILL.md:167-171` applies verbatim.

**PR block** (Part 2, mirroring the memory checklist and inheriting its *"Suggest, never resolve"* and *"An empty queue is a valid outcome"* clauses):

```markdown
## Design review (human gate)
Surface: gui-pmview-static-index-html · 3 screens agreed by this change, 3 built.
Drift: The Accent-Is-A-Verb Rule changed under [node:7c1a…] (live) — route to /gw-foundation.
Detector: 1 hit — raw #2f6fdb in style.css:212 (token --accent exists).
Unhonored constraints: none. Dormant citations skipped: 1 ([node:9f77…]).
Citations still short/mid-term on a live deck: 2 — promote or they go dormant at archive.
Live residue: clean.
Desk-sourced captures (UNVERIFIED input — check asks.jsonl in this diff):
  - [node:d41f2b] per desk gui-pmview-static-index-html#a3f19c2b
Asks carried into merge: 1 open (c07e1a44), 0 declined.
Open the prototypes: pmview → Design → gui-pmview-static-index-html
```

> **CORRECTION — the draft's PR line "pmview never resolves a flag" is FALSE and must not ship.** `app.js:508-536` renders a section literally headed **"Resolve review flag"** that POSTs to `/api/review/{id}/resolve`, and `:538-556` promotes tiers behind a confirm; the endpoint is proxied at `server.py:271-273`, listed in `gui/README.md:86`, and named in `PRODUCT.md:29`. The true statement, which is the one the lane actually guarantees:
>
> ```markdown
> Design questions are answered in pmview (127.0.0.1:8766). Memory flags and
> tiers are ruled in pmview's drawer or in agentic-memory-gui — both go through
> the same guarded write path at :8765, which folds trust and gates lifetime on
> human confirmation. No design route touches a flag, a tier, or the store.
> ```

Also, one append-only sub-step: **the `## Implemented` record goes into `context/foundation/design-bindings.md`, keyed by surface — not into the surface brief.** The draft used exactly the right argument to reject a DESIGN.md footer (*"we cannot ban the human from running `impeccable document`"*) and then failed to apply it to a file impeccable also regenerates. The surface brief gets a one-way courtesy re-publish; gw keeps its own copy.

### 5.9 `skills/gw-archive/SKILL.md`

Step 2 gains:
```
+ **Design residue — last call.** For every surface this change touched:
+ capture the token deviations accepted, the components the system gained, the
+ gap rulings, and any answered-but-uncaptured desk decision. Then hang EVERY
+ node id cited by a live deck for that surface onto the change-summary concept
+ with DEPENDS_ON — the trick gw-review/SKILL.md:109-112 already names ("so
+ recalling the summary pulls the specifics within reach even when they are
+ dormant"). NEVER CONSOLIDATES: the retrieval walker gives it policy weight 0,
+ so a design decision hung there goes dormant at the sweep and a recall silently
+ misses it months later.
```

Step 3's blast-radius check gains: *"a citation from a live `context/design/**/deck.json` counts as an active dependent."*

A new step 6b:
```
+ **Design residue report.** `context/design/` is a SIBLING of `context/changes/`
+ and is NOT moved. Report: N surfaces, M screens, K prototypes, the byte size,
+ and the path. Deleting a superseded surface directory is the human's call and
+ the human's command — agents cannot `rm`, and nothing here should try.
```

### 5.10 `skills/gw-foundation/SKILL.md`

Step 2's opening currently: *"Distill each document under `context/foundation/` into artifacts."* Becomes:
```
Distill each document under `context/foundation/`, PLUS the project's design
system where one exists (`DESIGN.md` and `.impeccable/design.json` at the repo
root), into artifacts…
```
plus a new bullet:
```
+ - The **design system** → run `bin/design_distill.py`, which reads
+   `.impeccable/design.json` and writes a review file to
+   `.gw-scratch/design-constraints.md`. YOU read that file and call
+   capture_artifact; the script never touches the graph. One `constraint`
+   (facets ["ui"], tier "mid-term") per `narrative.rules[]` entry — objects of
+   {name, body, section} — and per `narrative.donts[]` entry, WHICH ARE PLAIN
+   STRINGS, not objects. One `concept` for northStar + overview.
+   CAPTURE THE RULE AND THE TOKEN NAME, NEVER THE VALUE: `DESIGN.md` and
+   `design.json` are regenerated wholesale by `impeccable document`, so a node
+   holding `#2f6fdb` goes silently wrong with nothing in gw able to notice.
+   This repo yields ≈13 nodes (7 rules + 5 donts + 1 concept). BOUNDED — it does
+   not grow with the codebase.
```
and an exclusion, so the binding file is never itself distilled:
```
+ Files carrying a `<!-- gw:… -->` machine header are gw bookkeeping, never
+ distillation sources. `context/foundation/design-bindings.md` is one.
```

Step 3 gains: *"For design rules the source doc is regenerated wholesale, so reference back into the gw-owned `context/foundation/design-bindings.md` instead."*

Step 4 gains the honest cost:
```
+ ⚠ The design-system distillation is 13 lifetime-promotion candidates. Step 5
+ then runs `deactivate foundation --sweep`, which retires every one the human
+ did not promote. This is NOT free: without 13 human promotions, `impact_of`
+ never fires on a design rule and the fingerprint table points at dormant ids.
+ Print the unpromoted ids at the end of this pass, and print them again at the
+ next gate that runs. /gw-review Part 1b check 5 names dormancy explicitly.
```

### 5.11 `skills/gw-goal/SKILL.md`

Currently at `:61-62`: *"Two of the newer skills do not, and one does conditionally"*, and `:68`: *"**`/gw-domain`** and **`/gw-wireframe`** — never."*

Becomes: *"**Three** of the newer skills do not, and one does conditionally"* / *"**`/gw-domain`**, **`/gw-wireframe`** and **`/gw-prototype`** — never. All three are defined by a user in the loop (elicitation, per-screen review, per-screen visual ruling); running them unattended produces exactly the invented domain, one-shot UI and unruled design-system one-off they exist to prevent."*

### 5.12 `skills/gw-ask/SKILL.md`

Adds one bullet to Rules:
```
+ - **The desk is readable, never writable, from here.** /gw-ask may read
+   `context/design/<surface>/asks.jsonl` to ground an answer, and must cite the
+   thread id when it does. It may never post. The reason is AUTHORITY, matching
+   this skill's own framing: answering and capturing are different authorities,
+   and this skill has only the first — it is not inside a design session and has
+   no ruling to record. This is NOT a goal-mandatory-writes consequence; desk
+   lines carry no goal and need none (docs/DESK.md derives why).
```

### 5.13 `skills/gw-track/SKILL.md`

The three-surface table gains a fourth row, and the lifecycle-bindings table one line:

| Surface | Holds | Read by |
|---|---|---|
| `context/design/<surface>/` | **renderings** — what we agreed a screen looks like, keyed by surface | the human's browser, and the design gates |

*Ownership column: **never written by this skill.***

| **`/gw-review`** | Link the PR. One `comment` with the verdict, the memory-gate summary line, **and the design-gate line where the change names a `design_surface:`**. |

### 5.14 `skills/gw-fix/SKILL.md` — moved out of "Unchanged"

> **CONFIRMED MAJOR.** `gw-new/SKILL.md:118-120` routes defects and behaviour-preserving refactors to `/gw-fix` instead of `/gw-plan`, and `gw-fix/SKILL.md:167` goes straight to `/gw-review`. A UI defect therefore reaches the review gate with no deck read, no desk drain, and no `design_surface:` — so Part 1b never fires on the route most likely to silently break a wireframe decision.

Two sentences, in Step 1 (ground) and Step 8 (route):
```
+ Step 1: If any file the reproduction touches appears in some deck's
+ `screens[].implements`, name that surface, `desk.py drain` it, and write
+ `design_surface: <surface>` into change.md. Two lines of work; it is the
+ difference between the design gate firing and not.
+ Step 8: …the reviewer checks that a test exists which fails without the fix —
+ and, where change.md names a design_surface, Part 1b runs like any other change.
```

---

## 6. pmview changes

### 6.0 Prerequisite commits (Slice 0)

**A. `STORE_NAMES`.** `server.py:25` is `STORE_NAMES = ("memory-graph.db",)`. `.gitignore:16-18` deliberately tracks only the `.dump`. `graph.py` already reads both forms (it sniffs `_SQLITE_MAGIC`). One line:

```python
STORE_NAMES = ("memory-graph.db", "memory-graph.dump")
```

> **CONFIRMED MAJOR — the draft's headline claim was false and I re-measured it.** Baseline: `Ran 41 tests … FAILED (failures=2, errors=24)` = 26. With `STORE_NAMES` widened: `FAILED (failures=1, errors=24)` = **25**. It fixes exactly one test. 24 errors come from fixtures hardcoding `memory-graph.db` (`test_pmview.py:33, :38, :277`), and `:318` asserts `projects[0].store == COFFER/"context"/"memory-graph.db"` — the widening flips it from one wrong answer to another. Slice 0 is therefore **three edits**: widen `STORE_NAMES`; add
> ```python
> def store_path(root: Path) -> Path:
>     from pmview.server import Project
>     p = Project(root.name, root).store
>     if p is None: raise unittest.SkipTest(f"no store under {root}")
>     return p
> ```
> and repoint `load_board`, `DumpParsingTests.setUp`, `:318` (assert the *resolved* store, not a filename), `:389`, `:400`. **And add CI**: `.github/workflows/release.yml` is the only workflow and fires on `tags: ["v*"]`, so `test_writes_report_memory_unavailable_and_change_nothing` — the exact test the safety proof copies — has been erroring since the `.db` was gitignored and nothing noticed. A byte-identity proof nobody executes is not a proof.

**B. `do_POST` guard.** `_send` (`server.py:171-177`) sets only `Content-Type`/`Content-Length`; `do_POST` (`:255`) never checks `Content-Type` and `_payload` (`:188-195`) reads `Content-Length` bytes with no ceiling and swallows `JSONDecodeError` into `{}`. Today any page can `fetch('/api/nodes/<id>/tier', {method:'POST', headers:{'Content-Type':'text/plain'}, …})` as a simple request with no preflight. Before `payload = self._payload()`:

```python
MAX_BODY = 1 << 20   # 1 MiB

origin = self.headers.get("Origin")
if origin is None or origin not in self.server.allowed_origins:
    return self._error("POST requires a same-origin browser request", 403, code="bad_origin")
ctype = (self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
if ctype != "application/json":
    return self._error("POST body must be application/json", 415, code="bad_content_type")
try:
    length = int(self.headers.get("Content-Length") or -1)
except ValueError:
    length = -1
if length < 0:
    return self._error("Content-Length required", 411, code="length_required")
if length > MAX_BODY:
    return self._error("body too large", 413, code="too_large")
```

Note the polarity: **`origin is None` is rejected.** A browser `fetch` always sends `Origin` on POST; `curl` does not by default. This does not stop a determined local process, but it converts an accident into a deliberate act (§10).

`allowed_origins` is computed once in `build_server` from `server.server_address` — **never a literal**:

```python
host, port = server.server_address[:2]
spellings = {"127.0.0.1", "localhost"} if host in ("127.0.0.1", "localhost", "0.0.0.0", "::1") else {host}
server.allowed_origins = {f"http://{h}:{port}" for h in spellings}
server.origin_list = sorted(server.allowed_origins)   # used verbatim in the CSP
server.session_token = secrets.token_urlsafe(24)
server.loopback = host in ("127.0.0.1", "localhost", "::1")
```

> **CONFIRMED MAJOR — the bind address.** `PRODUCT.md:36` records `127.0.0.1` as a *user-confirmed binding constraint*, but `__main__.py:23` accepts any `--host`. After this lane a wrong `--host` would expose a filesystem reader and a file-append route. **The design routes are not registered at all when `server.loopback` is false** — pmview prints one line at boot saying so — and `<bind>` never enters `allowed_origins`.

**C. `_fingerprint` OSError safety.** `server.py:109-112` calls `p.stat()` on a `sorted(rglob(...))` snapshot inside a comprehension. A file deleted between the glob and the stat raises `FileNotFoundError` inside `do_GET`; `Handler` overrides `log_message` (`:167-169`) but **not** `handle_error`, so the human watching the terminal gets a 500 plus a traceback. `/gw-archive` `git mv`s change folders while pmview runs. Fix:

```python
def _mtime(p: Path):
    try: return p.stat().st_mtime_ns
    except OSError: return None
```

> **CONFIRMED MAJOR — §4.3's fingerprint widening is DELETED, not fixed.** The reviewer is right on both counts. *Useless:* `design.py`'s functions read decks, prototypes and asks straight off disk; `Board` holds no design data, so there is nothing design-related in the cached read model to invalidate. *Harmful:* `_fingerprint()` runs on **every** `board()` call (`server.py:121-128`, called at `:233` before every read route including debounced Search), so an `rglob` over the design tree plus a stat per file would land on the hot path — and every appended ask line would force a full `graph_mod.load(store)` + `lifecycle.scan()`, which is precisely the cost §6.2 cites as its reason for keeping the pulse out of `_proxy`. **No design fingerprint. Design reads are cheap and uncached.** `design_surfaces` rides in change.md, which the existing `*.md` walk already covers.

### 6.1 New module — `gui/pmview/design.py` (~220 LOC, stdlib only)

Imports: `json os re time hashlib mimetypes pathlib secrets`, optional `fcntl`. **It never imports `memory`, `graph` or `board`.**

```python
SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")   # surface, screen, filename ONLY
```

> **CONFIRMED MINOR — SLUG_RE is not applied to the project segment.** Project names come from `discover()` as the raw directory basename (`server.py:75-79`), which routinely carries dots (`site.com`). Every other endpoint accepts such a name via `?project=`. The project segment is resolved by **dict membership in `self.views`**, exactly as `_view()` does — a stronger guarantee than a regex, and it cannot escape a path because the resolved root comes from the `Project` object, not from the request.

| function | returns |
|---|---|
| `surfaces(project)` | `list[dict]` — scan `context/design/*/`, read each deck forgivingly, count screens/agreed/prototypes, fold `asks.jsonl` counts, verify `gw_slug(deck.target) == dirname` |
| `read_deck(path)` | `(deck, warnings)` |
| `read_asks(path, session=None)` | folds the log into threads; **state is derived, never stored** |
| `tail_pulse(path, since)` | seek `-64 KB`, split lines, count. No board rebuild, no deck parse |
| `append(path, lines)` | O_APPEND, one `write()` per line, ≤16 KB, `flush()` |
| `design_system(project)` | `.impeccable/design.json` narrative + `generatedAt`, the binding + fingerprint table, per-rule `stale` via `hashlib.sha256` |
| `presence(project, surface, *, stamp=False)` | read/write `.gw-scratch/design/<surface>.presence.json` **via `os.replace` on a `.tmp`**, read `<surface>.waiting.json` |
| `stylesheet_allowlist(project)` | exact paths parsed from `context/foundation/design-bindings.md`, resolved + bounded to `Project.root`, extension-filtered |
| `helper_origins(project, surface)` | read `port` from `<surface-dir>/.impeccable/live/inject-journal.json`, else `<Project.root>/.impeccable/live/inject-journal.json` |

> **CORRECTION — the helper port does not live in `.impeccable/live/server.json`.** That file **does not exist anywhere in impeccable** — verified by listing `.impeccable/live/` (`annotations config.json roots.json sessions`) and by grepping the scripts. The port is persisted by `recordInjection` into **`.impeccable/live/inject-journal.json`** (`live/frameworks/journal.mjs:33, :67-80`), which carries `{version, appRoot, framework, port, pid, recordedAt, artifacts}`. The reviewer reached the right conclusion (the read would always miss) by the wrong route.
>
> **CORRECTION — the helper origin is `localhost`, not `127.0.0.1`.** `live/frameworks/script-src.mjs:14` builds `'http://localhost:' + port + '/live.js'`. A CSP listing only `http://127.0.0.1:<port>` would block the helper script outright.

> **CONFIRMED MINOR — `presence.json` atomicity.** Written on a GET twelve times a minute per tab and read by `desk.py` as a gate. `os.replace` on a `.tmp`; and `desk.py` treats any read failure as **unknown** and arms the watcher anyway — a spurious watcher costs one timed-out background task, a spurious absence stalls a human at an open tab.

### 6.2 Routes

All design routes sit **outside `_proxy`** and touch no graph state. Two independent reasons, both from the code: `_proxy` (`server.py:197-209`) 503s when `:8765` is down — and answering a design question must work then, per `PRODUCT.md:53` principle 4 — and `_proxy` calls `view.invalidate()` on *every* project on *every* success.

| # | Method + path | Request | Response |
|---|---|---|---|
| 1 | `GET /api/design?project=` | — | `{project, surfaces:[{surface,target,binding,screens,agreed,prototypes,open_asks,declined,unacked_instructions,last_activity,changes[],warnings[]}], design_system:{present,generated_at,rules:[{name,section,node,fp,stale,dormant}],stale_rules}, nodes:[…ui-faceted…], contradictions:[…]}` |
| 2 | `GET /api/design/deck?project=&surface=` | — | `{surface, deck, warnings[]}` |
| 3 | `GET /api/design/asks?project=&surface=` | — | `{surface, lines, threads:[{id,state,ask,answers[],acks[],declines[],retires[]}], instructions:[{…,acked}], handoff\|null}` |
| 4 | `GET /api/design/pulse?project=&surface=&since=N&visible=1` | header `X-GW-Token` when `visible=1` | `{lines, open_asks, new_ids[], handoff:bool, agent_listening:bool}` |
| 5 | `POST /api/design/answers` | header `X-GW-Token`; `{project, surface, batch:[{kind,ask?,choice?,text?,screen?,region?,rect?,reason?}…]}` | `{appended, batch, lines:[…server-constructed…]}` |
| 6 | `GET /proto/<project>/<surface>/<path…>[?pin=1]` | — | the file's bytes + templated CSP |
| 7 | `GET /assets/<project>/<path…>` | — | an allowlisted project file + CSP-safe headers |

`/_gw/pin.js` is **not a route** — the file ships at `gui/pmview/static/_gw/pin.js` and the existing `_static` serves it, already blocks traversal, and already rides into the `.pyz`. (The draft declared a route *and* put the file in `static/`, which would have 404'd through the fallthrough at `server.py:215`.)

**Routing lines** — routes 6 and 7 must branch **before** the fallthrough at `server.py:215`:

```python
def do_GET(self) -> None:
    parsed = urlparse(self.path)
    path, query = parsed.path, parse_qs(parsed.query)

    if self.server.design_enabled:
        if m := re.fullmatch(r"/proto/([^/]+)/([^/]+)/(.+)", path):
            return self._proto(m.group(1), m.group(2), m.group(3), query)
        if m := re.fullmatch(r"/assets/([^/]+)/(.+)", path):
            return self._assets(m.group(1), m.group(2))

    if not path.startswith("/api/"):
        return self._static(path)
    ...
    view = self._view(query)
    if view is None:
        return self._error("no such project", 404)

    if self.server.design_enabled and path.startswith("/api/design"):
        return self._design_get(path, query, view)      # routes 1-4; NO board() call

    if path == "/api/project":
        return self._send(view.detail())
    board = view.board()
    ...

def do_POST(self) -> None:
    path = urlparse(self.path).path
    <the Slice-0 guard>
    if self.server.design_enabled and path == "/api/design/answers":
        return self._design_answers()                    # route 5; never _proxy
    payload = self._payload()
    ...  # the five existing proxied routes, unchanged
```

**Route 4 side effect.** With `visible=1` and a valid token, pmview stamps `<surface>.presence.json`. A deliberate impurity in a GET. Documented, not defended against: the entire consequence of a forged presence is that an agent enters `wait` when nobody is there and times out.

**Route 5 is a whitelist-construct, not a sanitize.** The handler never merges the request body into a line. It reads exactly `kind` (allowlisted to `answer | instruction | decline` — anything else is `400 bad_kind`), `ask`, `choice`, `text` (≤4000 chars), `reason` (≤500), `screen`, `region`, `rect`, and **constructs** the line itself, stamping `by:"human"`, `src:"pmview"`, a fresh 8-hex `id`, a UTC `ts` and one shared `batch` id. `batch` is capped at 50 entries. pmview is *physically incapable* of emitting an `ask`, `note`, `ack`, `handoff` or `retire`, or of forging `by:"agent"` — by construction, not convention.

**Body reading for design routes is separate from `_payload`.**

> **CONFIRMED MAJOR — the silent-200 batch loss.** `_payload()` returns `{}` on a missing `Content-Length` and swallows `JSONDecodeError` into `{}` (`server.py:188-195`), so a truncated body would yield `batch=[]` and a `200 {"appended": 0}` — the human sees a success toast and their five answers are gone, with no hole in the append-only log to notice later. Route 5 uses `_json_body()`: `411` on missing length, `413` over the cap, `400 bad_json` on a decode failure. **And the client asserts `appended === batch.length` before clearing staged state**, keeping the composer populated until it does.

### 6.3 The CSP — unconditional, templated, never subtractable

```
Content-Security-Policy:
  default-src 'none';
  script-src  <O…> [http://localhost:<helperPort> http://127.0.0.1:<helperPort>];
  style-src   <O…> 'unsafe-inline';
  img-src     <O…> data: blob:;
  font-src    <O…>;
  connect-src ['none' | http://localhost:<helperPort> http://127.0.0.1:<helperPort>];
  form-action 'none'; base-uri 'none'; object-src 'none';
  frame-ancestors <O…>
```

`<O…>` is `self.server.origin_list` — **every spelling pmview answers on, computed from `server.server_address`, never a literal.** Origins are written out in full and never `'self'`: a sandboxed document has an opaque origin and `'self'`-matching against it is undefined-to-failing across browsers.

> **CONFIRMED FATAL ×2 — the two origin bugs the draft shipped.** (a) It wrote `http://127.0.0.1:8766` literally into five directives while templating only the helper port, "because the port is not deterministic" — but pmview's port is a CLI flag (`__main__.py:24`), so `--port 9000` would have blocked the iframe via `frame-ancestors`, blocked `pin.js`, and rendered every prototype unstyled. (b) It listed one origin spelling while `allowed_origins` admits three; pmview serves the same bytes on both `127.0.0.1` and `localhost`, so a tab opened at `localhost:8766` would resolve a root-relative stylesheet to an origin the CSP does not list — **blank prototype on the URL half the users type.** Both are fixed by the same rule: **no origin in a header is ever a literal.**

`<helperPort>` comes from `design.helper_origins()` (§6.1). With no helper running, `script-src` carries only pmview's origins and `connect-src` is `'none'`. `style-src` keeps `'unsafe-inline'` because prototypes and live's variant injection both need it, and inline style cannot exfiltrate. `script-src` does **not** carry `'unsafe-inline'` — which is why the rung-2 contract bans inline `<script>`. If a prototype's on-disk file carries an injected live tag but no helper is running, the tag is blocked and pmview shows a banner saying so: a visible, correct failure instead of a silent hole.

**`?raw=1` does not exist.** Standing rule: **no query parameter may ever subtract a security header, and no origin in a CSP is ever a literal.** The only parameter is the *additive* `?pin=1`, which splices exactly one line before the **last** `</body>`:

```html
<script src="/_gw/pin.js" data-gw-surface="…" data-gw-screen="…"></script>
```

Used only by the Design tab's iframe. Everything else — the standalone tab, impeccable `live` — gets the file's bytes **verbatim**, which is what keeps live's own on-disk injection byte-exact.

### 6.4 `/proto/` and `/assets/` — the guards

```python
def _proto(self, project, surface, rest, query):
    view = self.views.get(project)                       # dict membership, not SLUG_RE
    if view is None: return self.send_error(404)
    if not SLUG_RE.fullmatch(surface): return self.send_error(404)
    parts = [p for p in rest.split("/") if p not in ("", ".")]
    if not parts or any(not SLUG_RE.fullmatch(p.replace(".", "-")) for p in parts):
        return self.send_error(404)
    root = (view.project.context / "design" / surface).resolve()
    target = (root / Path(*parts)).resolve()             # REAL symlink check
    if not target.is_relative_to(root) or not target.is_file():
        return self.send_error(404)
    if target.suffix.lower() not in PROTO_EXTS:          # .html .htm .css .js .svg .png .webp .woff2 .json
        return self.send_error(404)
    ...
```

> **CONFIRMED FATAL — `/proto/` is rooted at `context/design/<surface>/`, not `.../screens/`.** The draft put `tokens.css` and `assets/` one level above the served root and applied SLUG_RE to every path segment, so `../tokens.css` was killed by the design's own guard. Rooting at the surface directory makes siblings reachable while the `resolve()` + `is_relative_to()` check still bounds it. Prototypes are addressed as `/proto/<project>/<surface>/screens/<file>.html`.
>
> `_static` only needs a `..` rejection because a zip has no symlinks (`server.py:280-303`, reading from `resources.files("pmview")`); a filesystem route absolutely does need the real check.

```python
def _assets(self, project, rest):
    view = self.views.get(project)
    if view is None: return self.send_error(404)
    allow = design.stylesheet_allowlist(view.project)    # exact relative paths, pre-resolved
    if rest not in allow: return self.send_error(404)
    target = (view.project.root / rest).resolve()
    if not target.is_relative_to(view.project.root.resolve()) or not target.is_file():
        return self.send_error(404)
    ...  # Content-Type from mimetypes, X-Content-Type-Options: nosniff, the same CSP-safe headers
```

> **CONFIRMED FATAL — rung 2 was pmview-only.** The contract said *"style comes only from the project's shipping stylesheet or tokens.css"*, but `_static` serves `/style.css` out of package resources (`server.py:284-290`) — so **every non-pmview prototype was either unstyled or wearing pmview's tokens**, and the `tokens:` binding named a file with no transport. Copying the stylesheet into `context/design/` would duplicate token *values* into git, which §9 forbids and §13 refuses. `GET /assets/` closes it: an **exact allowlist** (not a prefix, not a regex) read from `context/foundation/design-bindings.md`:
>
> ```markdown
> ## Servable to prototypes
> stylesheet: src/styles/tokens.css
> stylesheet: src/app.css
> font: static/fonts/Inter-var.woff2
> ```
>
> `design.stylesheet_allowlist()` resolves each against `Project.root`, drops anything outside it or with a disallowed extension, and returns the surviving *relative* strings. Membership is a set lookup — nothing derived from the request path ever reaches a `join`. Its origins go into the prototype CSP's `style-src` and `font-src` (they are pmview's own origins, so no new entry is needed).

### 6.5 The Design view

`index.html` (+6 lines): `<button data-view="design">Design</button>` after Search; `<section id="view-design" class="view hidden"></section>` in `<main>`; `<meta name="gw-token" content="__GW_TOKEN__">`; `<link rel="icon" href="data:,">` swapped for a data-URI SVG the pulse can repaint. `_static` substitutes `__GW_TOKEN__` for `self.server.session_token` **on `index.html` only**. Tab machinery is fully data-driven (`showView` app.js:624-633 toggles on `data-view` / `id="view-<name>"`; `boot()` app.js:650-652 wires every `.tabs button`), so that is the whole cost.

`app.js` — **the one mandatory edit** is `:621`:

```js
const render = { board: renderBoard, issues: renderIssues, search: async () => {}, design: renderDesign }[state.view];
```

Layout — a three-pane `.design-split` grid in the main view area:

- **Left `.surface-rail`** — surfaces as `.item` rows with a screen count and an open-ask `.pill`; under the selected surface, its screens with a status dot (`draft` muted / `agreed` ok / `superseded` line-through).
- **Centre** — header `.row`: screen title, status pill, `agreed_by` pill, `Open in new tab`, `Schematic | Prototype` toggle. Then `.wire` (drawn by `wireFrame(frame)` in ~30 lines: a `position:relative` field with one absolutely-positioned `.wire-region` per region at percentage geometry, `.accent` modifier, `regions.slice(0,12)` — a direct port of `serve-question.mjs:525-541`) **or** `<iframe class="protoframe" sandbox="allow-scripts" src="/proto/…?pin=1">`. Below: `.row`s for the component map (gaps rendered in `warn`), the five states, and behavior; each `cites` entry as a `.pill.mono` chip.
- **Right `.ask-stack`** — every ask for the visible screen at once, collapsed to title + options, expanding in place. Each card carries a four-rung **media slot** that degrades: `proto` (iframe) > `comp` (`<img>`) > `wire` (the schematic) > text-only. Answers, instructions and declines stage locally; one `Send N` posts one batch.

**Drawer behaviour: unchanged.** `openDrawer` (app.js:275-290) shows `#drawer` over `#scrim`, i.e. it is modal — you cannot read a screen's cited constraints while looking at its prototype. So the Design lane lives in `<main>` and the drawer keeps its exact current role: a `cites` chip or a contradiction row calls the existing `openNode(id)`. Zero drawer changes, zero blast radius on the persisted width/dock chrome (`DESIGN.md` The Persisted-Chrome Rule).

**Notification, four escalating layers:**

1. The terminal always prints the deep link and the ask titles. This is the floor and it works with pmview closed.
2. `document.title` → `(2) Graph Workflow — Project Board`, a favicon dot, an amber count on the Design tab pill.
3. An opt-in `Notification`, one per unseen ask id, `tag` = the id so it dedupes. `http://127.0.0.1` is a secure context; permission is requested from a `Notify me` button in the Design tab header (user gesture required).
4. A banner when **`open_asks > 0 && !agent_listening`**: *no agent is listening — resume with `/gw-prototype --resume <surface>`*, with a copy button.

> **CONFIRMED MAJOR — the resume banner could not fire in the case it existed for.** The draft gated it on a `handoff` line, so a session killed mid-`wait` (SIGKILL, worktree removed, tmux socket reaped) wrote no `handoff`, left `waiting.json` on disk with nothing to clean it, and pmview reported "an agent is listening" forever — i.e. the banner appeared only when the agent exited cleanly. **`waiting.json` is a heartbeat, not a flag:** `desk.py wait` rewrites `{pid, ts}` every poll tick; `agent_listening` = `ts` fresh within 15 s; the banner is gated on open asks and no listener. A crash now surfaces identically to a clean handoff.

`pulse()` — `setInterval` at 5 s when `document.visibilityState === "visible"`, 30 s hidden, hitting only route 4. It also re-checks `/api/memory/status` so the badge stops lying after `:8765` starts.

**Why polling and not SSE.** SSE works on `ThreadingHTTPServer` and an open stream does not block `server_close()` (`daemon_threads=True`). Rejected anyway, on verified defaults: `protocol_version` is `HTTP/1.0` with no keep-alive, so a held stream permanently consumes one of the browser's ~6 connections per origin; `Handler.timeout` is `None` and threads are unbounded, so a stale tab holds a thread forever; and nothing wraps `wfile` writes, so closing a tab raises inside `do_GET` and prints a traceback into the terminal the human is watching (`log_message` is overridden at `:167-169`; `handle_error` is not). A bounded 64 KB tail read costs a `stat`.

`style.css` (+~70 lines). **Every value from the 40 existing `:root` tokens** (`style.css:1-52` — `--panel --line --radius --space-* --text-* --accent --warn --ok --danger`). Ask states map onto `warn` (open) / `accent` (answered) / `ok` (landed) / `--muted` (declined, retired) **plus a drawn 12 px SVG icon in the existing `EDGE_META` idiom — no fifth hue**, because The One-Hue-Per-Category Rule is a documented rule of this very design system (`DESIGN.md` §Don'ts), and the lane that exists to enforce the design system cannot be the one that breaks it.

### 6.6 `gui/pmview/static/_gw/pin.js` (~75 LOC)

On click, walk up to the nearest `[data-gw-region]`, compute a normalized rect from `getBoundingClientRect()` over the document box, and `postMessage({source:"gw-pin", type:"pick", screen, region, rect}, "*")`. On `{type:"highlight", region}`, outline that region.

The iframe is `sandbox="allow-scripts"` and deliberately **not** `allow-same-origin`, so the prototype runs at an opaque origin and cannot reach `/api/*`. Two mechanics that matter: the parent receives `event.origin === "null"` from an opaque-origin frame, so it validates with **`event.source === iframe.contentWindow`**, never by origin; and the parent→frame direction uses `targetOrigin: "*"`, safe because the payload is a region label and nothing else.

> **CONFIRMED MINOR — say what the check actually buys.** `pin.js` runs inside the prototype's own JS realm, so a prototype could override `postMessage` and emit any `{screen, region, rect}` it likes. `event.source === iframe.contentWindow` rules out *other frames and other tabs*, not the prototype itself. **The parent therefore treats `screen` and `region` as untrusted strings**: never used as deck lookup keys, never interpolated as HTML, always rendered via `textContent`. Bounded, because the parent owns every field and the payload is a label plus a rect.

`pin.js` renders **no input and holds no text.** The parent owns every field, composer and send — so the annotation UI is built from pmview's own components under its own class contract, and nothing the agent authored ever renders an input the human types into.

---

## 7. The protocol

### 7.1 The file

`context/design/<surface>/asks.jsonl` — UTF-8, one JSON object per line, `\n`-terminated, git-tracked, append-only. Nobody edits a line. Nobody deletes a line. **Eight kinds. There is no `seq` field.**

> **The sequence number is dead.** The draft allocated `seq` under an `fcntl.flock` — a lock in a server that has never had one, inside a package whose distributable is a cross-platform stdlib zipapp. Order is *line order in the file*; identity is `id`; the cursor is *"which ids appear in some `ack.refs` from this session"*, which the fold already derives. `flock` survives only as a courtesy:
> ```python
> try: import fcntl
> except ImportError: fcntl = None
> ```
> Correctness rests on the append: one `write()` of `json.dumps(line) + "\n"` on a handle opened `"a"` (O_APPEND), line ≤16 KB, then `flush()`. On a local POSIX filesystem O_APPEND makes the offset update atomic and Linux holds the inode lock for a single `write()` to a regular file, so lines never interleave. Two writers on two machines conflict as ordinary text, and `.gitattributes`'s `merge=union` concatenates both sides with no markers.

**Recovery — the stated escape hatch.** Append-only is a discipline, not a physical law. A corrupted or poisoned `asks.jsonl` is repaired by a **human** running `git checkout -- context/design/<surface>/asks.jsonl` (or editing it), and the repair is recorded as such in the change. `design.py` never truncates, never rewrites, never deletes. A malformed line is skipped with a warning row in the Design tab; one bad line never takes down the pane.

### 7.2 A real thread, on disk

```jsonl
{"ts":"2026-08-24T09:41:03Z","kind":"ask","id":"a3f19c2b","by":"agent","session":"s-91c2","change":"pmview-design-lane","goal":"66cd3d85-2920-4768-8953-4fd191446b5c","surface":"gui-pmview-static-index-html","screen":"design-tab","blocks":["design-tab"],"title":"Ask stack: third pane, or the modal drawer?","body":"Three asks per screen is typical. openDrawer shows #drawer over a full-viewport #scrim, so the drawer cannot show a prototype and its constraints at once.","options":[{"key":"A","label":"Third pane in the view area","cost":"~40 lines of layout the other tabs got free from the drawer"},{"key":"B","label":"Reuse the modal drawer","cost":"you cannot see the screen you are ruling on"}],"free_text":true,"risk":"B changes the blast radius of every existing drawer interaction","materials":["--panel","--line","--radius"],"palette":["--accent","--warn","--ok"],"media":{"kind":"wire","screen":"design-tab"},"cites":["node:c1a2f0","node:9f7731"]}
{"ts":"2026-08-24T09:44:10Z","kind":"note","id":"n1d07c33","by":"agent","session":"s-91c2","screen":"design-tab","text":"Published both branches: design-tab.html and design-tab--optB.html. Both are clickable."}
{"ts":"2026-08-24T09:47:55Z","kind":"instruction","id":"i2b8e330","by":"human","src":"pmview","surface":"gui-pmview-static-index-html","screen":"design-tab","region":"ask stack","rect":{"x":0.62,"y":0.18,"w":0.34,"h":0.66},"text":"open/answered/landed must not invent a fifth hue","batch":"b7d2c019"}
{"ts":"2026-08-24T09:50:12Z","kind":"answer","id":"n0c41a7f","by":"human","src":"pmview","ask":"a3f19c2b","choice":"A","text":"A. I need to read the constraint while I answer.","batch":"b7d2c019"}
{"ts":"2026-08-24T09:52:40Z","kind":"ack","id":"k5f0a911","by":"agent","session":"s-91c2","refs":["a3f19c2b","i2b8e330"],"disposition":"acted","captured":["node:d41f2b"],"text":"design-tab v3: third pane; states map to warn/accent/ok plus a drawn 12px icon"}
{"ts":"2026-08-24T10:05:00Z","kind":"retire","id":"r4c8b1e0","by":"agent","session":"s-91c2","refs":["c07e1a44"],"reason":"screen 4 was merged into screen 3; the question no longer has a subject"}
{"ts":"2026-08-24T10:12:31Z","kind":"decline","id":"d9a01f77","by":"human","src":"pmview","ask":"e11b2200","reason":"not deciding this now — ship the default","batch":"b8e10cc4"}
{"ts":"2026-08-24T10:31:02Z","kind":"handoff","id":"h8e21b40","by":"agent","session":"s-91c2","open":["e77c1a44"],"resume":"/gw-prototype --resume gui-pmview-static-index-html","text":"screens 2-3 done; screen 4 waits on e77c1a44"}
```

| kind | writer | meaning |
|---|---|---|
| `ask` | agent | a blocking question, with options and honest costs |
| `note` | agent | context that needs no answer |
| `ack` | agent | *I acted on these lines*; `disposition` ∈ `acted \| deferred \| contradicts \| declined` |
| `retire` | agent | **NEW** — this ask no longer has a subject |
| `handoff` | agent | I am ending my turn with these still open |
| `answer` | pmview only | resolves an ask |
| `instruction` | pmview only | unsolicited direction, optionally pinned to a region |
| `decline` | pmview only | **NEW** — *I am not deciding this*; the desk's `defer` |

> **CONFIRMED MAJOR — `retire`.** The draft declared *"state is derived, never stored… there is no status field to desync"* and then prescribed the stale-ask remedy as *"the agent appends a `note` superseding it"*. A `note` participates in no fold, so a superseded ask stayed `open` forever, the human could answer a dead question, and the resulting `answer` referenced a screen that no longer existed. `retire` is still append-only and still derived — the design just forgot to define the line kind its own rule required.
>
> **CONFIRMED MINOR — `decline`.** `/gw-resolve` is already a joint human-ruling queue and its five-action vocabulary includes **`defer`** (*"genuinely undecidable now; stays queued"*). The desk had no way for a human to say *"not deciding this"*, so §7.5's *"stays open forever"* meant every later gate reported a count that could never clear. `decline` is writable only by pmview under the same construct-don't-copy rule. An ask with a `decline` stops counting as open and the agent proceeds with its stated fallback.

Caps: `text` ≤ 4000, `reason` ≤ 500, ask `body` ≤ 2000, `options` ≤ 5, line ≤ 16 KB, `batch` ≤ 50 entries, request body ≤ 1 MiB. Ids are 8 lowercase hex.

### 7.3 Derived state — and the per-session cursor

Nothing is stored. For a consumer session `S`:

```
delivered(L, S)  ⇔  ∃ ack A : A.by=="agent" ∧ A.session==S ∧ L.id ∈ A.refs
ask.state        =  retired   if ∃ retire R : ask.id ∈ R.refs
                    declined  if ∃ decline D : D.ask == ask.id
                    landed    if ∃ ack A : A.session == ask.session ∧ ask.id ∈ A.refs
                    answered  if ∃ answer  : answer.ask == ask.id
                    open      otherwise
drain(S)         =  every answer/instruction/decline line with ¬delivered(L, S),
                    in file order
```

> **CONFIRMED MAJOR — the cursor is per-session, not global.** The draft defined `drain` as *"unacked human lines"* with no session scoping, even though `ack` already carries `session`. Agent B acking an answer to agent A's ask would make that answer **invisible** to A's next drain and to the `wait` A had already launched: A times out or writes a handoff reporting its own ask still open, having never seen the reply. The draft's §5.6 claimed *"`ack.refs` make double-work visible"* — the real failure was the inverse. The global count stays, for the UI badge; it never gates delivery.

### 7.4 `skills/gw-desk/bin/desk.py` (~230 LOC, stdlib: `json os re sys time argparse hashlib pathlib`, optional `fcntl`)

```
desk.py post     --surface S --change C --file ask.json   → appends; prints deep link + {"human_present": bool}
desk.py drain    --surface S [--session ID]               → prints undelivered human lines as JSON; APPENDS NOTHING
desk.py wait     --surface S [--timeout 900]              → heartbeat waiting.json every 2s, poll st_mtime_ns, then behave as drain
desk.py ack      --refs a,b --disposition acted --text …  → appends AFTER the agent has acted
desk.py retire   --refs a --reason "…"
desk.py note     --screen S --text …
desk.py handoff  --open a,b --resume "…" --text …
desk.py status   --surface S                              → counts, presence, last agent kind
```

`--session` defaults to `$GW_SESSION` else a stable hash of the change-id + the surface — so a session id always exists.

> **`drain --change` is deleted.** The draft advertised it, but pmview constructs human lines carrying exactly `kind, ask, choice, text, reason, screen, region, rect` plus `by/src/id/ts/batch` — **no `change`**. Implemented literally the filter drops every human line; implemented loosely it is a no-op flag that reads as a guarantee. Change-scoping is available through the ask (`answer.ask → ask.change`) and `desk.py status` reports it; `drain` is surface-scoped and delivers instructions, which reference no ask, unconditionally.

**Exit codes, copied from `serve-question.mjs`** so the mental model transfers and a future surface swap needs no skill edits:

- **0** — one or more undelivered human lines, printed as a JSON array on stdout.
- **2** — the log is unreadable or the surface directory is gone.
- **3** — nothing waiting / timed out.
- **4** — nobody is listening: presence was fresh at start and has gone stale past 120 s, or a `handoff` is already the last agent line.

**`drain` never acks.** The ack is a separate call the agent makes *after* it has acted. That ordering is the crash-safety story: a session that dies between reading and acting re-delivers on the next drain — impeccable live's own *"the journal is canonical and replays unacknowledged work"* semantics, adopted deliberately.

> **CONFIRMED MAJOR — ack-after-act duplicates graph nodes, and the fix is required, not optional.** A crash between `capture_artifact` and `ack` re-delivers the same answer, and the memory surface has no idempotency key and no dedup — so the crash-safe ordering trades a lost answer for a duplicated goal-bound `decision` node that later goes dormant and reappears as two conflicting rulings of one question. **The rule, stated in `docs/DESK.md` and in every skill that acts on a drain:** the thread id is *already* in the captured node's content as provenance (`per desk <surface>#<id>`), so **before capturing in response to a redelivered line, `recall_context(query="per desk <surface>#<id>", goal_ref=…)`; on a hit, ack instead of capture.** This is the one place the crash-safe ordering collides with an append-only graph, and it is named.

### 7.5 How the agent learns — three modes, all turn boundaries

**Mode 1 — drain at gate (always, mandatory).** Every phase's ground step runs `desk.py drain`. It reads a file, so it works with pmview stopped, `:8765` stopped, on another machine, in another harness. This is the only mode a non-Claude-Code harness needs, and it is the same pull-at-defined-gates shape `/gw-track` already uses.

**Mode 2 — presence-gated background wake (the default when the human is there).** The agent posts its asks; `post` reports `human_present` (presence stamped within 120 s). If true — **or if presence is unreadable** — the agent launches `desk.py wait --surface S --timeout 900` as a **background Bash task** and **ends its turn immediately**. When the watcher exits, the harness re-invokes the agent with the answers in hand. The agent never blocks mid-turn, never holds a connection, never carries in-memory waiting state.

> **Both honest framings go in the docs, side by side.** *(a)* **pmview cannot start or wake a process.** It writes a file and nothing else. *(b)* **A background poll that wakes an agent is still a turn boundary — it just moves the keystroke from a terminal to a browser.** What resumes the agent is a watcher *the agent itself launched inside its own turn* before ending it, plus the harness's own contract that a backgrounded command "keeps running across turns and re-invokes you when it exits." gw's invariant has always been *every human gate is a turn boundary*, never *every gate is a keystroke* — so this adds no new runtime state. It is harness-shaped: other harnesses degrade to Mode 1, and the README says so rather than implying universality.

**Mode 3 — cold resume.** A brand-new session's Step 0 is `drain`, which replays every undelivered human line in order, reports what it replayed, and continues.

**What the agent does meanwhile — the ladder, in order.** (a) Work the next screen with no dependency on an open ask; `depends_on` and `blocks[]` make that mechanical. (b) Do the non-blocking half of the blocked screen — states, component map, constraints cited; an ask usually blocks one region, not a screen. (c) **Prepare both branches** when `options ≤ 3` and the ask carries a media slot, so the answer is one click on something already visible. (d) Out of independent work → `handoff`, one batched `append_events`, a terminal report, end the turn. **Never guess.**

### 7.6 Failure modes, each with a defined behaviour

| | behaviour |
|---|---|
| Human never answers | the ask stays `open`; every later gate reports the count; `/gw-plan` **refuses**; `/gw-review` reports it in the PR block |
| Human decides not to decide | `decline` — stops counting as open, agent proceeds with its stated fallback |
| Human answers after the session died | the append succeeds with no coordination; the banner fires on `open && !agent_listening`; the next drain replays it |
| Agent dies after reading, before acking | re-delivered; **the recall-by-thread-id dedup in §7.4 prevents the duplicate capture** |
| Agent killed mid-`wait` | `waiting.json` goes stale in 15 s; banner fires |
| pmview not running | terminal path is complete; the human answers in chat; the skill writes the `answer` line so the audit trail has no hole |
| Memory server down | answering works; only capture is blocked, and it queues to `memory-backlog.md` exactly as the existing degraded-mode rule prescribes |
| Two agents on one surface | both append; per-session cursors keep each one's deliveries intact; `ack.refs` make double-work visible |
| Stale ask | `retire`; the fold moves it to `retired` and the stack greys it |
| Malformed line | skipped with a warning row |
| Poisoned log | human `git checkout`; recorded as such |

### 7.7 An instruction that contradicts settled knowledge

Before acting on any instruction touching a surface with settled `ui` constraints, the agent runs `impact_of` on the cited and nearby nodes. On a hit it may neither silently comply nor refuse:

1. `capture_artifact(content=…, type="decision", goal_ref=<memory_goal>, facets=["ui"])` recording the ruling, with the desk thread id quoted in the content as provenance.
2. `link(source=<that decision>, target=<the constraint>, type="CONTRADICTS")`.
3. Append an `ack` with `disposition:"contradicts"`, naming both sides and the captured node id.
4. **Stop before applying.**

It does not retire, archive or lower the trust of the superseded constraint. `CONTRADICTS` raises the review flag; the human rules via `/gw-resolve` or the drawer/GUI at `:8765`. pmview helps for free: `Board.contradictions()` over the `ui`-faceted set is already implemented and already rendered, so the human reads the constraint they are about to override *while* they type the override.

The same authority rule, borrowed verbatim from `/gw-track`, governs the softer case: **an instruction about a screen already `agreed` is a finding, not a silent re-do.** Show both sides; let the human rule.

---

## 8. The mockup preview mechanism

### 8.1 Serving — the unlock

`_static` reads from `resources.files("pmview")`, which lives inside the wheel/zipapp — an on-disk script tag injected by impeccable could never reach the browser from `dist/pmview.pyz`. Reading the *project's* directory is ordinary `pathlib` on `Project.root`, a real path in source, wheel and zipapp alike. **`scripts/build.py` needs no change**: `build_pyz` `copytree`s the whole package (`:52`) and nothing new is written into it.

### 8.2 impeccable `live` against a prototype — what actually works

> **CONFIRMED FATAL — "one glob line, zero pmview code, zero skill code" is false for every real project here.** Verified in the source: `resolveRoots` walks up from the *target* to the nearest directory carrying a dev-config marker (`live/roots.mjs:42, :81, :193`); a prototype under `dogfood/coffer/context/design/…` therefore resolves appRoot to `dogfood/coffer` (both `svelte.config.js` and `vite.config.ts` are present — verified by `ls`). `resolveFramework` returns `sveltekit`, first in priority order (`live/frameworks/index.mjs:51-59`), whose `inject.kind === 'adapter'` (`live/frameworks/sveltekit.mjs:25-26`); the adapter branch (`live-inject.mjs:239-259`) returns **before** `resolvedFiles.map` at `:261` and never reads `config.files`. The glob is inert.
>
> **CONFIRMED FATAL — an unpinned `live-wrap` can splice a variant into the real app.** `findFileWithQuery` → `findSourceFile` walks the whole appRoot skipping only `node_modules`, `.git`, `.impeccable` and generated files, and returns the **first** match (`live-wrap.mjs:718-735`). Rung-2 rule 4 mandates the project's real class names, so a pick on `.item` can resolve to `gui/pmview/static/index.html`.
>
> **CONFIRMED MAJOR — a repo-wide glob dirties every prototype in the repo with a session token.** `resolveFiles` expands globs over every match (`live-inject.mjs:355-403`) and the injection maps over all of them (`:261-284`), embedding `?token=<state.token>` (`live/frameworks/script-src.mjs:14-16`). `--remove` only runs on clean teardown, and prototypes are git-tracked non-negotiably.

**All three are fixed by the same mechanism, and it is skill code, not one line.** `/gw-prototype --live <screen>` writes a **per-surface** live config and re-points impeccable's own root resolution at the design directory:

```
context/design/<surface>/.impeccable/live/config.json
  { "files": ["screens/<screen>.html"],
    "insertBefore": "</body>", "commentSyntax": "html", "cspChecked": true }
```

This works because `isAppRoot(dir)` returns true for *any* directory carrying `.impeccable/live/config.json` (`live/roots.mjs:81-85`, comment: *"A directory already configured for live IS an app root, dev config or not"*), and `walkUp` starts at the target's directory and stops at the first hit (`:193`). So:

- appRoot = `context/design/<surface>/` → `resolveFramework` finds no dev config → **`staticHtml`, `inject.kind === 'tag'`** → `config.files` is honoured.
- The `files` list names **one screen**, so injection touches one file; nothing else in the repo is dirtied.
- `findSourceFile`'s walk is confined to `context/design/<surface>/`, so **`live-wrap` physically cannot reach the real app.** `/gw-prototype` still passes `--file screens/<screen>.html` on every wrap call, and the skill states that an unpinned wrap in this lane is a defect.
- `ensureLiveGitIgnores` prefers `.git/info/exclude` over a `.gitignore` (`live-inject.mjs:298-299` → `resolveIgnoreTarget`), so **no `.gitignore` is dropped into the tracked design tree**. Repo-level `.gitignore` gains `.impeccable/live/inject-journal.json` for the same reason.
- The helper port is read by pmview from `context/design/<surface>/.impeccable/live/inject-journal.json` (§6.1).

**Costs, stated:** a `.impeccable/live/` subtree appears inside `context/design/<surface>/` for the duration of the session; `/gw-prototype`'s cleanup step runs `live-inject.mjs --remove`, deletes the per-surface config, and reports `git status --porcelain context/design/` — a non-empty result is a teardown failure, not a warning. Switching surfaces at one origin clears the overlay's saved session (guarded by `window.__IMPECCABLE_APP_ROOT__`); that is accepted, because the alternative (repo-root appRoot) does not work at all for adapter frameworks. `PRODUCT.md`/`DESIGN.md` still resolve upward to the git root (`live/roots.mjs:228-234`), so a `dogfood/coffer` prototype loads graph-workflow's design context — `/gw-prototype` prints which pair it resolved, and §13 records this as a limitation.

The prototype is opened in **its own top-level tab** for a live session, never iframed — the sandbox's opaque origin would break `isLoopbackOrigin` and localStorage. Over SSH that needs two forwarded ports: 8766 and the resolved `8400+N`, which `/gw-prototype` prints from the inject journal.

**Budget: one carbonize turn per accept.** `live-complete.mjs` refuses with `source_dirty` until markers, `data-p-*` attributes and unbaked `--p-*` vars are gone. `/gw-prototype` states this and routes behavioural / state-machine / single-exact-value changes away from live entirely — both existing pmview live sessions ended in `agent_error` (`.impeccable/live/sessions/bf1ab8f2.snapshot.json` → `phase: "agent_error"`, and `35450909` likewise).

### 8.3 Degradation

| missing | what still works |
|---|---|
| impeccable not vendored | Everything except variant generation. The prototype is written, served, clickable, pinnable; asks + region pins are the loop. `/gw-prototype` skips `context.mjs`, `surface-brief.mjs` and `live` with a named skip line each. |
| appRoot is an adapter framework and the per-surface config cannot be written | live is skipped with a named reason; rungs 0–2 unaffected |
| pmview not running | the terminal prints the deep link and the ask titles; the human answers in chat; the skill writes the `answer` line so the log stays complete |
| memory server down | reads, decks, prototypes, asks, answers, declines all work. Only capture is blocked, and it queues to `memory-backlog.md` |
| no design system (`design: none`) | the lane stops at rung 1. Wireframes only — there is nothing to render a prototype *in*, and inventing a look is exactly the decision this lane refuses to make for the user |
| no stylesheet in the `/assets/` allowlist | rung 2 is refused with a named reason. **Not** silently unstyled, and **not** a copied `tokens.css` |
| `context/design/` unwritable | the whole lane is skipped with a warning; the workflow is exactly what it is today |

---

## 9. Graph bindings

No new node type, no new edge type, no new event verb, **no new facet**. `ui` already exists in the controlled vocabulary with real nodes in the committed dump; a `design`/`tokens`/`visual` near-synonym would trigger `facet_warnings` and split the graph.

> **CONFIRMED MINOR — `content=`, not `body=`.** `capture_artifact`'s required args are `["content", "type", "goal_ref"]`; there is no `body` property. `gw-wireframe/SKILL.md:157-162` already gets this right. Every edge example also carries `direction`, which the draft omitted. Corrected throughout below.

### 9.1 Calls, by gate

**`/gw-wireframe` Step 1 (ground):**
```python
recall_context(query="<the UI surface> screens layout states", goal_ref=<goal_node_id>)
domain_model(status="confirmed")
```

**Step 2 (binding) — recall first:**
```python
recall_context(query="design system tokens components rules",
               goal_ref=<goal_node_id>)     # filter to type="constraint", facet "ui"
```
then, when impeccable is vendored, `node <skill-base-dir>/scripts/context.mjs --target <primary-target>`.

**Step 5 / `/gw-prototype` Step 7 (capture) — one batched pass:**
```python
capture_artifact(
    content="Review screen classifies inline in the table via a per-row Select, "
            "rather than a modal per transaction: the common case is bulk triage "
            "of 20+ rows. (per desk gui-pmview-static-index-html#a3f19c2b)",
    type="decision", goal_ref=<memory_goal>, tier="short-term",
    facets=["ui"],
    edges=[{"target": "<transaction-entity-id>", "type": "ABOUT", "direction": "out"}])

capture_artifact(
    content="Every screen renders an explicit empty state; a zero-row table must "
            "never render as a bare header.",
    type="constraint", goal_ref=<memory_goal>, facets=["ui"],
    edges=[{"target": "<the decision id>", "type": "DEPENDS_ON", "direction": "out"}])

link(source="<override decision>", target="<the constraint>", type="CONTRADICTS")  # override case only

append_events([...])   # USED per recalled constraint the screen honored,
                       # NOTED per instruction acted on, REVIEWED per screen judged
```

Plus the one-way courtesy publish (§5.3). **Never a gw key in the brief frontmatter. Never a design token *value* in a node content or a brief; cite the token by name.**

**Before acting on an instruction:** `impact_of(<cited and nearby node ids>)` (§7.7).
**On a redelivered line:** `recall_context(query="per desk <surface>#<id>", goal_ref=…)` before capturing (§7.4).

**`/gw-archive`:** last-call `capture_artifact` for design residue, and:
```python
# Every node id cited by a LIVE deck for a surface this change touched:
link(source="<change-summary concept>", target="<cited node>",
     type="DEPENDS_ON")            # NEVER CONSOLIDATES — policy weight 0 at the walker
```

> **CONFIRMED MAJOR — the deck is permanent but the knowledge it cites is swept.** Wireframe/prototype decisions are captured with the change's `memory_goal` at short/mid-term, and `/gw-archive` step 4 runs `memory_lifecycle.py deactivate <change-id> --sweep` (`gw-archive/SKILL.md:40-49`), which retires un-promoted short/mid-term detail from retrieval. Meanwhile `deck.json.screens[].cites` lives forever and Part 1b check 3 keeps asserting against it. The draft's *"delete the whole directory and nothing is lost but pixels"* was inverted: **the pixels were the durable half and the knowledge was the half that decayed.** Three fixes, all reads-and-reports so the safety invariant is untouched: the `DEPENDS_ON` hang above (the trick `gw-review/SKILL.md:109-112` already names); Part 1b check 3 emits a **named skip** for a dormant citation instead of an unhonored-constraint finding; and Part 1b check 7 reports every live-deck citation still at short/mid-term **before** the archive, so the promotion happens while it is cheap.

### 9.2 Design tokens as graph citizens (gap 2)

`/gw-foundation` gains one distillation source, riding the existing distillation → reference-back → human-promotion ladder with **no new machinery**:

- Each `.impeccable/design.json` `narrative.rules[]` entry — `{name, body, section}` — becomes one `constraint`, `facets:["ui"]`, `tier:"mid-term"`, content `"<name>. <body> (DESIGN.md §<section>)"`.
- Each `narrative.donts[]` entry — **a plain string, not an object** (verified) — becomes one `constraint`, content = the string, section `"donts"`.
- `narrative.northStar` + `overview` → one `concept` for the visual world.

Verified counts for this repo: **7 rules + 5 donts + 1 concept ≈ 13 nodes. Bounded — it does not grow with the codebase.** One batched pass, `goal_ref` = the foundation scope's `memory_goal` recovered from `context/foundation/foundation.md` (`gw-foundation/SKILL.md:26-28`) — written explicitly into every example so nobody is left to infer it.

**Capture the rule and the token NAME, never the value.** A node saying *"the accent is a verb — `--accent` appears only on something interactive or selected"* survives a repalette and still fires `impact_of` on a proposed decorative blue; a node holding `#2f6fdb` goes silently wrong.

`skills/gw-foundation/bin/design_distill.py` (~95 LOC, stdlib) reads `design.json` and writes a review file to `.gw-scratch/design-constraints.md`. The **agent** reads it and calls `capture_artifact`; the script never touches the graph.

**Reference-back and the per-rule fingerprint** go into the **gw-owned** `context/foundation/design-bindings.md`:

```markdown
<!-- gw:design-nodes captured=2026-08-24 design_json_generated_at=2026-08-14T00:00:00Z -->
| rule                       | node          | fp              | promoted |
|----------------------------|---------------|-----------------|----------|
| The Accent-Is-A-Verb Rule  | [node:7c1a…]  | fp:9b21e0c4aa73 | yes      |
| The One-Hue-Per-Category…  | [node:7c1b…]  | fp:41f7c0d9ee02 | no ⚠     |
```

`fp` = first 12 hex of `sha256(rule.body)`. **Per-rule, so the finding is *"The Accent-Is-A-Verb Rule changed under [node:7c1a…]"* rather than *"something in DESIGN.md moved"*** — a drift check that cannot name the drifted thing is ignored by the third PR. And it is **not** a DESIGN.md footer: we can ban `impeccable document` from every gate but we cannot ban the human from running it, and a footer in a file impeccable regenerates is guaranteed to be destroyed eventually.

**Before distilling: dedupe `DESIGN.md`'s duplicated Do's/Don'ts block** (verified duplicate at `:236/:245` vs `:254/:261`), or the duplicate ships into the graph.

**Also, before the first surface brief or prototype:** set `"buildPath": "code"` in `.impeccable/config.json`. `DIRECTION_WORK_PATHS` is exactly `.impeccable/surfaces` + `.impeccable/mocks/decision`, so an unset `buildPath` starts emitting `config-build-path-unset` at every impeccable boot forever. **Never a gw key in that file** — `KNOWN_CONFIG_KEYS` is a closed set and anything else is reported as drift permanently.

---

## 10. Safety analysis, clause by clause

> *"Nothing an agent can call mutates trust, clears a review flag, promotes a tier, archives a node, ratifies a domain entity, or commits a consolidation."*

- **Mutates trust** — nothing in the lane writes trust. Journal calls are `append_events` with `USED / NOTED / REVIEWED`, and `CONFIRMED` only behind an executed check.
- **Clears a review flag** — Part 1b is read-and-report. A `CONTRADICTS` edge *raises* a flag; nothing in the lane clears one. **No design route touches `/api/review/<id>/resolve`, and a test asserts that no handler matched by `/api/design/`, `/proto/` or `/assets/` reaches `self.memory`.** (pmview's *drawer* does offer resolution, through the guarded proxy — see the §5.8 correction.)
- **Promotes a tier** — design constraints are captured at short/mid-term. Lifetime promotion is the memory server's human-only action.
- **Archives a node** — nothing archives. The residue step is a *report with counts and a path*, and agents cannot `rm`.
- **Ratifies a domain entity** — the lane captures decisions and constraints, never entities.
- **Commits a consolidation** — untouched. The lane's only interaction is the §9.1 prohibition against `CONSOLIDATES`.

### The one-write-path rule, and the one file-write route

Every graph mutation still leaves pmview through `memory.py` → `MemoryAPI` → `127.0.0.1:8765`. The five existing POST routes are unchanged and the count does not grow. The lane adds **one** file-write route, provably not a graph route:

- `design.py` imports `json os re time hashlib mimetypes pathlib secrets` (+ optional `fcntl`). It never imports `memory`, `graph` or `board`.
- The design routes never touch `self.memory` and never call `_proxy`.
- pmview may write exactly one filename shape — `<Project.root>/context/design/<surface>/asks.jsonl`, append-only — plus two heartbeat files under the already-gitignored `.gw-scratch/design/`. It cannot reach `context/changes/`, `context/archive/`, or the store. The `/proto/` and `/assets/` extension allowlists exclude `.db` and `.dump`.
- **Executable proof**, copying `test_writes_report_memory_unavailable_and_change_nothing` (`test_pmview.py:388-402`): after a full desk-and-prototype exercise with the memory URL pointed at a dead port, the store file is byte-identical and every graph write still returns 503 `memory_unavailable`.

### Authority — the honest account

> **CONFIRMED FATAL, with its overreach corrected.** The reviewer is right that `POST /api/design/answers` mints `by:"human"` provenance for any local process, and that the draft's celebration of route 5 as *"physically incapable of forging `by:"agent"`"* had the polarity backwards — **the dangerous direction is forging a human.** The draft's guard (`if origin and origin not in allowed`) passed a bare `curl`, and `pulse?visible=1` was equally forgeable, so `desk.py post` could be made to report `human_present: true` on demand.
>
> The overreach: *"§8's 'Every ruling ends at a person' is provably false."* What is false is that **the desk authenticates the human**. What remains true is that **no desk line mutates the graph**: a ruling still requires an agent to call `capture_artifact` with a `goal_ref` through `:8765`, and that node lands in a PR a human reviews.

**What is enforced.** Origin required and matched (missing Origin is rejected); `Content-Type: application/json`; `Content-Length` present and ≤ 1 MiB; a per-boot `X-GW-Token` that only a client which fetched the served `index.html` can hold; `batch` ≤ 50; the three-kind allowlist; construct-don't-copy.

**What is not, and cannot be.** No local-only mechanism can authenticate a human against an agent running on the same machine — the agent can read the token from `curl 127.0.0.1:8766/`, or skip pmview and `>> asks.jsonl`. The guard converts an **accident** into a **deliberate act**, and deliberate acts are what review catches.

**What actually carries the guarantee — three things, all structural:**

1. **`asks.jsonl` is git-tracked.** A forged answer is a line in the PR diff, reviewed at the same trust level as `app.js`.
2. **Provenance is mandatory and surfaced.** Every capture derived from a desk line carries `per desk <surface>#<id>` in its content, and Part 1b lists every such node in the PR block under the heading **"Desk-sourced captures (UNVERIFIED input — check asks.jsonl in this diff)"**.
3. **The vocabulary is constrained.** The agent may never write *"the human approved X"*; it writes *"desk thread `<id>` answered X"*. A watcher wake is never reported as equivalent to a human turn.

### The three new trust surfaces, named and bounded

1. **`GET /proto/` and `GET /assets/` serve the project's filesystem.** Mitigations: dict-membership on the project; `SLUG_RE` on surface and every path segment; `resolve()` + `is_relative_to()` (a **real** symlink check, which `_static` does not need because a zip has no symlinks); an extension allowlist; an **exact** path allowlist for `/assets/`; `nosniff`. Scope is one directory per surface plus a handful of named files. **Design routes are not registered at all on a non-loopback bind.**
2. **Agent-authored HTML in the human's browser.** Layered: `sandbox="allow-scripts"` without `allow-same-origin` (opaque origin — cannot reach `/api/*`); an unconditional templated CSP with `default-src 'none'`, `connect-src 'none'` when no helper runs, `form-action 'none'`, and no `'unsafe-inline'` in `script-src`, in **both** the embedded and the standalone case; the rung-2 contract banning `fetch`, storage and external URLs. Behind all of it, the `do_POST` guard. Residual risk is bounded by prototypes being git-tracked and PR-reviewed.
3. **A human instruction file an agent acts on.** Mitigated by the ownership table enforced in code, by the provenance rules above, and by the rule that an instruction is an input to a human-gated turn, never an autonomous trigger: the agent reads at a gate, reports what it read, and acts inside a turn a human started or a watcher it launched before ending its turn. An instruction cannot name a node id that gets mutated, carry a tier, or clear a flag.

### Why an answer is not a graph write (verbatim in `docs/DESK.md`)

`capture_artifact` requires a `goal_ref`. A human typing *"the accent is too loud"* has no goal in hand and may not even have a change open. Three ways to reconcile that: **(a)** fabricate a `goal_ref`; **(b)** refuse the instruction; **(c)** recognise the instruction is not knowledge.

**(a) is how the goal-mandatory commitment dies** — once one surface fabricates goals to satisfy a schema, the schema stops meaning anything. **(b)** fails the user's ask. **(c)** is correct, and it is the argument `/gw-track` already won: a tracker holds work-state that is real, useful, and deliberately not in the graph. An instruction is a *request*; it becomes knowledge only when an agent, inside a change with a `memory_goal`, rules on it and captures a `decision` through the normal path. The human's words are then **provenance quoted in the node content** — a string, not an edge, not a facet, not a vocabulary change.

> This paragraph exists to stop the next contributor "improving" the design by routing answers through `:8765` as `type:issue` nodes — which would make answering a design question fail whenever the memory server is down, and would put conversation on the trust ladder.

### The three-surface rule becomes four, deliberately

> **CONFIRMED MAJOR.** *"Three surfaces, three jobs"* appears in `README.md:34`, `CLAUDE.md.txt:71-75`, and as the table opening `gw-track/SKILL.md:8-16`. `context/design/` is none of the three. Every agent that pastes `CLAUDE.md.txt` would read a three-surface rule and meet a directory that is not one of them. **It becomes four, in all three places**, with the fourth's job stated as narrowly as the others: *`context/design/` holds **renderings** — what we agreed a screen looks like — keyed by surface, holding no knowledge, deletable without loss.*

---

## 11. Documentation surface — the complete list

Ship as **one commit with this literal checklist**. Every English edit has a paired Polish edit; the mirrors are structurally identical (pl ≈ en + 10..23 lines), so offsets are predictable and skipping them breaks a documented parity commitment.

**Prose numerals first — a numeral buried in a sentence is the single thing a mechanical sweep misses:**

| file:line | now | becomes |
|---|---|---|
| `docs/INTAKE.en.md:179` | "**Three** are never headless by design — `/gw-domain` and `/gw-wireframe` … and `/gw-fix`" | **Four** — add `/gw-prototype` |
| `docs/INTAKE.pl.md:183` | "**Trzy** z założenia nigdy nie są headless" + the worked example listing them | **Cztery** — add `/gw-prototype`, and update the example |
| `skills/gw-goal/SKILL.md:61-62, :68` | "**Two** of the newer skills do not" / "`/gw-domain` and `/gw-wireframe` — never" | **Three** / add `/gw-prototype` |
| `README.md:40` | "**12 areas** to settle before `/gw-init`" | **13** — the design binding is a per-project setting exactly parallel to `tracker.md` |
| `docs/INTAKE.en.md` / `.pl.md` headers | the same count | the same change, plus a new area 13 (design binding + servable stylesheets) |

**Structural:**

| file | edit |
|---|---|
| `README.md:34` | three surfaces → **four** |
| `README.md:20-30` (lifecycle block) | insert `/gw-prototype` between `/gw-wireframe` and `/gw-plan` |
| `README.md` skills table | +1 row, 18 → 19 |
| `README.md` execution-mode table | `/gw-prototype`: never headless |
| `README.md:215-222` "What gets committed" | + `context/design/` = **yes** (decks, prototypes, and the ask log — the design record lives in the PR diff) |
| `README.md:329` "Both are **standalone**" | qualify: pmview.pyz alone serves decks and prototypes but carries no `desk.py`; the skills tarball carries `desk.py` but prints links into a server it does not ship. The **design lane needs both** |
| `README.md` new paragraph | the one honest sentence (§13) |
| `CLAUDE.md.txt:71-75` | three surfaces → four, with `context/design/` |
| `CLAUDE.md.txt:107-115` (Paths) | + `context/design/<surface>/`; + `design_surface:` in change.md's field list; **and fix the existing three-way disagreement** — CLAUDE.md.txt omits `wireframes.md`, README says only change.md + plan.md, USAGE says three. Settle on: `change.md`, `plan.md`, plus ephemeral `research.md` |
| `CLAUDE.md.txt` router | + `/gw-prototype` row; + the `shape` → `/gw-wireframe` redirect line |
| `gui/README.md:25` "## The three views" | → four |
| `gui/README.md:75-88` Endpoints table | +7 rows; **and fix "All read endpoints take `?project=<name>`"** — false for `/proto/` and `/assets/`, which take it as a path segment |
| `gui/README.md:62-66` (the block quote) | add the carve-out: one append-only file-write route exists, it cannot reach the store, and a test proves it |
| `gui/README.md:90-102` Conventions | + `design_surface:` and the deck/desk conventions |
| `gui/README.md:104-112` Tests | + the new test names |
| `PRODUCT.md:25-29, :34` | four views; one file-write route; zero graph writes outside the proxy; the loopback enforcement |
| `DESIGN.md` §Components | + Layout Schematic, Prototype Frame, Ask Card — **only after the gap ruling** |
| `DESIGN.md:236-261` | **dedupe the duplicated Do's/Don'ts block before Slice 4** |
| `docs/USAGE.en.md:85` + `docs/USAGE.pl.md:88` | scaffold block gains `design/` |
| `docs/USAGE.en.md` Mermaid + `docs/USAGE.pl.md` Mermaid | `WIRE → PROTO → PLAN` |
| `docs/USAGE.en.md:431` `## 4c` / `docs/USAGE.pl.md:442` `## 4c` | **§4c is already `/gw-ideate` in both languages.** New `/gw-prototype` section goes in as §4c and forces **4c→4d, 4d→4e in BOTH files, same commit.** Diff the two files' heading lists against each other as the last step |
| `docs/USAGE.{en,pl}.md` assumptions | amend assumption 9 |
| `docs/INTAKE.{en,pl}.md` | new area: design binding, servable stylesheets, who answers design questions |
| `skills/gw-init/SKILL.md` step 1 | `context/README.md` template gains the `design/` line |
| `dogfood/coffer/context/README.md:5`, `dogfood/interview-copilot/context/README.md:5`, `dogfood/kartka/context/README.md` | the same enumeration, updated |
| `skills/gw-track/SKILL.md:8-16, :131` | fourth surface row; design-gate line |
| `docs/DESK.md` | **new** — the protocol, the "why an answer is not a graph write" derivation, both honest wake framings, the recovery procedure |
| `skills/gw-desk/REFERENCE.md` | **new** — desk-path resolution rule, exit codes, the kind table, and one line reserving "mock"/"comp" for impeccable's rasters |
| `.gitattributes` | **new** |

---

## 12. Ship plan

### Slice 0 — prerequisites. ~70 LOC + config. Half a day.

**Files:** `gui/tests/test_pmview.py`, `gui/pmview/server.py`, `.github/workflows/test.yml`.

Widen `STORE_NAMES`; add `store_path()` and repoint the six hardcoded literals; the `do_POST` Origin/Content-Type/length guard + 3 tests; the `_fingerprint` OSError helper; **the CI workflow**.

**Also decide the root, explicitly.** `discover([repo_root])` returns `[]` — I executed it. The repo has no `context/`; only `dogfood/{coffer,interview-copilot,kartka}` do. **Recommended: run `/gw-init` on graph-workflow itself** (creates `context/{changes,archive,foundation,design}/`, a store, a foundation goal), then run `pmview . dogfood`. Cost: one foundation pass, ~an hour, and the repo becomes a gw project — which is what the dogfooding argument already claims. If that is declined, every worked example must be rewritten against `dogfood/coffer`, and the flagship surface becomes a SvelteKit app whose live sessions need the §8.2 per-surface config from day one. **Do not defer this: the slug, the route shape and the CSP all key off it.**

**How you know it works:** `python3 -m unittest discover -s gui/tests` prints `OK` (from a measured 26 failures), CI is green on a PR, `curl -XPOST -H 'Content-Type: text/plain' 127.0.0.1:8766/api/nodes/x/tier` returns 415, `curl -XPOST -H 'Content-Type: application/json' …` with no Origin returns 403, and `pmview --host 0.0.0.0` prints *"design routes disabled: bind is not loopback."*

### Slice 1 — the loop, end to end, thinnest possible. ~420 LOC. 1.5 days.

**Unlocks: asks (B) and the rung-1 half of (C), in one vertical slice.**

**Files:** `gui/pmview/design.py` (deck read, ask fold, presence, append), `gui/pmview/server.py` (routes 1–5 + token), `gui/pmview/lifecycle.py` (`design_surfaces`), `static/index.html`, `static/app.js` (`renderDesign`, `wireFrame`, ask stack, pulse, `:621`), `static/style.css`, `skills/gw-desk/bin/desk.py` (`post/drain/wait/ack/retire/note/handoff/status`), `skills/gw-desk/REFERENCE.md`, `gui/tests/test_pmview.py` (+5), `.gitattributes`.

**No prototype, no pin, no live, no graph changes, no skill rewrites.** A hand-written `deck.json` and a two-page runbook stand in for `/gw-wireframe`'s edits — which is exactly what proves the design before any skill is committed to it.

**How you know it works:** an agent runs `desk.py post` with an ask carrying `media:{kind:"wire"}`; the human opens `http://127.0.0.1:8766` → Design, sees the schematic drawn from `deck.json.wireframe`, picks option A, hits `Send 1`; the agent's backgrounded `desk.py wait` exits with code 0 and the answer on stdout; the harness re-invokes it. Round trip in one sitting, with a picture, and `git diff` shows two new lines in `asks.jsonl`. Plus: `kind:"ask"` on route 5 → 400; `by:"agent"` → 400; the full read model with `:8765` stopped; a truncated body → 400 with the composer still populated; the store byte-identical after the exercise.

*Cost:* the first recurring background load on a previously idle server — one request per 5 s per open tab, one thread per request, no pool. Trivial at one user, permanent.

### Slice 2 — rung 2, the prototype. ~280 LOC + 190 lines of skill. 1.5 days.

**Files:** `design.py` (`stylesheet_allowlist`, `helper_origins`), `server.py` (`_proto`, `_assets`, the templated CSP), `static/app.js` (the `Schematic | Prototype` toggle, `.protoframe`), `static/style.css`, `skills/gw-prototype/SKILL.md`, `context/foundation/design-bindings.md` template in `gw-init`, `gui/tests/test_pmview.py` (+4).

**How you know it works:** the first prototype renders in the iframe wearing pmview's real `style.css` **served through `/assets/`, not `/static/`**; a second prototype for a `dogfood/*` surface renders wearing *that* project's stylesheet; `/proto/<p>/<s>/../../../etc/passwd` 404s; a symlink out of the surface dir 404s; `.db` 404s; the page renders identically at `localhost:8766` and `127.0.0.1:8766` (the two-spelling CSP test); `--port 9000` renders identically.

### Slice 3 — pointing. ~130 LOC. Half a day.

`static/_gw/pin.js`, `?pin=1` splicing, the `postMessage` picker with `event.source` validation and `textContent`-only rendering, the region-prefilled composer, highlight-on-select.

**How you know it works:** clicking the ask-stack region in the prototype drops a `.pin`, opens the composer prefilled with `ask stack` and a rect thumbnail, and `Send 1` appends an `instruction` with a normalized rect. The prototype cannot read `/api/*` (assert a `fetch` from inside the frame fails).

*Cost:* a second annotation vocabulary not unified with impeccable live's comment pins. Unifying would mean reimplementing ~500 KB of browser overlay (`live-browser.js`); the seam stays.

### Slice 4 — gap 2. ~140 LOC + prose. 1 day. **Fully independent of 1–3.**

`design_distill.py`, the `/gw-foundation` edits, the fingerprint table, `"buildPath": "code"` into `.impeccable/config.json`, the DESIGN.md dedupe.

**How you know it works:** `design_distill.py` emits exactly 13 candidates from `.impeccable/design.json` (handling `donts` as strings); `context/foundation/design-bindings.md` carries 13 rows with `promoted: no`; after the human promotes, `impact_of` on a proposed decorative blue surfaces The Accent-Is-A-Verb Rule; editing one rule's body in DESIGN.md and re-running the check names **that rule** and no other.

*Cost:* two representations of the same rules, mitigated by names-not-values and the per-rule fingerprint. There is no validator and there cannot be one without a build step the invariant forbids.

### Slice 5 — gap 3. ~60 LOC + prose. Half a day. Cheap only after 1, 2 and 4 exist to check against.

`/gw-review` Part 1b (8 checks), the PR block, the `detect.mjs` probe honoring all three `detector.*` keys, the `## Implemented` record into `design-bindings.md`, the `doctor`/`document` bans, the `CONSOLIDATES` rule, the verb rule, the `gw-archive` residue + `DEPENDS_ON` step.

**How you know it works:** on a change that agrees three screens and builds two, the PR block names the third by id; a deliberately dropped empty state is named; a raw hex in `style.css` is named by `detect.mjs`; a dormant citation shows as a skip, not a finding; a leftover `impeccable-live-start` marker fails check 6.

*Cost:* it is a contract read, not a screenshot diff. It catches "the empty state nobody built" and "the cited constraint nobody honored" — the failures that recur — but not "it shipped and it looks wrong."

### Slice 6 — routing and documentation sweep. Prose only. 1 day. **The one most likely to be half-done.**

The full §11 checklist, as one commit, with the prose numerals at the top and the USAGE §4c→§4d→§4e renumber in both languages, ending with a heading-list diff between `USAGE.en.md` and `USAGE.pl.md`.

**How you know it works:** `grep -rn "Three surfaces\|three views\|Trzy\|12 areas\|Two of the newer"` returns nothing stale; the two USAGE heading lists match one-for-one.

### v1.1 — impeccable live on prototypes. ~40 lines of skill. Half a day.

The per-surface `.impeccable/live/config.json` write, the mandatory `--file` on every wrap, the teardown + `git status` residue check, the framework/appRoot preflight with a named skip line.

**How you know it works:** a live session started on a `dogfood/coffer` prototype resolves appRoot to the design directory, `resolveFramework` returns `staticHtml`, exactly one file gains an `impeccable-live-start` block, an element pick resolves to the prototype (never to the real app), and teardown leaves `git status --porcelain context/design/` empty.

**Total: ~1,000 LOC + ~800 lines of prose, ~34 files, something demoable end-to-end at the end of day two.** `scripts/build.py` and `scripts/install-skills.sh`: **zero changes**, verified.

---

## 13. Known limitations and explicit non-goals

**The one honest sentence that belongs in the README, not discovered on day one:**

> pmview cannot start or wake a process. What resumes the agent is a watcher the agent launched before ending its turn, and it only runs when you were at the tab when the question was posted. When you were not, the terminal is where you pick the thread back up — one command, with a copy button waiting for you in the Design tab.

### Known limitations (accepted, documented, not fixed)

1. **The desk does not authenticate the human.** No local-only mechanism can, against an agent on the same machine. The guarantee is the git diff, the mandatory provenance string, and the PR-block listing. §10.
2. **A prototype's schematic and its `/assets/` stylesheet can drift from the shipping stylesheet.** There is no build-time generation (§below) and no validator. Drift is made *loud* by the per-rule fingerprint, not eliminated.
3. **`writeSurfaceBrief` is a whole-file overwrite with no append mode** (`lib/surface-briefs.mjs:127-152`), and impeccable's own new-work flow and `doctor` both write the same path. gw's publish there is a **one-way courtesy**; a concurrent impeccable session may drop it. Nothing gw needs back lives only there.
4. **Concurrent design passes on one surface are not safe for the brief or the deck** — only `asks.jsonl` is (append-only + `merge=union`). Two agents on one surface see each other's asks and acks; two agents editing one deck last-writer-wins.
5. **impeccable's `PRODUCT.md`/`DESIGN.md` discovery walks to the git root**, so a `dogfood/coffer` prototype loads graph-workflow's design context. `/gw-prototype` prints which pair it resolved. Fixing it means a per-project `PRODUCT.md`, which is the maintainer's call.
6. **`pin.js` runs in the prototype's own JS realm.** `event.source === iframe.contentWindow` rules out other frames and tabs, not the prototype itself. Bounded by parent-owned fields and `textContent`-only rendering.
7. **`?pin=1` presence is forgeable by a local GET.** Consequence: one timed-out background watcher.
8. **Part 1b is a contract read, not a visual diff.** It cannot catch "it shipped and it looks wrong."
9. **Two annotation vocabularies** — pmview's region pins and impeccable live's comment pins / shape-typed strokes — are not unified. The human learns two gestures for adjacent jobs.
10. **The design lane requires the surface's impeccable appRoot to be reachable from `Project.root`.** `/gw-prototype` verifies and refuses with a named reason when it is not.

### Explicit non-goals

- **A `/gw-desk` slash command.** Plumbing every phase touches is not a phase. A directory with `bin/` + `REFERENCE.md` and no `SKILL.md` ships identically and costs no routing surface. **18 → 19, not 20** — pending the runtime check in §5.0.
- **`?raw=1`, or any query parameter that subtracts a security header.** Replaced by the templated CSP and the additive `?pin=1`.
- **Any literal origin in any header.** Both are templated from `server.server_address`.
- **SSE or WebSocket.** Works; rejected on HTTP/1.0 connection exhaustion, `Handler.timeout is None`, unbounded threads, and unwrapped `wfile` writes printing tracebacks into the terminal the human is watching.
- **A blocking agent wait as the default path.** It would be the first thing in the workflow that can hang. Presence-gated background wake replaces it and is strictly a turn boundary.
- **Impersonating `serve-question.mjs`'s daemon.** `--stop --key K` executes a bare `process.kill` on a pid read from a state file; writing pmview's pid there means any `--stop` kills the server the human is looking at, mid-session. We adopt the **exit codes** and nothing else.
- **Claiming the desk schema is a superset of impeccable's option card.** It is not (§3). The terminal is the single pmview-down fallback.
- **A second HTTP server on a second port.** A templated CSP plus a sandboxed iframe buys the same isolation for one header, and this is a remote SSH box where 8766 + 8767 + a non-deterministic 8400+N is a port-forwarding puzzle on first run.
- **Asks as `type:issue` graph nodes.** Routes conversation through the trust ladder, makes every transient "which layout" permanent goal-bound knowledge, and requires `:8765` **up** before a human can answer a design question — breaking "reads always work, writes layer on top" at exactly the moment the lane is most useful.
- **A gitignored desk or gitignored prototypes.** `isGeneratedFile()` treats gitignored as generated and `live-wrap.mjs` refuses to write into one; and the rulings would be invisible in the PR diff, absent from a fresh clone, unrecoverable.
- **Change-keyed design folders**, `context/changes/<id>/mockups/`, `.gw-scratch/`, or `.impeccable/mocks/`. Respectively: folder-as-memory; forbidden by `/gw-init` *and* frozen forever by `/gw-archive`; gitignored so `isGeneratedFile()` calls it generated; and squatting a namespace whose comp-round vs decision-round approval semantics another tool audits.
- **A repo-wide or `dogfood/*` glob in any live config.** It dirties every prototype in the repo with a session token on every session start (§8.2).
- **Rebuilding the live overlay's picker, palette and annotation UI inside pmview.** `live-browser.js` is ~500 KB. Under a no-framework, no-bundler, no-build-step invariant that is a second product.
- **Generating `style.css` or constraint nodes from `design.json` at build time.** It would properly fix the unlinked copies of the same primitives, and it reintroduces a build step into a repo whose stated invariant is clone-and-run.
- **One graph node per design token.** Grows with the palette, restates values regenerated wholesale, and violates `/gw-foundation`'s own "do not dump documents in whole."
- **A new `design` / `tokens` / `visual` facet.** `ui` exists; a near-synonym triggers `facet_warnings` and splits the graph.
- **Comps (`buildPath: comp`) in v1.** Rasters are unclickable, un-diffable, cost money, and cannot prove the token system can express the screen. `buildPath: code` plus HTML prototypes gives a clickable artifact that *is* a test of the design system. Comps stay available for direction rounds where the question is "which world", not "which layout" — and **"mock"/"comp" stays impeccable's word for its rasters**, which is why this skill is `/gw-prototype`, the route is `/proto/`, and the class is `.protoframe`.
- **Screenshot-diff visual review.** Needs capture, storage and comparison machinery pmview cannot get under the zero-dependency invariant.
- **pmview writing a decision node directly from a click.** A second write path in all but name, and it would let a UI click produce a graph node with no agent ruling, no `impact_of` check and no `CONTRADICTS` detection. **The answer is input to a capture, not a capture.**
- **`impeccable doctor` or `impeccable document` at any gw gate.** Tier 2 workspace walk; wholesale DESIGN.md regeneration that would silently invalidate every captured constraint and every fingerprint row in one shot.