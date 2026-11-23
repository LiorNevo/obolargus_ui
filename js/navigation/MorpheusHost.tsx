import { useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MorpheusChatProvider,
  MorpheusLauncher,
  MorpheusPanel,
  type MorpheusChatConfig,
  type MorpheusStreamEvent,
} from "lx_client/js/components/MorpheusChat";
import { API_BASE_URL } from "../api/config";
import { apiFetch, type ApiFetchOptions } from "../api/http";
import { openAuthenticatedEventStream } from "../api/sse";
import { PAGES } from "./pages";

const STATIC_PATHS = new Set(
  PAGES.map((page) => page.path).filter((path) => !path.includes(":")),
);
const DYNAMIC_PREFIXES = ["/automation/flows/", "/automation/runs/"];

function canNavigate(path: string): boolean {
  if (STATIC_PATHS.has(path)) return true;
  return DYNAMIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Chat URLs are built from `API_BASE_URL`; the shared auth helpers expect a
 * path and prepend it themselves.
 */
const apiPath = (url: string) => url.slice(API_BASE_URL.length);

const authenticatedFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return apiFetch(apiPath(url), init as ApiFetchOptions);
};

const openEventStream = (
  url: string,
  onEvent: (event: MorpheusStreamEvent) => void,
) =>
  openAuthenticatedEventStream(apiPath(url), {
    onEvent: (event) => onEvent({ event: event.event, data: event.data }),
  });

/** Wraps the shell with the lx_client Morpheus chat provider. */
export function MorpheusHost({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const config = useMemo<MorpheusChatConfig>(
    () => ({
      apiBaseUrl: `${API_BASE_URL}/morpheus`,
      navigate: (path) => navigate(path),
      canNavigate,
      maskSelectors: ["[data-morpheus-sensitive]"],
      storageNamespace: "obolargus_morpheus_chat",
      fetchImpl: authenticatedFetch,
      openEventStream,
    }),
    [navigate],
  );
  return (
    <MorpheusChatProvider config={config}>{children}</MorpheusChatProvider>
  );
}

/** Floating launcher and panel, hidden on the full-page chat route. */
export function MorpheusHostChat() {
  const location = useLocation();
  if (location.pathname.startsWith("/morpheus")) return null;
  return (
    <>
      <MorpheusLauncher />
      <MorpheusPanel />
    </>
  );
}
