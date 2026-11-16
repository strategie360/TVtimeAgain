#!/usr/bin/env bash
# Checks that a branch keeps the project status and changelog up to date.
# Managed by the dev template. Rules: .claude/standards/documentation.md
#
# Usage: ./scripts/docs-check.sh [--base <ref>] [--title "<PR title>"]
#   --base   ref to compare with (default: origin/main, else main)
#   --title  PR title; its Conventional Commit type decides whether CHANGELOG.md is required
#            (default: the type from the branch name, e.g. feat/… → feat)
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" || exit 1

base=""; title=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) base="${2:-}"; shift 2 ;;
    --title) title="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "docs-check: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

errors=0
# err <rule-id> <message>; rule ids are documented in docs/WORKFLOW.md.
err() { printf '\033[31mdocs-check [%s]: %s\033[0m\n' "$1" "$2" >&2; errors=$((errors + 1)); }

# 1. STATUS.md exists with a valid phase.
status=docs/STATUS.md
if [[ ! -f "$status" ]]; then
  err status-file "$status is missing. Re-run the template's install.sh or create it."
else
  phase="$(sed -n 's/^Phase:[[:space:]]*\([a-z]*\).*/\1/p' "$status" | head -n1)"
  case "$phase" in
    idea|prototype|mvp|beta|production|maintenance) ;;
    *) err status-file "'Phase:' in $status is '${phase:-missing}'; use idea, prototype, mvp, beta, production or maintenance." ;;
  esac
fi

# 2. What changed on this branch?
if [[ -z "$base" ]]; then
  if git rev-parse --verify -q origin/main >/dev/null; then base=origin/main; else base=main; fi
fi
if ! git rev-parse --verify -q "$base" >/dev/null; then
  echo "docs-check: base '$base' not found; only the status file was checked." >&2
  [[ $errors -eq 0 ]]; exit
fi
changed="$(git diff --name-only "$base"...HEAD)"

# Code = anything that is not documentation, CI, or agent/template configuration.
code_changed=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    *.md|docs/*|.github/*|.claude/*|.template/*|.githooks/*|LICENSE*|.gitignore|.editorconfig) ;;
    *) code_changed=1; break ;;
  esac
done <<< "$changed"

has_change() { grep -qx -- "$1" <<< "$changed"; }

if [[ $code_changed -eq 1 ]] && ! has_change "$status"; then
  err status-updated "this branch changes code but not $status. Update it (/status): progress, focus, next steps, Last updated."
fi

type=""
if [[ -n "$title" ]]; then
  type="$(sed -n 's/^\([a-z]*\)\(([^)]*)\)\{0,1\}!\{0,1\}:.*/\1/p' <<< "$title")"
else
  type="$(git branch --show-current | sed -n 's|^\([a-z]*\)/.*|\1|p')"
fi
if [[ $code_changed -eq 1 && ( "$type" == feat || "$type" == fix ) ]] && ! has_change CHANGELOG.md; then
  err changelog-entry "a '$type' change must add an entry under [Unreleased] in CHANGELOG.md, written for users."
fi

if [[ $errors -gt 0 ]]; then
  echo "See docs/WORKFLOW.md and .claude/standards/documentation.md. A PR labelled 'skip-docs-check' bypasses this check." >&2
  exit 1
fi
echo "docs-check: OK"
