# The off-spine ring — five skills and a launcher, designed

*Verified against `design-lane` @ `7390efe`. Every gap claim below was checked by
reading the 19 gw skills and the installed Matt Pocock skills at
`~/.claude/skills/`, and every graph binding against the live
`agentic-memory` CLI surface.*


> ## Status: shipped
>
> All five plus the launcher are implemented on branch `design-lane`
> (`79c30d5`, `5e08fc6`, `e561fb8`, `cc9dbac`). **19 → 21 routable skills**, as
> designed: `gw-slice`, `gw-grill` and `gw-teach` earned rows; `gw-spec` is a
> step in `/gw-foundation`, and `gw-wayfind` is `pmview --advise`.
>
> Three places the build corrected this document:
>
> - **`gw-teach` is a routing row after all**, but `gw-wayfind` is not a script —
>   §7 said `bin/` + `REFERENCE.md`, and §8 had to overturn it once the shared
>   ranking forced the question. A script would have reimplemented lifecycle
>   parsing, desk folding and store reading, then drifted from all three.
> - **Staleness could not be `change.md`'s mtime.** Dogfooding caught the report
>   calling this branch ten days cold while it was being edited: a change is
>   worked by editing *code*. The signal is now the newest of the change folder
>   and its desks, and a change whose id matches the git branch is never stalled.
> - **`gw-new`'s by-hand fallback needed the tracer-bullet rules inline.** §9 put
>   them in the size check; the first pass left only "end-to-end verifiable
>   rather than one layer of many", which is the idea without enough to act on.

---

## 0. The one-line diagnosis

**gw's spine is complete and its off-spine ring is thin.** Nineteen skills, and
almost all of them are the change lifecycle plus memory bookkeeping. Matt
Pocock's set is mostly the ring — sharpening before, teaching during, navigating
across.

I checked all 19 gw skills for the six capability classes that set implies:

```
grill / adversarial interview   — NOTHING
teach the human                 — NOTHING
writes a PRD or spec            — NOTHING
fans a plan out into N slices   — NOTHING
orientation / where-am-I        — NOTHING
design it twice                 — NOTHING
```

Six for six.

---

## 1. The decision that gates everything

Matt's skills share a substrate, and **it is exactly what gw's graph replaces**:

| Matt Pocock | graph-workflow |
|---|---|
| `CONTEXT.md` / `UBIQUITOUS_LANGUAGE.md` | `domain_model()` — ratified entities, `ABOUT` hubs, never decay |
| `docs/adr/` | `decision` nodes with a `goal_ref`, trust folded from the journal |
| issue tracker + triage labels | `/gw-track` — work state, deliberately *not* knowledge |
| `learning-records/` | the journal: `USED` / `CONFIRMED` / `NOTED` per node |

`setup-matt-pocock-skills` scaffolds `CONTEXT.md`, `docs/adr/` and `docs/agents/`
into the repo. Run it on a gw project and you get **two homes for the same
knowledge**, with nothing checking one against the other. They will drift, and
the drift is silent.

Checked: none of `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/adr/`,
`UBIQUITOUS_LANGUAGE.md`, `docs/agents/` exist in this repo. **The fork is still
clean.**

> **So porting is rebinding, not copying.** Every skill below keeps its *method*
> — the interrogation, the tracer bullets, the zone of proximal development — and
> loses its *substrate*. A gw skill that writes to `CONTEXT.md` is a bug.

---

## 2. Triage of all fourteen

| Matt's | gw status | verdict |
|---|---|---|
| `tdd` | `gw-fix` | **covered** — same red→green→refactor, plus recall-first reproduction |
| `domain-modelling` | `gw-domain` | **covered, stronger** — ratification gate, `impact_of` before amendments, `ABOUT` hubs |
| `research` | `gw-research` | **covered, stronger** — recall before exploring, contradiction surfacing |
| `implement` | `gw-implement` | **covered** — per-phase recall and capture |
| `prototype` | `gw-prototype` | **covered for UI**; Matt's terminal-app branch for state/business-logic questions has no gw answer → **one extension** |
| `handoff` | change.md + the graph + the desk's `handoff` line | **covered** — a `gw-handoff` would be a report, not a skill |
| `ask-matt` | `gw-ask` | **covered** — a persona variant adds little to a recall-with-provenance answer |
| **`to-tickets`** | — | **GAP → `gw-slice`** (§3) |
| **`to-specs`** | — | **GAP → a step in `gw-foundation`** (§4) |
| **`grill-with-docs`** | — | **GAP → `gw-grill`** (§5) |
| **`teacher`** | — | **GAP → `gw-teach`** (§6) |
| **`wayfinder`** | — | **GAP → a script** (§7) |
| `improve-architecture-codebase` | partial | overlaps `gw-ideate` + `gw-consolidate` → **deferred** (§10) |
| `codebase-design` | — | real but narrow → **deferred** (§10) |

