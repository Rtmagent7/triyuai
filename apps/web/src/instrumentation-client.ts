import { loadMonitoring } from "@/lib/monitoring";

// Start Sentry once the browser is idle (no-op without NEXT_PUBLIC_SENTRY_DSN).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const start = () => void loadMonitoring();
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 5000 });
  else setTimeout(start, 2000);
}
