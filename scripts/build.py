#!/usr/bin/env python3
"""Build the distributable, install-only-what-you-need assets for this repo.

Two standalone artifacts land in ``dist/`` — nothing from ``dogfood/``, ``docs/``,
tests, or the vendored agent skills is included:

  * ``pmview.pyz``            — the GUI board as a single runnable zipapp
                               (``python pmview.pyz`` or ``./pmview.pyz``).
  * ``gw-skills-<ver>.tar.gz`` — the gw-* agentic-memory skills plus an
                               ``install.sh`` that drops them into a skills dir.

stdlib only, matching the project's zero-dependency invariant.

    python scripts/build.py            # both assets
    python scripts/build.py pyz        # just the zipapp
    python scripts/build.py skills     # just the skills tarball
    python scripts/build.py --version 1.2.3
"""

from __future__ import annotations

import argparse
import re
import shutil
import tarfile
import tempfile
import zipapp
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PMVIEW = REPO / "gui" / "pmview"
SKILLS = REPO / "skills"
INSTALLER = REPO / "scripts" / "install-skills.sh"
DIST = REPO / "dist"

_IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo")


def read_version() -> str:
    text = (PMVIEW / "__init__.py").read_text()
    match = re.search(r'^__version__\s*=\s*"([^"]+)"', text, re.M)
    return match.group(1) if match else "0.0.0"


def build_pyz() -> Path:
    """Stage pmview as a clean package and zip it into a runnable .pyz."""
    DIST.mkdir(exist_ok=True)
    target = DIST / "pmview.pyz"
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / "pmview"
        shutil.copytree(PMVIEW, staged, ignore=_IGNORE)
        zipapp.create_archive(
            Path(tmp),
            target=target,
            interpreter="/usr/bin/env python3",
            main="pmview.__main__:main",
            compressed=True,
        )
    target.chmod(0o755)
    print(f"  pmview.pyz            {target.stat().st_size / 1024:6.1f} KB  ({target})")
    return target


def build_skills(version: str) -> Path:
    """Tar the gw-* skills with an install.sh under a versioned top directory."""
    DIST.mkdir(exist_ok=True)
    top = f"gw-skills-{version}"
    target = DIST / f"{top}.tar.gz"
    skills = sorted(p for p in SKILLS.iterdir() if p.is_dir() and p.name.startswith("gw-"))
    with tarfile.open(target, "w:gz") as tar:
        tar.add(INSTALLER, arcname=f"{top}/install.sh")
        for skill in skills:
            tar.add(skill, arcname=f"{top}/skills/{skill.name}",
                    filter=lambda ti: None if "__pycache__" in ti.name else ti)
    print(f"  {top}.tar.gz  {target.stat().st_size / 1024:6.1f} KB  "
          f"({len(skills)} skills, {target})")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("what", nargs="?", default="all", choices=["all", "pyz", "skills"])
    parser.add_argument("--version", help="override the version (default: pmview.__version__)")
    args = parser.parse_args(argv)

    version = args.version or read_version()
    print(f"building graph-workflow assets (version {version}) → {DIST}/")
    if args.what in ("all", "pyz"):
        build_pyz()
    if args.what in ("all", "skills"):
        build_skills(version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
