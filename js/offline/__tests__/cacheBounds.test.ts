import {
  API_MAX_AGE_SECONDS,
  API_MAX_ENTRIES,
  STATIC_MAX_AGE_SECONDS,
  STATIC_MAX_ENTRIES,
} from "../constants";
import { buildCachePolicies } from "../cachePolicy";

describe("cache bounds", () => {
  const policies = buildCachePolicies({
    basePath: "/obolargus",
    apiBasePath: "/obolargus/api",
    buildId: "b1",
  });

  it("bounds API reads to 100 entries and 24 hours", () => {
    expect(policies.find((policy) => policy.id === "api-read")).toMatchObject({
      maxEntries: API_MAX_ENTRIES,
      maxAgeSeconds: API_MAX_AGE_SECONDS,
      purgeOnQuotaError: true,
    });
    expect(API_MAX_ENTRIES).toBe(100);
    expect(API_MAX_AGE_SECONDS).toBe(86_400);
  });

  it("bounds static assets to 60 entries and 30 days", () => {
    expect(
      policies.find((policy) => policy.id === "static-asset"),
    ).toMatchObject({
      maxEntries: STATIC_MAX_ENTRIES,
      maxAgeSeconds: STATIC_MAX_AGE_SECONDS,
      purgeOnQuotaError: true,
    });
    expect(STATIC_MAX_ENTRIES).toBe(60);
    expect(STATIC_MAX_AGE_SECONDS).toBe(2_592_000);
  });

  it("does not bound the app-shell precache by entry count", () => {
    expect(policies.find((policy) => policy.id === "app-shell")).toMatchObject({
      maxEntries: null,
      maxAgeSeconds: null,
    });
  });
});
