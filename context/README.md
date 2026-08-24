# context/

The split this workflow rests on:

- **files = lifecycle artifacts.** `changes/<id>/{change.md, plan.md}` carry where a
  change *is*; `archive/` is immutable and append-only; `foundation/` holds the
  long-lived documents a human reads whole (PRD, roadmap, tech-stack, ADRs).
- **graph = knowledge.** Everything a future session should be able to *recall* lives
  in `memory-graph.db` (rebuilt on open from the committed `memory-graph.dump`), keyed
  by goal and faceted by change — not filed in a folder.

There are no per-change `notes/`, `research/` or `decisions/` subfolders. That is
exactly what the graph replaces.

## design/

`design/<surface>/` is the one exception, and it is not a per-change folder: it is
keyed by **surface** (a UI target), so a screen's design outlives the changes that
touch it.

```
design/<surface>/
  deck.json                # the screen inventory + wireframe geometry (rungs 0-1)
  screens/<screen-id>.html # clickable prototypes wearing this project's real tokens
  asks.jsonl               # the desk: append-only agent<->human channel
```

The decisions a design session settles still go to the graph. `deck.json` is
sequencing, like `plan.md`; `asks.jsonl` is a conversation, not a capture.
