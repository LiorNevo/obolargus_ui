import { Outlet } from "react-router-dom";
import AppShell from "lx_client/js/components/AppShell";
import type { NavigationEntry } from "lx_client/js/navigation/types";

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
 * @param props - Access-filtered navigation entries.
 */
export function AppLayout({ navigation }: AppLayoutProps) {
  return (
    <AppShell productName="Obolargus" navigation={navigation}>
      <Outlet context={{ navigation }} />
    </AppShell>
  );
}

export default AppLayout;
