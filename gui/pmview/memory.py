"""Client for the agentic-memory-system GUI API — the one write path.

Every mutation the board offers (edit a body, add an edge, capture an artifact,
resolve a flagged node, move a tier) is forwarded to `agentic-memory-gui` on
127.0.0.1:8765 rather than applied to the store here. That server folds trust from
the journal, enforces the goal-first write rules, and gates lifetime promotion on
explicit human confirmation. Going around it would produce exactly the unguarded
second surface the workflow's safety invariant rules out.

When the memory server is not running the board still reads the store off disk and
serves the whole navigation surface; writes report `memory_unavailable` instead of
silently doing something weaker.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://127.0.0.1:8765"


class MemoryUnavailable(RuntimeError):
    """The memory GUI API could not be reached."""


class MemoryError_(RuntimeError):
    """The memory GUI API rejected the request."""

    def __init__(self, message: str, status: int) -> None:
        super().__init__(message)
        self.status = status


class MemoryAPI:
    def __init__(self, base_url: str = DEFAULT_BASE_URL, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: dict | None = None) -> dict | list:
        url = f"{self.base_url}{path}"
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read().decode()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            try:
                message = json.loads(detail).get("error", detail)
            except json.JSONDecodeError:
                message = detail or exc.reason
            raise MemoryError_(str(message), exc.code) from exc
        except (urllib.error.URLError, OSError) as exc:
            raise MemoryUnavailable(
                f"cannot reach the memory GUI API at {self.base_url} "
                f"(start it with `uv run agentic-memory-gui`): {exc}"
            ) from exc
        return json.loads(body) if body else {}

    def get(self, path: str) -> dict | list:
        return self._request("GET", path)

    def post(self, path: str, payload: dict) -> dict | list:
        return self._request("POST", path, payload)

    def available(self) -> bool:
        try:
            self.get("/api/health")
        except (MemoryUnavailable, MemoryError_):
            return False
        return True

    # --- the operations the board offers, named so call sites read as intent ---

    def health(self) -> dict:
        return self.get("/api/health")  # type: ignore[return-value]

    def review_queue(self) -> list:
        return self.get("/api/review")  # type: ignore[return-value]

    def review_guidance(self, node_id: str) -> dict:
        return self.get(f"/api/review/{node_id}/guidance")  # type: ignore[return-value]

    def resolve_review(self, node_id: str, payload: dict) -> dict:
        return self.post(f"/api/review/{node_id}/resolve", payload)  # type: ignore[return-value]

    def edit_body(self, node_id: str, body: str, reason: str) -> dict:
        return self.post(f"/api/nodes/{node_id}/body", {"body": body, "reason": reason})  # type: ignore[return-value]

    def set_tier(self, node_id: str, payload: dict) -> dict:
        return self.post(f"/api/nodes/{node_id}/tier", payload)  # type: ignore[return-value]

    def create_edge(self, payload: dict) -> dict:
        return self.post("/api/edges", payload)  # type: ignore[return-value]

    def create_artifact(self, payload: dict) -> dict:
        return self.post("/api/nodes", payload)  # type: ignore[return-value]

    def changes(self) -> list:
        return self.get("/api/changes")  # type: ignore[return-value]

    def recall(self, goal_id: str, query: str) -> list:
        from urllib.parse import urlencode

        return self.get("/api/recall?" + urlencode({"goal": goal_id, "query": query}))  # type: ignore[return-value]
