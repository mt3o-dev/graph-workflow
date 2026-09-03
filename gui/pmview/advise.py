"""What needs a human, and what is safe to pick up.

One ranking, two consumers:

    pmview --advise      the terminal report. This is `/gw-wayfind`.
    GET /api/advise      the board's contextual action rows.

Writing that twice would guarantee the terminal and the board eventually
disagree about what to do next, which is the worst possible failure for an
orientation tool. So it lives here, where the readers already are — `lifecycle`
parses change folders, `design` folds desks, `graph` reads the store — and both
consumers import it.

**Orientation is one sentence, not a dashboard.** The board is already the
dashboard. Everything here exists to produce `advice["next"]`; the lists are
context for that one line. A report that prints five equally-weighted columns has
failed, and the reader goes back to the browser.

Nothing here writes, spawns or mutates. It is a read, end to end.
"""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

from . import design as design_mod

#: Urgency bands, most urgent first. The band decides the headline; within a
#: band, the oldest thing wins, because the thing that has been waiting longest
#: is the thing most likely to have been forgotten.
BLOCKED, STALLED, READY, HYGIENE = "blocked", "stalled", "ready", "hygiene"
BANDS = (BLOCKED, STALLED, READY, HYGIENE)

#: A change whose newest file has not moved in this long is not being worked on.
#: Long enough that a weekend does not trip it.
STALL_DAYS = 5


def _stamp(surface: dict) -> float:
    """A surface's last desk activity, as an epoch seconds float."""
    raw = surface.get("last_activity") or ""
    try:
        return time.mktime(time.strptime(raw, "%Y-%m-%dT%H:%M:%SZ")) - time.timezone
    except (ValueError, TypeError):
        return 0.0


def _action(skill, label, why, band, target="", args="", age=0.0):
    return {"skill": skill, "label": label, "why": why, "band": band,
            "target": target, "args": args, "age_days": round(age, 1),
            "command": f"{skill} {args}".strip()}


def _age_days(path: Path, *extra: float) -> float:
    """Days since this change last showed a sign of life.

    Not just `change.md`. A change is worked by editing **code**, and its
    lifecycle file may not be touched for the whole of it — measuring staleness
    off `change.md` alone reports a change that has been active all day as ten
    days cold. (Observed on this repo, which is how the bug was found.)

    So the signal is the newest of: the change folder, and anything the caller
    passes — desk activity for its surfaces, typically.
    """
    stamps = list(extra)
    try:
        stamps.extend(p.stat().st_mtime for p in path.rglob("*.md"))
    except OSError:
        pass
    newest = max(stamps, default=0.0)
    return (time.time() - newest) / 86400 if newest else 0.0


# ------------------------------------------------------------------ per change

def actions_for_change(change: dict, surfaces: list[dict], root: Path,
                       branch: str | None = None) -> list[dict]:
    """The skills that make sense for one change, right now.

    Deliberately short. Offering every applicable skill is the failure mode this
    replaces — a palette is worse than the slash menu the terminal already has.
    """
    out: list[dict] = []
    stage = change.get("stage") or ""
    cid = change.get("id") or ""

    mine = [s for s in surfaces if s["surface"] in (change.get("design_surfaces") or [])]
    age = _age_days(Path(change.get("path") or root), *(_stamp(s) for s in mine))

    # One change per worktree is this workflow's rule, so a branch named after a
    # change is that change being worked on right now. Cheapest true signal there
    # is, and it beats every mtime heuristic.
    checked_out = bool(branch) and branch == cid

    # --- the desk comes first: an unanswered question blocks everything downstream
    for surface in mine:
        if surface["open_asks"] and not surface["agent_listening"]:
            out.append(_action(
                "/gw-prototype", f"Answer {surface['open_asks']} open ask"
                + ("s" if surface["open_asks"] != 1 else ""),
                f"{surface['open_asks']} question(s) on {surface['surface']} and no agent "
                f"is listening — the work stopped here",
                BLOCKED, cid, f"--resume {surface['surface']}", age))
        if surface["unruled_gaps"]:
            out.append(_action(
                "/gw-wireframe", f"Rule {surface['unruled_gaps']} component gap"
                + ("s" if surface["unruled_gaps"] != 1 else ""),
                f"{surface['surface']} cannot be prototyped until the design-system "
                f"gaps are ruled",
                BLOCKED, cid, "", age))

    if change.get("archived"):
        return out

    # --- structural warnings are blocking: the change cannot join the graph
    if change.get("has_change_md") and not change.get("memory_goal"):
        out.append(_action("/gw-new", "No memory_goal",
                           "nothing this change captures can be found again — "
                           "recover or re-open the scope",
                           BLOCKED, cid, "", age))

    stalled = age >= STALL_DAYS and stage not in ("archived",) and not checked_out
    band = STALLED if stalled else READY
    why_age = f"nothing has moved here in {age:.0f} days" if stalled else ""

    if stage == "unopened":
        out.append(_action("/gw-new", "Open this change",
                           why_age or "a plan the roadmap sketched, never opened",
                           band, cid, cid, age))
    elif stage == "new":
        out.append(_action("/gw-plan", "Write the plan",
                           why_age or "opened, with no plan yet", band, cid, "", age))
    elif stage == "planned":
        out.append(_action("/gw-plan-review", "Review the plan",
                           why_age or "a plan exists and has not been independently read",
                           band, cid, "", age))
        out.append(_action("/gw-implement", "Implement",
                           "the plan is written", band, cid, "", age))
    elif stage == "in-progress":
        out.append(_action("/gw-implement", "Continue",
                           why_age or "implementation is underway", band, cid, "", age))
    elif stage == "review":
        out.append(_action("/gw-review", "Review",
                           why_age or "waiting at the review gate", band, cid, "", age))

    if change.get("plan_stub"):
        out.append(_action("/gw-plan", "Replace the plan stub",
                           "plan.md is a stub — /gw-implement has nothing to follow",
                           STALLED if stalled else READY, cid, "", age))
    return out


