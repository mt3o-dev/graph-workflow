---
id: fe-013
question: "How does browser HTTP caching work with Cache-Control and ETag headers?"
category: frontend
difficulty: medium
expertise: mid
tags: [http, caching, performance, browser]
---

HTTP caching is mostly controlled through the `Cache-Control` header. `max-age` tells the browser how long it can reuse a response without even asking the server, which is ideal for hashed static assets — I'll set something like a year-long `max-age` with `immutable` on a file named `app.a1b2c3.js`, since a content hash in the filename means any change produces a new URL. For resources that might change but I still want to avoid re-downloading unnecessarily, I use validation instead: the server sends an `ETag`, a fingerprint of the content, and next time the browser sends `If-None-Match` with that value; if it still matches, the server replies `304 Not Modified` with no body, saving bandwidth but still requiring a round trip. `Last-Modified`/`If-Modified-Since` works similarly but with a timestamp instead of a hash. For HTML documents I usually set `Cache-Control: no-cache` so the browser always revalidates, since I want users to get the latest app shell that references the freshly hashed assets. Getting this split right — long-cache hashed assets, revalidate HTML — is most of what a fast repeat-visit load depends on.
