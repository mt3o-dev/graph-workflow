# pmview — a project-management view over the workflow's artifacts

The memory system ships a GUI for *one node at a time*: the staleness queue, tier
promotion, the guided resolution wizard. This one answers the other question —
**where does the work stand?** — by joining the two halves the lifecycle keeps
apart:

- `context/changes/<id>/` and `context/archive/<id>/` — the thin lifecycle files
  (`change.md`, `plan.md`) the graph deliberately does not hold;
- the memory store — the goal, the anchor, the captured nodes, their edges, and
  the append-only journal.

Neither is a project picture on its own. Joined, they give a board of changes by
lifecycle stage and an issue queue over what a human still has to rule on.

```sh
# from the repo root, pointed at a project (or a parent of several)
PYTHONPATH=gui python3 -m pmview /path/to/project --open
PYTHONPATH=gui python3 -m pmview dogfood            # all three dogfooded projects
```

Python 3.11+, standard library only — no install step, no build step, no
dependencies. Serves <http://127.0.0.1:8766>.

## The three views

**Board** — one column per lifecycle stage (`unopened`, `new`, `planned`,
`in-progress`, `review`, `archived`), one card per change. Each card carries its
epic, how many nodes the change *captured* versus how much context it *inherited*,
its review debt, and its open contradictions. Cards that never made it into the
graph are flagged `not in graph` rather than quietly omitted — an unlinked change
is a workflow problem worth seeing. Opening a card shows the goal, the plan phases,
every captured and inherited node, the contradiction pairs, and the archive note.

**Issues** — every `type: issue` node plus the whole flagged backlog, bucketed by
what a human owes it:

| bucket | meaning |
|---|---|
| `disputed` | `needs_review` is set — the review ladder is waiting on a ruling |
| `contested` | sits on a `CONTRADICTS` edge |
| `open` | live, unflagged, uncontested |
| `dormant` | archived by a sweep — retired from recall, never deleted |

**Search** — substring over node bodies, paths and id prefixes.

Selecting any node opens a detail panel: full body, facets, the change that scoped
it, both edge directions, and the complete journal with each event's source,
polarity and reason — the mechanism the agent read path hides on purpose.

## Reads come from disk; writes go to the memory server

The board reads the store directly — SQLite on a working machine, the committed
text dump on a fresh checkout, detected automatically — so navigation works with
nothing else running.

Every **write** is forwarded to the agentic-memory-system GUI API
(`uv run agentic-memory-gui`, default `http://127.0.0.1:8765`, override with
`--memory-url`). That is deliberate, and it is the one design rule to keep if you
extend this:

> Nothing here mutates trust, clears a review flag, promotes a tier, or archives a
> node. Trust is folded from the journal; flags resolve through the
> evaluator/human ladder; archival is a merge consequence. A second write path
> that bypassed the memory server would break exactly the invariant the workflow
> is built on.

So body edits, edge creation, artifact capture, guided review resolution and tier
changes are all proxied, and each one is journaled by the memory server with its
own source (`gui`, `gui-guided`). Lifetime promotion still requires the explicit
confirmation the server demands. When the memory server is not running the header
reads **memory: read-only** and writes fail with `memory_unavailable` — the board
never silently does something weaker.

## Endpoints

| method | path | |
|---|---|---|
| GET | `/api/projects` | discovered projects |
| GET | `/api/board` | the board, joined and counted |
| GET | `/api/changes/{id}` | one change: nodes, contradictions, sections |
| GET | `/api/issues` | issue nodes + the flagged backlog (`?flagged=0` for issues only) |
| GET | `/api/nodes/{id}` | body, facets, edges, journal |
| GET | `/api/search?q=` | substring search |
| GET | `/api/memory/status` | is the write path live |
| POST | `/api/nodes/{id}/body`, `/tier`, `/api/review/{id}/resolve`, `/api/edges`, `/api/nodes` | proxied writes |

All read endpoints take `?project=<name>`, defaulting to the first discovered.

## Conventions it relies on

Established by the `gw-*` skills; a project that departs from them degrades to
thinner cards rather than an empty board:

- the change anchor (a `slice` node) lives at `/change/<change-id>`;
- its Goal node lives at `/goal/<change-id>` and is recorded in `change.md` as
  `memory_goal:` (authoritative — the path is only the fallback);
- captured artifacts hang off the anchor by `SCOPED_TO`, anchor → artifact. The
  "captured" count is that edge set, so it agrees with the memory GUI's own.
  Goal `DEPENDS_ON` targets and `[node:...]` citations in `change.md` are counted
  separately as inherited context, because they include parent-refs seeded from
  earlier slices.

## Tests

```sh
python3 -m unittest discover -s gui/tests
```

They run against the dogfooded Coffer store committed in this repo, so the parsers
are exercised on the real dump rather than a hand-made fixture, and the HTTP tests
assert that a write attempt with no memory server leaves the store byte-identical.
