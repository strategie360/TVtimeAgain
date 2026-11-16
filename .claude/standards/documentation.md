# Project status and documentation

> Managed by the dev template.

Two goals: you (Claude) always know where the project stands, and humans can understand the project
without reading the code or asking. Documentation is part of the change, reviewed in the same PR.

## Project status: `docs/STATUS.md`

`docs/STATUS.md` is imported below this file, so you see it at every session start. Treat it as the
project's memory:

- Read it before planning any task. Align the work with **Current focus**; if a request contradicts it,
  say so before starting.
- Keep it true. Update it whenever the state changes: a feature delivered, work started or abandoned,
  a new risk or open question, a phase change. `/status` refreshes it; `/ship` updates it before each PR.
- Header fields: `Phase:` (see below), `Version:`, `Last updated:` (YYYY-MM-DD, today's date when you edit it).
- "In one paragraph" is for non-technical readers: plain language, no jargon, no file names.
- Keep it short (about one screen). Move old "Done recently" items into `CHANGELOG.md`.
- Never put secrets, credentials, or personal data in it.

### Phases and what they change

| Phase | Meaning | What it changes for you |
|---|---|---|
| `idea` | Exploring the problem, no product code yet | Favour spikes and notes; record decisions as ADRs |
| `prototype` | Proving the concept, throwaway code is acceptable | Tests on core logic; keep scope tiny; flag shortcuts in "Known issues" |
| `mvp` | First usable version for real users | Full test coverage of features; user guide for each delivered feature |
| `beta` | Real users, stabilising | Bug fixes come with regression tests; no breaking changes without an ADR; CHANGELOG per release |
| `production` | Live and relied on | Backward-compatible changes and migrations; OPERATIONS.md current; rollback plan for risky changes |
| `maintenance` | Only fixes and upgrades | Minimal changes; no new features without the user's go-ahead |

Changing the phase is the user's decision: propose it, do not change it on your own.

## Human documentation

| File | Reader | Update it when |
|---|---|---|
| `README.md` | Everyone, first contact | Setup, run commands or purpose change |
| `docs/README.md` | Everyone | A document is added or removed |
| `docs/STATUS.md` | Everyone (you included) | Any change of state (see above) |
| `docs/USER_GUIDE.md` | End users, clients | A user-visible feature is added or changed |
| `docs/DEVELOPMENT.md` | Developers joining | Tooling, setup, workflow or commands change |
| `docs/ARCHITECTURE.md` | Developers | Components, flows, layering, data model or external services change |
| `docs/OPERATIONS.md` | Ops / deployment | Environments, env vars, deploy, monitoring or backups change |
| `docs/decisions/NNNN-*.md` | Future maintainers | A significant, hard-to-reverse choice is made (`/adr`) |
| `CHANGELOG.md` | Users, clients, developers | Every `feat` and `fix` (under `[Unreleased]`) |

### Writing rules

- Write for the named reader. Explicit beats implicit: say what something is, why it exists, and how to use it.
  Define acronyms on first use.
- Concrete over abstract: real commands that work when copy-pasted, real examples, real file paths.
- Keep docs true. Wrong documentation is worse than none: when you change behaviour, fix the docs in the same branch.
- Replace `TODO` placeholders with real content when you have the information; never invent facts
  (URLs, owners, environments). Ask, or leave the `TODO`.
- Diagrams in Mermaid inside the Markdown, so they are versioned and reviewable.
- `.env.example` and the configuration table in `docs/OPERATIONS.md` list the same variables.
- CHANGELOG entries describe the effect for the reader ("Users can reset their password by email"),
  not the implementation ("add ResetService").

### Architecture Decision Records

Write an ADR (`/adr <title>`) for choices that are costly to reverse or that a newcomer would question:
framework or database choice, architecture style, authentication approach, major dependency, data model
shape, hosting. Accepted ADRs are not edited; a new ADR supersedes an old one.

## Enforcement

`./scripts/docs-check.sh` runs in CI on every PR (and in `/ship`). It fails when:

- `docs/STATUS.md` is missing or its `Phase:` is not a valid phase;
- the PR changes code but not `docs/STATUS.md`;
- the PR is a `feat` or `fix` that changes code but not `CHANGELOG.md`.

A PR labelled `skip-docs-check` bypasses it; only the user adds that label.
