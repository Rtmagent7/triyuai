import type { Metadata } from "next";
import { Suspense } from "react";
import { ConverterPage } from "@/components/converter/converter-page";
import { serverApi } from "@/lib/api/server";
import { toSummary } from "@/mocks/data";

export const metadata: Metadata = {
  title: "Crypto converter",
  description: "Convert between 250 cryptocurrencies and USD, IDR or EUR.",
};

export default async function Page() {
  const { data } = await serverApi.coins(1, 250);
  const coins = data.coins.map(toSummary);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Converter</h1>
        <p className="text-muted mt-1 text-sm">
          Convert between the top 250 coins and USD, IDR or EUR.
        </p>
      </div>
      <Suspense>
        <ConverterPage coins={coins} />
      </Suspense>
    </div>
  );
}
