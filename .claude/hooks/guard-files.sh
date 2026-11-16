#!/usr/bin/env bash
# PreToolUse hook (Read|Edit|Write|MultiEdit|NotebookEdit).
# - blocks access to secret files
# - blocks edits to the template's safeguard files
# - blocks edits inside the project while on main/master
# Managed by the dev template. Exit 2 blocks the call and shows stderr to Claude.
set -u
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null)"
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' 2>/dev/null)"
[[ -z "$path" ]] && exit 0

if is_secret_path "$path"; then
  block secrets "'$(basename -- "$path")' looks like a secret file. Do not read or write it; use .env.example for variable names and ask the user for values."
fi

[[ "$tool" == "Read" ]] && exit 0

# Resolve to an absolute path to know whether it is inside the project.
case "$path" in
  /*) abs="$path" ;;
  *)  abs="$PROJECT_DIR/$path" ;;
esac
project_real="$(cd "$PROJECT_DIR" 2>/dev/null && pwd -P)"
abs_dir="$(cd "$(dirname -- "$abs")" 2>/dev/null && pwd -P || dirname -- "$abs")"
abs="$abs_dir/$(basename -- "$abs")"

case "$abs" in
  "$project_real"/*) ;;
  *) exit 0 ;; # outside the project (scratch files, memory, ...): not our business
esac
rel="${abs#"$project_real"/}"

case "$rel" in
  .claude/settings.json|.claude/hooks/*|.githooks/*|scripts/check.sh|scripts/docs-check.sh|scripts/checks/*|.claude/standards/*|.template/version|docs/WORKFLOW.md)
    block managed-files "'$rel' is managed by the dev template (changes are overwritten by install.sh). Propose the change to the user instead."
    ;;
esac

if on_protected_branch; then
  block protected-branch "you are on '$(current_branch)'. Create a feature branch before editing: git switch -c feat/<short-description>"
fi

exit 0
