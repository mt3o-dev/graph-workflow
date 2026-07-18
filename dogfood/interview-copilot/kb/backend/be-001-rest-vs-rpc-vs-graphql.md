---
id: be-001
question: "What's the difference between REST, RPC, and GraphQL, and when would you choose each?"
category: backend
difficulty: medium
expertise: mid
tags: [api-design, rest, graphql, grpc]
---

REST, RPC, and GraphQL solve the same problem — exposing server capabilities over a network — with different tradeoffs. REST models the API around resources and uses HTTP verbs and status codes as the contract; it's cacheable, stateless, and plays well with HTTP infrastructure like CDNs and proxies, but it can lead to over- or under-fetching and chatty clients when the resource graph doesn't match the UI's needs. RPC (like gRPC or plain JSON-RPC) models the API around actions or procedures, which fits internal service-to-service calls where you want strongly typed contracts, low overhead, and streaming; it's less cacheable and less discoverable than REST. GraphQL lets the client specify exactly the shape of data it needs in one round trip, which is great for mobile clients and complex UIs with nested data, but it shifts complexity to the server — query cost analysis, N+1 resolvers, and caching become harder. In practice I use REST for public, resource-oriented APIs, gRPC for internal microservice communication, and GraphQL when a frontend team needs flexible aggregation across many backend services.
