---
id: fe-005
question: "What is the Testing Library philosophy of 'test like a user', and why does it matter?"
category: frontend
difficulty: easy
expertise: junior
tags: [testing, testing-library, accessibility, react]
---

Testing Library's guiding principle is "the more your tests resemble the way your software is used, the more confidence they give you." Instead of reaching into component internals — state, instance methods, implementation details — you query the rendered DOM the way a user or assistive technology would: by role, label text, or visible text, using something like `getByRole('button', { name: /submit/i })`. That forces you to write accessible markup, because if a query is hard to write, it usually means a real user or screen reader would struggle too. It also means refactoring a component's internals, switching from a class to a hook or from local state to a reducer, doesn't break the tests as long as the observable behavior stays the same, which is exactly the confidence you want. I avoid `getByTestId` unless there's really no accessible way to target an element, since test ids don't reflect anything a user experiences. The tradeoff is these tests are integration-flavored by nature, which I actually prefer over brittle unit tests of implementation detail.
