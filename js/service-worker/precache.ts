/**
 * Pure precache filtering and retired-cache selection.
 */
import {
  CACHE_NAME_PREFIX,
  API_CACHE_PREFIX,
  PRECACHE_CACHE_PREFIX,
  STATIC_CACHE_PREFIX,
} from "../offline/constants";
import { normalizeBasePath } from "../offline/paths";

/** One entry in the injected precache manifest. */
export interface PrecacheEntry {
  url: string;
  revision?: string;
}

const EXCLUDED_PATTERNS: readonly RegExp[] = [
  /\.map$/,
  /\.LICENSE\.txt$/,
  /(?:^|\/)docs-runner\//,
  /(?:^|\/)service-worker\.js$/,
];

function isExcluded(url: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(url));
}

function normalizeUrl(url: string, basePath: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = normalizeBasePath(basePath);
  if (url.startsWith("/")) return url;
  return `${base}/${url.replace(/^\/+/, "")}`;
}

/**
 * Filters the injected manifest to the application shell.
 *
 * `index.html` is always required; entries outside the deployment base path are
 * dropped rather than served under the wrong scope.
 */
export function filterPrecacheManifest(
  entries: ReadonlyArray<{ url: string; revision?: string | null }>,
  basePath: string,
): PrecacheEntry[] {
  const base = normalizeBasePath(basePath);
  const seen = new Set<string>();
  const result: PrecacheEntry[] = [];

  for (const entry of entries) {
    const url = normalizeUrl(entry.url, base);
    if (isExcluded(url)) continue;
    if (base && !(url === base || url.startsWith(`${base}/`))) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    result.push({
      url,
      revision: entry.revision ?? undefined,
    });
  }

  return result;
}

/** Returns true when a cache name is for this scope but an older build. */
export function isRetiredCacheName(
  name: string,
  scopeKey: string,
  activeBuildId: string,
): boolean {
  const ownedPrefixes = [
    `${CACHE_NAME_PREFIX}-${PRECACHE_CACHE_PREFIX}-`,
    `${CACHE_NAME_PREFIX}-${API_CACHE_PREFIX}-`,
    `${CACHE_NAME_PREFIX}-${STATIC_CACHE_PREFIX}-`,
  ];
  if (!ownedPrefixes.some((prefix) => name.startsWith(prefix))) return false;

  const marker = `-${scopeKey}-`;
  const index = name.lastIndexOf(marker);
  if (index === -1) return false;
  const buildId = name.slice(index + marker.length);
  return buildId !== activeBuildId;
}

/** Selects every cache that belongs to this scope but not this build. */
export function selectRetiredCacheNames(
  names: readonly string[],
  scopeKey: string,
  activeBuildId: string,
): string[] {
  return names.filter((name) =>
    isRetiredCacheName(name, scopeKey, activeBuildId),
  );
}
