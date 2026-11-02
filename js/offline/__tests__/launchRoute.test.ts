import {
  chooseLaunchRoute,
  isStandaloneLaunch,
  stripBasePath,
} from "../launchRoute";

describe("launch route", () => {
  it("restores a valid stored route at the base root", () => {
    expect(
      chooseLaunchRoute("/obolargus/", "/obolargus/data-load", "/obolargus"),
    ).toBe("/obolargus/data-load");
    expect(chooseLaunchRoute("/obolargus", "/obolargus/data-load", "/obolargus")).toBe(
      "/obolargus/data-load",
    );
  });

  it("never overrides a direct deep link", () => {
    expect(
      chooseLaunchRoute(
        "/obolargus/data-load",
        "/obolargus/dashboard",
        "/obolargus",
      ),
    ).toBeNull();
  });

  it("ignores missing, root, and out-of-scope routes", () => {
    expect(chooseLaunchRoute("/obolargus/", null, "/obolargus")).toBeNull();
    expect(
      chooseLaunchRoute("/obolargus/", "/obolargus/", "/obolargus"),
    ).toBeNull();
    expect(
      chooseLaunchRoute("/obolargus/", "/obolargus-next/x", "/obolargus"),
    ).toBeNull();
  });

  it("handles the origin root", () => {
    expect(chooseLaunchRoute("/", "/data-load", "")).toBe("/data-load");
    expect(chooseLaunchRoute("/", "data-load", "")).toBeNull();
  });

  it("strips the base path exactly once", () => {
    expect(stripBasePath("/obolargus/data-load", "/obolargus")).toBe(
      "/data-load",
    );
    expect(stripBasePath("/obolargus", "/obolargus")).toBe("/");
    expect(stripBasePath("/obolargus-next/x", "/obolargus")).toBe("/");
    expect(stripBasePath("/data-load", "")).toBe("/data-load");
  });

  it("detects a standalone launch", () => {
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    expect(isStandaloneLaunch()).toBe(true);
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    expect(isStandaloneLaunch()).toBe(false);
    window.matchMedia = original;
  });
});
