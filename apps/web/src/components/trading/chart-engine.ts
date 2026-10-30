import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { fibTimeLogicals, type Anchor, type Pt } from "@/lib/ta/drawings";
import { heikinAshi, type Bar } from "@/lib/ta/indicators";
import type { LineDash } from "@/lib/ta/colors";
import {
  INDICATORS,
  levelsOf,
  resolveOutputs,
  type IndicatorConfig,
  type IndicatorOutput,
} from "@/lib/ta/registry";
import { logicalToTime, timeToLogical } from "@/lib/ta/time-index";
import type { ChartStyle, ScaleMode } from "@/stores/chart-layout";
import { DrawingsPrimitive, withAlpha, type DrawingsState } from "./drawings-primitive";

export type ChartColors = {
  text: string;
  muted: string;
  border: string;
  background: string;
  brand: string;
  up: string;
  down: string;
};

type IndicatorSeries = { id: string; outputs: { key: string; series: ISeriesApi<SeriesType> }[] };

const t = (s: number) => s as UTCTimestamp;

const LINE_STYLE: Record<LineDash, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
};

/** Decimal places that keep ~5 significant digits (BTC → 2, PEPE → 9). */
export function pricePrecision(price: number) {
  if (!Number.isFinite(price) || price <= 0) return 2;
  if (price >= 1000) return 2;
  if (price >= 1) return Math.max(2, 4 - Math.floor(Math.log10(price)));
  return Math.min(10, Math.ceil(-Math.log10(price)) + 4);
}

/**
 * Imperative wrapper around Lightweight Charts: the price series, indicator panes,
 * drawing layer and time/price ↔ pixel conversion. React components drive it.
 */
export class ChartEngine {
  readonly chart: IChartApi;
  private main!: ISeriesApi<"Candlestick" | "Bar" | "Line" | "Area">;
  private primitive: DrawingsPrimitive;
  private indicatorSeries: IndicatorSeries[] = [];
  bars: Bar[] = [];
  /** Indicator values per config id, index-aligned with `bars` (for the legend). */
  computed = new Map<string, IndicatorOutput[]>();
  step = 3600;
  private style: ChartStyle = "candles";
  private indicators: IndicatorConfig[] = [];

