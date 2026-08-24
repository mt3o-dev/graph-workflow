# Design bindings

What the design lane is allowed to serve to a prototype, and which design-system
rules have been promoted into the graph.

Two jobs, one file, because they answer the same question from opposite ends:
*what does this project's design system actually say, and how does a prototype
get to wear it?*

## Servable to prototypes

An **exact allowlist** — not a prefix, not a glob. `GET /assets/<project>/<path>`
serves only these, and only after re-resolving the path and checking it is still
inside the project root. A prototype wears the project's *real* shipping
stylesheet: copying tokens into `context/design/` would duplicate their values
into git, and there is no build step to generate one.

```
stylesheet: gui/pmview/static/style.css
```

Add a line per file. Paths are relative to the project root. Anything absolute,
containing `..`, resolving outside the root, or carrying an extension outside
`.css .woff .woff2 .ttf .otf .svg .png .jpg .jpeg .webp .gif` is dropped
silently — the allowlist is a floor, not a suggestion.

## Promoted rules

Filled in by `/gw-foundation`'s design distillation, and only after a human has
promoted each candidate in the review GUI. `promoted: no` means the rule is a
proposal that nothing recalls yet.

<!-- gw:design-nodes captured=2026-08-24 design_json_generated_at=2026-08-14T00:00:00Z -->
| rule | section | node | fp | promoted |
|---|---|---|---|---|
| The Accent-Is-A-Verb Rule | `colors` | `[node:8b947296-a5a2-4960-a0d2-d8c70654f1e4]` | `3718b30dd550` | no |
| The Twin-World Rule | `colors` | `[node:6f3e416c-d83d-4912-8ede-a4c1e7acc312]` | `11263759d39f` | no |
| The Mono-Means-Data Rule | `typography` | `[node:31632ab4-072a-492f-a27a-6dc06bba6240]` | `11763aa79f35` | no |
| The Flat-Until-Touched Rule | `elevation` | `[node:a59c22d9-b05c-42db-9bb4-fae620f871ca]` | `e89b7d4d2c09` | no |
| The Name-First Rule | `components` | `[node:5c8af8b3-7d96-42fb-b89e-b54e96cdb2f3]` | `32ab8ad32646` | no |
| The Persisted-Chrome Rule | `components` | `[node:4cb39abe-8176-4943-907d-8da7ca2eeef7]` | `8c842db8f484` | no |
| The One-Hue-Per-Category Rule | `colors` | `[node:7fa594bb-991d-4969-a993-1429c0ff95c4]` | `cc3331e322a2` | no |
| Don't introduce a build step, framework, CSS-in-JS, or … | `donts` | `[node:dab014c2-da95-4b7b-980d-5eccd0808213]` | `f48e982cabcf` | no |
| Don't add a colored border-left/border-right above 1px,… | `donts` | `[node:f1d48ffd-656c-430f-9051-1697f551942f]` | `7e8f9a13e9af` | no |
| Don't use monospace as decoration; reserve it for ident… | `donts` | `[node:ea6b2844-d8bc-45ad-9b6c-7d5d830b0bee]` | `728f96f7eb53` | no |
| Don't rename or drop the component class names — they a… | `donts` | `[node:54fb8152-8041-41d0-9821-7a2560303d26]` | `8cbb4f2ad974` | no |
| Don't ship a hover/focus state without a resting counte… | `donts` | `[node:c2858894-0f46-4d9d-b735-022fcd0c9952]` | `451ec61b39a4` | no |
| The Control Room | `northStar` | `[node:7e1141c9-91f7-41f7-b82e-53f30246dc1e]` | `cb47d0b8bc0b` | no |

The `fp` column fingerprints the **rule text**, not the token values, so
repainting the palette does not read as a changed rule. A rule whose `fp` no
longer matches `.impeccable/design.json` is stale: the graph and the document
have diverged, and a human decides which one is right.

## Implemented

Recorded by `/gw-review` Part 1b when a change ships a screen. The join back is
`deck.screens[].implements`.

| surface | screen | implements | change | on |
|---|---|---|---|---|
| `gui-pmview-static-index-html` | `design-tab` | `gui/pmview/static/index.html#view-design` | design-lane | 2026-08-24 |
| `gui-pmview-static-index-html` | `design-tab-empty` | `gui/pmview/static/index.html#view-design` | design-lane | 2026-08-24 |
