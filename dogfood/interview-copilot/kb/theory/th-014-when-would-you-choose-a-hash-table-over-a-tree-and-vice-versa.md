---
id: th-014
question: "When would you choose a hash table over a tree, and vice versa?"
category: theory
difficulty: easy
expertise: junior
tags: [data-structures, hash-tables, trees, algorithms]
---

A hash table gives average O(1) insert, lookup, and delete by computing a hash of the key and mapping it to a bucket, so I reach for it when I need fast key-based access and don't care about ordering, like caching, deduplication, or counting occurrences. The catch is that this O(1) is average-case only — a bad hash function or too many collisions can degrade it toward O(n) worst case, and hash tables don't maintain any order, so you can't efficiently ask for 'all keys between X and Y' or 'the smallest key.' A balanced tree, like a red-black tree or a B-tree, gives O(log n) for the same operations, which is slower on average, but it maintains sorted order, so range queries, finding the minimum or maximum, and in-order traversal are all efficient and predictable. That's why database indexes are usually B-trees rather than hash tables — queries like 'give me everything between these two dates' need ordering. So my rule of thumb is: hash table for pure point lookups, tree when I need ordering, range queries, or worst-case guarantees.
