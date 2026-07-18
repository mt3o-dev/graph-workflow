---
id: fe-007
question: "What are Web Components, and when would you use them instead of a framework component?"
category: frontend
difficulty: easy
expertise: junior
tags: [web-components, custom-elements, shadow-dom]
---

Web Components are a set of browser-native APIs — Custom Elements, Shadow DOM, and HTML Templates — that let you build reusable, encapsulated UI elements without a framework. You define a class extending `HTMLElement`, register it with `customElements.define`, and it works in any HTML page or any framework, since it's just a real DOM element like `<my-widget>`. Shadow DOM gives you style and markup encapsulation, so the component's internal CSS doesn't leak out and page styles don't leak in. I'd reach for them when building a component that needs to be shared across teams using different frameworks — a design system's building blocks, or a widget embedded on third-party sites where I can't assume React or Vue is present. The tradeoffs are real: state management and reactivity are more manual than something like React or Svelte gives you, SSR support is weaker, and testing tooling is less mature. So for a single-framework app I'd default to that framework's component model and save Web Components for genuinely cross-framework or embeddable use cases.
