# coffer-analytics

status: archived
archived: 2026-07-24
created: 2026-07-24
epic: coffer-mvp

## Goal
Produce core analytics over classified transactions: income/outcome-over-time
and by-group series with explicit overlap vs partition attribution modes
(split/primary/even), totals reconciling per mode, returned as prepared
chart-series shapes with no rendering.

memory_goal: 66cd3d85-2920-4768-8953-4fd191446b5c

## Memory
Live store. parent_refs: slice-2 survivors per roadmap ledger (change-summary
e1e72328, many-to-many constraint 534f6ff8, provenance/queue decision efd6891c,
provenance-asymmetry issue 1ea505ed) + slice-1 summary d0e830bf and
Transaction/Money model 235e0742. Seed recall top-served: overlap/partition
foundation decision [node:bc0ab42f], many-to-many constraint [node:534f6ff8],
provenance model [node:efd6891c].

## Archive note
Review: Request changes → reworked in-change: synthetic __unclassified__ series
resolves the partition-reconciliation gap [node:bdfeb7e7] (resolving decision
[node:0b08fbef], CONFIRMED 336cd92d); 295 tests green after rework.
Change-summary: [node:1640b1ee]. Disputes pending human GUI: bc0ab42f
(splits-deferred narrowing), bdfeb7e7 (now superseded by 0b08fbef — clear it).
Deactivate+sweep deferred until the promotion pass; liveness roots stay ON.
