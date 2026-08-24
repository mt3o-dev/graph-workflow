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

| rule | section | node | fp | promoted |
|---|---|---|---|---|
| _(none yet — run the distillation)_ | | | | |

The `fp` column fingerprints the **rule text**, not the token values, so
repainting the palette does not read as a changed rule. A rule whose `fp` no
longer matches `.impeccable/design.json` is stale: the graph and the document
have diverged, and a human decides which one is right.

## Implemented

Recorded by `/gw-review` Part 1b when a change ships a screen. The join back is
`deck.screens[].implements`.

| surface | screen | implements | change | on |
|---|---|---|---|---|
