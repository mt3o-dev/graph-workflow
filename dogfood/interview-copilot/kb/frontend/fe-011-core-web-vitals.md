---
id: fe-011
question: "What are the Core Web Vitals, and how would you improve them on a slow page?"
category: frontend
difficulty: medium
expertise: mid
tags: [performance, core-web-vitals, lcp, inp, cls]
---

Core Web Vitals are Google's metrics for real-world user experience: LCP measures how long the largest visible content element takes to render, INP measures responsiveness to user interactions, and CLS measures visual stability, how much elements shift unexpectedly. For a slow LCP, I'd check whether the hero image or main text block is render-blocked by unoptimized fonts or a slow API call, and fix it with preloading the LCP resource, using `fetchpriority=high`, and serving properly sized, compressed images. For INP, the usual culprit is long JavaScript tasks blocking the main thread during a click or keystroke, so I'd break up long tasks, defer non-critical work, and avoid heavy synchronous work in event handlers. For CLS, I'd reserve space for images and ads with explicit width and height or `aspect-ratio`, and avoid injecting content above existing content after load. I treat these as a real UX signal, not just a Lighthouse score to chase — they roughly map to "does it look ready," "does it feel responsive," and "does it stay put."
