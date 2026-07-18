---
name: gw-ask
description: Answer a question from the memory graph WITHOUT opening a change — the recall-only entry point for day-to-day questions, hotfix triage, QA sessions, and onboarding. Recalls through the foundation scope, answers grounded in the graph with [node:<id>] cites, journals honest usage, captures nothing. Use when someone asks "how does X work", "why is it like this", "what do we know about Y" outside any change lifecycle. Trigger phrases: "ask the graph", "what does memory say", "/gw-ask".
---

# gw-ask

The lifecycle skills make the graph pay off inside changes; this one makes it pay
off everywhere else. A question answered from settled memory in seconds — with the
provenance handles to prove it — is the daily dividend of all that capture
discipline. Without this path, half the sessions that could feed ranking never
touch the store.

## Steps

1. **Locate the read scope.** Take `memory_goal` from
   `context/foundation/foundation.md` — the foundation scope is the standing
   goal for goal-less questions. If the file or the id is missing, the project
   never ran `/gw-foundation`; say so and answer from files/code alone (and
   suggest running it — an unaskable graph is most of the value left on the
   table).

2. **Recall:**

   ```
   recall_context(query="<the question, in the graph's vocabulary>",
                  goal_ref=<foundation memory_goal>)
   ```

   Empty or off-target bundle → re-query with the graph's own terms (facet
   names, concept labels) before concluding the graph is silent.

3. **Answer grounded.** Build the answer from the bundle first, code/files
   second; cite `[node:<id>]` for every claim the graph carries so the asker can
   trace provenance. Read the bundle honestly:
   - `disputed` blocks: present BOTH sides and say the matter is contested —
     an unresolved dispute served as settled truth is the worst failure this
     skill can produce.
   - `tier=short-term` blocks belong to some change's working memory — say so
     if you lean on one.
   - The graph knows nothing on the topic → say that plainly; a made-up answer
     wearing node citations poisons trust in every future recall.

4. **Journal — one batch, honest:** `USED` for nodes the answer leaned on,
   `NOTED` for nodes read and relevant but not load-bearing. This is how ranking
   learns what people actually ask for.

## Rules

- **Read-only toward the graph.** No `capture_artifact`, no `link`, ever. If the
  conversation surfaces durable knowledge the graph lacks (or contradicts), that
  is work: route it — `/gw-new` for change-shaped knowledge, the `/gw-foundation`
  amendment flow for foundation-grade corrections. Answering and capturing are
  different authorities; this skill has only the first.
- Questions about an active change's territory: prefer that change's
  `memory_goal` over the foundation scope when `change.md` is at hand — the
  bundle arrives pre-ranked for that goal.
- All standing rules apply: honest events only, no trust/flag/tier mutation,
  `context/archive/` untouched.
