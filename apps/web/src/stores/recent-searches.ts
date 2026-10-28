import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CoinSummary } from "@triyuai/shared";

type RecentSearchesState = {
  items: CoinSummary[];
  add: (coin: CoinSummary) => void;
  clear: () => void;
};

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (coin) =>
        set({ items: [coin, ...get().items.filter((c) => c.id !== coin.id)].slice(0, 5) }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "triyu:recent-searches",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
