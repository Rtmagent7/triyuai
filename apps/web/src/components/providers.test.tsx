import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQueryClient } from "@tanstack/react-query";
import { getGlobal, getRates } from "@/mocks/data";
import { queryKeys } from "@/lib/api/keys";
import { useWatchlist } from "@/stores/watchlist";
import { Providers } from "./providers";

function Probe() {
  const client = useQueryClient();
  return (
    <p>
      rates:
      {String((client.getQueryData(queryKeys.rates) as { data: { idr: number } }).data.idr > 0)}
    </p>
  );
}

describe("Providers", () => {
  it("seeds server data into the query cache and rehydrates persisted stores", async () => {
    localStorage.setItem(
      "triyu:watchlist",
      JSON.stringify({ state: { ids: ["bitcoin"] }, version: 0 }),
    );
    render(
      <Providers initial={{ rates: getRates(), global: getGlobal() }}>
        <Probe />
      </Providers>,
    );
    expect(screen.getByText("rates:true")).toBeInTheDocument();
    await waitFor(() => expect(useWatchlist.getState().ids).toEqual(["bitcoin"]));
  });
});
