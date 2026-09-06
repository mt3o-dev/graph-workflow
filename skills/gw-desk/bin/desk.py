#!/usr/bin/env python3
"""The desk: an agent's side of the append-only agent↔human channel.

One log per surface, at `context/design/<surface>/asks.jsonl`. The agent posts
asks and ends its turn; the human answers in pmview; a watcher the agent
launched wakes it. Nothing lives in a process, so nothing is lost when a session
dies.

    desk.py post    --surface S --change C --file ask.json
    desk.py drain   --surface S [--session ID]
    desk.py wait    --surface S [--timeout 900]
    desk.py ack     --surface S --refs a,b --disposition acted --text "…"
    desk.py retire  --surface S --refs a --reason "…"
    desk.py note    --surface S --screen S --text "…"
    desk.py handoff --surface S --open a,b --resume "…" --text "…"
    desk.py status  --surface S

Exit codes are copied from impeccable's `serve-question.mjs` so the mental model
transfers and a future surface swap needs no skill edits:

    0  one or more undelivered human lines, printed as JSON on stdout
    2  the log is unreadable, or the surface directory is gone
    3  nothing waiting / timed out
    4  nobody is listening — presence was fresh at start and has gone stale, or
       a handoff is already the last agent line

Two rules that are not obvious and matter:

**`drain` never acks.** The ack is a separate call the agent makes *after* it has
acted. A session that dies between reading and acting re-delivers on the next
drain — impeccable live's own "the journal is canonical and replays
unacknowledged work" semantics, adopted deliberately.

**Ack-after-act can therefore re-deliver a line the agent already captured.** The
memory surface has no idempotency key, so before capturing in response to a
redelivered line, recall by its thread id (every captured node quotes
`per desk <surface>#<id>` as provenance) and ack instead of capturing on a hit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

EXIT_LINES, EXIT_ERROR, EXIT_NOTHING, EXIT_NOBODY = 0, 2, 3, 4

MAX_LINE = 16 * 1024
LISTEN_FRESH_S = 15
PRESENT_FRESH_S = 120
POLL_TICK_S = 2.0

HUMAN_KINDS = frozenset({"answer", "instruction", "decline"})
AGENT_KINDS = frozenset({"ask", "note", "ack", "retire", "handoff"})
DISPOSITIONS = ("acted", "deferred", "contradicts", "declined")


# ------------------------------------------------------------------ locating

def find_root(start: Path) -> Path | None:
    """Walk up for the project that owns a `context/design/` tree."""
    for directory in [start, *start.parents]:
        if (directory / "context" / "design").is_dir():
            return directory
        if (directory / "context").is_dir() and (directory / ".git").exists():
            return directory
    return None


def resolve(args) -> tuple[Path, Path]:
    root = Path(args.root).resolve() if args.root else find_root(Path.cwd())
    if root is None:
        die("no project found — run from inside a project with a context/ tree, "
            "or pass --root")
    directory = root / "context" / "design" / args.surface
    return root, directory


def die(message: str, code: int = EXIT_ERROR) -> None:
    print(json.dumps({"error": message}), file=sys.stderr)
    raise SystemExit(code)


def session_id(args, root: Path) -> str:
    """A session id always exists: the flag, then $GW_SESSION, then a stable
    hash of the change and surface — so a cold resume folds against the same
    cursor the first turn used."""
    if getattr(args, "session", None):
        return args.session
    if os.environ.get("GW_SESSION"):
        return os.environ["GW_SESSION"]
    seed = f"{root}:{getattr(args, 'change', '') or ''}:{args.surface}"
    return "s-" + hashlib.sha256(seed.encode()).hexdigest()[:8]


# ------------------------------------------------------------------ log I/O

def read_lines(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    lines = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            line = json.loads(raw)
        except json.JSONDecodeError:
            continue          # one bad line never takes down the desk
        if isinstance(line, dict) and isinstance(line.get("kind"), str):
            lines.append(line)
    return lines


def append(path: Path, lines: list[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        for line in lines:
            blob = json.dumps(line, ensure_ascii=False, separators=(",", ":")) + "\n"
            if len(blob.encode("utf-8")) > MAX_LINE:
                die(f"line {line.get('id')} exceeds 16 KB")
            handle.write(blob)
            handle.flush()
    return len(lines)


def new_id() -> str:
    return os.urandom(4).hex()


def stamp(kind: str, session: str, **fields) -> dict:
    line = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "kind": kind, "id": new_id(), "by": "agent", "session": session}
    line.update({k: v for k, v in fields.items() if v not in (None, "", [], {})})
    return line


# ------------------------------------------------------------------ the fold

def undelivered(lines: list[dict], session: str) -> list[dict]:
    """Human lines this session has not acked.

    Per-session on purpose. A global cursor means agent B acking an answer to
    agent A's ask makes that answer invisible to A's next drain, so A times out
    or reports its own ask still open having never seen the reply.
    """
    acked: set[str] = set()
    for line in lines:
        if line.get("kind") == "ack" and (line.get("session") or "") == session:
            acked.update(x for x in (line.get("refs") or []) if isinstance(x, str))
    return [l for l in lines if l.get("kind") in HUMAN_KINDS and l.get("id") not in acked]


def open_asks(lines: list[dict]) -> list[str]:
    retired: set[str] = set()
    declined: set[str] = set()
    answered: set[str] = set()
    landed: set[tuple[str, str]] = set()
    for line in lines:
        kind = line.get("kind")
        if kind == "retire":
            retired.update(line.get("refs") or [])
        elif kind == "decline" and line.get("ask"):
            declined.add(line["ask"])
        elif kind == "answer" and line.get("ask"):
            answered.add(line["ask"])
        elif kind == "ack":
            for ref in line.get("refs") or []:
                landed.add((line.get("session") or "", ref))
    out = []
    for line in lines:
        if line.get("kind") != "ask":
            continue
        aid = line.get("id")
        own = line.get("session") or ""
        if aid in retired or aid in declined or aid in answered:
            continue
        if (own, aid) in landed:
            continue
        out.append(aid)
    return out


def last_agent_kind(lines: list[dict]) -> str | None:
    agent = [l for l in lines if l.get("kind") in AGENT_KINDS]
    return agent[-1]["kind"] if agent else None


# ------------------------------------------------------------------ presence

def scratch(root: Path) -> Path:
    return root / ".gw-scratch" / "design"


def fresh(root: Path, surface: str, name: str, window: float) -> tuple[bool | None, dict]:
    """(fresh?, blob). `None` means **cannot tell** — the file is unreadable or
    malformed, which is not the same as absent.

    Callers treat unknown as present: a spurious watcher costs one timed-out
    background task, while a spurious absence strands a human at an open tab
    waiting for an agent that never armed.
    """
    path = scratch(root) / f"{surface}.{name}.json"
    if not path.exists():
        return False, {}
    try:
        blob = json.loads(path.read_text(encoding="utf-8"))
        return (time.time() - float(blob.get("ts", 0))) < window, blob
    except (OSError, ValueError, TypeError):
        return None, {}


def beat(root: Path, surface: str) -> None:
    """Rewrite the wait heartbeat. A heartbeat, not a flag: a session killed
    mid-wait stops looking alive within seconds instead of forever."""
    directory = scratch(root)
    try:
        directory.mkdir(parents=True, exist_ok=True)
        tmp = directory / f"{surface}.waiting.tmp"
        tmp.write_text(json.dumps({"ts": time.time(), "pid": os.getpid()}), encoding="utf-8")
        os.replace(tmp, directory / f"{surface}.waiting.json")
    except OSError:
        pass


def clear_beat(root: Path, surface: str) -> None:
    try:
        (scratch(root) / f"{surface}.waiting.json").unlink()
    except OSError:
        pass


# ------------------------------------------------------------------ commands

def cmd_post(args, root: Path, directory: Path) -> int:
    if not directory.is_dir():
        die(f"no surface directory at {directory}")
    try:
        blob = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"could not read {args.file}: {exc}")
    asks = blob if isinstance(blob, list) else [blob]
    session = session_id(args, root)

    lines = []
    for ask in asks:
        if not isinstance(ask, dict):
            die("each ask must be an object")
        if not ask.get("title"):
            die("every ask needs a title")
        lines.append(stamp(
            "ask", session,
            change=args.change, goal=args.goal, surface=args.surface,
            screen=ask.get("screen"), blocks=ask.get("blocks"),
            title=ask["title"], body=ask.get("body"),
            options=ask.get("options"), free_text=ask.get("free_text", True),
            risk=ask.get("risk"), materials=ask.get("materials"),
            palette=ask.get("palette"), media=ask.get("media"),
            cites=ask.get("cites"),
        ))
    append(directory / "asks.jsonl", lines)

    present, _ = fresh(root, args.surface, "presence", PRESENT_FRESH_S)
    result = {
        "posted": len(lines),
        "ids": [l["id"] for l in lines],
        "session": session,
        "human_present": present,
        "link": f"http://127.0.0.1:{args.port}/#design/{args.surface}",
        "titles": [l["title"] for l in lines],
    }
    print(json.dumps(result, indent=2))
    return EXIT_LINES


def cmd_drain(args, root: Path, directory: Path) -> int:
    if not directory.is_dir():
        die(f"no surface directory at {directory}")
    session = session_id(args, root)
    pending = undelivered(read_lines(directory / "asks.jsonl"), session)
    if not pending:
        print(json.dumps([]))
        return EXIT_NOTHING
    print(json.dumps(pending, indent=2))
    return EXIT_LINES


def cmd_wait(args, root: Path, directory: Path) -> int:
    """Poll for human lines, heartbeating so pmview can tell somebody is home.

    Launched as a background task by the agent *inside its own turn*, which then
    ends. pmview cannot start or wake a process; what resumes the agent is this
    watcher exiting and the harness re-invoking it.
    """
    if not directory.is_dir():
        die(f"no surface directory at {directory}")
    path = directory / "asks.jsonl"
    session = session_id(args, root)

    lines = read_lines(path)
    if last_agent_kind(lines) == "handoff":
        clear_beat(root, args.surface)
        die("a handoff is already the last agent line — nothing is waiting on this "
            "session", EXIT_NOBODY)

    pending = undelivered(lines, session)
    if pending:                       # already answered before the watcher armed
        print(json.dumps(pending, indent=2))
        return EXIT_LINES

    # `None` (cannot tell) counts as present — see fresh().
    present_at_start = fresh(root, args.surface, "presence", PRESENT_FRESH_S)[0] is not False
    deadline = time.time() + args.timeout
    try:
        stat = path.stat().st_mtime_ns if path.is_file() else 0
        while time.time() < deadline:
            beat(root, args.surface)
            time.sleep(POLL_TICK_S)
            current = path.stat().st_mtime_ns if path.is_file() else 0
            if current != stat:
                stat = current
                pending = undelivered(read_lines(path), session)
                if pending:
                    print(json.dumps(pending, indent=2))
                    return EXIT_LINES
            if present_at_start:
                still, _ = fresh(root, args.surface, "presence", PRESENT_FRESH_S)
                if still is False:      # not None: unknown is not a departure
                    die("the human closed the tab — nobody is listening", EXIT_NOBODY)
        print(json.dumps([]))
        return EXIT_NOTHING
    finally:
        clear_beat(root, args.surface)


def cmd_ack(args, root: Path, directory: Path) -> int:
    refs = [r for r in (args.refs or "").split(",") if r.strip()]
    if not refs:
        die("ack needs --refs")
    if args.disposition not in DISPOSITIONS:
        die(f"--disposition must be one of {DISPOSITIONS}")
    line = stamp("ack", session_id(args, root), refs=[r.strip() for r in refs],
                 disposition=args.disposition, text=args.text,
                 captured=[c.strip() for c in (args.captured or "").split(",") if c.strip()])
    append(directory / "asks.jsonl", [line])
    print(json.dumps({"acked": line["refs"], "id": line["id"]}))
    return EXIT_LINES


def cmd_retire(args, root: Path, directory: Path) -> int:
    refs = [r.strip() for r in (args.refs or "").split(",") if r.strip()]
    if not refs:
        die("retire needs --refs")
    if not args.reason:
        die("retire needs --reason — a retired ask is one whose subject is gone, "
            "and the human should be able to see why")
    line = stamp("retire", session_id(args, root), refs=refs, reason=args.reason)
    append(directory / "asks.jsonl", [line])
    print(json.dumps({"retired": refs, "id": line["id"]}))
    return EXIT_LINES


def cmd_note(args, root: Path, directory: Path) -> int:
    if not args.text:
        die("note needs --text")
    line = stamp("note", session_id(args, root), screen=args.screen, text=args.text)
    append(directory / "asks.jsonl", [line])
    print(json.dumps({"id": line["id"]}))
    return EXIT_LINES


def cmd_handoff(args, root: Path, directory: Path) -> int:
    still_open = [o.strip() for o in (args.open or "").split(",") if o.strip()]
    if not still_open:
        still_open = open_asks(read_lines(directory / "asks.jsonl"))
    line = stamp("handoff", session_id(args, root), open=still_open,
                 resume=args.resume, text=args.text)
    append(directory / "asks.jsonl", [line])
    clear_beat(root, args.surface)
    print(json.dumps({"id": line["id"], "open": still_open}))
    return EXIT_LINES


def cmd_requests(args, root: Path, directory: Path) -> int:
    """Skill invocations the human queued from the board.

    The desk one scope up: per project rather than per surface. Same
    append-only file, same derived state — a request is open until an ack
    references it. pmview appended it; nothing started anything.
    """
    path = root / "context" / "requests.jsonl"
    lines = read_lines(path)
    session = session_id(args, root)
    acked: set[str] = set()
    for line in lines:
        if line.get("kind") == "ack" and (line.get("session") or "") == session:
            acked.update(x for x in (line.get("refs") or []) if isinstance(x, str))
    pending = [l for l in lines
               if l.get("kind") == "request" and l.get("id") not in acked]
    if not pending:
        print(json.dumps([]))
        return EXIT_NOTHING
    print(json.dumps(pending, indent=2))
    return EXIT_LINES


def cmd_ack_request(args, root: Path, directory: Path) -> int:
    refs = [r.strip() for r in (args.refs or "").split(",") if r.strip()]
    if not refs:
        die("ack-request needs --refs")
    line = stamp("ack", session_id(args, root), refs=refs,
                 disposition=args.disposition, text=args.text)
    append(root / "context" / "requests.jsonl", [line])
    print(json.dumps({"acked": refs, "id": line["id"]}))
    return EXIT_LINES


def cmd_status(args, root: Path, directory: Path) -> int:
    lines = read_lines(directory / "asks.jsonl")
    listening, beat_blob = fresh(root, args.surface, "waiting", LISTEN_FRESH_S)
    present, _ = fresh(root, args.surface, "presence", PRESENT_FRESH_S)
    beat_blob = beat_blob or {}
    still_open = open_asks(lines)
    print(json.dumps({
        "surface": args.surface,
        "lines": len(lines),
        "open_asks": still_open,
        "open": len(still_open),
        "undelivered": len(undelivered(lines, session_id(args, root))),
        "last_agent_kind": last_agent_kind(lines),
        "human_present": present,
        "agent_listening": listening,
        "agent_pid": beat_blob.get("pid"),
        "changes": sorted({l["change"] for l in lines
                           if l.get("kind") == "ask" and l.get("change")}),
    }, indent=2))
    return EXIT_LINES if still_open else EXIT_NOTHING


COMMANDS = {"post": cmd_post, "drain": cmd_drain, "wait": cmd_wait, "ack": cmd_ack,
            "retire": cmd_retire, "note": cmd_note, "handoff": cmd_handoff,
            "status": cmd_status, "requests": cmd_requests,
            "ack-request": cmd_ack_request}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="desk.py", description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=sorted(COMMANDS))
    parser.add_argument("--surface", default="",
                        help="required for every command except `requests` and "
                             "`ack-request`, which are project-scoped")
    parser.add_argument("--root", help="project root (default: walk up from cwd)")
    parser.add_argument("--session", help="default: $GW_SESSION, else a stable hash")
    parser.add_argument("--change")
    parser.add_argument("--goal", help="the memory_goal this surface's asks serve")
    parser.add_argument("--file", help="post: a JSON ask, or an array of them")
    parser.add_argument("--refs", help="comma-separated line ids")
    parser.add_argument("--captured", help="comma-separated node ids this ack captured")
    parser.add_argument("--disposition", default="acted", choices=DISPOSITIONS)
    parser.add_argument("--reason")
    parser.add_argument("--text")
    parser.add_argument("--screen")
    parser.add_argument("--open", help="handoff: ids still open (default: derived)")
    parser.add_argument("--resume", help="handoff: the command that picks this back up")
    parser.add_argument("--timeout", type=float, default=900.0)
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args(argv)

    if args.command not in ("requests", "ack-request") and not args.surface:
        parser.error(f"{args.command} needs --surface")
    root, directory = resolve(args)
    return COMMANDS[args.command](args, root, directory)


if __name__ == "__main__":
    raise SystemExit(main())
