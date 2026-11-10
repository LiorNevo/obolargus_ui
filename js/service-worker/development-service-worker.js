// Development-only worker.
//
// A production deployment may have registered a worker under the same scope.
// Replying with a valid script lets the browser complete its update check;
// this worker then removes itself and all caches so development always uses
// network responses.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    })(),
  );
});
