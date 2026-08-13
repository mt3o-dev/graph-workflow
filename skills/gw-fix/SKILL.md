---
name: gw-fix
description: Fix a bug or run a behaviour-preserving refactor under strict TDD, as a full change increment — reproduce first (red), minimal fix (green), then refactor, with the memory loop at each step. Refuses to touch source before a failing test exists. Use for defects, regressions, and refactors; use /gw-implement for feature work with a multi-phase plan. Trigger phrases "fix this bug", "there's a regression", "refactor this module", "red-green-refactor", "/gw-fix".
---

# gw-fix

A bug fix is a change increment, not an errand. It gets a change-id, a goal node, a
memory scope, a review, and an archive — because the knowledge a bug produces is some of
the most valuable the graph ever holds: it is the record of a wrong assumption the project
actually paid for.

What makes this skill different from `/gw-implement` is the **validity path**. A feature is
verified against a plan; a fix is verified against a **failing test that existed before the
fix did**. That order is not a style preference. A test written after the fix passes
proves the code does what you just wrote — it does not prove the bug is gone, and it cannot
tell you whether the bug would come back.

**The hard gate: no source edit before a red test.** If you cannot write a failing test,
you have not understood the bug yet. Go back to reproduction.

## Mode

| Mode | Goal | Red step |
|---|---|---|
| **Bug** | Change behaviour from wrong to right | A test that asserts the *correct* behaviour and fails on the current code |
| **Refactor** | Preserve behaviour, change structure | Characterization tests that **pass** on the current code and pin the behaviour you must not break |

Refactor mode inverts the loop honestly: there is no red step, so the safety net is
coverage. If the code you are about to restructure has none, **writing the
characterization tests is the first phase**, and it is not optional — a refactor without a
net is a rewrite with extra confidence.

State which mode you are in before doing anything.

---

## Step 1 — Open the change

```
/gw-new   →  change-id names the OUTCOME, not the activity
```

`invoice-vat-double-rounding`, not `fix-bug`. `classify-engine-extract-predicate`, not
`refactor`. The id becomes a permanent facet on everything the change captures; a bad name
outlives the folder by years.

Even a one-line fix gets this. The scope is what lets the fix's lesson be recalled by the
change that would otherwise reintroduce it.

## Step 2 — Reproduce and locate (bug mode)

```
recall_context(query="<the misbehaving subsystem and symptom>", goal_ref=<goal_node_id>)
domain_model()
```

