/**
 * Client-side runtime configuration.
 *
 * `API_BASE_URL` defaults to `/obolargus/api`, which the gateway
 * reverse-proxies to the obolargus-server REST API. The path moved
 * from `/api` to `/obolargus/api` in spec 007 (gateway path-based
 * routing) so the UI and its API share the same origin behind the
 * gateway in both develop and production modes (SC-003).
 */
export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.API_BASE_URL) ||
  "/obolargus/api";
