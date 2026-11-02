/**
 * Pure cache policy for the offline runtime.
 *
 * The worker and the tests both import this module; it deliberately contains no
 * Workbox calls and no DOM or worker globals beyond the standard `URL`,
 * `Request`, and `Response` types.
 */
import {
  API_CACHE_PREFIX,
  API_MAX_AGE_SECONDS,
  API_MAX_ENTRIES,
  API_NETWORK_TIMEOUT_SECONDS,
  CACHE_NAME_PREFIX,
  PRECACHE_CACHE_PREFIX,
  STATIC_CACHE_PREFIX,
  STATIC_MAX_AGE_SECONDS,
  STATIC_MAX_ENTRIES,
  apiCacheName,
  precacheCacheName,
  staticCacheName,
} from "./constants";
import {
  computeScopeKey,
  isUnderBasePath,
  normalizeApiBasePath,
  normalizeBasePath,
} from "./paths";

/** The strategy that owns a route. */
export type CacheStrategy =
  | "precache"
  | "network-first"
  | "cache-first"
  | "navigation"
  | "never-cache";

/** Everything the worker needs to know about the current deployment. */
export interface PolicyContext {
  basePath: string;
  apiBasePath: string;
  buildId: string;
  origin?: string;
}

/** A request shape accepted by the pure matchers. */
export interface RequestLike {
  method: string;
  url: string;
  mode?: string;
  destination?: string;
}

/** One explicit cache policy, shared by the worker and the architecture docs. */
export interface CachePolicyDescriptor {
  id: string;
  strategy: CacheStrategy;
  cacheName: string | null;
  maxEntries: number | null;
  maxAgeSeconds: number | null;
  purgeOnQuotaError: boolean;
  networkTimeoutSeconds: number | null;
  exclusions: readonly string[];
}

/** Resolved cache names for one deployment. */
export interface CacheNames {
  precache: string;
  api: string;
  static: string;
}

const STATIC_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
]);

const EXCLUDED_API_PATTERNS: readonly RegExp[] = [
  /\/health(?:\/|$)/,
  /\/data-load\/history\/groups\/[^/]+\/progress(?:\/|$)/,
  /\/auth(?:\/|$)/,
  /\/login(?:\/|$)/,
  /\/logout(?:\/|$)/,
  /\/refresh(?:\/|$)/,
  /\/swagger-ui(?:\/|$)/,
];

const EXCLUDED_NAVIGATION_SUFFIXES = [
  "/service-worker.js",
  "/manifest.webmanifest",
  "/icons",
];

/** Resolves the three cache names for a deployment. */
export function cacheNamesFor(
  basePath: string,
  buildId: string,
): CacheNames {
  const scopeKey = computeScopeKey(basePath);
  return {
    precache: precacheCacheName(scopeKey, buildId),
    api: apiCacheName(scopeKey, buildId),
    static: staticCacheName(scopeKey, buildId),
  };
}

/** Returns true for a live, auth, or otherwise uncacheable API path. */
export function isExcludedApiPath(pathname: string): boolean {
  return EXCLUDED_API_PATTERNS.some((pattern) => pattern.test(pathname));
}

/** Returns true when a URL is on the application's own origin. */
export function isSameOrigin(url: string, origin?: string): boolean {
  if (!origin) return true;
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** Returns true for an eligible same-origin API read. */
export function isApiReadRequest(
  request: RequestLike,
  context: PolicyContext,
): boolean {
  if (request.method !== "GET") return false;
  if (!isSameOrigin(request.url, context.origin)) return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  const apiBasePath = normalizeApiBasePath(
    context.apiBasePath,
    context.basePath,
  );
  return (
    isUnderBasePath(url.pathname, apiBasePath) &&
    !isExcludedApiPath(url.pathname)
  );
}

/**
 * Returns true when a response may be stored as an offline read.
 *
 * The clone-and-parse check rejects malformed JSON even when the content type
 * claims otherwise. The body is never consumed from the caller's response.
 */
export async function isCacheableApiResponse(
  response: Response,
): Promise<boolean> {
  if (response.status !== 200) return false;
  if (response.type !== "basic") return false;
  if (response.redirected) return false;

  const cacheControl =
    response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (cacheControl.includes("no-store")) return false;
  if (cacheControl.includes("private")) return false;

  const contentType =
    response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    return false;
  }

  try {
    await response.clone().json();
    return true;
  } catch {
    return false;
  }
}

