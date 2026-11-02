/**
 * Worker-only ambient declarations.
 *
 * `process.env.*` values are replaced at build time by webpack's DefinePlugin.
 * The window project keeps `@types/node`; this declaration gives the WebWorker
 * project the same minimal shape without pulling Node globals into it.
 */
declare const process: {
  env: Record<string, string | undefined>;
};

interface WorkerGlobalScope {
  /** Manifest injected by `workbox-webpack-plugin`'s InjectManifest. */
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
}
