#!/usr/bin/env bash
# Helpers sourced by scripts/checks/<stack>.sh. Managed by the dev template.
set -u
root="${TEMPLATE_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
TEMPLATE_STACKS=""
# shellcheck disable=SC1091
[[ -f "$root/.template/config" ]] && . "$root/.template/config"

step() { printf '  → %s\n' "$*"; }
die()  { printf '  ✘ %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed. $2"; }
# run <label> <command...>: prints the label, runs the command, fails the check on error.
run()  { local label="$1"; shift; step "$label"; "$@" || die "$label failed"; }
# cd_stack <dir>: enter the stack's directory (relative to the repo root).
cd_stack() { cd "$root/$1" 2>/dev/null || die "directory '$1' not found (set it in .template/config)"; }
