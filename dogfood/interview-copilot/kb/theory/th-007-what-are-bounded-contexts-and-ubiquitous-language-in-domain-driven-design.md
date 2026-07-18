---
id: th-007
question: "What are bounded contexts and ubiquitous language in Domain-Driven Design?"
category: theory
difficulty: easy
expertise: junior
tags: [ddd, bounded-context, ubiquitous-language, domain-modeling]
---

A bounded context is an explicit boundary within which a particular domain model, including its terms and rules, applies consistently. The classic example is the word 'Customer' — in the billing context it might mean an entity with a payment method and outstanding balance, while in the support context it might mean someone with a ticket history and satisfaction score. Trying to force a single unified model of 'Customer' across an entire company usually produces a bloated, contradictory model, so DDD says: let each context have its own model, and define explicit translations at the boundaries between contexts. Ubiquitous language is the practice of using the exact same vocabulary in conversations, code, tests, and documentation within a bounded context, so that a domain expert and a developer can talk about 'reserving inventory' and both mean precisely the same thing, down to the class and method names in the code. The value of ubiquitous language is that it eliminates translation loss between business intent and implementation, which is usually where subtle requirement bugs come from.