# ----------------------------------------------------------------- per project

def actions_for_project(board_data: dict, contradictions: list, flagged: int,
                        surfaces: list[dict], root: Path,
                        has_domain: bool, has_foundation: bool) -> list[dict]:
    out: list[dict] = []

    if contradictions:
        out.append(_action("/gw-resolve", f"{len(contradictions)} contradiction"
                           + ("s" if len(contradictions) != 1 else ""),
                           "two nodes disagree and only a human can rule",
                           BLOCKED))
    if flagged:
        out.append(_action("/gw-resolve", f"{flagged} node"
                           + ("s" if flagged != 1 else "") + " flagged for review",
                           "the review queue is a human gate by design", BLOCKED))
    if not has_foundation:
        out.append(_action("/gw-foundation", "No foundation in the graph",
                           "recall has nothing settled to serve — this is most of the "
                           "value left on the table", HYGIENE))
    elif not has_domain:
        out.append(_action("/gw-domain", "No domain model",
                           "screens and code will drift into two vocabularies", HYGIENE))
    return out


# ------------------------------------------------------------------- the whole

def advise(root: Path, board, project_name: str = "") -> dict:
    """Rank everything, and pick the one next action."""
    data = board.board()
    surfaces = design_mod.surfaces(root)

    changes: list[dict] = []
    for stage in data.get("stages") or []:
        changes.extend(stage.get("changes") or [])

    flagged = int((data.get("totals") or {}).get("flagged") or 0)
    try:
        contradictions = board.contradictions()
    except Exception:
        contradictions = []
    has_domain = any(getattr(n, "type", "") == "entity" for n in board.graph.nodes.values())
    has_foundation = (root / "context" / "foundation" / "foundation.md").is_file()

    git = _git(root)
    actions = actions_for_project(data, contradictions, flagged, surfaces, root,
                                  has_domain, has_foundation)
    for change in changes:
        actions.extend(actions_for_change(change, surfaces, root, git.get("branch")))

    # Rank: band first, then the oldest thing in the band. What has waited
    # longest is what is most likely to have been forgotten.
    actions.sort(key=lambda a: (BANDS.index(a["band"]), -a["age_days"]))

    warnings = [(c["id"], w) for c in changes for w in (c.get("warnings") or [])]
    for surface in surfaces:
        warnings.extend((surface["surface"], w) for w in surface.get("warnings") or [])

    return {
        "project": project_name or root.name,
        "root": str(root),
        "next": actions[0] if actions else None,
        "actions": actions,
        "by_band": {b: [a for a in actions if a["band"] == b] for b in BANDS},
        "stages": {s["name"]: len(s.get("changes") or []) for s in (data.get("stages") or [])},
        "surfaces": [{k: s[k] for k in
                      ("surface", "screens", "open_asks", "unruled_gaps", "agent_listening")}
                     for s in surfaces],
        "warnings": warnings,
        "totals": data.get("totals") or {},
        "git": git,
    }


def _git(root: Path) -> dict:
    def run(*args):
        try:
            done = subprocess.run(["git", "-C", str(root), *args],
                                  capture_output=True, text=True, timeout=3)
        except (OSError, subprocess.SubprocessError):
            return None
        out = done.stdout.strip()
        return out if done.returncode == 0 else None

    dirty = run("status", "--porcelain")
    return {"branch": run("rev-parse", "--abbrev-ref", "HEAD"),
            "dirty": len(dirty.splitlines()) if dirty else 0}


# ------------------------------------------------------------------- rendering

_BAND_LABEL = {BLOCKED: "Needs you", STALLED: "Stalled",
               READY: "Safe to pick up", HYGIENE: "Housekeeping"}


def render_text(advice: dict, width: int = 78) -> str:
    """The terminal report. One sentence first; everything else is its context."""
    lines: list[str] = []
    git = advice.get("git") or {}
    head = f"{advice['project']}"
    if git.get("branch"):
        head += f"  ·  {git['branch']}"
        if git.get("dirty"):
            head += f" ({git['dirty']} uncommitted)"
    lines += [head, "─" * min(width, max(len(head), 40)), ""]

    nxt = advice.get("next")
    if nxt:
        lines += [f"  → {nxt['command']}", f"    {nxt['why']}.", ""]
    else:
        lines += ["  → nothing is waiting. Open something with /gw-new.", ""]

    stages = advice.get("stages") or {}
    live = [f"{n} {name}" for name, n in stages.items() if n]
    if live:
        lines += ["  " + " · ".join(live), ""]

    for band in BANDS:
        rows = advice["by_band"].get(band) or []
        if not rows or (band == READY and advice.get("next") and
                        advice["next"]["band"] != READY and len(rows) > 3):
            rows = rows[:3]
        if not rows:
            continue
        lines.append(f"  {_BAND_LABEL[band]}")
        for a in rows:
            target = f" [{a['target']}]" if a["target"] else ""
            lines.append(f"    {a['command']:<34}{a['label']}{target}")
        lines.append("")

    warnings = advice.get("warnings") or []
    if warnings:
        lines.append("  Warnings")
        for where, what in warnings[:5]:
            lines.append(f"    {where}: {what}")
        lines.append("")
    return "\n".join(lines)
