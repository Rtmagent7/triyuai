"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  canExtend,
  drawingDefaults,
  fibLevels,
  hasChangeLabel,
  hasFill,
  hasLevels,
  hasLine,
  hasText,
  toolLabel,
  type Drawing,
} from "@/lib/ta/drawings";
import { useChartLayout } from "@/stores/chart-layout";
import { ColorPicker } from "./color-picker";
import { LineStylePicker } from "./line-style-picker";
import { Checkbox, Row, SettingsDialog, inputCls, type SettingsTab } from "./settings-dialog";

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28];

/** UNIX seconds ↔ value of an <input type="datetime-local"> in UTC. */
const toLocalInput = (t: number) => new Date(t * 1000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => Math.floor(Date.parse(`${v}:00Z`) / 1000);

type Props = { coinId: string; drawing: Drawing; onClose: () => void };

/** Per-type options for one drawing: style, text, Fibonacci levels and exact coordinates. */
export function DrawingSettings({ coinId, drawing: d, onClose }: Props) {
  const update = useChartLayout((s) => s.updateDrawing);
  const style = useChartLayout((s) => s.drawingStyle);
  const snapshot = useRef(d);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    snapshot.current = d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.id]);

  const set = (patch: Partial<Drawing>) => update(coinId, { ...d, ...patch });
  const t = d.type;
  const isPosition = t === "long" || t === "short";
  // Which label option this type has, and whether it is on by default.
  const label =
    t === "hline" || t === "hray"
      ? { text: "Price label", on: d.showLabel !== false }
      : hasLevels(t)
        ? { text: "Level prices", on: d.showLabel !== false }
        : hasChangeLabel(t)
          ? { text: "Price change, % and bars", on: !!d.showLabel }
          : null;

  const styleTab = (
    <>
      {!hasLine(t) && !isPosition && !hasText(t) && (
        <Row label="Colour">
          <ColorPicker label="Colour" value={d.color} onChange={(color) => set({ color })} />
        </Row>
      )}
      {isPosition && (
        <p className="text-muted text-sm">
          Drag the target and stop handles on the chart; the risk:reward ratio updates live.
        </p>
      )}
      {hasLine(t) && (
        <Row label={hasLevels(t) ? "Trend line" : "Line"}>
          <ColorPicker label="Line colour" value={d.color} onChange={(color) => set({ color })} />
          <LineStylePicker
            label="Line style"
            width={d.width ?? 2}
            dash={d.dash ?? "solid"}
            onChange={(patch) => set(patch)}
          />
        </Row>
      )}
      {hasFill(t) && (
        <Row label="Background">
          <ColorPicker
            label="Background colour"
            value={d.fill ?? d.color}
            onChange={(fill) => set({ fill })}
            opacity={d.fillOpacity ?? 0.12}
            onOpacity={(fillOpacity) => set({ fillOpacity })}
          />
        </Row>
      )}
      {canExtend(t) && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 py-1">
          <Checkbox
            label="Extend left"
            checked={!!d.extendLeft}
            onChange={(v) => set({ extendLeft: v })}
          />
          <Checkbox
            label="Extend right"
            checked={!!d.extendRight}
            onChange={(v) => set({ extendRight: v })}
          />
        </div>
      )}
      {label && (
        <Checkbox label={label.text} checked={label.on} onChange={(v) => set({ showLabel: v })} />
      )}
      <Checkbox label="Lock in place" checked={!!d.locked} onChange={(v) => set({ locked: v })} />
    </>
  );

  const textTab = (
    <>
      <textarea
        aria-label="Text"
        defaultValue={d.text}
        key={version}
        maxLength={200}
        rows={3}
        onChange={(e) => set({ text: e.target.value })}
        className={`${inputCls} h-auto w-full resize-none py-2`}
      />
      <Row label="Colour">
        <ColorPicker
          label="Text background colour"
          value={d.color}
          onChange={(color) => set({ color })}
        />
      </Row>
      <Row label="Font size" htmlFor="font-size">
        <select
          id="font-size"
          value={d.fontSize ?? 13}
          onChange={(e) => set({ fontSize: Number(e.target.value) })}
          className={`${inputCls} w-24`}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
      </Row>
      <Checkbox
        label="Filled background"
        checked={d.fill !== "none"}
        onChange={(v) => set({ fill: v ? undefined : "none" })}
      />
    </>
  );

  const levels = fibLevels(d);
  const setLevels = (next: typeof levels) => set({ levels: next });
  const levelsTab = (
    <>
      {levels.map((lv, i) => (
        <div key={`${version}-${i}-${levels.length}`} className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label={`Show level ${lv.value}`}
            checked={lv.visible}
            onChange={(e) =>
              setLevels(levels.map((x, k) => (k === i ? { ...x, visible: e.target.checked } : x)))
            }
            className="accent-brand size-4"
          />
          <input
            aria-label={`Level ${i + 1} value`}
            type="number"
            step="any"
            defaultValue={lv.value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (e.target.value === "" || !Number.isFinite(v)) return;
              setLevels(levels.map((x, k) => (k === i ? { ...x, value: v } : x)));
            }}
            className={`${inputCls} w-24 text-right`}
          />
          <ColorPicker
            label={`Level ${lv.value} colour`}
            value={lv.color ?? d.color}
            onChange={(color) => setLevels(levels.map((x, k) => (k === i ? { ...x, color } : x)))}
          />
          <button
            type="button"
            aria-label={`Remove level ${lv.value}`}
            onClick={() => setLevels(levels.filter((_, k) => k !== i))}
            className="text-muted hover:text-text hover:bg-surface-2 ml-auto rounded-md p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLevels([...levels, { value: 1.618, visible: true }])}
        className="text-brand inline-flex items-center gap-1 text-sm font-medium"
      >
        <Plus className="size-4" /> Add level
      </button>
    </>
  );

  const coordsTab = (
    <>
      {d.points.map((p, i) => (
        <fieldset key={`${version}-${i}`} className="border-border space-y-2 rounded-lg border p-3">
          <legend className="text-muted px-1 text-xs">
            {d.points.length > 1 ? `Point ${i + 1}` : "Point"}
          </legend>
          <Row label="Price" htmlFor={`price-${i}`}>
            <input
              id={`price-${i}`}
              type="number"
              step="any"
              defaultValue={Number(p.price.toPrecision(8))}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value === "" || !Number.isFinite(v)) return;
                set({ points: d.points.map((x, k) => (k === i ? { ...x, price: v } : x)) });
              }}
              className={`${inputCls} w-40 text-right`}
            />
          </Row>
          {t !== "hline" && t !== "hray" && (
            <Row label="Time (UTC)" htmlFor={`time-${i}`}>
              <input
                id={`time-${i}`}
                type="datetime-local"
                defaultValue={toLocalInput(p.time)}
                onChange={(e) => {
                  const t = fromLocalInput(e.target.value);
                  if (!Number.isFinite(t)) return;
                  set({ points: d.points.map((x, k) => (k === i ? { ...x, time: t } : x)) });
                }}
                className={`${inputCls} w-48`}
              />
            </Row>
          )}
        </fieldset>
      ))}
    </>
  );

  const tabs: SettingsTab[] = [
    ...(hasText(t) ? [{ id: "text", label: "Text", content: textTab }] : []),
    ...(t !== "text" ? [{ id: "style", label: "Style", content: styleTab }] : []),
    ...(hasLevels(t) ? [{ id: "levels", label: "Levels", content: levelsTab }] : []),
    // A brush has hundreds of points; editing them one by one is not useful.
    ...(t !== "brush" ? [{ id: "coords", label: "Coordinates", content: coordsTab }] : []),
  ];

  return (
    <SettingsDialog
      open
      title={`${toolLabel(d.type)} settings`}
      tabs={tabs}
      onClose={onClose}
      onCancel={() => update(coinId, snapshot.current)}
      onDefaults={() => {
        setVersion((v) => v + 1);
        update(coinId, {
          id: d.id,
          type: d.type,
          points: d.points,
          text: d.text,
          color: style.color,
          width: style.width,
          dash: style.dash,
          ...drawingDefaults(d.type),
          levels: undefined,
        });
      }}
    />
  );
}
