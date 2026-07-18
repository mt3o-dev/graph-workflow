---
id: fe-012
question: "What accessibility practices do you follow when building interactive UI components?"
category: frontend
difficulty: medium
expertise: mid
tags: [accessibility, aria, semantic-html, wcag]
---

I start with semantic HTML — real `button`, `nav`, `label`, `input` elements — because they come with keyboard support, focus management, and screen reader semantics for free, which is a lot cheaper than reimplementing that with `div`s and ARIA. When I do need a custom widget, like a combobox or a modal, I follow the ARIA Authoring Practices patterns for roles, states, and keyboard interaction, and I make sure focus is trapped and returned correctly for dialogs. Every interactive element needs a visible focus indicator, and I never remove `outline` without providing a replacement. Color contrast gets checked against WCAG AA at minimum, and I don't rely on color alone to convey state, like a red border being the only signal for an error. For dynamic content, I use `aria-live` regions so screen reader users get notified of things like async updates or toast messages. I also actually test with a keyboard-only pass and a screen reader like VoiceOver or NVDA, because a lot of issues, like a focus trap that doesn't release, only show up that way.
