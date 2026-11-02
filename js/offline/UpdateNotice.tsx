import { useOfflineStore } from "./offlineStore";
import { getActiveCoordinator } from "./updateCoordinator";

/**
 * Non-blocking update notice.
 *
 * The notice stays discoverable after "Later" and never moves focus or blocks
 * the current work.
 */
export function UpdateNotice() {
  const update = useOfflineStore((state) => state.update);
  const coordinator = getActiveCoordinator();

  if (
    update.state !== "available" &&
    update.state !== "deferred" &&
    update.state !== "pending" &&
    update.state !== "failed"
  ) {
    return null;
  }

  return (
    <div
      className="obolargus_update_notice"
      data-state={update.state}
      role="status"
      aria-live="polite"
    >
      {update.state === "failed" ? (
        <span>{update.error ?? "The update could not be completed."}</span>
      ) : update.state === "pending" ? (
        <>
          <span>A new version is ready. Save your work, then reload.</span>
          <button
            type="button"
            onClick={() => coordinator?.confirmSafePoint()}
          >
            Reload now
          </button>
        </>
      ) : (
        <>
          <span>A new version is ready.</span>
          <button type="button" onClick={() => coordinator?.acceptUpdate()}>
            Reload to update
          </button>
          <button type="button" onClick={() => coordinator?.deferUpdate()}>
            Later
          </button>
        </>
      )}
    </div>
  );
}

export default UpdateNotice;
