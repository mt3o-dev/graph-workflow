---
id: fe-022
question: "How do you prevent XSS attacks on the frontend, and what role does a Content Security Policy play?"
category: frontend
difficulty: hard
expertise: senior
tags: [security, xss, csp, sanitization]
---

XSS happens when untrusted input ends up executed as script in another user's browser. The main defense is treating all user input as data, never markup — using APIs like `textContent` instead of `innerHTML`, and letting frameworks like React escape interpolated values by default rather than reaching for `dangerouslySetInnerHTML`. When I do need to render HTML from user content, like a rich text field, I run it through a sanitizer like DOMPurify server- or client-side rather than trusting it directly. I'm also careful with URLs, since `javascript:` URLs in an href or a redirect built from a query param are a common injection vector. Content Security Policy is the defense-in-depth layer on top of that: it's a response header that tells the browser which sources scripts, styles, and other resources are allowed to load from, so even if an attacker manages to inject a `<script>` tag, a policy like `script-src 'self'` blocks it from executing because it didn't come from an allowed origin, and disallowing `unsafe-inline` blocks inline injected scripts entirely. CSP won't fix a sanitization bug, but it meaningfully limits the blast radius when one slips through.
