---
name: gw-implement
description: Execute a change's plan.md phase by phase, interactively, with the memory loop running — recall before each phase, capture at each phase boundary, batched feedback at each phase end. Use for multi-phase or judgment-heavy changes with manual gates; use /gw-goal for bounded headless work. Trigger phrases: "implement the change", "run phase N", "/gw-implement".
---

# gw-implement

Interactive execution with human checkpoints. The memory loop runs at phase
granularity: a phase is exactly the unit at which context is loaded, residue is
captured, and usage is journaled. Skipping the loop on "just a small phase" is how
graphs rot.

## Per-phase cycle

For each phase of `context/changes/<change-id>/plan.md` (with `memory_goal` from
change.md):

1. **Recall for the phase:**

   ```
   recall_context(query="<what this phase does>", goal_ref=<goal_node_id>)
   ```

   The bundle now includes the plan-boundary decisions from /gw-plan — they come
   back with `[node:<id>]` handles, which is how the plan's WHY reaches the
   implementing agent even in a fresh context. Reason with `disputed` blocks
   openly; note which nodes you rely on.

2. **Implement the phase.** Follow the plan; standard 10x-implement discipline
   (small verifiable steps, run the checks the phase names, stop at the gate).
   Navigate unfamiliar code through the **graphify MCP** when the project has a
   code knowledge graph (`graphify-out/` present) — graph queries before raw
   grep/read. While working:
   - Reality contradicts a recalled node → record it now, not at the end:
     `link(source=<new-or-existing-id>, target=<id>, type="CONTRADICTS")` if the
     correcting knowledge is already a node, else capture the correcting artifact
     with a CONTRADICTS edge. The `side_effects` field reports what got flagged —
     that is transparency, not damage.
   - Before deviating from a planned decision, `impact_of(<its node id>)` — a
     deviation with dependents is a re-plan, not an improvisation.

3. **Capture at the phase boundary** — the durable residue only:
   - `decision` — choices made *during* implementation that the plan didn't make;
   - `constraint` / `invariant` — discovered, not designed ("the payment webhook
     retries; the handler must be idempotent");
   - `issue` — problems found and left standing.
   Each with `goal_ref`, facets, and edges to what it builds on or contradicts.
   Not captured: narration, diffs, file paths that churn, anything git already
   records.

4. **Journal the phase** — one batched call:

   ```
   append_events([
     {"event_type": "USED", "node_ref": "<id>", "reason": "phase 2 schema followed this"},
     {"event_type": "CONFIRMED", "node_ref": "<id>", "reason": "ran the migration; invariant holds"},
   ])
   ```

   `CONFIRMED` means you actively verified it (ran it, tested it) — stronger than
   USED; don't inflate. Unreported phases are invisible to the graph.

5. **Gate.** Report phase outcome to the human: what shipped, what was captured
   (the `[node:<id>]` list), any flags raised. Wait for the go-ahead where the
   plan marks a manual gate.

## After the last phase

- Update `change.md` status to `implemented`.
- Route to `/gw-review` — it collects every disputed node this change touched into
  the PR's human gate.

## Phase-parallel execution (orchestrator + subagents)

Phases may run as parallel subagents under one orchestrating session, sharing
the change's single memory scope — under these conditions, learned the hard way:

- **Disjoint file ownership, declared up front.** Each phase agent gets an
  explicit owns/must-not-touch list; shared files (package.json, build config,
  lockfiles, workspace/monorepo manifests) are **orchestrator-owned** — a
  parallel phase that needs a dependency requests it rather than editing the
  manifest, because two agents editing package.json concurrently produce
  duplicate keys and lockfile churn (observed in dogfood #2).
- **Shared contracts are authored before the consumers launch.** When several
  parallel phases implement against one interface (a port, a schema), the
  orchestrator writes that contract file first and marks it read-only for the
  implementers — pure implementers never race a shared file (dogfood #2 ran
  three concurrent adapter agents against three pre-authored ports with zero
  collisions).
- **No scratch artifacts in `src/`.** Agents cannot `rm` (permission policy), so
  a proof/probe file written into the tree lives forever and gets re-verified
  every phase. Throwaway artifacts go under a gitignored scratch dir
  (`.gw-scratch/`), never into source.
- **Cross-phase contracts are captured before the consumer starts.** If phase B
  will assume something phase A produces (a selector convention, an API shape,
  a schema), that contract is a `constraint` artifact (or backlog entry) BEFORE
  B launches — two agents "agreeing by luck" is a review finding waiting to
  happen.
- **Per-phase capture/journal headings**, so interleaved appendices stay
  attributable; the orchestrator re-verifies the merged state itself before
  calling the change implemented — each agent's green is necessary, not
  sufficient.

## Rules

- The loop is per-phase, not per-change. One giant recall at the start and one
  capture dump at the end defeats ranking, staleness, and fresh-context handoff
  alike.
- Never mutate trust, clear flags, promote tiers, or archive — the surface cannot,
  and that is the safety model, not a limitation to work around.
- Events are honest or absent: only journal nodes you genuinely engaged with.
- Any write path resolving under `context/archive/` → abort ("This change is
  archived. Open a new change with /gw-new.").
