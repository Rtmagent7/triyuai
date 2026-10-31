import type { Instrumentation } from "next";

const enabled = () => !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs";

/** Server-side Sentry for server components and route handlers (off without a DSN). */
export async function register() {
  if (!enabled()) return;
  const [Sentry, { sentryOptions }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/monitoring"),
  ]);
  Sentry.init(sentryOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!enabled()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
