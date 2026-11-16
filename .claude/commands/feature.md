---
description: Start a new feature or fix on its own branch, test-first
argument-hint: <what to build or fix>
---

Start this task following `.claude/standards/core.md`: $ARGUMENTS

1. Check the state: `git status`, the current branch, and `docs/STATUS.md` (phase and current focus). If the task does not fit the current focus or phase, say so before starting. If there are uncommitted changes, stop and ask the user what to do with them.
2. Pick the branch type (`feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`) and a short kebab-case name, then create the branch from an up-to-date main:
   `git switch main && git pull --ff-only && git switch -c <type>/<name>`
   (if there is no remote yet, skip the pull).
3. Read the relevant code and tests. Summarize in a few lines what you will change, which files, where the logic lives (respecting the layering and SOLID rules in `.claude/standards/clean-code.md`), and how you will test it. If a decision is genuinely the user's, ask now.
4. Write or update the tests first. For a bug, write a test that reproduces it and confirm it fails.
5. Implement the change in small steps. Run `./scripts/check.sh` (or `--only <stack>`) as you go.
6. When `./scripts/check.sh` passes, commit with a Conventional Commit message. Make more than one commit if the work has distinct logical steps.
7. Update the docs the change affects (`/docs`) and add the branch to "In progress" in `docs/STATUS.md`.
8. Report: what changed, the test results, and what is left. Suggest `/ship` to push and open the PR.
