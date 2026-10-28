import { http, HttpResponse, delay } from "msw";
import { chartRangeSchema, chatRequestSchema, coinsQuerySchema } from "@triyuai/shared";
import { answerEvents } from "./chat-engine";
import {
  NotFoundError,
  getChart,
  getCoinDetail,
  getCoins,
  getCoinsByIds,
  getGlobal,
  getHighlights,
  getRates,
  searchCoins,
} from "./data";

const BASE = "*/api/v1";
const latency = () => delay(150 + Math.random() * 250);

const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

const notFound = (err: unknown) => {
  if (err instanceof NotFoundError)
    return error(404, "NOT_FOUND", `Coin "${err.message}" not found`);
  throw err;
};

export const handlers = [
  http.get(`${BASE}/global`, async () => {
    await latency();
    return HttpResponse.json(getGlobal());
  }),

  http.get(`${BASE}/rates`, async () => {
    await latency();
    return HttpResponse.json(getRates());
  }),

  http.get(`${BASE}/coins`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const ids = url.searchParams.get("ids");
    if (ids) return HttpResponse.json(getCoinsByIds(ids.split(",").filter(Boolean)));
    const q = coinsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!q.success) return error(400, "BAD_REQUEST", "Invalid page or perPage");
    return HttpResponse.json(getCoins(q.data.page, q.data.perPage));
  }),

  http.get(`${BASE}/coins/:id`, async ({ params }) => {
    await latency();
    try {
      return HttpResponse.json(await getCoinDetail(String(params.id)));
    } catch (err) {
      return notFound(err);
    }
  }),

  http.get(`${BASE}/coins/:id/chart`, async ({ params, request }) => {
    await delay(300 + Math.random() * 400);
    const range = chartRangeSchema.safeParse(
      new URL(request.url).searchParams.get("range") ?? "7d",
    );
    if (!range.success) return error(400, "BAD_REQUEST", "Invalid range");
    try {
      return HttpResponse.json(await getChart(String(params.id), range.data));
    } catch (err) {
      return notFound(err);
    }
  }),

  http.get(`${BASE}/highlights`, async () => {
    await latency();
    return HttpResponse.json(getHighlights());
  }),

  http.get(`${BASE}/search`, async ({ request }) => {
    await delay(80);
    return HttpResponse.json(searchCoins(new URL(request.url).searchParams.get("q") ?? ""));
  }),

  http.post(`${BASE}/ai/chat`, async ({ request }) => {
    const body = chatRequestSchema.safeParse(await request.json());
    if (!body.success) return error(400, "BAD_REQUEST", "Invalid chat request");

    const encoder = new TextEncoder();
    const events = answerEvents(body.data);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = events.next();
        if (next.done) {
          controller.close();
          return;
        }
        if (next.value.delay) await delay(next.value.delay);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(next.value.event)}\n\n`));
      },
    });
    return new HttpResponse(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }),
];