/** Returns true when a path must never receive the HTML shell. */
export function isExcludedNavigationPath(
  pathname: string,
  basePath: string,
): boolean {
  const base = normalizeBasePath(basePath);
  if (isUnderBasePath(pathname, normalizeApiBasePath(undefined, base))) {
    return true;
  }
  return EXCLUDED_NAVIGATION_SUFFIXES.some(
    (suffix) => pathname === `${base}${suffix}` || pathname.startsWith(`${base}${suffix}/`),
  );
}

/** Returns true for a navigation request that may receive the shell. */
export function isNavigationRequest(
  request: RequestLike,
  context: PolicyContext,
): boolean {
  if (request.mode !== "navigate") return false;
  if (!isSameOrigin(request.url, context.origin)) return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  return (
    isUnderBasePath(url.pathname, context.basePath) &&
    !isExcludedNavigationPath(url.pathname, context.basePath)
  );
}

/** Returns true for a non-precached same-origin static asset. */
export function isStaticAssetRequest(
  request: RequestLike,
  context: PolicyContext,
): boolean {
  if (request.method !== "GET") return false;
  if (!isSameOrigin(request.url, context.origin)) return false;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (!isUnderBasePath(url.pathname, context.basePath)) return false;
  if (isUnderBasePath(url.pathname, context.apiBasePath)) return false;
  const extension = url.pathname.split(".").pop()?.toLowerCase() ?? "";
  return (
    STATIC_EXTENSIONS.has(extension) ||
    request.destination === "image" ||
    request.destination === "font"
  );
}

/** Builds the explicit policy table used by the worker and the docs. */
export function buildCachePolicies(
  context: PolicyContext,
): CachePolicyDescriptor[] {
  const names = cacheNamesFor(context.basePath, context.buildId);
  return [
    {
      id: "app-shell",
      strategy: "precache",
      cacheName: names.precache,
      maxEntries: null,
      maxAgeSeconds: null,
      purgeOnQuotaError: false,
      networkTimeoutSeconds: null,
      exclusions: [],
    },
    {
      id: "api-read",
      strategy: "network-first",
      cacheName: names.api,
      maxEntries: API_MAX_ENTRIES,
      maxAgeSeconds: API_MAX_AGE_SECONDS,
      purgeOnQuotaError: true,
      networkTimeoutSeconds: API_NETWORK_TIMEOUT_SECONDS,
      exclusions: [
        "/health",
        "/data-load/history/groups/*/progress",
        "/auth/*",
        "/login",
        "/logout",
        "/refresh",
        "/swagger-ui/*",
      ],
    },
    {
      id: "static-asset",
      strategy: "cache-first",
      cacheName: names.static,
      maxEntries: STATIC_MAX_ENTRIES,
      maxAgeSeconds: STATIC_MAX_AGE_SECONDS,
      purgeOnQuotaError: true,
      networkTimeoutSeconds: null,
      exclusions: [],
    },
    {
      id: "navigation",
      strategy: "navigation",
      cacheName: names.precache,
      maxEntries: null,
      maxAgeSeconds: null,
      purgeOnQuotaError: false,
      networkTimeoutSeconds: null,
      exclusions: [
        "/api/*",
        "/service-worker.js",
        "/manifest.webmanifest",
        "/icons/*",
      ],
    },
    {
      id: "never-cache",
      strategy: "never-cache",
      cacheName: null,
      maxEntries: null,
      maxAgeSeconds: null,
      purgeOnQuotaError: false,
      networkTimeoutSeconds: null,
      exclusions: [
        "non-GET",
        "cross-origin",
        "no-store",
        "private",
        "errors",
        "opaque",
      ],
    },
  ];
}

/** Returns true when a cache name belongs to this application's runtime data. */
export function isRuntimeDataCacheName(name: string): boolean {
  return (
    name.startsWith(`${CACHE_NAME_PREFIX}-${API_CACHE_PREFIX}-`) ||
    name.startsWith(`${CACHE_NAME_PREFIX}-${STATIC_CACHE_PREFIX}-`)
  );
}

/** Returns true when a cache name is a precache owned by this application. */
export function isPrecacheCacheName(name: string): boolean {
  return name.startsWith(`${CACHE_NAME_PREFIX}-${PRECACHE_CACHE_PREFIX}-`);
}

/** Builds the request URL used by tests and diagnostics. */
export function requestUrl(pathname: string, origin = "https://example.test"): string {
  return new URL(pathname, origin).toString();
}
