"""`python -m pmview` — serve the project board for one or more projects."""

from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from .memory import DEFAULT_BASE_URL, MemoryAPI
from .server import build_server, discover


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pmview",
        description="Project-management board over the graph-workflow memory artifacts.",
    )
    parser.add_argument(
        "root", nargs="*", type=Path, default=[Path.cwd()],
        help="project directories (each holding a context/ tree), or a parent of them",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument(
        "--memory-url", default=DEFAULT_BASE_URL,
        help="agentic-memory-system GUI API, used for every write (default: %(default)s)",
    )
    parser.add_argument("--open", action="store_true", help="open a browser window")
    parser.add_argument("-v", "--verbose", action="store_true", help="log every request")
    args = parser.parse_args(argv)

    projects = discover([Path(p) for p in args.root])
    if not projects:
        roots = ", ".join(str(p) for p in args.root)
        print(f"no project with a context/ directory found under: {roots}", file=sys.stderr)
        return 1

    url = f"http://{args.host}:{args.port}"
    server = build_server(projects, args.host, args.port, args.memory_url, args.verbose)

    print(f"pmview → {url}")
    for project in projects:
        store = project.store
        print(f"  {project.name}: {project.root}" + ("" if store else "  (no memory store)"))
    if MemoryAPI(args.memory_url).available():
        print(f"  writes → {args.memory_url}")
    else:
        print(f"  writes → {args.memory_url} (not running; the board is read-only until it is)")

    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
