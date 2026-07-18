---
name: gw-plan
description: Produce an implementation plan grounded in the memory graph. Use after /gw-new (and /gw-research when it ran) — recalls the goal's subgraph, traces the blast radius of anything the plan would supersede, writes phased plan.md, and captures the plan's decisions as graph artifacts at the plan boundary. Trigger phrases: "plan this change", "write the plan", "/gw-plan".
---

# gw-plan

Planning is where decisions get made — which makes the plan boundary the single
highest-value capture point in the lifecycle. A plan that lives only in plan.md is
invisible to every future change; the decisions go in the graph, the sequencing
goes in the file.

## Steps

1. **Load the scope.** `memory_goal` from `context/changes/<change-id>/change.md`;
   read `research.md` if present. Then:

   ```
   recall_context(query="<what the plan must accomplish>", goal_ref=<goal_node_id>)
   ```

   Constraints and invariants in the bundle are load-bearing: a plan that violates
   a recalled `constraint` node must either respect it or explicitly contradict it
   (step 3) — never silently ignore it.

2. **Draft the approach.** Standard 10x-plan discipline: phases that each end in a
   verifiable state, explicit non-goals, risks with mitigations, files touched per
   phase. Reference recalled knowledge by its `[node:<id>]` handle in the draft so
   provenance survives review.

3. **Trace impact before superseding.** For every recalled artifact the plan would
   change, relax, or redefine (a decision to reverse, a constraint to loosen, a
   concept to remodel):

   ```
   impact_of(node_ref=<id>)
   ```

   - Dependents return nearest-first with `depth=<n>`; wide/deep results mean the
     change is not local — surface that in the plan's risk section and consider
     splitting the change.
   - Empty result → safe to supersede in isolation.
   - If you discover a real dependency the graph lacks, add the edge (capture or
     `link`) so the next trace is complete.

4. **Write `plan.md`** to `context/changes/<change-id>/plan.md`. Keep it thin:
   phases, per-phase verification, file lists, and the `[node:<id>]` references.
   The plan file is execution sequencing; the WHY lives in the graph.

5. **Capture at the plan boundary** — this is the mandated capture point. For each
   decision the plan embodies:

   ```
   capture_artifact(content="<the decision and why, readable cold>",
                    type="decision",
                    goal_ref=<goal_node_id>,
                    facets=["<subsystem>"],
                    edges=[{"target": "<recalled-id>", "type": "DEPENDS_ON", "direction": "out"}],
                    tier="short-term")
   ```

   - Also capture new `constraint`s the plan introduces and `concept`s it settles.
   - A decision that reverses a recalled node gets a CONTRADICTS edge to it — you
     are recording that the conflict exists; the flag and review it triggers are
     transparent side-effects, not yours to manage.
   - One statement per artifact. `tier` stays short/mid — promotion is never
     the agent's call.

6. **Journal the session** — one batched `append_events` with USED/CONFIRMED/
   CONTRADICTED for the recalled nodes the plan actually leaned on.

7. **Hand off.** State the phase count, the captured `[node:<id>]` list, any
   disputed nodes the plan takes a side on, and route to `/gw-plan-review` — the
   independent plan gate (fresh session) that must pass before implementation.
   It approves onward to `/gw-implement` (multi-phase or judgment-heavy) or
   `/gw-goal` (bounded mechanical), or sends the plan back here.

## Rules

- No plan without recall; no supersession without `impact_of`. These two reads are
  the difference between planning and guessing.
- Plans conflict with memory openly or not at all: every violated constraint is
  either resolved in the plan text or recorded as CONTRADICTS.
- Do not restate the whole plan into the graph — capture decisions, not prose. The
  sequencing belongs to plan.md and dies gracefully with the change.
- plan.md paths under `context/archive/` → abort ("This change is archived...").
