"use client";

import {
  CandlestickChart,
  Camera,
  ChartArea,
  ChartLine,
  Expand,
  FlaskConical,
  Maximize2,
  Minimize2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { intervalLabel, intervals, type Interval } from "@/lib/ta/binance";
import { INDICATORS, type IndicatorType } from "@/lib/ta/registry";
import { cn } from "@/lib/utils";
import { useChartLayout, type ChartStyle, type ScaleMode } from "@/stores/chart-layout";

export const styleLabel: Record<ChartStyle, string> = {
  candles: "Candles",
  bars: "Bars",
  heikin: "Heikin Ashi",
  line: "Line",
  area: "Area",
};

const styleIcon: Record<ChartStyle, typeof ChartLine> = {
  candles: CandlestickChart,
  bars: CandlestickChart,
  heikin: CandlestickChart,
  line: ChartLine,
  area: ChartArea,
};

const COMPACT_INTERVALS: Interval[] = ["15m", "1h", "4h", "1d", "1w"];

const btn =
  "text-muted hover:bg-surface-2 hover:text-text inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors [&_svg]:size-4";

type Props = {
  variant: "full" | "compact";
  coinId: string;
  pair: string;
  fullscreen: boolean;
  onFullscreen: () => void;
  onScreenshot: () => void;
};

export function ChartToolbar({
  variant,
  coinId,
  pair,
  fullscreen,
  onFullscreen,
  onScreenshot,
}: Props) {
  const full = variant === "full";
  const interval = useChartLayout((s) => s.interval);
  const setInterval = useChartLayout((s) => s.setInterval);
  const style = useChartLayout((s) => s.style);
  const setStyle = useChartLayout((s) => s.setStyle);
  const scale = useChartLayout((s) => s.scale);
  const setScale = useChartLayout((s) => s.setScale);
  const addIndicator = useChartLayout((s) => s.addIndicator);
  const StyleIcon = styleIcon[style];
  const shown = full
    ? intervals
    : COMPACT_INTERVALS.includes(interval)
      ? COMPACT_INTERVALS
      : [...COMPACT_INTERVALS, interval];

  return (
    <div className="border-border flex h-[45px] shrink-0 items-center gap-1 overflow-x-auto border-b px-2 [scrollbar-width:none]">
      {full && <span className="whitespace-nowrap pr-2 text-sm font-semibold">{pair}</span>}

      <div role="radiogroup" aria-label="Timeframe" className="flex items-center">
        {shown.map((iv) => (
          <button
            key={iv}
            type="button"
            role="radio"
            aria-checked={interval === iv}
            onClick={() => setInterval(iv)}
            className={cn(btn, "px-1.5", interval === iv && "bg-surface-2 text-text")}
          >
            {intervalLabel[iv]}
          </button>
        ))}
      </div>

      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger className={btn} aria-label={`Chart style: ${styleLabel[style]}`}>
          <StyleIcon />
          <span className="hidden sm:inline">{styleLabel[style]}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Chart style</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={style} onValueChange={(v) => setStyle(v as ChartStyle)}>
            {(Object.keys(styleLabel) as ChartStyle[]).map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {styleLabel[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={btn}>
          <FlaskConical /> Indicators
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Add indicator</DropdownMenuLabel>
          {(Object.keys(INDICATORS) as IndicatorType[]).map((type) => (
            <DropdownMenuItem
              key={type}
              onSelect={() => addIndicator(type)}
              className="items-start"
            >
              <Plus className="mt-0.5" />
              <span>
                <span className="block font-medium">{INDICATORS[type].name}</span>
                <span className="text-muted block text-xs">{INDICATORS[type].description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      <div role="radiogroup" aria-label="Price scale" className="flex items-center">
        {(
          [
            ["log", "Log", "Logarithmic scale"],
            ["percent", "%", "Percentage scale"],
          ] as [ScaleMode, string, string][]
        ).map(([mode, label, title]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={scale === mode}
            title={title}
            onClick={() => setScale(scale === mode ? "normal" : mode)}
            className={cn(btn, scale === mode && "bg-surface-2 text-brand")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center">
        <button
          type="button"
          className={btn}
          onClick={onScreenshot}
          title="Download a PNG of the chart"
        >
          <Camera />
          <span className="sr-only">Screenshot</span>
        </button>
        {full ? (
          <button
            type="button"
            className={btn}
            onClick={onFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
            <span className="sr-only">{fullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
          </button>
        ) : (
          <Link href={`/chart/${coinId}`} className={cn(btn, "text-brand hover:text-brand")}>
            <Expand /> Full chart
          </Link>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="bg-border mx-1 h-5 w-px shrink-0" />;
}
