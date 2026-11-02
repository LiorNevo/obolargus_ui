/**
 * Pure message handling for the window ↔ service-worker protocol.
 *
 * The dispatcher takes its effects as an argument so Jest can exercise every
 * branch without a real worker or Cache Storage.
 */
import { WORKER_MESSAGE } from "../offline/constants";

/** A request sent from the window to the worker. */
export interface WorkerMessage<TType extends string = string, TPayload = unknown> {
  type: TType;
  requestId: string;
  payload: TPayload;
}

/** A reply sent from the worker to the window. */
export interface WorkerReply<TType extends string = string, TPayload = unknown> {
  type: TType;
  requestId: string;
  payload: TPayload;
}

/** Version information reported by the active worker. */
export interface WorkerVersion {
  buildId: string;
  scope: string;
  scriptUrl: string;
}

/** Effects the worker provides to the pure dispatcher. */
export interface MessageEffects {
  skipWaiting: () => void;
  clearCaches: () => Promise<{ cleared: string[]; failed: string[] }>;
  getVersion: () => WorkerVersion;
  cleanupRetiredCaches: (keepBuildId: string) => Promise<{ deleted: string[] }>;
}

function readRequestId(message: unknown): string {
  if (
    typeof message === "object" &&
    message !== null &&
    "requestId" in message &&
    typeof (message as { requestId?: unknown }).requestId === "string"
  ) {
    return (message as { requestId: string }).requestId;
  }
  return "unknown";
}

function readType(message: unknown): string | null {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    typeof (message as { type?: unknown }).type === "string"
  ) {
    return (message as { type: string }).type;
  }
  return null;
}

/**
 * Handles one worker message and returns the reply, if any.
 *
 * Unknown types and malformed envelopes are ignored and logged. Handlers never
 * throw or leave a rejected promise for the caller.
 */
export async function handleWorkerMessage(
  message: unknown,
  effects: MessageEffects,
): Promise<WorkerReply | null> {
  const type = readType(message);
  const requestId = readRequestId(message);

  if (!type) {
    console.warn("[offline] ignoring malformed worker message");
    return null;
  }

  switch (type) {
    case WORKER_MESSAGE.skipWaiting: {
      effects.skipWaiting();
      return null;
    }
    case WORKER_MESSAGE.clearCaches: {
      try {
        const result = await effects.clearCaches();
        return {
          type: WORKER_MESSAGE.cachesCleared,
          requestId,
          payload: result,
        };
      } catch (error) {
        console.error("[offline] clearing caches failed", error);
        return {
          type: WORKER_MESSAGE.cachesCleared,
          requestId,
          payload: { cleared: [], failed: ["unknown"] },
        };
      }
    }
    case WORKER_MESSAGE.getVersion:
      return {
        type: WORKER_MESSAGE.version,
        requestId,
        payload: effects.getVersion(),
      };
    case WORKER_MESSAGE.cleanupRetiredCaches: {
      const keepBuildId =
        typeof message === "object" &&
        message !== null &&
        "payload" in message &&
        typeof (message as { payload?: { keepBuildId?: unknown } }).payload
          ?.keepBuildId === "string"
          ? (message as { payload: { keepBuildId: string } }).payload.keepBuildId
          : "";
      try {
        await effects.cleanupRetiredCaches(keepBuildId);
      } catch (error) {
        console.error("[offline] cleaning retired caches failed", error);
      }
      return null;
    }
    default:
      console.warn(`[offline] ignoring unknown worker message type: ${type}`);
      return null;
  }
}
