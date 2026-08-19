#!/usr/bin/env bash
# Install the gw-* agentic-memory skills into an agent skills directory.
#
#   ./install.sh                       # → ~/.claude/skills
#   ./install.sh --target ~/.agent/skills
#   ./install.sh --target ./.claude/skills   # project-local
#   ./install.sh --pmview ./pmview.pyz       # also install the board tool
#
# Copies each gw-*/ skill folder into the target dir (overwriting same-named
# skills). Depends only on a POSIX shell + coreutils.
set -euo pipefail

TARGET="${HOME}/.claude/skills"
PMVIEW=""
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${HERE}/skills"

while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --target=*) TARGET="${1#*=}"; shift ;;
    --pmview) PMVIEW="$2"; shift 2 ;;
    --pmview=*) PMVIEW="${1#*=}"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ ! -d "$SRC" ]; then
  echo "error: no skills/ dir next to this installer ($SRC)" >&2
  exit 1
fi

mkdir -p "$TARGET"
count=0
for skill in "$SRC"/gw-*/; do
  [ -d "$skill" ] || continue
  name="$(basename "$skill")"
  rm -rf "${TARGET:?}/${name}"
  cp -R "$skill" "$TARGET/$name"
  count=$((count + 1))
done
echo "installed $count gw-* skills → $TARGET"

# Optionally drop the pmview board tool onto PATH.
if [ -n "$PMVIEW" ]; then
  if [ ! -f "$PMVIEW" ]; then
    echo "warning: --pmview '$PMVIEW' not found; skipping" >&2
  else
    bindir="${HOME}/.local/bin"
    mkdir -p "$bindir"
    cp "$PMVIEW" "$bindir/pmview"
    chmod +x "$bindir/pmview"
    echo "installed pmview → $bindir/pmview  (ensure $bindir is on PATH)"
  fi
fi
