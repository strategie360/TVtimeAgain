---
description: Review the changes on this branch against main before shipping
---

Review the work on the current branch as a demanding senior reviewer.

1. Get the changes: `git diff main...HEAD` plus uncommitted changes (`git diff`, `git status`).
2. Check, in this order:
   - Correctness: bugs, edge cases, error handling, concurrency, null/empty inputs.
   - Tests: is every behaviour change covered? Do tests assert the right thing, and would they fail without the change?
   - Security: secrets, injection, auth checks, unsafe input handling, logging of personal data.
   - Standards from `.claude/standards/`: branch, commits, scope creep, dependencies added.
   - Design (`.claude/standards/clean-code.md`): SOLID violations (mixed responsibilities, business logic
     depending on framework/IO, type switches that should be polymorphism, fat interfaces), naming,
     function size, error handling, and the opposite failure: over-engineering (speculative abstractions,
     pass-through layers).
3. Report findings ranked by severity, each with `file:line`, the problem, and a concrete fix. Say clearly when you found nothing serious.
4. Do not change code during the review. Offer to fix the findings afterwards.
