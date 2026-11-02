import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "lx_client/js/components/Table/store/tableStore";

const REGISTRY_TTL_MS = 10 * 60 * 1000;

/** Short-lived tab registry used to gate retired-cache cleanup. */
export interface UpdateTabRegistry {
  buildId: string | null;
  tabIds: string[];
  reloadedTabIds: string[];
  pendingTabIds: string[];
  closedTabIds: string[];
  createdAt: number;
  expiresAt: number;
  begin: (buildId: string, now?: number) => void;
  addTab: (tabId: string) => void;
  markReloaded: (tabId: string) => void;
  markPending: (tabId: string) => void;
  markClosed: (tabId: string) => void;
  canCleanup: (now?: number) => boolean;
  clear: () => void;
}

function unique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

const empty = {
  buildId: null,
  tabIds: [],
  reloadedTabIds: [],
  pendingTabIds: [],
  closedTabIds: [],
  createdAt: 0,
  expiresAt: 0,
};

/**
 * Tracks which tabs announced an update and which have reloaded or closed.
 *
 * Only tab ids and build ids are stored; it never contains server data.
 */
export const useUpdateTabRegistry = create<UpdateTabRegistry>()(
  persist(
    (set, get) => ({
      ...empty,
      begin: (buildId, now = Date.now()) =>
        set({
          buildId,
          tabIds: [],
          reloadedTabIds: [],
          pendingTabIds: [],
          closedTabIds: [],
          createdAt: now,
          expiresAt: now + REGISTRY_TTL_MS,
        }),
      addTab: (tabId) =>
        set((state) => ({ tabIds: unique(state.tabIds, tabId) })),
      markReloaded: (tabId) =>
        set((state) => ({
          reloadedTabIds: unique(state.reloadedTabIds, tabId),
          pendingTabIds: state.pendingTabIds.filter((id) => id !== tabId),
        })),
      markPending: (tabId) =>
        set((state) => ({ pendingTabIds: unique(state.pendingTabIds, tabId) })),
      markClosed: (tabId) =>
        set((state) => ({
          closedTabIds: unique(state.closedTabIds, tabId),
          pendingTabIds: state.pendingTabIds.filter((id) => id !== tabId),
        })),
      canCleanup: (now = Date.now()) => {
        const state = get();
        if (state.tabIds.length === 0) return false;
        if (state.pendingTabIds.length > 0) return false;
        const finished = new Set([
          ...state.reloadedTabIds,
          ...state.closedTabIds,
        ]);
        if (state.tabIds.every((tabId) => finished.has(tabId))) return true;
        return now >= state.expiresAt;
      },
      clear: () => set({ ...empty }),
    }),
    {
      name: "obolargus_update_tabs_v1",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        buildId: state.buildId,
        tabIds: state.tabIds,
        reloadedTabIds: state.reloadedTabIds,
        pendingTabIds: state.pendingTabIds,
        closedTabIds: state.closedTabIds,
        createdAt: state.createdAt,
        expiresAt: state.expiresAt,
      }),
    },
  ),
);
