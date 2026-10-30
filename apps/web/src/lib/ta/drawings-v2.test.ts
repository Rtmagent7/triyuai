import { describe, expect, it } from "vitest";
import {
  GROUPS,
  TOOLS,
  channelOffset,
  fibExtPrice,
  fibLevels,
  fibTimeLogicals,
  nextFibTime,
  formatDuration,
  hitTest,
  moveDrawing,
  pointInPolygon,
  pointsNeeded,
  positionPoints,
  positionStats,
  priceAt,
  toolLabel,
  toolsIn,
  type Drawing,
  type DrawingType,
} from "./drawings";

const d = (type: DrawingType, points: Drawing["points"] = []): Drawing => ({
  id: "x",
  type,
  color: "#2962ff",
  points,
});
const ctx = { width: 400 };

describe("tool catalogue", () => {
  it("puts every tool in exactly one group, in order", () => {
    const all = GROUPS.flatMap((g) => toolsIn(g.id));
    expect(all).toHaveLength(Object.keys(TOOLS).length);
    expect(new Set(all).size).toBe(all.length);
    expect(toolsIn("measure")).toContain("long");
    expect(toolLabel("cursor")).toBe("Cursor");
    expect(toolLabel("fibext")).toBe("Fib extension");
    expect(pointsNeeded("path")).toBe("multi");
    expect(pointsNeeded("brush")).toBe("free");
    expect(pointsNeeded("channel")).toBe(3);
  });
});

describe("drawing maths", () => {
  it("places long/short stops symmetrically and computes risk:reward", () => {
    const long = positionPoints("long", { time: 0, price: 100 }, { time: 60, price: 110 });
    expect(long).toEqual([
      { time: 0, price: 100 },
      { time: 60, price: 110 },
      { time: 0, price: 90 },
    ]);
    const short = positionPoints("short", { time: 0, price: 100 }, { time: 60, price: 120 });
    expect(short.map((p) => p.price)).toEqual([100, 80, 120]);
    expect(positionStats([long[0]!, long[1]!, { time: 0, price: 95 }])).toMatchObject({
      targetPct: 10,
      stopPct: 5,
      ratio: 2,
    });
    // Zero distance falls back to 2% so the zones stay visible.
    expect(positionPoints("long", { time: 0, price: 50 }, { time: 1, price: 50 })[1]!.price).toBe(
      51,
    );
  });

  it("projects Fibonacci extensions and parallel channels", () => {
    const a = { time: 0, price: 100 };
    const b = { time: 10, price: 150 };
    const c = { time: 20, price: 120 };
    expect(fibExtPrice(a, b, c, 1)).toBe(170);
    expect(fibExtPrice(a, b, c, 1.618)).toBeCloseTo(200.9);
    expect(fibLevels(d("fibext"))[0]!.value).toBe(0);
    expect(priceAt(a, b, 5)).toBe(125);
    expect(priceAt(a, { time: 0, price: 3 }, 5)).toBe(100);
    expect(channelOffset([a, b, { time: 5, price: 135 }])).toBe(10);
    expect(channelOffset([a, b])).toBe(0);
  });

  it("formats durations and tests polygons", () => {
    expect(formatDuration(90 * 60)).toBe("1h 30m");
    expect(formatDuration(3 * 86_400 + 4 * 3_600)).toBe("3d 4h");
    expect(formatDuration(86_400)).toBe("1d");
    expect(formatDuration(-7200)).toBe("2h");
    expect(formatDuration(300)).toBe("5m");
    const tri = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon({ x: 2, y: 2 }, tri)).toBe(true);
    expect(pointInPolygon({ x: 9, y: 9 }, tri)).toBe(false);
  });
});

