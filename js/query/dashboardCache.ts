import type { QueryClient, QueryKey } from "@tanstack/react-query";

interface LeaseRecord {
  count: number;
  controller: AbortController;
}

const leases = new Map<string, LeaseRecord>();

export interface CachedReadLease {
  signal: AbortSignal;
  /** Releases this consumer; returns true when it was the last one. */
  release(): boolean;
}

/** Builds an AbortSignal that aborts when any input signal aborts. */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  const anySignal = (
    AbortSignal as unknown as {
      any?: (inputs: AbortSignal[]) => AbortSignal;
    }
  ).any;
  if (typeof anySignal === "function") {
    return anySignal(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * Acquires one consumer lease for a cached read.
 *
 * A shared transport abort is only raised when the last consumer releases the
 * key, so one unmounting widget cannot cancel another widget's read.
 */
export function acquireReadLease(
  keyHash: string,
  externalSignal: AbortSignal,
  onLastRelease?: () => void,
): CachedReadLease {
  let record = leases.get(keyHash);
  if (!record) {
    record = { count: 0, controller: new AbortController() };
    leases.set(keyHash, record);
  }
  const activeRecord = record;
  activeRecord.count += 1;

  let released = false;
  const release = (): boolean => {
    if (released) return false;
    released = true;
    externalSignal.removeEventListener("abort", handleAbort);
    activeRecord.count -= 1;
    if (activeRecord.count <= 0) {
      activeRecord.controller.abort();
      leases.delete(keyHash);
      onLastRelease?.();
      return true;
    }
    return false;
  };
  const handleAbort = (): void => {
    release();
  };

  if (externalSignal.aborted) {
    handleAbort();
  } else {
    externalSignal.addEventListener("abort", handleAbort, { once: true });
  }

  return { signal: activeRecord.controller.signal, release };
}

export interface CachedReadOptions<TData> {
  queryKey: QueryKey;
  queryFn: (context: { signal: AbortSignal }) => Promise<TData>;
  staleTime?: number;
  gcTime?: number;
}

/**
 * Reads through the shared query cache for a promise-based consumer.
 *
 * The read is deduplicated by the query client. This bridge only adds consumer
 * accounting and abort behavior for callers that cannot use `useQuery`.
 */
export function readThroughCache<TData>(
  client: QueryClient,
  options: CachedReadOptions<TData>,
  externalSignal: AbortSignal,
): Promise<TData> {
  if (externalSignal.aborted) {
    return Promise.reject(abortError());
  }

  const lease = acquireReadLease(
    JSON.stringify(options.queryKey),
    externalSignal,
    () => {
      if (externalSignal.aborted) {
        void client.cancelQueries({
          queryKey: options.queryKey,
          exact: true,
        });
      }
    },
  );

  const request = client.fetchQuery({
    queryKey: options.queryKey,
    queryFn: (context) =>
      options.queryFn({
        signal: combineSignals([context.signal, lease.signal]),
      }),
    staleTime: options.staleTime,
    gcTime: options.gcTime,
  });

  let onExternalAbort: (() => void) | undefined;
  const aborted = new Promise<TData>((_resolve, reject) => {
    if (externalSignal.aborted) {
      reject(abortError());
      return;
    }
    onExternalAbort = () => reject(abortError());
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  });

  return Promise.race([request, aborted]).finally(() => {
    if (onExternalAbort) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
    lease.release();
    void request.catch(() => undefined);
  });
}
