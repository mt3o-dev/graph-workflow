---
name: gw-plan-review
description: Review a change's plan.md against the memory graph BEFORE implementation — fresh session, mandatory recall of the goal's settled constraints/invariants, independent check that the plan respects them, verdict routing to /gw-implement, /gw-goal, or back to /gw-plan. Use after /gw-plan, before any implementation starts. Trigger phrases: "review the plan", "check the plan", "is this plan good", "/gw-plan-review".
---

# gw-plan-review

The plan gate. `/gw-plan` checks itself against the constraints it recalled — but
a plan violating a constraint its author misread is exactly what self-review
cannot catch. This skill is the independent read: same pattern as `/gw-review`
Part 1, one gate earlier, where a caught violation costs a plan edit instead of
an implementation rework.

Runs as a **fresh agent session with a clean context** — it must not inherit the
planner's belief about what the constraints were. Recall is the only channel
carrying the acceptance criteria in; that is the point, not an inconvenience.

## Steps

1. **Load the scope.** `memory_goal` from `context/changes/<change-id>/change.md`;
   read `plan.md` (and `research.md` if present). No `memory_goal` → stop, run
   /gw-new's scope steps first. No `plan.md` → there is nothing to review; route
   to /gw-plan.

2. **Recall the acceptance criteria — mandatory:**

   ```
   recall_context(query="<goal text + the subsystems the plan touches>",
                  goal_ref=<goal_node_id>)
   ```

   The **settled** `constraint`/`invariant` blocks (`tier=lifetime`/`long-term`)
   are the spec the plan must satisfy. Recall independently — do not take the
   plan's own `[node:<id>]` citations as the universe of relevant knowledge; the
   citations show what the planner *saw*, the recall shows what they *should have
   seen*. A constraint present in recall but absent from the plan's reasoning is
   the primary finding this gate exists for.

3. **Check the plan against the bundle:**
   - Every settled constraint/invariant touching the plan's subsystems: respected,
     explicitly contradicted (a CONTRADICTS capture exists per /gw-plan step 5),
     or silently violated? Silent violation is a request-changes finding.
   - Every recalled node the plan supersedes: was `impact_of` run (the plan's risk
     section should show the blast radius)? A supersession with unexamined
     dependents is a finding.
   - `disputed` blocks: the plan must take a side *openly* (per /gw-plan rules).
     A plan built silently on one side of a dispute is a finding. Do NOT
     adjudicate the dispute yourself — that is the Part 2 human gate at PR time.
   - Standard plan-review substance checks: phases end in verifiable states,
     verification commands exist (hard requirement if the change routes to
     /gw-goal), non-goals explicit, risks have mitigations.

4. **When the plan contradicts a settled constraint — it depends.** The direction
   is the developer's judgment at the moment it happens, never a default:
   - the plan is wrong and the constraint stands → request changes;
   - the plan is right and the constraint is obsolete → the plan must say so with
     a CONTRADICTS capture (route back to /gw-plan step 5 if missing), letting
     the flag reach the human review queue.

   Surface the conflict with both readings and the evidence; never silently pick
   one.

5. **Journal the review** — one batched `append_events`: `REVIEWED` for nodes
   re-assessed with no new evidence, `USED` for nodes the verdict genuinely
   leaned on. No `CONFIRMED` here — a plan review exercises nothing; confirmation
   belongs to implementation and code review.

## Verdict

Close with one of:
- **Approve** — plan respects or openly contradicts every settled constraint,
  supersessions are impact-traced, disputes are taken openly → route to
  /gw-implement (interactive) or /gw-goal (headless, iff per-phase verification
  commands exist).
- **Request changes** — findings most-severe first, each citing the violated
  `[node:<id>]` and the plan section. Rework happens in /gw-plan under the same
  change-id.

## Rules

- Fresh context, mandatory recall — reviewing a plan without loading the graph is
  reading prose, not gating a change.
- Never adjudicate disputes, clear flags, promote tiers, or mutate trust; the
  gate surfaces, the human resolves.
- An empty finding list is a valid outcome — say so and route onward; do not
  manufacture findings.
- `context/archive/` paths → abort ("This change is archived. Open a new change
  with /gw-new.").
