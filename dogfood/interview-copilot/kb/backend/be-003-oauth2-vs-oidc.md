---
id: be-003
question: "What's the difference between OAuth2 and OpenID Connect?"
category: backend
difficulty: medium
expertise: mid
tags: [authentication, authorization, oauth2, oidc]
---

OAuth2 is an authorization framework — it lets a user grant a third-party application limited access to their resources on another service, producing an access token that proves "this app may call this API on the user's behalf." It says nothing inherently about who the user is. OpenID Connect (OIDC) is a thin identity layer built on top of OAuth2: it adds a standardized ID token, which is a signed JWT containing claims about the authenticated user — subject, issuer, expiry, email, and so on — plus a UserInfo endpoint. So OAuth2 answers "can this app do X," and OIDC answers "who is this user." In practice, when I build "Sign in with Google" or an internal SSO flow, I'm using OIDC, which under the hood runs an OAuth2 authorization code flow and returns both an access token and an ID token. A common mistake is using a bare OAuth2 access token as proof of identity — it wasn't designed for that, isn't guaranteed to be a JWT, and doesn't guarantee audience validation the way an OIDC ID token does.
