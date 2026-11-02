import {
  OfflineProvenanceError,
  hashQueryKey,
  isProvenanceExpired,
  readResponseMeta,
  toProvenanceRecord,
} from "../responseProvenance";
import { CACHED_AT_HEADER, FROM_CACHE_HEADER } from "../constants";

function response(headers: Record<string, string>): Response {
  return { headers: new Headers(headers) } as unknown as Response;
}

describe("response provenance", () => {
  it("labels a network response", () => {
    expect(readResponseMeta(response({}), 100)).toEqual({
      source: "network",
      cachedAt: null,
      fetchedAt: 100,
    });
  });

  it("labels a cache response with its timestamp", () => {
    expect(
      readResponseMeta(
        response({
          [FROM_CACHE_HEADER]: "1",
          [CACHED_AT_HEADER]: "500",
        }),
        100,
      ),
    ).toEqual({ source: "cache", cachedAt: 500, fetchedAt: 100 });
  });

  it("fails explicitly when a cached response has no timestamp", () => {
    expect(() =>
      readResponseMeta(response({ [FROM_CACHE_HEADER]: "1" })),
    ).toThrow(OfflineProvenanceError);
  });

  it("hashes equivalent query keys identically", () => {
    const left = ["data-load", { domain: "market", limit: 50 }];
    const right = ["data-load", { limit: 50, domain: "market" }];
    expect(hashQueryKey(left)).toBe(hashQueryKey(right));
    expect(hashQueryKey(left)).not.toBe(
      hashQueryKey(["data-load", { domain: "holdings", limit: 50 }]),
    );
  });

  it("expires records beyond the retention window", () => {
    const record = { cachedAt: 1_000, fetchedAt: 1_000 };
    expect(isProvenanceExpired(record, 1_000 + 86_400_000)).toBe(false);
    expect(isProvenanceExpired(record, 1_000 + 86_400_001)).toBe(true);
  });

  it("builds a store record with cache semantics", () => {
    expect(
      toProvenanceRecord("hash", "url", {
        source: "cache",
        cachedAt: 5,
        fetchedAt: 6,
      }, false),
    ).toEqual({
      queryKeyHash: "hash",
      requestUrl: "url",
      source: "cache",
      cachedAt: 5,
      fetchedAt: 6,
      offline: true,
    });
  });
});
