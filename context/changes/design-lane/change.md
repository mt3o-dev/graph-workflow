# design-lane

status: in-progress
created: 2026-08-24
design_surface: gui-pmview-static-index-html

## Goal
Bring the impeccable design process into the graph-workflow lifecycle: a
surface-keyed deck of screens, clickable prototypes served by pmview wearing the
project's own tokens, and one append-only desk per surface as the entire
agent↔human channel — so a human can see a design, answer the agent's questions,
and point at a region before any production code exists.

memory_goal: 9a1c8e60-6321-4364-8a3f-d723140064c3

## Why now
The workflow had a structural design step (`/gw-wireframe`, ASCII only, refuses
style by rule) and a visual one (impeccable, needs a running dev server), with
nothing between them. No artifact existed that a human could look at or click
before the code was written, and pmview — the board the human already watches —
had no channel back to a running agent session.

## Scope
Seven slices, per `docs/proposals/design-lane.md`: prerequisites; the desk loop;
the prototype; region pinning; design tokens as graph constraints (gap 2); the
visual review gate (gap 3); the routing and documentation sweep. Plus v1.1,
pointing impeccable `live` at prototypes rather than at the real app.

## Out of scope
A `/gw-desk` slash command (plumbing every phase touches is not a phase); SSE or
WebSocket (the stdlib server cannot carry it safely); rebuilding impeccable's
browser overlay inside pmview; generating `style.css` or constraint nodes at
build time (a build step the zero-dependency invariant forbids).
