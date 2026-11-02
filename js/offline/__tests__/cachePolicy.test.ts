import {
  buildCachePolicies,
  cacheNamesFor,
  isApiReadRequest,
  isCacheableApiResponse,
  isExcludedApiPath,
  isExcludedNavigationPath,
  isNavigationRequest,
  isPrecacheCacheName,
  isRuntimeDataCacheName,
  isSameOrigin,
  isStaticAssetRequest,
  type PolicyContext,
} from "../cachePolicy";
import {
  API_MAX_AGE_SECONDS,
  API_MAX_ENTRIES,
  STATIC_MAX_AGE_SECONDS,
  STATIC_MAX_ENTRIES,
} from "../constants";

const ORIGIN = "https://example.test";
const context: PolicyContext = {
  basePath: "/obolargus",
  apiBasePath: "/obolargus/api",
  buildId: "build-1",
  origin: ORIGIN,
};

function makeResponse(
  body: unknown,
  options: {
    status?: number;
    type?: string;
    redirected?: boolean;
    headers?: Record<string, string>;
    malformed?: boolean;
  } = {},
): Response {
  const headers = new Headers(options.headers);
  const clone = {
    headers,
    json: async () => {
      if (options.malformed) throw new SyntaxError("bad json");
      return body;
    },
  } as unknown as Response;
  return {
    status: options.status ?? 200,
    type: options.type ?? "basic",
    redirected: options.redirected ?? false,
    headers,
    clone: () => clone,
  } as unknown as Response;
}

function request(
  path: string,
  overrides: Partial<{
    method: string;
    mode: string;
    destination: string;
  }> = {},
): { method: string; url: string; mode?: string; destination?: string } {
  return {
    method: overrides.method ?? "GET",
    url: `${ORIGIN}${path}`,
    mode: overrides.mode,
    destination: overrides.destination,
  };
}

describe("cache names", () => {
  it("includes the scope key and build id", () => {
    const names = cacheNamesFor("/obolargus", "build-1");
    expect(names.precache).toMatch(/^obolargus-precache-[a-z0-9]+-build-1$/);
    expect(names.api).toMatch(/^obolargus-api-[a-z0-9]+-build-1$/);
    expect(names.static).toMatch(/^obolargus-static-[a-z0-9]+-build-1$/);
  });

  it("changes names with the build id", () => {
    expect(cacheNamesFor("/obolargus", "v1").api).not.toBe(
      cacheNamesFor("/obolargus", "v2").api,
    );
  });

  it("classifies owned cache names", () => {
    expect(isRuntimeDataCacheName("obolargus-api-scope-v1")).toBe(true);
    expect(isRuntimeDataCacheName("obolargus-static-scope-v1")).toBe(true);
    expect(isRuntimeDataCacheName("obolargus-precache-scope-v1")).toBe(false);
    expect(isPrecacheCacheName("obolargus-precache-scope-v1")).toBe(true);
  });
});

describe("request eligibility", () => {
  it("accepts same-origin API reads", () => {
    expect(isApiReadRequest(request("/obolargus/api/assets?q=AAPL"), context)).toBe(
      true,
    );
  });

  it("rejects writes", () => {
    expect(
      isApiReadRequest(request("/obolargus/api/load", { method: "POST" }), context),
    ).toBe(false);
  });

  it("rejects cross-origin requests", () => {
    expect(
      isApiReadRequest(
        { method: "GET", url: "https://other.test/obolargus/api/assets" },
        context,
      ),
    ).toBe(false);
  });

  it("rejects paths outside the API mount", () => {
    expect(isApiReadRequest(request("/obolargus/assets"), context)).toBe(false);
  });

  it.each([
    "/obolargus/api/health",
    "/obolargus/api/data-load/history/groups/g1/progress",
    "/obolargus/api/auth/session",
    "/obolargus/api/login",
    "/obolargus/api/logout",
    "/obolargus/api/refresh",
    "/obolargus/api/swagger-ui/index.html",
  ])("excludes live/auth path %s", (path) => {
    expect(isExcludedApiPath(path)).toBe(true);
    expect(isApiReadRequest(request(path), context)).toBe(false);
  });

  it("checks origin comparison", () => {
    expect(isSameOrigin(`${ORIGIN}/a`, ORIGIN)).toBe(true);
    expect(isSameOrigin("https://other.test/a", ORIGIN)).toBe(false);
    expect(isSameOrigin("not a url", ORIGIN)).toBe(false);
  });
});

