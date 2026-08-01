# graph-workflow

An agentic development workflow that merges the **10x framework** (change-centric,
worktree-per-change, plan → implement → review → merge) with the
**[agentic-memory-system](https://github.com/mt3o-dev/agentic-memory-system)** (a
graph-based, agent-first memory: typed knowledge nodes, append-only decision
journal, goal-dominant PPR retrieval).

There is **one lifecycle, not two workflows**. Memory operations are steps *inside*
the 10x change lifecycle, never a parallel bookkeeping chore:

```
/gw-new     → change folder + create_change (change anchor + Goal node) + first recall
worktree    → checkout = change activation = liveness root ON
/gw-research→ recall BEFORE exploring; codebase research grounded in settled memory
/gw-plan    → recall + trace-impact of anything the plan supersedes; capture decisions
/gw-plan-review
            → independent plan gate: fresh session recalls the goal's settled
              constraints and checks plan.md against them before implementation
/gw-implement / /gw-goal / /gw-fix
            → per-phase recall → work → capture at phase boundaries → batched feedback
              (/gw-fix runs the same loop under TDD: red before any source edit)
/gw-review  → impl review + the human memory gate (staleness queue, promotions)
merge       → /gw-archive: final capture, deactivate + sweep, folder → context/archive/
```

Around that spine sit the skills that are not change-shaped: `/gw-domain` establishes the
project's ubiquitous language as graph entities, `/gw-wireframe` designs UI surfaces with
the user before a plan exists, `/gw-ideate` mines the graph for what to build next, and
`/gw-consolidate` distils recurring knowledge before the sweep sends it dormant.

`/gw-track` runs *along* the spine rather than beside it: where a project uses an issue
tracker, it binds each change to one item and syncs at the same gates the memory
operations fire at. Three surfaces, three jobs — files carry lifecycle state, the graph
carries knowledge, the tracker carries work state for people outside the session.

**User guide** (worked example, diagrams, edge cases, assumptions):
[docs/USAGE.en.md](docs/USAGE.en.md) · po polsku: [docs/USAGE.pl.md](docs/USAGE.pl.md)

**Pre-project intake checklist** (12 areas to settle before `/gw-init`):
[docs/INTAKE.en.md](docs/INTAKE.en.md) · po polsku: [docs/INTAKE.pl.md](docs/INTAKE.pl.md)

## Core commitments (inherited, non-negotiable)

- **Goal-mandatory writes.** Every captured artifact serves a Goal node
  (`memory_goal` in `change.md`). The MCP surface rejects goal-less writes.
- **Safety invariant.** Nothing an agent can call mutates trust, clears a review
  flag, promotes a tier, archives a node, ratifies a domain entity, or commits a
  consolidation. Trust is *folded* from the journal; flags resolve via the
  evaluator/human ladder; archival is a merge consequence; entity ratification and
  consolidation are human judgment. Agents propose, detect, draft, and recommend —
  each of those ends at a person. Never add such a tool "for convenience".
- **Names are not claims.** The graph holds two kinds of knowledge with different
  physics. Artifacts *assert* (and decay, get contradicted, go dormant); domain
  entities *name* (and never decay, are never consolidated, and survive every sweep
  regardless of tier — the domain outlives the changes that touch it). Entities are
  also the graph's hubs: `ABOUT` is the one edge whose reverse direction is walked,
  so an entity pulls in what the project knows about it, across change boundaries.
- **Graph replaces folders.** Per-change knowledge lives in one shared store; the
  change-id is a **facet** on nodes, not a directory. `context/changes/<id>/` keeps
  only the thin lifecycle files (change.md, plan.md).
- **Foundation lives twice, deliberately.** Foundation docs (PRD, tech-stack,
  ADRs) stay the human-readable source of truth; their normative content is
  distilled into the graph (`/gw-foundation`) and human-promoted to
  lifetime tier, so every future recall serves it. Docs are for reading whole;
  the graph is for being found at the right moment.
- **Immutable archive.** No skill or tool writes to `context/archive/`. If a
  resolved target path starts there, abort: *"This change is archived. Open a new
  change with /gw-new."*
- **Feedback is not optional.** A session that recalls but never journals
  USED/CONFIRMED/CONTRADICTED starves future ranking. Every phase ends with one
  batched `append_events` call.
- **Archival is dormancy, not deletion — but recall only serves the live set.**
  The sweep never removes nodes; it retires un-promoted short/mid-term detail
  from retrieval. What must outlive a change is consolidated at the review gate
  (episodic → semantic: a change-summary node + promotion candidates) and
  promoted by the human before the sweep runs.

## The skills

