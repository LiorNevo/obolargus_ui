/**
 * Browser-visible mount path of the UI behind `obolargus_gateway`.
 *
 * The browser keeps `/obolargus` in every URL, while the gateway strips the
 * prefix before proxying to the UI server. The router therefore receives this
 * value as `basename` exactly once; page paths never include it.
 */
export const BASE_PATH: string =
  (typeof process !== "undefined" && process.env.BASE_PATH) || "/obolargus";
