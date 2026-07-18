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
/gw-implement / /gw-goal
            → per-phase recall → work → capture at phase boundaries → batched feedback
/gw-review  → impl review + the human memory gate (staleness queue, promotions)
merge       → /gw-archive: final capture, deactivate + sweep, folder → context/archive/
```

**User guide** (worked example, diagrams, edge cases, assumptions):
[docs/USAGE.en.md](docs/USAGE.en.md) · po polsku: [docs/USAGE.pl.md](docs/USAGE.pl.md)

**Pre-project intake checklist** (12 areas to settle before `/gw-init`):
[docs/INTAKE.en.md](docs/INTAKE.en.md) · po polsku: [docs/INTAKE.pl.md](docs/INTAKE.pl.md)

## Core commitments (inherited, non-negotiable)

- **Goal-mandatory writes.** Every captured artifact serves a Goal node
  (`memory_goal` in `change.md`). The MCP surface rejects goal-less writes.
- **Safety invariant.** Nothing an agent can call mutates trust, clears a review
  flag, promotes a tier, or archives a node. Trust is *folded* from the journal;
  flags resolve via the evaluator/human ladder; archival is a merge consequence.
  Never add such a tool "for convenience".
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
| `gw-new` | `10x-new` | `create_change`, goal-id recording, seed `recall_context` |
| `gw-research` | `10x-research` | recall-first research, contradiction surfacing, feedback |
| `gw-plan` | `10x-plan` | recall, `impact_of` pre-checks, plan-boundary capture |
| `gw-plan-review` | `10x-plan-review` | fresh-session independent recall, plan vs settled constraints, dispute-side check |
| `gw-implement` | `10x-implement` | per-phase recall, phase-boundary capture, batched feedback, `link` CONTRADICTS |
| `gw-goal` | `/goal` / `claude -p` | same discipline compressed for headless runs; rules-path validity, no human gates until PR |
| `gw-review` | `10x-impl-review` | staleness queue, disputed-node checklist, episodic→semantic consolidation, promotion candidates (human gate) |
| `gw-archive` | `10x-archive` | completeness check, deactivate + sweep, immutable folder move |

Skills are **judgment and sequencing**; MCP tools are **deterministic operations**.
Skills decide *when* to call; tools never embed judgment.

## Installation

### 1. Add agentic memory to the repo

Install the memory system once (it serves any number of projects):

```sh
git clone https://github.com/mt3o-dev/agentic-memory-system /path/to/agentic-memory-system
cd /path/to/agentic-memory-system && uv sync
```

Register the MCP server. Either user-wide:

```sh
claude mcp add agentic-memory -- uv run --directory /path/to/agentic-memory-system agentic-memory-mcp
```

or per-project, committed so every contributor gets it — `.mcp.json` in the
project root:

```json
{
  "mcpServers": {
    "agentic-memory": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/agentic-memory-system", "agentic-memory-mcp"]
    }
  }
}
```

**The store is project-local.** The server defaults to `context/memory-graph.db`
under the working directory it is launched in; set `MEMORY_DB_PATH` in the server
`env` only if you need a non-default location. One store per project — pointing a
shared store at two projects poisons both.

**Git rules for the store.** The SQLite file stays out of git (this repo's
`.gitignore` shows the pattern: `context/memory-graph.db*`); the legible text dump
is the sync format when a team shares memory:

```sh
uv run python scripts/dump_db.py      # before push
uv run python scripts/restore_db.py   # after pull
```

The human review GUI (staleness queue, tier promotion) runs from the same
install: `uv run agentic-memory-gui` → http://127.0.0.1:8765.

### 2. Install the skills

Copy (or symlink) the skill directories into the target project or your user
scope:

```sh
cp -r skills/gw-* ~/.claude/skills/          # user-wide
# or: cp -r skills/gw-* <project>/.claude/skills/
```

### 3. Wire the project

Append `CLAUDE.md.txt` to the target project's `CLAUDE.md`, then run `/gw-init`
inside the project — it scaffolds `context/`, verifies the MCP surface answers,
and checks the gitignore rules. If the project already has foundation docs
(PRD, ADRs, tech-stack), run `/gw-foundation` next so the first change's recall
has something to serve.

## Execution-mode routing

| Change shape | Mode | Validity path |
|---|---|---|
| Multi-phase, needs judgment or manual gates | `/gw-implement` (interactive) | human checkpoints |
| Clear, bounded, plan already exists | `/gw-goal` or `claude -p` (headless) | deterministic rules + evaluator agent; humans only at PR/merge |

One change per worktree, one fresh agent context per change. Parallelism is capped
by review capacity — more agents without review is more unreviewed code, not more
throughput.

## Provenance

- Integration design: `docs/05_10X_INTEGRATION.md` in agentic-memory-system
  (graph-replaces-folders, one-merged-lifecycle, the MCP surface, skills↔calls
  binding).
- 10x framework reference: `reference/10x-workflow` in mt3o-dev/dx-workflow
  (10xDevs AI Toolkit).
- The `memory-*` skills shipped with agentic-memory-system are the primitive
  bindings; the `gw-*` skills here are the merged lifecycle that sequences them.
