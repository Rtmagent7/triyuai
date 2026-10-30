import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers";
import { fearGreedSnapshot } from "@/lib/market/fear-greed";

/** Third-party feeds the browser calls directly; never mocked in the app itself, so they stay live. */
const external = [
  http.get("https://api.alternative.me/fng/", () =>
    HttpResponse.json({
      data: fearGreedSnapshot.map((p) => ({
        value: String(p.value),
        value_classification: p.label,
        timestamp: String(p.time),
      })),
    }),
  ),
];

/** Same handlers as the browser mock, so tests exercise the real API contract. */
export const server = setupServer(...handlers, ...external);
