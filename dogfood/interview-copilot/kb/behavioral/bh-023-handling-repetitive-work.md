---
id: bh-023
question: "Tell me about a time you had to do repetitive or tedious work."
category: behavioral
difficulty: easy
expertise: junior
tags: [repetitive-work, automation, compliance, initiative]
---

For a couple of months, I was responsible for manually reviewing and annotating compliance audit logs every week, cross-referencing flagged transactions against a checklist to confirm nothing needed escalation, which was necessary but genuinely tedious work that ate a few hours every Friday. Rather than just grinding through it week after week, I paid attention to the pattern in what I was actually doing and noticed that about eighty percent of the annotations followed predictable rules based on transaction type, amount thresholds, and customer history, the kind of logic that didn't need human judgment at all. I wrote a small script in my spare time that pre-classified the obvious cases and only surfaced the ambiguous ones for manual review, then validated it against three months of my own past annotations to make sure it matched my judgment closely enough to trust. That cut the manual review time from a few hours to about twenty minutes a week, and I open-sourced the tool internally so two other people doing similar audits could use it too. I don't mind repetitive work in the short term, but I treat it as a signal that something is probably automatable, and I try to act on that signal rather than just tolerating the tedium indefinitely.