---

## 3. `gw-slice` — the producer for a consumer that already exists

### Thesis

An epic becomes an **ordered list of tracer-bullet slices** in the roadmap, each
one sized so a single agent can carry it and a single human can review it — and
the slicing rationale becomes a `decision` node, because "why these seams, in
this order" is exactly the knowledge the third slice will need and nobody will
remember.

### The hole

**gw has a consumer for epic slices and no producer.** Four skills read the epic
registry:

- `gw-new/SKILL.md:20-27` — *"register it in `context/foundation/roadmap.md`
  (epic id, outcome sentence, **ordered slice list** — each slice a future
  change-id delivering something end-to-end verifiable)"*. That is the entire
  slicing method, as a parenthetical, inside step 1 of a skill whose job is
  opening **one** change.
- `gw-new/SKILL.md:62-65` — *"For an epic slice: always pass the surviving nodes
  of the previously archived sibling slices"* — assumes the slice list exists.
- `gw-ideate/SKILL.md:134` — hands off with *"most ideas here are epic-sized and
  get sliced"*, deferring to a size check, not to a slicing skill.
- `gw-archive/SKILL.md:106-108` — marks a slice done and closes the epic entry.

Every mention of `roadmap.md` across all 19 skills is a **read**.

### Shape: earns a routing row

A distinct phase with its own human gate, invoked by name, between ideation and
the first `/gw-new`.

### Where it sits

```
/gw-ideate  or  /gw-foundation (with a fresh PRD)
      │
      ▼
  /gw-slice ──► roadmap.md: the epic registry entry, ordered, with blocked_by
      │         + one `decision` node recording the seams and the order
      │         + (optional) tracker: one parent item + N children
      ▼
  /gw-new  ──► opens ONLY the first slice
```

### Steps

**0. Ground.** `recall_context` on the foundation goal (or the epic's goal if one
exists). Pull settled `constraint`s that sequence work — *"payments cannot ship
before KYC"* is exactly the kind of node that should reorder a slice list.

**1. Read the source.** A roadmap entry, a PRD, a plan, or the conversation.

**2. Draft vertical slices.** Tracer bullets, Matt's rules kept verbatim because
they are correct:

> - Each slice delivers a narrow but **complete** path through every layer
>   (schema, API, UI, tests).
> - A completed slice is demoable or verifiable **on its own**.
> - Prefer many thin slices over few thick ones.

The anti-pattern is the horizontal slice — "do all the schema", "do all the UI" —
which is unverifiable until the last one lands.

**3. Classify each slice, and bind it to gw's execution modes.** Matt's HITL/AFK
split maps directly onto the routing table gw already has:

| Matt | gw execution mode | forced by |
|---|---|---|
| AFK | `/gw-goal` (headless) | clear, bounded, plan exists |
| HITL | `/gw-implement` (interactive) | judgment or a manual gate |
| HITL | `/gw-fix` (TDD) | a defect or a behaviour-preserving refactor |

**A slice touching a UI surface is automatically HITL** — `/gw-domain`,
`/gw-wireframe` and `/gw-prototype` are on the never-headless list, so a slice
that needs one cannot be AFK. That is a mechanical check, not a judgment call,
and it is the kind of thing a human forgets at 4pm.

**4. Quiz the user.** Present the numbered breakdown — title, mode, blocked-by,
which user stories it covers. Then ask, and iterate until approved:

- Does the granularity feel right (too coarse / too fine)?
- Are the dependencies correct?
- Should any slice be merged or split?
- Are the right ones marked HITL?

**5. Write the registry.** The epic entry in `roadmap.md`: epic id, outcome
sentence, ordered slice list, each with its mode and blockers.

