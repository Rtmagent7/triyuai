"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ChartRange, CoinsPage, Rates } from "@triyuai/shared";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useLivePrices } from "@/stores/live-prices";

export const useGlobalStats = () =>
  useQuery({ queryKey: queryKeys.global, queryFn: api.global, refetchInterval: 60_000 });

export const useRates = () =>
  useQuery({ queryKey: queryKeys.rates, queryFn: api.rates, staleTime: 60 * 60_000 });

/** Rates in effect for formatting; USD-only until the first response arrives. */
export const useRatesData = (): Rates | undefined => useRates().data?.data;

export function useCoinsPage(page: number, initial?: CoinsPage) {
  // When the WebSocket fails, poll the API instead (FR-09 fallback).
  const polling = useLivePrices((s) => s.status === "polling");
  return useQuery({
    queryKey: queryKeys.coins(page),
    queryFn: () => api.coins(page),
    placeholderData: keepPreviousData,
    refetchInterval: polling ? 30_000 : 5 * 60_000,
    initialData: initial
      ? {
          data: initial,
          meta: { fetchedAt: new Date(0).toISOString(), source: "mock", stale: false },
        }
      : undefined,
    initialDataUpdatedAt: initial ? Date.now() : undefined,
  });
}

export const useCoinsByIds = (ids: string[]) =>
  useQuery({
    queryKey: queryKeys.coinsByIds(ids),
    queryFn: () => api.coinsByIds(ids),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });

export const useHighlights = () =>
  useQuery({ queryKey: queryKeys.highlights, queryFn: api.highlights, staleTime: 60_000 });

export const useChart = (id: string, range: ChartRange) =>
  useQuery({
    queryKey: queryKeys.chart(id, range),
    queryFn: () => api.chart(id, range),
    staleTime: 5 * 60_000,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.search(q),
    enabled: q.trim().length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

export const useCoin = (id: string) =>
  useQuery({ queryKey: queryKeys.coin(id), queryFn: () => api.coin(id), staleTime: 5 * 60_000 });
