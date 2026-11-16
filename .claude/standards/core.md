# Engineering standards (core)

> Managed by the dev template. Do not edit in a project: changes are overwritten by
> `install.sh`. Put project-specific rules in `CLAUDE.md` outside the managed block.

These rules apply to every task in this repository. Several are enforced by hooks
(Claude Code hooks in `.claude/hooks/` and git hooks in `.githooks/`). When a hook
blocks you, do not try to work around it: follow its message or ask the user.

## 1. Branches

- Never work directly on `main` (or `master`). Edits, commits and pushes there are blocked.
- One branch per feature, fix or task, created from an up-to-date `main`:
  `git switch main && git pull --ff-only && git switch -c <type>/<short-kebab-description>`
- Allowed prefixes: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `perf/`, `ci/`, `build/`, `hotfix/`, `release/`.
- Keep a branch focused. If you discover unrelated work, note it for the user instead of doing it on this branch.
- Changes reach `main` only through a pull request.

## 2. Tests

- Every change in behaviour comes with tests that cover it. No tests, not done.
- Bug fixes start with a test that reproduces the bug and fails, then the fix makes it pass.
- New features: write or update tests alongside the code (test-first when the design is clear).
- Never delete, skip, or weaken a failing test to make the suite pass. If a test is wrong, say why and ask.
- Do not mock what you can run cheaply for real; do mock network, time and randomness.
- `./scripts/check.sh` runs lint, type checks and tests for every stack of the project.
  Run it before saying a task is done, and before every commit (the pre-commit hook runs it too).
- Report results faithfully: if checks fail or were not run, say so with the output.

## 3. Commits

- Conventional Commits, in English: `type(scope): imperative summary` (≤ 72 chars).
  Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Add `!` for breaking changes.
- Small, coherent commits. One logical change per commit; tests in the same commit as the code they cover.
- Never use `--no-verify`, never change `core.hooksPath`, never amend or rewrite commits already pushed unless the user asks.

## 4. Pull requests

- Push the branch and open a PR with `gh pr create`, filling in `.github/pull_request_template.md`.
- PR title follows the commit convention. The description says what changed, why, and how it was tested.
- Merging is the user's decision. Do not merge PRs unless asked.

## 5. Safety

- Never read, print, or commit secrets: `.env*` (except `.env.example`), keys, certificates, keystores, tokens.
  Reference them by name; put placeholders in `.env.example`.
- Ask before destructive or hard-to-reverse actions: `git reset --hard`, `git clean`, force pushes,
  deleting branches or files outside the task, database migrations or resets, dropping data.
- Ask before adding a dependency. Prefer the standard library and dependencies already in the project.
  Mention license and maintenance status when proposing one.
- Do not modify `.claude/settings.json`, `.claude/hooks/`, `.githooks/`, `scripts/check.sh`, `scripts/docs-check.sh` or `docs/WORKFLOW.md`: they are
  managed by the template. Propose changes to the user instead.
- Do not run commands that publish or deploy (package publish, store upload, production deploy) unless asked.

## 6. Working style

- Design and write code following `.claude/standards/clean-code.md` (Clean Code, SOLID, simplicity first).
- Read the relevant code before changing it; follow the existing patterns and naming.
- Plan briefly before multi-file changes; state assumptions you make.
- Keep changes minimal and on-topic. No drive-by reformatting of untouched code.
- Update docs (README, CLAUDE.md, comments) when behaviour or commands change.
- When something is ambiguous and the answer changes the outcome, ask.