**6. Stop.** Hand off to `/gw-new` for the **first slice only**.

### The deviation from `to-issues`, and why

`to-issues` publishes N issues up front. **`gw-slice` does not open N changes.**

Three reasons, each from gw's own commitments:

1. *"One change per worktree, one fresh agent context per change… parallelism is
   capped by review capacity"* — creating eight change folders invites eight
   agents and one reviewer.
2. `create_change` mints a **Goal node and a liveness root**. Eight goal nodes for
   work not started puts eight live roots in the graph, and the sweep will never
   retire what they keep reachable.
3. `gw-new` wires `parent_refs` from the **actually archived** siblings. Wiring
   them at slice time would point at nodes that do not exist yet.

The tracker is the exception, and it is safe: pushing one parent item plus N
children is *work state*, not knowledge, which is the whole argument `/gw-track`
already makes. Offer it; never do it unasked — it is outward-facing.

### Graph bindings

```
recall_context(query="<epic outcome> sequencing constraints", goal_ref=<foundation goal>)

capture_artifact(type="decision", goal_ref=<foundation goal>, facets=["planning"],
  content="Epic <id> is sliced payments-first because KYC's acceptance criteria
           depend on a settled payment record; the reverse order would have made
           slice 2 untestable. Slices 3-5 are AFK; slice 1 is HITL on the
           consent screen.")

capture_artifact(type="issue", goal_ref=<foundation goal>,
  content="<a scope gap accepted out of this epic, and why>")

append_events([...])           # one batch, at the end
```

No `create_change`. No tier promotion. No tracker write without a yes.

### Refuses

- Opening more than the first change.
- Minting goal nodes for unstarted slices.
- Pushing to a tracker unasked.
- Horizontal slices, even when the user asks for them — surface the cost and let
  them overrule.

### Degradation

No tracker → `roadmap.md` only. No PRD → works from the conversation. No memory
server → writes the registry, queues the capture to `memory-backlog.md` per the
existing degraded-mode rule.

---

## 4. `gw-spec` — a step in `gw-foundation`, not a skill

### Thesis

The conversation becomes `context/foundation/prd.md`, and then immediately
becomes graph constraints. **Foundation lives twice, deliberately** — the doc for
reading whole, the graph for being found at the right moment. Today gw only owns
the second half.

### The hole

`gw-foundation` distills a PRD **that must already exist**. Nothing in gw writes
one. Confirmed: every `prd.md` / `roadmap.md` reference across all 19 skills is a
read.

### Shape: a new Step 0 in `gw-foundation`, plus one routing line

This is the routing-row rule doing real work. `gw-foundation` already owns
"documents → graph"; adding "conversation → document" makes it end to end and
costs no new row. The discoverability problem — nobody types `/gw-foundation`
when they want a PRD written — is solved with **one line in the router**, not a
skill:

```
| Notes or a conversation that should become a PRD | `/gw-foundation` — writes
  `prd.md` first when none exists, then distils it |
```

> **If you would rather have `/gw-spec` as its own skill, that is a defensible
> call** — writing and distilling are different modes. It costs one more full doc
> sweep (~20 files, both Polish mirrors). I recommend the step; the decision is
> yours.

### The step

**Step 0 — write the document, if there is none.**

1. **Detect.** `context/foundation/prd.md` exists → skip to distillation.
2. **Do not interview.** Synthesize from the conversation and the codebase.
   *Interrogation is `/gw-grill`'s job* — that seam is what keeps both skills
   sharp. If the conversation is too thin to synthesize from, say so and route to
   `/gw-grill`, do not start asking questions here.
3. **Sketch the test seams.** Prefer existing seams; use the **highest** seam
   available; propose new ones only at the highest point you can. Recall first —
   a settled `constraint` about testing outranks a fresh opinion:
   ```
   recall_context(query="test seams boundaries integration", goal_ref=<foundation goal>)
   ```
   Check the seams with the user before writing. This is the one place Step 0
   blocks.
4. **Write `prd.md`** — problem statement, solution, an extensive numbered list of
   user stories, implementation decisions, testing decisions, out of scope.
5. **Then run the existing steps 2–5**: distil, reference back, hand the human the
   promotion list, deactivate.

### Graph bindings

