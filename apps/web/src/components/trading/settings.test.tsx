import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PALETTE, dashPattern, mix, normalizeHex, withAlpha } from "@/lib/ta/colors";
import {
  FIB_DEFAULT_LEVELS,
  changeLabel,
  drawingDefaults,
  extendLine,
  hitTest,
  moveDrawing,
  type Drawing,
} from "@/lib/ta/drawings";
import type { Bar } from "@/lib/ta/indicators";
import { levelsOf, resolveOutputs, sourceValues } from "@/lib/ta/registry";
import { useChartLayout } from "@/stores/chart-layout";
import { ColorPicker } from "./color-picker";
import { DrawingSettings } from "./drawing-settings";
import { IndicatorSettings } from "./indicator-settings";
import { SelectionToolbar } from "./selection-toolbar";

const initial = useChartLayout.getState();
beforeEach(() => useChartLayout.setState({ ...initial, drawings: {}, recentColors: [] }));

const bars: Bar[] = [
  { time: 0, open: 10, high: 14, low: 8, close: 12, volume: 5 },
  { time: 60, open: 12, high: 13, low: 9, close: 10, volume: 7 },
];

describe("colour helpers", () => {
  it("builds a 10 × 8 palette and normalises hex input", () => {
    expect(PALETTE).toHaveLength(8);
    expect(PALETTE.every((row) => row.length === 10)).toBe(true);
    expect(new Set(PALETTE.flat()).size).toBe(80);
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(normalizeHex("#12ab9F")).toBe("#12ab9f");
    expect(normalizeHex("nope")).toBeNull();
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
    expect(withAlpha("red", 0.5)).toBe("red");
    expect(dashPattern("dashed", 2)).toEqual([8, 6]);
    expect(dashPattern("dotted", 2)).toEqual([2, 4]);
    expect(dashPattern("solid", 2)).toEqual([]);
  });
});

describe("indicator styling", () => {
  it("reads the chosen price source", () => {
    expect(sourceValues(bars, "hl2")).toEqual([11, 11]);
    expect(sourceValues(bars, "hlc3")).toEqual([34 / 3, 32 / 3]);
    expect(sourceValues(bars, "ohlc4")).toEqual([11, 11]);
    expect(sourceValues(bars, "open")).toEqual([10, 12]);
    expect(sourceValues(bars, "high")).toEqual([14, 13]);
    expect(sourceValues(bars, "low")).toEqual([8, 9]);
    expect(sourceValues(bars)).toEqual([12, 10]);
  });

  it("applies per-line styles, histogram colours and custom levels", () => {
    const cfg = {
      id: "m",
      type: "macd" as const,
      params: [1, 2, 1],
      styles: { macd: { color: "#ff0000", width: 3, dash: "dashed" as const, hidden: true } },
      upColor: "#00ff00",
      levels: [-1, 1],
    };
    const out = resolveOutputs(bars, cfg, { up: "#111111", down: "#222222" });
    const line = out.find((o) => o.key === "macd")!;
    expect(line).toMatchObject({ color: "#ff0000", width: 3, dash: "dashed", hidden: true });
    expect(out.find((o) => o.key === "signal")).toMatchObject({
      width: 1,
      dash: "solid",
      hidden: false,
    });
    expect(out.find((o) => o.key === "hist")!.colors!.at(-1)).toMatch(
      /rgba\((0, 255, 0|34, 34, 34)/,
    );
    expect(levelsOf(cfg)).toEqual([-1, 1]);
    expect(levelsOf({ id: "r", type: "rsi", params: [14] })).toEqual([30, 70]);
  });
});

describe("drawing geometry options", () => {
  const d = (patch: Partial<Drawing> = {}): Drawing => ({
    id: "d",
    type: "trendline",
    color: "#2962ff",
    points: [
      { time: 0, price: 100 },
      { time: 600, price: 110 },
    ],
    ...patch,
  });

  it("extends lines to the edges", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 20, y: 20 };
    expect(extendLine(a, b, 100)).toEqual([a, b]);
    expect(extendLine(a, b, 100, true, true)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(hitTest(d({ extendRight: true }), [a, b], { x: 80, y: 80 }, 100)).toEqual({
      part: "body",
    });
    expect(hitTest(d(), [a, b], { x: 80, y: 80 }, 100)).toBeNull();
  });

  it("labels change, honours locks and per-type defaults", () => {
    expect(changeLabel(d().points[0]!, d().points[1]!, 60, (n) => n.toFixed(1))).toBe(
      "+10.0 (+10.00%) · 10 bars",
    );
    expect(changeLabel(d().points[1]!, d().points[0]!, 60, (n) => n.toFixed(1))).toBe(
      "−10.0 (−9.09%) · -10 bars",
    );
    const locked = d({ locked: true });
    expect(
      moveDrawing(locked, { part: "body" }, { time: 0, price: 0 }, { time: 5, price: 5 }),
    ).toBe(locked);
    expect(drawingDefaults("rect")).toEqual({ fillOpacity: 0.15 });
    expect(drawingDefaults("hline")).toEqual({ showLabel: true });
    expect(drawingDefaults("text")).toEqual({ fontSize: 13 });
    expect(FIB_DEFAULT_LEVELS.filter((l) => l.visible)).toHaveLength(7);
  });
});

