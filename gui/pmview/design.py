"""The design lane's read and append surface.

Three artifacts per surface, all under `context/design/<surface>/` and all
committed:

- `deck.json`    — the screen inventory and each screen's wireframe geometry.
- `screens/*.html` — clickable prototypes wearing the project's own tokens.
- `asks.jsonl`   — the desk: an append-only log that is the whole agent↔human
                   channel.

Two rules run through everything here.

**Nothing in this module is knowledge.** A desk line is a *request* or a
*ruling*, never a capture. Knowledge goes to the graph through the one guarded
write path at `:8765`, with a `goal_ref`. So this module imports neither
`memory`, `graph` nor `board`: the design lane must keep working when the memory
server is down, which is exactly when a human is most likely to be looking at it.

**State is derived, never stored.** There is no `status` field on an ask to fall
out of sync with the log. Whether an ask is open, answered, landed, declined or
retired is folded from the lines every time it is read.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import time
from pathlib import Path

#: Surface, screen and path segments only — never the project segment, which is
#: resolved by dict membership against the discovered projects instead (a
#: stronger guarantee than a regex, and it cannot escape a path because the root
#: comes from the Project object rather than from the request).
SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

#: Kinds pmview may construct. It is physically incapable of emitting an `ask`,
#: `note`, `ack`, `retire` or `handoff`, or of forging `by: "agent"`.
HUMAN_KINDS = frozenset({"answer", "instruction", "decline"})
AGENT_KINDS = frozenset({"ask", "note", "ack", "retire", "handoff"})

MAX_LINE = 16 * 1024
MAX_TEXT = 4000
MAX_REASON = 500
MAX_BATCH = 50
PULSE_TAIL = 64 * 1024

#: A `wait` heartbeat older than this means nobody is listening any more. It has
#: to outlast the 2 s poll tick comfortably without making a killed session look
#: alive for long.
LISTEN_FRESH_S = 15
#: A tab stamps presence roughly every 5 s; this tolerates a tab that was
#: backgrounded briefly without claiming a human who walked away an hour ago.
PRESENT_FRESH_S = 120


# --------------------------------------------------------------------- naming

def gw_slug(target: str) -> str:
    """The surface key for a UI target path.

    Head-kept and digest-suffixed, which is deliberately *not* impeccable's
    `slugFromTarget` (`lib/target-slug.mjs:32`). That one keeps the **tail** at
    50 chars, so `web/…/revenue/chart/index.html` and
    `mobile/…/revenue/chart/index.html` both collapse to
    `ponents-dashboard-widgets-revenue-chart-index-html` — merging two surfaces'
    decks and, fatally, their append-only desks.

    Identical to impeccable's slug for short paths, which is the common case and
    the only one where the two need to agree (so `.impeccable/surfaces/<slug>.md`
    still matches). Only paths over 50 kebab-chars diverge, and only there does
    the digest appear.
    """
    s = re.sub(r"-+", "-", re.sub(r"[^a-z0-9-]+", "-",
               re.sub(r"[/\\.]+", "-", target.strip().lower()))).strip("-")
    if len(s) <= 50:
        return s
    return s[:43].rstrip("-") + "-" + hashlib.sha256(target.encode()).hexdigest()[:6]


def new_id() -> str:
    return secrets.token_hex(4)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --------------------------------------------------------------------- paths

def design_root(root: Path) -> Path:
    return root / "context" / "design"


def surface_dir(root: Path, surface: str) -> Path | None:
    """The surface's directory, or None if the name is not a plain slug.

    Rejecting here rather than sanitising is the point: every caller gets either
    a path already known to be a single safe segment, or nothing.
    """
    if not SLUG_RE.fullmatch(surface or ""):
        return None
    return design_root(root) / surface


def scratch_dir(root: Path) -> Path:
    return root / ".gw-scratch" / "design"


# ---------------------------------------------------------------- deck (rung 0+1)

def read_deck(path: Path) -> tuple[dict, list[str]]:
    """Parse a deck forgivingly.

    A malformed deck degrades to a warning card, never to an exception that
    hides every other surface — the same discipline `lifecycle.py` already
    applies to hand-written Markdown.
    """
    warnings: list[str] = []
    if not path.is_file():
        return {}, ["no deck.json"]
    try:
        deck = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {}, [f"deck.json is not valid JSON (line {exc.lineno}): {exc.msg}"]
    except OSError as exc:
        return {}, [f"deck.json is unreadable: {exc}"]
    if not isinstance(deck, dict):
        return {}, ["deck.json is not an object"]

    screens = deck.get("screens")
    if not isinstance(screens, list):
        deck["screens"] = []
        warnings.append("deck.json has no screens[]")
    else:
        kept = []
        for i, screen in enumerate(screens):
            if not isinstance(screen, dict) or not isinstance(screen.get("id"), str):
                warnings.append(f"screen {i} has no id — skipped")
                continue
            kept.append(screen)
        deck["screens"] = kept
    return deck, warnings


def _deck_counts(deck: dict) -> dict:
    screens = deck.get("screens") or []
    changes: list[str] = []
    for screen in screens:
        for stamp in screen.get("agreed_by") or []:
            change = (stamp or {}).get("change")
            if isinstance(change, str) and change not in changes:
                changes.append(change)
    gaps = sum(
        1 for s in screens
        for v in (s.get("components") or {}).values()
        if isinstance(v, str) and v.startswith("GAP:unruled")
    )
    return {
        "screens": len(screens),
        "agreed": sum(1 for s in screens if s.get("status") == "agreed"),
        "prototypes": sum(1 for s in screens if s.get("prototype")),
        "unruled_gaps": gaps,
        "changes": changes,
    }


# ---------------------------------------------------------------- the desk

def read_lines(path: Path) -> tuple[list[dict], list[str]]:
    """Every well-formed line, in file order, plus a warning per bad one.

    One malformed line never takes down the pane, and nothing here ever
    truncates or rewrites: repair is a human running `git checkout` on the file.
    """
    if not path.is_file():
        return [], []
    lines: list[dict] = []
    warnings: list[str] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return [], [f"asks.jsonl is unreadable: {exc}"]
    for n, raw in enumerate(text.splitlines(), 1):
        raw = raw.strip()
        if not raw:
            continue
        try:
            line = json.loads(raw)
        except json.JSONDecodeError:
            warnings.append(f"asks.jsonl line {n} is not valid JSON — skipped")
            continue
        if isinstance(line, dict) and isinstance(line.get("kind"), str):
            lines.append(line)
        else:
            warnings.append(f"asks.jsonl line {n} has no kind — skipped")
    return lines, warnings


def fold(lines: list[dict], session: str | None = None) -> dict:
    """Derive the desk's state from the log.

    Precedence on an ask is retired > declined > landed > answered > open:
    a retired ask has no subject any more, a declined one the human has ruled
    they will not decide, a landed one the agent has already acted on, and an
    answered one is waiting for the agent.
    """
    by_kind: dict[str, list[dict]] = {}
    for line in lines:
        by_kind.setdefault(line["kind"], []).append(line)

    retired: set[str] = set()
    for r in by_kind.get("retire", []):
        retired.update(x for x in (r.get("refs") or []) if isinstance(x, str))

    declined: dict[str, dict] = {
        d["ask"]: d for d in by_kind.get("decline", []) if isinstance(d.get("ask"), str)
    }
    answers: dict[str, list[dict]] = {}
    for a in by_kind.get("answer", []):
        if isinstance(a.get("ask"), str):
            answers.setdefault(a["ask"], []).append(a)

    #: ack.refs, split by the session that wrote the ack. The cursor is
    #: per-session on purpose: agent B acking an answer to agent A's ask must not
    #: make that answer invisible to A's next drain.
    acked_by_session: dict[str, set[str]] = {}
    acked_any: set[str] = set()
    acks_for: dict[str, list[dict]] = {}
    for ack in by_kind.get("ack", []):
        refs = [x for x in (ack.get("refs") or []) if isinstance(x, str)]
        sess = ack.get("session") or ""
        acked_by_session.setdefault(sess, set()).update(refs)
        acked_any.update(refs)
        for ref in refs:
            acks_for.setdefault(ref, []).append(ack)

    threads = []
    for ask in by_kind.get("ask", []):
        aid = ask.get("id")
        if not isinstance(aid, str):
            continue
        own = ask.get("session") or ""
        if aid in retired:
            state = "retired"
        elif aid in declined:
            state = "declined"
        elif aid in acked_by_session.get(own, set()):
            state = "landed"
        elif aid in answers:
            state = "answered"
        else:
            state = "open"
        threads.append({
            "id": aid,
            "state": state,
            "ask": ask,
            "answers": answers.get(aid, []),
            "acks": acks_for.get(aid, []),
            "decline": declined.get(aid),
        })

    instructions = [
        {**line, "acked": line.get("id") in acked_any}
        for line in by_kind.get("instruction", [])
    ]

    handoffs = by_kind.get("handoff", [])
    #: The last line an agent wrote at all — a `handoff` after the last `ask`
    #: means the turn ended with work still open.
    agent_lines = [l for l in lines if l.get("kind") in AGENT_KINDS]

    delivered: set[str] = acked_by_session.get(session or "", set()) if session is not None else set()
    undelivered = [
        line for line in lines
        if line.get("kind") in HUMAN_KINDS and line.get("id") not in delivered
    ] if session is not None else []

    return {
        "threads": threads,
        "instructions": instructions,
        "handoff": handoffs[-1] if handoffs else None,
        "last_agent_kind": agent_lines[-1]["kind"] if agent_lines else None,
        "open_asks": sum(1 for t in threads if t["state"] == "open"),
        "answered_asks": sum(1 for t in threads if t["state"] == "answered"),
        "declined_asks": sum(1 for t in threads if t["state"] == "declined"),
        "unacked_instructions": sum(1 for i in instructions if not i["acked"]),
        "undelivered": undelivered,
        "notes": by_kind.get("note", []),
    }


def read_asks(path: Path, session: str | None = None) -> dict:
    lines, warnings = read_lines(path)
    folded = fold(lines, session)
    return {"lines": len(lines), "warnings": warnings, **folded}


def tail_pulse(path: Path, since: int) -> dict:
    """A bounded poll: how much has the log grown, and what is open now.

    Reads at most the last 64 KB rather than rebuilding a board or parsing a
    deck, because this runs every 5 seconds per open tab.
    """
    if not path.is_file():
        return {"lines": 0, "new_ids": [], "truncated": False}
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            if size > PULSE_TAIL:
                handle.seek(-PULSE_TAIL, os.SEEK_END)
                handle.readline()          # discard a partial first line
            tail = handle.read().decode("utf-8", errors="replace")
    except OSError:
        return {"lines": 0, "new_ids": [], "truncated": False}

    parsed: list[dict] = []
    for raw in tail.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            line = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(line, dict):
            parsed.append(line)

    total = _count_lines(path)
    fresh = parsed[max(0, len(parsed) - max(0, total - since)):] if total > since else []
    return {
        "lines": total,
        "new_ids": [l.get("id") for l in fresh if isinstance(l.get("id"), str)],
        "new_kinds": sorted({l.get("kind") for l in fresh if isinstance(l.get("kind"), str)}),
        "truncated": size > PULSE_TAIL,
    }


def _count_lines(path: Path) -> int:
    try:
        with path.open("rb") as handle:
            return sum(1 for chunk in handle if chunk.strip())
    except OSError:
        return 0


def append(path: Path, lines: list[dict]) -> int:
    """Append whole lines to the desk.

    Correctness rests on the append itself: one `write()` per line on a handle
    opened `"a"` (O_APPEND). On a local POSIX filesystem that makes the offset
    update atomic, and Linux holds the inode lock for a single write to a
    regular file, so lines never interleave. Two writers on two machines
    conflict as ordinary text, which `.gitattributes`' `merge=union` resolves by
    keeping both sides.

    There is no sequence number and no lock. A lock in a server that has never
    had one, inside a cross-platform stdlib zipapp, buys nothing the append does
    not already give: order is line order, identity is `id`.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with path.open("a", encoding="utf-8") as handle:
        for line in lines:
            blob = json.dumps(line, ensure_ascii=False, separators=(",", ":")) + "\n"
            if len(blob.encode("utf-8")) > MAX_LINE:
                raise ValueError("line exceeds 16 KB")
            handle.write(blob)
            handle.flush()
            written += 1
    return written


