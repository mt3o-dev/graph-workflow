---
id: fe-002
question: "How does `this` binding work in JavaScript, and how do arrow functions change it?"
category: frontend
difficulty: easy
expertise: junior
tags: [javascript, this, arrow-functions, scope]
---

`this` in JavaScript is determined by how a function is called, not where it's defined — that's the core rule people trip over. Call it as a method, `obj.method()`, and `this` is `obj`. Call it standalone and `this` is undefined in strict mode or the global object otherwise. Use `call`, `apply`, or `bind` and you explicitly set `this`. Construct it with `new` and `this` is the newly created instance. Arrow functions break that pattern entirely — they don't have their own `this` at all, they lexically inherit it from the enclosing scope at definition time, so they're immune to the usual method-extraction bugs. That's why I default to arrow functions for callbacks inside class methods or React components, so I don't lose the surrounding `this` when the callback fires later, say inside a `setTimeout` or an event listener. The one place I avoid arrow functions is object methods that need dynamic `this`, since an arrow method would just capture the outer scope instead of the object.
