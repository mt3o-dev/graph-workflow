---
name: gw-domain
description: Establish or extend the project's domain model — the ubiquitous language — as entities in the memory graph. Two modes - greenfield (the user names the domain, you transcribe) and brownfield (you extract candidates from the codebase with evidence, the user reviews). Also handles amendments - rename, split, merge, retire. Use at adoption time after /gw-foundation, when a change opens unmodelled territory, or whenever naming drift shows up in review. Trigger phrases "model the domain", "what do we call this", "domain entities", "ubiquitous language", "/gw-domain".
---

# gw-domain

The graph holds two kinds of knowledge that behave differently. Everything the other
skills capture is a **claim** — a decision, a constraint, an invariant — something that
can be right or wrong, and that decays, gets contradicted, and eventually goes dormant.
This skill captures **names**: `Invoice`, `Customer`, `Shipment`. A name cannot be wrong,
only renamed or retired, so entities never decay, are never consolidated, and survive
every sweep regardless of tier — the domain outlives the changes that touch it.

They are also the graph's **hubs**. An artifact attached to an entity with `ABOUT` is
reachable from that entity later, across change boundaries, from a different goal. A
project with a modelled domain gets recalls that answer *"what do we know about
invoices?"*; one without gets recalls that only answer *"what did this change say?"*.

**Two modes, one gate.** The modes differ in who authors the candidate list. They do not
differ in who ratifies it: `capture_entity` always lands `proposed`, and only a human
confirms — in the GUI Domain tab, or through you acting as their per-item scribe. An
agent that proposed and then confirmed its own proposal would not be a gate.

## Which mode

| Situation | Mode |
|---|---|
| New product, little or no code, the domain lives in people's heads | **Greenfield** (§A) — the user drives |
| Existing codebase, schema, or PRD; the domain is implicit and probably inconsistent | **Brownfield** (§B) — you propose with evidence, the user reviews |
| Both (a mature product, a greenfield subsystem) | Brownfield for what exists, greenfield for the new area — never blend them in one review batch, because the reviewer's job is different in each |
| The model exists and something moved | **Amendment** (§C) |

## Setup (both modes)

1. **Scope.** Domain modelling is a change like any other — it needs a goal. Either use
   the current change's `memory_goal`, or open a dedicated one:

   ```
   /gw-new   →  change-id: domain-model  (or domain-model-<area> for one bounded area)
   ```

   Prefer a dedicated scope at adoption time and a per-area scope later; entities carry
   no `SCOPED_TO` edge, so the scope you use is for provenance and recall anchoring, not
   for the entities' survival.

2. **Read what exists first — always:**

   ```
   domain_model()                                    # what the graph already names
   recall_context(query="<the area>", goal_ref=...)  # what it already claims
   ```

   An empty `domain_model()` on a mature store means nobody has modelled the domain yet,
   not that the project has none. A populated one means your job is *extension*, and
   re-proposing an existing name is wasted review attention (the call is idempotent, so
   it is harmless, but the reviewer still reads it).

3. **Say which mode you are in, out loud**, before proposing anything. The user's job is
   different in each, and they need to know which one they are doing.

---

## §A Greenfield — the user names the domain

The domain does not exist in an artifact yet; it exists in people's heads. Your job is
**elicitation and transcription**. An agent that invents entities on a greenfield project
is writing fiction the codebase will then be built to match — and because entities never
decay, that fiction outlives every change that could have corrected it.

### The interview

Work outward from the product's nouns, **one bounded area at a time** (5–9 entities per
pass; more than that and the user is rubber-stamping). For each candidate ask, and wait:

1. **What do you call it?** The canonical **singular** term, in the users' language, not
   the database's. Push back gently on plurals, on `-Data`/`-Info`/`-Manager` suffixes,
   and on names that describe a table rather than a thing.
2. **What is it, in one or two sentences — and what is it *not*?** The second half is the
   one that earns its keep. "A Customer is a party we invoice — not the person who logs
   in; that's a User" is a definition; "a customer of the system" is a tautology.
