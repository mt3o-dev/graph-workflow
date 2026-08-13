---
name: gw-ideate
description: Find feature ideas and development potential the project has earned but not noticed — mining the memory graph's deferred issues, accepted gaps, unused capabilities and domain blind spots, plus the codebase and roadmap. Produces a ranked, evidence-backed opportunity list routed to the roadmap; never opens changes or writes code. Use at roadmap time, after an epic closes, or when asked "what should we build next". Trigger phrases "feature ideas", "what could we build", "find opportunities", "product ideas", "/gw-ideate".
---

# gw-ideate

Most "what should we build next" sessions produce plausible generic features: an agent
pattern-matches the product category and suggests what similar products have. That output
is worthless — the team could have written it themselves, faster.

This skill produces something else: the ideas **this specific project has already earned
and not noticed**. A graph-workflow project accumulates, over months, a precise record of
every problem it deferred, every gap it accepted, every constraint it worked around, and
every capability it built and under-used. That record is an opportunity backlog nobody
reads, because each item was filed one change at a time and none of it was ever looked at
together.

The rule that makes this useful: **every idea cites its evidence.** An idea with no
`[node:<id>]`, no `file:line`, and no user-stated need is a guess — cut it, however
attractive. Guesses are what the team can already produce; grounded ideas are not.

## Preconditions

- Not a change. Ideation produces a roadmap input, not an implementation. Use the
  **foundation scope's** `memory_goal` (from `context/foundation/foundation.md`) so recall
  ranges across the whole project rather than one change's cone.
- If the project has no foundation scope, say so and run against files/code only — the
  yield will be much lower, and `/gw-foundation` is the fix.

## Step 1 — Mine the graph (this is the differentiator; do it first and properly)

Run these as separate recalls — a single broad query returns one ranked list and loses the
distinct angles:

```
recall_context(query="known limitations accepted gaps not supported in v1", goal_ref=<foundation-goal>)
recall_context(query="deferred postponed out of scope for now", goal_ref=<foundation-goal>)
recall_context(query="workaround manual step users have to", goal_ref=<foundation-goal>)
recall_context(query="performance limit scale ceiling", goal_ref=<foundation-goal>)
stale_nodes()
domain_model()
```

Six seams, each producing a different kind of idea:

| Seam | What you are looking for | The idea it yields |
|---|---|---|
| **`issue` nodes** | Problems captured and left standing | The backlog the team already agreed exists — highest-confidence source in the whole pass |
| **Accepted gaps** | "No multi-currency in v1", "single-tenant only" | Deliberate deferrals whose reason may have expired — check the reason, not just the gap |
| **Workarounds** | Constraints describing a manual step or a compensating control | Automation opportunities with the pain already documented |
| **Under-used capability** | Infrastructure the graph shows was built, that few artifacts depend on (`impact_of` returns little) | Something already paid for and not yet monetized — the cheapest ideas on the list |
| **Domain blind spots** | Entities with few or no artifacts `ABOUT` them; entities the users name that the code has no representation for | Whole product areas the project named and never built |
| **Recurring disputes** | The same territory generating repeated CONTRADICTS across changes | A model that does not fit reality — usually a rethink, not a feature |

The last two only work on a project with a modelled domain and worked review queue. Say so
if they come back thin; it is a signal about the graph, not about the product.

## Step 2 — Read the roadmap and the code, second

- `context/foundation/roadmap.md` — what is already planned. An "idea" that is a known
  roadmap item is not an idea; it is a duplicate, and listing it burns credibility.
- The codebase for **capability adjacency**: what does the system already do that it does
  not expose? A parser that handles four formats and surfaces two; an analytics module
  richer than its one screen. Graphify MCP first where a code graph exists.
- Extension points that exist and have one implementation — ports with a single adapter
  are usually a designed-for future that was never built.

## Step 3 — Generate, then cut hard

Aim for **6–10 surviving ideas**, not thirty. A long list is not thoroughness; it is
unranked and therefore unusable.

Per idea, in one compact block:

```
### Bulk re-classification from a corrected rule
Evidence:   [node:0af3] issue "users correct the same merchant repeatedly, one row at a time"
            [node:11c2] decision "classification rules apply at import only"
            src/lib/core/classify/run.ts:44 — engine already supports replay over a range
Shape:      When a rule is corrected, offer to re-run it over already-imported history.
Effort:     S — the engine supports it; the work is a confirm dialog and a progress state.
Confidence: High — the pain is captured, the capability exists.
Depends on: nothing
Risk:       re-classification must not silently overwrite manual assignments ([node:0af3])
```

Then cut. Remove anything that: cites nothing; duplicates the roadmap; is a generic
category feature ("add AI", "add a mobile app", "add SSO") with no project-specific
evidence; or is really a bug (route it to `/gw-fix`) or a refactor with no user-visible
outcome.

Say what you cut and why. The cut list is evidence of judgment; a list that survived
nothing is a list nobody screened.

## Step 4 — Rank on two axes and lead with the corner

Rank by **evidence strength** (is the need documented, or inferred?) and **cost**
(does the system already do most of this?). Lead with the high-evidence/low-cost corner —
those are the ideas the project has already paid for and not collected on. Group the rest;
do not force a total order that the evidence does not support.

Mark each as **feature** (new capability), **leverage** (expose something built),
**removal** (a gap that no longer needs closing — the reason expired), or **rethink** (a
model that keeps generating disputes). The last two are the ones a generic ideation session
never produces.

## Step 5 — Capture what is durable, route the rest

Capture as artifacts — the *findings*, not the wish list:

```
capture_artifact(type="issue", goal_ref=<foundation-goal>, facets=[...],
  content="Rule corrections do not apply to already-imported history; users re-correct the same merchant per import. The classification engine already supports range replay.",
  edges=[{"target": "<transaction-entity-id>", "type": "ABOUT", "direction": "out"}])
```

- Newly-discovered gaps and blind spots → `issue` nodes. They are true whether or not
  anyone builds the idea, and they will surface in every future recall on that territory.
- An expired deferral reason → capture the finding with a `CONTRADICTS` edge to the
  constraint that deferred it. That is a genuine contradiction and belongs in review.
- The **ranked idea list itself** goes to `context/foundation/roadmap.md` (the epic
  registry), not the graph. Ideas churn; the graph should not.

Do **not** capture speculative features as `decision` nodes. Nothing was decided, and a
speculative decision node ranks in future recalls with the same authority as a real one.

## Step 6 — Hand off

Report: the ranked list with evidence, the cut list with reasons, what was captured, and
what you propose adding to the roadmap. Then stop.

Turning an idea into work is `/gw-new` — the user's call, one idea at a time, with the
size check that skill applies (most ideas here are epic-sized and get sliced).

## Rules

- **Evidence or cut.** Every surviving idea cites a `[node:<id>]`, a `file:line`, or a
  user statement. No exceptions, however good the idea sounds.
- **Read-only toward the codebase.** Ideation never edits source.
- **No changes opened, no plans written.** This produces roadmap input; routing is the
  human's.
- **Do not re-ideate what is planned.** Read the roadmap before generating, not after.
- **Bugs are not ideas.** Route them to `/gw-fix`. Refactors with no user-visible outcome
  are not ideas either — they are `/gw-fix` in refactor mode, or a captured `issue`.
- Journal one batched `append_events`: `USED` for nodes an idea rests on, `NOTED` for the
  seams you mined that came back empty (that is a real signal about graph coverage).
- Standing rules apply: no trust/flag/tier mutation, `context/archive/` untouched.
