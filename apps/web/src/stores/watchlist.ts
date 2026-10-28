import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type WatchlistState = {
  ids: string[];
  toggle: (id: string) => boolean;
  has: (id: string) => boolean;
  remove: (id: string) => void;
};

/** Local-first watchlist (FR-30). Synced to the account in Phase 3. */
export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      has: (id) => get().ids.includes(id),
      toggle: (id) => {
        const added = !get().ids.includes(id);
        set({ ids: added ? [...get().ids, id] : get().ids.filter((x) => x !== id) });
        return added;
      },
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
    }),
    {
      name: "triyu:watchlist",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
