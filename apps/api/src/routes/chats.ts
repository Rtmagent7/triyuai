import { Router } from "express";
import { z } from "zod";
import { dbMeta, parse } from "../lib/http";
import { requireUser } from "../middleware";
import type { ChatHistoryService } from "../services/chats";

const idSchema = z.string().min(1).max(40);

/** Saved Ask TRIYU conversations of the signed-in user (FR-24). */
export function chatRoutes(history: ChatHistoryService) {
  const r = Router();
  r.use(requireUser);
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  r.get("/", async (req, res) => {
    res.json({ data: await history.list(req.userId!), meta: dbMeta() });
  });

  r.get("/:id", async (req, res) => {
    res.json({
      data: await history.get(req.userId!, parse(idSchema, req.params.id)),
      meta: dbMeta(),
    });
  });

  r.delete("/:id", async (req, res) => {
    await history.remove(req.userId!, parse(idSchema, req.params.id));
    res.status(204).end();
  });

  return r;
}
