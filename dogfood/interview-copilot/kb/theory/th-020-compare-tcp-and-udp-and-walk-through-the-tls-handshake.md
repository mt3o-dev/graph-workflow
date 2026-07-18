---
id: th-020
question: "Compare TCP and UDP, and walk through the TLS handshake."
category: theory
difficulty: hard
expertise: senior
tags: [networking, tcp, udp, tls]
---

TCP is connection-oriented: it establishes a session via a three-way handshake, SYN, SYN-ACK, ACK, then guarantees ordered, reliable delivery through sequence numbers, acknowledgments, and retransmission of lost packets, plus flow and congestion control to avoid overwhelming the receiver or the network. That reliability costs latency and overhead, which is why it's the right choice for things like HTTP, file transfer, or anything where losing or reordering data is unacceptable. UDP is connectionless: it just fires packets with no handshake, no ordering guarantee, and no retransmission, which makes it much lower latency and lower overhead, so it's used for DNS lookups, video streaming, and real-time gaming, where a dropped packet is better handled by the application, like skipping a video frame, than by waiting for a retransmit. TLS typically runs on top of TCP to add encryption and authentication. In TLS 1.2 the handshake is: client sends a ClientHello with supported ciphers, server responds with ServerHello, its certificate, and a key exchange message, the client verifies the certificate against a trusted CA, both sides derive a shared symmetric session key via something like Diffie-Hellman, and then a Finished message confirms the handshake before encrypted application data flows. TLS 1.3 streamlines this to one round trip by having the client guess the key exchange parameters upfront, cutting a full round trip of latency compared to 1.2.
