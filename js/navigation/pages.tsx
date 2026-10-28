import type { PageDefinition } from "lx_client/js/navigation/types";
import PlaceholderPage from "lx_client/js/components/PlaceholderPage";
import { TestPage } from "../components/TestPage";
import { LandingPage } from "../pages/LandingPage";
import { DataLoadPage } from "../pages/DataLoadPage";

/**
 * User-facing page registry for the financial workspace.
 *
 * Home is the authenticated landing page. The six workspace areas are
 * declared now; Data Load is available, while the remaining areas render an
 * honest "not yet available" placeholder until they ship. The developer-only
 * component test page is registered last with `showInNavigation: false`, so it
 * resolves by direct URL but never appears in user navigation. Visibility is
 * explicit on every page; authentication enforcement is deferred, so the
 * application currently supplies a temporary permissive access context.
 */
export const PAGES: PageDefinition[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    title: "Home",
    visibility: "restricted",
    requiredPermission: "workspace:view",
    availability: "available",
    showInNavigation: true,
    element: <LandingPage title="Home" />,
  },
  {
    id: "data-load",
    path: "/data-load",
    label: "Data Load",
    title: "Data Load",
    visibility: "restricted",
    requiredPermission: "workspace:view",
    availability: "available",
    showInNavigation: true,
    element: <DataLoadPage />,
  },
  {
    id: "dashboard",
    path: "/dashboard",
    label: "Dashboard",
    title: "Dashboard",
    visibility: "restricted",
    requiredPermission: "workspace:view",
    availability: "not_yet_available",
    showInNavigation: true,
    element: <PlaceholderPage title="Dashboard" />,
  },
  {
    id: "portfolios",
    path: "/portfolios",
    label: "Portfolios",
    title: "Portfolios",
    visibility: "restricted",
    requiredPermission: "portfolio:view",
    availability: "not_yet_available",
    showInNavigation: true,
    element: <PlaceholderPage title="Portfolios" />,
  },
  {
    id: "analysis",
    path: "/analysis",
    label: "Analysis",
    title: "Analysis",
    visibility: "restricted",
    requiredPermission: "analysis:view",
    availability: "not_yet_available",
    showInNavigation: true,
    element: <PlaceholderPage title="Analysis" />,
  },
  {
    id: "rules",
    path: "/rules",
    label: "Rules",
    title: "Rules",
    visibility: "restricted",
    requiredPermission: "rules:view",
    availability: "not_yet_available",
    showInNavigation: true,
    element: <PlaceholderPage title="Rules" />,
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    title: "Settings",
    visibility: "restricted",
    requiredPermission: "settings:view",
    availability: "not_yet_available",
    showInNavigation: true,
    element: <PlaceholderPage title="Settings" />,
  },
  {
    id: "component-test",
    path: "/__components",
    label: "Component test",
    title: "Component test",
    visibility: "restricted",
    requiredPermission: "dev:tools",
    availability: "available",
    showInNavigation: false,
    element: <TestPage />,
  },
];