| Skill | 10x ancestor | Memory operations bound in |
|---|---|---|
| `gw-init` | `10x-init` | MCP registration, store bootstrap |
| `gw-ask` | — (new) | recall-only Q&A outside any change: foundation-scope recall, grounded answers with node cites, usage journaling |
| `gw-foundation` | `10x-prd` / ADRs (downstream of) | distill foundation docs into lifetime-tier candidates in the root set |
| `gw-domain` | — (new) | `domain_model` + `capture_entity`: the ubiquitous language as graph entities — greenfield elicitation or brownfield extraction, `ABOUT` wiring, `impact_of` before amendments, human ratification gate |
| `gw-ideate` | — (new) | multi-seam recall over `issue`s, accepted gaps, under-used capability and domain blind spots → evidence-backed opportunities; findings captured, ideas routed to the roadmap |
| `gw-new` | `10x-new` | `create_change`, goal-id recording, seed `recall_context` |
| `gw-research` | `10x-research` | recall-first research, contradiction surfacing, feedback |
| `gw-wireframe` | — (new) | recall UX constraints + `domain_model` before designing; screen inventory then one screen per turn with the user; design-system gaps surfaced as decisions and captured |
| `gw-plan` | `10x-plan` | recall, `impact_of` pre-checks, plan-boundary capture |
| `gw-plan-review` | `10x-plan-review` | fresh-session independent recall, plan vs settled constraints, dispute-side check |
| `gw-implement` | `10x-implement` | per-phase recall, phase-boundary capture, batched feedback, `link` CONTRADICTS |
| `gw-fix` | `10x-implement` (TDD variant) | recall-first reproduction, `impact_of` when the recorded rule is the bug, red→green→refactor, lesson captured as the class of mistake |
| `gw-goal` | `/goal` / `claude -p` | same discipline compressed for headless runs; rules-path validity, no human gates until PR |
| `gw-review` | `10x-impl-review` | staleness queue, disputed-node checklist, episodic→semantic consolidation, promotion candidates (human gate) |
| `gw-archive` | `10x-archive` | completeness check, deactivate + sweep, immutable folder move |
| `gw-resolve` | — (new) | joint human+agent resolution session over the disputed-node queue: evidence + recommendation per item, human rules, applied via the guided GUI API; promotion pass + deferred sweeps |
| `gw-track` | — (new) | none — the tracker holds *work state*, the graph holds knowledge. Adopts or opens the item, pushes phases/status at the gates, pulls acceptance criteria as plan input, reports divergence instead of overwriting either side. Tracker-agnostic via `context/foundation/tracker.md` |
| `gw-consolidate` | — (new) | `consolidation_candidates` → read the cluster → draft the abstraction → human commits via `/api/consolidate`; also gives the review-gate episode summary its `CONSOLIDATES` provenance |

Skills are **judgment and sequencing**; MCP tools are **deterministic operations**.
Skills decide *when* to call; tools never embed judgment.

## Set up a project

Two pieces get installed: **the memory system** (once per machine — one copy serves all
your projects) and **the workflow skills** (copied into a project, or into your user
scope so every project has them). Then three commands inside the project and you are
running. About ten minutes.

