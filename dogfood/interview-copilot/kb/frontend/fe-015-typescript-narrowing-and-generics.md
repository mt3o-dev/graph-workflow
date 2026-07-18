---
id: fe-015
question: "How does TypeScript's type narrowing work, and how do generics make code more reusable?"
category: frontend
difficulty: medium
expertise: mid
tags: [typescript, narrowing, generics, type-safety]
---

Narrowing is how TypeScript refines a broad type down to a more specific one within a branch of code, based on runtime checks it can statically follow. A `typeof x === 'string'` check, an `instanceof` check, an `in` check, or a custom type guard function returning `x is Foo` all narrow the type inside that branch, so if a variable is `string | number`, after a `typeof` check TypeScript knows it's just `string` in that block without any casting. Discriminated unions are the pattern I use most — give each variant a shared literal `kind` field, and a switch on `kind` narrows the whole object type per case. Generics solve a different problem: writing a function or type that works across many types while preserving the specific type used at each call site, rather than either duplicating code per type or widening everything to `any`. A generic function like `function first<T>(arr: T[]): T` returns exactly the element type of whatever array you pass in, so callers still get precise autocomplete and type checking on the result instead of losing type information.