describe("hit testing per tool", () => {
  const A = { x: 100, y: 100 };
  const B = { x: 200, y: 50 };
  const C = { x: 150, y: 150 };

  it.each<[DrawingType, { x: number; y: number }[], { x: number; y: number }, boolean]>([
    ["extended", [A, B], { x: 20, y: 140 }, true],
    ["arrow", [A, B], { x: 150, y: 75 }, true],
    ["hray", [A], { x: 50, y: 100 }, false],
    ["hray", [A], { x: 300, y: 102 }, true],
    ["vline", [A], { x: 103, y: 10 }, true],
    ["crossline", [A], { x: 10, y: 99 }, true],
    ["ellipse", [A, B], { x: 150, y: 75 }, true],
    ["ellipse", [A, B], { x: 104, y: 54 }, false],
    ["triangle", [A, B, C], { x: 150, y: 100 }, true],
    ["path", [A, B, C], { x: 175, y: 100 }, true],
    ["brush", [A, B], { x: 150, y: 75 }, true],
    ["measure", [A, B], { x: 150, y: 75 }, true],
    ["long", [A, B, { x: 100, y: 150 }], { x: 150, y: 130 }, true],
    ["markup", [A], { x: 104, y: 110 }, true],
    ["fibtime", [A, B], { x: 251, y: 10 }, true],
  ])("%s", (type, pts, p, expected) => {
    const extra = type === "fibtime" ? { levelXs: [100, 250] } : {};
    const hit = hitTest(d(type), pts, p, { ...ctx, ...extra });
    expect(hit?.part === "body").toBe(expected);
  });

  it("channels hit inside the band; callouts hit their label and pointer", () => {
    const channel = hitTest(
      d("channel"),
      [A, B, C],
      { x: 150, y: 100 },
      {
        ...ctx,
        parallel: [
          { x: 100, y: 150 },
          { x: 200, y: 100 },
        ],
      },
    );
    expect(channel).toEqual({ part: "body" });
    const callout = d("callout");
    const box = { w: 60, h: 20 };
    expect(hitTest(callout, [A, B], { x: 220, y: 40 }, { ...ctx, textBox: box })).toEqual({
      part: "body",
    });
    expect(hitTest(callout, [A, B], { x: 150, y: 75 }, { ...ctx, textBox: box })).toEqual({
      part: "body",
    });
    expect(hitTest(d("brush"), [A, B], A, ctx)).toEqual({ part: "body" }); // no handles
  });

  it("moves position handles: entry carries the stop's time, stop moves in price only", () => {
    const pos = d(
      "long",
      positionPoints("long", { time: 0, price: 100 }, { time: 60, price: 110 }),
    );
    const from = { time: 0, price: 0 };
    expect(
      moveDrawing(pos, { part: "handle", index: 0 }, from, { time: 5, price: 101 }).points,
    ).toEqual([
      { time: 5, price: 101 },
      { time: 60, price: 110 },
      { time: 5, price: 90 },
    ]);
    expect(
      moveDrawing(pos, { part: "handle", index: 2 }, from, { time: 99, price: 85 }).points[2],
    ).toEqual({
      time: 0,
      price: 85,
    });
    expect(
      moveDrawing(pos, { part: "handle", index: 1 }, from, { time: 70, price: 120 }).points[1],
    ).toEqual({
      time: 70,
      price: 120,
    });
  });
});

describe("Fibonacci time zones", () => {
  it("counts zones in whole bars from the snapped origin", () => {
    expect(fibTimeLogicals(10.4, 13.2, [0, 1, 2, 3, 5, 8])).toEqual([10, 13, 16, 19, 25, 34]);
  });

  it("runs backwards when the unit is drawn to the left, and never collapses to zero", () => {
    expect(fibTimeLogicals(20, 18, [0, 1, 5])).toEqual([20, 18, 10]);
    expect(fibTimeLogicals(20, 20.3, [0, 1, 2])).toEqual([20, 21, 22]);
  });

  it("gives every default zone its own colour and hides the far ones", () => {
    const zones = fibLevels({ id: "z", type: "fibtime", points: [], color: "#000" });
    expect(new Set(zones.map((z) => z.color)).size).toBe(zones.length);
    expect(zones.find((z) => z.value === 89)?.visible).toBe(false);
    expect(nextFibTime(zones)).toBe(144);
  });
});