The seam decisions are durable and go in as `decision` nodes with
`facets=["testing"]`; the PRD's non-negotiables become `constraint`s in the
existing distillation pass. Reference-back table into `prd.md` as an HTML comment,
exactly as step 3 already prescribes.

### Refuses

- **No file paths, no code snippets** in the PRD or in any node — they go stale
  fast, and gw's own capture rule is *one statement per artifact, readable cold*.
  The one exception both frameworks allow: a prototype produced a snippet that
  encodes a decision more precisely than prose can (a state machine, a schema, a
  type shape) — inline the decision-rich part and say it came from a prototype.
- Interviewing. That is `/gw-grill`.

---

## 5. `gw-grill` — the dialogue gw does not have

### Thesis

Interrogate a plan against **settled knowledge with trust weights**, running
`impact_of` on every load-bearing claim, until the disagreements are on the table
— then capture the rulings, with `CONTRADICTS` edges where they overturn
something, and **stop before applying**.

### The hole

gw has exactly one interactive-dialogue skill (`gw-wireframe`, and only for UI
screens). `gw-plan-review` is **a gate, not a conversation** — its own text says
so: *"Runs as a fresh agent session with a clean context — it must not inherit
the planner's belief about what the constraints were."* Fresh session, one
independent read, a verdict. There is no back-and-forth anywhere in the spine.

### Shape: earns a routing row

Genuinely different mode from every existing skill.

### Where it sits

Between `/gw-research` and `/gw-plan` — or against an existing `plan.md`, before
`/gw-plan-review`. **It must not become a second plan gate**: it produces a
sharpened plan and captured decisions, never a verdict. `gw-plan-review` stays
the gate, and stays a fresh session.

### Steps

**0. Ground, and open where it is already contested.**

```
recall_context(query="<the plan's subject and subsystems>", goal_ref=<goal_node_id>)
domain_model(status="confirmed")
```

Pull every `disputed` node in the bundle to the front. Those are live contested
ground and the grill should start there, not discover them at question nine.

**1. Build the question tree, and walk it one branch at a time.** One question per
turn. **Always give your recommended answer with the question** — a bare question
makes the user do the work twice.

**2. Explore instead of asking.** If the codebase or the graph can answer it, go
and find out. The user's attention is the scarcest thing in the session.

**3. The four challenge modes, rebound to the graph.**

- **Against the domain model.** Not `CONTEXT.md` — `domain_model(status="confirmed")`.
  A term that is not a ratified entity is either a `/gw-domain` proposal or the
  wrong word. (`gw-wireframe` already states this rule; reuse it verbatim rather
  than inventing a second phrasing.)
- **Against settled constraints.** `impact_of` on each load-bearing claim, then
  say it plainly: *"That contradicts [node:8b94…], settled in change
  `pmview-drawer-upgrades`, trust 0.9 — which is right?"* This is the mode files
  cannot do: a glossary has no trust weight and no blast radius.
- **Concrete scenarios.** Invent edge cases that force precision about the
  boundaries between concepts. Vague agreement dies on a specific example.
- **Against the code.** When the user states how something works, check. A
  contradiction between what they said and what the code does is a finding, not
  an awkwardness.

**4. Capture as decisions crystallise — and mind the two disciplines.**

Matt's rule is *"update inline, don't batch"*. gw's rule is *one batched
`append_events` per phase*. **Both are right, about different things:**

> Capture **artifacts** inline, the moment a decision crystallises — they are
> immutable statements and batching them loses the reasoning. Batch the
> **events** — they are feedback, and one batch per session is what the ranking
> path expects.

**5. Apply the three-part test before every capture.** Imported from
`grill-with-docs`, because **gw has no filter on what earns a node** and
over-capture is a real failure mode: a graph full of restated obviousness ranks
worse than a small one. Capture only when all three hold:

1. **Hard to reverse** — changing your mind later has a meaningful cost.
2. **Surprising without context** — a future reader will ask *"why did they do it
   this way?"*
3. **The result of a real trade-off** — there were genuine alternatives and one
   was picked for stated reasons.

Any one missing → it is conversation, not knowledge. Let it go.

**6. When the ruling overturns something settled.** The pattern `/gw-prototype`
already uses, verbatim:

```
capture_artifact(type="decision", goal_ref=..., content="<the ruling, and why>")
link(source=<that decision>, target=<the constraint>, type="CONTRADICTS")
# then STOP. Do not apply. Do not retire, archive or re-weight the old node.
```

