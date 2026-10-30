import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bar } from "@/lib/ta/indicators";
import { useChartLayout } from "@/stores/chart-layout";
import { server } from "@/test/server";
import { ChartLegend } from "./chart-legend";
import { ChartToolbar } from "./chart-toolbar";
import { DrawingToolbar } from "./drawing-toolbar";
import { useKlines } from "./use-klines";

const initial = useChartLayout.getState();
beforeEach(() =>
  useChartLayout.setState({ ...initial, indicators: initial.indicators, drawings: {} }),
);

const bars: Bar[] = [
  { time: 0, open: 10, high: 12, low: 9, close: 11, volume: 1500 },
  { time: 3600, open: 11, high: 13, low: 10, close: 12.1, volume: 2000 },
];

describe("chart layout store", () => {
  it("adds indicators with defaults and distinct overlay colours", () => {
    const { addIndicator } = useChartLayout.getState();
    addIndicator("sma");
    addIndicator("ema");
    addIndicator("rsi");
    const [vol, sma, ema, rsi] = useChartLayout.getState().indicators;
    expect(vol!.type).toBe("volume");
    expect(sma).toMatchObject({ type: "sma", params: [20] });
    expect(ema!.color).not.toBe(sma!.color);
    expect(rsi).toMatchObject({ params: [14] });
    expect(rsi!.color).toBeUndefined();

    useChartLayout.getState().updateIndicator(sma!.id, { params: [50], hidden: true });
    expect(useChartLayout.getState().indicators[1]).toMatchObject({ params: [50], hidden: true });
    useChartLayout.getState().removeIndicator(sma!.id);
    expect(useChartLayout.getState().indicators).toHaveLength(3);
  });

  it("keeps drawings per coin", () => {
    const s = useChartLayout.getState();
    const d = { id: "a", type: "hline" as const, points: [{ time: 1, price: 2 }], color: "#fff" };
    s.addDrawing("bitcoin", d);
    s.addDrawing("solana", { ...d, id: "b" });
    s.updateDrawing("bitcoin", { ...d, color: "#000" });
    expect(useChartLayout.getState().drawings.bitcoin).toEqual([{ ...d, color: "#000" }]);
    s.removeDrawing("bitcoin", "a");
    expect(useChartLayout.getState().drawings.bitcoin).toEqual([]);
    s.clearDrawings("solana");
    expect(useChartLayout.getState().drawings.solana).toBeUndefined();
    s.setInterval("4h");
    s.setStyle("heikin");
    s.setScale("log");
    s.toggleMagnet();
    expect(JSON.parse(localStorage.getItem("triyu:chart-layout")!).state).toMatchObject({
      interval: "4h",
      style: "heikin",
      scale: "log",
      magnet: true,
    });
  });
});

