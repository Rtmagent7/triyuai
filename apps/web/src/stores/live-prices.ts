import { create } from "zustand";

export type LiveStatus = "idle" | "connecting" | "live" | "polling";
export type LiveTick = { price: number; change24h: number; at: number };

type LivePricesState = {
  status: LiveStatus;
  /** keyed by CoinGecko id */
  ticks: Record<string, LiveTick>;
  setStatus: (status: LiveStatus) => void;
  apply: (updates: Record<string, LiveTick>) => void;
};

export const useLivePrices = create<LivePricesState>()((set) => ({
  status: "idle",
  ticks: {},
  setStatus: (status) => set({ status }),
  apply: (updates) => set((s) => ({ ticks: { ...s.ticks, ...updates } })),
}));
