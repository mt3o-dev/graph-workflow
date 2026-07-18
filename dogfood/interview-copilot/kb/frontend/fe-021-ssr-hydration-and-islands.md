---
id: fe-021
question: "What is SSR hydration, and how does an islands architecture differ from full-page hydration?"
category: frontend
difficulty: hard
expertise: senior
tags: [ssr, hydration, islands, astro, performance]
---

SSR renders the initial HTML on the server so the browser gets a fully-formed page immediately, good for perceived load speed and SEO. Hydration is the step after that HTML arrives: the client-side JavaScript runs, attaches event listeners, and reconciles its virtual representation against the existing DOM so the page becomes interactive, without React or whatever framework re-rendering everything from scratch. The catch is traditional SSR hydrates the entire page as one unit — even mostly-static content pays the cost of shipping and executing JS to become "interactive," and the page is often visible but unresponsive until hydration finishes, which shows up as poor INP. Islands architecture, used by frameworks like Astro, flips that: the page ships as static HTML by default, and only specific interactive components — an island, like a carousel or a like button — get their own JS bundle and hydrate independently, in isolation from the rest of the page. That means most of the page never pays any JS cost at all, and islands can even hydrate lazily, on visibility or on interaction, which is a much better default for content-heavy sites that only have a few genuinely interactive widgets.
