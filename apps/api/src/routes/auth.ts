import { Router, type CookieOptions, type Response } from "express";
import { loginSchema, registerSchema } from "@triyuai/shared";
import { dbMeta, parse } from "../lib/http";
import { ACCESS_COOKIE, REFRESH_COOKIE, SESSION_HINT_COOKIE, requireUser } from "../middleware";
import { ACCESS_TTL_S, REFRESH_TTL_S, type AuthService, type Session } from "../services/auth";
import type { WatchlistService } from "../services/watchlist";
import { pkceChallenge, randomToken, type GoogleClient } from "../services/google";

const OAUTH_COOKIE = "triyu_oauth";
const OAUTH_PATH = "/api/v1/auth/google";
/** Only same-site paths, never "//evil.example" or a full URL. */
const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next.slice(0, 200)
    : "/watchlist";

export function authRoutes(
  auth: AuthService,
  watchlist: WatchlistService,
  secure: boolean,
  google: { client: GoogleClient | null; webOrigin: string } = { client: null, webOrigin: "" },
) {
  const r = Router();
  const base: CookieOptions = { httpOnly: true, secure, sameSite: "lax" };
  // The refresh token is only ever sent to the auth endpoints.
  const refreshPath = "/api/v1/auth";

  function setSession(res: Response, s: Session) {
    setSessionCookies(res, s);
    res.json({ data: s.user, meta: dbMeta() });
  }

  function setSessionCookies(res: Response, s: Session) {
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

  // "Sign in with Google": consent screen, then back to the callback with a code.
  r.get("/google", (req, res) => {
    const web = google.webOrigin;
    if (!google.client) return res.redirect(`${web}/login?error=google_unavailable`);
    const state = randomToken();
    const verifier = randomToken();
    const next = safeNext(req.query.next);
    res.cookie(
      OAUTH_COOKIE,
      Buffer.from(JSON.stringify({ state, verifier, next })).toString("base64url"),
      {
        ...base,
        path: OAUTH_PATH,
        maxAge: 10 * 60 * 1000,
      },
    );
    res.setHeader("Cache-Control", "no-store");
    res.redirect(google.client.authUrl(state, pkceChallenge(verifier)));
  });

  r.get("/google/callback", async (req, res) => {
    const web = google.webOrigin;
    res.clearCookie(OAUTH_COOKIE, { ...base, path: OAUTH_PATH });
    res.setHeader("Cache-Control", "no-store");
    let saved: { state?: string; verifier?: string; next?: string } = {};
    try {
      saved = JSON.parse(
        Buffer.from(String(req.cookies?.[OAUTH_COOKIE] ?? ""), "base64url").toString(),
      );
    } catch {
      saved = {};
    }
    const fail = (reason: string) => res.redirect(`${web}/login?error=${reason}`);
    if (!google.client) return fail("google_unavailable");
    // The user cancelled on Google's screen, or the state doesn't match (CSRF / expired).
    if (req.query.error) return fail("google_cancelled");
    if (
      !saved.state ||
      saved.state !== req.query.state ||
      !saved.verifier ||
      typeof req.query.code !== "string"
    )
      return fail("google_expired");
    try {
      const profile = await google.client.profile(req.query.code, saved.verifier);
      setSessionCookies(res, await auth.google(profile));
    } catch {
      return fail("google_failed");
    }
    const next = safeNext(saved.next);
    res.redirect(`${web}${next}${next.includes("?") ? "&" : "?"}signin=google`);
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
