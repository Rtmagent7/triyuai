import type { Logger } from "./logger";

/** Where unexpected (500) errors go besides the log. */
export type ErrorReporter = {
  capture(err: unknown, context: { method: string; path: string }): void;
  /** Serverless instances can freeze after the response, so pending events are sent first. */
  flush(): Promise<void>;
};

export const noopReporter: ErrorReporter = { capture() {}, flush: async () => {} };

/**
 * Sentry when SENTRY_DSN is set, nothing otherwise. The SDK is only loaded when configured
 * (it is external to the bundle). Request bodies, cookies and IPs are never sent.
 */
export async function createReporter(opts: {
  dsn?: string;
  environment: string;
  release?: string;
  logger: Logger;
}): Promise<ErrorReporter> {
  if (!opts.dsn) return noopReporter;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: opts.dsn,
      environment: opts.environment,
      release: opts.release,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      tracesSampleRate: 0,
      // Express and the HTTP layer are reported by errorHandler, not auto-instrumented.
      defaultIntegrations: false,
      integrations: [
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.onUnhandledRejectionIntegration(),
        Sentry.linkedErrorsIntegration(),
        Sentry.contextLinesIntegration(),
      ],
    });
    return {
      capture(err, context) {
        Sentry.captureException(err, {
          tags: { method: context.method },
          extra: { path: context.path },
        });
      },
      flush: async () => {
        await Sentry.flush(2000);
      },
    };
  } catch (err) {
    opts.logger.warn({ err }, "Sentry could not start; errors are only logged");
    return noopReporter;
  }
}
