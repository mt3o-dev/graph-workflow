---
name: gw-slice
description: Break an epic into an ordered list of tracer-bullet slices in the roadmap — each a thin vertical path through every layer, sized for one agent and one review, classified headless or interactive, with its blockers named. Writes the epic registry entry and captures why the order is what it is; opens only the first slice. Use when a goal is too big for one change, after /gw-ideate or a fresh PRD and before the first /gw-new. Trigger phrases "slice this", "break this down", "this is an epic", "turn the PRD into changes", "/gw-slice".
---

# gw-slice

Four skills read the epic registry in `context/foundation/roadmap.md`. Until now
nothing wrote it — the entire slicing method lived as a parenthetical inside step
1 of `/gw-new`, a skill whose job is opening *one* change:

> *"register it in `context/foundation/roadmap.md` (epic id, outcome sentence,
> ordered slice list — each slice a future change-id delivering something
> end-to-end verifiable)"*

That is a real method compressed into a clause, in the wrong place, with no human
gate. This skill is the producer.

Two commitments make it gw-shaped rather than a generic breakdown prompt:

- **Slices are tracer bullets, never layers.** A slice that delivers "all the
  schema" is unverifiable until the last one lands, which means the plan has no
  feedback until it is too late to use.
- **The ordering is knowledge.** *Why* these seams, in *this* order, is exactly
  what the third slice needs and nobody will remember. It gets captured; the
  slice list itself does not.

## Preconditions

