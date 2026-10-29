"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  INDICATORS,
  SOURCES,
  defaultParams,
  levelsOf,
  resolveOutputs,
  sourceLabel,
  type IndicatorConfig,
  type PlotStyle,
  type Source,
} from "@/lib/ta/registry";
import { useChartLayout } from "@/stores/chart-layout";
import { ColorPicker } from "./color-picker";
import { LineStylePicker } from "./line-style-picker";
import { Checkbox, Row, SettingsDialog, inputCls } from "./settings-dialog";

const css = (name: string) =>
  typeof document === "undefined"
    ? "#888888"
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888888";

/** Inputs (lengths, source), per-line style, histogram colours and levels for one indicator. */
export function IndicatorSettings({ cfg, onClose }: { cfg: IndicatorConfig; onClose: () => void }) {
  const update = useChartLayout((s) => s.updateIndicator);
  const def = INDICATORS[cfg.type];
  const snapshot = useRef(cfg);
  useEffect(() => {
    snapshot.current = cfg;
    // Only the state at open time matters for Cancel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.id]);

  // Number inputs are uncontrolled while typing; bumping this remounts them after a reset.
  const [version, setVersion] = useState(0);
  const set = (patch: Partial<IndicatorConfig>) => update(cfg.id, patch);
  const setStyle = (key: string, patch: PlotStyle) =>
    set({ styles: { ...cfg.styles, [key]: { ...cfg.styles?.[key], ...patch } } });

  const theme = { up: css("--up"), down: css("--down") };
  // Metadata only (keys, labels, default colours): computing on no bars is free.
  const outputs = resolveOutputs([], cfg, theme);
  const levels = levelsOf(cfg);
  const hasLevels = def.placement === "pane";

  const inputs = (
    <>
      {def.params.map((p, n) => (
        <Row key={`${version}-${p.label}`} label={p.label} htmlFor={`${cfg.id}-p${n}`}>
          <input
            id={`${cfg.id}-p${n}`}
            type="number"
            min={p.min}
            max={p.max}
            step={p.step ?? 1}
            defaultValue={cfg.params[n]}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v) || v < p.min || v > p.max) return;
              set({ params: cfg.params.map((x, k) => (k === n ? v : x)) });
            }}
            className={`${inputCls} w-24 text-right`}
          />
        </Row>
      ))}
      {def.usesSource && (
        <Row label="Source" htmlFor={`${cfg.id}-src`}>
          <select
            id={`${cfg.id}-src`}
            value={cfg.source ?? "close"}
            onChange={(e) => set({ source: e.target.value as Source })}
            className={`${inputCls} w-40`}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {sourceLabel[s]}
              </option>
            ))}
          </select>
        </Row>
      )}
      {def.params.length === 0 && !def.usesSource && (
        <p className="text-muted text-sm">{def.name} has no inputs.</p>
      )}
    </>
  );

  const style = (
    <>
      {outputs.map((o) =>
        o.kind === "line" ? (
          <Row
            key={o.key}
            label={
              <Checkbox
                label={o.label}
                checked={!o.hidden}
                onChange={(v) => setStyle(o.key, { hidden: !v })}
              />
            }
          >
            <ColorPicker
              label={`${o.label} colour`}
              value={o.color}
              onChange={(color) => setStyle(o.key, { color })}
            />
            <LineStylePicker
              label={`${o.label} line`}
              width={o.width ?? 1}
              dash={o.dash ?? "solid"}
              onChange={(patch) => setStyle(o.key, patch)}
            />
          </Row>
        ) : (
          <div key={o.key} className="space-y-1">
            <Checkbox
              label={o.label === "Vol" ? "Volume bars" : `${o.label} bars`}
              checked={!o.hidden}
              onChange={(v) => setStyle(o.key, { hidden: !v })}
            />
            <Row label="Rising">
              <ColorPicker
                label="Rising colour"
                value={cfg.upColor ?? theme.up}
                onChange={(upColor) => set({ upColor })}
              />
            </Row>
            <Row label="Falling">
              <ColorPicker
                label="Falling colour"
                value={cfg.downColor ?? theme.down}
                onChange={(downColor) => set({ downColor })}
              />
            </Row>
          </div>
        ),
      )}

      {hasLevels && (
        <div className="border-border space-y-2 border-t pt-3">
          <Row label="Levels">
            <ColorPicker
              label="Level colour"
              value={cfg.levelColor ?? css("--muted")}
              onChange={(levelColor) => set({ levelColor })}
            />
          </Row>
          {levels.map((lv, i) => (
            <div key={`${version}-${i}-${levels.length}`} className="flex items-center gap-2">
              <input
                aria-label={`Level ${i + 1}`}
                type="number"
                step="any"
                defaultValue={lv}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (e.target.value === "" || !Number.isFinite(v)) return;
                  set({ levels: levels.map((x, k) => (k === i ? v : x)) });
                }}
                className={`${inputCls} w-28 text-right`}
              />
              <button
                type="button"
                aria-label={`Remove level ${lv}`}
                onClick={() => set({ levels: levels.filter((_, k) => k !== i) })}
                className="text-muted hover:text-text hover:bg-surface-2 rounded-md p-1.5"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ levels: [...levels, levels.at(-1) ?? 50] })}
            className="text-brand inline-flex items-center gap-1 text-sm font-medium"
          >
            <Plus className="size-4" /> Add level
          </button>
        </div>
      )}
    </>
  );

  return (
    <SettingsDialog
      open
      title={`${def.name} · ${def.short(cfg.params)}`}
      tabs={[
        ...(def.params.length || def.usesSource
          ? [{ id: "inputs", label: "Inputs", content: inputs }]
          : []),
        { id: "style", label: "Style", content: style },
      ]}
      onClose={onClose}
      onCancel={() => update(cfg.id, snapshot.current)}
      onDefaults={() => {
        setVersion((v) => v + 1);
        set({
          params: defaultParams(cfg.type),
          source: undefined,
          styles: undefined,
          upColor: undefined,
          downColor: undefined,
          levels: undefined,
          levelColor: undefined,
        });
      }}
    />
  );
}
