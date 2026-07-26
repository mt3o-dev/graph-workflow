<!-- BEGIN graph-workflow -->

## graph-workflow — change lifecycle with graph memory

This project uses the graph-workflow: the 10x change lifecycle fused with the
agentic-memory-system graph (MCP server `agentic-memory`). One lifecycle, not two
workflows — memory operations are steps inside it.

```
/gw-new → worktree → /gw-research → /gw-plan → /gw-plan-review → /gw-implement | /gw-goal → /gw-review → merge → /gw-archive
```

### Task router

| Situation | Skill |
| --- | --- |
| A question, no change open ("how does X work?", triage, onboarding) | `/gw-ask` (recall-only, foundation scope, journals usage, captures nothing) |
| Foundation docs written or amended (PRD, tech-stack, ADRs) | `/gw-foundation` (distill into lifetime-tier candidates) |
| Starting any unit of work | `/gw-new` (folder + Goal node + seed recall — always first) |
| Territory unknown | `/gw-research` (recall first, explore the gap, capture findings) |
| Ready to design the work | `/gw-plan` (recall + impact_of + plan.md + plan-boundary capture) |
| Plan written, before implementation | `/gw-plan-review` (fresh session, independent recall, plan vs settled constraints) |
| Multi-phase / needs judgment | `/gw-implement` (interactive, per-phase memory loop, human gates) |
| Bounded, verifiable by command | `/gw-goal` or `claude -p` (headless; humans at PR only) |
| Change reaches PR | `/gw-review` (code review + memory human gate) |
| Merged | `/gw-archive` (final capture, deactivate+sweep, folder → archive) |
| Disputes/promotions accumulated, human present | `/gw-resolve` (joint queue session: agent presents+recommends, human rules, applied via guided GUI API) |

### Standing rules (apply to every session)

- **Recall before deciding.** At task start and before touching an unloaded
  subsystem: `recall_context(query=..., goal_ref=<memory_goal from change.md>)`.
  Keep the `[node:<id>]` handles — they are write-back ids.
- **Goal-mandatory writes.** No `memory_goal` in change.md → run /gw-new's scope
  steps before capturing anything.
- **Capture residue, not narration** — decisions, constraints, issues, concepts,
  invariants; one statement per artifact, readable cold, with edges.
- **Speak the graph's vocabulary.** List the controlled facet vocabulary before
  the session's first capture (MCP vocabulary read if available, else GUI or the
  committed dump); query recalls with the graph's own terms, not paraphrases.
- **Navigate code through the graphify MCP** when the project has a code
  knowledge graph (`graphify-out/` present) — graph queries for architecture and
  file relationships first; raw grep/read is the fallback, not the default.
- **Journal every session** — one batched `append_events`
  (USED/CONFIRMED/CONTRADICTED/REVIEWED/NOTED) before ending. Honest events only.
- **Contradictions are recorded, never resolved** — CONTRADICTS edges and
  CONTRADICTED events flag for human review; that is the system working.
- **Never** mutate trust, clear flags, promote tiers, or archive nodes. Not
  possible via the agent surface; do not work around it.
- **Degraded mode (memory server down): queue, don't skip.** Append every
  would-be operation to `context/changes/<id>/memory-backlog.md` — create_change
  parameters, captures (content, type, edges, facets), events, promotion
  candidates — and replay them when the surface returns. Gates consume the
  backlog as the stand-in graph. The discipline never pauses; only the store does.
- **`context/archive/` is immutable.** If a resolved target path starts with
  `context/archive/`, abort with: "This change is archived. Open a new change
  with /gw-new."

### Paths

- `context/changes/<change-id>/` — active change: change.md (incl. `memory_goal`),
  plan.md, research.md. Thin lifecycle files only; knowledge lives in the graph.
- `context/archive/<change-id>/` — immutable, append-only.
- `context/foundation/` — PRD, roadmap, tech-stack: human source of truth, whose
  normative content is mirrored into the graph at lifetime tier via
  `/gw-foundation` (foundation.md carries that scope's `memory_goal`).
  `roadmap.md` doubles as the **epic registry**: epic-sized goals are sliced
  there into ordered change-ids; slices carry `epic: <id>` in change.md, the
  epic id as a capture facet, and sibling slices' surviving nodes as
  parent_refs. One change = one plan, one review sitting — epics are grouped,
  never merged into one change.
- `context/memory-graph.db` — the store (gitignored; sync via dump/restore
  scripts).

<!-- END graph-workflow -->
