---
id: th-013
question: "What is Big-O notation, and what does amortized analysis mean?"
category: theory
difficulty: easy
expertise: junior
tags: [algorithms, big-o, complexity-analysis, amortized-analysis]
---

Big-O notation describes how an algorithm's running time or space usage grows as the input size grows, focusing on the dominant term and ignoring constant factors, because what matters for scalability is the shape of the growth curve, not the exact runtime on one machine. O(1) means constant time regardless of input size, O(log n) grows very slowly, like binary search halving the search space each step, O(n) is linear, O(n log n) is what you get from efficient sorting, and O(n squared) means nested loops over the same input, which gets painful fast as data grows. Amortized analysis comes up when an operation is usually cheap but occasionally expensive, and you want to describe the average cost over a sequence of operations rather than the worst single case. The textbook example is a dynamic array like Java's ArrayList or a Python list: appending is usually O(1), but occasionally the array is full and needs to be resized and copied, which is O(n) for that one call. Because resizing happens rarely and doubles the capacity, the cost is spread out, or amortized, over many appends, giving an amortized O(1) per append even though a single append can occasionally spike.
