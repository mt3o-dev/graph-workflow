---
id: fe-017
question: "What can service workers do, and how do you design an offline strategy for a PWA?"
category: frontend
difficulty: medium
expertise: mid
tags: [service-workers, pwa, offline, caching]
---

A service worker is a script that runs in a separate thread from the page, sits between the network and the browser, and can intercept fetch requests, cache responses, and run even when the page isn't open, which is what enables offline support and push notifications. For an offline strategy I pick a caching strategy per resource type: for the app shell, HTML and core JS/CSS, I use cache-first or stale-while-revalidate so the app loads instantly from cache and updates in the background; for API data I usually use network-first with a cache fallback, so users get fresh data when online but something usable when offline. I register the service worker, listen for the `install` event to pre-cache the shell, and `fetch` events to serve from cache or network based on that strategy, being careful to version cache names so old caches get cleaned up on activate. For a full PWA I'd pair that with a web app manifest for installability, icons, and theme color. The main pitfall is stale content getting stuck in cache, so I always build in a clear update-and-reload path rather than trusting users to hard refresh.
