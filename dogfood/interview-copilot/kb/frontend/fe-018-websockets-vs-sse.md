---
id: fe-018
question: "When would you choose WebSockets over Server-Sent Events, and vice versa?"
category: frontend
difficulty: medium
expertise: mid
tags: [websockets, sse, real-time, networking]
---

I reach for Server-Sent Events when the data only needs to flow one way, server to client — live notifications, a progress feed, price ticker updates — because SSE is just a long-lived HTTP response the browser auto-reconnects for me via `EventSource`, and it works over plain HTTP with none of the extra handshake or infrastructure WebSockets need, including working fine through most proxies and load balancers by default. WebSockets earn their complexity when I need true bidirectional, low-latency communication — a chat app, a collaborative editor, multiplayer features — where the client also needs to send frequent messages back over the same persistent connection rather than issuing separate HTTP requests. WebSockets also support binary frames, which SSE doesn't. The cost is WebSockets need more careful infrastructure handling — sticky sessions or a pub-sub backplane behind a load balancer, custom reconnect and heartbeat logic — while SSE mostly just works with standard HTTP tooling. So my rule of thumb is: one-directional server push, SSE; two-way real-time interaction, WebSockets.
