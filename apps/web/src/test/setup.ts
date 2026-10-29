import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./server";

// Node ≥ 25 ships an experimental global localStorage that is undefined without
// --localstorage-file and shadows jsdom's; provide an in-memory Storage instead.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!globalThis[name]) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true });
  }
}

// Node's fetch rejects jsdom's AbortSignal. Strip it and apply aborts to the
// response stream instead, which is how the chat store's Stop button works.
function wrapFetch() {
  const innerFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (!signal) return innerFetch(input, init);
    const rest = { ...init, signal: undefined };
    const abortError = () => new DOMException("The operation was aborted.", "AbortError");
    if (signal.aborted) throw abortError();
    const res = await innerFetch(input, rest);
    if (!res.body) return res;
    const reader = res.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        signal.addEventListener("abort", () => {
          controller.error(abortError());
          reader.cancel().catch(() => {});
        });
      },
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
    });
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // Must wrap MSW's interceptor, which also rejects jsdom signals.
  wrapFetch();
  // Installed after MSW so its WebSocket interceptor does not see these connections.
  vi.stubGlobal("WebSocket", SilentWebSocket);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  vi.useRealTimers();
});
afterAll(() => server.close());

// App Router hooks need a mounted router; tests assert against these spies instead.
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};
export const navigation = { pathname: "/", searchParams: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Components must never open a real Binance connection in tests.
class SilentWebSocket {
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
  constructor(public url: string) {}
  close() {}
}

// jsdom lacks these browser APIs used by Radix, cmdk and the chat view.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
