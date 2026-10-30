import {
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  vwap,
  type Bar,
  type Series,
} from "./indicators";
import { withAlpha, type LineDash } from "./colors";

export type IndicatorType = "sma" | "ema" | "bb" | "vwap" | "volume" | "rsi" | "macd" | "stoch";

export const SOURCES = ["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"] as const;
export type Source = (typeof SOURCES)[number];

export const sourceLabel: Record<Source, string> = {
  close: "Close",
  open: "Open",
  high: "High",
  low: "Low",
  hl2: "(H + L) / 2",
  hlc3: "(H + L + C) / 3",
  ohlc4: "(O + H + L + C) / 4",
};

/** Per-output style overrides from the settings dialog. */
export type PlotStyle = { color?: string; width?: number; dash?: LineDash; hidden?: boolean };

export type IndicatorConfig = {
  id: string;
  type: IndicatorType;
  params: number[];
  /** Line colour for single-line overlays (SMA, EMA, VWAP), set when added. */
  color?: string;
  hidden?: boolean;
  /** Price input for price-based indicators (default close). */
  source?: Source;
  styles?: Record<string, PlotStyle>;
  /** Histogram bar colours (Volume, MACD). */
  upColor?: string;
  downColor?: string;
  /** Guide levels, e.g. RSI 30/70; defaults to the definition's. */
  levels?: number[];
  levelColor?: string;
};

export type IndicatorOutput = {
  key: string;
  label: string;
  kind: "line" | "histogram";
  color: string;
  values: Series;
  /** Per-bar colours for histograms (volume, MACD). */
  colors?: string[];
  width?: number;
  dash?: LineDash;
  hidden?: boolean;
};

type Param = { label: string; default: number; min: number; max: number; step?: number };

export type IndicatorDef = {
  type: IndicatorType;
  name: string;
  description: string;
  /** main: drawn over price; volume: bottom of the price pane; pane: its own pane below. */
  placement: "main" | "volume" | "pane";
  params: Param[];
  /** Has a "Source" input (close, hl2, …). */
  usesSource?: boolean;
  /** Dashed guide lines in the indicator pane (e.g. RSI 30/70). */
  levels?: number[];
  short: (params: number[]) => string;
  compute: (
    bars: Bar[],
    params: number[],
    cfg: IndicatorConfig,
    colors: TaColors,
  ) => IndicatorOutput[];
};

export type TaColors = { up: string; down: string };

export const OVERLAY_PALETTE = ["#f59e0b", "#1a9bff", "#ec4899", "#14b8a6", "#e2725b", "#84cc16"];

export function sourceValues(bars: Bar[], source: Source = "close"): number[] {
  return bars.map((b) => {
    switch (source) {
      case "open":
        return b.open;
      case "high":
        return b.high;
      case "low":
        return b.low;
      case "hl2":
        return (b.high + b.low) / 2;
      case "hlc3":
        return (b.high + b.low + b.close) / 3;
      case "ohlc4":
        return (b.open + b.high + b.low + b.close) / 4;
      default:
        return b.close;
    }
  });
}

const closes = (bars: Bar[], cfg?: IndicatorConfig) => sourceValues(bars, cfg?.source);
const alpha = withAlpha;
const toHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#888888");

