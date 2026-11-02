import { create } from "zustand";

/** Connectivity states exposed to the operator. */
export type ConnectivityState =
  | "online"
  | "offline"
  | "reconnecting"
  | "unsupported";

/** Why the connectivity state last changed. */
export type ConnectivityReason =
  | "browser-offline"
  | "cache-served"
  | "network-error"
  | "reconnected"
  | "unsupported";

/** Operator-visible connectivity state. */
export interface OfflineStatus {
  state: ConnectivityState;
  lastChangedAt: number;
  reason: ConnectivityReason;
  activeReadCount: number;
}

/** Provenance of one displayed read. */
export interface ReadProvenanceRecord {
  queryKeyHash: string;
  requestUrl: string;
  source: "network" | "cache";
  cachedAt: number | null;
  fetchedAt: number;
  offline: boolean;
}

/** Window-side update lifecycle state. */
export type UpdateLifecycleState =
  | "idle"
  | "checking"
  | "available"
  | "deferred"
  | "activating"
  | "pending"
  | "failed";

/** Update lifecycle details. */
export interface UpdateState {
  state: UpdateLifecycleState;
  availableVersion: string | null;
  detectedAt: number | null;
  lastCheckAt: number | null;
  error: string | null;
  deferredUntil: number | null;
}

/** Identity-clearing lifecycle state. */
export type IdentityClearStatus = "idle" | "clearing" | "cleared" | "failed";

/** Identity-boundary state. */
export interface IdentityState {
  identityKey: string | null;
  clearRequestedAt: number | null;
  clearStatus: IdentityClearStatus;
  error: string | null;
}

/** The ephemeral offline store. It is never persisted. */
export interface OfflineStore {
  status: OfflineStatus;
  provenance: Record<string, ReadProvenanceRecord>;
  update: UpdateState;
  identity: IdentityState;
  setConnectivity: (state: ConnectivityState, reason: ConnectivityReason) => void;
  markCacheServed: () => void;
  recordProvenance: (record: ReadProvenanceRecord) => void;
  clearProvenance: (queryKeyHash?: string) => void;
  setUpdateState: (patch: Partial<UpdateState>) => void;
  setIdentityClear: (patch: Partial<IdentityState>) => void;
  reset: () => void;
}

const initialStatus = (): OfflineStatus => ({
  state: "online",
  lastChangedAt: Date.now(),
  reason: "reconnected",
  activeReadCount: 0,
});

const initialUpdate = (): UpdateState => ({
  state: "idle",
  availableVersion: null,
  detectedAt: null,
  lastCheckAt: null,
  error: null,
  deferredUntil: null,
});

const initialIdentity = (): IdentityState => ({
  identityKey: null,
  clearRequestedAt: null,
  clearStatus: "idle",
  error: null,
});

/**
 * Creates the ephemeral store.
 *
 * Exported for tests that need an isolated instance; the application uses the
 * shared singleton below.
 */
export function createOfflineStore() {
  return create<OfflineStore>()((set) => ({
    status: initialStatus(),
    provenance: {},
    update: initialUpdate(),
    identity: initialIdentity(),
    setConnectivity: (state, reason) =>
      set((current) => ({
        status: {
          ...current.status,
          state,
          reason,
          lastChangedAt: Date.now(),
        },
      })),
    markCacheServed: () =>
      set((current) => ({
        status: {
          ...current.status,
          state: current.status.state === "unsupported" ? "unsupported" : "offline",
          reason: "cache-served",
          lastChangedAt: Date.now(),
        },
      })),
    recordProvenance: (record) =>
      set((current) => ({
        provenance: {
          ...current.provenance,
          [record.queryKeyHash]: record,
        },
      })),
    clearProvenance: (queryKeyHash) =>
      set((current) => {
        if (!queryKeyHash) return { provenance: {} };
        const next = { ...current.provenance };
        delete next[queryKeyHash];
        return { provenance: next };
      }),
    setUpdateState: (patch) =>
      set((current) => ({ update: { ...current.update, ...patch } })),
    setIdentityClear: (patch) =>
      set((current) => ({ identity: { ...current.identity, ...patch } })),
    reset: () =>
      set({
        status: initialStatus(),
        provenance: {},
        update: initialUpdate(),
        identity: initialIdentity(),
      }),
  }));
}

/** Shared ephemeral store used by the window runtime. */
export const useOfflineStore = createOfflineStore();
