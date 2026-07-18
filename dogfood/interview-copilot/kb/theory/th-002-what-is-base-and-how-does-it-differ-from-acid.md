---
id: th-002
question: "What is BASE and how does it differ from ACID?"
category: theory
difficulty: medium
expertise: mid
tags: [databases, distributed-systems, eventual-consistency, nosql]
---

BASE stands for Basically Available, Soft state, Eventually consistent, and it's the philosophy behind most distributed NoSQL systems as an alternative to ACID. Where ACID prioritizes strong consistency even at the cost of availability during partitions, BASE accepts that different replicas might temporarily disagree in exchange for staying available and scaling horizontally. Basically available means the system responds to every request, even if the answer isn't the absolute latest write. Soft state means the stored data can change over time without new writes, as background processes like anti-entropy repair or replication converge replicas toward agreement. Eventually consistent means that if no new updates come in, all replicas will converge to the same value given enough time, though there's no bound on how long that takes unless you use something like read-your-writes or bounded staleness guarantees. I reach for BASE-style systems for things like product catalogs, view counters, or activity feeds where a brief staleness window is acceptable, but I stick with ACID for anything involving money or inventory reservations.
