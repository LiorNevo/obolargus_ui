/// <reference lib="webworker" />
/**
 * Service-worker entry point.
 *
 * This is the only module that touches worker globals and Workbox registration
 * APIs. Cache eligibility, precache filtering, and message handling live in
 * pure modules so they can be tested without a running worker.
 */
import {
  copyResponse,
  registerQuotaErrorCallback,
  setCacheNameDetails,
  type WorkboxPlugin,
} from "workbox-core";
import {
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import {
  CACHED_AT_HEADER,
  CACHE_NAME_PREFIX,
  FROM_CACHE_HEADER,
  PRECACHE_CACHE_PREFIX,
  WORKER_MESSAGE,
} from "../offline/constants";
import {
  buildRouteDescriptors,
  navigationDenylist,
} from "./runtimeCaching";
import {
  filterPrecacheManifest,
  selectRetiredCacheNames,
} from "./precache";
import {
  handleWorkerMessage,
  type MessageEffects,
  type WorkerReply,
} from "./messaging";
import { isCacheableApiResponse } from "../offline/cachePolicy";
import {
  API_BASE_PATH,
  BASE_PATH,
  BUILD_ID,
  SCOPE_KEY,
} from "../offline/paths";
import type { PolicyContext } from "../offline/cachePolicy";

const workerSelf = self as unknown as ServiceWorkerGlobalScope;

const context: PolicyContext = {
  basePath: BASE_PATH,
  apiBasePath: API_BASE_PATH,
  buildId: BUILD_ID,
  origin: workerSelf.location.origin,
};

setCacheNameDetails({
  prefix: CACHE_NAME_PREFIX,
  precache: `${PRECACHE_CACHE_PREFIX}-${SCOPE_KEY}`,
  suffix: BUILD_ID,
});

const precacheEntries = filterPrecacheManifest(self.__WB_MANIFEST, BASE_PATH);
precacheAndRoute(precacheEntries);

const provenancePlugin: WorkboxPlugin = {
  cacheWillUpdate: async ({ response }) => {
    if (!(await isCacheableApiResponse(response))) return null;
    return copyResponse(response, (init) => {
      const headers = new Headers(init.headers);
      headers.set(CACHED_AT_HEADER, String(Date.now()));
      return { ...init, headers };
    });
  },
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return undefined;
    return copyResponse(cachedResponse, (init) => {
      const headers = new Headers(init.headers);
      headers.set(FROM_CACHE_HEADER, "1");
      return { ...init, headers };
    });
  },
};

const routes = buildRouteDescriptors(context);
const apiRoute = routes.find((route) => route.id === "api-read");
const staticRoute = routes.find((route) => route.id === "static-asset");

if (apiRoute && apiRoute.cacheName) {
  registerRoute(
    ({ request, url }) =>
      apiRoute.matcher({
        method: request.method,
        url: url.toString(),
        mode: request.mode,
        destination: request.destination,
      }),
    new NetworkFirst({
      cacheName: apiRoute.cacheName,
      networkTimeoutSeconds: apiRoute.networkTimeoutSeconds ?? undefined,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        provenancePlugin,
        new ExpirationPlugin({
          maxEntries: apiRoute.maxEntries ?? undefined,
          maxAgeSeconds: apiRoute.maxAgeSeconds ?? undefined,
          purgeOnQuotaError: apiRoute.purgeOnQuotaError,
        }),
      ],
    }),
  );
}

if (staticRoute && staticRoute.cacheName) {
  registerRoute(
    ({ request, url }) =>
      staticRoute.matcher({
        method: request.method,
        url: url.toString(),
        mode: request.mode,
        destination: request.destination,
      }),
    new CacheFirst({
      cacheName: staticRoute.cacheName,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({
          maxEntries: staticRoute.maxEntries ?? undefined,
          maxAgeSeconds: staticRoute.maxAgeSeconds ?? undefined,
          purgeOnQuotaError: staticRoute.purgeOnQuotaError,
        }),
      ],
    }),
  );
}

registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL(`${BASE_PATH}/index.html`),
    { denylist: navigationDenylist(BASE_PATH) },
  ),
);

async function postToClients(reply: WorkerReply): Promise<void> {
  const clients = await workerSelf.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage(reply);
  }
}

async function clearRuntimeCaches(): Promise<{
  cleared: string[];
  failed: string[];
}> {
  const names = await caches.keys();
  const cleared: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    names.map(async (name) => {
      if (
        !name.startsWith(`${CACHE_NAME_PREFIX}-api-`) &&
        !name.startsWith(`${CACHE_NAME_PREFIX}-static-`)
      ) {
        return;
      }
      try {
        const deleted = await caches.delete(name);
        if (deleted) cleared.push(name);
        else failed.push(name);
      } catch {
        failed.push(name);
      }
    }),
  );
  return { cleared, failed };
}

async function cleanupRetiredCaches(
  keepBuildId: string,
): Promise<{ deleted: string[] }> {
  const names = await caches.keys();
  const retired = selectRetiredCacheNames(
    names,
    SCOPE_KEY,
    keepBuildId || BUILD_ID,
  );
  const deleted: string[] = [];
  await Promise.all(
    retired.map(async (name) => {
      try {
        if (await caches.delete(name)) deleted.push(name);
      } catch {
        // A failed retirement is retried on the next update cycle.
      }
    }),
  );
  return { deleted };
}

const effects: MessageEffects = {
  skipWaiting: () => {
    void workerSelf.skipWaiting();
  },
  clearCaches: clearRuntimeCaches,
  getVersion: () => ({
    buildId: BUILD_ID,
    scope: `${BASE_PATH}/`,
    scriptUrl: `${BASE_PATH}/service-worker.js`,
  }),
  cleanupRetiredCaches,
};

workerSelf.addEventListener("message", (event) => {
  const port = event.ports?.[0];
  void handleWorkerMessage(event.data as unknown, effects).then((reply) => {
    if (!reply) return;
    if (port) {
      port.postMessage(reply);
      return;
    }
    const source = event.source as Client | null;
    source?.postMessage(reply);
  });
});

registerQuotaErrorCallback(() => {
  void postToClients({
    type: WORKER_MESSAGE.cacheWriteFailed,
    requestId: "quota-write",
    payload: { cacheName: "runtime", requestUrl: "", reason: "quota" },
  });
  void postToClients({
    type: WORKER_MESSAGE.cachePurged,
    requestId: "quota-purge",
    payload: { cacheName: "runtime", remaining: 0 },
  });
});
