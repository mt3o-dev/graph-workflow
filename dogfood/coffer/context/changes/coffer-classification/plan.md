# Plan (STUB) — coffer-classification

Slice 2 of `coffer-mvp`. **Not yet opened as a change** (no change.md); stays
`pending` in roadmap.md until slice 1 archives and hands off parent_refs. Thin
stub for a later implement agent (or Opus resumed) to expand via /gw-plan.

Paths relative to `dogfood/coffer/`. Verification: `pnpm typecheck` + `pnpm test`
(vitest) only. Decisions cited from `context/foundation/tech-stack.md`.

## Goal
Classify stored transactions into zero-or-more user-defined groups via an ordered
additive rule engine, route unmatched to a review queue, and turn a manual
correction into a reusable rule — all in the hexagonal core, verifiable via pnpm.

## Implements
[dec:6] ordered many-to-many rule engine + nestable Group tree + cross-cutting
tags + `stopAfter` exclusivity + review queue; [dec:7] AssistPort (local-heuristic
adapter default, LLM adapter stubbed + off); [dec:2] core purity; [dec:11] config
(assist selection). PRD FR3, FR5.

## Phases (bullet level)
- **P1 Group model** — `Group` node (id, name, optional parent = tree; parentless
  cross-cutting = tag), StorePort extension + migration `002_groups.sql`; group
  CRUD in core. Verify: group-tree + tag unit tests.
- **P2 Rule engine** — `Rule = { when: predicate(tx), assign: groupId[],
  stopAfter? }`; evaluate a tx against all rules, accumulate the UNION of assigned
  groups (additive, not first-match); `stopAfter` short-circuits. Predicates:
  description regex, counterparty, amount range, account. Verify: engine unit
  tests incl. multi-group accumulation + stopAfter.
- **P3 Review queue** — transactions matching no rule → review queue view/port;
  persist queue state. Verify: unmatched-routing tests.
- **P4 Correction→rule** — a manual group (re)assignment can be promoted to a
  reusable Rule ("always classify like this"). Verify: correction-promotes-to-rule
  test; re-running the engine reproduces the correction.
- **P5 AssistPort** — `AssistPort.suggest(tx) → groupId[]` (never auto-commits);
  local-heuristic adapter (frequency/similarity over past classified
  descriptions); LLM (Anthropic Haiku) adapter is a constructor-injected STUB,
  off by default via config, driven by a mocked transport in tests. Verify:
  heuristic suggestion tests + assist-never-auto-commits invariant.

## Verification approach
Shared contract suite for the rule engine + AssistPort; local-heuristic runs real,
LLM adapter faked. Invariant asserted: analytics/consumers must never assume
one-group-per-tx ([dec:6] constraint). Green == `pnpm typecheck && pnpm test`.

## parent_refs (on open)
Surviving nodes of coffer-core-import (Transaction model, StorePort, content-hash,
composition root) + facet `coffer-mvp`.
