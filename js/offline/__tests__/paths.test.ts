import {
  computeScopeKey,
  isUnderBasePath,
  normalizeApiBasePath,
  normalizeBasePath,
  resolveBuildId,
} from "../paths";

describe("offline paths", () => {
  it("normalizes leading and trailing slashes", () => {
    expect(normalizeBasePath("obolargus")).toBe("/obolargus");
    expect(normalizeBasePath("/obolargus/")).toBe("/obolargus");
    expect(normalizeBasePath("/obolargus///")).toBe("/obolargus");
  });

  it("treats the origin root as an empty base path", () => {
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("")).toBe("");
  });

  it("defaults the API path below the base path", () => {
    expect(normalizeApiBasePath(undefined, "/obolargus")).toBe(
      "/obolargus/api",
    );
    expect(normalizeApiBasePath("/custom/api/", "/obolargus")).toBe(
      "/custom/api",
    );
    expect(normalizeApiBasePath(undefined, "/")).toBe("/api");
  });

  it("checks base-path membership without matching sibling prefixes", () => {
    expect(isUnderBasePath("/obolargus", "/obolargus")).toBe(true);
    expect(isUnderBasePath("/obolargus/data-load", "/obolargus")).toBe(true);
    expect(isUnderBasePath("/obolargus-next/data-load", "/obolargus")).toBe(
      false,
    );
    expect(isUnderBasePath("/anything", "/")).toBe(true);
  });

  it("builds stable, distinct scope keys", () => {
    expect(computeScopeKey("/obolargus")).toBe(computeScopeKey("/obolargus/"));
    expect(computeScopeKey("/obolargus")).not.toBe(
      computeScopeKey("/obolargus-next"),
    );
    expect(computeScopeKey("/obolargus").length).toBeGreaterThan(3);
  });

  it("resolves an explicit or fallback build id", () => {
    expect(resolveBuildId("v1")).toBe("v1");
    expect(resolveBuildId("  ")).toBe(
      resolveBuildId(process.env.OBOLARGUS_BUILD_ID),
    );
    expect(resolveBuildId(null)).toBeTruthy();
  });
});
