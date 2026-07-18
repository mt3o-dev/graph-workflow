---
id: bh-003
question: "Tell me about a time you made a mistake and had to own it."
category: behavioral
difficulty: hard
expertise: senior
tags: [failure, accountability, incident, database]
---

I once ran a database migration during what I thought was a low-traffic window, but it added a column with a default value on our orders table, which took an exclusive lock for nearly four minutes. Checkout writes queued up behind it, and for a few minutes customers saw failed payment submissions during what turned out to be a regional flash sale I hadn't checked the calendar for. I immediately posted in our incident channel, took ownership publicly rather than waiting to be asked, and worked with the on-call engineer to kill the migration and roll back cleanly. Afterward I wrote the postmortem myself instead of letting someone else document my mistake, and it was blunt: I hadn't checked marketing's promo calendar and hadn't tested the migration's lock behavior against production-sized tables. The concrete fix was a pre-migration checklist requiring a load estimate and a marketing-calendar check, which we still use. What mattered most to me was that the team saw me name the error clearly and turn it into a process improvement rather than getting defensive.
