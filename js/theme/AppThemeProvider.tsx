import { useEffect, type ReactNode } from "react";
import { logger } from "lx_client/js/utils/logger";
import { useThemeStore } from "lx_client/js/components/ThemeProvider/store";

const CROSS_FRAME_MESSAGE_TYPE = "lx-theme-change";
const ALLOWED_THEMES = new Set<string>(["light", "dark"]);

type CrossFrameThemeId = "light" | "dark";

function isCrossFrameMessage(data: unknown): data is { themeId: string } {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.type === CROSS_FRAME_MESSAGE_TYPE &&
    (obj.themeId === "light" || obj.themeId === "dark")
  );
}

function applyRootClass(themeId: string): void {
  const target = `theme-${themeId}`;
  const other = `theme-${themeId === "light" ? "dark" : "light"}`;
  document.documentElement.classList.add(target);
  document.documentElement.classList.remove(other);
}

function notifyParent(themeId: CrossFrameThemeId): void {
  if (window.parent === window) return;
  try {
    window.parent.postMessage(
      { type: CROSS_FRAME_MESSAGE_TYPE, themeId },
      window.location.origin,
    );
  } catch {
    // Cross-origin or iframe access errors are expected in some environments.
  }
}

/**
 * App theme provider.
 *
 * lx_client's compiled theme CSS is emitted as `theme-registry.css` and linked
 * from the HTML entry, so this provider only owns the root theme class and the
 * cross-frame theme message. It deliberately does not import the generated
 * registry, which keeps hundreds of KiB of CSS strings out of the entrypoint.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { activeThemeId, setActiveThemeId } = useThemeStore();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isCrossFrameMessage(event.data)) return;
      setActiveThemeId(event.data.themeId as CrossFrameThemeId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setActiveThemeId]);

  useEffect(() => {
    if (!ALLOWED_THEMES.has(activeThemeId)) {
      logger.warn(
        `ThemeProvider: persisted theme '${activeThemeId}' is not recognized; falling back to 'dark'`,
      );
      setActiveThemeId("dark");
      return;
    }
    applyRootClass(activeThemeId);
    notifyParent(activeThemeId as CrossFrameThemeId);
    logger.info(`Theme '${activeThemeId}' applied successfully`);
  }, [activeThemeId, setActiveThemeId]);

  return <>{children}</>;
}

export default AppThemeProvider;
