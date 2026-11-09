# AGENTS.md — obolargus-ui

Operational rules for contributors and AI agents working in this app.

## Conventions

- TypeScript strict mode; no `any` except where unavoidable and justified.
- Use `lx_client` components whenever an equivalent exists. Do not reimplement
  tables, buttons, inputs, selects, dialogs, navigation, icons, loading states,
  skeletons, or other shared primitives in `obolargus_ui`; add missing
  components to `lx_client` and consume them from there.
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

## Data fetching and caching

- Every upstream read goes through the shared TanStack Query cache in
  `js/query/`. Pages and components must not call read functions from `js/api/`
  directly or start their own read `useEffect`.
- Query keys are defined only in `js/query/keys.ts`. Add every
  response-changing parameter to the key and use the existing namespace/prefix
  helpers for invalidation.
- Freshness and retention are explicit per query class. The current policy is:
  catalogs 60s/10m, history 30s/10m, asset search 5m/10m, market series
  5m/15m, and range progress 0s/30s with 2s polling until terminal.
- Writes remain mutations in `js/query/mutations.ts` and invalidate through
  `js/query/invalidation.ts`. Never clear the whole cache for one mutation.
- The cache is memory-only and per browser tab. Do not persist server responses
  to IndexedDB, localStorage, or sessionStorage; durable UI state remains in
  Zustand stores.
- `App` supplies one `QueryClientProvider`. Tests and stories use
  `js/query/testUtils.tsx` so each case receives a fresh cache.
- To add a cached read: add a key, add a query option/hook with an explicit
  freshness policy, add invalidation if a mutation affects it, and update
  `specs/architecture/architecture.md` when the ownership boundary changes.

## Offline and PWA

- Offline support is read-only. Writes call `assertOnlineForWrite()` in
  `js/query/mutations.ts`; never add a background-sync or mutation queue.
- Cache policy is defined once in `js/offline/cachePolicy.ts`. The service
  worker (`js/service-worker/service-worker.ts`) consumes it; do not duplicate
  request/response rules in the worker or a page.
- Runtime caches are bounded (`api`: 100 entries / 24 h, `static`: 60 / 30 d)
  and scoped by origin, base path, and build id. Never use a stable,
  unversioned cache name.
- Server response bodies belong only in Cache Storage. Do not copy them into
  Zustand, IndexedDB, localStorage, or sessionStorage. Connectivity, provenance,
  and update state use the memory-only `js/offline/offlineStore.ts`.
- The worker never calls `clientsClaim()` and never calls `skipWaiting()` at
  install. Activation is confirmation-based and coordinated across tabs; keep
  the previous precache until every announced tab reloads or closes.
- The production worker is registered only in production and only when
  `navigator.serviceWorker` exists in a secure context. Development, Storybook,
  and the docs runner must not register it.
- lx_client's compiled theme CSS is emitted as `theme-registry.css` by
  `scripts/theme-css.js` and linked from `index.html`. The app uses
  `js/theme/AppThemeProvider.tsx`; do not import the JS theme registry into the
  main entrypoint, or the initial bundle grows by ~400 KiB.
- Production aliases `tslog` to `js/shims/tslog.ts` and uses react-router's
  production bundle. Keep the shim's six log-level methods compatible with
  lx_client's logger.
- Material Symbols is subset to the icon names listed in
  `scripts/subset-icons.mjs` and served from
  `js/styles/fonts/material-symbols-outlined-subset.woff2`. Add the name to that
  list and run `pnpm subset:icons` whenever a new icon is introduced; the build
  verification rejects an unsubset font.

## Contract notes

- Health-check wiring follows `contracts/health-check.md`;
  `js/api/client.ts` targets `${API_BASE_URL}/health`.
- `pnpm-workspace.yaml` approves `esbuild` and `@swc/core` build scripts
  (pnpm 11 `allowBuilds`).

## Commands

- Test: `pnpm test` (coverage: `pnpm test --coverage`)
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck` and `pnpm typecheck:sw`
- Build: `pnpm build` (production; performance budgets apply here)
- Verify PWA output: `pnpm verify:pwa`
- Serve the production build locally: `pnpm serve:prod`
- Storybook: `pnpm storybook`

## Automation pages (spec 030)

- `js/pages/automation/` composes the reusable
  `lx_client/js/components/FlowEditor` and the SchemaForm adapters in
  `DataLoadNodeFields.tsx`.
- `/automation` is the entry point: it opens the most recently updated active
  flow in the editor, or falls back to the flow list when no active flow
  exists. The list/create/template surface lives at `/automation/flows`.
- The editor's workspace tab strip is the flow switcher: every active flow is a
  tab, and the current flow's subflows follow it. Adding a tab opens the flow
  list with the create field focused.
- Reads go through `js/query/automationQueries.ts`; writes go through
  `js/query/mutations.ts`. Add keys only in `js/query/keys.ts`.
- The editor is a controlled component: keep the draft document in the page,
  persist through mutations, and guard dirty state on navigation and unload.
- The authoring page fills the viewport: the editor is the flex child that
  absorbs remaining height. Details, versions, triggers, context, audit,
  subflows, publish, and run live in modals so the page never scrolls while
  editing.
- Page-level feedback uses `lx_client/js/components/Toast` through
  `ToastRegion`; notices auto-dismiss and are closable, while errors persist
  until dismissed. Do not add another inline notice bar.
- Inject nodes show a manual run button supplied by the host. It starts the
  published flow at that inject node (`inject_node_id`) and runs every
  downstream node. The editor stays open: the flow bar shows live run status,
  the Debug sidebar opens, and run logs (including debug-node output) stream
  into it. Required flow inputs open the existing Run modal first; unsaved
  nodes are not in the published version and surface a clear API error.
- `FlowEditorPage` hydrates its draft once per flow id. Background refetches
  after save/publish must not overwrite local edits; conflicts surface a
  reload-latest action instead.
