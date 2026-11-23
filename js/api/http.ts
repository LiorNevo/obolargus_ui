/**
 * Shared authenticated HTTP transport.
 *
 * Every API module goes through {@link apiFetch} so the bearer token, request
 * deadline, and one-shot refresh behaviour are defined once. The access token
 * lives in memory (the auth store); the refresh token is persisted there. The
 * store installs {@link AuthBridge} through {@link configureAuthBridge}, so
 * this module never imports the store and there is no module cycle.
 */

import { API_BASE_URL } from "./config";

/** Default data-request deadline (spec 034 FR-034). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Single-date load deadline. Below the gateway's 60 s idle deadline so a slow
 * provider answer is reported by the UI rather than by a dropped connection.
 */
export const SINGLE_LOAD_TIMEOUT_MS = 55_000;

/** Paths that must never trigger the refresh-and-retry loop. */
const AUTH_PATHS = new Set(["/auth/login", "/auth/refresh"]);

/** A transport failure with a stable, UI-safe classification. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: "timeout" | "network" | "unauthorized" | "request_failed";
  readonly retryable: boolean;

  constructor(
    status: number,
    code: HttpError["code"],
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/** The token surface the auth store installs into this module. */
export interface AuthBridge {
  /** Current in-memory access token, or `null` before a refresh. */
  getAccessToken(): string | null;
  /** True while a refresh token is held, so a 401 is worth a refresh. */
  hasSession(): boolean;
  /** Refreshes once and reports whether a usable access token now exists. */
  refreshAccessToken(): Promise<boolean>;
}

let authBridge: AuthBridge | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Installs (or clears) the auth token source. */
export function configureAuthBridge(bridge: AuthBridge | null): void {
  authBridge = bridge;
}

/** Options accepted by {@link apiFetch}. */
export interface ApiFetchOptions extends Omit<RequestInit, "signal" | "headers"> {
  /** Caller abort signal (supersession, unmount, cancellation). */
  signal?: AbortSignal;
  /** Request headers; merged into the defaults. */
  headers?: HeadersInit;
  /**
   * Deadline in milliseconds. `null` disables it for streaming responses.
   * Defaults to {@link DEFAULT_TIMEOUT_MS}.
   */
  timeoutMs?: number | null;
  /**
   * Attach the bearer token and allow one refresh retry. Defaults to `true`.
   * Auth endpoints always behave as `false`.
   */
  auth?: boolean;
  /**
   * Retry once after a 401 by refreshing. Defaults to the value of `auth`.
   * Auth endpoints never retry.
   */
  retryOn401?: boolean;
}

function mergeHeaders(headers: HeadersInit | undefined): Headers {
  const merged = new Headers(headers ?? {});
  if (!merged.has("accept")) merged.set("accept", "application/json");
  return merged;
}

function abortReason(source: AbortSignal): unknown {
  return "reason" in source ? source.reason : undefined;
}

function linkAbort(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) return () => {};
  if (source.aborted) {
    target.abort(abortReason(source));
    return () => {};
  }
  const forward = () => target.abort(abortReason(source));
  source.addEventListener("abort", forward, { once: true });
  return () => source.removeEventListener("abort", forward);
}

async function attempt(
  path: string,
  init: RequestInit,
  options: {
    token: string | null;
    signal: AbortSignal | undefined;
    timeoutMs: number | null;
    headers: Headers;
  },
): Promise<Response> {
  const { token, signal, timeoutMs } = options;
  const controller = new AbortController();
  const unlink = linkAbort(signal, controller);
  let timedOut = false;
  const timer =
    timeoutMs === null
      ? null
      : setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

  const headers = new Headers(options.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const finish = () => {
    if (timer !== null) clearTimeout(timer);
    unlink();
  };

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    finish();
    if (timedOut && !signal?.aborted) {
      throw new HttpError(
        0,
        "timeout",
        "The request took too long. Try again.",
        true,
      );
    }
    return response;
  } catch (caught) {
    finish();
    if (caught instanceof HttpError) throw caught;
    if (signal?.aborted) throw caught;
    if (timedOut) {
      throw new HttpError(
        0,
        "timeout",
        "The request took too long. Try again.",
        true,
      );
    }
    throw new HttpError(
      0,
      "network",
      "The market data service could not be reached.",
      true,
    );
  }
}

function refreshOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const bridge = authBridge;
  if (!bridge) return Promise.resolve(false);
  const tracked = bridge
    .refreshAccessToken()
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  refreshInFlight = tracked;
  return tracked;
}

/**
 * Fetches an API path with the bearer token, a deadline, and one refresh retry.
 *
 * A 401 refreshes once and retries once; a second 401 rejects with
 * `HttpError("unauthorized")` rather than looping. Caller aborts propagate as
 * the original abort error so TanStack Query can ignore superseded requests.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const {
    signal,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
    retryOn401,
    ...init
  } = options;
  const isAuthPath = AUTH_PATHS ? AUTH_PATHS.has(path) : false;
  const useAuth = auth && !isAuthPath;
  const canRefresh = (retryOn401 ?? useAuth) && useAuth;
  const mergedHeaders = mergeHeaders(headers);
  if (init.body !== undefined && init.body !== null && !mergedHeaders.has("content-type")) {
    mergedHeaders.set("content-type", "application/json");
  }

  const firstToken = useAuth ? authBridge?.getAccessToken() ?? null : null;
  let response = await attempt(path, init, {
    token: firstToken,
    signal,
    timeoutMs,
    headers: mergedHeaders,
  });

  if (
    response.status === 401 &&
    canRefresh &&
    authBridge?.hasSession()
  ) {
    const refreshed = await refreshOnce();
    if (!refreshed) {
      throw new HttpError(
        401,
        "unauthorized",
        "Your session has expired. Sign in again.",
        false,
      );
    }
    response = await attempt(path, init, {
      token: authBridge?.getAccessToken() ?? null,
      signal,
      timeoutMs,
      headers: mergedHeaders,
    });
    if (response.status === 401) {
      throw new HttpError(
        401,
        "unauthorized",
        "Your session has expired. Sign in again.",
        false,
      );
    }
  }

  return response;
}
