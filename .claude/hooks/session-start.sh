#!/usr/bin/env bash
# SessionStart hook: makes sure git hooks are active and gives Claude the branch and project-status context.
# Managed by the dev template. Stdout is added to Claude's context.
set -u
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

cd "$PROJECT_DIR" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Git hooks live in .githooks; core.hooksPath is local config, so (re)apply it here.
if [[ -d .githooks && "$(git config --get core.hooksPath 2>/dev/null)" != ".githooks" ]]; then
  git config core.hooksPath .githooks
  echo "Git hooks enabled (core.hooksPath=.githooks)."
fi

branch="$(current_branch)"
echo "Current git branch: ${branch:-detached HEAD}."
if on_protected_branch; then
  echo "You are on a protected branch. Before changing any file, create a feature branch from an up-to-date main (git switch -c <type>/<description>). See .claude/standards/core.md."
fi
if [[ -n "$(git status --porcelain 2>/dev/null | head -1)" ]]; then
  echo "The working tree has uncommitted changes; check them (git status) before starting new work."
fi

# Project status: the full file is imported in CLAUDE.md; here we only flag what needs attention.
status=docs/STATUS.md
if [[ ! -f "$status" ]]; then
  echo "docs/STATUS.md is missing: the project state is unknown. Offer to create it with /status."
else
  phase="$(sed -n 's/^Phase:[[:space:]]*\([a-z]*\).*/\1/p' "$status" | head -n1)"
  updated="$(sed -n 's/^Last updated:[[:space:]]*\(.*\)$/\1/p' "$status" | head -n1)"
  echo "Project phase: ${phase:-unknown} (docs/STATUS.md, last updated ${updated:-never})."
  if has_commits; then
    last="$(git log -1 --format=%H -- "$status" 2>/dev/null)"
    if [[ -n "$last" ]]; then
      behind="$(git rev-list --count "$last"..HEAD 2>/dev/null || echo 0)"
      if [[ "$behind" -ge 10 ]]; then
        echo "docs/STATUS.md was last changed $behind commits ago and may be stale. Refresh it with /status before relying on it."
      fi
    fi
  fi
  if grep -q '^TODO' "$status"; then
    echo "docs/STATUS.md still has TODO placeholders. When you learn the facts, fill them in (ask the user for what you cannot infer)."
  fi
fi
exit 0
