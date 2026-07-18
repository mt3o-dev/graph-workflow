---
id: fe-016
question: "What are the tradeoffs between local component state, context, and a global store like Redux or Zustand?"
category: frontend
difficulty: medium
expertise: mid
tags: [state-management, react, redux, context]
---

I default to local component state for anything only one component or its direct children need — it's simplest to reason about and doesn't force re-renders elsewhere. Once several unrelated components need the same data, I reach for context, but only for state that changes infrequently, like theme or auth user, because context re-renders every consumer on any change unless you split it carefully. For state that's genuinely global, changes frequently, and is read by many disconnected parts of the tree — things like a shopping cart or complex UI state with lots of derived values — I'd bring in a dedicated store like Zustand or Redux Toolkit, because they give you selective subscriptions, so a component only re-renders when the specific slice it reads changes, plus better devtools and testability outside of React's render cycle. The tradeoff is added indirection and boilerplate, so I try not to reach for a global store prematurely — lift state up as far as actually needed, no further, and keep server-derived data in a data-fetching library like React Query rather than duplicating it into a client store.
