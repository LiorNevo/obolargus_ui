import { useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MorpheusChatProvider,
  MorpheusLauncher,
  MorpheusPanel,
  type MorpheusChatConfig,
} from "lx_client/js/components/MorpheusChat";
import { API_BASE_URL } from "../api/config";
import { PAGES } from "./pages";

const STATIC_PATHS = new Set(
  PAGES.map((page) => page.path).filter((path) => !path.includes(":")),
);
const DYNAMIC_PREFIXES = ["/automation/flows/", "/automation/runs/"];

function canNavigate(path: string): boolean {
  if (STATIC_PATHS.has(path)) return true;
  return DYNAMIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

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
