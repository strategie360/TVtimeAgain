---
description: Verify, commit, push the current branch and open a pull request
argument-hint: "[extra notes for the PR]"
---

Ship the current branch as a pull request. Notes from the user: $ARGUMENTS

1. Confirm you are on a feature branch (not `main`/`master`). If you are on main, stop and say so.
2. Run `./scripts/check.sh`. If it fails, fix the problems (see `/check`) or stop and report. Do not ship red.
3. Review `git status` and `git diff main...HEAD`. Commit any remaining relevant changes with Conventional Commit messages; leave unrelated files out and mention them.
4. Documentation (see `.claude/standards/documentation.md`):
   - update `docs/STATUS.md` (In progress, Done recently, Next, Last updated);
   - for `feat`/`fix`, add a user-facing entry under `[Unreleased]` in `CHANGELOG.md`;
   - update the other docs this change affects (`/docs`);
   - commit them (`docs: …`) and run `./scripts/docs-check.sh --title "<PR title>"`. Do not ship until it passes.
5. Push: `git push -u origin HEAD`.
6. If a PR already exists for this branch (`gh pr view`), update its description if needed and give the link. Otherwise create one with `gh pr create`, using a Conventional Commit title and a body that follows `.github/pull_request_template.md`: summary, why, how it was tested (the real check results), screenshots or notes for reviewers when relevant.
7. Give the PR link and the CI status (`gh pr checks`). Do not merge.
