/**
 * Google Identity Services loader.
 *
 * The script is loaded on demand so a signed-in session never waits for
 * Google, and a failed load leaves the sign-in screen usable.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";

/** Minimal shape of the GIS API used by this app. */
export interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: string;
          theme?: string;
          size?: string;
          text?: string;
          shape?: string;
          width?: number;
        },
      ) => void;
      disableAutoSelect: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

let scriptPromise: Promise<GoogleIdentityServices> | null = null;

function loadScript(): Promise<GoogleIdentityServices> {
  if (window.google) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        script.remove();
        reject(new Error("Google Identity Services did not initialise."));
      }
    };
    const onError = () => {
      script.remove();
      reject(new Error("Google Identity Services could not be loaded."));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

/** Loads the GIS script once and shares the result across callers. */
export function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (!scriptPromise) {
    scriptPromise = loadScript().catch((error: unknown) => {
      scriptPromise = null;
      throw error;
    });
  }
  return scriptPromise;
}

/** Test seam: clears the cached script promise. */
export function resetGoogleIdentityServicesForTests(): void {
  scriptPromise = null;
}
