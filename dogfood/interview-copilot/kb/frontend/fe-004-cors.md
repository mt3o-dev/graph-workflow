---
id: fe-004
question: "What is CORS, and why do browsers enforce it?"
category: frontend
difficulty: easy
expertise: junior
tags: [cors, security, http, browser]
---

CORS, Cross-Origin Resource Sharing, is a browser security mechanism that restricts scripts on one origin from reading responses from a different origin unless the server explicitly allows it. The same-origin policy is the default; CORS is the opt-in relaxation of it. When my frontend on `app.example.com` calls an API on `api.example.com`, the browser sends the request, but before letting my JavaScript read the response it checks headers like `Access-Control-Allow-Origin` on the response. For anything beyond a simple GET — custom headers, non-standard content types, methods like PUT or DELETE — the browser first sends an OPTIONS preflight request to ask permission. It's important to remember CORS is enforced by the browser, not the server; the request still hits the server and can still have side effects, the browser just blocks the JavaScript from reading the response if headers don't match. That's why CORS isn't a substitute for real authentication or CSRF protection, it's purely about which frontends are allowed to read which responses.
