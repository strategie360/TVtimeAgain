# How we work

> Managed by the dev template: this page is overwritten on update. It is the one-page summary of every
> rule, command and safeguard in this project. Details live in `.claude/standards/`.

## The daily loop

1. **Start**: `/feature <what to build>`. Claude creates a branch from `main`, plans, and writes tests first.
2. **Build**: code and tests together. `./scripts/check.sh` runs lint, types and tests.
3. **Review**: `/review`. A strict review of the branch before anyone else sees it.
4. **Ship**: `/ship`. Checks pass, docs and status updated, branch pushed, PR opened.
5. **Merge**: you merge the PR on GitHub once CI is green. Claude never merges.

Without Claude, the loop is the same: branch, commit, push, PR. The git hooks and CI apply to everyone.

## Commands

| Command | Use it to |
|---|---|
| `/feature <task>` | Start any feature or fix on its own branch, test-first |
| `/check [stack]` | Run every check and fix what fails |
| `/review` | Review the branch against the standards before shipping |
| `/docs` | Update the documentation affected by the branch |
| `/status` | Refresh `docs/STATUS.md` (where the project stands) |
| `/adr <title>` | Record an important decision in `docs/decisions/` |
| `/ship` | Verify, update docs, push and open the pull request |

## Rules that can block you

When something is blocked, the message shows a rule id in brackets, like `[protected-branch]`. Find it here.

| Rule | What it means | Checked by | What to do |
|---|---|---|---|
| `protected-branch` | No edits, commits or pushes on `main`; changes reach main through PRs | Claude hooks, git hooks | `git switch -c feat/<description>` |
| `branch-name` | Branches are named `<type>/<kebab-description>` (feat, fix, chore, docs, refactor, test, perf, ci, build, hotfix, release) | git pre-commit, CI | `git branch -m feat/<description>` |
| `commit-message` | Conventional Commits in English, first line ≤ 72 chars (`feat(auth): add password reset`); same for PR titles | git commit-msg, CI | Reword the message or PR title |
| `checks-pass` | `./scripts/check.sh` (lint, types, tests) passes before every commit | git pre-commit, CI | `/check`, fix the code, never weaken tests |
| `secrets` | No reading or committing `.env*`, keys, keystores, tokens | Claude hooks, git pre-commit | Use `.env.example` for names; values stay local |
| `no-hook-bypass` | No `--no-verify`, no changing `core.hooksPath` | Claude hooks | Fix what the hook reports |
| `managed-files` | Hooks, settings, check scripts, standards and this page come from the template | Claude hooks | Change them in the template repo, then re-run `install.sh` |
| `no-force-push` | No force push (`--force`, `-f`, `+ref`) | Claude hooks, permissions | Ask a human; `--force-with-lease` on your own branch only |
| `no-destructive-git` | No `reset --hard`, `clean -f`, `checkout -- .`, `stash drop/clear` | Claude hooks | Claude explains; a human runs it |
| `no-dangerous-delete` | No recursive delete of `/`, `~`, `.`, `..`, `*` or `.git` | Claude hooks | Delete specific paths |
| `no-sudo` | No privileged commands | Claude hooks | A human runs them |
| `no-curl-pipe-shell` | No `curl … \| sh` | Claude hooks | Download, read, then run |
| `status-file` | `docs/STATUS.md` exists with a valid `Phase:` | CI (`docs-check`) | Fix the file (`/status`) |
| `status-updated` | A PR that changes code also updates `docs/STATUS.md` | CI (`docs-check`), `/ship` | `/status` |
| `changelog-entry` | A `feat`/`fix` PR adds a user-facing line under `[Unreleased]` in `CHANGELOG.md` | CI (`docs-check`), `/ship` | Add the entry |

Claude also asks before `git push`, `git rebase`, opening or merging a PR, and any publish or deploy command.

### When a rule really is in the way

- Human-only escape hatches exist: `git commit --no-verify`, the `skip-docs-check` PR label. Use them knowingly
  and say why in the PR.
- If a rule keeps getting in the way, change it in the template (see below) rather than working around it.

## Guidelines (not blocking, checked in `/review`)

- **Tests**: every behaviour change is tested; bug fixes start with a failing test. (`core.md`)
- **Design**: Clean Code and SOLID, with simplicity first: no speculative abstractions. (`clean-code.md`)
- **Docs**: each document has a named reader and is updated in the same PR as the change. (`documentation.md`)
- **Scope**: small focused branches; ask before adding dependencies or doing destructive operations. (`core.md`)
- **Stack rules**: language and framework conventions. (`.claude/standards/<stack>.md`)

## Project status and phases

`docs/STATUS.md` says where the project stands. Claude reads it at every session start, and you can too.
The phase (`idea`, `prototype`, `mvp`, `beta`, `production`, `maintenance`) adjusts how careful changes must be;
Claude proposes phase changes, you decide.

## Who owns which file

| Yours: edit freely | From the template: change it in the template repo |
|---|---|
| `CLAUDE.md` (outside the `dev-template` block) | `.claude/settings.json` (your extra permissions are kept), `.claude/hooks/` |
| `README.md`, `CHANGELOG.md`, `docs/*` except this page | `.claude/standards/`, `.claude/commands/` (template ones) |
| `.template/config` (stacks, directories) | `.githooks/`, `scripts/check.sh`, `scripts/docs-check.sh`, `scripts/checks/<stack>.sh` |
| `scripts/checks/local.sh` (extra checks) | `.github/workflows/conventions.yml` and `<stack>.yml`, `docs/WORKFLOW.md` |
| `.claude/settings.local.json` (personal, not committed) | |

## Where the details live

| Topic | File |
|---|---|
| Branches, tests, commits, PRs, safety | `.claude/standards/core.md` |
| Clean Code and SOLID | `.claude/standards/clean-code.md` |
| Status, phases, documentation | `.claude/standards/documentation.md` |
| Language and framework rules | `.claude/standards/<stack>.md` |
| Updating or changing the template | the template repository's `README.md` |
