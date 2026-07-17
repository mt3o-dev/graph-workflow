# graph-workflow — Pre-project Intake Checklist

*(Polska wersja: [INTAKE.pl.md](INTAKE.pl.md))*

Twelve areas to think through **before** running `/gw-init` on a project. Each
area asks 4–6 questions, and every question carries an example — either a usable
answer or what goes wrong without one. Questions that could not be grounded
confidently in the workflow's actual mechanics were dropped rather than padded.

How to use it: walk the areas in order with the people who will play the human
roles (reviewer, promoter, doc owner). Write the answers down — the best place is
the project's `CLAUDE.md` (capture policy, facet rules, mode routing) and
`context/foundation/` (everything normative, which `/gw-foundation` will then
distill). Skip questions that clearly don't apply to your setup (solo developers
can skim areas 5 and 8), but skip them deliberately.

The normative answers you record are themselves a **foundation document**: once
`/gw-init` has run, feed them to `/gw-foundation` alongside the PRD, tech-stack,
and ADRs — the intake settles constraints and decisions (facet policy, capture
line, mode routing, promotion authority) that belong in the lifetime root set, not
just in prose nobody recalls.

---

## 1. Foundation readiness

`/gw-foundation` can only distill what exists on paper. The graph starts empty,
and the first changes run on whatever the foundation pass put into the lifetime
root set — so the state of your PRD, ADRs, and tech-stack docs at adoption time
directly sets the quality floor of every early recall.

1. Do foundation documents exist at all — PRD, tech-stack decision record, ADRs — and are they current enough to distill, or would `/gw-foundation` be capturing statements you already know are stale?
   *Distilling a PRD that still says "invoices are mutable drafts" plants a lifetime `constraint` that the first real change immediately CONTRADICTS — you start the project with a review-queue backlog instead of a foundation.*

2. Which statements in those documents are actually **normative** — constraints future work must respect, settled domain concepts, decisions with a why — versus narrative, aspiration, or roadmap churn?
   *"Payments cannot ship before KYC" is a constraint worth a node; "we hope to expand to the EU market in 2027" is aspiration that has no enforcement value in a recall bundle.*

3. Who is the human that will promote foundation nodes to lifetime tier in the GUI, and have they agreed to do it at adoption time — not "later"?
   *Unpromoted foundation nodes are short-term working memory: the moment the `foundation` scope is deactivated and swept, they go dormant and every future recall serves nothing. The whole step hinges on one person confirming the promotion list.*

4. Are known, accepted gaps written down anywhere, so they can be captured as `issue` nodes instead of being rediscovered by every change?
   *"No multi-currency support in v1; amounts assume PLN" captured once as an issue saves N agents from independently investigating why the schema has no currency column.*

5. When a foundation document is amended later, who runs the amendment flow (recall → `impact_of` → capture with CONTRADICTS → human re-promotion), and is that person the same one who edits the doc?
   *If the doc owner edits the PRD but never touches the graph, doc and graph diverge silently — and the graph keeps serving the old constraint with lifetime authority.*

## 2. Domain language & facet vocabulary

Facets are a controlled vocabulary, not a free-text tag cloud. Every
`capture_artifact` carries facet labels, near-synonyms come back as
`facet_warnings`, and facet drift splits the graph — two half-vocabularies that
never rank into each other's recalls. The vocabulary deserves a deliberate first
draft before the first capture, not organic accretion.

1. What is the initial facet set — can you list, today, the 10–20 labels the first month of captures will use?
   *A starter set for an invoicing product: `invoicing`, `payments`, `tax`, `reporting`, `auth`, `data-layer`. Starting with zero agreed facets means the first three agents each invent their own and the collision detector spends its life asking "did you mean…?".*

2. Do your facets separate the **subsystem** axis (where in the code) from the **domain** axis (what business concept), and do you know which axis a given label belongs to?
   *`data-layer` is a subsystem; `vat` is a domain concept. A node about VAT rounding in the persistence code legitimately carries both — collapsing the axes into one muddled list makes recall queries miss half the relevant nodes.*

3. Who owns vocabulary additions — when an agent hits a genuinely new concept, is there a named human who approves the new facet, or does the agent decide alone?
   *Without an owner, `billing`, `invoicing`, and `invoices` all enter the vocabulary within a week, and the near-synonym warnings become noise everyone re-ignores.*

