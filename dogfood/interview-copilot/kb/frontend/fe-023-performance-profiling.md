---
id: fe-023
question: "Walk me through how you'd profile a janky web app to find the performance bottleneck."
category: frontend
difficulty: hard
expertise: senior
tags: [performance, profiling, devtools, debugging]
---

I start by reproducing the jank with the Chrome DevTools Performance panel recording, since guessing at a bottleneck from reading code usually points me in the wrong direction. I look at the flame chart for long tasks on the main thread, anything over 50ms, and check whether the time is going into scripting, layout, or paint — that tells me whether it's a JS problem or a rendering problem. For a JS-heavy task I'll drill into the call tree to find the actual function eating the time, which is often something surprising like an accidental O(n squared) loop, or a re-render cascading through a large component tree because a prop reference changed identity every render. For a layout-heavy problem I check for forced synchronous layout, reading `offsetHeight` right after a style write inside a loop. I also profile with the CPU throttled to 4x or 6x slowdown, since a fast dev machine hides problems that show up on real user hardware. Once I've found the actual hot path, I fix that one thing and re-record to confirm the improvement, rather than optimizing speculatively across the whole codebase.