def construct(kind: str, surface: str, batch: str, fields: dict) -> dict:
    """Build one human line from an allowlisted set of request fields.

    A whitelist-construct, not a sanitise: the request body is never merged into
    a line. `by`, `src`, `id` and `ts` are stamped here, so pmview cannot forge
    an agent line even if asked to.
    """
    if kind not in HUMAN_KINDS:
        raise ValueError(f"pmview cannot write {kind!r}")
    line = {
        "ts": now_iso(),
        "kind": kind,
        "id": new_id(),
        "by": "human",
        "src": "pmview",
        "batch": batch,
    }
    if kind in ("answer", "decline"):
        ask = fields.get("ask")
        if not isinstance(ask, str) or not ask:
            raise ValueError(f"{kind} needs an ask id")
        line["ask"] = ask[:64]
    else:
        line["surface"] = surface

    for key, cap in (("text", MAX_TEXT), ("reason", MAX_REASON),
                     ("choice", 64), ("screen", 128), ("region", 128)):
        value = fields.get(key)
        if isinstance(value, str) and value:
            line[key] = value[:cap]

    rect = fields.get("rect")
    if isinstance(rect, dict):
        clean = {}
        for axis in ("x", "y", "w", "h"):
            value = rect.get(axis)
            if isinstance(value, (int, float)):
                clean[axis] = round(max(0.0, min(1.0, float(value))), 4)
        if len(clean) == 4:
            line["rect"] = clean

    if kind == "instruction" and not line.get("text"):
        raise ValueError("an instruction needs text")
    return line


