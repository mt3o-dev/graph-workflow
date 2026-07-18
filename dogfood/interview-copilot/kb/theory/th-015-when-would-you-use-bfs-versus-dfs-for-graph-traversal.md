---
id: th-015
question: "When would you use BFS versus DFS for graph traversal?"
category: theory
difficulty: medium
expertise: mid
tags: [graphs, algorithms, bfs, dfs]
---

Both breadth-first and depth-first search visit every reachable node, but they explore in a different order, which makes them suited to different problems. BFS explores level by level using a queue, visiting all neighbors of a node before moving further out, which makes it the natural choice whenever I need the shortest path in an unweighted graph, since the first time you reach a node is guaranteed to be via the fewest edges. I'd use BFS for things like finding the shortest number of hops between two people in a social graph, or the minimum number of moves in a puzzle. DFS explores as far as possible down one branch using a stack or recursion before backtracking, which uses less memory in wide graphs since it doesn't need to hold an entire frontier, and it's naturally suited to problems like detecting cycles, topological sorting, finding connected components, or exhaustively exploring all paths, like solving a maze or checking if a solution exists in a decision tree. In practice, if the question is about distance or shortest path, I reach for BFS; if it's about reachability, structure, or exhaustive exploration, I reach for DFS.
