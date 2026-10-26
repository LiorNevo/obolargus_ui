# AGENTS.md — obolargus-ui

Operational rules for contributors and AI agents working in this app.

## Conventions

- TypeScript strict mode; no `any` except where unavoidable and justified.
- Styles and views layer onto `lx_client` (declared as a `file:` dep). Real
  application components may deep-import `lx_client/js/...` (matching the
  existing docs-runner usage); placeholder-only components must not import from
  `lx_client` until its npm entry is built.
- `pnpm lint` (ESLint, `--max-warnings=0`) and `pnpm test` must stay green.
- Keep the component render test and a Storybook story for the shell.

## Navigation and deep links

- `js/navigation/pages.tsx` is the single source of truth for pages. Routes and
  navigation entries are derived from it in `lx_client`; do not add links or
  routes anywhere else.
- Page paths are relative to the deployment base path. `js/config.ts` owns
  `BASE_PATH` (`/obolargus` by default) and the router applies it once through
  `basename`.
- The gateway strips `/obolargus` before proxying. The dev server keeps
  `historyApiFallback: true` so a copied deep link survives a full reload.
- `js/navigation/access.ts` holds the temporary permissive
  `UI_ACCESS_CONTEXT`. Authentication enforcement is deferred; replace that one
  constant when it lands. Do not declare another permissive context.
- Developer-only pages (for example `/__components`) stay resolvable by direct
  URL with `showInNavigation: false`.
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
