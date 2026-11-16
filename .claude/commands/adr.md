---
description: Record an architecture decision in docs/decisions/
argument-hint: <decision title>
---

Write an Architecture Decision Record for: $ARGUMENTS

1. Find the next number: the highest `docs/decisions/NNNN-*.md` plus one, zero-padded to 4 digits.
2. Create `docs/decisions/NNNN-<kebab-title>.md` from `docs/decisions/0000-template.md`, dated today, status `proposed`
   unless the user already made the decision (then `accepted`).
3. Fill Context, Decision, Alternatives considered and Consequences from the conversation and the code.
   Ask the user about anything you cannot know (constraints, budget, preferences). Keep it under one page.
4. If it supersedes an earlier ADR, set the old one's status to `superseded by NNNN` (the only edit allowed on an accepted ADR).
5. Link it from `docs/ARCHITECTURE.md` when it changes the architecture, and mention it in `docs/STATUS.md` if it was an open question.
