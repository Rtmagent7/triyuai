/**
 * Error monitoring (Sentry), off unless NEXT_PUBLIC_SENTRY_DSN is set. The SDK is loaded
 * lazily, after the page is idle, so it never weighs on the first load.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type Sdk = typeof import("@sentry/nextjs");
let sdk: Promise<Sdk | null> | null = null;

/** Errors only (no tracing); no user info, cookies or request bodies. */
export const sentryOptions: Parameters<Sdk["init"]>[0] = {
  dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0,
  dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
};

export function loadMonitoring(): Promise<Sdk | null> {
  if (!dsn) return Promise.resolve(null);
  sdk ??= import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init(sentryOptions);
      return Sentry;
    })
    .catch(() => null);
  return sdk;
}

/** Errors caught by React error boundaries never reach the global handlers. */
export function captureError(error: unknown) {
  void loadMonitoring().then((Sentry) => Sentry?.captureException(error));
}
