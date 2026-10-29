"use client";

import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { Popover } from "radix-ui";
import { formatCompactNumber } from "@/lib/format";
import type { Bar } from "@/lib/ta/indicators";
import { INDICATORS, type IndicatorConfig, type IndicatorOutput } from "@/lib/ta/registry";
import { cn } from "@/lib/utils";
import { useChartLayout } from "@/stores/chart-layout";

type Props = {
  title: string;
  bars: Bar[];
  index: number | null;
  computed: Map<string, IndicatorOutput[]>;
  formatPrice: (p: number) => string;
  editable: boolean;
};

const iconBtn =
  "text-muted hover:text-text hover:bg-surface-2 pointer-events-auto rounded p-0.5 [&_svg]:size-3.5";

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
    <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-5rem)] space-y-0.5 text-xs">
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
          onParams={(params) => update(cfg.id, { params })}
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
  onParams,
}: {
  cfg: IndicatorConfig;
  outputs?: IndicatorOutput[];
  index: number;
  formatPrice: (p: number) => string;
  editable: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onParams: (p: number[]) => void;
}) {
  const def = INDICATORS[cfg.type];
  const label = def.short(cfg.params);
  const fmt = (v: number) =>
    def.placement === "main"
      ? formatPrice(v)
      : def.placement === "volume"
        ? formatCompactNumber(v)
        : v.toFixed(2);

  return (
    <div className={cn("group flex items-center gap-1.5", cfg.hidden && "opacity-50")}>
      <span className="text-muted">{label}</span>
      {!cfg.hidden &&
        outputs?.map((o) => {
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
          {def.params.length > 0 && <ParamsPopover cfg={cfg} label={label} onParams={onParams} />}
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
    </div>
  );
}

function ParamsPopover({
  cfg,
  label,
  onParams,
}: {
  cfg: IndicatorConfig;
  label: string;
  onParams: (p: number[]) => void;
}) {
  const def = INDICATORS[cfg.type];
  return (
    <Popover.Root>
      <Popover.Trigger className={iconBtn} aria-label={`Settings for ${label}`}>
        <Settings2 />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="border-border bg-bg z-50 w-56 space-y-3 rounded-xl border p-3 text-sm shadow-xl"
        >
          <p className="font-medium">{def.name}</p>
          {def.params.map((p, n) => (
            <label key={p.label} className="flex items-center justify-between gap-3">
              <span className="text-muted text-xs">{p.label}</span>
              <input
                type="number"
                min={p.min}
                max={p.max}
                step={p.step ?? 1}
                defaultValue={cfg.params[n]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v < p.min || v > p.max) return;
                  onParams(cfg.params.map((x, k) => (k === n ? v : x)));
                }}
                className="border-border bg-surface h-8 w-20 rounded-md border px-2 text-right tabular-nums"
              />
            </label>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
