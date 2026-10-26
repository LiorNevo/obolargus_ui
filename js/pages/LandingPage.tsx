import { useOutletContext } from "react-router-dom";
import NavigationMenu from "lx_client/js/components/NavigationMenu";
import { usePageTitle } from "lx_client/js/navigation/usePageTitle";
import type { NavigationEntry } from "lx_client/js/navigation/types";

/** Navigation entries provided by the application layout route. */
interface LandingPageContext {
  navigation: NavigationEntry[];
}

/** Props for the landing page. */
export interface LandingPageProps {
  /** Page heading and document title. */
  title: string;
}

/**
 * Authenticated home page for the financial workspace.
 *
 * Presents the five workspace areas as real links and makes no backend call.
 * Areas whose functionality has not shipped are linked to labeled
 * placeholders rather than sample balances, positions or orders.
 *
 * @param props - Page title.
 */
export function LandingPage({ title }: LandingPageProps) {
  usePageTitle(title);

  const { navigation } = useOutletContext<LandingPageContext>();
  const workspaceAreas = navigation.filter((entry) => entry.id !== "home");

  return (
    <section className="obolargus_landing_page">
      <h1 className="obolargus_landing_page_title">{title}</h1>
      <p className="obolargus_landing_page_intro">
        Choose a workspace area to continue. Areas marked as not yet available
        are planned for a later release.
      </p>
      <NavigationMenu ariaLabel="Workspace areas" entries={workspaceAreas} />
    </section>
  );
}

export default LandingPage;
