"""HTTP server for the board: stdlib only, local, single user.

Reads come from disk (lifecycle folders + the memory store, re-read when their
mtimes change). Writes are forwarded to the agentic-memory-system GUI API — see
`memory.py` for why they are not applied here.
"""

from __future__ import annotations

import json
import mimetypes
import re
import secrets
import subprocess
import sys
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import advise as advise_mod
from . import design as design_mod
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
    #: Design routes serve project files and accept appends. They are enabled
    #: only on a loopback bind — the whole lane assumes one local operator, and
    #: a `--host 0.0.0.0` board is a read-only window onto a machine, not a desk.
    design_enabled: bool = False
    #: Minted per process and injected into `index.html`. It does not
    #: authenticate the human — nothing local can, against an agent on the same
    #: machine — it stops a *page the operator merely visited* from appending or
    #: forging presence without first reading our HTML.
    session_token: str = ""

    # --- plumbing -----------------------------------------------------------

    def log_message(self, fmt: str, *args) -> None:  # quieter default logging
        if self.server.verbose:  # type: ignore[attr-defined]
            super().log_message(fmt, *args)


    def _host_ok(self) -> bool:
        """Reject a Host this server does not answer to.

        Without it, DNS rebinding turns any website into a same-origin reader of
        this board: a page on attacker.com that re-resolves to 127.0.0.1 needs no
        CORS and no preflight, and can read the token out of index.html. Only
        enforced on a loopback bind, where the legitimate Host names are exactly
        the loopback spellings — a `--host 0.0.0.0` deployment is reached by
        whatever name the operator typed, and we cannot know it.
        """
        if not self.design_enabled:
            return True
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        if host in ("127.0.0.1", "localhost", "::1"):
            return True
        self._error("unexpected Host", 421, code="bad_host")
        return False

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
        length = self._length() or 0
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def _json_body(self) -> dict | None:
        """Strict counterpart to `_payload`.

        `_payload` returns `{}` on a missing length and swallows a decode error,
        which for a batch of answers would mean a cheerful `200 {"appended": 0}`
        and five rulings gone with no hole in the log to notice later.
        """
        if self.headers.get("Content-Length") is None:
            self._error("Content-Length required", 411, code="length_required")
            return None
        length = self._length()
        if length is None:
            self._error("bad Content-Length", 400, code="bad_length")
            return None
        if length > self.MAX_BODY:
            self._error("request body too large", 413, code="body_too_large")
            return None
        try:
            payload = json.loads(self.rfile.read(length).decode())
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._error(f"body is not valid JSON: {exc}", 400, code="bad_json")
            return None
        if not isinstance(payload, dict):
            self._error("body must be a JSON object", 400, code="bad_json")
            return None
        return payload

    def _token_ok(self) -> bool:
        if self._token_matches():
            return True
        self._error("bad or missing session token", 403, code="bad_token")
        return False

    def _length(self) -> int | None:
        """Content-Length as a non-negative int, or None if the client lied.

        `int()` on a header is a traceback into the operator's terminal —
        `handle_error` is not overridden — and a negative length reaches
        `rfile.read(-1)`, which blocks until the client disconnects and pins one
        thread of an unbounded pool.
        """
        raw = self.headers.get("Content-Length")
        if raw is None:
            return 0
        try:
            length = int(raw)
        except (TypeError, ValueError):
            return None
        return length if length >= 0 else None

    def _token_matches(self) -> bool:
        """Constant-time compare that survives a hostile header.

        Headers decode as latin-1, so any byte >= 0x80 makes
        `secrets.compare_digest` raise `TypeError` on str inputs. Compare bytes.
        """
        sent = (self.headers.get("X-GW-Token") or "").encode("latin-1", "replace")
        return secrets.compare_digest(sent, self.session_token.encode())

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

        length = self._length()
        if length is None:
            self._error("bad Content-Length", 400, code="bad_length")
            return False
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
        if not self._host_ok():
            return
        parsed = urlparse(self.path)
        path, query = parsed.path, parse_qs(parsed.query)

        if self.design_enabled:
            if match := re.fullmatch(r"/proto/([^/]+)/([^/]+)/(.+)", path):
                return self._proto(match.group(1), match.group(2), match.group(3), query)
            if match := re.fullmatch(r"/assets/([^/]+)/(.+)", path):
                return self._assets(match.group(1), match.group(2))

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

        if self.design_enabled and (path.startswith("/api/design")
                                    or path == "/api/advise"):
            # Outside `_proxy` deliberately: `_proxy` 503s when :8765 is down,
            # and answering a design question has to work exactly then. It also
            # invalidates every project's board on every success, which a poll
            # running twelve times a minute must never do.
            return self._design_get(path, query, view)

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
        if not self._host_ok():
            return
        path = urlparse(self.path).path
        if not self._write_allowed():
            return
        if self.design_enabled and path == "/api/design/answers":
            return self._design_answers()
        if self.design_enabled and path == "/api/requests":
            return self._request()

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

    # --- the design lane ----------------------------------------------------

    def _design_get(self, path: str, query: dict, view: ProjectView) -> None:
        root = view.project.root
        surface = (query.get("surface") or [""])[0]

        if path == "/api/advise":
            # The same ranking `pmview --advise` prints. One module, two
            # consumers — building them apart is how the terminal and the board
            # end up disagreeing about what to do next.
            return self._send({
                **advise_mod.advise(root, view.board(), view.project.name),
                "requests": design_mod.read_requests(root),
            })

        if path == "/api/design":
            return self._send({
                "project": view.info(),
                "surfaces": design_mod.surfaces(root),
                "design_system": design_mod.design_system(root),
            })

        directory = design_mod.surface_dir(root, surface)
        if directory is None or not directory.is_dir():
            return self._error("no such surface", 404, code="no_surface")

        if path == "/api/design/deck":
            deck, warnings = design_mod.read_deck(directory / "deck.json")
            return self._send({"surface": surface, "deck": deck, "warnings": warnings})

        if path == "/api/design/asks":
            desk = design_mod.read_asks(directory / "asks.jsonl")
            return self._send({"surface": surface, **desk})

        if path == "/api/design/pulse":
            try:
                since = int((query.get("since") or ["0"])[0])
            except ValueError:
                since = 0
            visible = (query.get("visible") or ["0"])[0] == "1"
            # Stamping presence on a GET is a deliberate impurity, and it is
            # gated on the token so a page the operator merely visited cannot
            # forge it. The whole consequence of a forged stamp is one agent
            # entering `wait` with nobody there, and timing out.
            stamp = visible and self._token_matches()
            live = design_mod.presence(root, surface, stamp=stamp)
            desk = design_mod.read_asks(directory / "asks.jsonl")
            return self._send({
                "surface": surface,
                **design_mod.tail_pulse(directory / "asks.jsonl", since),
                "open_asks": desk["open_asks"],
                "unacked_instructions": desk["unacked_instructions"],
                "handoff": bool(desk["handoff"]),
                "agent_listening": live["agent_listening"],
            })

        return self._error("unknown endpoint", 404)

    def _design_answers(self) -> None:
        """Append a batch of human lines to one surface's desk.

        A whitelist-construct: the request body is never merged into a line.
        Every line is built field by field with `by`/`src`/`id`/`ts` stamped
        here, so this endpoint is physically incapable of writing an agent line.
        """
        if not self._token_ok():
            return
        payload = self._json_body()
        if payload is None:
            return

        # Named-but-missing must 404. Falling back to "the first project" is fine
        # for a read and wrong for a write: with several roots mounted and a
        # same-named surface, a ruling lands permanently in the wrong log.
        named = str(payload.get("project") or "")
        view = self.views.get(named) if named else next(iter(self.views.values()), None)
        if view is None:
            return self._error("no such project", 404, code="no_project")

        surface = str(payload.get("surface") or "")
        directory = design_mod.surface_dir(view.project.root, surface)
        if directory is None or not directory.is_dir():
            return self._error("no such surface", 404, code="no_surface")

        batch = payload.get("batch")
        if not isinstance(batch, list) or not batch:
            return self._error("batch must be a non-empty array", 400, code="bad_batch")
        if len(batch) > design_mod.MAX_BATCH:
            return self._error(f"batch is capped at {design_mod.MAX_BATCH}", 400,
                               code="batch_too_large")

        batch_id = design_mod.new_id()
        lines = []
        for i, entry in enumerate(batch):
            if not isinstance(entry, dict):
                return self._error(f"batch[{i}] is not an object", 400, code="bad_batch")
            kind = entry.get("kind")
            if kind not in design_mod.HUMAN_KINDS:
                return self._error(
                    f"batch[{i}]: pmview cannot write {kind!r} — "
                    f"only {sorted(design_mod.HUMAN_KINDS)}", 400, code="bad_kind")
            try:
                lines.append(design_mod.construct(kind, surface, batch_id, entry))
            except ValueError as exc:
                return self._error(f"batch[{i}]: {exc}", 400, code="bad_line")

        try:
            appended = design_mod.append(directory / "asks.jsonl", lines)
        except (OSError, ValueError) as exc:
            return self._error(f"could not append to the desk: {exc}", 500,
                               code="append_failed")
        # No `view.invalidate()`: the desk is not the board, and nothing here
        # touched the store.
        self._send({"appended": appended, "batch": batch_id, "lines": lines})

    def _csp(self, helper: list[str]) -> str:
        """The prototype CSP.

        Every origin is written out in full and computed from the bound socket —
        never a literal, and never `'self'`. A sandboxed document has an opaque
        origin, so `'self'`-matching against it is undefined-to-failing across
        browsers; and pmview answers on `127.0.0.1`, `localhost` and `[::1]`
        alike, so listing one spelling blanks the prototype for whoever typed the
        other.

        `style-src` keeps `'unsafe-inline'` (prototypes and live's variant
        injection both need it, and inline style cannot exfiltrate).
        `script-src` deliberately does not — which is what makes the rung-2 ban
        on inline `<script>` enforceable rather than advisory.
        """
        origins = " ".join(sorted(self.allowed_origins))
        helper_src = (" " + " ".join(helper)) if helper else ""
        connect = " ".join(helper) if helper else "'none'"
        return "; ".join((
            "default-src 'none'",
            f"script-src {origins}{helper_src}",
            f"style-src {origins} 'unsafe-inline'",
            f"img-src {origins} data: blob:",
            f"font-src {origins}",
            f"connect-src {connect}",
            "form-action 'none'",
            "base-uri 'none'",
            "object-src 'none'",
            f"frame-ancestors {origins}",
        ))

    def _serve_file(self, target: Path, body: bytes | None = None,
                    csp: str | None = None, sandbox: bool = False) -> None:
        data = target.read_bytes() if body is None else body
        self.send_response(200)
        self.send_header("Content-Type",
                         mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if csp:
            # `sandbox` puts a TOP-LEVEL prototype at an opaque origin too. The
            # framed path is already sandboxed by the iframe attribute; without
            # this, "open in a new tab" hands agent-authored HTML a same-origin
            # handle to index.html — which carries the session token in a <meta>
            # and is served with no CSP of its own.
            self.send_header("Content-Security-Policy",
                             ("sandbox allow-scripts; " + csp) if sandbox else csp)
        self.end_headers()
        self.wfile.write(data)

    def _proto(self, project: str, surface: str, rest: str, query: dict) -> None:
        """Serve one file out of a surface's design directory.

        Rooted at `context/design/<surface>/`, not at `screens/`, so a prototype
        can reach its sibling `tokens.css` and `assets/` while `resolve()` plus
        `is_relative_to()` still bounds it. That real check matters here in a way
        it does not for `_static`: a zipapp has no symlinks, a project directory
        very much does.
        """
        view = self.views.get(project)          # dict membership, not a regex
        if view is None or not design_mod.SLUG_RE.fullmatch(surface or ""):
            return self.send_error(404)
        parts = [p for p in rest.split("/") if p not in ("", ".")]
        if not parts or any(not design_mod.SLUG_RE.fullmatch(p.replace(".", "-"))
                            for p in parts):
            return self.send_error(404)

        root = (view.project.context / "design" / surface).resolve()
        try:
            target = (root / Path(*parts)).resolve()
        except OSError:
            return self.send_error(404)
        if not target.is_relative_to(root) or not target.is_file():
            return self.send_error(404)
        if target.suffix.lower() not in design_mod.PROTO_EXTS:
            return self.send_error(404)

        body = None
        try:
            if (query.get("pin") or [""])[0] == "1" and target.suffix.lower() in (".html", ".htm"):
                body = design_mod.splice_pin(target.read_bytes(), surface, target.stem)
        except OSError:
            return self.send_error(404)
        # `?pin=1` is additive only. No parameter subtracts a header, and every
        # other consumer gets the file's bytes verbatim — which is what keeps
        # impeccable live's own on-disk injection byte-exact.
        try:
            self._serve_file(
                target, body,
                csp=self._csp(design_mod.helper_origins(view.project.root, surface)),
                # Only the framed request is exempt: the iframe already supplies
                # the sandbox, and re-sandboxing there would break the pin
                # channel's postMessage back to the parent.
                sandbox=body is None and target.suffix.lower() in (".html", ".htm"))
        except OSError:
            self.send_error(404)

    def _assets(self, project: str, rest: str) -> None:
        """Serve one allowlisted project file to a prototype.

        A prototype wears the project's *real* shipping stylesheet. Copying it
        into `context/design/` would duplicate token values into git, and there
        is no build step to generate one — so pmview serves the project's own
        file, from an exact allowlist. Membership is a set lookup: nothing
        derived from the request path ever reaches a join.
        """
        view = self.views.get(project)
        if view is None:
            return self.send_error(404)
        if rest not in design_mod.stylesheet_allowlist(view.project.root):
            return self.send_error(404)
        base = view.project.root.resolve()
        try:
            target = (base / rest).resolve()
        except OSError:
            return self.send_error(404)
        if not target.is_relative_to(base) or not target.is_file():
            return self.send_error(404)
        try:
            self._serve_file(target, csp=self._csp([]))
        except OSError:
            self.send_error(404)

    def _request(self) -> None:
        """Queue a skill invocation for whichever agent drains next.

        **pmview does not run it.** It appends a line to a git-tracked file. A
        queue is not a launcher: nothing starts an agent, and a request waits
        until one drains — seconds if an agent is listening, tomorrow morning if
        it was filed at midnight. Spawning the agent here would turn a
        read-mostly board into an arbitrary-code-execution surface on a port a
        visited page can already POST to.
        """
        if not self._token_ok():
            return
        payload = self._json_body()
        if payload is None:
            return

        # Named-but-missing must 404. Falling back to "the first project" is fine
        # for a read and wrong for a write: with several roots mounted and a
        # same-named surface, a ruling lands permanently in the wrong log.
        named = str(payload.get("project") or "")
        view = self.views.get(named) if named else next(iter(self.views.values()), None)
        if view is None:
            return self._error("no such project", 404, code="no_project")

        root = view.project.root
        known = design_mod.installed_skills(root)
        if not known:
            return self._error(
                "cannot verify which skills are installed, so no request is "
                "accepted — copy the command instead", 503, code="skills_unknown")

        try:
            line = design_mod.construct_request(
                str(payload.get("skill") or ""), known, payload)
        except ValueError as exc:
            return self._error(str(exc), 400, code="bad_skill")

        try:
            design_mod.append(design_mod.requests_path(root), [line])
        except (OSError, ValueError) as exc:
            return self._error(f"could not queue the request: {exc}", 500,
                               code="append_failed")
        self._send({"queued": line["id"], "line": line})

    # --- static -------------------------------------------------------------

    def _static(self, path: str) -> None:
        # Serve from package resources, not a filesystem path: this reads the same
        # whether pmview runs from source, an installed wheel, or a zipapp (.pyz),
        # where the static files live inside the archive and have no real path.
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        parts = [p for p in rel.split("/") if p not in ("", ".")]
        # `\\` is a separator on Windows, so a raw `GET /..\\..\\secret` escapes
        # `static/` when running from source or a wheel. The zipapp reader is
        # immune and browsers normalise, but neither is a reason to allow it.
        if not parts or any(p == ".." or "\\" in p or ":" in p for p in parts):
            self.send_error(404)
            return
        try:
            data = resources.files("pmview").joinpath("static", *parts).read_bytes()
        except (FileNotFoundError, IsADirectoryError, OSError, ModuleNotFoundError):
            self.send_error(404)
            return
        if parts[-1] == "index.html":
            # The token reaches the page the only way that keeps it out of a URL,
            # a referrer and the operator's shell history: substituted into the
            # HTML this server just decided to serve.
            data = data.replace(b"__GW_TOKEN__", self.session_token.encode())
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(parts[-1])[0] or "text/plain")
        self.send_header("Content-Length", str(len(data)))
        # A board is a live view of local state; a cached index.html would also
        # pin a stale token.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def _is_loopback(host: str) -> bool:
    # NOT "": an empty host binds 0.0.0.0, which is exactly the case the design
    # routes must stay off for.
    return host in ("127.0.0.1", "localhost", "::1", "::ffff:127.0.0.1")


