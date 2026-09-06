# gw-wayfind — where am I, and what should I pick up

**This is not a skill.** There is no `SKILL.md` and no `/gw-wayfind` command,
because the reading is deterministic — scan the change folders, fold the desks,
read the store, ask git — and a script does that better than prose instructions.
What is left is one paragraph of judgment, which any skill can carry.

It is also **not a script in this tarball**. It is a `pmview` subcommand:

```sh
pmview.pyz --advise            # or: python -m pmview --advise
pmview.pyz --advise ~/project  # any project root, or a parent of several
```

## Why it lives in pmview

The board and this report rank the same things — what is stalled, what is
blocked, what needs a human, what is safe to pick up. Writing that twice
guarantees the terminal and the board eventually disagree about what to do next,
which is the worst possible failure for an orientation tool.

So the ranking is one module, `pmview/advise.py`, with two consumers:

```
pmview --advise      →  the terminal report (this)
GET /api/advise      →  the board's contextual action rows
```

Three consequences worth knowing:

1. **The readers already exist there.** `lifecycle.py` parses change folders,
   `design.py` folds desks, `graph.py` reads the store. A standalone script would
   reimplement all three and drift from them.
2. **It works headless.** `--advise` prints and exits — no bind, no browser, no
   port. That was the entire objection to "just look at the board", and it is why
   this works over ssh and in CI.
3. **One file to install.** `pmview.pyz` is already the recommended install.

## What it reads

| source | gives |
|---|---|
| `context/changes/*/change.md` | stage, goal, warnings, `design_surface:` |
| `context/archive/*` | what is finished |
| the store (`graph.py`) | flagged nodes, contradictions, whether a domain model exists |
| `context/design/*/asks.jsonl` | open asks, unruled gaps, whether an agent is listening |
| `git` | branch and uncommitted count |

`GET /api/advise` additionally returns the request queue from
`context/requests.jsonl`; `--advise` does not print it, because a queued request
is something an agent drains rather than something you act on at the keyboard.

## How it ranks

Four bands, most urgent first. Within a band, **the oldest thing wins** — what
has waited longest is what is most likely to have been forgotten.

| band | means |
|---|---|
| `blocked` | something is waiting on a human right now: open asks with no agent listening, unruled component gaps, contradictions, nodes flagged for review, a change with no `memory_goal` |
| `stalled` | nothing has moved in ≥5 days, and the change is not checked out |
| `ready` | the next step for a change nothing is blocking — including opening one the roadmap sketched, or planning one that has no plan yet |
| `hygiene` | no foundation in the graph, no domain model |

**Staleness is not `change.md`'s mtime.** A change is worked by editing *code*,
and its lifecycle file may not be touched for the whole of it — measuring off
`change.md` alone reports a change that has been active all day as ten days cold.
(Observed on this repo; that is how the bug was found.) The signal is the newest
of the change folder and its surfaces' desk activity — **and a change whose id
matches the current git branch is never stalled**, because one change per
worktree is this workflow's rule, so a branch named after a change is that change
being worked on right now.

## Reading the output

```
graph-workflow  ·  design-lane (4 uncommitted)
──────────────────────────────────────────────

  → /gw-implement
    implementation is underway.

  1 in-progress

  Safe to pick up
    /gw-implement                     Continue [design-lane]

  Housekeeping
    /gw-domain                        No domain model
```

**The arrow is the whole report.** Everything under it is context for that one
line. Orientation is a sentence, not a dashboard — the board is already the
dashboard, and a report that prints five equally-weighted columns has failed,
because the reader goes back to the browser.

## When to run it

- **Step 0 of a session you did not start.** Before `/gw-new`, before picking
  anything up — it costs one command and it is the difference between resuming
  work and starting a second copy of it.
- **After a break.** The `blocked` band is specifically the things that stopped
  waiting for you and will not restart on their own.
- **In CI or a cron.** It exits 0 and writes nothing, so it is safe to run
  anywhere. A non-empty `blocked` band in a nightly run is a useful alarm.

## What it never does

Writes, spawns, or mutates anything. It is a read, end to end — which is what
makes it safe to run from a hook, a timer, or a shared machine.
