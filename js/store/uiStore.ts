import { create } from "zustand";

interface UIState {
  title: string;
}

const useUIStore = create<UIState>()(() => ({
  title: "Obolargus",
}));

export { useUIStore };
