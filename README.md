# obolargus-ui

React + TypeScript UI shell for the Obolargus platform, built on `lx_client`.
A git submodule of the parent Obolargus repository.

## Stack

- `webpack` + `ts-loader` (dev server on port 8081), `html-webpack-plugin`
- React 19 with the placeholder shell in `js/App.tsx`
- `zustand` store, REST client in `js/api/` (`API_BASE_URL` defaults to `/api`)
- Jest (`ts-jest`, Testing Library) for component tests
- ESLint 9 flat config; Storybook 8 (`@storybook/react-webpack5`)

## Scripts

| command | purpose |
| --- | --- |
| `pnpm start` | webpack dev server |
| `pnpm test` | Jest |
| `pnpm lint` | ESLint (`--max-warnings=0`) |
| `pnpm build` | production bundle to `dist/` |
| `pnpm storybook` | Storybook dev server |

From the parent repo: `make test|lint PROJ=obolargus-ui`.
