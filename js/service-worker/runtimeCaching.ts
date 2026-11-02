/**
 * Pure route descriptors for the service worker.
 *
 * No Workbox imports live here: the worker entry consumes these descriptors and
 * constructs the concrete strategies, while Jest can test the matching rules
 * directly.
 */
import {
  API_MAX_AGE_SECONDS,
  API_MAX_ENTRIES,
  API_NETWORK_TIMEOUT_SECONDS,
  STATIC_MAX_AGE_SECONDS,
  STATIC_MAX_ENTRIES,
} from "../offline/constants";
import {
  buildCachePolicies,
  isApiReadRequest,
  isNavigationRequest,
  isStaticAssetRequest,
  type CachePolicyDescriptor,
  type CacheStrategy,
  type PolicyContext,
  type RequestLike,
} from "../offline/cachePolicy";
import { normalizeBasePath } from "../offline/paths";

/** A route the worker can register. */
export interface RouteDescriptor {
  id: string;
  strategy: CacheStrategy;
  cacheName: string | null;
  matcher: (request: RequestLike) => boolean;
  maxEntries: number | null;
  maxAgeSeconds: number | null;
  purgeOnQuotaError: boolean;
  networkTimeoutSeconds: number | null;
}

/** Builds the API read route descriptor. */
export function apiRouteDescriptor(context: PolicyContext): RouteDescriptor {
  const policy = buildCachePolicies(context).find(
    (item) => item.id === "api-read",
  ) as CachePolicyDescriptor;
  return {
    id: policy.id,
    strategy: policy.strategy,
    cacheName: policy.cacheName,
    matcher: (request) => isApiReadRequest(request, context),
    maxEntries: API_MAX_ENTRIES,
    maxAgeSeconds: API_MAX_AGE_SECONDS,
    purgeOnQuotaError: true,
    networkTimeoutSeconds: API_NETWORK_TIMEOUT_SECONDS,
  };
}

/** Builds the non-precached static asset route descriptor. */
export function staticRouteDescriptor(context: PolicyContext): RouteDescriptor {
  const policy = buildCachePolicies(context).find(
    (item) => item.id === "static-asset",
  ) as CachePolicyDescriptor;
  return {
    id: policy.id,
    strategy: policy.strategy,
    cacheName: policy.cacheName,
    matcher: (request) => isStaticAssetRequest(request, context),
    maxEntries: STATIC_MAX_ENTRIES,
    maxAgeSeconds: STATIC_MAX_AGE_SECONDS,
    purgeOnQuotaError: true,
    networkTimeoutSeconds: null,
  };
}

/** Builds the navigation fallback descriptor (registered through NavigationRoute). */
export function navigationRouteDescriptor(
  context: PolicyContext,
): RouteDescriptor {
  return {
    id: "navigation",
    strategy: "navigation",
    cacheName: null,
    matcher: (request) => isNavigationRequest(request, context),
    maxEntries: null,
    maxAgeSeconds: null,
    purgeOnQuotaError: false,
    networkTimeoutSeconds: null,
  };
}

/**
 * Builds every runtime route in registration order.
 *
 * The precache route is registered separately and first, so it is not included
 * here.
 */
export function buildRouteDescriptors(
  context: PolicyContext,
): RouteDescriptor[] {
  return [
    apiRouteDescriptor(context),
    staticRouteDescriptor(context),
    navigationRouteDescriptor(context),
  ];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** RegExp denylist for the navigation fallback. */
export function navigationDenylist(basePath: string): RegExp[] {
  const base = escapeRegExp(normalizeBasePath(basePath));
  return [
    new RegExp(`^${base}/api(?:/|$)`),
    new RegExp(`^${base}/service-worker\\.js$`),
    new RegExp(`^${base}/manifest\\.webmanifest$`),
    new RegExp(`^${base}/icons(?:/|$)`),
  ];
}
