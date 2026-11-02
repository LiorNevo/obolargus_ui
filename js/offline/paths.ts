/**
 * Base-path and API-path normalisation for the offline runtime.
 *
 * The browser sees the application under `BASE_PATH` while the gateway strips
 * that prefix before proxying. Every URL the worker registers or precaches must
 * therefore use the browser-visible path. These helpers are pure so the same
 * rules can be tested without a worker.
 */

/** Default browser-visible mount path. */
export const DEFAULT_BASE_PATH = "/obolargus";

/**
 * Normalises a mount path to a leading slash and no trailing slash.
 *
 * @param value - Configured base path, if any.
 * @returns Normalised path, or an empty string for the origin root.
 */
export function normalizeBasePath(value?: string | null): string {
  const raw = (value ?? DEFAULT_BASE_PATH).trim();
  if (!raw || raw === "/") return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/, "");
}

/**
 * Normalises the API mount path, defaulting to `${basePath}/api`.
 *
 * @param value - Configured API base URL, if any.
 * @param basePath - Configured application base path.
 * @returns Normalised API path without a trailing slash.
 */
export function normalizeApiBasePath(
  value?: string | null,
  basePath?: string | null,
): string {
  const base = normalizeBasePath(basePath);
  const raw = (value ?? `${base}/api`).trim();
  if (!raw || raw === "/") return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/, "");
}

/**
 * Returns true when `pathname` is the base path itself or a descendant.
 *
 * @param pathname - Browser-visible pathname.
 * @param basePath - Normalised or raw base path.
 */
export function isUnderBasePath(
  pathname: string,
  basePath?: string | null,
): boolean {
  const base = normalizeBasePath(basePath);
  if (!base) return pathname.startsWith("/");
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Builds a short, stable cache-scope key from the base path.
 *
 * @param basePath - Browser-visible base path.
 */
export function computeScopeKey(basePath?: string | null): string {
  const value = normalizeBasePath(basePath);
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Resolves the build id used in cache names.
 *
 * @param override - Explicit build id, if one was supplied.
 */
export function resolveBuildId(override?: string | null): string {
  const value = (override ?? process.env.OBOLARGUS_BUILD_ID ?? "").trim();
  return value || "dev";
}

/** Browser-visible application base path for this build. */
export const BASE_PATH: string = normalizeBasePath(process.env.BASE_PATH);

/** Browser-visible API base path for this build. */
export const API_BASE_PATH: string = normalizeApiBasePath(
  process.env.API_BASE_URL,
  BASE_PATH,
);

/** Build identity used in cache names. */
export const BUILD_ID: string = resolveBuildId(process.env.OBOLARGUS_BUILD_ID);

/** Short scope key derived from the base path. */
export const SCOPE_KEY: string = computeScopeKey(BASE_PATH);

/** Root URL of the installed application. */
export const APP_ROOT: string = BASE_PATH ? `${BASE_PATH}/` : "/";
