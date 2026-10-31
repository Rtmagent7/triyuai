"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { ApiResponse, GlobalStats, Rates } from "@triyuai/shared";
import { GoogleReturn } from "@/components/auth/google";
import { queryKeys } from "@/lib/api/keys";
import { useChat } from "@/stores/chat";
import { usePreferences } from "@/stores/preferences";
import { useRecentSearches } from "@/stores/recent-searches";
import { useWatchlist } from "@/stores/watchlist";

type Props = {
  children: React.ReactNode;
  initial: { rates?: ApiResponse<Rates>; global?: ApiResponse<GlobalStats> };
};

/** Persisted stores skip SSR hydration; load them once on the client to avoid mismatches. */
function useRehydrateStores() {
  useEffect(() => {
    void usePreferences.persist.rehydrate();
    void useWatchlist.persist.rehydrate();
    void useRecentSearches.persist.rehydrate();
    void useChat.persist.rehydrate();
  }, []);
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="bottom-left" />;
}

export function Providers({ children, initial }: Props) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
      },
    });
    if (initial.rates) qc.setQueryData(queryKeys.rates, initial.rates);
    if (initial.global) qc.setQueryData(queryKeys.global, initial.global);
    return qc;
  });
  useRehydrateStores();

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {children}
        <ThemedToaster />
        <GoogleReturn />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
