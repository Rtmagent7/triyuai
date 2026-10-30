import { Router, type Response } from "express";
import { z } from "zod";
import { chartRangeSchema, coinIdSchema, coinsQuerySchema } from "@triyuai/shared";
import { parse } from "../lib/http";
import type { MarketService } from "../services/market";

/** Data is cached in Redis anyway; a short CDN cache absorbs bursts before they reach the function. */
const cacheable = (res: Response) =>
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");

const idsSchema = z
  .string()
  .transform((s) => s.split(",").filter(Boolean))
  .pipe(z.array(coinIdSchema).max(100, "At most 100 ids"));

export function marketRoutes(market: MarketService) {
  const r = Router();

  r.get("/global", async (_req, res) => {
    cacheable(res);
    res.json(await market.global());
  });

  r.get("/rates", async (_req, res) => {
    cacheable(res);
    res.json(await market.rates());
  });

  r.get("/highlights", async (_req, res) => {
    cacheable(res);
    res.json(await market.highlights());
  });

  r.get("/exchanges", async (_req, res) => {
    cacheable(res);
    res.json(await market.exchanges());
  });

  r.get("/coins", async (req, res) => {
    cacheable(res);
    if (typeof req.query.ids === "string") {
      res.json(await market.coinsByIds(parse(idsSchema, req.query.ids)));
      return;
    }
    const q = parse(coinsQuerySchema, req.query);
    res.json(await market.coins(q.page, q.perPage));
  });

  r.get("/coins/:id", async (req, res) => {
    cacheable(res);
    res.json(await market.coin(parse(coinIdSchema, req.params.id)));
  });

  r.get("/coins/:id/chart", async (req, res) => {
    cacheable(res);
    const range = parse(chartRangeSchema, req.query.range ?? "7d");
    res.json(await market.chart(parse(coinIdSchema, req.params.id), range));
  });

  r.get("/search", async (req, res) => {
    cacheable(res);
    const q = parse(z.string().max(50).default(""), req.query.q);
    res.json(await market.search(q));
  });

  return r;
}
