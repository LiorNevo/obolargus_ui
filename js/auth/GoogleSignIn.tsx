import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "lx_client/js/components/Button";
import Loading from "lx_client/js/components/Loading";
import { GOOGLE_CLIENT_ID } from "./config";
import {
  loadGoogleIdentityServices,
  type GoogleIdentityServices,
} from "./gis";
import { useAuthStore } from "./store";

export interface GoogleSignInProps {
  /** OAuth web client id. Defaults to the build-time value. */
  clientId?: string;
}

/**
 * Google sign-in screen.
 *
 * The GIS script is loaded on demand and renders the official button into the
 * container. A missing client id or a failed script load surfaces a clear,
 * non-secret error instead of an unresponsive screen.
 */
export function GoogleSignIn({ clientId = GOOGLE_CLIENT_ID }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signInWithGoogleCredential);

  const start = useCallback(
    (google: GoogleIdentityServices) => {
      const parent = buttonRef.current;
      if (!parent) return;
      parent.replaceChildren();
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) void signIn(response.credential);
        },
        cancel_on_tap_outside: true,
      });
      google.accounts.id.renderButton(parent, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 280,
      });
    },
    [clientId, signIn],
  );

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    setScriptError(null);
    loadGoogleIdentityServices()
      .then((google) => {
        if (!cancelled) start(google);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setScriptError(
          caught instanceof Error
            ? caught.message
            : "Google sign-in could not be loaded.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadKey, start]);

  return (
    <div className="obolargus_auth_screen">
      <main className="obolargus_auth_card" aria-labelledby="obolargus_signin_title">
        <h1 id="obolargus_signin_title">Obolargus</h1>
        <p className="obolargus_auth_intro">
          Sign in with an allowlisted Google account to open your private
          workspace.
        </p>

        {!clientId && (
          <div className="obolargus_auth_alert" role="alert" data-code="not_configured">
            <p>
              Sign-in is not configured for this build. Set{" "}
              <code>GOOGLE_CLIENT_ID</code> and rebuild the UI.
            </p>
          </div>
        )}

        {error && (
          <div
            className="obolargus_auth_alert"
            role="alert"
            data-code={error.code}
          >
            <p>{error.message}</p>
          </div>
        )}

        {scriptError && (
          <div className="obolargus_auth_alert" role="alert" data-code="script">
            <p>{scriptError}</p>
          </div>
        )}

        {clientId && (
          <div
            ref={buttonRef}
            className="obolargus_auth_google"
            data-testid="google-signin-button"
          />
        )}

        {status === "signingIn" && (
          <Loading compact label="Verifying Google sign-in…" />
        )}

        {scriptError && clientId && (
          <Button
            variant="secondary"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry Google sign-in
          </Button>
        )}

        <p className="obolargus_auth_footnote">
          Only accounts on this deployment&apos;s allowlist can sign in.
        </p>
      </main>
    </div>
  );
}

export default GoogleSignIn;
