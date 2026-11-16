#!/usr/bin/env bash
# web-ts checks: lint, typecheck, tests. Managed by the dev template.
# Uses package.json scripts "lint", "typecheck" and "test" when they exist.
# shellcheck source=_common.sh
. "$(dirname "$0")/_common.sh"
cd_stack "${WEB_TS_DIR:-.}"
[[ -f package.json ]] || die "no package.json in ${WEB_TS_DIR:-.}"
need node "Install Node.js (https://nodejs.org) or use your version manager."

if   [[ -f pnpm-lock.yaml ]]; then pm=pnpm
elif [[ -f yarn.lock ]];      then pm=yarn
elif [[ -f bun.lockb || -f bun.lock ]]; then pm=bun
else pm=npm
fi
need "$pm" "This project uses $pm."

has_script() { node -e "const s=require('./package.json').scripts||{};process.exit(s[process.argv[1]]?0:1)" "$1"; }

if [[ ! -d node_modules ]]; then
  if [[ -n "${CI:-}" ]]; then
    case $pm in
      npm)  run "install ($pm)" npm ci ;;
      pnpm) run "install ($pm)" pnpm install --frozen-lockfile ;;
      yarn) run "install ($pm)" yarn install --immutable ;;
      bun)  run "install ($pm)" bun install --frozen-lockfile ;;
    esac
  else
    run "install ($pm)" "$pm" install
  fi
fi

export CI="${CI:-true}" # keeps test runners (vitest, jest) out of watch mode

if has_script lint; then run "lint" "$pm" run lint
else step "lint: no \"lint\" script, skipped"; fi

if has_script typecheck; then run "typecheck" "$pm" run typecheck
elif [[ -f tsconfig.json ]]; then run "typecheck (tsc --noEmit)" "$pm" exec tsc --noEmit
else step "typecheck: no tsconfig.json, skipped"; fi

has_script test || die "no \"test\" script in package.json. Every project needs tests (e.g. vitest)."
run "test" "$pm" run test
