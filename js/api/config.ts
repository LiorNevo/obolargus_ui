/**
 * Client-side runtime configuration.
 *
 * `API_BASE_URL` defaults to `/api`, which the gateway routes to the
 * obolargus-server REST API. See
 * `specs/001-boilerplate-submodules/contracts/config-contract.md`.
 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.API_BASE_URL) || "/api";
