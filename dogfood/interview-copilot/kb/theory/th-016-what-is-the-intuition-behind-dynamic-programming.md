---
id: th-016
question: "What is the intuition behind dynamic programming?"
category: theory
difficulty: medium
expertise: mid
tags: [algorithms, dynamic-programming, memoization, optimization]
---

Dynamic programming is really just recursion plus remembering answers you've already computed, applied to problems that have two properties: optimal substructure, meaning the best solution to the whole problem is built from best solutions to smaller subproblems, and overlapping subproblems, meaning a naive recursive solution would recompute the same subproblem many times. The classic example is Fibonacci: a plain recursive solution is exponential because fib(5) calls fib(4) and fib(3), and fib(4) calls fib(3) again, so the same subproblems get recomputed over and over. DP fixes this by caching results, either top-down with memoization, where you keep the recursive structure but check a cache before recomputing, or bottom-up with tabulation, where you build up a table of answers from the smallest subproblems to the largest, avoiding recursion overhead entirely. My process for spotting a DP problem is asking: can I define the answer to a problem of size n in terms of the answer to smaller sizes, and would a brute-force recursive approach revisit the same subproblem multiple times? If both are yes, I sketch the recurrence relation first, then decide between memoization and tabulation based on whether I need all subproblems or can prune some.