4. What is the standing instruction for handling `facet_warnings` — when should an agent accept the suggested existing label, and when is keeping a distinct new one justified?
   *A usable rule: accept the suggestion unless the two concepts would ever need to be recalled separately. `tax` vs `vat` may genuinely differ (excise, withholding); `invoice` vs `invoicing` never will.*

5. Are the project's core domain terms defined consistently enough to become `concept` nodes — or do team members currently mean different things by the same word?
   *If "account" means a ledger account to finance and a user login to engineering, capture two distinct concepts with distinct facets now — otherwise the first recall that mixes them misleads with full confidence.*

## 3. Change granularity & naming

The change is the workflow's unit of everything: one worktree, one fresh agent
context, one liveness root, one goal node, one facet value. Get the granularity
wrong and either the sweep archives half-finished thinking (too big, abandoned
midway) or the graph fills with goal nodes that each anchor two artifacts (too
small).

1. What is "one change" for this project — can you state a size heuristic in terms of phases and review effort?
   *A workable rule: a change is what one agent can implement against one plan.md and one human can review in one sitting. "Rebuild the reporting module" is a roadmap item, not a change-id.*

2. What is the change-id naming convention — outcome-named, kebab-case, unique forever?
   *`invoice-vat-rounding` names the outcome; `fix-bug` and `johns-task-3` name nothing, and since the id becomes a permanent facet on every node the change captures, a bad name pollutes the graph long after the folder is archived.*

3. When a change grows mid-flight, what is the split trigger — and does the team know that a deep `impact_of` result at plan time is a signal to split, not to push on?
   *A plan that must supersede a node with dependents at depth 3 across two subsystems is two changes wearing one id: split, and give the second change `parent_refs` into the first's captured decisions.*

4. When will you use `parent_refs` — do follow-up and sibling changes link to the surviving nodes of the changes they build on?
   *A follow-up change opened after `invoice-vat-rounding` is archived should pass `parent_refs: [node_0801]` (its core decision) so the new goal's recall pulls the prior episode's cone instead of rediscovering it by keyword luck.*

5. Is follow-up work always a **new** change — is the team clear that an archived change is never re-opened in place?
   *`context/archive/` is immutable and its scope is dormant by design; "let me just reopen the old folder" is the one move the workflow aborts on. New work, new id, parent_refs back.*

## 4. Capture policy

Capture quality is the ceiling of the whole system: retrieval is deterministic,
so recall serves exactly what capture wrote — nothing better. A project needs
its own concrete answer to "what is durable residue here?", written in its own
domain language, before agents start writing nodes.

1. Can you give project-specific examples of each artifact type — one real `decision`, `constraint`, `invariant`, `issue`, and `concept` from your domain, phrased to be read cold?
   *For a logistics product: decision — "Route optimization runs nightly, not on-demand: carrier APIs rate-limit at 100 req/h." Constraint — "Shipment labels are immutable after carrier handoff." Invariant — "Every parcel has exactly one active route." If the team can't produce these now, agents will guess the register later.*

2. Where is the line between durable residue and narration for this project — what will you explicitly NOT capture?
   *"Refactored the parcel service and moved three files" is git history, not knowledge. "The parcel service must not import from billing (layering rule discovered in review)" is a constraint worth a node. Write both examples into the project's CLAUDE.md so the contrast is standing instruction.*

3. What is the tier default policy — when may an agent set `mid-term` instead of `short-term` at capture time?
   *A usable rule: short-term unless the artifact is already known to outlive the change (a discovered layering rule, a carrier-API quirk every future integration hits). Long-term and lifetime are never set at capture — they are human promotion outcomes.*

4. Do agents know the one-statement-per-node rule, and is there a standing size check?
   *Three small nodes — the rounding decision, the reports-path risk, the migration constraint — each rank independently in recall. One 400-word "phase 2 summary" blob either always ranks or never does, and can't be edge-linked with any precision.*

5. Are edges part of the capture standard — is an artifact with no relateable target treated as a signal to reconsider the capture?
   *Node+edges commit atomically; a decision that DEPENDS_ON nothing and contradicts nothing is either foundational (rare after /gw-foundation ran) or too vague to serve. "What does this relate to?" is answered at capture time, not retrofitted.*

6. Who reviews capture quality in the first weeks — will `/gw-review` sessions explicitly check the change's captured nodes against this policy while habits form?
   *The first ten changes set the register for every capture after them; a reviewer who flags narration-nodes and blob-nodes early is cheaper than a graph cleanup later.*

## 5. Human roles & review capacity

