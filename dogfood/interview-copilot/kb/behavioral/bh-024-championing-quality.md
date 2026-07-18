---
id: bh-024
question: "Tell me about a time you championed quality on your team."
category: behavioral
difficulty: medium
expertise: senior
tags: [quality, testing, contract-testing, reliability]
---

After our second incident in a quarter caused by an upstream service silently changing its response shape and breaking our checkout integration without any test catching it, I noticed our test suite was almost entirely internal unit tests with no coverage of the actual contracts between services. Nobody had explicitly deprioritized this, it had just never been anyone's clear responsibility, which is often how quality gaps happen. I proposed introducing consumer-driven contract tests between our checkout service and its three main upstream dependencies, and rather than asking for permission to do it as a big initiative, I built a working proof of concept against one dependency over a couple of days to show concretely what it would catch and how little friction it added to the existing CI pipeline. I brought that to our team's tech lead with real numbers: our two most recent incidents would both have been caught by this specific kind of test before deployment. That made the case for itself, and we rolled contract tests out across all our upstream and downstream integrations over the following month, with ownership split so no single person carried it all. We haven't had a contract-mismatch incident since, and it's become a standard part of how we integrate with new services.
