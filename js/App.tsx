import { RouterProvider } from "react-router-dom";
import ThemeProvider from "lx_client/js/components/ThemeProvider";
import type { AppRouter } from "lx_client/js/navigation/routes";
import { getAppRouter } from "./router";

/** Props for the routed application shell. */
export interface AppProps {
  /**
   * Router to render. Tests and stories inject a memory router; production
   * omits this and uses the browser router created from the page registry.
   */
  router?: AppRouter;
}

/**
 * Application root: theme provider, routed workspace and app container.
 *
 * @param props - Optional injected router.
 */
export function App({ router }: AppProps = {}) {
  const activeRouter = router ?? getAppRouter();

  return (
    <ThemeProvider>
      <div
        className="lx_client_app_container"
        style={{ width: "100%", height: "100%" }}
      >
        <RouterProvider router={activeRouter} />
      </div>
    </ThemeProvider>
  );
}

export default App;
