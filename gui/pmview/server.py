"""HTTP server for the board: stdlib only, local, single user.

Reads come from disk (lifecycle folders + the memory store, re-read when their
mtimes change). Writes are forwarded to the agentic-memory-system GUI API — see
`memory.py` for why they are not applied here.
"""

from __future__ import annotations

import json
import mimetypes
import re
import subprocess
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import graph as graph_mod
from . import lifecycle
from .board import Board
from .memory import MemoryAPI, MemoryError_, MemoryUnavailable

STATIC_DIR = Path(__file__).resolve().parent / "static"
STORE_NAMES = ("memory-graph.db",)


def _git_info(root: Path) -> dict:
    """Origin remote and current branch, read on demand. Any failure (no git, not a
    repo, detached HEAD) degrades to `None` rather than raising — this is a local
    convenience read, never a hard dependency."""
    def run(*args: str) -> str | None:
        try:
            done = subprocess.run(
                ["git", "-C", str(root), *args],
                capture_output=True, text=True, timeout=2,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        out = done.stdout.strip()
        return out if done.returncode == 0 and out else None

    return {
        "origin": run("remote", "get-url", "origin"),
        "branch": run("rev-parse", "--abbrev-ref", "HEAD"),
    }


@dataclass
class Project:
    """One project directory with a `context/` tree."""

    name: str
    root: Path

    @property
    def context(self) -> Path:
        return self.root / "context"

    @property
    def store(self) -> Path | None:
        for name in STORE_NAMES:
            candidate = self.context / name
            if candidate.is_file():
                return candidate
        return None


def discover(paths: list[Path]) -> list[Project]:
    """Treat each path with a `context/` dir as a project; otherwise look one level
    down, so `--root dogfood` picks up every dogfooded project at once."""
    projects: list[Project] = []
    for path in paths:
        path = path.resolve()
        if (path / "context").is_dir():
            projects.append(Project(path.name, path))
            continue
        for child in sorted(p for p in path.iterdir() if p.is_dir()):
            if (child / "context").is_dir():
                projects.append(Project(child.name, child))
    return projects


class ProjectView:
    """A project's board, rebuilt when the files behind it change."""

    def __init__(self, project: Project) -> None:
        self.project = project
        self._board: Board | None = None
        self._stamp: tuple | None = None

    def _fingerprint(self) -> tuple:
        store = self.project.store
        parts: list = []
        # The `-wal`/`-shm` sidecars matter as much as the main file: the memory
        # server runs SQLite in WAL mode, so a committed write can leave the `.db`
        # mtime untouched for a long time. Watching only the main file serves stale
        # cards straight after an edit.
        if store:
            for suffix in ("", "-wal", "-shm"):
                sidecar = store.with_name(store.name + suffix)
                stat = sidecar.stat() if sidecar.is_file() else None
                parts.append((stat.st_mtime_ns, stat.st_size) if stat else None)
        else:
            parts.append(None)
        for sub in ("changes", "archive"):
            root = self.project.context / sub
            if root.is_dir():
                parts.append(tuple(
                    (str(p.relative_to(root)), p.stat().st_mtime_ns)
                    for p in sorted(root.rglob("*.md"))
                ))
        return tuple(parts)

    def invalidate(self) -> None:
        """Drop the cached read model. Called after a write goes through, so a
        checkpointed-later WAL can never make the board lie about what just changed."""
        self._board = None
        self._stamp = None

    def board(self) -> Board:
        stamp = self._fingerprint()
        if self._board is None or stamp != self._stamp:
            store = self.project.store
            g = graph_mod.load(store) if store else graph_mod.Graph()
            self._board = Board(lifecycle.scan(self.project.context), g)
            self._stamp = stamp
        return self._board

    def info(self) -> dict:
        store = self.project.store
        return {
            "name": self.project.name,
            "root": str(self.project.root),
            "store": str(store) if store else None,
            "store_missing": store is None,
        }

    def detail(self) -> dict:
        """The header info popover: identity plus on-disk size, graph totals, and
        git origin. Heavier than `info()` (it shells out to git), so it lives on its
        own endpoint rather than riding every board fetch."""
        store = self.project.store
        size = None
        if store:
            size = sum(
                sidecar.stat().st_size
                for suffix in ("", "-wal", "-shm")
                if (sidecar := store.with_name(store.name + suffix)).is_file()
            )
        board = self.board()
        return {
            **self.info(),
            "size_bytes": size,
            "totals": {**board.board()["totals"], "edges": len(board.graph.edges)},
            "git": _git_info(self.project.root),
        }


class Handler(BaseHTTPRequestHandler):
    server_version = "gw-pmview"
    views: dict[str, ProjectView] = {}
    memory: MemoryAPI = MemoryAPI()

    # --- plumbing -----------------------------------------------------------

    def log_message(self, fmt: str, *args) -> None:  # quieter default logging
        if self.server.verbose:  # type: ignore[attr-defined]
            super().log_message(fmt, *args)

    def _send(self, payload, status: int = 200) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message: str, status: int = 400, **extra) -> None:
        self._send({"error": message, **extra}, status)

    def _view(self, query: dict) -> ProjectView | None:
        name = (query.get("project") or [None])[0]
        if name is None:
            return next(iter(self.views.values()), None)
        return self.views.get(name)

    def _payload(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except json.JSONDecodeError:
            return {}

    def _proxy(self, call) -> None:
        """Run one write against the memory API, translating its failure modes."""
        try:
            result = call()
            for view in self.views.values():
                view.invalidate()
            self._send(result)
        except MemoryUnavailable as exc:
            self._error(str(exc), 503, code="memory_unavailable")
        except MemoryError_ as exc:
            self._error(str(exc), exc.status, code="memory_rejected")

    # --- routing ------------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802 - stdlib naming
        parsed = urlparse(self.path)
        path, query = parsed.path, parse_qs(parsed.query)

        if not path.startswith("/api/"):
            return self._static(path)

        if path == "/api/projects":
            return self._send([v.info() for v in self.views.values()])
        if path == "/api/memory/status":
            try:
                return self._send({"available": True, **self.memory.health()})
            except (MemoryUnavailable, MemoryError_) as exc:
                return self._send({"available": False, "reason": str(exc)})

        view = self._view(query)
        if view is None:
            return self._error("no such project", 404)

        if path == "/api/project":
            return self._send(view.detail())

        board = view.board()

        if path == "/api/board":
            return self._send({**board.board(), "project": view.info()})
        if path == "/api/issues":
            include = (query.get("flagged") or ["1"])[0] != "0"
            return self._send(board.issues(include_flagged=include))
        if path == "/api/search":
            return self._send(board.search((query.get("q") or [""])[0]))
        if match := re.fullmatch(r"/api/changes/([^/]+)", path):
            detail = board.change_detail(match.group(1))
            return self._send(detail) if detail else self._error("no such change", 404)
        if match := re.fullmatch(r"/api/nodes/([^/]+)", path):
            detail = board.node_detail(match.group(1))
            return self._send(detail) if detail else self._error("no such node", 404)
        if match := re.fullmatch(r"/api/review/([^/]+)/guidance", path):
            return self._proxy(lambda: self.memory.review_guidance(match.group(1)))
        if path == "/api/recall":
            goal = (query.get("goal") or [""])[0]
            return self._proxy(lambda: self.memory.recall(goal, (query.get("q") or [""])[0]))
        return self._error("unknown endpoint", 404)

    def do_POST(self) -> None:  # noqa: N802 - stdlib naming
        path = urlparse(self.path).path
        payload = self._payload()

        if match := re.fullmatch(r"/api/nodes/([^/]+)/body", path):
            body = str(payload.get("body", "")).strip()
            if not body:
                return self._error("body must be non-empty")
            node_id = match.group(1)
            reason = str(payload.get("reason", "")) or "edited from the project board"
            return self._proxy(lambda: self.memory.edit_body(node_id, body, reason))
        if match := re.fullmatch(r"/api/nodes/([^/]+)/tier", path):
            node_id = match.group(1)
            return self._proxy(lambda: self.memory.set_tier(node_id, payload))
        if match := re.fullmatch(r"/api/review/([^/]+)/resolve", path):
            node_id = match.group(1)
            return self._proxy(lambda: self.memory.resolve_review(node_id, payload))
        if path == "/api/edges":
            return self._proxy(lambda: self.memory.create_edge(payload))
        if path == "/api/nodes":
            return self._proxy(lambda: self.memory.create_artifact(payload))
        return self._error("unknown endpoint", 404)

    # --- static -------------------------------------------------------------

    def _static(self, path: str) -> None:
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        target = (STATIC_DIR / rel).resolve()
        if not target.is_file() or STATIC_DIR not in target.parents:
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def build_server(projects: list[Project], host: str, port: int,
                 memory_url: str, verbose: bool = False) -> ThreadingHTTPServer:
    handler = type("BoundHandler", (Handler,), {
        "views": {p.name: ProjectView(p) for p in projects},
        "memory": MemoryAPI(memory_url),
    })
    server = ThreadingHTTPServer((host, port), handler)
    server.verbose = verbose  # type: ignore[attr-defined]
    return server