# ---------------------------------------------------------------- presence

def presence(root: Path, surface: str, *, stamp: bool = False) -> dict:
    """Is a human at the tab, and is an agent listening?

    `presence.json` is written by pmview on a visible poll; `waiting.json` is a
    *heartbeat* rewritten by `desk.py wait` on every tick, not a flag set once —
    so a session killed mid-wait (SIGKILL, a removed worktree, a reaped tmux
    socket) stops looking alive within seconds instead of forever.
    """
    directory = scratch_dir(root)
    now = time.time()
    result = {"human_present": False, "agent_listening": False, "agent_pid": None}

    if stamp:
        try:
            directory.mkdir(parents=True, exist_ok=True)
            tmp = directory / f"{surface}.presence.tmp"
            tmp.write_text(json.dumps({"ts": now}), encoding="utf-8")
            os.replace(tmp, directory / f"{surface}.presence.json")
        except OSError:
            pass

    for name, key, fresh in (("presence", "human_present", PRESENT_FRESH_S),
                             ("waiting", "agent_listening", LISTEN_FRESH_S)):
        try:
            blob = json.loads((directory / f"{surface}.{name}.json").read_text(encoding="utf-8"))
            result[key] = (now - float(blob.get("ts", 0))) < fresh
            if name == "waiting" and result[key]:
                result["agent_pid"] = blob.get("pid")
        except (OSError, ValueError, TypeError):
            #: Unreadable is *unknown*, not absent. `desk.py` arms its watcher
            #: anyway: a spurious watcher costs one timed-out background task,
            #: a spurious absence stalls a human sitting at an open tab.
            continue
    return result