export const INDICATORS: Record<IndicatorType, IndicatorDef> = {
  sma: {
    type: "sma",
    name: "Moving Average (SMA)",
    description: "Average close over N bars.",
    placement: "main",
    params: [{ label: "Length", default: 20, min: 1, max: 500 }],
    short: ([n]) => `SMA ${n}`,
    usesSource: true,
    compute: (bars, [n], cfg) => [
      {
        key: "sma",
        label: `SMA ${n}`,
        kind: "line",
        color: cfg.color ?? OVERLAY_PALETTE[0]!,
        values: sma(closes(bars, cfg), n!),
      },
    ],
  },
  ema: {
    type: "ema",
    name: "Exponential MA (EMA)",
    description: "Moving average that weights recent bars more.",
    placement: "main",
    params: [{ label: "Length", default: 50, min: 1, max: 500 }],
    short: ([n]) => `EMA ${n}`,
    usesSource: true,
    compute: (bars, [n], cfg) => [
      {
        key: "ema",
        label: `EMA ${n}`,
        kind: "line",
        color: cfg.color ?? OVERLAY_PALETTE[1]!,
        values: ema(closes(bars, cfg), n!),
      },
    ],
  },
  bb: {
    type: "bb",
    name: "Bollinger Bands",
    description: "SMA with bands N standard deviations away.",
    placement: "main",
    params: [
      { label: "Length", default: 20, min: 2, max: 200 },
      { label: "StdDev", default: 2, min: 0.5, max: 5, step: 0.1 },
    ],
    short: ([n, m]) => `BB ${n} ${m}`,
    usesSource: true,
    compute: (bars, [n, m], cfg) => {
      const b = bollinger(closes(bars, cfg), n!, m!);
      return [
        { key: "upper", label: "Upper", kind: "line", color: "#3b82f6", values: b.upper },
        { key: "mid", label: "Basis", kind: "line", color: "#f59e0b", values: b.mid },
        { key: "lower", label: "Lower", kind: "line", color: "#3b82f6", values: b.lower },
      ];
    },
  },
  vwap: {
    type: "vwap",
    name: "VWAP",
    description: "Volume-weighted average price, reset daily (UTC).",
    placement: "main",
    params: [],
    short: () => "VWAP",
    compute: (bars, _p, cfg) => [
      {
        key: "vwap",
        label: "VWAP",
        kind: "line",
        color: cfg.color ?? "#ec4899",
        values: vwap(bars),
      },
    ],
  },
  volume: {
    type: "volume",
    name: "Volume",
    description: "Traded volume per bar, coloured by direction.",
    placement: "volume",
    params: [],
    short: () => "Vol",
    compute: (bars, _p, _cfg, c) => [
      {
        key: "volume",
        label: "Vol",
        kind: "histogram",
        color: c.up,
        values: bars.map((b) => b.volume),
        colors: bars.map((b) => alpha(toHex(b.close >= b.open ? c.up : c.down), 0.45)),
      },
    ],
  },
  rsi: {
    type: "rsi",
    name: "Relative Strength Index",
    description: "Momentum oscillator from 0 to 100; 70+ overbought, 30− oversold.",
    placement: "pane",
    params: [{ label: "Length", default: 14, min: 2, max: 100 }],
    levels: [30, 70],
    short: ([n]) => `RSI ${n}`,
    usesSource: true,
    compute: (bars, [n], cfg) => [
      {
        key: "rsi",
        label: "RSI",
        kind: "line",
        color: "#1a9bff",
        values: rsi(closes(bars, cfg), n!),
      },
    ],
  },
  macd: {
    type: "macd",
    name: "MACD",
    description: "Difference of two EMAs with a signal line and histogram.",
    placement: "pane",
    params: [
      { label: "Fast", default: 12, min: 1, max: 100 },
      { label: "Slow", default: 26, min: 2, max: 200 },
      { label: "Signal", default: 9, min: 1, max: 50 },
    ],
    levels: [0],
    short: ([f, s, g]) => `MACD ${f} ${s} ${g}`,
    usesSource: true,
    compute: (bars, [f, s, g], cfg, c) => {
      const m = macd(closes(bars, cfg), f!, s!, g!);
      return [
        {
          key: "hist",
          label: "Hist",
          kind: "histogram",
          color: c.up,
          values: m.hist,
          colors: m.hist.map((v) => alpha(toHex((v ?? 0) >= 0 ? c.up : c.down), 0.6)),
        },
        { key: "macd", label: "MACD", kind: "line", color: "#3b82f6", values: m.line },
        { key: "signal", label: "Signal", kind: "line", color: "#f59e0b", values: m.signal },
      ];
    },
  },
  stoch: {
    type: "stoch",
    name: "Stochastic",
    description: "Where the close sits in the recent high–low range; 80+ / 20−.",
    placement: "pane",
    params: [
      { label: "%K length", default: 14, min: 1, max: 100 },
      { label: "%K smoothing", default: 3, min: 1, max: 20 },
      { label: "%D smoothing", default: 3, min: 1, max: 20 },
    ],
    levels: [20, 80],
    short: ([k, s, d]) => `Stoch ${k} ${s} ${d}`,
    compute: (bars, [k, s, d]) => {
      const st = stochastic(bars, k!, s!, d!);
      return [
        { key: "k", label: "%K", kind: "line", color: "#3b82f6", values: st.k },
        { key: "d", label: "%D", kind: "line", color: "#f59e0b", values: st.d },
      ];
    },
  },
};

export const defaultParams = (type: IndicatorType) => INDICATORS[type].params.map((p) => p.default);

export const levelsOf = (cfg: IndicatorConfig) => cfg.levels ?? INDICATORS[cfg.type].levels ?? [];

/** Computes an indicator and applies the user's style overrides (colours, widths, visibility). */
export function resolveOutputs(
  bars: Bar[],
  cfg: IndicatorConfig,
  theme: TaColors,
): IndicatorOutput[] {
  const colors = { up: cfg.upColor ?? theme.up, down: cfg.downColor ?? theme.down };
  return INDICATORS[cfg.type].compute(bars, cfg.params, cfg, colors).map((o) => {
    const st = cfg.styles?.[o.key];
    return {
      ...o,
      color: st?.color ?? o.color,
      width: st?.width ?? 1,
      dash: st?.dash ?? "solid",
      hidden: st?.hidden ?? false,
    };
  });
}
