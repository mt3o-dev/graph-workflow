---
name: gw-init
description: Initialize a project for the graph-workflow — scaffold context/{changes,archive,foundation}/, verify the agentic-memory MCP server is registered and reachable, and wire the CLAUDE.md snippet. Use once per project, before the first /gw-new. Trigger phrases: "init graph workflow", "set up graph-workflow", "/gw-init".
---

# gw-init

One-time project setup. Everything later assumes this ran: the folder scaffold for
lifecycle files, and a live memory store for everything else.

## Steps

1. **Scaffold the thin folder structure** (folders hold lifecycle files only — the
   knowledge itself lives in the graph):

   ```
   context/
     changes/     # active changes: <change-id>/{change.md, plan.md}
     archive/     # immutable, append-only — no skill ever writes here
     foundation/  # PRD, roadmap, tech-stack — long-lived documents
   ```

   Add a `context/README.md` stating the split: *files = lifecycle artifacts,
   graph = knowledge*. Do not create per-change notes/, research/, decisions/
   subfolders — that is what the graph replaces. Add `.gw-scratch/` to
   `.gitignore` — the throwaway path for agent proof/probe artifacts (agents
   cannot `rm`, so scratch never belongs in `src/`).

2. **Verify the memory server.** Check that the `agentic-memory` MCP server is
   registered and its tools respond (any cheap read, e.g. `stale_nodes()`).
   If missing, tell the user to register it:

   ```sh
   claude mcp add agentic-memory -- uv run --directory /path/to/agentic-memory-system agentic-memory-mcp
   ```

   The store defaults to `context/memory-graph.db` (project-local). Confirm
   `MEMORY_DB_PATH` resolution matches this project — a shared store pointed at the
   wrong project poisons both.

3. **Git hygiene for the store.** The SQLite file is a binary; the legible dump is
   the sync format. Ensure:
   - `.gitignore` contains `context/memory-graph.db*`
   - the memory repo's `scripts/dump_db.py` / `restore_db.py` round-trip is noted in
     the project docs (dump before push, restore after pull, when the team shares
     memory via git).
   - **Team mode:** offer to install the git hooks that automate the round-trip —
     a `pre-push` hook running `dump_db.py` and a `post-merge` hook running
     `restore_db.py`. Ask before writing into `.git/hooks/` (or the repo's
     configured hooks path); solo projects can skip.

4. **Wire CLAUDE.md.** Append the graph-workflow snippet (`CLAUDE.md.txt` from this
   pack) to the project's `CLAUDE.md` if not already present, so every future agent
   session knows the lifecycle and its rules.

5. **Foundation hand-off.** If `context/foundation/` already holds documents (PRD,
   tech-stack, ADRs — a brownfield adoption), route to `/gw-foundation` next: the
   graph starts empty, and foundation distillation is what makes the very first
   change's recall useful. Point `/gw-foundation` at any existing `lessons.md` and
   normative `CLAUDE.md`/`AGENTS.md` rules too — a project migrating off plain 10x
   usually carries hard-won lessons that distil straight into constraint nodes.

   **One of the first lessons the graph must hold is the project's git workflow**:
   branching model, PR flow, merge strategy (merge/squash/rebase), commit
   conventions. If it is not settled yet, settle it with the humans now and have
   `/gw-foundation` capture it — every change, worktree, and headless run acts on
   these rules, so they must be recallable before the first `/gw-new`.

6. Report what was created, what already existed, and whether the MCP surface is
   live. If the server is unreachable, say so plainly — the workflow degrades to
   files until it is fixed, and every would-be memory operation queues in
   `context/changes/<id>/memory-backlog.md` for replay (see the standing degraded-
   mode rule); a capture that skips the backlog is the one that is truly lost.

## Rules

- Idempotent: re-running must never overwrite existing change folders or CLAUDE.md
  content.
- Never create or touch `context/archive/` contents beyond `mkdir`.
- Do not initialize the graph schema yourself — the MCP server owns its store.