# ---------------------------------------------------------------- design system

def design_system(root: Path) -> dict:
    """The project's committed token system, as the lane reads it.

    Read-only here. Turning these rules into recallable graph constraints is a
    human-gated distillation (`/gw-foundation`), never something this module
    does on a GET.
    """
    path = root / ".impeccable" / "design.json"
    if not path.is_file():
        return {"present": False, "rules": [], "donts": [], "stale_rules": 0}
    try:
        blob = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"present": False, "error": str(exc), "rules": [], "donts": [], "stale_rules": 0}

    narrative = blob.get("narrative") or {}
    rules = []
    for rule in narrative.get("rules") or []:
        if isinstance(rule, dict):
            name = rule.get("name") or rule.get("title") or ""
            body = rule.get("body") or rule.get("rule") or rule.get("description") or ""
        else:
            name, body = "", str(rule)
        rules.append({
            "name": name,
            "body": body,
            "section": (rule.get("section") or "") if isinstance(rule, dict) else "",
            #: sha256 of the rule BODY alone, first 12 hex — the same input
            #: `design_distill.py` writes into design-bindings.md. Hashing the
            #: name too would make every fingerprint disagree with the recorded
            #: table and report every rule stale forever. Body-only also means a
            #: repainted palette does not read as a changed rule: the fingerprint
            #: tracks the rule text, never the token values.
            "fp": hashlib.sha256(body.strip().encode("utf-8")).hexdigest()[:12],
        })
    #: `narrative.donts` are bare strings, not objects — handling them as dicts
    #: silently yields a list of empty rules.
    donts = [d for d in (narrative.get("donts") or []) if isinstance(d, str)]

    return {
        "present": True,
        "title": blob.get("title") or "",
        "generated_at": blob.get("generatedAt") or "",
        "north_star": narrative.get("northStar") or "",
        "overview": narrative.get("overview") or "",
        "rules": rules,
        "donts": donts,
        "stale_rules": 0,
    }


# ---------------------------------------------------------------- serving

#: What a prototype directory may serve. An allowlist, because this route reads
#: real files off the project's disk rather than out of the package.
PROTO_EXTS = frozenset({".html", ".htm", ".css", ".js", ".mjs", ".svg", ".png",
                        ".jpg", ".jpeg", ".webp", ".gif", ".woff", ".woff2", ".json"})
ASSET_EXTS = frozenset({".css", ".woff", ".woff2", ".ttf", ".otf", ".svg", ".png",
                        ".jpg", ".jpeg", ".webp", ".gif"})

_BINDING_RE = re.compile(r"^\s*(stylesheet|font|asset)\s*:\s*(.+?)\s*$", re.M)


