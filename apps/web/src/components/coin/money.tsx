"use client";

import { useMoney } from "@/hooks/use-money";

/** Client islands so server-rendered lists still follow the selected currency. */
export function Price({ value }: { value: number | null | undefined }) {
  return <>{useMoney().price(value)}</>;
}

export function Money({ value }: { value: number | null | undefined }) {
  return <>{useMoney().compact(value)}</>;
}
