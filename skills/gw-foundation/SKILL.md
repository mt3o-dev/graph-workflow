---
name: gw-foundation
description: Distill the project's foundation documents (PRD, roadmap, tech-stack, architecture decisions) into the memory graph as lifetime-tier candidates, so every future change's recall surfaces them without anyone re-reading the docs. Use after foundation docs are written or amended, and once at adoption time on a project with existing foundation docs. Trigger phrases: "load the foundation into memory", "foundation to graph", "/gw-foundation".
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

## Steps

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

   Capture discipline as everywhere: one statement per artifact, readable cold,
   facets from the controlled vocabulary, edges among the foundation nodes
   (a decision DEPENDS_ON the constraint that forced it). Do not capture what
   only matters inside one document's narrative flow.

3. **Reference back.** Note the captured `[node:<id>]`s in the source doc (an
   HTML comment or footer table) so a future amendment session can find the nodes
   its edit invalidates.

4. **Hand the human the promotion list.** Everything captured here is a
   **lifetime-promotion candidate** — that is the entire point; foundation
   knowledge that stays short-term dies with the next sweep. List every node with
   a one-line why; the human promotes in the GUI (lifetime requires explicit
   confirmation there). The agent never promotes.

5. **After promotion**, deactivate the scaffold scope
   (`memory_lifecycle.py deactivate foundation --sweep`) — the promoted nodes
   survive in the root set by design; anything the human declined goes dormant,
   which is the correct verdict recorded.

## Amendments

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
