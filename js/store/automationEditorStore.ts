import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "lx_client/js/components/Table/store/tableStore";

/** UI-only editor state. Server state belongs to TanStack Query. */
export interface AutomationEditorState {
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  paletteSearch: string;
  debugFilter: string;
  debugPaused: boolean;
  dirty: boolean;
  lastSavedRevision: number | null;
  setSelection(nodeIds: string[]): void;
  setPaletteSearch(value: string): void;
  setDebugFilter(value: string): void;
  setDebugPaused(value: boolean): void;
  setDirty(value: boolean): void;
  setLastSavedRevision(value: number | null): void;
  reset(): void;
}

const initial = {
  selectedNodeId: null,
  selectedNodeIds: [],
  paletteSearch: "",
  debugFilter: "",
  debugPaused: false,
  dirty: false,
  lastSavedRevision: null,
};

/** Zustand store for transient editor UI state. */
export const useAutomationEditorStore = create<AutomationEditorState>()(
  persist(
    (set) => ({
      ...initial,
      setSelection: (nodeIds) =>
        set({
          selectedNodeIds: nodeIds,
          selectedNodeId: nodeIds[0] ?? null,
        }),
      setPaletteSearch: (value) => set({ paletteSearch: value }),
      setDebugFilter: (value) => set({ debugFilter: value }),
      setDebugPaused: (value) => set({ debugPaused: value }),
      setDirty: (value) => set({ dirty: value }),
      setLastSavedRevision: (value) => set({ lastSavedRevision: value }),
      reset: () => set(initial),
    }),
    {
      name: "obolargus_automation_editor_v1",
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        paletteSearch: state.paletteSearch,
        debugFilter: state.debugFilter,
        debugPaused: state.debugPaused,
      }),
    },
  ),
);
