/**
 * Last-route selection for an installed application launch.
 */
import { normalizeBasePath } from "./paths";

/**
 * Returns the route to restore, or null when the launch should stay put.
 *
 * A direct deep link always wins: the stored route is considered only when the
 * browser is at the application root.
 */
export function chooseLaunchRoute(
  currentPath: string,
  storedPath: string | null | undefined,
  basePath: string,
): string | null {
  const base = normalizeBasePath(basePath);
  const root = base ? `${base}/` : "/";
  if (currentPath !== root && currentPath !== base) return null;
  if (!storedPath) return null;
  if (storedPath === root || storedPath === base) return null;
  if (base) {
    if (storedPath !== base && !storedPath.startsWith(`${base}/`)) return null;
  } else if (!storedPath.startsWith("/")) {
    return null;
  }
  return storedPath;
}

/** Removes the base path because the router applies it once as `basename`. */
export function stripBasePath(path: string, basePath: string): string {
  const base = normalizeBasePath(basePath);
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  if (path === base) return "/";
  if (!path.startsWith(`${base}/`)) return "/";
  const stripped = path.slice(base.length);
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

/** Returns true when the page is running as an installed/standalone app. */
export function isStandaloneLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const media = window.matchMedia?.("(display-mode: standalone)");
    if (media?.matches) return true;
  } catch {
    // matchMedia is unavailable in some test environments.
  }
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return navigatorWithStandalone.standalone === true;
}
