import { useOfflineStore, type ConnectivityState } from "./offlineStore";

const LABELS: Record<ConnectivityState, string> = {
  online: "",
  offline: "Offline — showing cached data where available.",
  reconnecting: "Reconnecting…",
  unsupported: "Offline mode is not available in this browser.",
};

/**
 * Non-blocking connectivity status.
 *
 * The bar uses a polite live region and fixed positioning so it never moves
 * primary navigation or actions.
 */
export function OfflineStatusBar() {
  const status = useOfflineStore((state) => state.status);

  if (status.state === "online") return null;

  return (
    <div
      className="obolargus_offline_status"
      data-state={status.state}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {LABELS[status.state]}
    </div>
  );
}

export default OfflineStatusBar;
