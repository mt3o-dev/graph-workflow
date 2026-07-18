# Knowledge base schema

One markdown file per interview question, under `kb/<category>/` — git-versioned
and human-editable by design [dec:10]. The app's markdown-kb adapter parses the
frontmatter and hands docs to the indexer; `pnpm validate:kb` is the acceptance
gate.

## File layout

```
kb/
  frontend/    fe-*.md
  backend/     be-*.md
  theory/      th-*.md
  behavioral/  bh-*.md
```

All four categories must exist and the whole KB must hold **at least 100
questions** (PRD FR6). File names are free-form (`<id>-<slug>.md` by
convention); the `id` frontmatter field is what counts.

## Frontmatter schema (all fields required)

| Field        | Type     | Constraint                                                            |
| ------------ | -------- | --------------------------------------------------------------------- |
| `id`         | string   | unique lowercase slug (`[a-z0-9][a-z0-9-]*`), unique across the KB     |
| `question`   | string   | the interview question, non-empty                                      |
| `category`   | enum     | `frontend` \| `backend` \| `theory` \| `behavioral`; matches its directory |
| `difficulty` | enum     | `easy` \| `medium` \| `hard` — how hard the question is                |
| `expertise`  | enum     | `junior` \| `mid` \| `senior` — the seniority the question targets     |
| `tags`       | string[] | 2–5 non-empty tags, lowercase-kebab-case                               |

`difficulty` and `expertise` are deliberately separate axes: an easy question
can target seniors ("what motivates you") and a hard one juniors.

**Body** = the prepared answer, non-empty markdown, written in first person as
the candidate would deliver it.

## Example

```markdown
---
id: th-001
question: "Explain the ACID properties of a database transaction."
category: theory
difficulty: medium
expertise: mid
tags: [databases, transactions, acid, sql]
---

ACID is the set of guarantees a database gives around transactions...
```

## Validation

```
pnpm validate:kb              # full gate: schema + unique ids + count >= 100
pnpm validate:kb --min 8      # override the count gate (CI while content lands)
pnpm validate:kb --dir path   # validate another directory
```

The gate also asserts all four categories are present and that the `theory`
category covers ACID/BASE, DDD, complexity and networking (by tags).
