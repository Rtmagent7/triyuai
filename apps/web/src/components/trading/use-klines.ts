"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PairUnavailableError,
  fetchKlines,
  mergeBar,
  subscribeKlines,
  type Interval,
} from "@/lib/ta/binance";
import type { Bar } from "@/lib/ta/indicators";

export type KlinesStatus = "loading" | "ready" | "error" | "unavailable";

type Handlers = {
  /** A new symbol/interval finished loading. */
  onReset: (bars: Bar[]) => void;
  /** The forming bar changed or a new bar opened. */
  onLive: () => void;
  /** Older history was prepended. */
  onPrepend: (bars: Bar[], added: number) => void;
};

/** Keeps memory bounded when scrolling far back on small timeframes. */
const MAX_BARS = 6000;

/**
 * Candles from Binance: 1000 bars of history, the forming bar over WebSocket,
 * and older pages on demand. Bars live in a ref so live ticks don't re-render React.
 */
export function useKlines(symbol: string | null, interval: Interval, handlers: Handlers) {
  const [status, setStatus] = useState<KlinesStatus>(symbol ? "loading" : "unavailable");
  const [attempt, setAttempt] = useState(0);
  const bars = useRef<Bar[]>([]);
  const h = useRef(handlers);
  h.current = handlers;
  const more = useRef({ loading: false, done: false });

  useEffect(() => {
    if (!symbol) {
      setStatus("unavailable");
      return;
    }
    const ctrl = new AbortController();
    let unsubscribe: (() => void) | undefined;
    setStatus("loading");
    more.current = { loading: false, done: false };

    fetchKlines(symbol, interval, { signal: ctrl.signal })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        bars.current = data;
        setStatus(data.length ? "ready" : "unavailable");
        if (!data.length) return;
        h.current.onReset(data);
        unsubscribe = subscribeKlines(symbol, interval, (bar) => {
          mergeBar(bars.current, bar);
          h.current.onLive();
        });
      })
      .catch((err: Error) => {
        if (ctrl.signal.aborted) return;
        setStatus(err instanceof PairUnavailableError ? "unavailable" : "error");
      });

    return () => {
      ctrl.abort();
      unsubscribe?.();
    };
  }, [symbol, interval, attempt]);

  const loadMore = useCallback(async () => {
    const first = bars.current[0];
    if (!symbol || !first || more.current.loading || more.current.done) return;
    if (bars.current.length >= MAX_BARS) return;
    more.current.loading = true;
    try {
      const older = (await fetchKlines(symbol, interval, { endTime: first.time })).filter(
        (b) => b.time < first.time,
      );
      if (!older.length) more.current.done = true;
      else {
        bars.current = [...older, ...bars.current];
        h.current.onPrepend(bars.current, older.length);
      }
    } catch {
      /* keep what we have; scrolling again retries */
    } finally {
      more.current.loading = false;
    }
  }, [symbol, interval]);

  return { status, bars, loadMore, retry: () => setAttempt((n) => n + 1) };
}