`CONTRADICTS` raises the review flag; the human rules via `/gw-resolve` or the
GUI. An agent that resolved its own contradiction would be the safety invariant
breaking in the one place it matters most.

### Refuses

- Issuing a verdict. That is `/gw-plan-review`, and it must stay a fresh session.
- Resolving a contradiction it surfaced.
- Capturing everything (the three-part test).
- Asking what it could have looked up.

### Degradation

Empty graph → still useful as a pure interrogation, but say so: the challenge
modes that need settled constraints are unavailable, and the session is now
opinion against opinion.

---

## 6. `gw-teach` — the one that is genuinely better in gw

### Thesis

**The graph is already a curriculum.** Nodes ordered by `DEPENDS_ON` are a
prerequisite chain; the journal already records what this person has actually
used. Teach from it in dependency order, and let the teaching feed ranking back.

### Why the graph version beats the file version

Matt's `teach` builds a workspace from scratch: `MISSION.md`, `GLOSSARY.md`,
`RESOURCES.md`, `learning-records/`. In a gw project **three of those already
exist and are live**:

| `teach` builds | gw already has |
|---|---|
| `GLOSSARY.md` | `domain_model()` — ratified, hub-linked, never decays |
| `learning-records/` | the journal — `USED` / `CONFIRMED` / `NOTED`, per node, with reasons |
| `MISSION.md` | the foundation goal + `roadmap.md` |

And the zone of proximal development, which Matt computes by reading learning
records, gw can compute **from the journal**.

### Shape: earns a routing row

A different mode from everything in the spine, and the one skill here that
produces something for the human rather than for the codebase.

### Steps

**1. The mission.** Teaching ungrounded in *why* produces abstract exercises the
user abandons. The default mission in gw is the foundation goal plus the open
change — ask only when that is genuinely unclear.

**2. Locate the topic in the graph.**

```
recall_context(query="<topic>", goal_ref=<foundation goal>)
domain_model(status="confirmed")
```

**If the topic is not in the graph at all, say so.** You would be teaching from
parametric knowledge, which is exactly what Matt's skill distrusts and what gw's
whole design is a reaction to. Offer `/gw-research` or `/gw-foundation` instead.

**3. Order by dependency.** Walk `DEPENDS_ON` outward from the entry nodes and
teach prerequisites first. **This is the thing a flat glossary cannot do** — a
file has no edges, so a file-based teacher has to guess the order.

**4. Compute the zone of proximal development from the journal.**

- Nodes carrying `USED` or `CONFIRMED` events → **known**; do not re-teach.
- Nodes never touched but adjacent to a known node → **the frontier**. Teach here.
- Nodes three hops out with unknown prerequisites → too far; note and skip.

**5. Teach with citations.** Every claim cites a `[node:<id>]` or an external URL.
Never an uncited assertion — the point of teaching from a graph is that the
provenance is already there.

**6. The explainer is a rendering, not a source.** Write it to
`.gw-scratch/teach/<topic>.html` — **gitignored, deliberately**. An explainer
committed to the repo becomes a fourth place knowledge lives, and it will drift
from the nodes it renders with nothing to detect the drift. Print the command
that opens it.

**7. Journal what the lesson drew on. This is the dividend.**

```
append_events([{node_id: <each node taught>, type: "USED",
                reason: "taught: <topic>"} , ...])
```

Nothing else in gw generates `USED` events outside of implementation work. A
project where people learn from the graph gets a graph that ranks what people
actually need — which is the compounding return on all that capture discipline.

**8. Quizzing, and the verb that is correct.** A passed quiz emits **`NOTED`**, not
`CONFIRMED`. `CONFIRMED` means *the claim was exercised and held* — a test ran, a
path was traced to ground. A human recalling a fact is not that. Inflating
`CONFIRMED` corrupts trust-folding, and `/gw-review` already polices exactly this
distinction; a teaching skill must not be the hole in it.

### Refuses

- Promoting a tier.
- Capturing new knowledge. A human learning something does not make it true. If a
  session *discovers* something, that is a capture inside a change, not here.
- Committing explainers.
- Teaching a topic the graph does not hold, without saying so.

### Degradation

Empty graph → say so plainly and route to `/gw-foundation`. This skill is a
dividend on capture, and there is no dividend without the deposit.