3. **Does it have identity of its own, or is it part of something else?** A `LineItem`
   that only exists inside an `Invoice` gets a `DEPENDS_ON` edge to it. This is the
   aggregate question, and it is the one people answer most confidently.
4. **Is this one thing or two?** Ask whenever the user hesitates or gives two examples
   that feel different. Splitting later is cheap; discovering in month four that
   "Account" meant two things is not.

Then, per settled entity:

```
capture_entity(name="Customer",
               definition="A party we invoice. Not the person who logs in — that is a User.",
               goal_ref=<goal_node_id>,
               facets=["billing"],
               evidence="elicited: <the user's own words>",
               edges=[{"target": "<invoice-entity-id>", "type": "DEPENDS_ON"}])
```

Put the user's own phrasing in `evidence`. It is journaled, and at the ratification gate
it is what lets them recognize their own decision.

### When to stop

Stop at the edge of what the user can state confidently. A speculative entity captured
"to be thorough" ranks in every future recall on that territory and is never swept.
Under-modelling is recoverable in one call; over-modelling costs a review cycle to undo.

Say explicitly what you did **not** model and why — that list is the agenda for the next
pass, and it is more useful than a padded entity set.

---

## §B Brownfield — you propose, the user reviews

The domain is already implicit in the code, and it is almost certainly inconsistent: two
names for one thing, one name for two things, and terms in the schema nobody says out
loud. Your job is **extraction with evidence** — every proposal carries a `file:line` so
the reviewer checks it in seconds instead of adjudicating from memory.

### Where to look, in priority order

1. **The persistence schema** — tables, migrations, the ORM model layer. Highest
   signal-to-noise: things with their own table usually have their own identity.
2. **The core/domain modules** — whatever the project's inner layer is (`src/lib/core/`,
   `domain/`, the code with no framework imports). Types and value objects here are the
   team's own model of the domain.
3. **The PRD, glossary, or foundation docs** — often *aspirational* rather than actual.
   Where docs and code disagree, propose the code's entity and **flag the divergence as a
   finding**; that disagreement is worth more than either name alone.
4. **The API surface and UI copy** — the customer-facing vocabulary, which is often the
   real ubiquitous language while the code carries a legacy one.

Use the **graphify MCP first** when the project has a code knowledge graph
(`graphify-out/` present); raw grep/read is the fallback, not the default.

### What is an entity, and what is not

| Propose | Do not propose |
|---|---|
| Things with identity and a lifecycle (`Invoice`, `Shipment`, `Account`) | Technical plumbing (`Repository`, `Controller`, `DTO`, `Config`) |
| Domain value concepts the team argues about (`Money`, `TaxRate`) | Framework types, table names that are pure join tables |
| Actors and external systems (`Carrier`, `Person`) | Anything whose name ends in `-Manager`, `-Helper`, `-Util` |
| A term used by users that has no code representation yet — say so | Individual columns, enum members |

The persistent trap: **the codebase's structure is not the domain**. `UserRepository` is
not an entity; `User` might be. When you cannot decide, propose it and say in the
definition why it is borderline — the human gate exists for exactly that.

### Propose in reviewable batches

Batch by subsystem, 8–12 entities per batch, and present a table before writing anything:

```
| Proposed  | Definition (one line)                        | Evidence                    | Note |
|-----------|----------------------------------------------|-----------------------------|------|
| Invoice   | A request for payment issued to a customer.  | src/core/model/invoice.ts:8 |      |
| Customer  | A party we invoice.                          | migrations/001_init.sql:22  | code says `client`, PRD says `customer` — divergence |
```

Let the user strike, rename, split, and merge rows **before** you capture. Then capture
the surviving rows with `evidence="src/core/model/invoice.ts:8"`.

### Surface the drift findings separately — they are the point

The uncontroversial entities are the easy half. Report these explicitly, because they are
what only this pass produces:

