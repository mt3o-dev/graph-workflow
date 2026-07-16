---
name: gw-research
description: Research a change's territory with memory loaded first. Use after /gw-new when the ground is unknown — recalls settled knowledge BEFORE exploring the codebase, runs parallel research grounded in it, captures durable findings, and journals what was relied on. Trigger phrases: "research this change", "explore the codebase for", "/gw-research".
---

# gw-research

Research in this workflow means: load what the graph already knows, explore only
the gap, and leave the graph richer than you found it. Re-deriving settled
knowledge is the failure mode this skill exists to prevent.

## Steps

1. **Locate the scope.** Read `context/changes/<change-id>/change.md`; take
   `memory_goal`. If absent, stop and run `/gw-new` (or its step 3–4) first.

2. **Recall before exploring:**

   ```
   recall_context(query="<a few words on what you are about to investigate>",
                  goal_ref=<goal_node_id>)
   ```

   Read the bundle correctly:
   - Order is signal — earlier blocks are more relevant; there are no scores on
     purpose.
   - Keep the `[node:<id>]` handles — they are write-back ids for feedback and
     edges.
   - `disputed` blocks are contradicted and awaiting review: reason with BOTH
     sides (the `contradictions:` section carries them) and say so in your output.
   - `tier=lifetime`/`long-term` is validated knowledge; `short-term` is working
     memory that may not survive its change.

3. **Scope the gap.** List what the recall did NOT answer. That list — not the
   change title — is the research agenda. If recall answered everything, say so
   and route to `/gw-plan`; research theater helps nobody.

4. **Explore the codebase** for the gap items. Fan out read-only subagents for
   independent questions (structure, dependencies, conventions, history) and keep
   the conclusions, not the file dumps. Standard 10x-research discipline applies:
   cite `file:line`, distinguish observed fact from inference.

5. **Reconcile memory against reality.** For each recalled node your exploration
   touched:
   - reality agrees → note it for a `CONFIRMED`/`USED` event (step 7);
   - reality disagrees → do NOT silently drop it. Either capture the correcting
     fact with a CONTRADICTS edge back to the node, or record
     `CONTRADICTED` with the evidence in `reason`. The flag this raises is the
     system working, not a mess you made.

6. **Capture durable findings** (memory-capture discipline — the quality ceiling):
   - `concept` for settled models ("the invoice aggregate owns line items"),
     `constraint` for things future work must respect, `issue` for problems left
     standing, `invariant` for properties that must always hold.
   - One statement per artifact, written to be read cold later. Three small nodes
     beat one blob.
   - Every capture carries `goal_ref`, facets from the controlled vocabulary, and
     edges to the recalled nodes it builds on — node+edges commit atomically.
   - Do NOT capture narration of what you did, churning file paths, or anything
     the repo states verbatim.
   - Answer `facet_warnings` deliberately: reuse the suggested value or keep yours;
     never ignore the warning silently.

7. **Journal usage — one batched call, end of session:**

   ```
   append_events([
     {"event_type": "USED", "node_ref": "<id>", "reason": "grounded the auth-flow research"},
     {"event_type": "CONTRADICTED", "node_ref": "<id>", "reason": "migration 0042 now denormalizes totals"},
   ])
   ```

   Only nodes you genuinely engaged with — noise here corrupts ranking there.

8. **Write the thin summary** to `context/changes/<change-id>/research.md`: the
   questions asked, the answers with `file:line` cites, and the `[node:<id>]` list
   of artifacts captured. The knowledge is in the graph; the file is the pointer
   trail for humans and the planner.

## Rules

- Recall before deciding, not after. If you notice mid-exploration that you are
  about to touch a subsystem you never loaded context for, recall again — recalls
  are cheap reads.
- Surface contradictions in your findings explicitly; never blindly pick the
  confident side.
- Read-only toward the codebase. Research changes the graph and writes
  research.md; it never edits source.