describe("ColorPicker", () => {
  it("picks palette, custom and recent colours, and opacity", async () => {
    const onChange = vi.fn();
    const onOpacity = vi.fn();
    render(
      <ColorPicker
        label="Line colour"
        value="#2962ff"
        onChange={onChange}
        opacity={0.5}
        onOpacity={onOpacity}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Line colour: #2962ff" }));
    expect(await screen.findByRole("radio", { name: "#2962ff" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("radio", { name: "#089981" }));
    expect(onChange).toHaveBeenLastCalledWith("#089981");

    const hex = screen.getByRole("textbox", { name: "Hex colour" });
    await userEvent.clear(hex);
    await userEvent.type(hex, "abc");
    expect(onChange).toHaveBeenLastCalledWith("#aabbcc");
    fireEvent.blur(hex);
    expect(useChartLayout.getState().recentColors).toEqual(["#aabbcc"]);

    fireEvent.change(screen.getByLabelText("Custom colour"), { target: { value: "#123456" } });
    expect(onChange).toHaveBeenLastCalledWith("#123456");
    expect(useChartLayout.getState().recentColors[0]).toBe("#123456");

    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    expect(onOpacity).toHaveBeenCalledWith(0.3);
  });
});

describe("IndicatorSettings", () => {
  it("edits inputs, styles and levels live; Cancel restores", async () => {
    useChartLayout.getState().addIndicator("rsi");
    const id = useChartLayout.getState().indicators[1]!.id;
    const cfg = () => useChartLayout.getState().indicators.find((i) => i.id === id)!;
    const onClose = vi.fn();
    const { rerender } = render(<IndicatorSettings cfg={cfg()} onClose={onClose} />);
    const refresh = () => rerender(<IndicatorSettings cfg={cfg()} onClose={onClose} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Source" }), "hlc3");
    expect(cfg().source).toBe("hlc3");
    refresh();

    await userEvent.click(screen.getByRole("tab", { name: "Style" }));
    await userEvent.click(screen.getByRole("button", { name: /RSI colour/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "#f23645" }));
    expect(cfg().styles?.rsi?.color).toBe("#f23645");
    await userEvent.keyboard("{Escape}");
    refresh();
    await userEvent.click(screen.getByRole("button", { name: /RSI line/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "2px" }));
    expect(cfg().styles?.rsi).toMatchObject({ color: "#f23645", width: 2 });
    await userEvent.keyboard("{Escape}");
    refresh();

    const level = screen.getByRole("spinbutton", { name: "Level 2" });
    await userEvent.clear(level);
    await userEvent.type(level, "80");
    expect(cfg().levels).toEqual([30, 80]);
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Add level" }));
    expect(cfg().levels).toEqual([30, 80, 80]);
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Remove level 30" }));
    expect(cfg().levels).toEqual([80, 80]);
    refresh();
    await userEvent.click(screen.getByRole("checkbox", { name: "RSI" }));
    expect(cfg().styles?.rsi?.hidden).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Defaults" }));
    expect(cfg()).toMatchObject({
      params: [14],
      source: undefined,
      styles: undefined,
      levels: undefined,
    });
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cfg()).toMatchObject({ params: [14], source: undefined });
    expect(onClose).toHaveBeenCalled();
  });

  it("offers rising/falling colours for histograms", async () => {
    const vol = useChartLayout.getState().indicators[0]!;
    render(<IndicatorSettings cfg={vol} onClose={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "Inputs" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Rising colour/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "#4caf50" }));
    expect(useChartLayout.getState().indicators[0]!.upColor).toBe("#4caf50");
  });
});

describe("drawing settings and floating toolbar", () => {
  const add = (d: Partial<Drawing>) => {
    const drawing: Drawing = {
      id: "x",
      type: "trendline",
      color: "#2962ff",
      points: [
        { time: 1_790_000_000, price: 100 },
        { time: 1_790_003_600, price: 110 },
      ],
      ...d,
    };
    useChartLayout.getState().addDrawing("bitcoin", drawing);
    return () => useChartLayout.getState().drawings.bitcoin![0]!;
  };

  it("trend line: style, extensions, label, lock, coordinates; Cancel restores", async () => {
    const get = add({});
    const onClose = vi.fn();
    const { rerender } = render(
      <DrawingSettings coinId="bitcoin" drawing={get()} onClose={onClose} />,
    );
    const refresh = () =>
      rerender(<DrawingSettings coinId="bitcoin" drawing={get()} onClose={onClose} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Extend right" }));
    refresh();
    await userEvent.click(screen.getByRole("checkbox", { name: "Price change, % and bars" }));
    refresh();
    await userEvent.click(screen.getByRole("checkbox", { name: "Lock in place" }));
    expect(get()).toMatchObject({ extendRight: true, showLabel: true, locked: true });
    refresh();

    await userEvent.click(screen.getByRole("tab", { name: "Coordinates" }));
    const price = within(screen.getAllByRole("group")[1]!).getByRole("spinbutton", {
      name: "Price",
    });
    await userEvent.clear(price);
    await userEvent.type(price, "123.5");
    expect(get().points[1]!.price).toBe(123.5);
    refresh();
    const time = screen.getAllByLabelText("Time (UTC)")[0]!;
    fireEvent.change(time, { target: { value: "2026-10-01T12:00" } });
    expect(get().points[0]!.time).toBe(Date.UTC(2026, 9, 1, 12) / 1000);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(get().extendRight).toBeUndefined();
    expect(get().locked).toBeUndefined();
    expect(get().points[1]!.price).toBe(110);
  });

  it("Fibonacci levels and rectangle fill; Defaults resets", async () => {
    const get = add({ type: "fib" });
    const { rerender } = render(
      <DrawingSettings coinId="bitcoin" drawing={get()} onClose={vi.fn()} />,
    );
    const refresh = () =>
      rerender(<DrawingSettings coinId="bitcoin" drawing={get()} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("tab", { name: "Levels" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Show level 1.618" }));
    expect(get().levels!.find((l) => l.value === 1.618)!.visible).toBe(true);
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Remove level 0" }));
    expect(get().levels![0]!.value).toBe(0.236);
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Add level" }));
    expect(get().levels!.at(-1)).toEqual({ value: 1.618, visible: true });
    refresh();
    await userEvent.click(screen.getByRole("button", { name: "Defaults" }));
    expect(get().levels).toEqual(FIB_DEFAULT_LEVELS);
    expect(get().fillOpacity).toBe(0.08);
  });

  it("text notes: content, size and background", async () => {
    const get = add({ type: "text", text: "Hi", points: [{ time: 1, price: 1 }] });
    const { rerender } = render(
      <DrawingSettings coinId="bitcoin" drawing={get()} onClose={vi.fn()} />,
    );
    const refresh = () =>
      rerender(<DrawingSettings coinId="bitcoin" drawing={get()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Text" }), "!");
    expect(get().text).toBe("Hi!");
    refresh();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Font size" }), "20");
    refresh();
    await userEvent.click(screen.getByRole("checkbox", { name: "Filled background" }));
    expect(get()).toMatchObject({ fontSize: 20, fill: "none" });
  });

  it("floating toolbar edits the selected drawing", async () => {
    const get = add({ type: "rect" });
    const onChange = vi.fn((d: Drawing) => useChartLayout.getState().updateDrawing("bitcoin", d));
    const cb = { onSettings: vi.fn(), onClone: vi.fn(), onDelete: vi.fn() };
    render(<SelectionToolbar drawing={get()} onChange={onChange} {...cb} />);
    await userEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(get().locked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /Background/ }));
    fireEvent.change(await screen.findByRole("slider"), { target: { value: "40" } });
    expect(get().fillOpacity).toBe(0.4);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Drawing settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Clone drawing" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete drawing" }));
    expect(cb.onSettings).toHaveBeenCalled();
    expect(cb.onClone).toHaveBeenCalled();
    expect(cb.onDelete).toHaveBeenCalled();
  });
});
