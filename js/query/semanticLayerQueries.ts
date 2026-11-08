import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchSemanticLayerDocument } from "../api/semanticLayer";
import { queryKeys } from "./keys";
import { withReadProvenance } from "./provenance";

const SEMANTIC_LAYER_STALE_MS = 60_000;
const SEMANTIC_LAYER_GC_MS = 600_000;

/** Cache options for the canonical system data dictionary. */
export function semanticLayerQueryOptions() {
  const queryKey = queryKeys.semanticLayer.document();
  return queryOptions({
    queryKey,
    queryFn: withReadProvenance(queryKey, ({ signal }, onMeta) =>
      fetchSemanticLayerDocument(signal, onMeta),
    ),
    staleTime: SEMANTIC_LAYER_STALE_MS,
    gcTime: SEMANTIC_LAYER_GC_MS,
  });
}

/** Reads the canonical data dictionary through the shared cache. */
export function useSemanticLayerQuery() {
  return useQuery(semanticLayerQueryOptions());
}