describe("response eligibility", () => {
  it("accepts a successful JSON response", async () => {
    await expect(
      isCacheableApiResponse(
        makeResponse({ ok: true }, {
          headers: { "content-type": "application/json" },
        }),
      ),
    ).resolves.toBe(true);
  });

  it("accepts a +json content type", async () => {
    await expect(
      isCacheableApiResponse(
        makeResponse({}, {
          headers: { "content-type": "application/vnd.api+json" },
        }),
      ),
    ).resolves.toBe(true);
  });

  it.each([
    ["non-200", { status: 404 }],
    ["opaque", { type: "opaque" }],
    ["redirected", { redirected: true }],
  ])("rejects a %s response", async (_label, options) => {
    await expect(
      isCacheableApiResponse(
        makeResponse({}, {
          ...options,
          headers: { "content-type": "application/json" },
        } as never),
      ),
    ).resolves.toBe(false);
  });

  it.each(["no-store", "private"])(
    "rejects a cache-control %s response",
    async (directive) => {
      await expect(
        isCacheableApiResponse(
          makeResponse({}, {
            headers: {
              "content-type": "application/json",
              "cache-control": directive,
            },
          }),
        ),
      ).resolves.toBe(false);
    },
  );

  it("rejects non-JSON and malformed bodies", async () => {
    await expect(
      isCacheableApiResponse(
        makeResponse({}, { headers: { "content-type": "text/html" } }),
      ),
    ).resolves.toBe(false);
    await expect(
      isCacheableApiResponse(
        makeResponse(null, {
          headers: { "content-type": "application/json" },
          malformed: true,
        }),
      ),
    ).resolves.toBe(false);
  });
});

describe("navigation and static routes", () => {
  it("accepts a navigation below the base path", () => {
    expect(
      isNavigationRequest(
        request("/obolargus/data-load", { mode: "navigate" }),
        context,
      ),
    ).toBe(true);
  });

  it("rejects API, worker, manifest, and icon navigations", () => {
    for (const path of [
      "/obolargus/api/assets",
      "/obolargus/service-worker.js",
      "/obolargus/manifest.webmanifest",
      "/obolargus/icons/icon-192.png",
    ]) {
      expect(
        isNavigationRequest(request(path, { mode: "navigate" }), context),
      ).toBe(false);
      expect(isExcludedNavigationPath(path, "/obolargus")).toBe(true);
    }
  });

  it("rejects non-navigation and cross-origin requests", () => {
    expect(isNavigationRequest(request("/obolargus/a"), context)).toBe(false);
    expect(
      isNavigationRequest(
        { method: "GET", url: "https://other.test/obolargus/a", mode: "navigate" },
        context,
      ),
    ).toBe(false);
  });

  it("accepts static assets and rejects API/HTML", () => {
    expect(
      isStaticAssetRequest(
        request("/obolargus/images/logo.png", { destination: "image" }),
        context,
      ),
    ).toBe(true);
    expect(
      isStaticAssetRequest(request("/obolargus/fonts/ui.woff2"), context),
    ).toBe(true);
    expect(
      isStaticAssetRequest(request("/obolargus/api/data.json"), context),
    ).toBe(false);
    expect(
      isStaticAssetRequest(request("/obolargus/index.html"), context),
    ).toBe(false);
  });
});

describe("policy table", () => {
  it("defines explicit bounds for every runtime class", () => {
    const policies = buildCachePolicies(context);
    const api = policies.find((policy) => policy.id === "api-read");
    const stat = policies.find((policy) => policy.id === "static-asset");
    expect(api).toMatchObject({
      maxEntries: API_MAX_ENTRIES,
      maxAgeSeconds: API_MAX_AGE_SECONDS,
      networkTimeoutSeconds: 3,
      purgeOnQuotaError: true,
    });
    expect(stat).toMatchObject({
      maxEntries: STATIC_MAX_ENTRIES,
      maxAgeSeconds: STATIC_MAX_AGE_SECONDS,
      purgeOnQuotaError: true,
    });
    expect(policies.map((policy) => policy.id)).toEqual([
      "app-shell",
      "api-read",
      "static-asset",
      "navigation",
      "never-cache",
    ]);
  });
});
