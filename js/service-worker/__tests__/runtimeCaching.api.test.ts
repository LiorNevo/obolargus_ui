import { apiRouteDescriptor, staticRouteDescriptor } from "../runtimeCaching";

const context = {
  basePath: "/obolargus",
  apiBasePath: "/obolargus/api",
  buildId: "b1",
  origin: "https://example.test",
};

function request(
  path: string,
  overrides: Partial<{ method: string; destination: string }> = {},
) {
  return {
    method: overrides.method ?? "GET",
    url: `https://example.test${path}`,
    mode: "cors",
    destination: overrides.destination,
  };
}

describe("API route descriptor", () => {
  it("uses network-first with the three-second timeout and bounds", () => {
    const route = apiRouteDescriptor(context);
    expect(route).toMatchObject({
      strategy: "network-first",
      networkTimeoutSeconds: 3,
      maxEntries: 100,
      maxAgeSeconds: 86_400,
      purgeOnQuotaError: true,
    });
    expect(route.cacheName).toMatch(/^obolargus-api-/);
  });

  it("matches eligible reads only", () => {
    const route = apiRouteDescriptor(context);
    expect(route.matcher(request("/obolargus/api/assets?q=AAPL"))).toBe(true);
    expect(route.matcher(request("/obolargus/api/assets", { method: "POST" }))).toBe(
      false,
    );
    expect(route.matcher(request("/obolargus/api/health"))).toBe(false);
    expect(
      route.matcher(
        request("/obolargus/api/data-load/history/groups/g1/progress"),
      ),
    ).toBe(false);
    expect(route.matcher(request("/obolargus/api/auth/session"))).toBe(false);
    expect(route.matcher(request("/obolargus/api/swagger-ui/x"))).toBe(false);
  });
});

describe("static route descriptor", () => {
  it("uses cache-first with static bounds", () => {
    const route = staticRouteDescriptor(context);
    expect(route).toMatchObject({
      strategy: "cache-first",
      maxEntries: 60,
      maxAgeSeconds: 2_592_000,
      purgeOnQuotaError: true,
    });
  });

  it("matches images and fonts but not API reads", () => {
    const route = staticRouteDescriptor(context);
    expect(route.matcher(request("/obolargus/images/a.png"))).toBe(true);
    expect(
      route.matcher(request("/obolargus/fonts/a.woff2", { destination: "font" })),
    ).toBe(true);
    expect(route.matcher(request("/obolargus/api/a.json"))).toBe(false);
    expect(route.matcher(request("/obolargus/index.html"))).toBe(false);
  });
});
