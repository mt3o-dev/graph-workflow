#!/usr/bin/env bash
# Register the memory-db clean/smudge filter for this clone.
# The coffer store (dogfood/coffer/context/memory-graph.db) is committed as a
# legible text dump via .gitattributes; without this filter registered, git
# operations touching that path will FAIL (filter is marked required — better
# loud than a binary sqlite blob slipping into history).
# Usage: ./scripts/setup-memory-db-filter.sh /path/to/agentic-memory-system
set -euo pipefail
AMS="${1:?usage: $0 /path/to/agentic-memory-system}"
PY="$AMS/.venv/bin/python"
[ -x "$PY" ] || { echo "no venv at $AMS — run 'uv sync' there first"; exit 1; }
git config filter.memory-db.clean  "$PY $AMS/scripts/dump_db.py"
git config filter.memory-db.smudge "$PY $AMS/scripts/restore_db.py"
git config filter.memory-db.required true
git config diff.memory-db.textconv "$PY $AMS/scripts/dump_db.py <"
echo "memory-db filter registered (clean/smudge via $AMS)."
