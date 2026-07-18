---
id: fe-014
question: "How do modern bundlers implement code-splitting, and why does it matter for performance?"
category: frontend
difficulty: medium
expertise: mid
tags: [bundlers, code-splitting, webpack, vite, performance]
---

Modern bundlers like Vite or webpack build a dependency graph starting from your entry points and figure out which modules are imported where. Code-splitting works by cutting that graph at natural boundaries — usually dynamic `import()` calls — and emitting each piece as a separate chunk that's only fetched when actually needed. So instead of shipping one giant bundle that includes every route and every rarely-used feature, a route like a settings page or a chart library only loads when the user actually navigates there or triggers that feature, using something like `const Chart = lazy(() => import('./Chart'))` in React or an equivalent in other frameworks. Bundlers also do vendor splitting, separating rarely-changing third-party code from your app code so browsers can cache it longer, and tree-shaking to drop unused exports entirely from static-analyzable ES modules. This matters because initial bundle size directly drives LCP and time-to-interactive — a smaller critical path means the browser can parse, execute, and render sooner, and code-splitting is the main lever for keeping that critical path small as an app grows.
