# The desk

**One append-only file per surface is the entire agent↔human design channel.**

```
context/design/<surface>/asks.jsonl
```

Git-tracked. Nobody edits a line, nobody deletes a line. The agent posts a
question and ends its turn; you answer in pmview; a watcher the agent launched
wakes it.

The operational reference — commands, exit codes, the eight line kinds, the
failure table — is [`skills/gw-desk/REFERENCE.md`](../skills/gw-desk/REFERENCE.md).
This page is the *why*.

---

## Why an answer is not a graph write

The obvious design is to make each ask a `type: issue` node and each answer a
capture. It is wrong, for three reasons that only show up later:

1. **It routes conversation through the trust ladder.** "Third pane or modal
   drawer?" is a transient question about one screen on one afternoon. As a node
   it acquires a trust weight, a review flag, a staleness clock, and a place in
   every future recall bundle — permanently, as goal-bound knowledge.
2. **It makes `:8765` a hard dependency for answering a question.** The memory
   server would have to be **up** before a human could tell an agent which layout
   they prefer. That breaks *"reads always work, writes layer on top"* at exactly
   the moment the lane is most useful — the agent is blocked, the human is at the
   tab, and the thing standing between them is a server neither of them is
   thinking about.
3. **It confuses a request with a ruling.** The question is not knowledge. The
   *answer to it* is — sometimes. "Use the third pane because I need to read the
   constraint while I answer" is a decision worth recalling in a year. "Yes, that
   one" is not.

So the desk holds the conversation, and the **ruling** still becomes knowledge
the ordinary way: `capture_artifact` with a `goal_ref`, through the one guarded
write path, at the phase boundary — like every other capture in this workflow.
Each captured node quotes `per desk <surface>#<thread-id>` in its content, so the
conversation that produced it is one recall away.

`gui/pmview/design.py` imports neither `memory`, `graph` nor `board`. That is not
tidiness; it is the property that makes the paragraph above true.

---

## How an agent gets woken — both honest framings

Read them together. Either one alone is misleading.

**(a) pmview cannot start or wake a process.** It writes a file. It has no pid to
signal, no socket to the agent's harness, and no way to cause anything to run. If
nothing was already watching, your answer simply sits in the log until something
reads it.

**(b) A background poll that wakes an agent is still a turn boundary.** It just
moves the keystroke from a terminal to a browser. What resumes the agent is a
watcher *the agent itself launched inside its own turn*, before ending it, plus
the harness's contract that a backgrounded command keeps running across turns and
re-invokes on exit.

This adds no new runtime state, because the invariant was never *"every gate is a
keystroke"* — it was **"every human gate is a turn boundary"**, and this is one.

It is also harness-shaped, so the honest sentence for the README is:

> pmview cannot start or wake a process. What resumes the agent is a watcher the
> agent launched before ending its turn, and it only runs when you were at the tab
> when the question was posted. When you were not, the terminal is where you pick
> the thread back up — one command, with a copy button waiting for you in the
> Design tab.

Other harnesses degrade to **drain at gate**, which is mandatory everywhere and
needs nothing but a filesystem.

---

## What the desk does *not* guarantee

**It does not authenticate the human.** No local mechanism can, against an agent
running on the same machine as the browser. An agent with shell access can append
a line claiming `by: "human"`.

What the lane guarantees instead is **visibility**:

- every line is in the git diff, in the same PR as the code it shaped;
- every capture sourced from a desk line quotes its thread id;
- `/gw-review` Part 1b lists those captures under a heading that says
  **UNVERIFIED input** and points at `asks.jsonl` in that diff.

A reviewer who wants to check, reads the file. That is a weaker claim than
authentication and a stronger one than a channel nobody can audit.

Within pmview, one thing *is* structural: the server is **physically incapable**
of writing an `ask`, `note`, `ack`, `retire` or `handoff`, or of forging
`by: "agent"`. Route 5 constructs each line field by field from an allowlist and
stamps `by`, `src`, `id` and `ts` itself. There is no code path that merges a
request body into a line, so this is a property of the construction rather than a
sanitiser someone could get around.

---

## Recovery

Append-only is a discipline, not a physical law. A corrupted or poisoned log is
repaired by a **human**:

```sh
git checkout -- context/design/<surface>/asks.jsonl
```

Record the repair in the change. Nothing in pmview or `desk.py` ever truncates,
rewrites or deletes a line — a malformed line is skipped with a warning row, and
one bad line never takes down the pane.

Two writers on two machines conflict as ordinary text, which `.gitattributes`
resolves with `merge=union`: for a log of questions and rulings, keeping both
sides is always right. `merge=union` is a **built-in** driver needing no local
registration — unlike a clean/smudge filter, which is what silently broke fresh
clones for the store once already.

---

## The one collision worth knowing about

`drain` never acks. The ack is a separate call the agent makes *after* it has
acted, so a session that dies in between re-delivers on the next drain. That is
deliberate — it is impeccable live's own "the journal is canonical and replays
unacknowledged work" semantics.

But the memory surface has no idempotency key and no dedup. So a crash between
`capture_artifact` and `ack` would produce **two conflicting rulings of one
question**, months apart, one of them dormant.

The rule, which every skill acting on a drain states:

```
recall_context(query="per desk <surface>#<id>", goal_ref=<memory_goal>)
  → hit:  ack, do not capture
  → miss: capture, then ack
```

This is the one place the crash-safe ordering collides with an append-only graph.
It is named here so nobody has to rediscover it from two contradictory nodes.
