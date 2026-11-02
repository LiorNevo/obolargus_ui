import {
  buildRouteDescriptors,
  navigationDenylist,
  navigationRouteDescriptor,
} from "../runtimeCaching";

const context = {
  basePath: "/obolargus",
  apiBasePath: "/obolargus/api",
  buildId: "b1",
  origin: "https://example.test",
};

function request(path: string, mode = "navigate") {
  return {
    method: "GET",
    url: `https://example.test${path}`,
    mode,
    destination: "document",
  };
}

describe("navigation route", () => {
  it("matches navigations below the base path", () => {
    const descriptor = navigationRouteDescriptor(context);
    expect(descriptor.matcher(request("/obolargus/data-load"))).toBe(true);
    expect(descriptor.matcher(request("/obolargus"))).toBe(true);
  });

  it("rejects API, worker, manifest, and icon paths", () => {
    const descriptor = navigationRouteDescriptor(context);
    for (const path of [
      "/obolargus/api/assets",
      "/obolargus/service-worker.js",
      "/obolargus/manifest.webmanifest",
      "/obolargus/icons/icon-192.png",
    ]) {
      expect(descriptor.matcher(request(path))).toBe(false);
    }
  });

  it("rejects non-navigation requests", () => {
    const descriptor = navigationRouteDescriptor(context);
    expect(descriptor.matcher(request("/obolargus/data-load", "cors"))).toBe(
      false,
    );
  });

  it("builds an anchored denylist for the base path", () => {
    const patterns = navigationDenylist("/obolargus");
    expect(patterns.some((pattern) => pattern.test("/obolargus/api/x"))).toBe(
      true,
    );
    expect(patterns.some((pattern) => pattern.test("/obolargus-next/api/x"))).toBe(
      false,
    );
  });

  it("orders runtime routes before navigation", () => {
    expect(buildRouteDescriptors(context).map((route) => route.id)).toEqual([
      "api-read",
      "static-asset",
      "navigation",
    ]);
  });
});
