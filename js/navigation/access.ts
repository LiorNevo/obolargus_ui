import type { AccessContext } from "lx_client/js/navigation/types";

/**
 * Temporary permissive access context for the financial workspace.
 *
 * Authentication enforcement is deferred, so the application must render the
 * restricted workspace pages for every caller in this release. Page
 * definitions still carry real visibility and permission metadata, and tests
 * exercise access filtering with explicit permission sets. When authentication
 * lands, replace this constant with the authenticated caller's permissions;
 * it is declared here so there is exactly one place to change.
 */
export const UI_ACCESS_CONTEXT: AccessContext = { grantedPermissions: "all" };
