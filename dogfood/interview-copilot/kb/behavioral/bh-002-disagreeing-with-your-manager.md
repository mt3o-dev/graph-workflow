---
id: bh-002
question: "Tell me about a time you disagreed with your manager."
category: behavioral
difficulty: medium
expertise: senior
tags: [disagreement, manager, payments, risk]
---

My engineering manager wanted to ship a payment retry mechanism a week early by skipping idempotency keys, arguing we could patch it in a follow-up release since the deadline mattered for a big merchant launch. I disagreed because in a payments system, a double-charge bug isn't a bug you patch later, it's a support and trust crisis you can't fully undo. Rather than just saying no in the planning meeting, I put together a short doc showing our historical retry failure rate and estimated how many duplicate charges we'd likely generate at our current transaction volume within the first month. I proposed a scoped-down version, idempotency on the critical charge path only, that added just two days instead of a full week. My manager reviewed the numbers, agreed the risk wasn't worth the time saved, and we shipped the scoped version on a slightly adjusted timeline. The merchant launch still hit its window. That experience reinforced for me that disagreeing well means replacing opinion with data and always bringing an alternative, not just an objection.
