/**
 * Shared constants for the offline runtime.
 *
 * This module is imported by both the window bundle and the service worker, so
 * it must not reference DOM or worker globals.
 */

/** Prefix shared by every cache owned by this application. */
export const CACHE_NAME_PREFIX = "obolargus";

/** Middle segment of the Workbox-managed precache name. */
export const PRECACHE_CACHE_PREFIX = "precache";

/** Middle segment of the API runtime-cache name. */
export const API_CACHE_PREFIX = "api";

/** Middle segment of the static runtime-cache name. */
export const STATIC_CACHE_PREFIX = "static";

/** Maximum number of cached API read responses. */
export const API_MAX_ENTRIES = 100;

/** Maximum age of a cached API read, in seconds (24 hours). */
export const API_MAX_AGE_SECONDS = 86_400;

/** Maximum number of cached static assets. */
export const STATIC_MAX_ENTRIES = 60;

/** Maximum age of a cached static asset, in seconds (30 days). */
export const STATIC_MAX_AGE_SECONDS = 2_592_000;

/** Network timeout before an API read falls back to the cache. */
export const API_NETWORK_TIMEOUT_SECONDS = 3;

/** Interval between update checks while the app remains open. */
export const UPDATE_CHECK_INTERVAL_MS = 3_600_000;

/** Maximum age of a read that may still be shown while offline. */
export const OFFLINE_RETENTION_MS = 86_400_000;

/** Header carrying the epoch milliseconds when a response was confirmed. */
export const CACHED_AT_HEADER = "X-Obolargus-Cached-At";

/** Header marking a response as served from the runtime cache. */
export const FROM_CACHE_HEADER = "X-Obolargus-From-Cache";

/** BroadcastChannel name used to coordinate update activation across tabs. */
export const UPDATE_CHANNEL_NAME = "obolargus-pwa-update";

/** Message types exchanged between the window and the service worker. */
export const WORKER_MESSAGE = {
  clearCaches: "CLEAR_CACHES",
  skipWaiting: "SKIP_WAITING",
  getVersion: "GET_VERSION",
  cleanupRetiredCaches: "CLEANUP_RETIRED_CACHES",
  cachesCleared: "CACHES_CLEARED",
  cacheWriteFailed: "CACHE_WRITE_FAILED",
  cachePurged: "CACHE_PURGED",
  version: "VERSION",
} as const;

/** Update broadcast message types exchanged between tabs. */
export const UPDATE_MESSAGE = {
  available: "UPDATE_AVAILABLE",
  accepted: "UPDATE_ACCEPTED",
  pending: "UPDATE_PENDING",
  activated: "UPDATE_ACTIVATED",
  reloaded: "UPDATE_RELOADED",
  tabClosed: "UPDATE_TAB_CLOSED",
} as const;

/** Cache name for the versioned app-shell precache. */
export function precacheCacheName(scopeKey: string, buildId: string): string {
  return `${CACHE_NAME_PREFIX}-${PRECACHE_CACHE_PREFIX}-${scopeKey}-${buildId}`;
}

/** Cache name for runtime API reads. */
export function apiCacheName(scopeKey: string, buildId: string): string {
  return `${CACHE_NAME_PREFIX}-${API_CACHE_PREFIX}-${scopeKey}-${buildId}`;
}

/** Cache name for non-precached static assets. */
export function staticCacheName(scopeKey: string, buildId: string): string {
  return `${CACHE_NAME_PREFIX}-${STATIC_CACHE_PREFIX}-${scopeKey}-${buildId}`;
}
