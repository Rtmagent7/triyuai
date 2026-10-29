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

export type IndicatorType = "sma" | "ema" | "bb" | "vwap" | "volume" | "rsi" | "macd" | "stoch";

export type IndicatorConfig = {
  id: string;
  type: IndicatorType;
  params: number[];
  /** Line colour for single-line overlays (SMA, EMA, VWAP). */
  color?: string;
  hidden?: boolean;
};

export type IndicatorOutput = {
  key: string;
  label: string;
  kind: "line" | "histogram";
  color: string;
  values: Series;
  /** Per-bar colours for histograms (volume, MACD). */
  colors?: string[];
};

type Param = { label: string; default: number; min: number; max: number; step?: number };

export type IndicatorDef = {
  type: IndicatorType;
  name: string;
  description: string;
  /** main: drawn over price; volume: bottom of the price pane; pane: its own pane below. */
  placement: "main" | "volume" | "pane";
  params: Param[];
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

export const OVERLAY_PALETTE = ["#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#a855f7", "#84cc16"];

const closes = (bars: Bar[]) => bars.map((b) => b.close);
const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const toHex = (c: string) => (c.startsWith("#") && c.length === 7 ? c : "#888888");

export const INDICATORS: Record<IndicatorType, IndicatorDef> = {
  sma: {
    type: "sma",
    name: "Moving Average (SMA)",
    description: "Average close over N bars.",
    placement: "main",
    params: [{ label: "Length", default: 20, min: 1, max: 500 }],
    short: ([n]) => `SMA ${n}`,
    compute: (bars, [n], cfg) => [
      {
        key: "sma",
        label: `SMA ${n}`,
        kind: "line",
        color: cfg.color ?? OVERLAY_PALETTE[0]!,
        values: sma(closes(bars), n!),
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
    compute: (bars, [n], cfg) => [
      {
        key: "ema",
        label: `EMA ${n}`,
        kind: "line",
        color: cfg.color ?? OVERLAY_PALETTE[1]!,
        values: ema(closes(bars), n!),
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
    compute: (bars, [n, m]) => {
      const b = bollinger(closes(bars), n!, m!);
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
    compute: (bars, [n]) => [
      { key: "rsi", label: "RSI", kind: "line", color: "#a855f7", values: rsi(closes(bars), n!) },
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
    compute: (bars, [f, s, g], _cfg, c) => {
      const m = macd(closes(bars), f!, s!, g!);
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
