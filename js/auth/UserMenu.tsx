import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "lx_client/js/components/Button";
import { Popover } from "lx_client/js/components/Popover";
import { clearOfflineCachesForIdentityChange } from "../offline/identityBoundary";
import { AUTH_ENABLED } from "./config";
import { useAuthStore } from "./store";

/** Signed-in owner menu rendered in the application header. */
export function UserMenu() {
  const queryClient = useQueryClient();
  const actor = useAuthStore((state) => state.actor);
  const clearSession = useAuthStore((state) => state.clearSession);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!AUTH_ENABLED || !actor) return null;

  const initial = actor.email.trim().charAt(0).toUpperCase() || "?";
  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      const result = await clearOfflineCachesForIdentityChange("sign-out");
      if (result.failedCaches.length > 0) {
        setError(
          "Offline data from this account could not be cleared. Sign-out is blocked; retry.",
        );
        return;
      }
      queryClient.clear();
      clearSession();
      setOpen(false);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        className="obolargus_user_menu_trigger"
        aria-label={`Account menu for ${actor.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="obolargus_user_avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="obolargus_user_email">{actor.email}</span>
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        placement="bottom-end"
        ariaLabel="Account menu"
        excludedClass="obolargus_user_menu_trigger"
      >
        <div className="obolargus_user_menu">
          <p className="obolargus_user_menu_identity">{actor.email}</p>
          {error && (
            <p className="obolargus_user_menu_error" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="secondary"
            block
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Popover>
    </>
  );
}

export default UserMenu;