---

## 7. `gw-wayfind` — a script, not a skill

### Thesis

One read that answers **"where am I, what needs me, what should I pick up"**
across every change — in the terminal, with no browser and no running server.

### The hole

pmview computes all of this and renders it beautifully, but it needs a browser
and a live server on `127.0.0.1:8766`. A headless run, a CI job, or a session on
a machine with no port forwarding cannot see any of it. Nothing narrates it.

### Shape: a `pmview` subcommand, not a script and not a skill

> Settled in §8, which had to resolve where the shared ranking lives. Short
> version: `pmview --advise` prints the report with no server and no browser, and
> `skills/gw-wayfind/` holds only a `REFERENCE.md`.

The reading is **deterministic** — scan lifecycle files, call two store-wide
reads, count and rank. A script does that better and faster than prose
instructions, and it is callable from a skill, a shell, or CI. What is left is
one paragraph of judgment, which any skill can carry.

This mirrors `gw-desk`, which ships in the tarball without claiming a routing
row.

> **Discoverability**, which is the honest objection: nobody types
> `/gw-wayfind` if it does not exist. The cheap fix is a mode on `/gw-ask`,
> which already owns reads outside a change and already resolves the foundation
> goal — `"/gw-ask where am I"` shells out to the script. If you would rather
> have the row, it is one more doc sweep and I would not argue.

### What it reads

| source | gives |
|---|---|
| `context/changes/*/change.md` | stage, goal, warnings, `design_surface:` |
| `context/archive/*` | what is finished |
| `stale_nodes()` | the review queue — store-wide, needs no goal |
| `consolidation_candidates()` | cross-change recurrence |
| `context/design/*/asks.jsonl` | open asks, and whether an agent is listening |
| `git` | branch, worktrees, uncommitted work |

### What it reports

1. **Changes by stage** — with the one that has sat longest in a stage flagged.
   Stalled work is invisible in every other view.
2. **What needs you** — disputed nodes, open desk asks with **no agent
   listening**, changes carrying warnings, plan stubs.
3. **What is safe to pick up** — a plan exists, no open asks, no disputes.
4. **What is about to be lost** — short/mid-term nodes on changes near archive,
   and consolidation candidates.
5. **The one next action** — a single sentence.

> **Orientation is one sentence, not a dashboard.** pmview is already the
> dashboard. The terminal version's entire value is the *ranking* — if it prints
> five equally-weighted lists, it has failed and the user goes back to the
> browser.

### Refuses

Writing anything. It is a read, end to end.

---

## 8. The launcher — pmview offers the *right* skill, not every skill

### Thesis

pmview knows the state of every change, every disputed node and every open ask.
So it can offer **the two or three skills that make sense for this card, right
now** — which is a different and much better product than a palette of 22.

A command palette listing every skill is strictly worse than the slash menu the
terminal already has. The value is the **ranking**, not the reachability.

### The line that must hold: pmview executes nothing

Spawning `claude -p` from the board turns a read-mostly view into an
arbitrary-code-execution surface, on a port that any page the operator merely
visited can already reach with a POST. The `Content-Type` guard added in Slice 0
is enough to stop a cross-origin *simple request*; it is nowhere near enough to
put `subprocess` behind.

Three more reasons, each from something already written down:

1. `gui/README.md` records zero-dependency and reads-from-disk as architectural
   invariants. A process supervisor is a different product.
2. pmview does not know what an agent needs — working directory, model, approval
   mode, worktree. It would be guessing all four.
3. The honest sentence already in the README — *"pmview cannot start or wake a
   process"* — is load-bearing. Everything in the desk protocol is designed
   around it. Breaking it here would invalidate the reasoning everywhere else.

**So: two tiers that do not cross the line, and one that is refused.**

### Tier 1 — contextual actions that copy the command

Every card grows an action row whose contents are computed from its state:

| card state | offers |
|---|---|
| change in `planned` | `/gw-implement` · `/gw-plan-review` |
| change in `new`, no plan | `/gw-plan` · `/gw-research` |
| change in `review` | `/gw-review` · `/gw-archive` |
| change with `design_surface:` and unruled gaps | `/gw-wireframe` |
| surface with open asks, agent listening | *(nothing — it is being worked)* |
| surface with open asks, **no** listener | `/gw-prototype --resume <surface>` |
| node flagged `disputed` | `/gw-resolve` |
| epic registered, no slices | `/gw-slice` |
| store-wide: consolidation candidates | `/gw-consolidate` |

