import { Router } from "express";
import { z } from "zod";
import { transactionInputSchema } from "@triyuai/shared/portfolio";
import { dbMeta, parse } from "../lib/http";
import { requireUser } from "../middleware";
import type { PortfolioService } from "../services/portfolio";

/** Portfolio tracker (P2): the signed-in user's transactions. */
export function portfolioRoutes(portfolio: PortfolioService) {
  const r = Router();
  r.use(requireUser);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const send = <T>(data: T) => ({ data, meta: dbMeta() });

  r.get("/transactions", async (req, res) => {
    res.json(send(await portfolio.list(req.userId!)));
  });

  r.post("/transactions", async (req, res) => {
    const input = parse(transactionInputSchema, req.body);
    res.status(201).json(send(await portfolio.add(req.userId!, input)));
  });

  r.delete("/transactions/:id", async (req, res) => {
    const id = parse(z.string().min(1).max(40), req.params.id);
    res.json(send(await portfolio.remove(req.userId!, id)));
  });

  return r;
}
