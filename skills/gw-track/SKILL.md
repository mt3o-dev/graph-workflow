---
name: gw-track
description: Keep a change and its issue-tracker item in sync — GitHub Issues, Linear, Jira, or none. Adopts an existing issue into a change or opens one for it, pushes phase progress and status at the lifecycle gates, pulls acceptance criteria back, and reports divergence as a finding instead of silently overwriting either side. Tracker-agnostic via a per-project binding. Use at /gw-new, at plan and phase boundaries, at /gw-review, and at /gw-archive. Trigger phrases "sync the issue", "link this to the tracker", "work on ISSUE-123", "update the ticket", "/gw-track".
---

# gw-track

Three surfaces, three jobs. Confusing them is how this integration usually goes wrong:

| Surface | Holds | Read by |
|---|---|---|
| `context/changes/<id>/` | **lifecycle state** — how to pick this work up | the agent and whoever takes over |
| the memory graph | **knowledge** — what any future change must not repeat or contradict | future recalls |
| the **tracker** | **work state** — what is happening, to whom, and when | people who are not in the session |

This skill owns only the third. A decision recorded in an issue comment is a decision no
future recall will ever serve — knowledge goes in the graph, always. The tracker is how
the work becomes visible to people outside it, and nothing more.

**The problem this skill actually solves is authority, not transport.** Both sides have
human authors: an agent writes `change.md`, but a product owner writes the acceptance
criteria, a lead sets priority, someone moves the card. A sync that overwrites one side
from the other destroys real work. So the rule is the one the workflow already uses for
contradictions: **divergence is surfaced as a finding, with both sides, never silently
reconciled.**

## Field ownership — settle this before the first sync

| Field | Owner | Direction |
|---|---|---|
| Title / goal statement | shared, set at creation | first writer wins; later divergence is a **finding** |
| **Acceptance criteria** | **tracker** (product authority) | **pull** — they are input to the change, and to `/gw-plan-review` |
| Phase checklist and progress | **workflow** | push |
| Status / workflow state | workflow **proposes**; the board is truth | push a proposal, pull the truth |
| Links: PR, session, change-summary node | workflow | push |
| Assignee, priority, labels, estimate, sprint | **tracker only** | **never written by this skill** |

That last row is not a limitation to work around. An agent that reassigns tickets or
moves priorities is making staffing decisions, which is not its job and not recoverable
by a `git revert`.

---

## Setup (once per project)

1. **Bind the tracker.** Record the choice in `context/foundation/tracker.md`:

   ```markdown
   tracker: github            # github | linear | jira | none
   repo: mt3o-dev/coffer      # github only
   team: MT3                  # linear/jira only
   issue_prefix: MT3-         # how issue keys look in this project
   states: open→in progress→in review→done    # the board's real state names
   close_authority: human     # human | workflow — who may close an issue
   ```

   Then distil the normative parts into the graph via `/gw-foundation` — the state names
   and `close_authority` are `decision` nodes, because every later gate acts on them.
   `tracker: none` is a complete and valid answer; the rest of this skill then no-ops and
   says so once.

2. **Probe the adapter.** Confirm the operations below are reachable *before* the first
   change depends on them (§ Adapters). If the tracker is configured but unreachable,
   say so at the top of the session — silently skipping sync is how a board goes stale
   without anyone noticing.

---

## The operation vocabulary

The skill speaks these seven operations; the adapter table binds them to real calls. Use
these names in your output so a reader can follow what happened regardless of tracker:

| Operation | Meaning |
|---|---|
| `find(change-id)` | locate the item carrying this change's marker |
| `create(title, body)` | open a new item |
| `read(key)` | fetch title, body, state, criteria |
| `update_body(key, body)` | rewrite the managed block only |
| `comment(key, text)` | append a comment — **sparingly**, see below |
| `set_state(key, state)` | move workflow state |
| `link_child(parent, child)` | attach to an epic/parent |

## The marker — what makes this idempotent

Every managed item carries, in its body, a marker and a workflow-owned block:

```markdown
<!-- gw:change=invoice-vat-rounding -->

### Plan (managed by graph-workflow — edit above this line)
- [x] P1 rounding in the invoice aggregate
- [ ] P2 reports path
- [ ] P3 migration

change: `context/changes/invoice-vat-rounding/` · PR: #482 · summary node: `node_0812`
<!-- /gw -->
```

Three properties follow, and all of them matter:

- **`find` before `create`, always.** A duplicate issue is worse than no issue; it splits
  the conversation and nobody notices for a week. Search by marker first.
- **`update_body` rewrites only between the markers.** Everything a human wrote above the
  block survives verbatim. If you cannot edit surgically, `comment` instead — never
  replace a body wholesale.
- The marker is an HTML comment, so it renders invisibly in every markdown tracker.

Record the other half of the link in `change.md`, the same way `memory_goal` is recorded:

```markdown
tracker: MT3-42
tracker_url: https://linear.app/mt3o/issue/MT3-42
```

A change with a tracker configured and no `tracker:` line has not been synced — fix that
before the next gate rather than at the end.

---

## The lifecycle bindings

Like the memory operations, these are **steps inside the one lifecycle**, not a separate
bookkeeping chore. Invoke this skill at these moments; do not batch them up for later.

