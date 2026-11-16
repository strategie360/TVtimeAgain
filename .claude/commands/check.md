---
description: Run every project check and fix what fails
argument-hint: "[stack]"
---

Run the project's checks and get them green.

1. Run `./scripts/check.sh` (or `./scripts/check.sh --only $ARGUMENTS` if a stack was given).
2. If everything passes, say so in one line and stop.
3. Otherwise, for each failure: find the root cause and fix the code. Never delete, skip or weaken a test to make it pass, and never disable a lint rule without asking. If a test itself looks wrong, explain why and ask the user.
4. Re-run until it passes, then summarize what you fixed. If something cannot be fixed, report it with the exact output.
