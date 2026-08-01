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

2. **Verify the memory surface — both doors.** The CLI is the default transport and
   needs no registration:

   ```sh
   uv --project /path/to/agentic-memory-system run agentic-memory stale
   ```

   **`uv --project`, never `uv run --directory`.** The latter changes the working
   directory, so the store resolves inside the memory system's own folder instead of
   this project — the "shared store poisons both projects" failure, arrived at by
   accident. Confirm what you actually opened with `agentic-memory sync status`.

   If that answers, the workflow is usable *today*, in this session. Then register the
   MCP server as the optimization (better ergonomics where it is available), committed
   so every contributor and every cloud session gets it:

   ```sh
   claude mcp add --scope project agentic-memory \
     --env MEMORY_DB_PATH="$PWD/context/memory-graph.db" -- \
     uv --project /path/to/agentic-memory-system run agentic-memory-mcp
   ```

   An MCP server binds at session start, so it takes effect in the *next* session, not
   this one — which is exactly why the CLI is the floor. Never report the workflow as
   unavailable because the MCP tools are absent.

   The store defaults to `context/memory-graph.db`, resolved against the **working
   directory** — project-local as long as you launch from the project. For anything
   Claude launches on your behalf (the MCP server), set `MEMORY_DB_PATH` explicitly
   rather than relying on the cwd.

3. **Git hygiene for the store — one gitignore line, nothing else.** The tracked
   artifact is the legible text dump; the SQLite file is a local build artifact the
   store rebuilds on open and refreshes on close. Ensure `.gitignore` contains:

   ```
   context/memory-graph.db
   context/memory-graph.db-*
   context/memory-graph.db.bak
   ```

   `context/memory-graph.dump` is committed like any other text file, so it diffs and
   merges natively. There is deliberately **no filter to register and no hook to
   install**: a git clean/smudge filter needs local config that git never clones and
   will never auto-register, which silently broke every fresh checkout in the old
   design. If a project still has `filter=memory-db` in `.gitattributes`, remove it —
   and if a `.db` path holds dump text (that breakage), the next store open heals it.

4. **Wire CLAUDE.md.** Append the graph-workflow snippet (`CLAUDE.md.txt` from this
   pack) to the project's `CLAUDE.md` if not already present, so every future agent
   session knows the lifecycle and its rules.

5. **Foundation hand-off.** If `context/foundation/` already holds documents (PRD,
   tech-stack, ADRs — a brownfield adoption), route to `/gw-foundation` next: the
   graph starts empty, and foundation distillation is what makes the very first
   change's recall useful. Point `/gw-foundation` at any existing `lessons.md` and
   normative `CLAUDE.md`/`AGENTS.md` rules too — a project migrating off plain 10x
   usually carries hard-won lessons that distil straight into constraint nodes.

   Then `/gw-domain`, in the mode the project's state dictates: **brownfield**
   (extract entities from the schema and core modules, with `file:line` evidence,
   for the user to review) on an existing codebase, **greenfield** (the user names
   the domain, you transcribe) on a new one. Foundation captures the project's
   claims; the domain model captures its nouns, and the nouns are what the claims
   hang off. Both passes end at the same human gate, and both are worth doing
   before the first `/gw-new`.

   **One of the first lessons the graph must hold is the project's git workflow**:
   branching model, PR flow, merge strategy (merge/squash/rebase), commit
   conventions. If it is not settled yet, settle it with the humans now and have
   `/gw-foundation` capture it — every change, worktree, and headless run acts on
   these rules, so they must be recallable before the first `/gw-new`.

6. **Settle the tracker binding.** Ask which issue tracker the project uses, and write
   `context/foundation/tracker.md` (tracker, repo/team, the board's *real* state names,
   and `close_authority: human|workflow`). `tracker: none` is a complete answer — record
   it, so later sessions stop asking. Probe that the adapter's operations actually answer
   before the first change depends on them (`/gw-track` § Adapters). The normative parts
   get distilled by `/gw-foundation` like any other project rule.

7. Report what was created, what already existed, and whether the MCP surface is
   live. If the server is unreachable, say so plainly — the workflow degrades to
   files until it is fixed, and every would-be memory operation queues in
   `context/changes/<id>/memory-backlog.md` for replay (see the standing degraded-
   mode rule); a capture that skips the backlog is the one that is truly lost.

## Rules

- Idempotent: re-running must never overwrite existing change folders or CLAUDE.md
  content.
- Never create or touch `context/archive/` contents beyond `mkdir`.
- Do not initialize the graph schema yourself — the MCP server owns its store.
