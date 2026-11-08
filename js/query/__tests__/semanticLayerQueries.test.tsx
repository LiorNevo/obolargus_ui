import { semanticLayerQueryOptions } from "../semanticLayerQueries";
import { queryKeys } from "../keys";

describe("semantic layer query options", () => {
  it("uses one stable document key", () => {
    expect(queryKeys.semanticLayer.document()).toEqual([
      "semantic-layer",
      "document",
    ]);
    expect(semanticLayerQueryOptions().queryKey).toEqual([
      "semantic-layer",
      "document",
    ]);
  });

  it("uses the catalog freshness and retention policy", () => {
    const options = semanticLayerQueryOptions();
    expect(options.staleTime).toBe(60_000);
    expect(options.gcTime).toBe(600_000);
  });

  it("exposes a query function for the shared cache", () => {
    expect(typeof semanticLayerQueryOptions().queryFn).toBe("function");
  });
});
