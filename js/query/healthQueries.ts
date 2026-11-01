import { queryOptions, useQuery } from "@tanstack/react-query";
import { healthCheck } from "../api/client";
import { queryKeys } from "./keys";

/** Cache options for the server health read. */
export function healthQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.health(),
    queryFn: ({ signal }) => healthCheck(signal),
    staleTime: 60_000,
    gcTime: 600_000,
  });
}

/** Reads the server health status through the shared cache. */
export function useHealthQuery() {
  return useQuery(healthQueryOptions());
}
