#!/usr/bin/env bash
# PreToolUse hook (Bash): blocks commands that break the project's standards.
# Managed by the dev template. Exit 2 blocks the command and shows stderr to Claude.
# All regexes are kept in variables: inline regexes in [[ ]] parse differently across bash versions.
set -u
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)"
[[ -z "$cmd" ]] && exit 0
# Collapse whitespace and newlines so patterns match multi-line commands.
cmd="$(printf '%s' "$cmd" | tr '\n\t' '  ' | tr -s ' ')"

m() { [[ "$cmd" =~ $1 ]]; }

B='(^|[;&|( ]|\$\()'                         # start of a command
E='([ ;&|)"'"'"']|$)'                        # end of a token
G="${B}git( +-C +[^ ]+| +-c +[^ ]+| +--no-pager)* +"   # "git <global opts> " before a subcommand
A='([^;&|]* )?'                              # any arguments within the same command
TYPES='(feat|fix|chore|docs|refactor|test|perf|ci|build|hotfix|release)'
MANAGED='(\.githooks/|\.claude/hooks/|\.claude/settings\.json|scripts/check\.sh|scripts/docs-check\.sh|scripts/checks/|docs/WORKFLOW\.md)'

# --- Hook bypasses ----------------------------------------------------------
if [[ "$cmd" == *--no-verify* ]] || m "${G}commit ${A}-[a-zA-Z]*n[a-zA-Z]*${E}"; then
  block no-hook-bypass "skipping git hooks (--no-verify / -n) is not allowed. Fix what the hook reports instead."
fi
if m 'core\.hooksPath' && ! m "${G}config (--local )?--get core\.hooksPath${E}"; then
  block no-hook-bypass "changing core.hooksPath is not allowed. The template sets it to .githooks."
fi
if m "$MANAGED" && { m "${B}(rm|mv|cp|chmod|truncate|tee|sed -i|perl -pi)${E}" || m ">+ *[^ ]*${MANAGED}"; }; then
  block managed-files "the template's safeguard files are managed by the template. Ask the user to change them."
fi

# --- Protected branches -----------------------------------------------------
if on_protected_branch; then
  if m "${G}(commit|merge|cherry-pick|revert|am|rebase)${E}"; then
    block protected-branch "you are on '$(current_branch)'. Create a feature branch first: git switch -c feat/<short-description>"
  fi
  if m "${G}push${E}" && ! m "${G}push ${A}${TYPES}/"; then
    block protected-branch "pushing from '$(current_branch)' is not allowed. Work on a feature branch and open a PR."
  fi
fi
# Explicit push to a protected branch from anywhere ("origin main", "HEAD:main", "+main").
if m "${G}push ${A}[^ ]*[ :+](main|master)${E}"; then
  block protected-branch "pushing to main/master is not allowed. Open a pull request instead."
fi

# --- Force push ------------------------------------------------------------------
if m "${G}push ${A}(--force|--force-if-includes)${E}" || m "${G}push ${A}-[a-zA-Z]*f[a-zA-Z]*${E}" || m "${G}push ${A}\+[^ ]+"; then
  block no-force-push "force push is not allowed. If a rewrite is really needed on a feature branch, ask the user (git push --force-with-lease)."
fi

# --- Destructive git operations -----------------------------------------------
if m "${G}reset ${A}--hard" || m "${G}clean ${A}-[a-zA-Z]*f" \
   || m "${G}(checkout|restore) ${A}(-- )?\.${E}" || m "${G}stash (drop|clear)${E}" \
   || m "${G}branch ${A}-D ${A}(main|master)${E}"; then
  block no-destructive-git "this git command discards work. Explain what you want to do and ask the user to run it."
fi

# --- Dangerous deletes and privileges -------------------------------------------
if m "${B}(sudo )?rm ${A}-[a-zA-Z]*[rR]" \
   && m "${B}(sudo )?rm ${A}(/|/\*|~|~/|~/\*|\\\$HOME|\\\$HOME/|\"\\\$HOME\"|\.|\./|\.\.|\.\./|\*|/Users|/home|\.git)${E}"; then
  block no-dangerous-delete "recursive delete of a root, home, project or .git directory. Ask the user."
fi
if m "${B}sudo${E}"; then
  block no-sudo "sudo is not allowed. Ask the user to run privileged commands."
fi

# --- Remote code execution -----------------------------------------------------
if m "(curl|wget) [^;&]*\| *(sudo )?(ba|z)?sh${E}"; then
  block no-curl-pipe-shell "piping a download into a shell is not allowed. Download, inspect, then ask the user."
fi

# --- Secrets ----------------------------------------------------------------------
SECRET_FILE='[^ ;&|]*(\.env(\.[A-Za-z0-9_-]+)?|\.pem|\.key|\.jks|\.keystore|\.p12|\.p8|id_rsa|id_ed25519|key\.properties)'
if m "${B}(cat|less|more|head|tail|bat|strings|source|\.|xxd|od|base64|grep|rg|awk|sed|cp|scp|open) ${A}${SECRET_FILE}${E}" \
   && ! m "\.env\.(example|sample|template|dist)${E}"; then
  block secrets "reading secret files is not allowed. Use .env.example for the list of variables."
fi
if m "${B}(printenv|env|export -p|set)${E}" && ! m "${B}env [A-Za-z_]+=" && ! m "${B}set -"; then
  block secrets "dumping the environment may expose secrets. Check one variable instead, e.g. [ -n \"\$VAR\" ] && echo set."
fi

exit 0
