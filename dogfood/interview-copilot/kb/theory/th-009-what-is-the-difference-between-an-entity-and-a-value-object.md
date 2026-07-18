---
id: th-009
question: "What is the difference between an entity and a value object?"
category: theory
difficulty: easy
expertise: junior
tags: [ddd, entities, value-objects, domain-modeling]
---

An entity is defined by its identity, not its attributes — two entities can have exactly the same data and still be different things, and one entity can change all of its attributes over time and still be the same thing, because what makes it 'the same' is a stable identifier like a database ID. A User with id 42 is still the same User even after they change their email and name. A value object, on the other hand, has no identity at all — it's defined entirely by its attributes, so two value objects with the same values are interchangeable and considered equal. Money represented as an amount and currency, or an Address made of street, city, and postal code, are classic value objects: if two Money instances both hold $10 USD, it doesn't matter which specific instance you use. Value objects are also typically immutable — instead of mutating one, you create a new one, which avoids a whole class of aliasing bugs. I lean toward modeling something as a value object whenever possible, because immutability and equality-by-value make code easier to reason about than tracking identity.
