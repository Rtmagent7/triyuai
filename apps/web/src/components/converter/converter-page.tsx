"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CoinSummary } from "@triyuai/shared";
import { Card } from "@/components/ui/card";
import { Converter } from "./converter";

/** FR-27: converter state is synced to the URL (?from=bitcoin&to=usd&amount=1). */
export function ConverterPage({ coins }: { coins: CoinSummary[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({
    from: params.get("from") ?? "bitcoin",
    to: params.get("to") ?? "usd",
    amount: params.get("amount") ?? "1",
  });

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(state).toString();
      router.replace(`${pathname}?${qs}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [state, router, pathname]);

  return (
    <Card className="p-5 sm:p-6">
      <Converter
        coins={coins}
        {...state}
        onChange={(next) => setState((s) => ({ ...s, ...next }))}
      />
      <p className="text-muted mt-4 text-xs">
        Rates use the latest snapshot prices; fiat conversions use cached USD exchange rates.
      </p>
    </Card>
  );
}
