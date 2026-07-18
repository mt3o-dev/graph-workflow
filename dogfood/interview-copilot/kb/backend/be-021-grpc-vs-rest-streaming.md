---
id: be-021
question: "When would you choose gRPC over REST, and how does streaming work in gRPC?"
category: backend
difficulty: medium
expertise: mid
tags: [grpc, rest, streaming, api-design]
---

I reach for gRPC over REST for internal service-to-service communication, where both ends are systems I control and I want a strongly-typed contract, defined once in a .proto file and code-generated into every language on both client and server, plus binary Protocol Buffer serialization that's faster and smaller on the wire than JSON. REST remains my choice for public-facing or browser-facing APIs, where broad tool support, human readability, and HTTP infrastructure like caching proxies and CDNs matter more than raw performance. gRPC's other big advantage is native streaming built on HTTP/2: unary is a normal single request-response, but it also supports server streaming, where the server sends a sequence of messages back over one connection, like a live feed of updates; client streaming, where the client sends a sequence and gets one response, like an upload; and bidirectional streaming, where both sides send independently, useful for something like a chat or a real-time collaborative editor. That streaming support, combined with HTTP/2 multiplexing avoiding head-of-line blocking, is why gRPC fits real-time and high-throughput internal communication so well.
