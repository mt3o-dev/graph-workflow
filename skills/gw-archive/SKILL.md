---
name: gw-archive
description: Retire a merged change — final capture sweep, deactivate the memory liveness root + mark-sweep, and move the change folder into the immutable context/archive/. Use after merge, when a change is done. The folder move and the memory dormancy are the same lifecycle event. Trigger phrases: "archive the change", "close out the change", "/gw-archive".
---

# gw-archive

Merge is the event; archive is its consequence — in both halves of the system at
once. The folder goes to `context/archive/` (append-only, immutable) and the
change's liveness root goes OFF, letting mark-sweep send its short/mid-term detail
dormant while promoted knowledge survives. Neither half is optional.

## Steps

1. **Preconditions.** The change is merged (or explicitly abandoned — say which in
   change.md). `/gw-review`'s memory gate was presented; promotions the human
   wanted are already done in the GUI. If review never ran, stop and run it.

2. **Last call for capture.** After the sweep, the change's short-term detail goes
   dormant — so anything durable learned in this change that is not in the graph
   yet gets captured NOW (gw-plan/implement capture discipline), and the final
   session's usage journaled with one `append_events` batch. This is the last
   moment the knowledge is cheap to save.

   Confirm the /gw-review consolidation happened: a change-summary artifact exists
   and the promotion candidates were ruled on. If the summary was never promoted,
   flag it to the human before sweeping — a dormant summary defeats its purpose
   (dormancy is recoverable, but recall will no longer surface it unprompted).

3. **Check the blast radius outside this change** — before the sweep, not after.
   Run `impact_of` over the change's un-promoted (short/mid-term) nodes. A
   dependent that belongs to another **active** change means live work is leaning
   on knowledge about to go dormant: surface it to the human — usually the fix is
   promoting the node (review-gate promotion discipline applies), sometimes it is
   sequencing the archives. Do not assume the sweep's own liveness marking covers
   this — if the memory system's mark-sweep provably keeps nodes reachable from
   other active liveness roots, note that and move on; if you cannot confirm it,
   the check stands.

4. **Deactivate and sweep** — privileged lifecycle operation, deliberately NOT on
   the MCP agent surface; it runs through the memory repo's lifecycle script:

   ```sh
   uv run python scripts/memory_lifecycle.py deactivate <change-id> --sweep
   ```

   The script journals the deactivation and prints exactly which nodes the sweep
   archived. Long-term and lifetime nodes survive by design; artifacts promoted
   during review survive with them.

5. **Sanity-check the sweep output.** If something you expected to survive was
   archived, it was never promoted past short-term: reactivate
   (`... activate <change-id>`), have the human promote it in the GUI, deactivate
   again. Do not edit the store by hand.

6. **Move the folder:**

   ```sh
   git mv context/changes/<change-id> context/archive/<change-id>
   ```

   Stamp change.md: `status: archived`, `archived: <YYYY-MM-DD>`. From this moment
   the folder is immutable — no skill or tool writes under `context/archive/`,
   ever.

7. **One commit for one event.** Commit the folder move and note the memory
   deactivation (and the sweep's node count) in the message — future readers should
   see that the file archive and the graph dormancy happened together.

## Rules

- This is the ONLY sanctioned archival path — never archive nodes ad hoc
  mid-change, and never `mv` a change folder without the deactivate+sweep.
- Reactivating later is cheap and journaled — the graph is a cache with liveness,
  not a trash can. The folder move, however, is one-way.
- If the resolved target already exists under `context/archive/`, abort — an
  archived change is never re-opened in place; new work gets a new change via
  /gw-new with `parent_refs` pointing at the old change's surviving nodes.