- **Synonyms** — two names, one thing (`client` in the schema, `customer` in the PRD).
- **Homonyms** — one name, two things (`account` as a ledger account and as a login).
  Propose **both**, with definitions that name the other, and let the user choose the
  disambiguating names.
- **Code-only terms** — something the code models that nobody talks about. Often either a
  missing domain concept or a leaked implementation detail; ask which.
- **Talked-about-only terms** — something the users name that the code has no
  representation for. Frequently the most valuable finding in the whole pass; capture it
  as an `issue` artifact as well as an entity.

`capture_entity` returns `entity_warnings` when a name is close to an existing one. Never
drop them — they are carried into the proposal's journal entry and are exactly the
material the reviewer needs.

---

## §C Amendment — the domain moved

Domains change, and unlike a wrong claim, a wrong *name* cannot be contradicted into
correctness. Four moves, all human-ratified:

**Before any of them, trace the blast radius:**

```
impact_of(node_ref=<entity-id>)
```

For an entity this returns everything written `ABOUT` it, transitively. A deep result
means the rename is a project-level event, not a tidy-up — surface it and let the human
decide the sequencing.

| Move | How |
|---|---|
| **Rename** | `capture_entity` the new name (definition mentions the old one), `link` the artifacts across with `ABOUT`, then the human retires the old entity. Never edit the old body to the new name — the rename is a fact, and the journal should hold it. |
| **Split** | Propose both new entities, each defining itself against the other; the human retires the ambiguous original once the artifacts are re-attached. |
| **Merge** | Keep the entity whose name the team actually uses, re-attach the other's artifacts with `ABOUT`, human retires the loser. |
| **Retire** | The domain dropped it. The human retires it; the node stays for provenance, its `ABOUT` edges stay traceable, and the next sweep sends it dormant. |

Retiring is a human act in all four. Your part is: propose, re-attach, present, and say
plainly what the impact trace showed.

---

## The ratification gate (both modes, always)

1. **Present the proposal list**, each with its definition, provenance, and any
   `entity_warnings`.
2. **The human confirms or retires each one** — GUI Domain tab
   (`uv run agentic-memory-gui`), or you as their scribe:
   `POST /api/entities/{id}/confirm` / `/retire`, **one item at a time, after they say
   so**. Refuse batch "confirm all my proposals" requests; that is the agent ratifying
   with extra steps.
3. **Report what remains proposed.** Unratified entities still rank in recall, tagged
   `proposed` — usable, but not settled language. A permanently-proposed model is a gate
   nobody walked through; say the count at every subsequent gate until it is zero.

## Journal and hand-off

- One batched `append_events`: `USED` for the recalled nodes that shaped the model,
  `CONFIRMED` for definitions you verified against code (brownfield), `CONTRADICTED` with
  evidence where the graph's existing claims disagree with the domain you found.
- Capture the **drift findings** as artifacts, not just prose: a synonym pair is an
  `issue`, a settled disambiguation is a `decision`, "users talk about X and the code has
  no X" is an `issue` worth a future change.
- Hand off with: the entity list and ids, what stayed proposed, the drift findings, and
  what you deliberately did not model.

## Rules

- **Names, not claims.** If you can disagree with it, it is a `capture_artifact`, not an
  entity. "Invoices are immutable after issue" is a constraint `ABOUT` the `Invoice`
  entity — capture it that way and both halves rank.
- **Never invent on greenfield; never assume on brownfield.** Elicit, or cite.
- **The definition earns the entity.** One that does not distinguish it from its
  neighbours is a label. Make every definition say what the thing is *not*.
- **Never overwrite a definition.** `capture_entity` on an existing name returns the
  existing node and changes nothing. If you disagree with a ratified definition, capture
  a `concept` with a `CONTRADICTS` edge so it reaches review.
- **Attach as you go.** Every capture in every later session gets `ABOUT` edges to the
  entities it concerns. An entity with nothing attached is a dictionary entry, not a hub.
- Standing rules apply: honest events only, no trust/flag/tier mutation, no entity
  ratification, `context/archive/` untouched.
