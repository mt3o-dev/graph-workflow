---
name: gw-teach
description: Teach the human something this project knows, using the graph as the curriculum — prerequisites ordered by DEPENDS_ON, the frontier computed from what the journal says they have already used, every claim cited to a node or a URL. Refuses to teach a topic the graph does not hold rather than inventing it, writes a gitignored explainer, and journals USED so teaching feeds ranking. Use when someone wants to understand a part of this system rather than change it. Trigger phrases "teach me", "explain how X works here", "I want to understand", "onboard me", "/gw-teach".
---

# gw-teach

Every other skill here spends the graph on the codebase. This one spends it on
the person — and it is the only one whose *whole output* is a human's
understanding rather than an artifact.

The reason it belongs in this workflow rather than being a generic tutor: **the
graph is already a curriculum, and three of the things a teaching tool normally
has to build from scratch already exist and are live.**

| a teaching workspace builds | this project already has |
|---|---|
| a glossary | `domain_model()` — ratified, hub-linked, never decays |
| learning records | the journal — `USED` / `CONFIRMED` / `NOTED`, per node, with reasons |
| a mission | the foundation goal and `roadmap.md` |

And the thing a flat glossary structurally cannot do: **`DEPENDS_ON` is a
prerequisite chain.** A file-based teacher has to guess what to teach first.

## Preconditions

- A graph with something in it. This skill is a dividend on capture discipline,
  and there is no dividend without the deposit.
- A person who wants to understand rather than to change something. Wanting to
  *change* it is `/gw-new`; wanting an answer to one question is `/gw-ask`.

---

## Step 1 — The mission

Teaching ungrounded in *why* produces abstract exercises people abandon. In this
workflow the default mission is already on disk: the foundation goal plus
whatever change is open. Read it and say what you assume — ask only when it is
genuinely unclear.

## Step 2 — Locate the topic in the graph

```
recall_context(query="<topic>", goal_ref=<foundation memory_goal>)
domain_model(status="confirmed")
```

**If the topic is not in the graph, say so and stop.** You would be teaching from
parametric knowledge — plausible, uncited, and quite possibly not how *this*
project does it, which is the one thing the person is here to learn. Offer
`/gw-research` (find out and capture it) or `/gw-foundation` (the project has
docs nobody distilled) instead.

This refusal is the skill's most useful behaviour and the easiest to skip.

## Step 3 — Order by dependency

Walk `DEPENDS_ON` outward from the entry nodes and teach prerequisites first.
A `decision` that rests on a `constraint` is unteachable before it — the learner
gets the *what* and none of the *why*, which is the failure mode that makes
people think documentation does not help.

Say the order out loud before starting. It is often the most valuable single
output of the session: *"there are four things under this, and they only make
sense in this sequence."*

## Step 4 — Find the frontier from the journal

The zone of proximal development, computed rather than guessed:

| journal state | means | do |
|---|---|---|
| carries `USED` or `CONFIRMED` | they have worked with it | do not re-teach |
| never touched, **adjacent to a known node** | the frontier | **teach here** |
| three hops out, prerequisites unknown | too far | name it, skip it |

A learner who is told something they already know stops listening; one shown
something four prerequisites deep concludes they are stupid. Both are avoidable
here because the journal already records which is which.

If they say they already know something, that is real information — journal it
(step 7) so the next session starts in the right place.

## Step 5 — Teach, with a citation on every claim

Every claim cites `[node:<id>]` or an external URL. **Never an uncited
assertion**: the entire point of teaching from a graph is that the provenance is
already there, and an uncited claim in a session about this project is
indistinguishable from a confident guess.

Where the graph is thin, say the graph is thin. *"Nothing here records why —
that is a gap, and `/gw-research` would close it"* is a better lesson than a
plausible reason you made up.

## Step 6 — The explainer is a rendering, not a source

Write it to **`.gw-scratch/teach/<topic>.html`** — gitignored, deliberately.
Print the command that opens it.

> A committed explainer becomes a fourth place knowledge lives, alongside the
> docs, the graph and the code — and it will drift from the nodes it renders with
> nothing able to detect the drift. The nodes are the source; this is a view of
> them, and it should be as disposable as a query result.

Make it interactive where that helps — a "try this" callout against the real
codebase beats a paragraph — but nothing in it may write to the repo.

## Step 7 — Journal what the lesson drew on. This is the dividend.

```
append_events([
  {node_id: "<each node the lesson taught from>", type: "USED",
   reason: "taught: <topic>"},
  ...
])
```

`/gw-ask`, `/gw-ideate` and `/gw-plan-review` also journal `USED` outside
implementation work — this is not the only payer. What is particular here is the
*shape* of the usage: a lesson touches a whole dependency chain at once, so a
project where people learn from the graph gets a graph that ranks what people
need to **understand**, not only what got built.

## Step 8 — Quizzing, and the verb that is correct

Quiz with scenarios, not recall — *"a refund arrives for a partially cancelled
order; what happens?"* beats *"what does Cancellation mean?"*

A passed quiz emits **`NOTED`**, never `CONFIRMED`.

> `CONFIRMED` means *the claim was exercised and held* — a test ran, a path was
> traced to ground. A human remembering a fact is not that. `/gw-review` already
> polices this distinction, and inflating `CONFIRMED` corrupts trust-folding
> everywhere. A teaching skill must not be the hole in it.

---

## Rules

- **Never teach what the graph does not hold.** Say it is absent and route.
- **Cite everything**, to a node or a URL.
- **Prerequisites first**, walked from `DEPENDS_ON` rather than guessed.
- **Never capture new knowledge here.** A human learning something does not make
  it true. If a session *discovers* something — a contradiction, a gap, a
  decision nobody wrote down — that is a finding to report, and a capture inside a
  change, not here.
- **Never promote a tier**, never resolve a flag. Same invariant as everywhere.
- **Never commit an explainer.**
- **`NOTED`, not `CONFIRMED`.**

## Degradation

| missing | what happens |
|---|---|
| the topic is not in the graph | refuse, name the gap, route to `/gw-research` or `/gw-foundation` |
| no foundation goal | `/gw-foundation` has not run — recall has no standing scope; say so |
| no domain model | teach anyway, but flag that the vocabulary is unratified |
| memory server down | reads still work from the committed dump; the `USED` events queue to `memory-backlog.md` per the standing degraded-mode rule |
