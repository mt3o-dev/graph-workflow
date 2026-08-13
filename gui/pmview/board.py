"""The join: lifecycle folders on one side, the memory graph on the other.

A change folder knows its Goal-node id; the graph knows everything captured while
that change ran. Neither view alone is a project-management picture, and this is
the piece that makes one — a board of changes by lifecycle stage, each card
carrying its captured nodes, open contradictions and review debt, plus an issue
queue over `type: issue` nodes and the flagged-node backlog.

Conventions this relies on, all established by the gw-* skills:
  * the change anchor (a `slice` node) lives at path `/change/<change-id>`
  * its Goal node lives at `/goal/<change-id>` and is recorded in change.md as
    `memory_goal:`
  * captured artifacts point at the anchor with a `SCOPED_TO` edge
The `memory_goal` id is authoritative; the path conventions are the fallback, so a
renamed folder degrades to a thinner card rather than an empty one.
"""

from __future__ import annotations

from .graph import Graph, Node
from .lifecycle import Change, STAGES

#: Structural nodes that are scaffolding rather than knowledge.
ANCHOR_TYPES = ("slice", "facet_value")


def _sort_key(node: Node) -> tuple:
    return (node.created_at or "", node.path, node.id)


def _last_activity(graph: Graph, node_ids: set[str]) -> str:
    stamps = [e.created_at for e in graph.events if e.node_id in node_ids and e.created_at]
    stamps += [n.created_at for i, n in graph.nodes.items() if i in node_ids and n.created_at]
    return max(stamps) if stamps else ""


