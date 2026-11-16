#!/usr/bin/env bash
# Runs every check (lint, types, tests) for the stacks listed in .template/config.
# Managed by the dev template. Project-specific extra checks go in scripts/checks/local.sh.
#
# Usage: ./scripts/check.sh [--only <stack>] [--list]
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" || exit 1

TEMPLATE_STACKS=""
# shellcheck disable=SC1091
[[ -f .template/config ]] && . .template/config
export TEMPLATE_ROOT="$root"

only=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) only="${2:-}"; shift 2 ;;
    --list) echo "$TEMPLATE_STACKS"; exit 0 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "check: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

checks=()
for s in $TEMPLATE_STACKS; do
  [[ -n "$only" && "$s" != "$only" ]] && continue
  if [[ ! -f "scripts/checks/$s.sh" ]]; then
    echo "check: scripts/checks/$s.sh is missing (re-run the template's install.sh)." >&2
    exit 1
  fi
  checks+=("$s")
done
if [[ -f scripts/checks/local.sh && ( -z "$only" || "$only" == "local" ) ]]; then
  checks+=("local")
fi

if [[ ${#checks[@]} -eq 0 ]]; then
  echo "check: nothing to run. Add stacks to TEMPLATE_STACKS in .template/config or create scripts/checks/local.sh." >&2
  exit 1
fi

failed=()
for s in "${checks[@]}"; do
  printf '\n\033[1m▶ %s\033[0m\n' "$s"
  start=$SECONDS
  if bash "scripts/checks/$s.sh"; then
    printf '\033[32m✔ %s (%ss)\033[0m\n' "$s" "$((SECONDS - start))"
  else
    printf '\033[31m✘ %s (%ss)\033[0m\n' "$s" "$((SECONDS - start))"
    failed+=("$s")
  fi
done

echo
if [[ ${#failed[@]} -gt 0 ]]; then
  printf '\033[31mChecks failed: %s\033[0m\n' "${failed[*]}"
  exit 1
fi
printf '\033[32mAll checks passed.\033[0m\n'