Clicking copies the command. No server change, no new route, no invariant
question. This is the pattern the design-lane resume banner already uses — it is
being generalised, not invented.

### Tier 2 — a request queue, which is the desk generalised

The desk already solved "a human wants to tell an agent something, and no agent
is listening right now". A skill invocation is the same shape, one scope up:
**per project rather than per surface.**

```
context/requests.jsonl        # append-only, git-tracked, merge=union
{"ts":"…","kind":"request","id":"3f1a9c04","by":"human","src":"pmview",
 "skill":"/gw-implement","change":"design-lane","note":"phase 2 is unblocked now"}
```

Same rules, unchanged, because they were right the first time:

- **Construct, never copy.** pmview builds the line field by field from an
  allowlist and stamps `by` / `src` / `id` / `ts` itself. `skill` is validated
  against the *installed* skill list — pmview cannot emit a request for a skill
  that does not exist, and cannot emit any other kind.
- **State is derived.** A request is `open` until an `ack` references it.
- **`drain` delivers it.** `desk.py drain --requests` at any phase boundary.
- **It is not knowledge.** A request is a request. If acting on it produces a
  decision, that is captured the ordinary way with a `goal_ref`.

The honest limit is unchanged and must be said in the UI: **a queue is not a
launcher.** Nothing starts an agent. A request waits until one drains — which,
for a request filed while an agent *is* listening, is seconds; and for one filed
at midnight, is tomorrow morning.

### Tier 3 — pmview spawns the agent. Refused.

Not "later", not "behind a flag". See the line above.

### Where the shared ranking lives — and the problem it solves

`gw-wayfind` (§7) and this launcher rank the same things: what is stalled, what
is blocked, what needs a human, what is safe to pick up. Writing that twice
guarantees the terminal and the board eventually disagree about what to do next,
which is the worst possible failure for an orientation tool.

But they ship in **different distributables**: the board is `pmview.pyz`, the
skills are `gw-skills-<ver>.tar.gz`, and §9 of the design-lane proposal is
explicit that neither pulls in the rest of the repo.

**Resolution: the ranking is a pmview module, and `gw-wayfind` is a pmview
subcommand — not a script in the skills tarball.**

```
gui/pmview/advise.py          # the ranking. stdlib only, no server, no I/O beyond reads

  consumers:
    pmview --advise           →  the terminal report.  THIS IS gw-wayfind.
    GET /api/advise           →  the board's contextual action rows
```

This is better than a script in three ways, and it is worth being explicit
because the obvious design is the wrong one:

1. **The readers already exist there.** `lifecycle.py` parses change folders,
   `design.py` folds desks, `graph.py` reads the store. A standalone script would
   reimplement all three and drift from them.
2. **It works headless.** `--advise` prints and exits. No server, no browser, no
   port — which was the entire objection to "just look at pmview".
3. **One file to install.** `pmview.pyz` is already the recommended install, and
   the README already says the design lane needs both assets.

`skills/gw-wayfind/` therefore contains **only a `REFERENCE.md`** — no
`SKILL.md`, no `bin/` — documenting when to run it and how to read the output.
The same shape as `gw-desk`: it ships in the tarball, claims no routing row, and
costs no doc sweep.

> **The rule this makes concrete:** when a capability's judgment is thin and its
> reading is deterministic, it belongs where the readers already are. Not every
> capability is a skill, and not every script is a skill either.

### What it costs

| | |
|---|---|
| `gui/pmview/advise.py` | ~180 LOC — the ranking, both consumers |
| `gui/pmview/__main__.py` | `--advise` flag, ~15 LOC |
| `gui/pmview/server.py` | `GET /api/advise`, `POST /api/requests`, ~50 LOC |
| `gui/pmview/design.py` | request-line construct + fold, reusing `append`, ~40 LOC |
| `gui/pmview/static/app.js` | action rows on cards + the request composer, ~120 LOC |
| `gui/pmview/static/style.css` | `.actions-row`, reusing `.btn.secondary`, ~15 LOC |
| `skills/gw-wayfind/REFERENCE.md` | new, no routing row |
| docs | ~5 files — no new skill row, so no full sweep |

