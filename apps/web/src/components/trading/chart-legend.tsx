"use client";

import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { useState } from "react";
import { formatCompactNumber } from "@/lib/format";
import type { Bar } from "@/lib/ta/indicators";
import { INDICATORS, type IndicatorConfig, type IndicatorOutput } from "@/lib/ta/registry";
import { cn } from "@/lib/utils";
import { useChartLayout } from "@/stores/chart-layout";
import { IndicatorSettings } from "./indicator-settings";

type Props = {
  title: string;
  bars: Bar[];
  index: number | null;
  computed: Map<string, IndicatorOutput[]>;
  formatPrice: (p: number) => string;
  editable: boolean;
};

const iconBtn =
  "text-muted hover:text-text hover:bg-surface-2 pointer-events-auto flex size-6 items-center justify-center rounded [&_svg]:size-3.5";

/** OHLC and indicator values for the bar under the crosshair (or the latest bar). */
export function ChartLegend({ title, bars, index, computed, formatPrice, editable }: Props) {
  const indicators = useChartLayout((s) => s.indicators);
  const update = useChartLayout((s) => s.updateIndicator);
  const remove = useChartLayout((s) => s.removeIndicator);
  const i = index ?? bars.length - 1;
  const bar = bars[i];
  const prev = bars[i - 1];
  if (!bar) return null;
  const change = prev ? ((bar.close - prev.close) / prev.close) * 100 : 0;
  const tone = bar.close >= bar.open ? "text-up" : "text-down";

  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-5rem)] space-y-0.5 text-[13px]">
      <p className="tabular flex flex-wrap items-baseline gap-x-2" data-testid="ohlc-legend">
        <span className="text-text font-semibold">{title}</span>
        <span className="text-muted">
          O <span className={tone}>{formatPrice(bar.open)}</span>
        </span>
        <span className="text-muted">
          H <span className={tone}>{formatPrice(bar.high)}</span>
        </span>
        <span className="text-muted">
          L <span className={tone}>{formatPrice(bar.low)}</span>
        </span>
        <span className="text-muted">
          C <span className={tone}>{formatPrice(bar.close)}</span>
        </span>
        <span className={tone}>
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </p>
      {indicators.map((cfg) => (
        <IndicatorRow
          key={cfg.id}
          cfg={cfg}
          outputs={computed.get(cfg.id)}
          index={i}
          formatPrice={formatPrice}
          editable={editable}
          onToggle={() => update(cfg.id, { hidden: !cfg.hidden })}
          onRemove={() => remove(cfg.id)}
        />
      ))}
    </div>
  );
}

function IndicatorRow({
  cfg,
  outputs,
  index,
  formatPrice,
  editable,
  onToggle,
  onRemove,
}: {
  cfg: IndicatorConfig;
  outputs?: IndicatorOutput[];
  index: number;
  formatPrice: (p: number) => string;
  editable: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const def = INDICATORS[cfg.type];
  const [settings, setSettings] = useState(false);
  const label = def.short(cfg.params);
  const fmt = (v: number) =>
    def.placement === "main"
      ? formatPrice(v)
      : def.placement === "volume"
        ? formatCompactNumber(v)
        : v.toFixed(2);

  return (
    <div className={cn("group flex items-center gap-1.5", cfg.hidden && "opacity-50")}>
      {editable ? (
        <button
          type="button"
          onDoubleClick={() => setSettings(true)}
          title="Double-click for settings"
          className="text-muted hover:text-text pointer-events-auto min-h-6"
        >
          {label}
        </button>
      ) : (
        <span className="text-muted">{label}</span>
      )}
      {!cfg.hidden &&
        outputs
          ?.filter((o) => !o.hidden)
          .map((o) => {
            const v = o.values[index];
            return (
              <span
                key={o.key}
                className="tabular"
                style={{ color: o.kind === "line" ? o.color : undefined }}
              >
                {v == null ? "–" : fmt(v)}
              </span>
            );
          })}
      {editable && (
        <span className="flex items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            className={iconBtn}
            onClick={onToggle}
            aria-label={`${cfg.hidden ? "Show" : "Hide"} ${label}`}
          >
            {cfg.hidden ? <EyeOff /> : <Eye />}
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={() => setSettings(true)}
            aria-label={`Settings for ${label}`}
          >
            <Settings2 />
          </button>
          <button
            type="button"
            className={iconBtn}
            onClick={onRemove}
            aria-label={`Remove ${label}`}
          >
            <X />
          </button>
        </span>
      )}
      {settings && <IndicatorSettings cfg={cfg} onClose={() => setSettings(false)} />}
    </div>
  );
}