The workflow has human-only actions built into its safety model: flag
resolution, tier promotion, and the review gate cannot be done by agents, only
surfaced to a person. If nobody owns those actions, disputes accumulate, nothing
gets promoted, and the graph slowly degrades into unranked short-term noise.
Decide who the humans are before the first change opens.

1. Who works the review queue (`uv run agentic-memory-gui` → Review tab), and at what cadence?
   *Example: "The change author triages their own disputed nodes at PR time; the tech lead sweeps the whole queue every Friday." Without an owner, a `disputed` pair from week one is still unresolved in month three, and every recall that touches it forces agents to reason with both sides.*

2. Who has promotion authority — especially for lifetime tier, which requires explicit confirmation in the GUI?
   *Example: "Anyone may promote to long-term; lifetime promotions (foundation-level knowledge) need the architect's confirmation." Lifetime nodes sit in the always-live root set and rank into every relevant recall forever — a careless lifetime promotion is the most expensive mistake a human can make here.*

3. What is your review capacity in changes per week, and will you actually cap open changes at that number?
   *Example: "Two people can review ~5 changes/week, so we never have more than 5 changes open." Review capacity is the designed throughput cap: more agents without review means more unreviewed code and an unworked memory queue, not more shipping.*

4. What happens when the queue backs up — do you stop opening changes, or does the backlog silently grow?
   *Example: "If the review queue exceeds 10 disputed nodes or 3 unreviewed PRs, /gw-new is paused until it's worked down." The workflow says stop opening new changes; agree in advance who calls it, or nobody will.*

5. Who rules on the consolidation candidates at each PR — the change-summary node and CONFIRMED artifacts /gw-review lists?
   *Example: "The PR reviewer either promotes the change summary or explicitly declines it in the same sitting." An unpromoted summary goes dormant at sweep, which defeats its purpose — future recalls in that territory get nothing from the episode.*

## 6. Execution-mode mix

Every change routes to exactly one execution mode: interactive `/gw-implement`
(manual gates, judgment mid-flight) or headless `/gw-goal` (deterministic
verification, humans only at PR). The routing decision is only real if the
headless preconditions can actually be met — which usually means test
infrastructure work before the first `/gw-goal` run.

1. What share of your typical changes is bounded and verifiable by a command — the hard precondition for headless mode?
   *Example: "Dependency bumps, codemod-style refactors, and CRUD endpoints against our API test suite: headless. Anything touching the pricing engine: interactive." If the honest answer is "almost nothing is command-verifiable," plan for interactive-only until that changes.*

2. Do per-phase verification commands exist today, or must they be built first?
   *Example: "`pytest tests/invoicing -k phase_marker` exists; there is no equivalent for the frontend, so frontend changes stay interactive until Playwright coverage lands." /gw-goal refuses to start without a verification command per phase — a plan.md with "manually check the UI" as verification is an interactive plan.*

3. What stop conditions do headless runs get beyond test failure — and does everyone know a `disputed` node that materially affects a phase is always one?
   *Example: "Stop on: verification failure after retries, any disputed recall block touching the phase, any write resolving under context/archive/." An unattended agent must not gamble on either side of a contradiction; that dispute waits for the PR gate.*

4. What retry budget do headless phases get before capturing an `issue` and going to `status: blocked`?
   *Example: "Default 3 attempts per phase; migrations get 1 — a failed migration retried blindly is worse than a blocked change." A truthful partial result beats a flailing loop; pick the number deliberately rather than inheriting the default everywhere.*

5. Who reads the headless run reports before /gw-review, and how quickly?
   *Example: "The change owner reads the run report (phases done, captures, contradictions, retries burned) same-day; blocked runs get triaged within 24h." A blocked headless change holds a worktree, an active liveness root, and possibly a flagged node — it should not sit unread for a week.*

## 7. Parallelism & worktree strategy

Parallel changes are the point of the 10x side of this workflow — but each one
is a worktree, a fresh agent context, and an active liveness root in a shared
store. Decide the shape of that parallelism before you scale it.

1. How many changes will run concurrently, and is that number at or below your review capacity from area 5?
   *Example: "Three concurrent changes max, because that's what two reviewers absorb." The cap is not a suggestion: every open change is an active liveness root and a future entry in the review queue.*

2. What is your worktree naming and placement convention?
   *Example: "`git worktree add ../<repo>-<change-id> -b <change-id>` — sibling directory, branch named after the change." One change per worktree, one worktree per change; a shared working directory between two agents means two changes writing one uncommitted state.*

