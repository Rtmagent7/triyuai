import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@triyuai/shared";
import type { Cache } from "../cache";
import type { Db } from "../db";
import type { GoogleProfile } from "./google";
import { AppError, UnauthorizedError } from "../lib/errors";

export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_S = 7 * 86_400;

export const DEMO_EMAIL = "demo@triyuai.app";
export const DEMO_WATCHLIST = ["bitcoin", "ethereum", "solana", "chainlink", "render-token"];

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const toUser = (u: { id: string; email: string; name: string; isDemo: boolean }): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  isDemo: u.isDemo,
});

export type Session = { user: User; accessToken: string; refreshToken: string };
export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(deps: { db: Db; cache: Cache; jwtSecret: string }) {
  const { db, cache } = deps;
  const key = new TextEncoder().encode(deps.jwtSecret);
  // Verifying against a fixed hash when the email is unknown keeps login timing uniform.
  const dummyHash = hash("timing-safe-dummy-password");

  async function issue(user: User): Promise<Session> {
    const accessToken = await new SignJWT({ demo: user.isDemo })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_S}s`)
      .sign(key);
    const refreshToken = randomBytes(32).toString("base64url");
    await db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_S * 1000),
      },
    });
    return { user, accessToken, refreshToken };
  }

  return {
    async register(input: { name: string; email: string; password: string }) {
      if (input.email === DEMO_EMAIL)
        throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
      const exists = await db.user.findUnique({ where: { email: input.email } });
      if (exists) throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
      const user = await db.user.create({
        data: { name: input.name, email: input.email, passwordHash: await hash(input.password) },
      });
      return issue(toUser(user));
    },

    /**
     * Google sign-in: the account already linked to this Google id, else the account with
     * the same (Google-verified) email gets linked, else a new account. Never the demo.
     */
    async google(p: GoogleProfile) {
      if (p.email === DEMO_EMAIL)
        throw new AppError(409, "EMAIL_TAKEN", "This email can't be used with Google sign-in");
      let user = await db.user.findUnique({ where: { googleId: p.sub } });
      if (!user) {
        const byEmail = await db.user.findUnique({ where: { email: p.email } });
        if (byEmail?.isDemo)
          throw new AppError(409, "EMAIL_TAKEN", "This email can't be used with Google sign-in");
        user = byEmail
          ? await db.user.update({ where: { id: byEmail.id }, data: { googleId: p.sub } })
          : await db.user.create({
              data: {
                name: p.name,
                email: p.email,
                googleId: p.sub,
                // No password: this account signs in with Google (a password can't be guessed).
                passwordHash: await hash(randomBytes(32).toString("base64url")),
              },
            });
      }
      return issue(toUser(user));
    },

    async login(input: { email: string; password: string }, ip: string) {
      // 10 attempts per 15 minutes per IP + email blunts password guessing.
      const attempts = await cache.incr(`ratelimit:login:${sha256(`${ip}:${input.email}`)}`, 900);
      if (attempts > 10) {
        throw new AppError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many sign-in attempts. Try again in 15 minutes.",
        );
      }
      const user = await db.user.findUnique({ where: { email: input.email } });
      const ok = await verify(
        user && !user.isDemo ? user.passwordHash : await dummyHash,
        input.password,
      );
      if (!user || user.isDemo || !ok)
        throw new UnauthorizedError("Email or password is incorrect");
      return issue(toUser(user));
    },

    /** Seeded recruiter account; its watchlist is reset once a day. */
    async demo() {
      const user = await db.user.upsert({
        where: { email: DEMO_EMAIL },
        create: {
          email: DEMO_EMAIL,
          name: "Demo Recruiter",
          isDemo: true,
          // Random hash: the demo account can only be entered through /auth/demo.
          passwordHash: await hash(randomBytes(24).toString("hex")),
        },
        update: {},
      });
      const today = new Date().toISOString().slice(0, 10);
      if (!(await cache.get(`demo:reset:${today}`))) {
        await db.$transaction([
          db.watchlistItem.deleteMany({ where: { userId: user.id } }),
          db.refreshToken.deleteMany({ where: { userId: user.id, revokedAt: { not: null } } }),
          db.watchlistItem.createMany({
            data: DEMO_WATCHLIST.map((coinId) => ({ userId: user.id, coinId })),
          }),
        ]);
        await cache.set(`demo:reset:${today}`, 1, 86_400);
      }
      return issue(toUser(user));
    },

    /**
     * Refresh-token rotation: each token works once. Presenting a revoked token means
     * it was stolen or replayed, so every session of that user is revoked.
     */
    async refresh(token: string | undefined) {
      if (!token) throw new UnauthorizedError("Session expired");
      const row = await db.refreshToken.findUnique({
        where: { tokenHash: sha256(token) },
        include: { user: true },
      });
      if (!row) throw new UnauthorizedError("Session expired");
      if (row.revokedAt) {
        await db.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedError("Session expired");
      }
      if (row.expiresAt <= new Date()) throw new UnauthorizedError("Session expired");
      // Conditional update: two parallel refreshes cannot both rotate the same token.
      const { count } = await db.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!count) throw new UnauthorizedError("Session expired");
      return issue(toUser(row.user));
    },

    async logout(token: string | undefined) {
      if (!token) return;
      await db.refreshToken.updateMany({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    /** Returns the user id from a valid access token, or null. */
    async verifyAccess(token: string | undefined) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        return payload.sub ?? null;
      } catch {
        return null;
      }
    },

    async me(userId: string) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedError();
      return toUser(user);
    },
  };
}
