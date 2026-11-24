import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "lx_client/js/components/Table/store/tableStore";
import {
  HttpError,
  apiFetch,
  configureAuthBridge,
  DEFAULT_TIMEOUT_MS,
} from "../api/http";

/** The allowlisted owner returned by the auth API. */
export interface AuthActor {
  id: string;
  email: string;
  /** Absent on sessions persisted before the calendar feature. */
  isPrimaryOwner?: boolean;
}

/** UI-safe sign-in failure. */
export interface AuthErrorState {
  code: string;
  message: string;
  /** Seconds to wait for a 429, when the server supplied `Retry-After`. */
  retryAfterSeconds: number | null;
}

interface LoginResponseWire {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  actor: { id: string; email: string; is_primary_owner?: boolean };
}

interface RefreshResponseWire {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/** Session states rendered by `AuthGate`. */
export type AuthStatus = "signedOut" | "signingIn" | "signedIn";

/** State and actions for the application session. */
export interface AuthStore {
  status: AuthStatus;
  actor: AuthActor | null;
  /** Kept in memory only; never persisted. */
  accessToken: string | null;
  /** Persisted so a reload can refresh without another Google round-trip. */
  refreshToken: string | null;
  error: AuthErrorState | null;
  signInWithGoogleCredential: (credential: string) => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  clearSession: () => void;
  clearError: () => void;
}

function readErrorBody(text: string): { code: string; message: string } {
  try {
    const parsed = JSON.parse(text) as ErrorEnvelope;
    const error = parsed.error;
    if (error && typeof error === "object") {
      return {
        code: typeof error.code === "string" ? error.code : "request_failed",
        message:
          typeof error.message === "string"
            ? error.message
            : "The sign-in attempt failed.",
      };
    }
  } catch {
    // Non-JSON bodies keep the generic message.
  }
  return { code: "request_failed", message: "The sign-in attempt failed." };
}

function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function signInError(error: unknown): AuthErrorState {
  if (error instanceof HttpError) {
    if (error.code === "timeout") {
      return {
        code: "timeout",
        message: "Google sign-in took too long. Check your connection and try again.",
        retryAfterSeconds: null,
      };
    }
    return {
      code: error.code,
      message:
        error.code === "network"
          ? "The sign-in service could not be reached."
          : error.message,
      retryAfterSeconds: null,
    };
  }
  return {
    code: "unknown",
    message: "The sign-in attempt failed. Try again.",
    retryAfterSeconds: null,
  };
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    auth: false,
    retryOn401: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  if (!response.ok) {
    const { code, message } = readErrorBody(await response.text());
    const error = new Error(message) as Error & {
      code: string;
      status: number;
      retryAfterSeconds: number | null;
    };
    error.code = code;
    error.status = response.status;
    error.retryAfterSeconds = retryAfterSeconds(response);
    throw error;
  }
  return (await response.json()) as T;
}

function classifySignInFailure(error: unknown): AuthErrorState {
  const coded = error as { code?: unknown; status?: unknown; retryAfterSeconds?: unknown };
  const code = typeof coded.code === "string" ? coded.code : "request_failed";
  const message =
    error instanceof Error ? error.message : "The sign-in attempt failed.";
  const retry =
    typeof coded.retryAfterSeconds === "number" ? coded.retryAfterSeconds : null;
  if (code === "rate_limited") {
    return {
      code,
      message:
        retry === null
          ? "Too many sign-in attempts. Wait a minute and try again."
          : `Too many sign-in attempts. Try again in ${retry} second(s).`,
      retryAfterSeconds: retry,
    };
  }
  if (code === "account_not_allowed") {
    return {
      code,
      // Never reveal allowlist entries.
      message: "This Google account is not allowed to use this workspace.",
      retryAfterSeconds: null,
    };
  }
  if (code === "invalid_google_credential") {
    return {
      code,
      message: "Google could not verify this sign-in. Try again.",
      retryAfterSeconds: null,
    };
  }
  if (code === "auth_unavailable") {
    return {
      code,
      message: "Sign-in is temporarily unavailable. Try again shortly.",
      retryAfterSeconds: null,
    };
  }
  return { code, message, retryAfterSeconds: retry };
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * The session store.
 *
 * `actor` and `refreshToken` are persisted through the shared IndexedDB
 * storage; the access token deliberately stays in memory.
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      status: "signedOut",
      actor: null,
      accessToken: null,
      refreshToken: null,
      error: null,

      signInWithGoogleCredential: async (credential) => {
        set({ status: "signingIn", error: null });
        try {
          const wire = await postAuth<LoginResponseWire>("/auth/login", {
            id_token: credential,
          });
          if (
            !wire ||
            typeof wire.access_token !== "string" ||
            typeof wire.refresh_token !== "string" ||
            !wire.actor ||
            typeof wire.actor.id !== "string" ||
            typeof wire.actor.email !== "string"
          ) {
            set((state) => ({
              status: state.actor ? "signedIn" : "signedOut",
              error: {
                code: "invalid_response",
                message: "The sign-in response was invalid. Try again.",
                retryAfterSeconds: null,
              },
            }));
            return;
          }
          set({
            status: "signedIn",
            actor: {
              id: wire.actor.id,
              email: wire.actor.email,
              isPrimaryOwner: wire.actor.is_primary_owner === true,
            },
            accessToken: wire.access_token,
            refreshToken: wire.refresh_token,
            error: null,
          });
        } catch (caught) {
          set((state) => ({
            status: state.refreshToken ? "signedIn" : "signedOut",
            error:
              caught instanceof HttpError
                ? signInError(caught)
                : classifySignInFailure(caught),
          }));
        }
      },

      refreshAccessToken: () => {
        if (refreshInFlight) return refreshInFlight;
        const token = get().refreshToken;
        if (!token) return Promise.resolve(false);
        const tracked = (async () => {
          try {
            const wire = await postAuth<RefreshResponseWire>("/auth/refresh", {
              refresh_token: token,
            });
            if (
              !wire ||
              typeof wire.access_token !== "string" ||
              wire.access_token.length === 0
            ) {
              set({
                error: {
                  code: "invalid_response",
                  message: "The session refresh response was invalid.",
                  retryAfterSeconds: null,
                },
              });
              return false;
            }
            // A sign-out or actor switch while the request was in flight wins.
            if (get().refreshToken !== token) return false;
            set({ accessToken: wire.access_token, status: "signedIn" });
            return true;
          } catch (caught) {
            if (get().refreshToken !== token) return false;
            if (caught instanceof HttpError) {
              if (caught.code === "network" || caught.code === "timeout") {
                set({ error: signInError(caught) });
              } else {
                get().clearSession();
              }
              return false;
            }
            const status = (caught as { status?: unknown }).status;
            if (status === 401 || status === 403) {
              get().clearSession();
              set({
                error: {
                  code: "session_expired",
                  message: "Your session expired. Sign in again.",
                  retryAfterSeconds: null,
                },
              });
            } else {
              set({ error: classifySignInFailure(caught) });
            }
            return false;
          }
        })();
        refreshInFlight = tracked.finally(() => {
          refreshInFlight = null;
        });
        return refreshInFlight;
      },

      clearSession: () =>
        set({
          status: "signedOut",
          actor: null,
          accessToken: null,
          refreshToken: null,
          error: null,
        }),

      clearError: () => set({ error: null }),
    }),
    {
      name: "obolargus_auth_v1",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        actor: state.actor,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

configureAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  hasSession: () => Boolean(useAuthStore.getState().refreshToken),
  refreshAccessToken: () => useAuthStore.getState().refreshAccessToken(),
});
