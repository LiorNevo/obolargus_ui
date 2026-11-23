/**
 * Build-time authentication configuration.
 *
 * Both values are replaced by webpack's `DefinePlugin`; the defaults keep a
 * fail-closed posture (authentication enabled, no client id configured).
 */
export const AUTH_ENABLED: boolean =
  (process.env.AUTH_ENABLED ?? "true").trim().toLowerCase() !== "false";

/** Google OAuth web client id used by Google Identity Services. */
export const GOOGLE_CLIENT_ID: string = (
  process.env.GOOGLE_CLIENT_ID ?? ""
).trim();
