import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Interval } from "@/lib/ta/binance";
import type { Drawing, DrawingStyle } from "@/lib/ta/drawings";
import {
  defaultParams,
  OVERLAY_PALETTE,
  type IndicatorConfig,
  type IndicatorType,
} from "@/lib/ta/registry";

export type ChartStyle = "candles" | "bars" | "heikin" | "line" | "area";
export type ScaleMode = "normal" | "log" | "percent";

type ChartLayoutState = {
  interval: Interval;
  style: ChartStyle;
  scale: ScaleMode;
  /** Snap drawing anchors to the nearest open/high/low/close. */
  magnet: boolean;
  /** Indicators apply to every coin, like a TradingView layout. */
  indicators: IndicatorConfig[];
  /** Drawings belong to one coin. */
  drawings: Record<string, Drawing[]>;
  /** Style for the next drawing. */
  drawingStyle: DrawingStyle;
  /** Last custom colours picked, newest first. */
  recentColors: string[];
  setDrawingStyle: (patch: Partial<DrawingStyle>) => void;
  addRecentColor: (color: string) => void;
  setInterval: (interval: Interval) => void;
  setStyle: (style: ChartStyle) => void;
  setScale: (scale: ScaleMode) => void;
  toggleMagnet: () => void;
  addIndicator: (type: IndicatorType) => void;
  updateIndicator: (id: string, patch: Partial<IndicatorConfig>) => void;
  removeIndicator: (id: string) => void;
  addDrawing: (coinId: string, d: Drawing) => void;
  updateDrawing: (coinId: string, d: Drawing) => void;
  removeDrawing: (coinId: string, id: string) => void;
  clearDrawings: (coinId: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const useChartLayout = create<ChartLayoutState>()(
  persist(
    (set, get) => ({
      interval: "1h",
      style: "candles",
      scale: "normal",
      magnet: false,
      indicators: [{ id: "volume", type: "volume", params: [] }],
      drawings: {},
      drawingStyle: { color: "#2962ff", width: 2, dash: "solid" },
      recentColors: [],
      setDrawingStyle: (patch) => set({ drawingStyle: { ...get().drawingStyle, ...patch } }),
      addRecentColor: (color) =>
        set({
          recentColors: [color, ...get().recentColors.filter((c) => c !== color)].slice(0, 10),
        }),
      setInterval: (interval) => set({ interval }),
      setStyle: (style) => set({ style }),
      setScale: (scale) => set({ scale }),
      toggleMagnet: () => set({ magnet: !get().magnet }),
      addIndicator: (type) => {
        const used = get().indicators.filter((i) => i.color).length;
        set({
          indicators: [
            ...get().indicators,
            {
              id: `${type}-${uid()}`,
              type,
              params: defaultParams(type),
              ...(type === "sma" || type === "ema" || type === "vwap"
                ? { color: OVERLAY_PALETTE[used % OVERLAY_PALETTE.length] }
                : {}),
            },
          ],
        });
      },
      updateIndicator: (id, patch) =>
        set({ indicators: get().indicators.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
      removeIndicator: (id) => set({ indicators: get().indicators.filter((i) => i.id !== id) }),
      addDrawing: (coinId, d) =>
        set({ drawings: { ...get().drawings, [coinId]: [...(get().drawings[coinId] ?? []), d] } }),
      updateDrawing: (coinId, d) =>
        set({
          drawings: {
            ...get().drawings,
            [coinId]: (get().drawings[coinId] ?? []).map((x) => (x.id === d.id ? d : x)),
          },
        }),
      removeDrawing: (coinId, id) =>
        set({
          drawings: {
            ...get().drawings,
            [coinId]: (get().drawings[coinId] ?? []).filter((x) => x.id !== id),
          },
        }),
      clearDrawings: (coinId) => {
        const rest = { ...get().drawings };
        delete rest[coinId];
        set({ drawings: rest });
      },
    }),
    {
      name: "triyu:chart-layout",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only read by client-only chart components, so it hydrates on creation.
      partialize: ({
        interval,
        style,
        scale,
        magnet,
        indicators,
        drawings,
        drawingStyle,
        recentColors,
      }) => ({ interval, style, scale, magnet, indicators, drawings, drawingStyle, recentColors }),
    },
  ),
);

export const newDrawingId = uid;
