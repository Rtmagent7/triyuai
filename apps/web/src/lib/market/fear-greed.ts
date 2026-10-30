import type { FearGreedPoint } from "@triyuai/shared/fear-greed";
import snapshot from "@/mocks/fixtures/fear-greed.json";

export * from "@triyuai/shared/fear-greed";

/** Saved copy, shown when the live index can't be reached. */
export const fearGreedSnapshot = snapshot as FearGreedPoint[];