  constructor(
    el: HTMLElement,
    private colors: ChartColors,
    getDrawings: () => Omit<
      DrawingsState,
      "toScreen" | "timeZoneXs" | "background" | "step" | "up" | "down"
    >,
  ) {
    this.chart = createChart(el, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 8 },
      handleScroll: { vertTouchDrag: false },
    });
    this.primitive = new DrawingsPrimitive(() => ({
      ...getDrawings(),
      toScreen: (a) => this.toScreen(a),
      timeZoneXs: (a, b, v) => this.timeZoneXs(a, b, v),
      background: this.colors.background,
      step: this.step,
      up: this.colors.up,
      down: this.colors.down,
    }));
    this.applyTheme(colors);
    this.createMain();
  }

  destroy() {
    this.chart.remove();
  }

  applyTheme(colors: ChartColors) {
    this.colors = colors;
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.muted,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        attributionLogo: false,
        panes: { separatorColor: colors.border, separatorHoverColor: withAlpha(colors.brand, 0.3) },
      },
      grid: {
        vertLines: { color: withAlpha(colors.border, 0.5) },
        horzLines: { color: withAlpha(colors.border, 0.5) },
      },
    });
  }

  private createMain() {
    if (this.main) {
      this.main.detachPrimitive(this.primitive);
      this.chart.removeSeries(this.main);
    }
    const { up, down, brand } = this.colors;
    const common = { priceLineVisible: true, lastValueVisible: true } as const;
    switch (this.style) {
      case "bars":
        this.main = this.chart.addSeries(BarSeries, {
          ...common,
          upColor: up,
          downColor: down,
          thinBars: false,
        });
        break;
      case "line":
        this.main = this.chart.addSeries(LineSeries, { ...common, color: brand, lineWidth: 2 });
        break;
      case "area":
        this.main = this.chart.addSeries(AreaSeries, {
          ...common,
          lineColor: brand,
          topColor: withAlpha(brand, 0.35),
          bottomColor: withAlpha(brand, 0),
          lineWidth: 2,
        });
        break;
      default:
        this.main = this.chart.addSeries(CandlestickSeries, {
          ...common,
          upColor: up,
          downColor: down,
          wickUpColor: up,
          wickDownColor: down,
          borderVisible: false,
        });
    }
    this.main.attachPrimitive(this.primitive);
  }

  private mainPoint(b: Bar) {
    return this.style === "line" || this.style === "area"
      ? { time: t(b.time), value: b.close }
      : { time: t(b.time), open: b.open, high: b.high, low: b.low, close: b.close };
  }

  private mainBars() {
    return this.style === "heikin" ? heikinAshi(this.bars) : this.bars;
  }

  setStyle(style: ChartStyle) {
    this.style = style;
    this.createMain();
    this.setMainData();
  }

  setScale(mode: ScaleMode) {
    this.chart.priceScale("right").applyOptions({
      mode:
        mode === "log"
          ? PriceScaleMode.Logarithmic
          : mode === "percent"
            ? PriceScaleMode.Percentage
            : PriceScaleMode.Normal,
    });
  }

  private setMainData() {
    const last = this.bars[this.bars.length - 1];
    const precision = pricePrecision(last?.close ?? 1);
    this.main.applyOptions({
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
    this.main.setData(this.mainBars().map((b) => this.mainPoint(b)));
  }

  /** Replaces all bars. `shift` keeps the view still after older bars were prepended. */
  setBars(bars: Bar[], step: number, opts: { shift?: number; reset?: boolean } = {}) {
    const range = this.chart.timeScale().getVisibleLogicalRange();
    this.bars = bars;
    this.step = step;
    this.setMainData();
    this.renderIndicators();
    if (opts.reset) {
      const n = bars.length;
      // ~8 px per candle: about 50 bars on a phone, up to 150 on desktop.
      const visible = Math.max(40, Math.min(150, Math.round(this.chart.timeScale().width() / 8)));
      this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - visible), to: n + 5 });
    } else if (opts.shift && range) {
      this.chart
        .timeScale()
        .setVisibleLogicalRange({ from: range.from + opts.shift, to: range.to + opts.shift });
    }
  }

  /** Applies a live update to the forming (or a newly opened) bar without a full redraw. */
  updateLast() {
    const all = this.mainBars();
    const last = all[all.length - 1];
    if (!last) return;
    this.main.update(this.mainPoint(last));
    this.computeIndicators();
    const i = this.bars.length - 1;
    for (const s of this.indicatorSeries) {
      const outputs = this.computed.get(s.id) ?? [];
      for (const { key, series } of s.outputs) {
        const o = outputs.find((x) => x.key === key);
        const v = o?.values[i];
        if (o && v != null) series.update(this.point(o, i, v));
      }
    }
  }

  setIndicators(list: IndicatorConfig[]) {
    this.indicators = list;
    this.renderIndicators();
  }

  private computeIndicators() {
    this.computed.clear();
    for (const cfg of this.indicators) {
      this.computed.set(
        cfg.id,
        resolveOutputs(this.bars, cfg, { up: this.colors.up, down: this.colors.down }),
      );
    }
  }

  private point(o: IndicatorOutput, i: number, v: number) {
    const time = t(this.bars[i]!.time);
    return o.kind === "histogram" ? { time, value: v, color: o.colors?.[i] } : { time, value: v };
  }

  /** Rebuilds indicator series and panes from scratch (cheap; only on config or data reloads). */
  private renderIndicators() {
    for (const s of this.indicatorSeries)
      for (const o of s.outputs) this.chart.removeSeries(o.series);
    this.indicatorSeries = [];
    for (let i = this.chart.panes().length - 1; i > 0; i--) this.chart.removePane(i);
    this.computeIndicators();

    let pane = 1;
    for (const cfg of this.indicators) {
      const def = INDICATORS[cfg.type];
      const outputs = (this.computed.get(cfg.id) ?? []).filter((o) => !o.hidden);
      if (cfg.hidden || !outputs.length) continue;
      const paneIndex = def.placement === "pane" ? pane++ : 0;
      const entry: IndicatorSeries = { id: cfg.id, outputs: [] };
      outputs.forEach((o, n) => {
        const base = {
          priceLineVisible: false,
          lastValueVisible: def.placement === "pane",
          crosshairMarkerVisible: false,
        };
        const series =
          o.kind === "histogram"
            ? this.chart.addSeries(
                HistogramSeries,
                {
                  ...base,
                  color: o.color,
                  ...(def.placement === "volume"
                    ? { priceScaleId: "volume", priceFormat: { type: "volume" } }
                    : {}),
                },
                paneIndex,
              )
            : this.chart.addSeries(
                LineSeries,
                {
                  ...base,
                  color: o.color,
                  lineWidth: (o.width ?? 1) as 1 | 2 | 3 | 4,
                  lineStyle: LINE_STYLE[o.dash ?? "solid"],
                },
                paneIndex,
              );
        series.setData(o.values.flatMap((v, i) => (v == null ? [] : [this.point(o, i, v)])));
        if (n === outputs.length - 1)
          levelsOf(cfg).forEach((price) =>
            series.createPriceLine({
              price,
              color: cfg.levelColor ?? this.colors.muted,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              axisLabelVisible: false,
            }),
          );
        entry.outputs.push({ key: o.key, series });
      });
      if (def.placement === "volume") {
        this.chart.priceScale("volume", 0).applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      }
      this.indicatorSeries.push(entry);
    }
    // Price pane gets three shares of the height, every indicator pane one.
    this.chart.panes().forEach((p, i) => p.setStretchFactor(i === 0 ? 3 : 1));
  }

  /* ---------- coordinates ---------- */

  private times() {
    return this.bars.map((b) => b.time);
  }

  /** Price pane bounds in CSS pixels (drawings only live there). */
  mainPane() {
    return {
      width: this.chart.timeScale().width(),
      height: this.chart.panes()[0]?.getHeight() ?? 0,
    };
  }

  toScreen(a: Anchor): Pt | null {
    const x = this.chart
      .timeScale()
      .logicalToCoordinate(timeToLogical(this.times(), a.time, this.step) as Logical);
    const y = this.main.priceToCoordinate(a.price);
    return x == null || y == null ? null : { x, y };
  }

  /** Screen x of each Fibonacci time zone between two anchors (null when off-screen). */
  timeZoneXs(a: Anchor, b: Anchor, values: number[]): (number | null)[] {
    const times = this.times();
    const ts = this.chart.timeScale();
    return fibTimeLogicals(
      timeToLogical(times, a.time, this.step),
      timeToLogical(times, b.time, this.step),
      values,
    ).map((l) => ts.logicalToCoordinate(l as Logical));
  }

  /** Pixel → anchor. With `magnet`, snaps to the nearest O/H/L/C of the bar under the pointer. */
  toAnchor(p: Pt, magnet = false): Anchor | null {
    const logical = this.chart.timeScale().coordinateToLogical(p.x);
    const price = this.main.coordinateToPrice(p.y);
    if (logical == null || price == null) return null;
    const times = this.times();
    if (magnet) {
      const bar = this.mainBars()[Math.round(logical)];
      if (bar) {
        const best = [bar.open, bar.high, bar.low, bar.close]
          .map((v) => ({ v, d: Math.abs((this.main.priceToCoordinate(v) ?? Infinity) - p.y) }))
          .sort((a, b) => a.d - b.d)[0]!;
        if (best.d < 40) return { time: bar.time, price: best.v };
      }
    }
    return { time: logicalToTime(times, logical, this.step), price };
  }

  /** Bar index under a logical position, clamped to the data. */
  indexAt(logical: number) {
    return Math.max(0, Math.min(this.bars.length - 1, Math.round(logical)));
  }

  redrawDrawings() {
    this.primitive.update();
  }

  screenshot() {
    return this.chart.takeScreenshot(true, false);
  }

  /** Disables panning/zooming while a drawing is placed or dragged. */
  setInteractive(on: boolean) {
    // Options merge, so every flag is spelled out: `false` earlier sets them all off.
    this.chart.applyOptions({
      handleScroll: {
        mouseWheel: on,
        pressedMouseMove: on,
        horzTouchDrag: on,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: on,
        pinch: on,
        axisPressedMouseMove: on,
        axisDoubleClickReset: on,
      },
    });
  }
}

export type { Time };
