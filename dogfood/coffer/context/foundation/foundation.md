memory_goal: 2a712c73-6319-44f2-bb33-a63b2e3bccab

## Note

This file anchors the coffer project's foundation scope in the agentic-memory
graph (`dogfood/coffer/context/memory-graph.db`). It was replayed from
`prd.md`, `tech-stack.md`, and `roadmap.md` per `skills/gw-foundation/SKILL.md`
after the coffer-mvp epic ran in degraded mode (memory server unavailable
during planning/implementation — see `context/archive/coffer-core-import/
memory-backlog.md`). All 26 nodes below are captured at `short-term` tier
under the `foundation` change/goal; none are promoted to `lifetime` yet — that
is a human-only action in the memory-graph GUI. The `foundation` change stays
activated (liveness root ON) so later slices' recall can keep pulling this
constraint set pre-promotion.

## Tech-stack decisions (dec:N → node_id)

| # | node_id | summary |
|---|---|---|
| 1 | 59b27f44-9478-446b-8d24-9918eac771f9 | SvelteKit 2 + Svelte 5 + TS strict, adapter-node |
| 2 | 702ef151-2cc0-4464-8a36-f7c990329abe | Hexagonal architecture, explicit composition root |
| 3 | c61c4107-45b4-418a-aad3-48ee1d0c20ee | SQLite via better-sqlite3 behind StorePort |
| 4 | fd58f2e6-cccc-4af5-8a98-095acb6e0b43 | PDF import via unpdf behind PdfTextPort/StatementParserPort |
| 5 | c282e44d-4e69-49ff-aafd-b8f233a012e7 | Idempotent import via content-hash dedup |
| 6 | 5da27e33-8f49-42bc-85f2-601d40a377c9 | Ordered additive rule engine, many-to-many classification |
| 7 | b94a5c28-6b4f-4ef2-9bc2-c0ac79020136 | Optional categorization assist behind AssistPort |
| 8 | bc0ab42f-9e20-4780-85df-748975ff1d1c | Analytics: overlap vs partition attribution modes |
| 9 | 9adeeb7b-32a8-41f5-8482-ff1021ea29bc | layerchart / hand-rolled SVG chart layer |
| 10 | eb704b61-26ef-4a0d-b392-418df1d5352f | i18n via paraglide-js / typed catalog |
| 11 | c9b15b68-7ec3-414f-8782-9afd2436f208 | Config layers behind ConfigPort |
| 12 | 57af6589-32f9-4f85-8cc3-703d98bf1b7d | BG/Forgotten-Realms design system |
| 13 | f72ef23d-bfa6-4325-93bb-e18c11f8867d | vitest unit/component, Playwright e2e |
| 14 | 30799cd3-09f4-4764-99ae-6d5a8d1e4719 | Docker packaging (Dockerfile + docker-compose) |

## Named-handle constraints / issues / concepts

| handle | node_id | type | summary |
|---|---|---|---|
| self-hosted-no-leave | 3c50357a-7838-4771-a397-fb98e17c9594 | constraint | self-hosted, no data leaves host |
| import-idempotency | 85d9ddc5-51c7-4b53-906d-2bb2786966de | constraint | re-import must not duplicate |
| multi-group-classification | 534f6ff8-af1b-4100-a487-cf6ed2e0a02f | constraint | many-to-many groups, never one-group-per-tx |
| overlap-vs-partition | 77b1911b-9aa8-4ca5-b9b6-3a79ccf7325d | constraint | analytics must label overlap vs partition |
| theme-never-over-legibility | 39129c08-36a8-4b48-82b8-5d9db389fec2 | constraint | theme is chrome, never over data legibility |
| i18n-no-hardcoded-strings | aeb2d1f6-df24-4316-bdd9-8ff279e34fa8 | constraint | every UI string is a catalog key |
| slice-one-plan-one-review | e07035ae-855b-4341-b5b5-b89ce33b2237 | constraint | each epic slice is one plan/one review |
| no-ocr-scanned-pdf | 56f5dca3-a0e6-4120-9565-35217a907328 | issue | accepted gap: no OCR of scanned PDFs |
| no-live-bank-sync | da1b44b4-ee21-420b-af8c-8745ecaac71d | issue | accepted gap: no live bank API sync |
| display-only-fx | 69a219f9-3563-412a-bd1d-eb9a4f05f84b | issue | accepted gap: FX display-only, no live rates |
| single-tenant-no-auth | 22863b66-0439-42f5-bba4-3e99e6f7941d | issue | accepted gap: single-tenant, no multi-user auth |
| epic-coffer-mvp | 6957a41a-46a8-49c5-a1e6-16bc66e2693b | concept | epic sliced 1-5, linear dependency chain |

## Promotion-candidate list (human GUI session)

Every node above (26 total: 14 decisions + 7 constraints + 4 issues + 1
concept) is a lifetime-promotion candidate — this is foundation knowledge
that should survive every future change sweep. Promote in the memory-graph
GUI; the agent surface never promotes.
