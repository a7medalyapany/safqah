import { create } from "zustand";

import { invoke } from "@/shared/utils/invoke";

export type Session = {
  id: number;
  cashier_id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash_millieme: number;
  closing_cash_millieme: number;
  status: "open" | "closed";
  notes: string | null;
};

export type SessionState = {
  activeSession: Session | null;
  isLoading: boolean;
  fetchActiveSession: () => Promise<void>;
  openSession: (cashierId: number, openingCash: number) => Promise<void>;
  closeSession: (closingCash: number, notes?: string) => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  isLoading: true,
  async fetchActiveSession() {
    set({ isLoading: true });

    try {
      const activeSession = await invoke<Session | null>(
        "get_active_session",
        undefined,
        {
          toast: false,
        },
      );
      set({ activeSession, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  async openSession(cashierId, openingCash) {
    const activeSession = await invoke<Session>(
      "open_session",
      {
        cashierId,
        openingCashMillieme: openingCash,
      },
      { toast: false },
    );

    set({ activeSession, isLoading: false });
  },
  async closeSession(closingCash, notes) {
    const sessionId = get().activeSession?.id;

    if (!sessionId) {
      return;
    }

    const activeSession = await invoke<Session>(
      "close_session",
      {
        sessionId,
        closingCashMillieme: closingCash,
        notes: notes ?? null,
      },
      { toast: false },
    );

    set({
      activeSession: activeSession.status === "open" ? activeSession : null,
      isLoading: false,
    });
  },
}));
