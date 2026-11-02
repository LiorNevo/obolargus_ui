import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query/keys";
import { OfflineStatusBar } from "./OfflineStatusBar";
import { UpdateNotice } from "./UpdateNotice";
import { useOfflineStore } from "./offlineStore";

const RECONNECT_GRACE_MS = 1_000;

/**
 * Owns connectivity listeners, reconnect refetching, and the global offline UI.
 *
 * A populated view is never blanked: the provider only updates the ephemeral
 * status and asks TanStack to refresh active stale reads.
 */
export function OfflineProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearGrace = () => {
      if (graceTimer.current) clearTimeout(graceTimer.current);
      graceTimer.current = null;
    };

    const goOffline = () => {
      clearGrace();
      useOfflineStore
        .getState()
        .setConnectivity("offline", "browser-offline");
    };

    const goOnline = () => {
      clearGrace();
      useOfflineStore
        .getState()
        .setConnectivity("reconnecting", "reconnected");
      graceTimer.current = setTimeout(() => {
        useOfflineStore
          .getState()
          .setConnectivity("online", "reconnected");
        void queryClient.refetchQueries({ type: "active", stale: true });
        void queryClient.refetchQueries({
          queryKey: queryKeys.dataLoad.allProgress(),
          type: "active",
        });
      }, RECONNECT_GRACE_MS);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      goOffline();
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearGrace();
    };
  }, [queryClient]);

  return (
    <>
      {children}
      <OfflineStatusBar />
      <UpdateNotice />
    </>
  );
}

export default OfflineProvider;
