---
id: fe-009
question: "What is prototypal inheritance, and how does it differ from classical inheritance?"
category: frontend
difficulty: medium
expertise: mid
tags: [javascript, prototypes, inheritance, oop]
---

JavaScript objects inherit through a prototype chain rather than classes copying behavior at compile time. Every object has an internal `[[Prototype]]` link, accessible via `Object.getPrototypeOf`, and when you access a property that isn't found on the object itself, the engine walks up that chain until it finds it or hits `null`. `class` syntax in modern JS is sugar over this same mechanism — methods defined in a class body end up on the prototype, shared by every instance, rather than duplicated per object. The practical difference from classical inheritance is that prototypes are live objects you can modify at runtime, and delegation happens per-lookup rather than through a fixed compile-time hierarchy, so you can do things like `Object.create(someObject)` to build ad hoc inheritance without ever defining a class. It's also why methods are memory-efficient — a thousand instances share one prototype method rather than each carrying their own copy — while instance-specific data lives on the object itself, set in the constructor.
