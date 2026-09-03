---
name: gw-foundation
description: Distill the project's foundation documents (PRD, roadmap, tech-stack, architecture decisions) into the memory graph as lifetime-tier candidates, so every future change's recall surfaces them without anyone re-reading the docs. Also WRITES the PRD when the project has none and the conversation already contains one — synthesising it, never interviewing. Use after foundation docs are written or amended, once at adoption time on a project with existing foundation docs, and whenever a conversation has converged on what to build but nothing is written down. Trigger phrases: "write the PRD", "turn this into a spec", "load the foundation into memory", "foundation to graph", "/gw-foundation".
---

# gw-foundation

Foundation documents are the most cross-change knowledge the project has — which
means files alone are the wrong *retrieval* home for them. The doc stays the
source of truth (holistic, human-readable, git-versioned); this skill extracts its
**normative content** — what future changes must respect, assume, or build on —
into the graph, where goal-dominant recall can serve it at the moment it matters.

The target state: PRD constraints, domain concepts, and tech-stack decisions sit
in the **lifetime/long-term root set** — always live, surviving every change
sweep, ranked into every relevant recall.

**Foundation lives twice, deliberately** — and this skill owns both halves. Step 0
writes the document when the project has none and the conversation already
contains one; steps 1–6 distil whatever document exists. A project that has
converged on what to build, in a conversation, with nothing on disk, is the
commonest way a foundation never gets loaded at all.

## Steps

0. **Write the document first — only when there is none.** If
   `context/foundation/prd.md` exists, skip straight to step 1; amending an
   existing PRD is the human's call, not this skill's.

   **Do not interview.** Synthesise from the conversation and the codebase, using
   what you already know. Interrogation is `/gw-grill`'s job, and keeping that
   seam is what keeps both skills sharp — if the conversation is too thin to
   synthesise from, say so and route there rather than starting to ask questions
   here.

   a. **Sketch the test seams before writing.** Recall first, because a settled
      constraint about testing outranks a fresh opinion:

      ```
      recall_context(query="test seams boundaries integration coverage",
                     goal_ref=<foundation goal, from step 1 if the scope exists>)
      ```

      Prefer existing seams to new ones, and use the **highest** seam available;
      propose a new one only at the highest point you can. **Check the seams with
      the user before writing** — this is the one place step 0 blocks, because a
      PRD built on the wrong seams produces a plan that tests the wrong things.

   b. **Write `context/foundation/prd.md`:** problem statement and solution, both
      from the user's perspective; a long numbered list of user stories (`As an
      <actor>, I want <feature>, so that <benefit>`); implementation decisions
      (modules, interfaces, schema and API contracts); testing decisions (what
      makes a good test here, which modules, prior art in this codebase); out of
      scope; further notes.

   c. **No file paths and no code snippets** — in the document or in anything
      captured from it. They go stale faster than the prose around them, and this
      workflow's capture rule is already *one statement per artifact, readable
      cold*. The single exception both this and `/gw-prototype` allow: a prototype
      produced a snippet that encodes a decision more precisely than prose can — a
      state machine, a schema, a type shape. Inline the decision-rich part, say it
      came from a prototype, and trim the rest.

   Then continue into step 1. The document you just wrote is the input to the
   distillation, which is the whole point: the seam decisions and the
   non-negotiables become recallable in the same session that settled them.

1. **Open the foundation scope** (once per project):

   ```
   create_change(change_id="foundation", goal="Establish the project's foundational constraints, concepts, and decisions as always-live shared knowledge")
   ```

   If it already exists, recover the goal id from
   `context/foundation/foundation.md` (`memory_goal:` line — create the file if
   missing) and `recall_context` the existing foundation subgraph before touching
   anything.

2. **Distill each document** under `context/foundation/` into artifacts — the
   normative statements, not prose summaries:

   - PRD → `constraint` for every non-negotiable ("invoices are immutable after
     issue"), `concept` for each domain term the project's language depends on,
     `issue` for known accepted gaps.
   - Tech-stack / ADRs → `decision` per choice, with the why in the content
     ("Postgres over SQLite: multi-writer requirement from PRD §3").
   - Roadmap → sparingly: only `constraint`s that sequence work ("payments cannot
     ship before KYC"). Roadmaps churn; the graph should not.
   - Existing `lessons.md` and normative `CLAUDE.md`/`AGENTS.md` rules (brownfield
     adoption, esp. migrating off plain 10x) → each settled lesson or rule is
     already a cold-readable `constraint` ("the payment webhook retries; handlers
     must be idempotent"); these are among the highest-value distillation targets
     because they encode mistakes the project already paid for. Skip tooling
     boilerplate and anything specific to one file's narrative.
   - The **pre-project intake answers** (`docs/INTAKE`, recorded into
     `context/foundation/` or `CLAUDE.md`) → the normative ones are foundation
     content: facet policy and capture-line as `constraint`s, execution-mode
     routing and promotion authority as `decision`s. Distil them like any other
     foundation doc.
   - The **git workflow** — branching model, PR flow, merge strategy, commit
     conventions — is one of the **first lessons** this pass must capture:
     `decision` per choice, `constraint` for the rules every change must obey
     ("all work lands via PR from a change-id branch; no direct pushes to main").
     Every worktree, headless run, and archive commit acts on these rules; if the
     project has not settled them, stop and settle them with the humans before
     distilling anything else.

   - The **design system**, if the project has one. `.impeccable/design.json` is a
     file `/gw-wireframe` merely *detects*: its rules never become recallable, so
     a later change can contradict a settled design rule without `impact_of` ever
     firing. Distil it:

     ```sh
     python3 <this skill's dir>/bin/design_distill.py          # → .gw-scratch/design-constraints.md
     ```

     The script **never touches the graph**. It writes a review file; you read it
     and make the `capture_artifact` calls. Each `narrative.rules[]` entry becomes
     one `constraint`, `facets:["ui"]`, `tier:"mid-term"`; each `narrative.donts[]`
     entry — **a plain string, not an object** — becomes one more; `northStar` +
     `overview` become one `concept` for the visual world.

     **Capture the rule and the token NAME, never the value.** A node saying *"the
     accent is a verb — `--accent` appears only on something interactive or
     selected"* survives a repalette and still fires `impact_of` on a proposed
     decorative blue. A node holding `#2f6fdb` goes silently wrong the day someone
     repaints, and nothing notices.

     The output is bounded — one node per rule, one per don't, one concept — so it
     does not grow with the codebase. Write the reference-back table (§3) into
     `context/foundation/design-bindings.md`, **not** into `DESIGN.md`: we can ban
     `impeccable document` from every gate, but we cannot ban the human from
     running it, and a footer in a file impeccable regenerates is guaranteed to be
     destroyed eventually.

     Two things to settle before the first distillation, once per project:
     dedupe any repeated Do's/Don'ts block in `DESIGN.md` (or the duplicate ships
     into the graph), and set `"buildPath": "code"` in `.impeccable/config.json` —
     `KNOWN_CONFIG_KEYS` is a closed set, so add that key and **never a gw one**,
     which would report as drift permanently.

   Capture discipline as everywhere: one statement per artifact, readable cold,
   facets from the controlled vocabulary, edges among the foundation nodes
   (a decision DEPENDS_ON the constraint that forced it). Do not capture what
   only matters inside one document's narrative flow.

