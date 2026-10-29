import { Router } from "express";
import { z } from "zod";
import { coinIdSchema, watchlistMergeSchema } from "@triyuai/shared";
import { dbMeta, parse } from "../lib/http";
import { requireUser } from "../middleware";
import type { WatchlistService } from "../services/watchlist";

export function watchlistRoutes(watchlist: WatchlistService) {
  const r = Router();
  r.use(requireUser);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const send = (ids: string[]) => ({ data: ids, meta: dbMeta() });

  r.get("/", async (req, res) => {
    res.json(send(await watchlist.list(req.userId!)));
  });

  r.post("/", async (req, res) => {
    const { coinId } = parse(z.object({ coinId: coinIdSchema }), req.body);
    res.status(201).json(send(await watchlist.add(req.userId!, coinId)));
  });

  r.post("/merge", async (req, res) => {
    const { coinIds } = parse(watchlistMergeSchema, req.body);
    res.json(send(await watchlist.merge(req.userId!, coinIds)));
  });

  r.delete("/:coinId", async (req, res) => {
    res.json(send(await watchlist.remove(req.userId!, parse(coinIdSchema, req.params.coinId))));
  });

  return r;
}
