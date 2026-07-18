---
id: th-006
question: "Give a high-level explanation of how the Raft consensus algorithm works."
category: theory
difficulty: hard
expertise: senior
tags: [distributed-systems, consensus, raft, replication]
---

Raft was designed specifically to be more understandable than Paxos while providing the same guarantee: a cluster of nodes agrees on a single, ordered log of operations even if some nodes fail. It splits the problem into three parts. Leader election: nodes start as followers, and if a follower doesn't hear from a leader within a randomized timeout, it becomes a candidate, increments a term number, and requests votes; whoever gets a majority becomes leader for that term, and the randomized timeouts prevent repeated split votes. Log replication: once elected, the leader accepts writes from clients, appends them to its own log, and replicates them to followers; an entry is considered committed once a majority of nodes have it, at which point it's safe to apply to the state machine. Safety: Raft ensures a new leader always has all previously committed entries by requiring a candidate's log to be at least as up to date as a majority of voters before it can win, which prevents committed data from being lost across leader changes. This majority-quorum approach is why an odd-sized cluster like three or five nodes can tolerate one or two failures respectively.
