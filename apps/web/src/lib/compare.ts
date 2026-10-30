import { coinIdSchema } from "@triyuai/shared";

export const MAX_COINS = 4;
const DEFAULT = ["bitcoin", "ethereum"];

/** Valid, unique coin ids from `?coins=`, 2–4 of them (falls back to BTC vs ETH). */
export function parseCompareIds(raw: string | null | undefined) {
  const ids = [
    ...new Set((raw ?? "").split(",").filter((id) => coinIdSchema.safeParse(id).success)),
  ].slice(0, MAX_COINS);
  if (ids.length >= 2) return ids;
  return ids.length === 1 ? [ids[0]!, DEFAULT.find((d) => d !== ids[0])!] : DEFAULT;
}

/** One colour per slot, the same in the chart, legend and table. */
export const SLOT_COLORS = ["#1a9bff", "#f59e0b", "#14b8a6", "#ec4899"];
