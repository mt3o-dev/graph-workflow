---
name: gw-grill
description: Interrogate a plan or a design against settled knowledge — one question at a time, each with a recommended answer — running impact_of on every load-bearing claim until the disagreements are on the table. Challenges terminology against the ratified domain model, cross-references what you say against what the code does, and captures the rulings with CONTRADICTS edges where they overturn something settled. Use before /gw-plan, or on an existing plan before /gw-plan-review. Trigger phrases "grill me", "stress-test this", "challenge this plan", "poke holes in it", "/gw-grill".
---

# gw-grill

Several skills here talk to a human — `/gw-wireframe` about screens, `/gw-domain`
about nouns, `/gw-slice` about a breakdown, `/gw-resolve` about a queue. Every one
of them is a conversation *about a specific artifact*, held once that artifact
exists.

None of them argues with the reasoning **before** the artifact does. That is what
the gates are for, and gates are the wrong shape for it: `/gw-plan-review` runs as
a fresh session with a clean context precisely so it *cannot* be argued with, and
`/gw-review` issues a verdict. Both are right to be gates — and neither is where
a wrong assumption is still cheap. That is this skill.

Two things make it more than a generic interrogation prompt:

- **The graph has trust weights and a blast radius.** A glossary can tell you a
  term is defined; `impact_of` can tell you that contradicting it breaks four
  other things settled in three previous changes. Challenge with that, not with
  an opinion.
- **The disagreements become knowledge.** A grilling session that ends in shared
  understanding and captures nothing has converted the user's attention into
  nothing durable, and the same argument happens again in two months.

## Preconditions

- A goal to capture against. Normally that is a change's `memory_goal`; **before
  a change exists** — grilling a PRD, an idea, a shape — use the foundation
  scope's `memory_goal` from `context/foundation/foundation.md`, exactly as
  `/gw-ask` and `/gw-ideate` do. A goal-less capture is rejected, so one of the
  two must be present.
- There is something to grill: a plan, a design, a shape, or a firm intention.
  Grilling a genuinely empty idea produces vague answers — route to
  `/gw-research` first. But *thin* is not empty: a conversation that has
  converged on a direction without settling its edges is exactly what this skill
  is for, and it is where `/gw-foundation` sends work it cannot synthesise a PRD
  from.

## What this is not

**It is not a second plan gate.** It produces a sharpened plan and captured
decisions; it never issues a verdict. `/gw-plan-review` stays the gate, and stays
a fresh session with a clean context — that independence is the whole reason it
catches things, and a grilled plan still has to face it.

---

## Step 1 — Ground yourself, and open where it is already contested

```
recall_context(query="<the plan's subject and the subsystems it touches>",
               goal_ref=<goal_node_id>)
domain_model(status="confirmed")
```

Pull every **`disputed`** node in the bundle to the front and start there. Those
are live contested ground — someone already disagreed and nobody ruled. Finding
one at question nine, after eight questions built on the assumption it was
settled, wastes the whole session.

## Step 2 — Walk the tree, one question per turn

Build the decision tree the plan implies, and walk one branch at a time,
resolving dependencies between decisions before the decisions that rest on them.

**One question per turn, then stop and wait.** A numbered list of nine questions
gets three answered.

**Every question carries your recommended answer and the cost of the
alternative.** You are asking them to *rule*, not to generate. A bare question
makes the user do the work twice, and people are far better at correcting a wrong
proposal than producing one from nothing.

**Explore instead of asking.** If the codebase, the graph or the deck can answer
it, go and find out. Their attention is the scarcest thing here.

## Step 3 — The four challenge modes

**Against the domain model.** Not a glossary file — `domain_model(status="confirmed")`.
When a term conflicts with a ratified entity, say so immediately: *"the model
defines Cancellation as the whole order; you seem to mean a line item — which is
it?"* A term the model lacks is either a `/gw-domain` proposal or the wrong word.
It is never a word you quietly coin mid-plan.

**Against settled constraints.** Run `impact_of` on every load-bearing claim,
then say it plainly:

> That contradicts `[node:8b947296]` — *"the accent only appears on something
> interactive"* — settled in `pmview-drawer-upgrades`, and three nodes depend on
> it. Which is right?

**This is the mode files cannot do.** A glossary has no trust weight and no
dependents; the graph can tell you what breaks.

**Concrete scenarios.** When relationships are being discussed, invent the edge
case that forces precision about a boundary. *"A refund arrives for an order that
was already partially cancelled — which record moves?"* Vague agreement survives
abstraction and dies on a specific example, which is exactly what you want it to
do, now, rather than in review.

**Against the code.** When they state how something works, check. A contradiction
between what the user believes and what the code does is a **finding**, not an
awkwardness — and it is frequently the most valuable thing the session produces.

## Step 4 — Capture as decisions crystallise

Two disciplines meet here and both are right, about different things:

> **Capture artifacts inline**, the moment a decision crystallises — they are
> immutable statements, and batching them loses the reasoning that made them.
> **Batch the events** — one `append_events` at the end, which is what the
> ranking path expects.

Apply **the three-part test** to every candidate before capturing it: hard to
reverse, surprising without context, the result of a real trade-off. All three,
or it was conversation. This skill generates more capture candidates per hour
than any other in the workflow, which is exactly why it needs the filter most —
a graph full of restated obviousness ranks worse than a small one.

```
capture_artifact(type="decision", goal_ref=<goal_node_id>, facets=[...],
  content="Partial cancellation moves the LineItem, not the Order: the Order's
           total is derived, so mutating it would give two sources of truth for
           the same number.",
  edges=[{"target": "<Order entity id>", "type": "ABOUT", "direction": "out"}])
```

## Step 5 — When a ruling overturns something settled

The pattern the rest of this workflow already uses, verbatim:

```
capture_artifact(type="decision", goal_ref=..., content="<the ruling, and why>")
link(source=<that decision>, target=<the superseded constraint>, type="CONTRADICTS")
```

Then **stop before applying**. Do not retire, archive or re-weight the old node —
none of that is yours to do. `CONTRADICTS` raises the review flag; the human
rules through `/gw-resolve` or the review GUI, where trust is folded and
promotion is gated. An agent that resolved its own contradiction would be the
safety invariant breaking in the one place it matters most, and it would be
invisible.

## Step 6 — Hand off

Report: what was settled and its `[node:<id>]`s, what was surfaced and left open,
every contradiction raised and who must rule on it, and the questions you chose
not to ask because the code or the graph answered them.

Then route: `/gw-plan` if there was no plan, `/gw-plan-review` if there was.

---

## Rules

- **One question per turn, with a recommendation.** Both halves.
- **Explore before asking.** Every question you could have looked up costs
  attention you will want later.
- **Never issue a verdict.** That is `/gw-plan-review`, and it must stay
  independent.
- **Never resolve a contradiction you surfaced.** Capture, link, stop.
- **The three-part test gates every capture.** This skill needs it most.
- **Never coin domain vocabulary.** A missing term is a `/gw-domain` proposal.
- **A disputed node is where you start**, not something you discover late.
- Standing rules apply: recall before deciding, one batched `append_events`,
  honest events only, no trust/flag/tier mutation, `context/archive/` untouched.

## Degradation

An empty or near-empty graph makes **two** of the four challenge modes
unavailable — there are no settled constraints to run `impact_of` against, and no
ratified entities to check terms against. Concrete scenarios and cross-referencing
the code still work, and are still worth the session. **Say which two you lost.** The session is then opinion against opinion,
which is still useful and is not what this skill claims to be. Offer
`/gw-foundation` or `/gw-domain` first if the project is old enough to have
knowledge worth loading.
