import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppShell from "lx_client/js/components/AppShell";
import type { NavigationEntry } from "lx_client/js/navigation/types";
import { BASE_PATH } from "../config";
import {
  chooseLaunchRoute,
  isStandaloneLaunch,
  stripBasePath,
} from "../offline/launchRoute";
import { useNavigationStore } from "../store/navigationStore";

/** Props for the application layout route. */
export interface AppLayoutProps {
  /** Access-filtered navigation entries derived from the page registry. */
  navigation: NavigationEntry[];
}

/**
 * Layout route shared by every registered page.
 *
 * Renders the shared application shell and provides the navigation entries to
 * child pages through React Router's outlet context, so pages such as the
 * landing page can render their own navigation surfaces without duplicating
 * registry lookups.
 *
 * It also records the last route for installed launches and restores it when
 * the installed app starts at its `start_url`.
 *
 * @param props - Access-filtered navigation entries.
 */
export function AppLayout({ navigation }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const storedPath = useNavigationStore((state) => state.path);
  const setLastRoute = useNavigationStore((state) => state.setLastRoute);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (location.pathname !== "/" || !isStandaloneLaunch()) return;
    const target = chooseLaunchRoute(
      `${BASE_PATH}${location.pathname}`,
      storedPath,
      BASE_PATH,
    );
    if (target) {
      navigate(stripBasePath(target, BASE_PATH), { replace: true });
    }
  }, [location.pathname, navigate, storedPath]);

  useEffect(() => {
    setLastRoute(`${BASE_PATH}${location.pathname}`);
  }, [location.pathname, setLastRoute]);

  // The top bar only advertises areas that are actually implemented. The
  // landing page still receives every entry so planned areas stay discoverable
  // without becoming top-bar destinations.
  const primaryNavigation = navigation.filter(
    (entry) => entry.availability === "available",
  );
  return (
    <AppShell productName="Obolargus" navigation={primaryNavigation}>
      <Outlet context={{ navigation }} />
    </AppShell>
  );
}

export default AppLayout;
