import { create } from "zustand";
import type { Role } from "./types";
import { formatDate } from "./time";

export interface AppState {
  ready: boolean;
  currentUserId: string | null;
  currentUserName: string;
  role: Role;
  selectedDate: string;
  selectedShiftId: string | null;
  autoShift: boolean;
  otRoundMinutes: number;
  sampleData: boolean;
  setReady: (v: boolean) => void;
  hydrate: (partial: Partial<AppState>) => void;
  setUser: (id: string | null, name: string, role: Role) => void;
  setDate: (date: string) => void;
  setShift: (id: string | null, auto: boolean) => void;
  setOtRound: (n: number) => void;
  setSampleData: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  currentUserId: null,
  currentUserName: "Hệ thống",
  role: "ADMIN",
  selectedDate: formatDate(new Date()),
  selectedShiftId: null,
  autoShift: true,
  otRoundMinutes: 30,
  sampleData: false,
  setReady: (ready) => set({ ready }),
  hydrate: (partial) => set(partial),
  setUser: (currentUserId, currentUserName, role) =>
    set({ currentUserId, currentUserName, role }),
  setDate: (selectedDate) => set({ selectedDate }),
  setShift: (selectedShiftId, autoShift) => set({ selectedShiftId, autoShift }),
  setOtRound: (otRoundMinutes) => set({ otRoundMinutes }),
  setSampleData: (sampleData) => set({ sampleData }),
}));
