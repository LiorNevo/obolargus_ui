import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "lx_client/js/components/Table/store/tableStore";
import { BASE_PATH, isUnderBasePath } from "../offline/paths";

/** Durable last-route memory. It never contains server data. */
export interface NavigationStore {
  basePath: string;
  path: string | null;
  updatedAt: number;
  setLastRoute: (path: string) => void;
  clear: () => void;
}

const initialState = {
  basePath: BASE_PATH,
  path: null,
  updatedAt: 0,
};

/**
 * Records the last in-app route for installed launches.
 *
 * The value is UI state and is persisted through the existing Zustand +
 * IndexedDB pattern. A path outside the current base path is ignored.
 */
export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      ...initialState,
      setLastRoute: (path) => {
        if (!path || path === `${BASE_PATH}/`) return;
        if (!isUnderBasePath(path, BASE_PATH)) return;
        set({ path, updatedAt: Date.now() });
      },
      clear: () => set({ path: null, updatedAt: 0 }),
    }),
    {
      name: "obolargus_navigation_v1",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        basePath: state.basePath,
        path: state.path,
        updatedAt: state.updatedAt,
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<NavigationStore> | undefined;
        if (!stored || stored.basePath !== BASE_PATH) return current;
        return {
          ...current,
          path: stored.path ?? null,
          updatedAt: stored.updatedAt ?? 0,
        };
      },
    },
  ),
);