class Board:
    """A read model over one project: changes joined to the graph."""

    def __init__(self, changes: list[Change], graph: Graph) -> None:
        self.changes = changes
        self.graph = graph
        self._by_path = {n.path: n for n in graph.nodes.values()}

    # --- resolution helpers -------------------------------------------------

    def anchor_for(self, change: Change) -> Node | None:
        return self._by_path.get(f"/change/{change.id}")

    def goal_for(self, change: Change) -> Node | None:
        if change.memory_goal and change.memory_goal in self.graph.nodes:
            return self.graph.nodes[change.memory_goal]
        return self._by_path.get(f"/goal/{change.id}")

    def scoped_ids(self, change: Change) -> set[str]:
        """Nodes this change actually captured: SCOPED_TO its anchor.

        SCOPED_TO runs anchor → artifact ("this change scopes that node"), the same
        direction agentic-memory-system counts in its own change list, so this number
        agrees with the memory GUI's.
        """
        anchor = self.anchor_for(change)
        if anchor is None:
            return set()
        return {e.target_id for e in self.graph.outgoing(anchor.id) if e.type == "SCOPED_TO"}

    def referenced_ids(self, change: Change) -> set[str]:
        """Nodes the change leans on without owning: the Goal's DEPENDS_ON fan-out
        (which includes parent-refs seeded from earlier slices) and anything cited as
        `[node:...]` in change.md. Kept apart from the captured set — counting
        inherited context as this change's own work overstates every card."""
        ids: set[str] = set()
        goal = self.goal_for(change)
        if goal:
            ids |= {e.target_id for e in self.graph.outgoing(goal.id) if e.type == "DEPENDS_ON"}
        # change.md cites nodes by a short prefix; expand those against the store.
        for ref in change.node_refs:
            ids |= {i for i in self.graph.nodes if i.startswith(ref)}
        return ids - self.scoped_ids(change)

    def _nodes(self, ids: set[str]) -> list[Node]:
        nodes = (self.graph.nodes[i] for i in ids if i in self.graph.nodes)
        return sorted((n for n in nodes if n.type not in ANCHOR_TYPES), key=_sort_key)

    def scoped_nodes(self, change: Change) -> list[Node]:
        return self._nodes(self.scoped_ids(change))

    def referenced_nodes(self, change: Change) -> list[Node]:
        return self._nodes(self.referenced_ids(change))

    def contradictions(self, nodes: list[Node]) -> list[dict]:
        """CONTRADICTS edges with at least one end inside this set."""
        ids = {n.id for n in nodes}
        seen: set[tuple[str, str]] = set()
        out = []
        for edge in self.graph.edges:
            if edge.type != "CONTRADICTS":
                continue
            if edge.source_id not in ids and edge.target_id not in ids:
                continue
            key = tuple(sorted((edge.source_id, edge.target_id)))
            if key in seen:
                continue
            seen.add(key)
            source = self.graph.nodes.get(edge.source_id)
            target = self.graph.nodes.get(edge.target_id)
            if source and target:
                out.append({
                    "source": source.summary(),
                    "target": target.summary(),
                    "created_at": edge.created_at,
                })
        return out

    # --- board -------------------------------------------------------------

    def card(self, change: Change) -> dict:
        nodes = self.scoped_nodes(change)
        referenced = self.referenced_nodes(change)
        goal = self.goal_for(change)
        anchor = self.anchor_for(change)
        # Review debt counts across both sets: a stale node this change merely leans
        # on still blocks the human, whoever captured it.
        flagged = [n for n in nodes + referenced if n.needs_review and not n.archived]
        by_type: dict[str, int] = {}
        for node in nodes:
            by_type[node.type] = by_type.get(node.type, 0) + 1
        ids = {n.id for n in nodes} | ({goal.id} if goal else set())
        return {
            **change.to_json(),
            "goal_node": goal.summary() if goal else None,
            "anchor_node": anchor.summary() if anchor else None,
            "linked": bool(goal or anchor),
            "counts": {
                "nodes": len(nodes),
                "referenced": len(referenced),
                "flagged": len(flagged),
                "archived_nodes": sum(1 for n in nodes if n.archived),
                "contradictions": len(self.contradictions(nodes)),
                "events": sum(1 for e in self.graph.events if e.node_id in ids),
                "by_type": dict(sorted(by_type.items())),
            },
            "flagged": [n.summary() for n in flagged],
            "last_activity": _last_activity(self.graph, ids),
        }

    def board(self) -> dict:
        cards = [self.card(c) for c in self.changes]
        stages: dict[str, list[dict]] = {s: [] for s in STAGES}
        for card in cards:
            stages.setdefault(card["stage"], []).append(card)
        for column in stages.values():
            column.sort(key=lambda c: (c.get("last_activity") or "", c["id"]), reverse=True)
        epics = sorted({c["epic"] for c in cards if c["epic"]})
        return {
            "stages": [{"name": name, "changes": stages[name]} for name in stages if stages[name] or name in STAGES],
            "epics": epics,
            "totals": {
                "changes": len(cards),
                "unlinked": sum(1 for c in cards if not c["linked"]),
                "flagged": sum(c["counts"]["flagged"] for c in cards),
                **self.graph.counts(),
            },
        }

    def change_detail(self, change_id: str) -> dict | None:
        change = next((c for c in self.changes if c.id == change_id), None)
        if change is None:
            return None
        nodes = self.scoped_nodes(change)
        referenced = self.referenced_nodes(change)
        return {
            **self.card(change),
            "nodes": [n.summary() for n in nodes],
            "referenced_nodes": [n.summary() for n in referenced],
            "contradiction_pairs": self.contradictions(nodes + referenced),
        }

    # --- issue perspective --------------------------------------------------

    def _change_of_node(self, node_id: str) -> str:
        """The change that scoped this node — the anchor at the source end of its
        incoming SCOPED_TO edge."""
        for edge in self.graph.incoming(node_id):
            if edge.type != "SCOPED_TO":
                continue
            source = self.graph.nodes.get(edge.source_id)
            if source and source.path.startswith("/change/"):
                return source.path.removeprefix("/change/")
        return ""

    def issue_status(self, node: Node) -> str:
        if node.archived:
            return "dormant"
        if node.needs_review:
            return "disputed"
        if any(
            e.type == "CONTRADICTS"
            for e in self.graph.neighbours(node.id)
        ):
            return "contested"
        return "open"

    def issues(self, include_flagged: bool = True) -> list[dict]:
        """`type: issue` nodes, plus (optionally) every other flagged node — the two
        things a human actually has to rule on."""
        selected = {
            n.id: n for n in self.graph.nodes.values()
            if n.type == "issue" or (include_flagged and n.needs_review and n.type not in ANCHOR_TYPES)
        }
        out = []
        for node in sorted(selected.values(), key=_sort_key):
            events = self.graph.events_for(node.id)
            out.append({
                **node.summary(),
                "status": self.issue_status(node),
                "change": self._change_of_node(node.id),
                "facets": self.graph.facet_names(node.id),
                "event_count": len(events),
                "last_event": max((e.created_at for e in events), default=""),
            })
        return out

    def node_detail(self, node_id: str) -> dict | None:
        node = self.graph.nodes.get(node_id)
        if node is None:
            return None

        def rows(edges, attr: str) -> list[dict]:
            out = []
            for edge in edges:
                other = self.graph.nodes.get(getattr(edge, attr))
                if other:
                    out.append({
                        "edge_type": edge.type,
                        "created_at": edge.created_at,
                        "node": other.summary(),
                    })
            return out

        events = sorted(self.graph.events_for(node_id), key=lambda e: e.created_at)
        return {
            "node": {**node.summary(), "body": node.body},
            "facets": self.graph.facet_names(node_id),
            "change": self._change_of_node(node_id),
            "outgoing": rows(self.graph.outgoing(node_id), "target_id"),
            "incoming": rows(self.graph.incoming(node_id), "source_id"),
            "events": [e.to_json() for e in events],
        }

    def search(self, query: str, limit: int = 60) -> list[dict]:
        needle = query.strip().lower()
        if not needle:
            return []
        hits = [
            n for n in self.graph.nodes.values()
            if needle in n.body.lower() or needle in n.path.lower() or n.id.startswith(needle)
        ]
        return [n.summary() for n in sorted(hits, key=_sort_key)[:limit]]