def stylesheet_allowlist(root: Path) -> set[str]:
    """Exact project-relative paths a prototype may load, from
    `context/foundation/design-bindings.md`.

    A prototype must wear the project's *real* shipping stylesheet — copying it
    into `context/design/` would duplicate token values into git, and there is no
    build step to generate one. So pmview serves the project's own file, from an
    **exact allowlist**: not a prefix, not a regex. Membership is a set lookup,
    and nothing derived from a request path ever reaches a join.
    """
    path = root / "context" / "foundation" / "design-bindings.md"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return set()

    base = root.resolve()
    allow: set[str] = set()
    for _, raw in _BINDING_RE.findall(text):
        raw = raw.strip().strip("`").lstrip("/")
        if not raw or raw.startswith(("http://", "https://", "//")):
            continue
        candidate = Path(raw)
        if candidate.is_absolute() or ".." in candidate.parts:
            continue
        if candidate.suffix.lower() not in ASSET_EXTS:
            continue
        try:
            resolved = (base / candidate).resolve()
        except OSError:
            continue
        # Bounds the *resolved* path, so a symlink out of the project cannot be
        # allowlisted by naming an innocent-looking relative path.
        if resolved.is_relative_to(base) and resolved.is_file():
            allow.add(str(candidate).replace(os.sep, "/"))
    return allow


def helper_origins(root: Path, surface: str) -> list[str]:
    """Origins for a running impeccable live helper, if there is one.

    The port is persisted by `recordInjection` into
    `.impeccable/live/inject-journal.json` (`live/frameworks/journal.mjs`), and
    the script tag it injects points at **localhost**, not 127.0.0.1
    (`live/frameworks/script-src.mjs`) — a CSP listing only the numeric spelling
    blocks the helper outright.
    """
    directory = surface_dir(root, surface)
    candidates = [p for p in (
        directory / ".impeccable" / "live" / "inject-journal.json" if directory else None,
        root / ".impeccable" / "live" / "inject-journal.json",
    ) if p is not None]
    for path in candidates:
        try:
            port = json.loads(path.read_text(encoding="utf-8")).get("port")
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
        if isinstance(port, int) and 0 < port < 65536:
            return [f"http://localhost:{port}", f"http://127.0.0.1:{port}"]
    return []


#: Spliced before the LAST `</body>` when the Design tab frames a prototype.
#: Additive only: no query parameter may ever subtract a security header, so
#: there is no `?raw=1`. Every other consumer — the standalone tab, impeccable
#: live — gets the file's bytes verbatim, which is what keeps live's own on-disk
#: injection byte-exact.
PIN_TAG = ('<script src="/_gw/pin.js" data-gw-surface="{surface}" '
           'data-gw-screen="{screen}"></script>')


def splice_pin(html: bytes, surface: str, screen: str) -> bytes:
    tag = PIN_TAG.format(surface=surface, screen=screen).encode()
    marker = b"</body>"
    at = html.rfind(marker)
    if at == -1:
        return html + tag
    return html[:at] + tag + html[at:]


# ---------------------------------------------------------------- the roll-up

def surfaces(root: Path) -> list[dict]:
    """Every surface under `context/design/`, folded for the rail."""
    base = design_root(root)
    if not base.is_dir():
        return []
    out = []
    try:
        entries = sorted(p for p in base.iterdir() if p.is_dir())
    except OSError:
        return []
    for entry in entries:
        surface = entry.name
        if not SLUG_RE.fullmatch(surface):
            continue
        deck, warnings = read_deck(entry / "deck.json")
        desk = read_asks(entry / "asks.jsonl")
        counts = _deck_counts(deck)

        target = deck.get("target")
        if isinstance(target, str) and target and gw_slug(target) != surface:
            warnings.append(
                f"deck target {target!r} keys to {gw_slug(target)!r}, not this "
                f"directory — two surfaces may be sharing one desk")

        live = presence(root, surface)
        out.append({
            "surface": surface,
            "target": target or "",
            "binding": deck.get("binding") or "",
            "stylesheet": deck.get("stylesheet") or "",
            **counts,
            "open_asks": desk["open_asks"],
            "answered_asks": desk["answered_asks"],
            "declined": desk["declined_asks"],
            "unacked_instructions": desk["unacked_instructions"],
            "desk_lines": desk["lines"],
            "last_activity": _last_activity(entry / "asks.jsonl"),
            "agent_listening": live["agent_listening"],
            "handoff": desk["handoff"],
            "warnings": warnings + desk["warnings"],
        })
    return out


def _last_activity(path: Path) -> str:
    try:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(path.stat().st_mtime))
    except OSError:
        return ""
