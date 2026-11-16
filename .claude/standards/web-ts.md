# Web / TypeScript standards

> Managed by the dev template.

- TypeScript in `strict` mode. No `any` unless justified in a comment; prefer `unknown` and narrow it.
- `package.json` defines `lint`, `typecheck` (or a `tsconfig.json`) and `test` scripts; `./scripts/check.sh` runs them.
- Use the package manager matching the lockfile (pnpm, yarn, bun or npm). Never mix lockfiles.
- Tests: Vitest (or the project's existing runner) for units, Testing Library for components, Playwright for end-to-end.
  Test behaviour through public APIs and user-visible output, not implementation details.
- Validate external input (HTTP bodies, env vars, URL params) at the boundary, e.g. with zod.
- Env vars: document every one in `.env.example`. Never expose server secrets to client bundles
  (`NEXT_PUBLIC_`, `VITE_` prefixes are public).
- Accessibility: semantic HTML, labels on inputs, keyboard navigation, alt text.
- No `console.log` left in committed code (use the project's logger).
- Layering (see clean-code.md): components and route handlers stay thin; business logic lives in plain TS
  modules/services with injected dependencies (API clients, repositories) so it is unit-testable without the framework.