3. Do all agents get a fresh context per change, or are you tempted to reuse a long-running session across changes?
   *Example: "Each change starts a new agent session; the seed recall from /gw-new is what carries context in, not conversation history." Reusing one session across changes defeats the design — the graph, not the chat scrollback, is the memory.*

4. What do you expect to happen when two parallel changes contradict each other — and does the team know that's the system working?
   *Example: "Change A captures 'totals read from header', change B's migration contradicts it; B's agent records CONTRADICTS, both nodes show disputed in each other's recalls, and the pair lands in the review queue before either merges." If the team treats a disputed pair as an error to suppress rather than a queue item to resolve, parallel work will silently degrade.*

5. Will overlapping subsystems run in parallel at all, or do you partition changes by facet/subsystem?
   *Example: "Two changes may not both touch `invoicing` in the same week; cross-subsystem pairs run freely." The store makes cross-change conflicts visible, but partitioning hot subsystems keeps the review queue small.*

## 8. Team & store sharing

There is one store per project (`context/memory-graph.db`), the binary stays out
of git, and the legible dump is the merge surface. Solo use is trivial; team use
needs explicit discipline, because two people writing the binary concurrently is
undefined.

1. Solo or team — and if team, is everyone actually going to share one graph, or does each member run a private store?
   *Example: "Team of three, one shared graph — otherwise Alice's constraints never appear in Bob's recalls, and the workflow's whole cross-change payoff is lost." A private-store team is really N solo projects wearing one repo.*

2. Is the dump/restore discipline written down where nobody can miss it — dump before push, restore after pull?
   *Example: "Pre-push hook runs `scripts/dump_db.py`; post-merge hook runs `scripts/restore_db.py`; the dump file is committed, the .db is gitignored." An uncommitted dump means your teammates' agents recall a graph that's missing your last week of captures.*

3. Who resolves merge conflicts on the dump file, and how?
   *Example: "Conflicts on the dump are resolved by the change author like any text conflict, then `restore_db.py` rebuilds the local store; if the conflict involves disputed nodes, it goes to the review-queue owner instead." Decide this before the first conflict, not during it.*

4. Are you preventing concurrent writers to one store file — separate clones with their own local stores, synced only through git?
   *Example: "Each member's clone has its own context/memory-graph.db rebuilt from the committed dump; nobody points two sessions at one store over a network share." The single-writer assumption is structural, not a style preference.*

5. How is the MCP server registered — user-wide `claude mcp add`, or a committed `.mcp.json` so every contributor gets it automatically?
   *Example: "Committed .mcp.json with a `--directory` path agreed in the README, so onboarding is `git clone` + `uv sync` and the server just works." User-wide registration works solo; on a team it means every new member silently runs without memory until they notice captures are being lost, not queued.*

6. Does CI or any automation open sessions against the store — and if so, does it get a disposable store or the real one?
   *Example: "CI runs /gw-goal smoke tests against a store restored from the dump into a temp directory, never the developer's live .db." Automation writing to a store nobody reviews produces journal noise that corrupts ranking for everyone.*

## 9. Environment & tooling

The workflow degrades to plain 10x the moment the memory server is unreachable —
and captures are *lost, not queued*. Settle the plumbing before the first
change, not during it.

1. Where will agentic-memory-system live, and is `uv` available everywhere agents run?
   *Example: a shared clone at `/opt/agentic-memory-system` with `uv` on every dev machine — versus each contributor cloning to a different path, breaking the committed `.mcp.json` for everyone else.*

2. Will the MCP server be registered user-wide (`claude mcp add`) or per-project via a committed `.mcp.json`?
   *Example: a solo developer working across many projects registers user-wide; a team commits `.mcp.json` so every contributor gets the server without setup — but then the `--directory` path must be one everyone actually has.*

3. Does the server's working directory (or an explicit `MEMORY_DB_PATH`) resolve to *this* project's `context/memory-graph.db` — and only this project's?
   *Example: launching the server from the wrong directory silently opens a different store; one store pointed at two projects poisons both.*

4. What is the team's rule when the memory surface is down — which phases stop, which proceed?
   *Example: "mechanical fixes may proceed file-only; research and plan boundaries wait" — because a capture made against a dead server is not queued for later, it simply never happened.*

5. Do CI and headless environments need the server at all, and if so, who starts it?
   *Example: a `/gw-goal` run in CI needs the MCP server in the job container; a plain test pipeline does not — deciding this late means either flaky headless runs or a server bolted into every unrelated job.*

