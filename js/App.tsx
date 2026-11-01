import { useState } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import ThemeProvider from "lx_client/js/components/ThemeProvider";
import type { AppRouter } from "lx_client/js/navigation/routes";
import { getAppRouter } from "./router";
import { createQueryClient } from "./query/client";
import "./styles/app.css";

/** Props for the routed application shell. */
export interface AppProps {
  /**
   * Router to render. Tests and stories inject a memory router; production
   * omits this and uses the browser router created from the page registry.
   */
  router?: AppRouter;
  /** Optional already-created cache for tests and stories. */
  queryClient?: QueryClient;
}

/**
 * Application root: query cache, theme provider, routed workspace and app
 * container.
 *
 * @param props - Optional injected router or query client.
 */
export function App({ router, queryClient }: AppProps = {}) {
  const [defaultQueryClient] = useState(() => createQueryClient());
  const activeRouter = router ?? getAppRouter();
  const activeQueryClient = queryClient ?? defaultQueryClient;

  return (
    <QueryClientProvider client={activeQueryClient}>
      <ThemeProvider>
        <div
          className="lx_client_app_container"
          style={{ width: "100%", height: "100%" }}
        >
          <RouterProvider router={activeRouter} />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