3. **Reference back.** Note the captured `[node:<id>]`s in the source doc (an
   HTML comment or footer table) so a future amendment session can find the nodes
   its edit invalidates.

   For the design system the table lives in `context/foundation/design-bindings.md`
   and carries a **per-rule fingerprint** — `sha256` of the rule *text*, first 12
   hex — so a drift finding can say *"The Accent-Is-A-Verb Rule changed under
   [node:7c1a…]"* rather than *"something in DESIGN.md moved"*. A drift check that
   cannot name the drifted thing is ignored by the third PR. Fingerprinting the
   text and not the values is also what keeps a repalette from reading as a
   changed rule.

4. **Hand the human the promotion list.** Everything captured here is a
   **lifetime-promotion candidate** — that is the entire point; foundation
   knowledge that stays short-term dies with the next sweep. List every node with
   a one-line why; the human promotes in the GUI (lifetime requires explicit
   confirmation there). The agent never promotes.

5. **After promotion**, deactivate the scaffold scope
   (`memory_lifecycle.py deactivate foundation --sweep`) — the promoted nodes
   survive in the root set by design; anything the human declined goes dormant,
   which is the correct verdict recorded.

6. **Hand off to `/gw-domain`.** Foundation distillation captures the project's
   *claims*; it does not capture its *nouns*. Domain terms encountered here become
   `concept` nodes only when they are a settled model with something to assert —
   the bare names (`Invoice`, `Customer`, `Shipment`) belong in the domain model as
   entities, where they never decay, survive every sweep, and act as hubs the
   foundation constraints attach to with `ABOUT`. Note the terms you met while
   distilling and hand that list to `/gw-domain` as its starting inventory; on a
   brownfield project it runs in extraction mode against the code as well.

## Amendments

**Concurrency rule:** amend foundation docs only *between* a change's gates —
never while a planner or implementer is mid-read of them. If an amendment cannot
wait, announce it in every active change's folder (a line in change.md) so the
next gate knows the constraint set moved under the work. The fresh-session gates
(/gw-plan-review, /gw-review) re-read foundation independently and are the
designed safety net for exactly this race — but a net is not a license.

A foundation doc edit is a change like any other: recall the foundation subgraph,
`impact_of` the nodes the edit invalidates (foundation nodes have the widest blast
radius in the store — treat a deep result as a project-level decision), capture
the new statements with CONTRADICTS edges to the superseded ones, and let the
flag → review → re-promotion ladder run. Never edit the store to match the doc
silently.

## Rules

- The doc is the source of truth for *reading*; the graph is the source of truth
  for *being found*. Divergence between them is a bug — fix it through the
  amendment flow, in whichever direction is wrong.
- Lifetime tier is never self-assigned: capture defaults short-term; promotion is
  the human's confirmation that this really is foundation.
- Do not dump documents in whole. A 40-node PRD distillation that recall can rank
  beats one blob node that always ranks or never does.
