/**
 * Reads cache provenance from HTTP response headers and maps it onto the
 * existing TanStack query identity.
 *
 * Only metadata is handled here; response bodies stay in Cache Storage.
 */
import {
  CACHED_AT_HEADER,
  FROM_CACHE_HEADER,
  OFFLINE_RETENTION_MS,
} from "./constants";
import type { ReadProvenanceRecord } from "./offlineStore";

/** Provenance read from one HTTP response. */
export interface ReadMeta {
  source: "network" | "cache";
  cachedAt: number | null;
  fetchedAt: number;
}

/** A cached response without a usable timestamp is malformed. */
export class OfflineProvenanceError extends Error {
  readonly code = "offline_provenance_invalid";

  constructor(message: string) {
    super(message);
    this.name = "OfflineProvenanceError";
  }
}

/**
 * Reads provenance headers from a response.
 *
 * A cache-served response must carry `X-Obolargus-Cached-At`; without it the
 * UI cannot honestly label the data, so the read fails explicitly.
 */
export function readResponseMeta(
  response: Response,
  now: number = Date.now(),
): ReadMeta {
  const fromCache = response.headers.get(FROM_CACHE_HEADER) === "1";
  const rawCachedAt = response.headers.get(CACHED_AT_HEADER);
  const cachedAt =
    rawCachedAt && Number.isFinite(Number(rawCachedAt))
      ? Number(rawCachedAt)
      : null;

  if (fromCache && cachedAt === null) {
    throw new OfflineProvenanceError(
      "A cached response is missing its last-updated timestamp.",
    );
  }

  return {
    source: fromCache ? "cache" : "network",
    cachedAt,
    fetchedAt: now,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(",")}}`;
}

/** Stable hash for a TanStack query key. */
export function hashQueryKey(queryKey: unknown): string {
  const text = stableStringify(queryKey);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Returns true when a read is older than the offline retention window. */
export function isProvenanceExpired(
  record: Pick<ReadProvenanceRecord, "cachedAt" | "fetchedAt">,
  now: number = Date.now(),
  maxAgeMs: number = OFFLINE_RETENTION_MS,
): boolean {
  const confirmedAt = record.cachedAt ?? record.fetchedAt;
  return now - confirmedAt > maxAgeMs;
}

/** Builds a store record from a response's metadata. */
export function toProvenanceRecord(
  queryKeyHash: string,
  requestUrl: string,
  meta: ReadMeta,
  offline: boolean,
): ReadProvenanceRecord {
  return {
    queryKeyHash,
    requestUrl,
    source: meta.source,
    cachedAt: meta.cachedAt,
    fetchedAt: meta.fetchedAt,
    offline: offline || meta.source === "cache",
  };
}