describe("ChartToolbar", () => {
  const toolbar = (variant: "full" | "compact") =>
    render(
      <ChartToolbar
        variant={variant}
        coinId="bitcoin"
        pair="BTC/USDT"
        fullscreen={false}
        onFullscreen={vi.fn()}
        onScreenshot={vi.fn()}
      />,
    );

  it("switches timeframe, style, scale and adds indicators", async () => {
    toolbar("full");
    expect(screen.getAllByRole("radio", { checked: false }).length).toBeGreaterThan(5);
    await userEvent.click(screen.getByRole("radio", { name: "4H" }));
    expect(useChartLayout.getState().interval).toBe("4h");

    await userEvent.click(screen.getByRole("button", { name: "Chart style: Candles" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Heikin Ashi" }));
    expect(useChartLayout.getState().style).toBe("heikin");

    await userEvent.click(screen.getByRole("radio", { name: "Log" }));
    expect(useChartLayout.getState().scale).toBe("log");
    await userEvent.click(screen.getByRole("radio", { name: "Log" }));
    expect(useChartLayout.getState().scale).toBe("normal");

    await userEvent.click(screen.getByRole("button", { name: "Indicators" }));
    await userEvent.click(await screen.findByText("MACD"));
    expect(useChartLayout.getState().indicators.map((i) => i.type)).toEqual(["volume", "macd"]);
  });

  it("compact mode shows fewer timeframes and links to the full chart", () => {
    useChartLayout.setState({ interval: "1m" });
    toolbar("compact");
    expect(screen.queryByRole("radio", { name: "5m" })).not.toBeInTheDocument();
    // The stored interval stays selectable even if it is not in the compact set.
    expect(screen.getByRole("radio", { name: "1m" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("link", { name: /Full chart/ })).toHaveAttribute(
      "href",
      "/chart/bitcoin",
    );
  });
});

describe("ChartLegend", () => {
  it("shows OHLC, change and indicator values, and edits indicators", async () => {
    useChartLayout.getState().addIndicator("rsi");
    const rsi = useChartLayout.getState().indicators[1]!;
    const computed = new Map([
      [
        "volume",
        [
          {
            key: "volume",
            label: "Vol",
            kind: "histogram" as const,
            color: "#0f0",
            values: [1500, 2000],
          },
        ],
      ],
      [
        rsi.id,
        [
          {
            key: "rsi",
            label: "RSI",
            kind: "line" as const,
            color: "#a855f7",
            values: [null, 61.234],
          },
        ],
      ],
    ]);
    render(
      <ChartLegend
        title="BTC/USDT · 1H"
        bars={bars}
        index={null}
        computed={computed}
        formatPrice={(p) => p.toFixed(2)}
        editable
      />,
    );
    const ohlc = screen.getByTestId("ohlc-legend");
    expect(ohlc).toHaveTextContent("O 11.00");
    expect(ohlc).toHaveTextContent("C 12.10");
    expect(ohlc).toHaveTextContent("+10.00%");
    expect(screen.getByText("2K")).toBeInTheDocument();
    expect(screen.getByText("61.23")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Settings for RSI 14" }));
    const input = await screen.findByRole("spinbutton", { name: "Length" });
    await userEvent.clear(input);
    await userEvent.type(input, "21");
    expect(useChartLayout.getState().indicators[1]!.params).toEqual([21]);
    await userEvent.click(screen.getByRole("button", { name: "OK" }));

    await userEvent.click(screen.getByRole("button", { name: "Hide RSI 21" }));
    expect(useChartLayout.getState().indicators[1]!.hidden).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Remove RSI 21" }));
    expect(useChartLayout.getState().indicators).toHaveLength(1);
  });

  it("shows the hovered bar and hides edit controls when read-only", () => {
    render(
      <ChartLegend
        title="t"
        bars={bars}
        index={0}
        computed={new Map()}
        formatPrice={String}
        editable={false}
      />,
    );
    expect(screen.getByTestId("ohlc-legend")).toHaveTextContent("C 11");
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });
});

describe("DrawingToolbar", () => {
  it("picks tools, colours, magnet and deletes", async () => {
    const props = {
      tool: "cursor" as const,
      onTool: vi.fn(),
      hasSelection: false,
      onDeleteSelected: vi.fn(),
      onClear: vi.fn(),
      count: 0,
    };
    const { rerender } = render(<DrawingToolbar {...props} />);
    // Groups open a panel of tool cards; the group then remembers the last pick.
    await userEvent.click(screen.getByRole("button", { name: "Fibonacci tools" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /Fib extension/ }));
    expect(props.onTool).toHaveBeenCalledWith("fibext");
    expect(useChartLayout.getState().lastTools.fib).toBe("fibext");
    await userEvent.click(screen.getByRole("button", { name: "Keep drawing" }));
    await userEvent.click(screen.getByRole("button", { name: "Lock all drawings" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide all drawings" }));
    expect(useChartLayout.getState()).toMatchObject({
      keepDrawing: true,
      lockDrawings: true,
      hideDrawings: true,
    });
    // Style for new drawings: palette colour, then width and dash.
    await userEvent.click(screen.getByRole("button", { name: /New drawing colour/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "#f23645" }));
    expect(useChartLayout.getState().drawingStyle.color).toBe("#f23645");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /New drawing line/ }));
    await userEvent.click(await screen.findByRole("radio", { name: "3px" }));
    await userEvent.click(screen.getByRole("radio", { name: "Dotted" }));
    expect(useChartLayout.getState().drawingStyle).toMatchObject({ width: 3, dash: "dotted" });
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Delete selected drawing" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Magnet" }));
    expect(useChartLayout.getState().magnet).toBe(true);

    rerender(<DrawingToolbar {...props} hasSelection count={2} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete selected drawing" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove all drawings" }));
    expect(props.onDeleteSelected).toHaveBeenCalled();
    expect(props.onClear).toHaveBeenCalled();
  });
});

describe("useKlines", () => {
  const kline = (t: number, c: number) => [
    t * 1000,
    String(c),
    String(c),
    String(c),
    String(c),
    "1",
  ];

  it("loads history, then pages older bars", async () => {
    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", ({ request }) => {
        const end = new URL(request.url).searchParams.get("endTime");
        return HttpResponse.json(
          end ? [kline(0, 1), kline(3600, 2)] : [kline(7200, 3), kline(10800, 4)],
        );
      }),
    );
    const onReset = vi.fn();
    const onPrepend = vi.fn();
    const { result } = renderHook(() =>
      useKlines("BTCUSDT", "1h", { onReset, onLive: vi.fn(), onPrepend }),
    );
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(onReset).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ time: 7200 })]),
    );

    await act(() => result.current.loadMore());
    expect(onPrepend).toHaveBeenCalledWith(expect.any(Array), 2);
    expect(result.current.bars.current.map((b) => b.time)).toEqual([0, 3600, 7200, 10800]);
  });

  it("reports unavailable pairs, errors and retries", async () => {
    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", () =>
        HttpResponse.json({ code: -1121 }, { status: 400 }),
      ),
    );
    const handlers = { onReset: vi.fn(), onLive: vi.fn(), onPrepend: vi.fn() };
    const unlisted = renderHook(() => useKlines("FOOUSDT", "1d", handlers));
    await waitFor(() => expect(unlisted.result.current.status).toBe("unavailable"));
    expect(renderHook(() => useKlines(null, "1d", handlers)).result.current.status).toBe(
      "unavailable",
    );

    server.use(
      http.get(
        "https://data-api.binance.vision/api/v3/klines",
        () => new HttpResponse(null, { status: 503 }),
      ),
      http.get(
        "https://api.binance.com/api/v3/klines",
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const failing = renderHook(() => useKlines("BTCUSDT", "1d", handlers));
    await waitFor(() => expect(failing.result.current.status).toBe("error"));
    server.use(
      http.get("https://data-api.binance.vision/api/v3/klines", () =>
        HttpResponse.json([kline(0, 1)]),
      ),
    );
    act(() => failing.result.current.retry());
    await waitFor(() => expect(failing.result.current.status).toBe("ready"));
  });
});
