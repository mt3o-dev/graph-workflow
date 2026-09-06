#!/usr/bin/env python3
"""Pin impeccable `live` to one prototype, and tear it down again.

    live_setup.py preflight --surface S [--screen X]
    live_setup.py arm       --surface S --screen X
    live_setup.py teardown  --surface S

Why this is a script and not a paragraph in a skill: getting it wrong does not
fail loudly, it **edits the real application**.

`live-wrap`'s `findSourceFile` walks the whole app root and returns the *first*
match, and the rung-2 contract mandates the project's real class names — so a
pick on `.item` inside a prototype can resolve to a shipping file. Confining the
app root is the only thing standing between a variant and production code.

The mechanism, verified in impeccable's own source:

    isAppRoot(dir)  ->  hasDevConfig(dir) || exists(dir/.impeccable/live/config.json)
                        "A directory already configured for live IS an app root"

`walkUp` starts at the target's directory and stops at the first hit. So writing
`context/design/<surface>/.impeccable/live/config.json` makes the surface
directory the app root, which has three consequences that all matter:

1. `resolveFramework` finds no dev config there and returns **static-html**,
   whose `inject.kind` is `tag` — the only kind that reads `config.files` at all.
   Without this, a SvelteKit or Next app root selects the **adapter** branch,
   which returns before `config.files` is ever consulted, and the file list is
   inert.
2. `findSourceFile`'s walk is confined to the surface directory, so a wrap
   physically cannot reach the real app.
3. `config.files` names exactly one screen, so injection touches one file rather
   than dirtying every prototype in the repo with a session token.

Teardown is not tidiness either: prototypes are git-tracked, and a crashed
session leaves an `impeccable-live-start` marker in one.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
#: Any of these in a directory makes impeccable treat it as an app root on its
#: own, which would defeat the pin.
DEV_CONFIG_HINTS = (
    "vite.config.js", "vite.config.ts", "svelte.config.js", "next.config.js",
    "next.config.mjs", "nuxt.config.ts", "astro.config.mjs", "package.json",
)


def surface_dir(root: Path, surface: str) -> Path:
    if not SLUG_RE.fullmatch(surface or ""):
        sys.exit(f"not a surface slug: {surface!r}")
    return root / "context" / "design" / surface


def check_screen(screen: str) -> str:
    """A screen id is one slug, never a path.

    Without this, `--screen ../../../../src/index` writes a live config naming
    a file outside the surface — pointing impeccable's injector at the real
    application, which is the single thing this script exists to prevent.
    """
    if not SLUG_RE.fullmatch(screen or ""):
        sys.exit(f"not a screen id: {screen!r} (one slug, no path separators)")
    return screen


def preflight(root: Path, directory: Path, screen: str | None) -> dict:
    problems: list[str] = []
    if not directory.is_dir():
        problems.append(f"no surface directory at {directory.relative_to(root)}")
    if screen:
        target = directory / "screens" / f"{screen}.html"
        if not target.is_file():
            problems.append(f"no prototype at screens/{screen}.html")
        else:
            html = target.read_text(encoding="utf-8", errors="replace")
            if "</body>" not in html:
                problems.append(f"screens/{screen}.html has no </body> — "
                                "impeccable's insertion anchor")
            if re.search(r"GENERATED FILE|DO NOT EDIT", html[:300]):
                problems.append(f"screens/{screen}.html carries a generated-file "
                                "header; live refuses to write into one")
    # A dev config inside the surface directory would make it an app root for the
    # wrong reason and drag a bundler's framework adapter back in.
    stray = [h for h in DEV_CONFIG_HINTS if (directory / h).exists()]
    if stray:
        problems.append(f"dev config inside the surface directory ({', '.join(stray)}) "
                        "— the pin would select a framework adapter instead of static-html")
    return {"ok": not problems, "problems": problems}


def arm(root: Path, directory: Path, screen: str) -> dict:
    check = preflight(root, directory, screen)
    if not check["ok"]:
        return check
    live = directory / ".impeccable" / "live"
    live.mkdir(parents=True, exist_ok=True)
    (live / "config.json").write_text(json.dumps({
        "files": [f"screens/{screen}.html"],
        "insertBefore": "</body>",
        "commentSyntax": "html",
        "cspChecked": True,
    }, indent=2) + "\n", encoding="utf-8")
    return {
        "ok": True,
        "app_root": str(directory.relative_to(root)),
        "files": [f"screens/{screen}.html"],
        "note": "pass --file screens/%s.html on EVERY wrap call — an unpinned wrap "
                "in this lane is a defect, not a shortcut." % screen,
        "open": f"http://127.0.0.1:8766/proto/<project>/{directory.name}/screens/{screen}.html",
        "helper_port": _helper_port(directory, root),
    }


def _helper_port(directory: Path, root: Path):
    for candidate in (directory / ".impeccable" / "live" / "inject-journal.json",
                      root / ".impeccable" / "live" / "inject-journal.json"):
        try:
            return json.loads(candidate.read_text(encoding="utf-8")).get("port")
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
    return None


def teardown(root: Path, directory: Path) -> dict:
    removed = []
    config = directory / ".impeccable" / "live" / "config.json"
    if config.is_file():
        config.unlink()
        removed.append(str(config.relative_to(root)))
    live = directory / ".impeccable" / "live"
    for name in ("roots.json", "inject-journal.json"):
        path = live / name
        if path.is_file():
            path.unlink()
            removed.append(str(path.relative_to(root)))
    for folder in (live, live.parent):
        try:
            folder.rmdir()
        except OSError:
            break

    # Residue in a git-tracked prototype is a teardown FAILURE, not a warning: a
    # crashed session leaves a session token in a file that ships.
    residue = []
    for path in sorted((directory / "screens").glob("*.html")) if (directory / "screens").is_dir() else []:
        text = path.read_text(encoding="utf-8", errors="replace")
        for marker in ("impeccable-live-start", "data-impeccable-csp-original",
                       "data-p-", "--p-"):
            if marker in text:
                residue.append(f"{path.relative_to(root)}: {marker}")
    dirty = subprocess.run(
        ["git", "-C", str(root), "status", "--porcelain", "context/design/"],
        capture_output=True, text=True, timeout=20).stdout.strip()
    return {"ok": not residue, "removed": removed, "residue": residue,
            "git_status": dirty.splitlines()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("preflight", "arm", "teardown"))
    parser.add_argument("--surface", required=True)
    parser.add_argument("--screen")
    parser.add_argument("--root", default=".")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    directory = surface_dir(root, args.surface)

    if args.command == "arm":
        if not args.screen:
            sys.exit("arm needs --screen")
        result = arm(root, directory, check_screen(args.screen))
    elif args.command == "teardown":
        result = teardown(root, directory)
    else:
        result = preflight(root, directory,
                           check_screen(args.screen) if args.screen else None)

    print(json.dumps(result, indent=2))
    return 0 if result.get("ok", True) else 1


if __name__ == "__main__":
    raise SystemExit(main())