def _origins(host: str, port: int) -> frozenset[str]:
    """Every spelling of this bind a browser could send as `Origin`."""
    hosts = {host}
    if host in ("127.0.0.1", "localhost", "::1", ""):
        hosts |= {"127.0.0.1", "localhost", "[::1]"}
    return frozenset(f"http://{h}:{port}" for h in hosts if h)


class _Server(ThreadingHTTPServer):
    """`ThreadingHTTPServer` that does not shout when a client hangs up.

    `handle_error` lives on the *server*, not the handler — `socketserver` calls
    it for any exception escaping a request, and its default prints a full
    traceback into the terminal the operator is watching. A browser tab closed
    mid-response raises `BrokenPipeError`/`ConnectionResetError` there, and so
    does every `curl | head`. Those get one quiet line; a genuine bug still gets
    its traceback, which is wanted and harmless on a local single-user server.
    """

    verbose = False

    def handle_error(self, request, client_address) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, TimeoutError)):
            if self.verbose:
                print(f"  {client_address[0]} went away: {type(exc).__name__}")
            return
        super().handle_error(request, client_address)


def build_server(projects: list[Project], host: str, port: int,
                 memory_url: str, verbose: bool = False) -> ThreadingHTTPServer:
    handler = type("BoundHandler", (Handler,), {
        "views": {p.name: ProjectView(p) for p in projects},
        "memory": MemoryAPI(memory_url),
    })
    server = _Server((host, port), handler)
    # After the bind, not before: `port` may be 0 (ephemeral), and the origin a
    # browser sends carries the port it actually connected to.
    handler.allowed_origins = _origins(host, server.server_address[1])
    handler.design_enabled = _is_loopback(host)
    handler.session_token = secrets.token_urlsafe(24)
    server.verbose = verbose  # type: ignore[attr-defined]
    return server
