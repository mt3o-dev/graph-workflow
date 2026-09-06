#!/usr/bin/env python3
"""Distil a project's design system into constraint candidates for the graph.

    design_distill.py [--root .] [--out .gw-scratch/design-constraints.md]

**This script never touches the graph.** It reads `.impeccable/design.json` and
writes a review file. The *agent* reads that file and makes the
`capture_artifact` calls; a *human* then promotes what survives, in the review
GUI. Same distillation → reference-back → human-promotion ladder
`/gw-foundation` already runs for the PRD and the ADRs, with no new machinery.

Why this exists (gap 2): `.impeccable/design.json` is a file `/gw-wireframe`
merely *detects*. Its rules never become recallable, so a later change can
contradict a settled design rule without `impact_of` ever firing.

**Capture the rule and the token NAME, never the value.** A node saying *"the
accent is a verb — `--accent` appears only on something interactive or
selected"* survives a repalette and still fires `impact_of` on a proposed
decorative blue. A node holding `#2f6fdb` goes silently wrong the day someone
repaints, and nothing notices.

The output is bounded: one node per rule, one per don't, one concept for the
visual world. It does not grow with the codebase.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def fingerprint(text: str) -> str:
    """First 12 hex of sha256 over the rule TEXT.

    Per-rule, so a drift finding reads "The Accent-Is-A-Verb Rule changed under
    [node:7c1a…]" rather than "something in DESIGN.md moved" — a drift check
    that cannot name the drifted thing is ignored by the third PR.
    """
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()[:12]


def candidates(design: dict) -> list[dict]:
    narrative = design.get("narrative") or {}
    out: list[dict] = []

    for rule in narrative.get("rules") or []:
        if not isinstance(rule, dict):
            continue
        name = str(rule.get("name") or "").strip()
        body = str(rule.get("body") or "").strip()
        section = str(rule.get("section") or "").strip()
        if not body:
            continue
        content = f"{name}. {body}" if name else body
        if section:
            content += f" (DESIGN.md §{section})"
        out.append({"type": "constraint", "label": name or body[:60],
                    "section": section or "rules", "content": content,
                    "fp": fingerprint(body)})

    # `narrative.donts` are PLAIN STRINGS, not objects. Reading them as dicts
    # yields a list of empty rules and silently drops the whole category.
    for dont in narrative.get("donts") or []:
        if not isinstance(dont, str) or not dont.strip():
            continue
        out.append({"type": "constraint", "label": dont.strip()[:60],
                    "section": "donts", "content": dont.strip(),
                    "fp": fingerprint(dont)})

    north = str(narrative.get("northStar") or "").strip()
    overview = str(narrative.get("overview") or "").strip()
    if north or overview:
        content = f"The visual world is “{north}”. {overview}".strip()
        out.append({"type": "concept", "label": north or "visual world",
                    "section": "northStar", "content": content,
                    "fp": fingerprint(content)})
    return out


def render(design: dict, rows: list[dict], root: Path) -> str:
    generated = design.get("generatedAt") or "unknown"
    lines = [
        "# Design-system constraint candidates",
        "",
        f"Distilled from `.impeccable/design.json` (generatedAt `{generated}`) by",
        "`design_distill.py`. **Nothing here is in the graph yet.**",
        "",
        "The agent captures these; a human promotes them in the review GUI. Capture the",
        "rule and the token *name*, never the value — a node holding a hex code goes",
        "silently wrong the day someone repaints, and nothing notices.",
        "",
        f"`goal_ref` is the foundation scope's `memory_goal`, from",
        "`context/foundation/foundation.md`. Every capture below needs it; a goal-less",
        "write is rejected by the MCP surface, which is the point.",
        "",
        f"**{len(rows)} candidates** — "
        f"{sum(1 for r in rows if r['section'] == 'donts')} don'ts, "
        f"{sum(1 for r in rows if r['type'] == 'constraint' and r['section'] != 'donts')} rules, "
        f"{sum(1 for r in rows if r['type'] == 'concept')} concept. Bounded: this does not",
        "grow with the codebase.",
        "",
        "---",
        "",
    ]
    for i, row in enumerate(rows, 1):
        lines += [
            f"## {i}. {row['label']}",
            "",
            f"- **type** `{row['type']}` · **facets** `[\"ui\"]` · **tier** `mid-term`",
            f"- **section** `{row['section']}` · **fp** `{row['fp']}`",
            "",
            "```",
            f"capture_artifact(type=\"{row['type']}\", goal_ref=<foundation memory_goal>,",
            "                 facets=[\"ui\"],",
            f"                 content={json.dumps(row['content'], ensure_ascii=False)})",
            "```",
            "",
        ]
    lines += [
        "---",
        "",
        "## After capturing",
        "",
        "Write the reference-back table into `context/foundation/design-bindings.md`",
        "under `## Promoted rules`, one row per candidate, `promoted: no` until a human",
        "says otherwise:",
        "",
        "| rule | section | node | fp | promoted |",
        "|---|---|---|---|---|",
    ]
    for row in rows:
        lines.append(f"| {row['label']} | {row['section']} | `[node:…]` | `{row['fp']}` | no |")
    lines += [
        "",
        "Then tell the human what to promote and where. Nothing an agent can call",
        "promotes a tier — that is the safety invariant, not an inconvenience.",
        "",
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".")
    parser.add_argument("--out", default=".gw-scratch/design-constraints.md")
    parser.add_argument("--json", action="store_true", help="emit the candidates as JSON")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    source = root / ".impeccable" / "design.json"
    if not source.is_file():
        print(f"no design system at {source} — nothing to distil. "
              f"This project's design lane stops at rung 1.", file=sys.stderr)
        return 3
    try:
        design = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"{source} is not valid JSON: {exc}", file=sys.stderr)
        return 2

    rows = candidates(design)
    if not rows:
        print(f"{source} has no narrative rules, don'ts or north star to distil.",
              file=sys.stderr)
        return 3

    if args.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return 0

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(design, rows, root), encoding="utf-8")
    print(json.dumps({
        "candidates": len(rows),
        "rules": sum(1 for r in rows if r["type"] == "constraint" and r["section"] != "donts"),
        "donts": sum(1 for r in rows if r["section"] == "donts"),
        "concepts": sum(1 for r in rows if r["type"] == "concept"),
        "out": str(out.relative_to(root)),
        "design_json_generated_at": design.get("generatedAt"),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
