import {
  filterPrecacheManifest,
  isRetiredCacheName,
  selectRetiredCacheNames,
} from "../precache";

describe("precache filtering", () => {
  it("keeps the shell and normalizes relative URLs", () => {
    const result = filterPrecacheManifest(
      [
        { url: "index.html", revision: "r1" },
        { url: "js/main.js", revision: "r2" },
        { url: "/obolargus/styles/app.css", revision: "r3" },
      ],
      "/obolargus",
    );
    expect(result).toEqual([
      { url: "/obolargus/index.html", revision: "r1" },
      { url: "/obolargus/js/main.js", revision: "r2" },
      { url: "/obolargus/styles/app.css", revision: "r3" },
    ]);
  });

  it("excludes maps, licenses, docs-runner, and the worker", () => {
    const result = filterPrecacheManifest(
      [
        { url: "/obolargus/index.html", revision: "r1" },
        { url: "/obolargus/js/main.js.map", revision: null },
        { url: "/obolargus/js/main.js.LICENSE.txt", revision: null },
        { url: "/obolargus/docs-runner/index.js", revision: null },
        { url: "/obolargus/service-worker.js", revision: null },
      ],
      "/obolargus",
    );
    expect(result.map((entry) => entry.url)).toEqual([
      "/obolargus/index.html",
    ]);
  });

  it("drops entries outside the base path and deduplicates", () => {
    const result = filterPrecacheManifest(
      [
        { url: "/other/index.html", revision: "r1" },
        { url: "/obolargus/index.html", revision: "r1" },
        { url: "index.html", revision: "r1" },
      ],
      "/obolargus",
    );
    expect(result).toEqual([
      { url: "/obolargus/index.html", revision: "r1" },
    ]);
  });

  it("handles the origin root", () => {
    const result = filterPrecacheManifest(
      [{ url: "index.html", revision: "r1" }],
      "",
    );
    expect(result[0].url).toBe("/index.html");
  });
});

describe("retired caches", () => {
  it("selects only same-scope older builds", () => {
    const names = [
      "obolargus-precache-scope1-v1",
      "obolargus-api-scope1-v1",
      "obolargus-static-scope1-v1",
      "obolargus-api-scope1-v2",
      "obolargus-api-scope2-v1",
      "unrelated-cache",
    ];
    expect(selectRetiredCacheNames(names, "scope1", "v2")).toEqual([
      "obolargus-precache-scope1-v1",
      "obolargus-api-scope1-v1",
      "obolargus-static-scope1-v1",
    ]);
  });

  it("ignores names for other scopes and unknown prefixes", () => {
    expect(isRetiredCacheName("obolargus-api-scope2-v1", "scope1", "v2")).toBe(
      false,
    );
    expect(isRetiredCacheName("unrelated-scope1-v1", "scope1", "v2")).toBe(
      false,
    );
    expect(isRetiredCacheName("obolargus-api-scope1-v2", "scope1", "v2")).toBe(
      false,
    );
  });
});
