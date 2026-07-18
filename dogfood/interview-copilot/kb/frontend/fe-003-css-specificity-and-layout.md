---
id: fe-003
question: "How is CSS specificity calculated, and when would you reach for Flexbox versus Grid?"
category: frontend
difficulty: easy
expertise: junior
tags: [css, specificity, flexbox, grid, layout]
---

Specificity is calculated as a tuple of ID selectors, class/attribute/pseudo-class selectors, and element/pseudo-element selectors — often written like (1,0,0) for an ID versus (0,1,0) for a class. Higher tuples win regardless of source order, and inline styles or `!important` jump the queue entirely, which is why I avoid `!important` except as an escape hatch. For layout, I reach for Flexbox when I'm arranging items along one axis — a nav bar, a button group, centering content — because it handles alignment and spacing between items really well. I switch to Grid when I need two-dimensional control, like a page layout with a header, sidebar, and main content, or a card grid where rows and columns both need to line up. In practice they compose: a Grid for the page skeleton, Flexbox inside individual grid cells for aligning their contents. Getting specificity and layout method right early saves a lot of `!important` fights and nested wrapper divs later.
