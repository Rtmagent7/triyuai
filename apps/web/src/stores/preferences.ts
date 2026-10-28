import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Currency } from "@triyuai/shared";

type PreferencesState = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
};

/** Theme is handled by next-themes; currency lives here (FR-04). */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: "usd",
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "triyu:preferences",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
