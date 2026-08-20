# AGENTS.md — obolargus-ui

Operational rules for contributors and AI agents working in this app.

## Conventions

- TypeScript strict mode; no `any` except where unavoidable and justified.
- Styles and views will layer onto `lx_client` (declared as a `file:` dep);
  placeholder-only components must not import from `lx_client` until its npm
  entry is built.
- `pnpm lint` (ESLint, `--max-warnings=0`) and `pnpm test` must stay green.
- Keep the component render test and a Storybook story for the shell.
- Runtime config (e.g. `API_BASE_URL`) goes through `js/api/config.ts` env
  wiring (`process.env.API_BASE_URL`), defaulting to `/api`.

## Contract notes

- Health-check wiring follows `contracts/health-check.md`;
  `js/api/client.ts` targets `${API_BASE_URL}/health`.
- `pnpm-workspace.yaml` approves `esbuild` and `@swc/core` build scripts
  (pnpm 11 `allowBuilds`).

## Commands

- Test: `pnpm test`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Storybook: `pnpm storybook`