6. Who can run the privileged surfaces — the lifecycle script (`memory_lifecycle.py`) and the GUI — and from where?
   *Example: archival at merge needs `uv run python scripts/memory_lifecycle.py deactivate <id> --sweep` runnable from the project; if only one person's machine can reach the memory repo, every merge queues behind them.*

## 10. Knowledge sensitivity & hygiene

Recall serves node content **verbatim** to any future agent session, and in team
mode the legible dump is committed to git. Treat every `capture_artifact` as a
write to a durable, shared, greppable document.

1. What classes of content are banned from the graph outright?
   *Example: credentials, API keys, PII, client-confidential terms — "the Stripe key lives in vault X" is a fine constraint; the key itself in a node body ends up in the git-committed dump forever.*

2. Is the store shared via the committed dump, and does everyone understand that makes node content repo-visible?
   *Example: a contractor with repo access reads every captured decision, including the pricing rationale someone pasted into a `decision` node "for context".*

3. How will you phrase artifacts about sensitive systems without embedding the sensitive part?
   *Example: capture "auth tokens rotate every 24h; consumers must not cache them" (the constraint), not the token format, sample values, or the incident post-mortem's customer names.*

4. Who audits the graph for leaked content, and when?
   *Example: the reviewer scans new nodes at the `/gw-review` memory gate — the same moment they rule on promotions — because after merge the dump is in history and removal means a rewrite.*

5. Does anything in the PRD/ADRs itself need redaction before `/gw-foundation` distills it?
   *Example: an ADR naming a partner under NDA gets distilled as "the payment partner requires idempotent webhooks", not the partner's name.*

## 11. Maintenance & lifecycle cadence

Trust folding, flag resolution, and promotion are privileged operations that run
*outside* the agent surface. If nobody schedules them, the queue grows, disputed
nodes pile up, and recall slowly fills with stale, contested knowledge — the
graph rots exactly as fast as the humans ignore it.

1. Who works the staleness/review queue, and on what cadence?
   *Example: the reviewer opens `uv run agentic-memory-gui` → Review tab at every PR gate, plus a weekly sweep of anything the PRs missed — versus a queue nobody owns, where every disputed node stays disputed forever.*

2. When does the evaluator / privileged maintenance (trust folding, rules-based flag resolution) actually run, and triggered by whom?
   *Example: a scheduled weekly batch — headless `/gw-goal` changes depend on the rules+evaluator path for validity, so "never" means their contradictions accumulate untriaged.*

3. Will reviewers enforce consolidation at `/gw-review`, or is it optional in practice?
   *Example: a PR checklist item — "change-summary node exists and promotion candidates ruled on" — because an unpromoted summary goes dormant at the sweep and the episode vanishes from live recall.*

4. What does "healthy" look like for this graph, and who checks?
   *Example: recalls surface mostly promoted, undisputed nodes; the review queue trends to empty after each PR cycle. Rotting: seed recalls dominated by `disputed` tags, promotion candidates never ruled on, sweeps archiving everything because nothing was promoted.*

5. What is the rule for changes that stall or are abandoned — who closes their memory scope?
   *Example: a change dormant for a month still holds its liveness root ON, keeping its short-term noise live in every recall; someone must decide to `/gw-archive` it with `status: abandoned`.*

## 12. Success criteria & exit strategy

The workflow costs discipline at every phase boundary. Decide up front how you
will know it is paying for itself — and what leaving looks like — so the
decision to continue is evidence, not sunk cost.

1. What observable change means the graph is working?
   *Example: seed recalls on new changes surface relevant constraints a fresh agent would otherwise re-derive; plans stop violating settled decisions unknowingly; the same architectural argument stops being re-litigated every quarter.*

2. What will you actually check, and when?
   *Example: after the first five archived changes, read three recent recall bundles — if the top-ranked blocks are foundation nodes and consolidated summaries rather than noise, capture quality is holding; if recalls come back empty or irrelevant, fix capture discipline before scaling up.*

3. What is the leading failure signal you will watch for?
   *Example: agents skipping `append_events` (sessions invisible to ranking) or captures reading like narration — both degrade recall months before anyone notices, so spot-check the journal early.*

4. If you abandon the workflow, what survives?
   *Example: foundation docs were always the human source of truth, so nothing knowledge-critical lives only in the graph; the committed dump is legible text, so past decisions remain greppable even with the server gone.*

5. What is the minimum viable retreat, short of full abandonment?
   *Example: drop to plain 10x (files only) but keep `/gw-foundation` and the review-gate consolidation — the two highest-value capture points — rather than an all-or-nothing exit.*
