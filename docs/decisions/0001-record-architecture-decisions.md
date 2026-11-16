# 0001. Record architecture decisions

- Status: accepted
- Date: YYYY-MM-DD

## Context

Choices about architecture, technology and important trade-offs get forgotten, and months later nobody
remembers why the code looks the way it does.

## Decision

We record each significant decision in `docs/decisions/` as a short numbered file, following
[0000-template.md](0000-template.md). Decisions are not edited after acceptance; a new decision supersedes an old one.

## Alternatives considered

- Wiki pages: drift away from the code and are not reviewed in PRs.
- Nothing: the reasoning is lost.

## Consequences

Each significant choice costs a few minutes of writing, and is reviewed in the same PR as the code.