Recall first, always. A recalled `invariant` frequently *is* the bug ("grand total equals
the sum of line totals" — and the report says it does not), which turns a vague symptom
into an exact assertion. Recalled `issue` nodes may show the bug was already known and
deferred, which changes the conversation entirely.

Then reproduce **from the outside in**: the smallest input that shows the wrong behaviour,
at the outermost layer that shows it. Narrow to the unit only once you can reproduce at
all. Report the reproduction to the user before proceeding — a fix aimed at an unconfirmed
reproduction is a guess.

**If you cannot reproduce, stop.** Capture an `issue` with everything you established and
everything you ruled out, and say so. A truthful "not reproduced, here is what I
eliminated" is worth more than a speculative fix, which is indistinguishable from a new
bug.

## Step 3 — Trace the blast radius before changing anything

```
impact_of(node_ref=<the node describing the behaviour you are about to change>)
```

The bug is in *code*, but the wrong behaviour is often *documented* — as a decision, a
constraint, or an invariant somebody wrote down. Two very different situations, and they
need opposite handling:

- **The code contradicts a correct recorded rule** → the code is wrong. Fix it. Journal
  `CONFIRMED` on the rule; it just proved its worth.
- **The code implements a recorded rule that is itself wrong** → the *knowledge* is the
  bug. Capture the correction with a `CONTRADICTS` edge to it, and check the blast radius
  first: a wrong rule with dependents means everything downstream was built on it, and the
  fix is bigger than the ticket. Say so before starting rather than after.

## Step 4 — RED

Write the failing test. Then **run it and show the failure.**

- It must fail **for the right reason**. A test that errors on a typo is not red, it is
  broken. Read the failure message and confirm it says what you expect.
- Assert the **behaviour**, not the implementation. `total == 100.00` survives the
  refactor in step 6; `roundHalfUp was called twice` does not.
- Put it where the project puts its tests, in the project's own style. Match the
  surrounding files.
- One failing test per defect. If the bug has several manifestations, one test each — a
  single test covering three symptoms cannot tell you which one you fixed.

Paste the failing output into your report. "I wrote a test that should fail" is not a red
step.

*(Refactor mode: run the characterization tests and show them **passing**. Same
discipline, inverted — that green output is the contract for step 6.)*

## Step 5 — GREEN

The **minimal** change that makes the test pass. Not the clean version, not the general
version — the minimal one.

This is where fixes go wrong: the temptation is to fix the bug and tidy the neighbourhood
in one motion, and then a failure in review cannot be attributed. Resist it; step 6 exists
for the tidying, under a green suite.

- Run the failing test → green.
- Run the **full suite** → still green. A fix that breaks two other tests is a trade, not
  a fix, and needs the user's ruling.
- Do not touch anything the test does not require.

## Step 6 — REFACTOR

Now clean up, with the suite green after every step and no test edited. If a test must
change to accommodate your refactor, the refactor changed behaviour — stop and re-plan.

Scope it to what you touched. A fix that refactors three neighbouring modules is a
different change wearing this one's id; capture the opportunity as an `issue` and route it
to its own `/gw-fix`.

*(Refactor mode: this is the whole job. Small steps, full suite between each. Extract,
run, commit. Never a big-bang restructure — a green suite after twelve changes tells you
much less than a green suite after each of twelve.)*

## Step 7 — Capture the lesson (the part that is easy to skip and worth the most)

A bug is a wrong assumption the project already paid for. Capture the assumption, not the
diff:

```
capture_artifact(type="constraint", goal_ref=..., facets=["invoicing"],
  content="VAT is rounded once, per line, at calculation time. Rounding again at display produced double-rounded totals that failed the grand-total invariant.",
  edges=[{"target": "<grand-total-invariant-id>", "type": "DEPENDS_ON", "direction": "out"},
         {"target": "<invoice-entity-id>", "type": "ABOUT", "direction": "out"}])
```

Capture:

- the **class of mistake**, not this instance of it ("money must not be rounded twice" —
  not "line 44 of invoice.ts rounded twice");
- a **corrected rule** with a `CONTRADICTS` edge, whenever the recorded knowledge was the
  bug;
- an `issue` for anything you found and deliberately left standing;
- an `invariant` when the fix established a property that must hold from now on — those
  are the highest-value nodes this skill produces, because the next agent recalls them
  before writing the code that would break them again.

Do **not** capture: the diff, the file paths, "fixed the rounding bug". Git has all of it.

Then journal — one batch. `CONFIRMED` genuinely applies here more than anywhere else in
the lifecycle: you *ran* the test, so a rule the test exercised is confirmed by evidence,
not by reading.

## Step 8 — Review and archive

Route to `/gw-review`. Same gate as any other change; the reviewer checks that a test
exists which fails without the fix — the one review question specific to this skill.

Then merge and `/gw-archive`.

## Headless

`/gw-fix` runs headless via `/gw-goal` **only** when the reproduction is already a failing
test someone else wrote. Reproduction is judgment: an unattended agent that cannot
reproduce will fix something adjacent and report success. With a red test in hand, the
loop is fully command-verifiable and the preconditions in `/gw-goal` are satisfied.

## Rules

- **No source edit before a red test.** The single rule this skill exists to enforce. "The
  fix is obvious" is exactly when it gets skipped and exactly when the regression returns.
- **Never weaken a test to make it pass.** Deleting an assertion, loosening a tolerance, or
  adding a skip is not a fix; if a test is genuinely wrong, that is a finding for the user,
  with the evidence.
- **Minimal green, then refactor.** Two steps, in that order, never merged.
- **Full suite between steps.** Not just the new test.
- **One defect, one change.** A second bug found mid-fix becomes an `issue` node and its
  own `/gw-fix` — not a silent extra commit.
- **Refactors keep behaviour.** If the outcome changes, it is not a refactor and needs a
  plan and a plan-review.
- Standing rules apply: recall before deciding, capture at the boundary, one batched
  `append_events`, no trust/flag/tier mutation, `context/archive/` untouched.
