import NotFoundPage from "lx_client/js/components/NotFoundPage";
import RouteErrorPage from "lx_client/js/components/RouteErrorPage";
import { createAppRouter } from "lx_client/js/navigation/routes";
import type { AppRouter } from "lx_client/js/navigation/routes";
import { BASE_PATH } from "./config";
import { UI_ACCESS_CONTEXT } from "./navigation/access";
import { AppLayout } from "./navigation/AppLayout";
import { PAGES } from "./navigation/pages";

let appRouter: AppRouter | undefined;

/**
 * Creates the browser router on first use.
 *
 * Lazy creation keeps tests and stories from constructing a browser router
 * (and attaching browser history listeners) when they inject a memory router.
 * Production calls this once through {@link App}.
 */
export function getAppRouter(): AppRouter {
  if (!appRouter) {
    appRouter = createAppRouter({
      pages: PAGES,
      Layout: AppLayout,
      access: UI_ACCESS_CONTEXT,
      basename: BASE_PATH,
      notFoundElement: <NotFoundPage />,
      errorElement: <RouteErrorPage />,
    });
  }

  return appRouter;
}
