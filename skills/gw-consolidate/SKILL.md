---
name: gw-consolidate
description: Run the consolidation pass — distil recurring knowledge into durable abstractions before it goes dormant. Detects cross-change recurrence, brings each candidate to the human with a proposed wording, and commits their decision as their scribe. Use at the review gate (episode summary), and periodically when several changes have archived. Trigger phrases "consolidate the graph", "consolidation pass", "abstract the recurring lessons", "/gw-consolidate".
---

# gw-consolidate

Every change leaves working knowledge behind, and the sweep sends it dormant. That is
correct — most of it *should* go dormant. But when three changes independently discover
the same thing, dormancy loses a real pattern: the graph keeps rediscovering it, one
change at a time, forever.

Consolidation is how a pattern outlives its episodes. It is **strictly additive**: it
mints an abstraction and wires it to its instances. Nothing is edited, merged, archived,
or re-tiered — the instances go dormant on their own schedule, and the abstraction stays
live because a human promoted it.

**The split you must respect.** Detection is deterministic and read-only, so you may run
it freely. Committing is privileged — a consolidated node exists to be *promoted past the
sweep*, so an agent that both abstracted and nominated its own abstraction would be
writing the project's long-term memory unsupervised. You bring the candidate and draft
the sentence; the human commits it.

## Two triggers

| Trigger | When | Threshold |
|---|---|---|
| **Episode summary** | Every change, at `/gw-review` step 4, before merge | None — always |
| **Recurrence** | Periodically, once several changes have archived; or when recall keeps returning near-duplicates | ≥3 live artifacts, from ≥2 distinct change scopes, sharing a facet |

The episode summary is already part of `/gw-review`; this skill is what runs the
recurrence pass, and what gives the episode summary its provenance edges.

---

## Part 1 — the episode summary (at `/gw-review`, per change)

One `concept` node distilling what the change did and why, written to be read cold by a
future change that recalls this territory:

```
capture_artifact(content="<what this change did, the outcome, and why — cold-readable>",
                 type="concept",
                 goal_ref=<goal_node_id>,
                 facets=[...],
                 edges=[{"target": "<key-decision-id>", "type": "CONSOLIDATES", "direction": "out"},
                        {"target": "<key-constraint-id>", "type": "CONSOLIDATES", "direction": "out"},
                        {"target": "<entity-id>", "type": "ABOUT", "direction": "out"}],
                 tier="mid-term")
```

`CONSOLIDATES` records **what this was distilled from**. It is a provenance channel only
— the retrieval walker never crosses it, deliberately, so recalling the summary does not
drag the dormant detail back in. That is the whole point: the summary is what survives,
the detail is what does not.

Also add `DEPENDS_ON` edges to the specifics you want *reachable* (the walker does cross
those), and `ABOUT` edges to the domain entities the change touched.

Then hand the summary to the human as a **promotion candidate**. An unpromoted summary
goes dormant with everything else, which defeats it entirely.

---

## Part 2 — the recurrence pass

### 1. Detect

```
consolidation_candidates()
```

Deterministic and read-only: clusters of live, un-promoted artifacts saying variations of
one thing, drawn from at least two distinct change scopes. Already-promoted nodes are
excluded (a human promotion is a stronger statement than any clustering) and
already-consolidated ones are excluded (so a worked candidate stops reappearing).

Empty is a normal and frequent outcome. Say so and stop — manufacturing a candidate to
have something to show is how a graph fills with vague abstractions that always rank and
never help.

### 2. Read the cluster before believing it

The detector finds *similarity*, which is not the same as *one idea*. For each candidate,
read the instances in full and rule on which of three things it is:

- **A real pattern** — the instances are independent discoveries of one truth. Consolidate.
- **Repetition inside one team's habits** — the same person wrote nearly the same node
  three times because the earlier ones were not recalled. Not an abstraction; it is a
  *capture-quality* finding and a *recall-quality* one. Report it as such.
- **A false cluster** — superficially similar, actually different (three constraints about
  "rounding" that concern money, dates, and pagination). Say so and move on.

`impact_of` each instance if you want to see whether they really live in different
neighbourhoods, and check whether they attach to the same domain entities — instances
`ABOUT` the same entity are much more likely to be a genuine pattern than instances that
merely share a facet.

### 3. Draft the abstraction — the highest-value thing you do here

The instances are three specific statements; the abstraction must be the one general
statement they are all instances of, and it must be **true of cases none of them cover**.
If your draft is just the longest instance reworded, there is no abstraction — report the
cluster as repetition instead.

```
instances:  "the payment webhook retries; the handler must be idempotent"
            "the carrier callback can fire twice; dedupe on the event id"
            "the billing cron re-runs after a deploy; guard the ledger write"
draft:      "Every externally-triggered handler in this system may be invoked more than
             once for one logical event; effects behind them must be idempotent."
```

Propose a **type** and a **tier**: homogeneous clusters keep their type (three invariants
abstract to an invariant), mixed ones become a `concept`. Tier is a recommendation only —
the human sets it, and lifetime needs their explicit word.

### 4. Present, and commit as their scribe

Per candidate, to the human: the instances verbatim, which changes they came from, your
draft sentence, your type/tier recommendation, and your honest read of whether this is a
pattern or repetition.

They edit the wording — the sentence that will be promoted should be theirs. Then, and
only then:

```
POST /api/consolidate
{ "instance_ids": [...], "content": "<the human's wording>",
  "type": "constraint", "tier": "long-term", "goal_ref": "<goal>",
  "reason": "<why, in their words>" }
```

(`agentic-memory-gui` → **Domain** tab does the same thing with a form; either is
fine, same journal.) Lifetime requires `tier_confirmed` — the API enforces it.

One item at a time, after they rule. Refuse "just consolidate all of them" — that is the
agent committing, with extra steps.

### 5. Report

Candidates found, consolidated (with the new node ids), rejected as repetition, rejected
as false clusters, and deferred. Repetition findings route onward: they mean recall is
not serving what capture already wrote, which is a workflow problem worth a change.

---

## Rules

- **Additive only.** Consolidation never edits, archives, merges, or re-tiers an
  instance. If a candidate seems to call for deleting the instances, it is not a
  consolidation — it is a contradiction, and it belongs in the review queue.
- **Never commit unprompted.** The detector is yours; the abstraction is the human's.
- **An abstraction that is not promoted is not consolidation.** It goes dormant with its
  instances and you have spent review attention for nothing. Always close by naming the
  promotion.
- **Do not consolidate domain entities.** An entity is a referent, not an abstraction
  over episodes — the surface rejects it. If several entities look like one, that is a
  *merge*, and it belongs in `/gw-domain` §C.
- Journal the pass: `USED` for the instances you read, `REVIEWED` for candidates
  presented and declined. Honest events only.
- `context/archive/` is untouchable; a candidate whose instances are already archived is
  moot — the detector excludes them by construction.