| Moment | What happens |
|---|---|
| **`/gw-new`** | `find` by change-id → adopt, else `create`. Write `tracker:` into change.md. If the change came *from* an issue, pull its acceptance criteria into the change first (§ Pull). |
| **`/gw-plan` done** | `update_body` with the phase checklist, unticked. This is the first moment the issue tells an outsider what the work actually is. |
| **Phase boundary** | Tick the phase in the checklist. **`update_body`, not `comment`** — progress is state, not news. |
| **`/gw-review`** | Link the PR. One `comment` with the verdict and the memory-gate summary line. |
| **Merge / `/gw-archive`** | Push the final links (PR, session URL, change-summary node id) and `set_state` to done — or *propose* it, if `close_authority: human`. |
| **`/gw-ideate`** | Ideas become tracker items **only on the human's explicit word**, one at a time. An ideation run that auto-files nine issues has flooded a backlog nobody asked it to touch. |
| **`/gw-fix`** | Same as a change. Additionally: if the bug came from a tracker item, the reproduction goes in the item (it is work state and other people need it), while the *lesson* goes in the graph. |

### Comment sparingly — the rule that keeps this usable

The project's capture discipline applies verbatim to tracker comments: **residue, not
narration.** One comment per *gate*, never per action. Prefer editing the managed block
over appending. An integration that posts fourteen comments per change has made the
issue unreadable and trained everyone to mute it — at which point the sync is worse than
nothing, because the board now looks maintained and is not.

Before any `comment`, ask: *would a person not in this session want to be notified of
this?* Phase 2 of 5 finishing is not that. A blocked change is.

---

## Pull — the tracker as an input

Two things flow *inward*, and both matter more than anything flowing out:

1. **Acceptance criteria** are product authority. At `/gw-new` (adoption) and again at
   `/gw-plan-review`, `read` the item and check the plan against its criteria the same
   way the gate checks the plan against recalled constraints. A plan that satisfies the
   graph and misses a stated acceptance criterion is a request-changes finding.

2. **Criteria that changed mid-change** are a finding, not a silent update. Surface them:
   *"MT3-42's acceptance criteria gained 'must handle credit notes' on the 14th, after
   this plan was approved."* That is a re-plan trigger, and it is the developer's call —
   never yours.

If a criterion is durable knowledge rather than this change's scope ("invoices are
immutable after issue"), capture it into the graph as a `constraint` too. The issue will
be closed and forgotten; the constraint should outlive it.

---

## Reconcile — divergence is a finding

Run at any gate, and always before `/gw-archive`:

- **Title/goal drift** → report both, ask which is authoritative. Do not pick.
- **Item closed while the change is open** (or the reverse) → stop and report. Someone
  either closed it early or the change was abandoned without being archived.
- **Item reassigned or re-prioritized** → informational only; report it, change nothing.
- **The marker is missing** → the item was recreated or edited by hand. Re-link
  explicitly with the human, rather than opening a second item.

Never resolve any of these by writing. The skill's authority is to *report*.

---

## Adapters

Bind the operations to whatever this project has. Probe in this order and use the first
that answers.

| Operation | **GitHub** | **Linear** | **Jira / other** | **none** |
|---|---|---|---|---|
| `find` | `search_issues` for the marker, scoped to the repo | `list_issues` / search by the marker text | tracker MCP search | — |
| `create` | `issue_write` (create) | Linear MCP create issue | tracker MCP create | — |
| `read` | `issue_read` | Linear MCP get issue | tracker MCP get | — |
| `update_body` | `issue_write` (update), managed block only | Linear MCP update | tracker MCP update | — |
| `comment` | `add_issue_comment` | Linear MCP comment | tracker MCP comment | — |
| `set_state` | `issue_write` state + `state_reason` | Linear MCP state id | tracker MCP transition | — |
| `link_child` | `sub_issue_write` | Linear parent/sub-issue | epic link | — |

Notes that will save a session:

- **GitHub** has `open`/`closed` only, so a richer board lives in labels or a Project.
  Read `states:` from the binding and map explicitly; do not invent label names.
- **GitHub** wants `state_reason` set when closing (`completed` vs `not_planned`) —
  an abandoned change closes as `not_planned`, which is real information.
- **Linear/Jira** state names are per-team and must come from the binding, not a guess.
  Their MCP servers usually need authorizing before any of this works; if the tools are
  absent, that is the degraded path below, not a reason to improvise with the API.
- **`gh` CLI** is a fallback where the MCP server is absent — but it is not installed
  everywhere, and in some sandboxes GitHub access is proxied. Probe, don't assume.

**Adding a tracker is a table row plus a binding file**, because the skill's body speaks
only the seven operations. If you find yourself writing tracker-specific *judgment* into
a step, that judgment belongs in the binding as config instead.

---

## Degraded mode

Tracker unreachable or unauthorized → **queue, don't skip**, exactly as with the memory
store. Append the intended operations to `context/changes/<id>/tracker-backlog.md`:

```markdown
- [ ] create: title "Round VAT per line item" body <path or inline>
- [ ] update_body: phases P1..P3, P1 ticked
- [ ] comment: review verdict + memory gate
```

Replay when it returns. Say at the session's end that the board is stale and by how many
operations — a silently unsynced board is worse than an obviously absent one, because
people trust it.

---

## Rules

- **Report, never resolve.** Divergence between change and item goes to a human with both
  sides shown. The skill writes only what it owns.
- **Never write assignee, priority, labels, estimate, or sprint.** Not once.
- **Never close on your own authority** unless the binding says `close_authority:
  workflow`. Default is human.
- **`find` before `create`.** Duplicates are the failure mode this integration is most
  prone to and slowest to notice.
- **Knowledge goes in the graph, not in issue comments.** If it should be recalled by a
  future change, it is a `capture_artifact`, and the issue gets at most a pointer.
- **One comment per gate.** Progress is an edit, not news.
- **Memory nodes are never tracker items.** The graph is not a backlog.
- `context/archive/` is untouchable, and an archived change's item is closed, not reopened
  — follow-up work is a new change with a new item, carrying `parent_refs` and a link
  back.
