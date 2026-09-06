# design/

One directory per **surface** — a UI target, keyed by its slug (`gui/pmview/static/
index.html` → `gui-pmview-static-index-html`). Surface-keyed, never change-keyed: a
screen's design history outlives the changes that touch it.

Everything here is committed. The prototype is what the design looks like; the desk is
how it was argued about; both belong in the PR diff where the code is already reviewed.

Nothing here is knowledge. Rulings are captured to the graph with a `goal_ref`, through
the one guarded write path. See `docs/DESK.md`.
