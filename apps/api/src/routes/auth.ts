import { Router, type CookieOptions, type Response } from "express";
import { loginSchema, registerSchema } from "@triyuai/shared";
import { dbMeta, parse } from "../lib/http";
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE, requireUser } from "../middleware";
import { ACCESS_TTL_S, REFRESH_TTL_S, type AuthService, type Session } from "../services/auth";
import type { WatchlistService } from "../services/watchlist";

export function authRoutes(auth: AuthService, watchlist: WatchlistService, secure: boolean) {
  const r = Router();
  const base: CookieOptions = { httpOnly: true, secure, sameSite: "lax" };
  // The refresh token is only ever sent to the auth endpoints.
  const refreshPath = "/api/v1/auth";

  function setSession(res: Response, s: Session) {
    res.cookie(ACCESS_COOKIE, s.accessToken, { ...base, path: "/", maxAge: ACCESS_TTL_S * 1000 });
    res.cookie(REFRESH_COOKIE, s.refreshToken, {
      ...base,
      path: refreshPath,
      maxAge: REFRESH_TTL_S * 1000,
    });
    // Readable by the page so guests can skip calling /auth/me; it carries no secret.
    res.cookie(SESSION_HINT_COOKIE, "1", {
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TTL_S * 1000,
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: s.user, meta: dbMeta() });
  }

  function clearSession(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
    res.clearCookie(REFRESH_COOKIE, { ...base, path: refreshPath });
    res.clearCookie(SESSION_HINT_COOKIE, { secure, sameSite: "lax", path: "/" });
  }

  r.post("/register", async (req, res) => {
    const session = await auth.register(parse(registerSchema, req.body));
    res.status(201);
    setSession(res, session);
  });

  r.post("/login", async (req, res) => {
    setSession(res, await auth.login(parse(loginSchema, req.body), req.ip ?? "unknown"));
  });

  r.post("/demo", async (_req, res) => {
    setSession(res, await auth.demo());
  });

  r.post("/refresh", async (req, res) => {
    try {
      setSession(res, await auth.refresh(req.cookies?.[REFRESH_COOKIE]));
    } catch (err) {
      clearSession(res);
      throw err;
    }
  });

  r.post("/logout", async (req, res) => {
    await auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearSession(res);
    res.status(204).end();
  });

  r.get("/me", requireUser, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const user = await auth.me(req.userId!);
    res.json({ data: { ...user, watchlist: await watchlist.list(user.id) }, meta: dbMeta() });
  });

  return r;
}
