/**
 * Technical indicators over OHLCV bars. Pure functions, so they are unit-tested
 * without a chart. Each returns one value per bar; `null` until the window fills.
 */

export type Bar = {
  /** Bar open time, UNIX seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Seeded with the SMA of the first `period` values, like TradingView's `ta.ema`. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** EMA over a series that starts with nulls (e.g. the MACD line). */
function emaOfSeries(values: Series, period: number): Series {
  const start = values.findIndex((v) => v != null);
  const out: Series = new Array(values.length).fill(null);
  if (start < 0) return out;
  const tail = ema(values.slice(start) as number[], period);
  tail.forEach((v, i) => (out[start + i] = v));
  return out;
}

export function bollinger(values: number[], period: number, mult: number) {
  const mid = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i]!;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (values[j]! - m) ** 2;
    const sd = Math.sqrt(v / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

/** Wilder's RSI. */
export function rsi(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  const value = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[period] = value();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = value();
  }
  return out;
}

export function macd(values: number[], fast: number, slow: number, signal: number) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line: Series = values.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null));
  const sig = emaOfSeries(line, signal);
  const hist: Series = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null));
  return { line, signal: sig, hist };
}

/** Slow stochastic: %K smoothed by `smooth`, %D = SMA(%K, d). */
export function stochastic(bars: Bar[], period: number, smooth: number, d: number) {
  const raw: Series = bars.map((_, i) => {
    if (i < period - 1) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, bars[j]!.high);
      lo = Math.min(lo, bars[j]!.low);
    }
    return hi === lo ? 50 : ((bars[i]!.close - lo) / (hi - lo)) * 100;
  });
  const k = smoothSeries(raw, smooth);
  return { k, d: smoothSeries(k, d) };
}

function smoothSeries(values: Series, period: number): Series {
  const start = values.findIndex((v) => v != null);
  const out: Series = new Array(values.length).fill(null);
  if (start < 0) return out;
  sma(values.slice(start) as number[], period).forEach((v, i) => (out[start + i] = v));
  return out;
}

/** Volume-weighted average price, reset at every UTC day (the usual session anchor for crypto). */
export function vwap(bars: Bar[]): Series {
  let day = -1;
  let pv = 0;
  let vol = 0;
  return bars.map((b) => {
    const d = Math.floor(b.time / 86_400);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const typical = (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vol += b.volume;
    return vol ? pv / vol : typical;
  });
}

/** Heikin Ashi candles (smoothed trend view). */
export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const close = (b.open + b.high + b.low + b.close) / 4;
    const prev = out[out.length - 1];
    const open = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
    out.push({
      time: b.time,
      open,
      close,
      high: Math.max(b.high, open, close),
      low: Math.min(b.low, open, close),
      volume: b.volume,
    });
  }
  return out;
}
