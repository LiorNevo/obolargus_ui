import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "lx_client/js/components/Button";
import Loading from "lx_client/js/components/Loading";
import { clearOfflineCachesForIdentityChange } from "../offline/identityBoundary";
import { AUTH_ENABLED, GOOGLE_CLIENT_ID } from "./config";
import { DevModeBanner } from "./DevModeBanner";
import { GoogleSignIn } from "./GoogleSignIn";
import { useAuthStore } from "./store";

export interface AuthGateProps {
  children: ReactNode;
  /** Overrides the build-time flag in tests and stories. */
  authEnabled?: boolean;
  /** Overrides the build-time Google client id in tests and stories. */
  googleClientId?: string;
}

function SessionScreen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: ReactNode;
}) {
  return (
    <div className="obolargus_auth_screen">
      <main className="obolargus_auth_card" aria-labelledby="obolargus_session_title">
        <h1 id="obolargus_session_title">{title}</h1>
        <p className="obolargus_auth_intro">{message}</p>
        {action}
      </main>
    </div>
  );
}

function AuthenticatedGate({
  children,
  googleClientId = GOOGLE_CLIENT_ID,
}: Omit<AuthGateProps, "authEnabled">) {
  const queryClient = useQueryClient();
  const actor = useAuthStore((state) => state.actor);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const error = useAuthStore((state) => state.error);
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist.hasHydrated(),
  );
  const [readyActorId, setReadyActorId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const previousActorId = useRef<string | null>(null);
  const sawActor = useRef(false);
  const hydratedActorId = useRef<string | null>(null);
  const hydrationRecorded = useRef(false);
  const refreshStarted = useRef(false);

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return undefined;
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || hydrationRecorded.current) return;
    hydrationRecorded.current = true;
    hydratedActorId.current = actor?.id ?? null;
  }, [actor, hydrated]);

  // A reload keeps the refresh token but not the in-memory access token.
  useEffect(() => {
    if (!hydrated || refreshStarted.current) return;
    if (!refreshToken || accessToken) return;
    refreshStarted.current = true;
    void refreshAccessToken();
  }, [accessToken, hydrated, refreshAccessToken, refreshToken]);

  // Clear another identity's offline and cached data before it can render.
  useEffect(() => {
    if (!actor) {
      previousActorId.current = null;
      setReadyActorId(null);
      return undefined;
    }
    if (readyActorId === actor.id) return undefined;
    const previous = previousActorId.current;
    previousActorId.current = actor.id;
    const firstActorThisTab = !sawActor.current;
    sawActor.current = true;
    if (firstActorThisTab && hydratedActorId.current === actor.id) {
      // A reload of the same persisted session must not clear its own data.
      setReadyActorId(actor.id);
      return undefined;
    }
    if (previous === actor.id) {
      setReadyActorId(actor.id);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const result = await clearOfflineCachesForIdentityChange("identity-change");
      if (cancelled) return;
      if (result.failedCaches.length > 0) {
        setIdentityError(
          "Cached data from the previous account could not be cleared. Reload to retry.",
        );
        return;
      }
      queryClient.clear();
      setIdentityError(null);
      setReadyActorId(actor.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [actor, queryClient, readyActorId]);

  if (!hydrated) {
    return <Loading label="Restoring session…" />;
  }

  if (!actor) {
    return <GoogleSignIn clientId={googleClientId} />;
  }

  if (!accessToken) {
    if (error) {
      return (
        <SessionScreen
          title="Session unavailable"
          message={error.message}
          action={
            <div className="obolargus_auth_actions">
              <Button
                variant="primary"
                onClick={() => {
                  refreshStarted.current = true;
                  void refreshAccessToken();
                }}
              >
                Retry
              </Button>
              <Button variant="ghost" onClick={clearSession}>
                Sign out
              </Button>
            </div>
          }
        />
      );
    }
    return <Loading label="Signing in…" />;
  }

  if (identityError) {
    return (
      <SessionScreen
        title="Workspace unavailable"
        message={identityError}
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        }
      />
    );
  }

  if (readyActorId !== actor.id) {
    return <Loading label="Preparing workspace…" />;
  }

  return <>{children}</>;
}

/**
 * Renders the workspace only for a signed-in allowlisted owner.
 *
 * With authentication disabled the children render immediately behind a
 * persistent development-mode banner. The gate also clears identity-scoped
 * caches before a different actor's workspace is rendered.
 */
export function AuthGate({
  children,
  authEnabled = AUTH_ENABLED,
  googleClientId,
}: AuthGateProps) {
  if (!authEnabled) {
    return (
      <>
        <DevModeBanner />
        {children}
      </>
    );
  }
  return (
    <AuthenticatedGate googleClientId={googleClientId}>
      {children}
    </AuthenticatedGate>
  );
}

export default AuthGate;
