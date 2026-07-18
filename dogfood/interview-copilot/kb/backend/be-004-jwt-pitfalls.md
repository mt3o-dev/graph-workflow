---
id: be-004
question: "What are the common pitfalls when using JWTs for authentication?"
category: backend
difficulty: medium
expertise: mid
tags: [authentication, jwt, security]
---

JWTs are convenient because they're self-contained and stateless, but there are several pitfalls I watch for. First, algorithm confusion: never trust the "alg" header from the token itself — pin the expected algorithm server-side, because accepting "none" or letting an attacker switch RS256 to HS256 using the public key as the HMAC secret is a classic exploit. Second, they're hard to revoke: once issued, a JWT is valid until it expires, so I keep access tokens short-lived, typically minutes, and pair them with a revocable refresh token or a server-side denylist for emergencies. Third, don't put sensitive data in the payload — it's base64-encoded, not encrypted, and readable by anyone who intercepts it. Fourth, always validate issuer, audience, and expiry, not just the signature. Fifth, storage on the client matters: storing JWTs in localStorage exposes them to XSS, so I prefer httpOnly, SameSite cookies for browser clients. Finally, key rotation needs a "kid" header and a JWKS endpoint so old tokens don't break when you rotate signing keys.
