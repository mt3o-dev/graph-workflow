# gw-desk — the agent↔human channel

**This is not a skill.** There is no `SKILL.md` and no `/gw-desk` command, because
plumbing every phase touches is not a phase. It is a script other skills call.

One log per surface, at `context/design/<surface>/asks.jsonl`. Git-tracked,
append-only, eight line kinds. The agent posts asks and **ends its turn**; the
human answers in pmview; a watcher the agent launched wakes it.

## Resolving the script

Quote this into any skill that calls it:

```
Resolve desk.py in this order and use the first that exists:
  1. $GW_DESK
  2. <this skill's own base directory, as the runtime reports it>/../gw-desk/bin/desk.py
  3. .claude/skills/gw-desk/bin/desk.py
  4. ~/.claude/skills/gw-desk/bin/desk.py
If none exist, say so and fall back to the terminal: ask the question in chat and
write the answer line yourself, so the log has no hole.
```

## Commands

```sh
desk.py post    --surface S --change C --goal G --file ask.json
desk.py drain   --surface S [--session ID]
desk.py wait    --surface S [--timeout 900]
desk.py ack     --surface S --refs a,b --disposition acted --text "…" [--captured node-id,…]
desk.py retire  --surface S --refs a --reason "…"
desk.py note    --surface S --screen X --text "…"
desk.py handoff --surface S [--open a,b] --resume "…" --text "…"
desk.py status  --surface S
```

Exit codes are copied from impeccable's `serve-question.mjs`, so the mental model
transfers and a future surface swap needs no skill edits:

| code | meaning |
|---|---|
| `0` | undelivered human lines, printed as a JSON array on stdout |
| `2` | the log is unreadable, or the surface directory is gone |
| `3` | nothing waiting / timed out |
| `4` | nobody is listening — presence went stale, or a `handoff` is already the last agent line |

## The eight kinds

| kind | writer | meaning |
|---|---|---|
| `ask` | agent | a blocking question, with options and honest costs |
| `note` | agent | context that needs no answer |
| `ack` | agent | *I acted on these lines*; `disposition` ∈ `acted \| deferred \| contradicts \| declined` |
| `retire` | agent | this ask no longer has a subject |
| `handoff` | agent | I am ending my turn with these still open |
| `answer` | **pmview only** | resolves an ask |
| `instruction` | **pmview only** | unsolicited direction, optionally pinned to a region |
| `decline` | **pmview only** | *I am not deciding this* — the desk's `defer` |

pmview constructs its three field by field and stamps `by`/`src`/`id`/`ts`
itself, so it is *physically incapable* of writing an agent line or forging
`by: "agent"`. It is not a sanitiser that could be bypassed; there is no code
path that merges a request body into a line.

## The three modes an agent learns in

**Mode 1 — drain at gate (always, mandatory).** Every phase's ground step runs
`desk.py drain`. It reads a file, so it works with pmview stopped, `:8765`
stopped, on another machine, in another harness. This is the only mode a
non-Claude-Code harness needs.

**Mode 2 — presence-gated background wake (the default when the human is there).**
`post` reports `human_present`. If true — **or if presence is unreadable** —
launch `desk.py wait --surface S --timeout 900` as a **background** task and
**end the turn immediately**. When the watcher exits, the harness re-invokes you
with the answers in hand.

> pmview cannot start or wake a process. It writes a file and nothing else. What
> resumes the agent is a watcher *the agent itself launched inside its own turn*
> before ending it. This adds no new runtime state: the invariant has always been
> that every human gate is a turn boundary, never that every gate is a keystroke.

**Mode 3 — cold resume.** A new session's step 0 is `drain`, which replays every
undelivered human line in order, reports what it replayed, and continues.

## Two rules that are not obvious

**`drain` never acks.** The ack is a separate call you make *after* you have
acted. A session that dies between reading and acting re-delivers on the next
drain — impeccable live's own "the journal is canonical and replays
unacknowledged work" semantics, adopted deliberately.

**Therefore: recall before you capture a redelivered line.** The memory surface
has no idempotency key and no dedup, so a crash between `capture_artifact` and
`ack` would otherwise produce two conflicting rulings of one question. Every node
captured from a desk line quotes `per desk <surface>#<id>` in its content as
provenance, so:

```
recall_context(query="per desk <surface>#<id>", goal_ref=<memory_goal>)
  → hit:  ack, do not capture
  → miss: capture, then ack
```

This is the one place the crash-safe ordering collides with an append-only graph.

## What the agent does while blocked

In order: **(a)** work the next screen with no dependency on an open ask —
`depends_on` and `blocks[]` make that mechanical; **(b)** do the non-blocking half
of the blocked screen (states, component map, constraints cited — an ask usually
blocks one region, not a screen); **(c)** prepare both branches when `options ≤ 3`
and the ask carries a media slot, so the answer is one click on something already
visible; **(d)** out of independent work → `handoff`, one batched `append_events`,
a terminal report, end the turn.

**Never guess.**

## An answer is not a graph write

A desk line is a *request* or a *ruling*, never a capture. Routing conversation
through the graph would make every transient "which layout" permanent goal-bound
knowledge, put it through the trust ladder, and require `:8765` to be **up**
before a human could answer a design question — breaking "reads always work,
writes layer on top" at exactly the moment the lane is most useful.

The **ruling** still becomes knowledge, through the one guarded write path, with
a `goal_ref`, at the phase boundary — like every other capture in this workflow.

## Failure modes, each with a defined behaviour

| | behaviour |
|---|---|
| Human never answers | the ask stays `open`; every later gate reports the count; `/gw-plan` refuses; `/gw-review` reports it in the PR block |
| Human decides not to decide | `decline` — stops counting as open, agent proceeds with its stated fallback |
| Human answers after the session died | the append succeeds with no coordination; the next drain replays it |
| Agent dies after reading, before acking | re-delivered; the recall-by-thread-id rule above prevents the duplicate capture |
| Agent killed mid-`wait` | `waiting.json` is a heartbeat, not a flag — it goes stale in 15 s and pmview's banner fires |
| pmview not running | the terminal path is complete; answer in chat, and write the `answer` line so the log has no hole |
| Memory server down | answering works; only capture is blocked, and it queues to `memory-backlog.md` |
| Two agents on one surface | both append; per-session cursors keep each one's deliveries intact; `ack.refs` make double-work visible |
| Malformed line | skipped with a warning row; one bad line never takes down the pane |
| Poisoned log | a **human** runs `git checkout -- context/design/<surface>/asks.jsonl`, and records the repair in the change. Nothing here ever truncates or rewrites |
