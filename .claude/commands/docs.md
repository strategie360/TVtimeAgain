---
description: Update the human documentation affected by the changes on this branch
---

Make the documentation match the changes on the current branch, following `.claude/standards/documentation.md`.

1. List what changed: `git diff --stat main...HEAD` and `git diff main...HEAD` (plus uncommitted changes).
2. For each change, decide which documents it affects using the table in the standard
   (README, docs/USER_GUIDE.md, docs/DEVELOPMENT.md, docs/ARCHITECTURE.md, docs/OPERATIONS.md, CHANGELOG.md,
   docs/STATUS.md, .env.example, a new ADR).
3. Update them, written for their reader: user-facing language in USER_GUIDE and CHANGELOG, precise commands and
   paths in DEVELOPMENT and OPERATIONS, components and flows (Mermaid) in ARCHITECTURE.
4. Fill `TODO` placeholders you now have facts for; leave the others and list them. Never invent URLs, owners or environments.
5. Report which files you updated and why, and which `TODO`s remain. Commit as `docs: …` on the current branch.
