"""Reader for the thin lifecycle files the graph deliberately does not hold.

`context/changes/<id>/` and `context/archive/<id>/` keep only `change.md` and
`plan.md` — the change anchor, its Goal-node id, and the plan. Everything else
about a change lives in the graph. This module turns those files into records the
board can join against the graph by `memory_goal` id and `[node:...]` references.

Parsing is deliberately forgiving: these are human-written Markdown files, and a
missing heading must degrade to an incomplete card, never to a crash that hides
the rest of the board.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

#: Lifecycle stages, in board order. `unopened` is a plan.md with no change.md —
#: a slice sketched by the roadmap that /gw-new has not opened yet.
STAGES = ("unopened", "new", "planned", "in-progress", "review", "archived")

#: `status:` values seen in change.md, mapped onto board stages. Anything
#: unrecognised keeps its own name so a new status shows up rather than vanishing.
_STATUS_STAGES = {
    "new": "new",
    "open": "in-progress",
    "active": "in-progress",
    "planned": "planned",
    "planning": "planned",
    "implementing": "in-progress",
    "in-progress": "in-progress",
    "in progress": "in-progress",
    "review": "review",
    "reviewing": "review",
    "archived": "archived",
}

_FIELD_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_ -]*):[ \t]*(.*)$")
_NODE_REF_RE = re.compile(r"\[node:([0-9a-fA-F-]{8,36})\]")
_HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.*)$")


@dataclass
class Change:
    """One change folder, as read off disk."""

    id: str
    path: str
    archived: bool
    stage: str
    status: str = ""
    epic: str = ""
    created: str = ""
    archived_on: str = ""
    title: str = ""
    memory_goal: str = ""
    goal: str = ""
    sections: dict[str, str] = field(default_factory=dict)
    node_refs: list[str] = field(default_factory=list)
    has_change_md: bool = False
    has_plan_md: bool = False
    plan_stub: bool = False
    plan_phases: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return dict(self.__dict__)


def _split_sections(text: str) -> tuple[str, dict[str, str]]:
    """Return (level-1 title, {level-2 heading: body}) for a Markdown document."""
    title = ""
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []

    def flush() -> None:
        if current is not None:
            sections[current] = "\n".join(buf).strip()

    for line in text.splitlines():
        m = _HEADING_RE.match(line)
        if m and len(m.group(1)) == 1 and not title:
            title = m.group(2).strip()
            continue
        if m and len(m.group(1)) == 2:
            flush()
            current = m.group(2).strip()
            buf = []
            continue
        if current is not None:
            buf.append(line)
    flush()
    return title, sections


def _leading_fields(text: str) -> dict[str, str]:
    """`key: value` lines before the first level-2 heading (the change preamble)."""
    fields: dict[str, str] = {}
    for line in text.splitlines():
        m = _HEADING_RE.match(line)
        if m and len(m.group(1)) == 2:
            break
        f = _FIELD_RE.match(line)
        if f:
            fields[f.group(1).strip().lower()] = f.group(2).strip()
    return fields


def _plan_phases(plan_text: str) -> list[str]:
    """Bullet titles under a `## Phases...` heading, bolded-prefix first."""
    _, sections = _split_sections(plan_text)
    body = next((v for k, v in sections.items() if k.lower().startswith("phases")), "")
    phases = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped.startswith(("-", "*", "+")):
            continue
        # Strip the bullet marker only — `lstrip("-* ")` would also eat the `**` of a
        # bolded phase title and leave the closing pair stranded.
        item = re.sub(r"^[-*+][ \t]+", "", stripped)
        bold = re.match(r"\*\*(.+?)\*\*", item)
        phases.append(bold.group(1).strip() if bold else item.split(" — ")[0].strip())
    return phases


def read_change(directory: Path, archived: bool) -> Change:
    change_md = directory / "change.md"
    plan_md = directory / "plan.md"
    change = Change(
        id=directory.name,
        path=str(directory),
        archived=archived,
        stage="archived" if archived else "unopened",
        has_change_md=change_md.is_file(),
        has_plan_md=plan_md.is_file(),
    )

    if change.has_change_md:
        text = change_md.read_text(encoding="utf-8")
        title, sections = _split_sections(text)
        fields = _leading_fields(text)
        change.title = title or change.id
        change.sections = sections
        change.status = fields.get("status", "")
        change.epic = fields.get("epic", "")
        change.created = fields.get("created", "")
        change.archived_on = fields.get("archived", "")
        goal_section = sections.get("Goal", "")
        goal_fields = _leading_fields(goal_section)
        change.memory_goal = goal_fields.get("memory_goal", "")
        # The Goal prose is everything but the `memory_goal:` bookkeeping line.
        change.goal = "\n".join(
            line for line in goal_section.splitlines()
            if not line.lower().startswith("memory_goal:")
        ).strip()
        change.node_refs = sorted({m.group(1) for m in _NODE_REF_RE.finditer(text)})
        if not change.memory_goal:
            change.warnings.append("no memory_goal — cannot join this change to the graph")
        if not archived:
            change.stage = _STATUS_STAGES.get(change.status.lower(), change.status.lower() or "new")

    if change.has_plan_md:
        plan_text = plan_md.read_text(encoding="utf-8")
        plan_title, _ = _split_sections(plan_text)
        change.plan_stub = "stub" in plan_title.lower()
        change.plan_phases = _plan_phases(plan_text)
        if not change.title:
            change.title = change.id
        if not archived and change.has_change_md and change.stage == "new":
            change.stage = "planned"

    if not change.has_change_md and not change.has_plan_md:
        change.warnings.append("empty change folder — no change.md and no plan.md")
    elif not change.has_change_md:
        change.warnings.append("plan.md with no change.md — not opened with /gw-new yet")

    return change


def scan(context_dir: Path) -> list[Change]:
    """Read every change under `<context>/changes` and `<context>/archive`."""
    changes: list[Change] = []
    for sub, archived in (("changes", False), ("archive", True)):
        root = context_dir / sub
        if not root.is_dir():
            continue
        for directory in sorted(p for p in root.iterdir() if p.is_dir()):
            changes.append(read_change(directory, archived))
    return changes
