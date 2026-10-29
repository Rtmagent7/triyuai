import pino from "pino";

export const createLogger = (level: string, pretty = false) =>
  pino({
    level,
    redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
  });

export type Logger = ReturnType<typeof createLogger>;
