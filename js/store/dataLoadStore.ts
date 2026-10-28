import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "lx_client/js/components/Table/store/tableStore";
import type {
  DataLoadDraft,
  InFlightRange,
  PersistedReport,
} from "../types/dataLoad";

/** UTC calendar date as `YYYY-MM-DD`. */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultDraft(): DataLoadDraft {
  const today = todayUtc();
  return {
    domain: "market_data",
    mode: "single",
    identifierText: "",
    identifiers: [],
    date: today,
    from: today,
    to: today,
    concurrency: 4,
    sourceId: null,
    createMissingAssets: false,
  };
}

/** State and actions for the Data Load page. */
export interface DataLoadStore {
  draft: DataLoadDraft;
  lastReport: PersistedReport | null;
  inFlightRange: InFlightRange | null;
  setDraft: (patch: Partial<DataLoadDraft>) => void;
  setLastReport: (report: PersistedReport | null) => void;
  setInFlightRange: (value: InFlightRange | null) => void;
  reset: () => void;
}

export const useDataLoadStore = create<DataLoadStore>()(
  persist(
    (set) => ({
      draft: defaultDraft(),
      lastReport: null,
      inFlightRange: null,
      setDraft: (patch) =>
        set((state) => ({ draft: { ...state.draft, ...patch } })),
      setLastReport: (report) => set({ lastReport: report }),
      setInFlightRange: (value) => set({ inFlightRange: value }),
      reset: () =>
        set({ draft: defaultDraft(), lastReport: null, inFlightRange: null }),
    }),
    {
      name: "obolargus_data_load_v1",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        draft: state.draft,
        lastReport: state.lastReport,
        inFlightRange: state.inFlightRange,
      }),
    },
  ),
);
