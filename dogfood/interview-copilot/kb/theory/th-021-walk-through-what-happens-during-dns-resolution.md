---
id: th-021
question: "Walk through what happens during DNS resolution."
category: theory
difficulty: easy
expertise: junior
tags: [networking, dns, resolution, caching]
---

When I type a domain name into a browser, the first step is checking local caches: the browser's own DNS cache, then the OS-level resolver cache, since if it's already there, resolution finishes immediately with no network traffic. If it's a miss, the OS forwards the query to a configured recursive resolver, often the ISP's resolver or a public one like Google's 8.8.8.8 or Cloudflare's 1.1.1.1. The recursive resolver then does the actual work on the client's behalf: it asks a root nameserver, which doesn't know the answer but points it to the correct top-level-domain nameserver, for example the one for '.com'; the TLD nameserver in turn points it to the authoritative nameserver for the specific domain; and finally that authoritative nameserver returns the actual IP address, whether an A record for IPv4 or an AAAA record for IPv6. The recursive resolver caches this result for the duration of the record's TTL and returns it to the client. Only after this whole chain completes does the browser actually open a TCP connection, and if it's HTTPS, perform a TLS handshake, to the resolved IP address. In practice this whole DNS chain is usually fast because of aggressive caching at every layer, but a DNS misconfiguration or an expired TTL propagating slowly is a very common source of 'it works for me but not for them' bugs.