---

## 9. What to import even if you build none of the five

Four things from Matt's set are worth adopting into gw's existing skills right
now. Each is cheap and each fixes something real.

**1. The three-part capture test** → `CLAUDE.md.txt` capture discipline.
gw tells you *how* to capture (one statement, readable cold, facets, edges) and
never *whether*. Hard to reverse + surprising without context + a real trade-off.
Over-capture is the quiet failure: a graph full of restated obviousness ranks
worse than a small one, and nothing currently pushes back.

**2. "Explore instead of asking"** → every interactive skill.
If the codebase or the graph can answer it, go and find out.

**3. "Give your recommended answer with the question"** → `gw-wireframe` Step 4f.
It currently says *"Ask them; do not answer them yourself"*, which is right about
not **deciding** and wrong about not **recommending**. A bare question makes the
user do the work twice. The desk's ask format already carries `options` with
costs — the skill should require a recommendation among them.

**4. The tracer-bullet rules** → `gw-new`'s size check.
It says "if it is an epic, register an ordered slice list" without saying what
makes a good slice. Three lines fixes it, whether or not `gw-slice` ever ships.

---

## 10. Cost, and what ships first

| | shape | new routing row? | doc sweep |
|---|---|---|---|
| `gw-slice` | `SKILL.md` | yes | full (~20 files, both pl mirrors) |
| `gw-spec` | step in `gw-foundation` | no | ~5 files |
| `gw-grill` | `SKILL.md` | yes | full |
| `gw-teach` | `SKILL.md` | yes | full |
| `gw-wayfind` | `pmview --advise` + `REFERENCE.md` | no | ~5 files |
| the launcher | `advise.py` + routes + card actions | no | ~5 files |

**19 → 22 routable skills, not 24.** The measured cost of one new skill is 22
files: the router table, the README skills table and lifecycle block, the
execution-mode table, USAGE prose plus the Mermaid diagram, the INTAKE
never-headless list — each of those twice, because `docs/USAGE.pl.md` and
`docs/INTAKE.pl.md` are structurally identical mirrors and the parity is a
documented commitment.

### Build order

**First: `gw-spec` + `gw-slice`.** They are a pipeline — spec produces the PRD
that slice consumes — and together they close the structural hole: a producer for
the epic registry four skills already read. Highest payoff, and `gw-spec` costs
almost nothing because it rides an existing skill.

**Second: `gw-wayfind` + the launcher, together.** They rank the same things, so
they are one module (`advise.py`) with two consumers — building them apart is how
the terminal and the board end up disagreeing about what to do next. Neither
costs a routing row.

**Third: `gw-grill`.** The mode gw is most obviously missing, but it wants the
three-part test (§8.1) to land first — the grill is where over-capture would do
the most damage.

**Fifth: `gw-teach`.** The most novel and the largest. Do it last, when the
pattern for adding a ring skill is proven twice over.

---

## 11. Explicitly not doing

- **`improve-architecture-codebase` → `gw-deepen`.** Overlaps `gw-ideate` (mines
  the graph for what to build) and `gw-consolidate` (distils recurring
  knowledge). The genuinely new part — architectural pressure read from graph
  shape, like entities with many `ABOUT` edges or repeated `CONTRADICTS` — is a
  handful of queries that belong **inside `gw-ideate`**, not in a new skill.
- **`codebase-design` / "design it twice".** Real, narrow, and already served by
  the installed `design-an-interface` for anyone who wants it. A gw version's only
  addition would be citing the constraints each variant honours or violates. Worth
  doing eventually; not worth a routing row yet.
- **`ask-matt`.** `gw-ask` already answers from settled memory with provenance. A
  persona wrapper adds tone, not capability.
- **`handoff` as a skill.** `change.md` + the graph + the desk's `handoff` line
  already are the handoff, and a session that ends mid-change leaves all three.
- **Porting Matt's substrate.** No `CONTEXT.md`, no `docs/adr/`, no
  `UBIQUITOUS_LANGUAGE.md`, no `docs/agents/`. §1.
- **A `/gw-desk`-style row for `gw-wayfind`** — settled in §8: it is a pmview
  subcommand, so the question does not arise.
- **pmview spawning agent processes.** §8, Tier 3.