You need [`uv`](https://docs.astral.sh/uv/) and Claude Code. Nothing else.

### Step 1 — install the memory system (once per machine)

```sh
git clone https://github.com/mt3o-dev/agentic-memory-system ~/tools/agentic-memory-system
cd ~/tools/agentic-memory-system && uv sync
```

Check it works:

```sh
uv run agentic-memory --help
```

That is the whole install. There is no server to register, no git filter to configure,
and no background process — the workflow talks to memory by running this command.

### Step 2 — add the skills

```sh
cd /path/to/graph-workflow
cp -r skills/gw-* ~/.claude/skills/        # every project gets them
# or, just this one project:
cp -r skills/gw-* /path/to/your-project/.claude/skills/
```

### Step 3 — tell the project about the workflow

Paste the contents of `CLAUDE.md.txt` (from this repo) at the end of your project's
`CLAUDE.md`. Create the file if it does not exist. This is what teaches every future
Claude session the lifecycle and its rules.

### Step 4 — run `/gw-init` in your project

Open Claude Code in your project and run:

```
/gw-init
```

It creates the `context/` folders, checks that memory answers, adds the right
`.gitignore` lines, and asks you a couple of setup questions. Safe to re-run.

### Step 5 — teach it about your project

This is the step people skip, and it is the one that decides whether the first month is
useful. An empty graph knows nothing, so early sessions have nothing to recall.

```
/gw-foundation      # reads your PRD, ADRs, tech-stack, lessons.md → knowledge nodes
/gw-domain          # your project's nouns: Invoice, Customer, Shipment…
```

Then open the review GUI and **approve what they proposed** — this part is yours, not
the agent's:

```sh
cd /path/to/your-project
uv --project ~/tools/agentic-memory-system run agentic-memory-gui
# → http://127.0.0.1:8765
```

Open a node in the **Browse** tab to promote it, and use the **Domain** tab to confirm
entities. Nothing an agent proposes counts as settled until you say so.

> **Watch the directory.** Use `uv --project <path> run …`, not
> `uv run --directory <path> …`. The second one *moves* into the memory system's folder,
> so it opens the memory system's own store instead of your project's. `--project` keeps
> you where you are, which is what you want — one store per project.

**No PRD yet?** That is fine. Skip `/gw-foundation` and run `/gw-domain` — on a new
project it interviews you about your domain; on an existing codebase it reads the code
and brings you a list to review.

### Step 6 — do your first change

```
/gw-new             # names the work, opens its memory scope
/gw-plan            # writes the plan, records the decisions
/gw-implement       # builds it, phase by phase
/gw-review          # reviews the code, hands you the memory queue
/gw-archive         # after merge: tidies up, keeps what matters
```

Use `/gw-fix` instead of `/gw-plan` + `/gw-implement` for a bug or a refactor — it runs
the same loop under test-first discipline.

---

### Did it work?

```sh
cd /path/to/your-project
uv --project ~/tools/agentic-memory-system run agentic-memory domain-model
```

If that prints your entities (or says the domain is not modelled yet), everything is
wired. If it errors, `/gw-init` did not finish — re-run it.

### What gets committed

| Path | Committed? | Why |
|---|---|---|
| `context/changes/`, `context/foundation/` | yes | thin lifecycle files — the change's goal, plan, status |
| `context/memory-graph.dump` | **yes** | the memory graph, as plain text. Diffs and merges like code |
| `context/memory-graph.db` | no | the working database — rebuilt automatically from the dump |
| `.claude/skills/gw-*` | yes, if project-scoped | so teammates get the same workflow |

The dump appears after your first capture. You never have to export or import anything:
the store refreshes the dump when it finishes writing, and rebuilds itself from the dump
when it starts. Just commit as usual.

### Joining a project that already uses this

```sh
git clone <the project>
```

That is it. The first command any agent runs rebuilds the memory database from the
committed dump. You only need Step 1 (the memory system on your machine) if you have
not done it before.

### Optional: the MCP server

The workflow runs fine without it. Registering it gives Claude nicer, faster access to
memory — worth doing once you are past the first change:

```sh
cd /path/to/your-project
claude mcp add --scope project agentic-memory \
  --env MEMORY_DB_PATH="$PWD/context/memory-graph.db" -- \
  uv --project ~/tools/agentic-memory-system run agentic-memory-mcp
```

`--scope project` writes `.mcp.json` in the project, so commit it and everyone gets it.
Setting `MEMORY_DB_PATH` matters here: Claude launches the server for you, from a
directory you do not control, so pin the store rather than letting it guess.
It takes effect in your **next** Claude session, not the current one. If the MCP tools
are ever missing, nothing breaks — the workflow falls back to the command line.

### Good to know

- **One store per project.** It lives at `context/memory-graph.db` inside the project.
  Pointing one store at two projects mixes their knowledge and spoils both — the usual
  way that happens by accident is `uv run --directory …`, so prefer
  `uv --project … run …` and set `MEMORY_DB_PATH` for anything long-running.
- **The GUI is where you decide things.** Approving entities, resolving contradictions,
  and promoting knowledge are human-only actions, by design. Agents propose; you rule.
- **You cannot break it from a Claude session.** Nothing an agent can call deletes
  knowledge, edits trust, or approves its own proposals.

## Execution-mode routing

| Change shape | Mode | Validity path |
|---|---|---|
| Multi-phase, needs judgment or manual gates | `/gw-implement` (interactive) | human checkpoints |
| A defect or a behaviour-preserving refactor | `/gw-fix` (TDD) | a test that fails before the fix and passes after; full suite between steps |
| Clear, bounded, plan already exists | `/gw-goal` or `claude -p` (headless) | deterministic rules + evaluator agent; humans only at PR/merge |

One change per worktree, one fresh agent context per change. Parallelism is capped
by review capacity — more agents without review is more unreviewed code, not more
throughput.

## Provenance

- Integration design: `docs/05_10X_INTEGRATION.md` in agentic-memory-system
  (graph-replaces-folders, one-merged-lifecycle, the MCP surface, skills↔calls
  binding).
- Domain entities and consolidation: `docs/06_DOMAIN_ENTITIES.md` and
  `docs/07_CONSOLIDATION.md` in agentic-memory-system — the reasoning behind
  `/gw-domain` and `/gw-consolidate`, including why the class was refactored from
  "reference entities" and why both operations end at a human.
- 10x framework reference: `reference/10x-workflow` in mt3o-dev/dx-workflow
  (10xDevs AI Toolkit).
- The `memory-*` skills shipped with agentic-memory-system are the primitive
  bindings; the `gw-*` skills here are the merged lifecycle that sequences them.