- The work is genuinely epic-sized: it spans multiple subsystems, implies more
  than about five phases, or reads like a product ("build the app", "rebuild
  reporting"). If one agent can implement it against one `plan.md` and one human
  can review it in a sitting, it is a **change** — go straight to `/gw-new`.
- A source exists: a `roadmap.md` entry from `/gw-ideate`, a `prd.md`, a plan, or
  a conversation that has converged.

---

## Step 1 — Ground yourself

```
recall_context(query="<the epic's outcome> sequencing dependencies constraints",
               goal_ref=<foundation memory_goal from context/foundation/foundation.md>)
```

What you are looking for is the class of constraint that **reorders a slice
list**: *"payments cannot ship before KYC"*, *"the importer must be idempotent
before anything schedules it"*. A settled sequencing constraint outranks your
instinct about what to build first, and finding one after slice 2 is in flight is
expensive.

Also read `context/foundation/roadmap.md` for epics already registered. An epic
whose slices overlap an in-flight one is a conversation, not a second registry
entry.

## Step 2 — Draft the slices

Each slice is a **thin vertical path through every layer** — schema, API, UI,
tests — narrow in scope and complete in depth.

- A completed slice is **demoable or verifiable on its own**.
- Prefer many thin slices to few thick ones.
- The anti-pattern is the horizontal slice: "do all the schema", then "do all the
  API". It looks efficient and produces nothing testable until the end.

Name each slice as a future change-id (`coffer-core-import`,
`coffer-classification`) — kebab-case, and the same id `/gw-new` will use.

## Step 3 — Classify each slice, and let the never-headless list decide

Every slice gets an execution mode, from the routing table this workflow already
has:

| mode | when | validity path |
|---|---|---|
| `/gw-goal` (**headless**) | clear, bounded, the plan will be enough | deterministic rules + evaluator; humans at PR only |
| `/gw-implement` (**interactive**) | multi-phase, needs judgment or manual gates | human checkpoints |
| `/gw-fix` (**TDD**) | a defect or a behaviour-preserving refactor | a test that fails before and passes after |

**A slice that needs a never-headless skill cannot be headless.** The list is
`/gw-goal`'s, not one to re-derive here: `/gw-domain`, `/gw-wireframe`,
`/gw-prototype`, `/gw-slice`, `/gw-grill` and `/gw-teach` are never headless, and
`/gw-fix` only is when someone else already wrote the failing test. So:

> A slice touching a UI surface is **interactive**, mechanically — and so is one
> that will need an argument (`/gw-grill`) or a domain pass. Not a judgment call:
> check the slice against `/gw-goal`'s list rather than deciding, because this is
> exactly what gets waved through at 4pm.

Prefer headless where it is genuinely true. Do not manufacture it: a slice marked
headless that turns out to need a human wastes a whole unattended run and lands
work nobody watched.

## Step 4 — Quiz the user (the gate)

Present the breakdown as a numbered list. Per slice: **title**, **mode**,
**blocked by**, and which user stories or outcomes it covers.

Then ask, and iterate until they approve:

- Does the granularity feel right — too coarse, too fine?
- Are the dependencies correct?
- Should any slice be merged, split, or dropped?
- Are the right ones interactive?

**Give your recommendation with each question.** A bare question makes the user
do the work twice; they are ruling on your proposal, not producing one.

This is the cheapest correction point in the whole epic. A wrong slice boundary
discovered here costs a paragraph; discovered in slice 3 it costs a re-plan and
usually an archive.

## Step 5 — Write the registry, capture the reasoning

Write the epic entry into `context/foundation/roadmap.md`:

```markdown
## Epic: coffer-mvp
Outcome: a person can import a statement, classify what it contains, and see
where their money went — end to end, on their own machine.

| # | slice | mode | blocked by | delivers |
|---|---|---|---|---|
| 1 | `coffer-core-import` | headless | — | statement text → normalized, deduped Transactions in SQLite |
| 2 | `coffer-classification` | headless | 1 | rules assign a Group to a Transaction; unmatched surface for review |
| 3 | `coffer-review-ui` | interactive | 2 | the triage screen — needs /gw-wireframe, so never headless |
| 4 | `coffer-dashboard` | interactive | 2 | cashflow and category breakdown |
```

Then capture the reasoning — and **only** the reasoning:

```
capture_artifact(type="decision", goal_ref=<foundation memory_goal>,
  facets=["planning"],
  content="Epic coffer-mvp is sliced import-first because classification's
           acceptance criteria assume a settled Transaction record; the reverse
           order leaves slice 2 with nothing to assert against. Slices 3-4 are
           interactive because both need /gw-wireframe, which is never headless.")

capture_artifact(type="issue", goal_ref=<foundation memory_goal>,
  content="<a scope gap deliberately left out of this epic, and why>")
```

**Do not capture the slice list.** It is sequencing, like `plan.md` — it lives in
`roadmap.md`, changes as reality arrives, and `/gw-archive` marks it off. What
outlives the epic is *why the order was what it was*.

Then one batched `append_events`.

## Step 6 — Open the first slice, and only the first

Hand off to `/gw-new` with slice 1's change-id. **Do not open the rest.**

Three reasons, each from a commitment this workflow already made:

1. **Review capacity is the parallelism cap.** Eight change folders invite eight
   agents and one reviewer, which is more unreviewed code, not more throughput.
2. **`create_change` mints a Goal node and a liveness root.** Eight goal nodes for
   work not started puts eight live roots in the graph, and the sweep will never
   retire anything they keep reachable.
3. **`/gw-new` wires `parent_refs` from the *archived* siblings.** Wiring them now
   would point at nodes that do not exist yet; wiring them at slice N's opening is
   what makes slice N's first recall pull everything slices 1..N-1 settled.

## Step 7 — The tracker, if the project has one

Skip entirely when `context/foundation/tracker.md` says `tracker: none`.

Otherwise **offer** — never do it unasked, because it is outward-facing and other
people will see it — to open one parent item for the epic and one child per
slice, in dependency order so real identifiers can be referenced. That is work
state becoming visible to people outside the session, which is exactly and only
what `/gw-track` is for. The graph still holds the knowledge; the tracker still
holds no decisions.

---

## Rules

- **Tracer bullets, not layers.** Every slice cuts through every layer, or it is
  not a slice.
- **One registry entry, one first change.** Never open slice 2 "while you're
  here".
- **Never capture the slice list**, only the reasoning behind its order.
- **The never-headless list is a check, not an opinion**, and it is the one in
  `/gw-goal` — do not inline a subset here, because a subset silently passes a
  slice `/gw-goal` will then refuse to run.
- **Recommend, then let the human rule.** Every question in step 4 carries your
  answer.
- **An epic that overlaps an in-flight one is a conversation**, not a second
  registry entry.
- Standing rules apply: recall before deciding, one batched `append_events`,
  honest events only, no trust/flag/tier mutation, `context/archive/` untouched.
