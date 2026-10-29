import { createHash } from "node:crypto";
import type { Request } from "express";
import type { ApiResponse } from "@triyuai/shared";
import type { z } from "zod";
import { AppError } from "./errors";

/** Validates input with a shared Zod schema; the first issue becomes the 400 message. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError(400, "BAD_REQUEST", r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

export const dbMeta = (): ApiResponse<unknown>["meta"] => ({
  fetchedAt: new Date().toISOString(),
  source: "database",
  stale: false,
});

/** Guests are identified by a salted hash of their IP, never the raw address. */
export const clientKey = (req: Request, salt: string) =>
  req.userId ?? `ip:${createHash("sha256").update(`${salt}:${req.ip ?? "unknown"}`).digest("hex").slice(0, 24)}`;
