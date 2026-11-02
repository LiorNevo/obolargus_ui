import { OfflineWriteError, isBrowserOnline } from "./errors";

/**
 * Rejects a server-changing action before it reaches the network.
 *
 * The check is deliberately synchronous: the operator gets an immediate,
 * actionable message and no request is queued or replayed.
 */
export function assertOnlineForWrite(): void {
  if (!isBrowserOnline()) {
    throw new OfflineWriteError();
  }
}
