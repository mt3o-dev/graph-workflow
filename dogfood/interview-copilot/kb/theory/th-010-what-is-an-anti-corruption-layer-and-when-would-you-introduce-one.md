---
id: th-010
question: "What is an anti-corruption layer and when would you introduce one?"
category: theory
difficulty: hard
expertise: senior
tags: [ddd, anti-corruption-layer, legacy-systems, integration]
---

An anti-corruption layer is a translation boundary you build between your bounded context and an external system — a legacy application, a third-party API, or another team's service — whose model doesn't match your own and that you don't control. Instead of letting that external model's concepts, naming, or quirks leak directly into your domain code, you put an adapter in front of it that translates the foreign representation into your own ubiquitous language and domain objects, and translates your outbound calls back into whatever shape the external system expects. I'd introduce one when integrating with, say, an old mainframe billing system that models 'accounts' in a way that conflicts with how my new service thinks about customers, or when consuming a vendor API that's likely to change its contract over time. The layer absorbs that instability and awkwardness in one place, usually through a facade, adapter, or dedicated translation service, so the rest of my codebase stays clean and only has to evolve when my own domain changes, not every time the upstream system's quirks shift.
