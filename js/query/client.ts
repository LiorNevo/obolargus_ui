import { QueryClient } from "@tanstack/react-query";
import { retryDelay, shouldRetry } from "./retry";

/** Test and story overrides applied to the shared query defaults. */
export interface QueryClientOverrides {
  retry?: boolean | number | ((failureCount: number, error: Error) => boolean);
  retryDelay?: number | ((attemptIndex: number, error: Error) => number);
  staleTime?: number;
  gcTime?: number;
}

/**
 * Creates the tab-scoped server-state cache.
 *
 * The cache is deliberately memory-only. It is never persisted to IndexedDB or
 * another durable store because server responses must not be replayed after a
 * reload, and durable UI state belongs to the Zustand layer.
 */
export function createQueryClient(
  overrides: QueryClientOverrides = {},
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: overrides.staleTime ?? 30_000,
        gcTime: overrides.gcTime ?? 600_000,
        retry:
          overrides.retry ??
          ((failureCount, error) => shouldRetry(failureCount, error)),
        retryDelay: overrides.retryDelay ?? retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Creates an isolated cache for a single test. */
export function createTestQueryClient(): QueryClient {
  return createQueryClient({ retry: false, staleTime: 0 });
}
