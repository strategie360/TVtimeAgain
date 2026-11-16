#!/usr/bin/env bash
# Shared helpers for the template's Claude Code hooks. Managed by the dev template.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROTECTED_BRANCHES_RE='^(main|master)$'

# block <rule-id> <message>: explain and block the tool call (exit code 2 = blocking error).
# Every rule id is documented in docs/WORKFLOW.md.
block() {
  printf 'BLOCKED by project rule [%s]: %s\nRule explained in docs/WORKFLOW.md.\n' "$1" "$2" >&2
  exit 2
}

current_branch() {
  git -C "$PROJECT_DIR" branch --show-current 2>/dev/null
}

# True when the repo has at least one commit (an unborn main may get its initial commit).
has_commits() {
  git -C "$PROJECT_DIR" rev-parse --verify -q HEAD >/dev/null 2>&1
}

on_protected_branch() {
  local b
  b="$(current_branch)"
  [[ -n "$b" && "$b" =~ $PROTECTED_BRANCHES_RE ]] && has_commits
}

# True for secret-looking file names. Example/sample/template env files are allowed.
is_secret_path() {
  local name
  name="$(basename -- "$1")"
  case "$name" in
    .env.example|.env.sample|.env.template|.env.dist|*.example|*.sample) return 1 ;;
    .env|.env.*|*.env) return 0 ;;
    *.pem|*.key|*.p12|*.pfx|*.jks|*.keystore|*.mobileprovision|*.p8) return 0 ;;
    id_rsa|id_rsa.*|id_ed25519|id_ed25519.*|id_ecdsa|id_ecdsa.*) return 0 ;;
    .npmrc|.pypirc|.netrc|credentials|credentials.json|service-account*.json) return 0 ;;
    key.properties|local.properties|secrets.properties) return 0 ;;
  esac
  return 1
}
