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
from importlib import resources
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import graph as graph_mod
from . import lifecycle
from .board import Board
from .memory import MemoryAPI, MemoryError_, MemoryUnavailable

# Order matters: the live SQLite store wins when present, and a fresh clone that
# has only the committed text dump still gets a board. `graph.load()` sniffs the
# SQLite magic, so both names go down the same read path.
STORE_NAMES = ("memory-graph.db", "memory-graph.dump")


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

    @staticmethod
    def _file_stamp(path: Path) -> tuple | None:
        """(mtime, size) or None. A file can vanish between the glob and the stat —
        `handle_error` is not overridden, so an unguarded `stat()` prints a traceback
        into the terminal the operator is watching."""
        try:
            stat = path.stat()
        except OSError:
            return None
        return (stat.st_mtime_ns, stat.st_size)

    def _fingerprint(self) -> tuple:
        store = self.project.store
        parts: list = []
        # The `-wal`/`-shm` sidecars matter as much as the main file: the memory
        # server runs SQLite in WAL mode, so a committed write can leave the `.db`
        # mtime untouched for a long time. Watching only the main file serves stale
        # cards straight after an edit.
        if store:
            for suffix in ("", "-wal", "-shm"):
                parts.append(self._file_stamp(store.with_name(store.name + suffix)))
        else:
            parts.append(None)
        for sub in ("changes", "archive"):
            root = self.project.context / sub
            if root.is_dir():
                parts.append(tuple(
                    (str(p.relative_to(root)), stamp)
                    for p in sorted(root.rglob("*.md"))
                    if (stamp := self._file_stamp(p)) is not None
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
                stamp[1]
                for suffix in ("", "-wal", "-shm")
                if (stamp := self._file_stamp(store.with_name(store.name + suffix))) is not None
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
    #: Same-origin spellings of this server's own bind. Never a literal — the port
    #: is chosen at startup and `localhost` and `127.0.0.1` are different origins
    #: to a browser even though they are the same socket.
    allowed_origins: frozenset[str] = frozenset()

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

    #: A write body is a node body or a short reason — never a payload. Anything
    #: larger is a mistake or an attack, and reading it costs memory either way.
    MAX_BODY = 1 << 20

    def _payload(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def _write_allowed(self) -> bool:
        """Guard the write proxy against a page the operator merely *visited*.

        pmview binds to loopback, but loopback is not a boundary a browser
        respects: any site can POST here cross-origin. Requiring JSON is what
        actually stops it — a form, an image or a `sendBeacon` can only send
        simple content types, and `application/json` forces a preflight this
        server never answers. `Origin` is then checked *when present*; it is not
        required, because a missing `Origin` means the caller is not a browser
        (curl, a script, a test) and has the operator's own shell anyway.
        """
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            self._error("writes must be application/json", 415, code="unsupported_media_type")
            return False

        length = int(self.headers.get("Content-Length") or 0)
        if length > self.MAX_BODY:
            self._error("request body too large", 413, code="body_too_large")
            return False

        origin = self.headers.get("Origin")
        if origin and origin not in self.allowed_origins:
            self._error("cross-origin write refused", 403, code="forbidden_origin")
            return False
        return True

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
        if not self._write_allowed():
            return
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
        # Serve from package resources, not a filesystem path: this reads the same
        # whether pmview runs from source, an installed wheel, or a zipapp (.pyz),
        # where the static files live inside the archive and have no real path.
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        parts = [p for p in rel.split("/") if p not in ("", ".")]
        if not parts or any(p == ".." for p in parts):  # no traversal out of static/
            self.send_error(404)
            return
        try:
            data = resources.files("pmview").joinpath("static", *parts).read_bytes()
        except (FileNotFoundError, IsADirectoryError, OSError, ModuleNotFoundError):
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(parts[-1])[0] or "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def _origins(host: str, port: int) -> frozenset[str]:
    """Every spelling of this bind a browser could send as `Origin`."""
    hosts = {host}
    if host in ("127.0.0.1", "localhost", "::1", ""):
        hosts |= {"127.0.0.1", "localhost", "[::1]"}
    return frozenset(f"http://{h}:{port}" for h in hosts if h)


def build_server(projects: list[Project], host: str, port: int,
                 memory_url: str, verbose: bool = False) -> ThreadingHTTPServer:
    handler = type("BoundHandler", (Handler,), {
        "views": {p.name: ProjectView(p) for p in projects},
        "memory": MemoryAPI(memory_url),
    })
    server = ThreadingHTTPServer((host, port), handler)
    # After the bind, not before: `port` may be 0 (ephemeral), and the origin a
    # browser sends carries the port it actually connected to.
    handler.allowed_origins = _origins(host, server.server_address[1])
    server.verbose = verbose  # type: ignore[attr-defined]
    return server
