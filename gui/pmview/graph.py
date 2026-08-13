"""Offline reader for the memory store, in both of its on-disk forms.

`context/memory-graph.db` is SQLite on a working machine, and the legible text
dump produced by the `memory-db` git filter once it is committed. Both are read
here so the board works on a fresh checkout (dump) and on a live project (SQLite)
without the memory server running.

This is a *read* path only. Writes go to the agentic-memory-system GUI API
(`memory.py`), which enforces the safety invariant — trust is folded from the
journal, flags resolve through the ladder, tiers are a human gate. Reimplementing
those writes here would be exactly the second unguarded write path the design
forbids.
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

_SQLITE_MAGIC = b"SQLite format 3\x00"

_HEADER_RE = re.compile(r"^\[(node|event):([0-9a-fA-F-]+)\]$")
_FIELD_RE = re.compile(r"^([a-z_]+):[ \t]*(.*)$")
_EDGE_RE = re.compile(r"^-> ([A-Z_]+) \[node:([0-9a-fA-F-]+)\](?: @ (.*))?$")

_ANCHOR_TYPES = ("slice", "facet_value")


@dataclass
class Edge:
    source_id: str
    target_id: str
    type: str
    created_at: str = ""


@dataclass
class Event:
    id: str
    node_id: str
    type: str
    weight: float = 0.0
    polarity: int = 1
    source: str = ""
    reason: str = ""
    created_at: str = ""

    def to_json(self) -> dict:
        return dict(self.__dict__)


@dataclass
class Node:
    id: str
    type: str = ""
    tier: str = ""
    path: str = ""
    body: str = ""
    created_at: str = ""
    needs_review: bool = False
    retrieval_weight: float = 1.0
    trust_weight: float = 1.0
    archived: bool = False

    def summary(self) -> dict:
        flat = " ".join(self.body.split())
        return {
            "id": self.id,
            "type": self.type,
            "tier": self.tier,
            "path": self.path,
            "preview": flat if len(flat) <= 160 else flat[:159] + "…",
            "needs_review": self.needs_review,
            "archived": self.archived,
            "trust_weight": self.trust_weight,
            "retrieval_weight": self.retrieval_weight,
            "created_at": self.created_at,
        }


@dataclass
class Graph:
    nodes: dict[str, Node] = field(default_factory=dict)
    edges: list[Edge] = field(default_factory=list)
    events: list[Event] = field(default_factory=list)

    def events_for(self, node_id: str) -> list[Event]:
        return [e for e in self.events if e.node_id == node_id]

    def outgoing(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.source_id == node_id]

    def incoming(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.target_id == node_id]

    def neighbours(self, node_id: str) -> list[Edge]:
        return self.outgoing(node_id) + self.incoming(node_id)

    def facet_names(self, node_id: str) -> list[str]:
        """Facet labels on a node — the last path segment of its HAS_FACET targets."""
        names = []
        for edge in self.outgoing(node_id):
            if edge.type != "HAS_FACET":
                continue
            target = self.nodes.get(edge.target_id)
            if target:
                names.append(target.path.rsplit("/", 1)[-1])
        return sorted(names)

    def counts(self) -> dict:
        real = [n for n in self.nodes.values() if n.type not in _ANCHOR_TYPES]
        return {
            "nodes": len(real),
            "flagged": sum(1 for n in real if n.needs_review and not n.archived),
            "archived": sum(1 for n in self.nodes.values() if n.archived),
            "facets": sum(1 for n in self.nodes.values() if n.type == "facet_value"),
            "events": len(self.events),
        }


def _as_bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes")


def _as_float(value: str, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def parse_dump(text: str) -> Graph:
    """Parse the `# agentic-memory-system dump` text format.

    Records are separated by a `---` line. Each opens with `[node:<id>]` or
    `[event:<id>]`, followed by `key: value` lines, then `-> EDGE [node:<id>] @ ts`
    lines for nodes, then a blank line and the free-text body.
    """
    graph = Graph()
    for block in text.split("\n---\n"):
        lines = block.strip("\n").splitlines()
        # Skip the dump's leading `# ...` comment header.
        while lines and (not lines[0].strip() or lines[0].startswith("#")):
            lines.pop(0)
        if not lines:
            continue
        header = _HEADER_RE.match(lines[0].strip())
        if not header:
            continue
        kind, record_id = header.group(1), header.group(2)

        fields: dict[str, str] = {}
        edges: list[tuple[str, str, str]] = []
        index = 1
        while index < len(lines):
            line = lines[index]
            if not line.strip():
                index += 1
                break
            edge = _EDGE_RE.match(line.strip())
            if edge:
                edges.append((edge.group(1), edge.group(2), edge.group(3) or ""))
                index += 1
                continue
            field_match = _FIELD_RE.match(line)
            if field_match:
                fields[field_match.group(1)] = field_match.group(2)
                index += 1
                continue
            break
        body = "\n".join(lines[index:]).strip()

        if kind == "node":
            graph.nodes[record_id] = Node(
                id=record_id,
                type=fields.get("type", ""),
                tier=fields.get("tier", ""),
                path=fields.get("path", ""),
                body=body,
                created_at=fields.get("created_at", ""),
                needs_review=_as_bool(fields.get("needs_review", "")),
                retrieval_weight=_as_float(fields.get("retrieval_weight", ""), 1.0),
                trust_weight=_as_float(fields.get("trust_weight", ""), 1.0),
                archived=_as_bool(fields.get("archived", "")),
            )
            for edge_type, target, created in edges:
                graph.edges.append(Edge(record_id, target, edge_type, created))
        else:
            graph.events.append(
                Event(
                    id=record_id,
                    node_id=fields.get("node_id", ""),
                    type=fields.get("type", ""),
                    weight=_as_float(fields.get("weight", "")),
                    polarity=int(_as_float(fields.get("polarity", ""), 1)),
                    source=fields.get("source", ""),
                    reason=body,
                    created_at=fields.get("created_at", ""),
                )
            )
    return graph


def read_sqlite(path: Path) -> Graph:
    graph = Graph()
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        for row in conn.execute(
            "SELECT id, type, tier, path, body, created_at, needs_review, "
            "retrieval_weight, trust_weight, archived FROM nodes"
        ):
            graph.nodes[row[0]] = Node(
                id=row[0], type=row[1], tier=row[2], path=row[3], body=row[4],
                created_at=row[5], needs_review=bool(row[6]),
                retrieval_weight=row[7], trust_weight=row[8], archived=bool(row[9]),
            )
        for row in conn.execute("SELECT source_id, target_id, type, created_at FROM edges"):
            graph.edges.append(Edge(*row))
        for row in conn.execute(
            "SELECT id, node_id, type, weight, polarity, source, reason, created_at FROM events"
        ):
            graph.events.append(Event(*row))
    finally:
        conn.close()
    return graph


def load(path: Path) -> Graph:
    """Read a store from disk, detecting SQLite vs the committed text dump."""
    with path.open("rb") as handle:
        magic = handle.read(len(_SQLITE_MAGIC))
    if magic == _SQLITE_MAGIC:
        return read_sqlite(path)
    return parse_dump(path.read_text(encoding="utf-8"))
