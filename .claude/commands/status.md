---
description: Refresh docs/STATUS.md so it reflects where the project really stands
argument-hint: "[what just happened, optional]"
---

Bring `docs/STATUS.md` up to date, following `.claude/standards/documentation.md`. Context from the user: $ARGUMENTS

1. Gather facts, do not guess:
   - `git log --oneline -30` and the date `docs/STATUS.md` last changed (`git log -1 --format=%ci -- docs/STATUS.md`);
   - open branches (`git branch -a --sort=-committerdate | head -20`) and PRs (`gh pr list` if available);
   - `CHANGELOG.md` `[Unreleased]`, recent ADRs in `docs/decisions/`, `TODO`/`FIXME` counts if relevant;
   - the current `docs/STATUS.md`.
2. Update each section: In one paragraph (plain language), Current focus, In progress, Done recently (with dates;
   move old items to CHANGELOG.md), Next, Known issues and risks, Open questions. Set `Last updated:` to today.
3. If the evidence suggests the phase should change (e.g. first real users → beta), propose it to the user; do not change `Phase:` yourself.
4. Ask the user for what you cannot infer (goals, priorities, deadlines) instead of inventing it.
5. Show a short summary of what changed in the file. Commit it on the current feature branch
   (`docs: update project status`); if you are on main, create `docs/update-status` first.
