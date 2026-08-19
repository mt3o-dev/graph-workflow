"""pmview — a project-management perspective over graph-workflow artifacts.

Reads the lifecycle folders (`context/changes`, `context/archive`) and the memory
store, joins them, and serves a board of changes by stage plus an issue queue.
Writes are delegated to the agentic-memory-system GUI API so the safety invariant
stays enforced in exactly one place.
"""

__version__ = "0.1.0"

__all__ = ["board", "graph", "lifecycle", "memory", "server"]
