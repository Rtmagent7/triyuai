import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sdk);

async function load(dsn?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn ?? "");
  return import("./monitoring");
}

afterEach(() => {
  vi.unstubAllEnvs();
  sdk.init.mockClear();
  sdk.captureException.mockClear();
});

describe("monitoring", () => {
  it("stays off (and never loads the SDK) without a DSN", async () => {
    const m = await load();
    expect(await m.loadMonitoring()).toBeNull();
    m.captureError(new Error("x"));
    await Promise.resolve();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it("starts Sentry once without personal data and reports boundary errors", async () => {
    const m = await load("https://key@o1.ingest.sentry.io/2");
    const err = new Error("render failed");
    m.captureError(err);
    await m.loadMonitoring();
    await vi.waitFor(() => expect(sdk.captureException).toHaveBeenCalledWith(err));
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0]![0]).toMatchObject({
      dsn: "https://key@o1.ingest.sentry.io/2",
      tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
    });
  });
});
