/**
 * Phase 1: starts the MSW service worker lazily, the first time the browser
 * calls the API. Server-rendered HTML is not blocked by it.
 */
let ready: Promise<void> | null = null;

export const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING !== "disabled";

export function ensureMocks(): Promise<void> {
  if (!mockingEnabled || typeof window === "undefined") return Promise.resolve();
  ready ??= import("@/mocks/browser")
    .then(({ worker }) =>
      worker.start({
        onUnhandledRequest: "bypass",
        quiet: true,
        serviceWorker: { url: "/mockServiceWorker.js" },
      }),
    )
    .then(() => undefined);
  return ready;
}
