import type { AccessContext } from "lx_client/js/navigation/types";

/**
 * Access context for an authenticated workspace.
 *
 * Authentication is enforced by `AuthGate`: an unauthenticated caller never
 * reaches the router, and every allowlisted Google account is a full owner of
 * its private workspace (there are no roles). Page definitions still carry
 * visibility and permission metadata so a future role model can narrow this
 * single constant.
 */
export const AUTHENTICATED_ACCESS_CONTEXT: AccessContext = {
  grantedPermissions: "all",
};
