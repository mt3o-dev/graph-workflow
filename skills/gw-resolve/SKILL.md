---
name: gw-resolve
description: Run the human memory-resolution session conversationally — iterate the disputed-node queue together with the human, present both sides of each contradiction with evidence and a recommendation, take the human's per-item ruling in chat, and apply it as their scribe through the privileged GUI API. Also handles the promotion pass and the deferred sweeps. Use when disputes/promotions have accumulated and the human is present. Trigger phrases: "resolve the queue", "work the disputes", "promotion pass", "/gw-resolve".
---

# gw-resolve

The review queue is where the workflow's honesty accumulates as debt: every
CONTRADICTS edge, every foundation amendment, every gate finding lands there
waiting for a human ruling. The GUI can be worked alone — this skill is for
working it **together**: the agent brings evidence, blast radius, and a
recommendation to each item; the human brings judgment; the ruling is applied
immediately and journaled as a guided human action.

**Safety model, restated hard:** the agent NEVER rules. Every mutation in this
skill happens only after the human states their decision for that specific item
in the conversation. The privileged surface (`gui_api`) journals each write as
`gui-guided` with `recommended_action` vs what the human actually chose — the
divergence is data. Interactive only: refuse to run headless, refuse batch
("apply your recommendations to everything") requests — that would be the agent
ruling with extra steps.

## Setup

1. Locate the store (`context/memory-graph.db` of the project) and start the
   human surface if not already running:
   `MEMORY_DB_PATH=<store> uv run agentic-memory-gui` (background,
   127.0.0.1:8765). The skill drives its HTTP API; the human may keep the
   browser GUI open in parallel — same journal, no conflict.
2. Pull the queue: `GET /api/review`. Order it for the session:
   1. disputes with `NOTED` blocked-work events (something is stalled on them),
   2. foundation/lifetime-adjacent nodes (widest blast radius),
   3. superseded lineages (fix committed, flag just needs closure — fast wins),
   4. everything else, oldest first.
   State the count and the order; let the human reorder or timebox.

## Per item — the loop

For each disputed node:

1. **Present the conflict, both sides verbatim.** The flagged node's body, every
   `CONTRADICTS` partner's body, tiers, and who-contradicted-whom with dates
   (`GET /api/nodes/{id}` + review context).
2. **Bring evidence, not just text.** `impact_of` the node (dependents =
   blast radius of ruling against it); the journal events (was it USED
   recently? CONFIRMED by whom?); and where the dispute is *checkable against
   the codebase*, check it — read the code and report what reality says. The
   evaluator hint (`GET /api/review/{id}/guidance`), when available, is
   presented as one more opinion, labeled as such.
3. **Recommend, with a confidence and a why.** One of:
   `still_valid` (the flag is a false alarm) · `superseded` (the contradicting
   node wins; pass `replacement_id`) · `wrong` (the node is simply incorrect) ·
   `needs_correction` (right idea, wrong words — draft the `new_body` for the
   human to approve or edit) · `defer` (genuinely undecidable now; stays
   queued). A recommendation is one sentence + the strongest single piece of
   evidence. Never oversell; "idk" from the human is a valid outcome — that is
   what `defer` is for.
4. **Take the ruling in chat.** The human picks an action (and optionally a
   tier move — lifetime requires them to say "lifetime" explicitly; the API
   enforces `tier_confirmed`). Silence or ambiguity → ask once, else defer.
   **`still_valid` on a short/mid-term node is a trap when a sweep is coming:**
   the ruling clears the flag but does not save the node — if it reads durable,
   offer the tier move in the same breath, or put it on the promotion-pass
   list explicitly. (Learned the hard way: a validity-ruled invariant got swept
   twenty minutes after its ruling because it missed the promotion list.)
5. **Apply as scribe:** `POST /api/review/{id}/resolve` with the human's
   action, `recommended_action` (yours, honestly), `reason` quoting the
   human's words, `new_body`/`replacement_id`/`tier` as ruled. Report the
   result (trust movement, next item id).
6. If the ruling itself is new knowledge ("we choose X because Y" where Y was
   never captured), capture it as a `decision` node via the agent surface —
   rulings resolve flags; captures preserve the why.

## The promotion pass (same session, after the queue)

Present the accumulated promotion candidates (change summaries, CONFIRMED
constraints/decisions the gates nominated) grouped by change, each with a
one-line why. For each the human approves: `POST /api/nodes/{id}/tier`
(lifetime again requires their explicit word). Candidates the human declines
are recorded as declined in the session summary — dormancy at the next sweep is
then the correct, chosen outcome.

## The sweep finale (only if the human wants it)

With the queue worked and promotions done, deferred archives can finally
sweep: for each file-side-archived change whose store-side deactivate+sweep
was deferred, run the pre-sweep blast-radius check (gw-archive step 3), then
`POST /api/changes/{id}/deactivate` + `POST /api/sweep` (or the
`memory_lifecycle.py` script). Report exactly what went dormant. Never sweep a
change whose promotion candidates were not yet ruled on.

## End of session

- Summary: items resolved (per action), deferred (with why), promotions made
  and declined, sweeps run, queue size before → after.
- Journal the session via the agent surface: `REVIEWED` events for nodes
  discussed but left unchanged — the reads feed ranking too.
- Anything discovered mid-session that is change-shaped work (a dispute whose
  resolution requires code changes) gets routed to `/gw-new`, not resolved by
  wishful ruling.

## Rules

- Interactive only; a human ruling per item; no batch auto-apply; no ruling
  inferred from "sounds good" — get the action word.
- The agent's recommendation goes into the journal next to the human's choice —
  never adjust the recommendation after hearing the human lean.
- Lifetime promotions and sweeps only on the human's explicit word.
- If the GUI API is unreachable, degrade to guide mode: same presentation, the
  human clicks in the browser; never fall back to editing the store directly.
