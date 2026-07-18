---
name: gw-new
description: Open a new unit of work — create the change folder AND its memory scope in one motion. Use at the start of every change, before any research or planning. Mints context/changes/<change-id>/change.md, calls create_change (change anchor + mandatory Goal node), records memory_goal, and seeds context with a first recall. Trigger phrases: "new change", "start a change", "open a change", "/gw-new".
---

# gw-new

The single entry point of the lifecycle. A change does not exist until it has BOTH a
folder (lifecycle files) and a Goal node (memory scope). Opening them together is
the point — worktree checkout, change activation, and liveness-root ON are the same
event.

## Steps

1. **Settle the identity.** Pick a `<change-id>`: short kebab-case, names the
   outcome not the activity (`invoice-vat-rounding`, not `fix-bug`). Write one
   sentence stating what this change is trying to achieve — for exploratory work,
   the exploration IS the goal ("explore X to decide Y").

2. **Create the folder** `context/changes/<change-id>/change.md`:

   ```markdown
   # <change-id>

   status: open
   created: <YYYY-MM-DD>

   ## Goal
   <the one sentence>
   ```

   If the resolved path starts with `context/archive/`, abort: "This change is
   archived. Open a new change with /gw-new."

3. **Mint the memory scope:**

   ```
   create_change(change_id="<change-id>", goal="<the one sentence>", parent_refs=[...])
   ```

   `parent_refs` — node ids of existing memory this change knowingly builds on,
   if any. They come from one of two places, because the change's own goal does
   not exist yet at this point:
   - the hand-off of a prior change (`/gw-archive` routes follow-up work here
     with the old change's surviving node ids), or
   - a **pre-create discovery recall** through the foundation scope:
     `recall_context(query=<the goal sentence>, goal_ref=<foundation memory_goal
     from context/foundation/foundation.md>)` — the `[node:<id>]` handles it
     surfaces are the candidates. Skip if the project has no foundation scope;
     empty parent_refs on a first change is correct, not a failure.

   Returns `{change_node_id, goal_node_id, activated: true}`.

4. **Record the handle** — append to `change.md`:

   ```
   memory_goal: <goal_node_id>
   ```

   Every later capture/recall in this change uses that id. A change.md without
   `memory_goal` means this step was skipped — fix it before capturing anything.

5. **Seed context** (creation is a write; recall is a read; deliberately separate):

   ```
   recall_context(query="<goal text>", goal_ref=<goal_node_id>)
   ```

   On a brand-new change in a young store this returns just the goal and any
   parent cones — correct, not a failure. In a mature store this is where
   cross-change knowledge arrives for free: constraints, invariants, and lifetime
   concepts touching this goal, ranked. Read it before deciding anything.

6. **Worktree (parallel work).** If this change runs alongside others:

   ```sh
   git worktree add ../<repo>-<change-id> -b <change-id>
   ```

   One change per worktree, one fresh agent context per worktree. The active
   change's liveness root is already ON from step 3.

7. Hand off: state the change-id, the goal id, and what the seed recall surfaced
   (especially any `disputed` blocks), then route — `/gw-research` if the ground is
   unknown, `/gw-plan` if it is understood.

## Rules

- One `create_change` per change — it rejects duplicates. If it says the change
  exists, recover `memory_goal` from change.md instead of minting another.
- Do not capture artifacts here. Opening is scope-creation; knowledge arrives
  during research/plan/implement.
- Never invent a goal-less workflow: `capture_artifact` rejects writes without a
  valid goal ref, by design.
