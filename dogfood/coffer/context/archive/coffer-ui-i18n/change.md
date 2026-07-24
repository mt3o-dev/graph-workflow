# coffer-ui-i18n

status: archived
archived: 2026-07-24
created: 2026-07-24
epic: coffer-mvp

## Goal
Ship the BG/Forgotten-Realms UI with fantasy-named chrome: design system, four
screens (dashboard, import, review, settings) consuming slices 1-3, layerchart
income/outcome + group charts rendering the prepared series (unclassified
series distinct), i18n en+pl with no hardcoded strings, and the
single-passphrase auth gate on all routes.

memory_goal: a7655884-66c2-4bca-a6fe-5f4156d9137b

## Memory
Live store. parent_refs: slice-3 survivors + auth amendment 74be155e per
roadmap ledger. Seed recall serves bc0ab42f as DISPUTED (splits narrowing,
human ruling pending) — the UI takes the primary-else-even side openly and
labels modes; charts must render __unclassified__ distinctly (0b08fbef).
Foundation amendment this cycle: single-passphrase auth gate (74be155e,
CONTRADICTS 22863b66 — flagged for GUI).

## Archive note
Review: Approve. One process finding (tripwire honesty, b3748315) queued.
Change-summary: [node:40d8d9a4]. Review-queue agenda for the human GUI session
is in the review report (5 disputes + promotions). Deactivate+sweep deferred
until that session; liveness roots stay ON.
