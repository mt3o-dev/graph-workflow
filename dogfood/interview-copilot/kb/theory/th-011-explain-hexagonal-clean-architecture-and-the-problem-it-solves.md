---
id: th-011
question: "Explain hexagonal / clean architecture and the problem it solves."
category: theory
difficulty: medium
expertise: mid
tags: [architecture, hexagonal-architecture, clean-architecture, ports-and-adapters]
---

Hexagonal architecture, also called ports and adapters, and clean architecture are variations on the same core idea: put your business logic at the center, completely isolated from frameworks, databases, and UI, and make everything else depend inward on it rather than the other way around. The domain layer defines 'ports,' which are interfaces expressing what it needs, like a Repository or a PaymentGateway, without knowing or caring how they're implemented. 'Adapters' are the concrete implementations that plug into those ports — a Postgres repository, a Stripe gateway, a REST controller — and they live on the outside, depending on the domain rather than the domain depending on them. The problem this solves is that in a typical layered app, business logic ends up tangled with ORM calls, HTTP request objects, or framework annotations, which makes it slow to test and painful to swap infrastructure. With ports and adapters, I can unit test the domain with in-memory fakes with zero framework overhead, and swapping databases or messaging systems becomes a matter of writing a new adapter rather than rewriting business rules.
