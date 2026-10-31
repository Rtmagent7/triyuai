import request from "supertest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db";
import {
  createGoogleClient,
  pkceChallenge,
  type GoogleClient,
  type GoogleProfile,
} from "../src/services/google";
import { createTestContext } from "./helpers";

const WEB = "https://triyu.test";

/** A stand-in Google that accepts one code and remembers the PKCE verifier it was given. */
function fakeGoogle(profile: GoogleProfile, code = "good-code") {
  const seen: { challenge?: string; verifier?: string } = {};
  const client: GoogleClient = {
    authUrl: (state, challenge) => {
      seen.challenge = challenge;
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&code_challenge=${challenge}`;
    },
    profile: async (c, verifier) => {
      seen.verifier = verifier;
      if (c !== code) throw new Error("bad code");
      return profile;
    },
  };
  return { client, seen };
}

const ann = { sub: "g-123", email: "ann@example.com", name: "Ann" };

/** Starts sign-in and returns the agent (holding the state cookie) and the state value. */
async function start(app: Parameters<typeof request.agent>[0], next = "/portfolio") {
  const agent = request.agent(app);
  const res = await agent.get(`/api/v1/auth/google?next=${encodeURIComponent(next)}`).expect(302);
  const state = new URL(res.headers.location!).searchParams.get("state")!;
  return { agent, state };
}

describe("Google sign-in routes", () => {
  it("sends the user to Google with state and PKCE, then signs them in and returns them", async () => {
    const google = fakeGoogle(ann);
    const ctx = await createTestContext({
      google: google.client,
      db: await createDb("pglite:memory"),
    });
    const { agent, state } = await start(ctx.app);
    const back = await agent
      .get(`/api/v1/auth/google/callback?code=good-code&state=${state}`)
      .expect(302);
    expect(back.headers.location).toBe(`${WEB}/portfolio?signin=google`);
    // The verifier Google received hashes to the challenge sent at the start.
    expect(pkceChallenge(google.seen.verifier!)).toBe(google.seen.challenge);
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.data).toMatchObject({ email: "ann@example.com", name: "Ann" });
  });

  it("links Google to an existing account with the same email", async () => {
    const ctx = await createTestContext({
      google: fakeGoogle(ann).client,
      db: await createDb("pglite:memory"),
    });
    await request(ctx.app)
      .post("/api/v1/auth/register")
      .send({ name: "Ann Password", email: "ann@example.com", password: "Sup3rsecret" })
      .expect(201);
    const { agent, state } = await start(ctx.app);
    await agent.get(`/api/v1/auth/google/callback?code=good-code&state=${state}`).expect(302);
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.data.name).toBe("Ann Password");
    expect(await ctx.db.user.count()).toBe(1);
  });

  it("refuses a missing or forged state, a cancelled consent and a bad code", async () => {
    const ctx = await createTestContext({
      google: fakeGoogle(ann).client,
      db: await createDb("pglite:memory"),
    });
    // No state cookie at all (e.g. a link from another site).
    const forged = await request(ctx.app)
      .get("/api/v1/auth/google/callback?code=good-code&state=abc")
      .expect(302);
    expect(forged.headers.location).toBe(`${WEB}/login?error=google_expired`);

    const { agent, state } = await start(ctx.app);
    const wrong = await agent
      .get(`/api/v1/auth/google/callback?code=good-code&state=${state}x`)
      .expect(302);
    expect(wrong.headers.location).toContain("error=google_expired");

    const s2 = await start(ctx.app);
    const cancelled = await s2.agent
      .get(`/api/v1/auth/google/callback?error=access_denied&state=${s2.state}`)
      .expect(302);
    expect(cancelled.headers.location).toContain("error=google_cancelled");

    const s3 = await start(ctx.app);
    const bad = await s3.agent
      .get(`/api/v1/auth/google/callback?code=nope&state=${s3.state}`)
      .expect(302);
    expect(bad.headers.location).toContain("error=google_failed");
    expect(await ctx.db.user.count()).toBe(0);
  });

  it("only returns to same-site paths", async () => {
    const ctx = await createTestContext({
      google: fakeGoogle(ann).client,
      db: await createDb("pglite:memory"),
    });
    for (const next of ["//evil.example/x", "https://evil.example", "/\\evil.example"]) {
      const { agent, state } = await start(ctx.app, next);
      const back = await agent
        .get(`/api/v1/auth/google/callback?code=good-code&state=${state}`)
        .expect(302);
      expect(back.headers.location).toBe(`${WEB}/watchlist?signin=google`);
    }
  });

  it("never signs in to the demo account", async () => {
    const ctx = await createTestContext({
      google: fakeGoogle({ sub: "g-demo", email: "demo@triyuai.app", name: "x" }).client,
      db: await createDb("pglite:memory"),
    });
    const { agent, state } = await start(ctx.app);
    const back = await agent
      .get(`/api/v1/auth/google/callback?code=good-code&state=${state}`)
      .expect(302);
    expect(back.headers.location).toContain("error=google_failed");
  });

  it("reports when Google sign-in isn't configured", async () => {
    const ctx = await createTestContext({ db: await createDb("pglite:memory") });
    const res = await request(ctx.app).get("/api/v1/auth/google").expect(302);
    expect(res.headers.location).toBe(`${WEB}/login?error=google_unavailable`);
  });
});

describe("Google client", () => {
  async function setup(claims: Record<string, unknown>, aud = "client-1") {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    const idToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(aud)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const calls: URLSearchParams[] = [];
    const client = createGoogleClient({
      clientId: "client-1",
      clientSecret: "secret",
      redirectUri: `${WEB}/api/v1/auth/google/callback`,
      keys: createLocalJWKSet({ keys: [jwk] }),
      fetch: (async (_url: string, init: RequestInit) => {
        calls.push(new URLSearchParams(String(init.body)));
        return new Response(JSON.stringify({ id_token: idToken }));
      }) as typeof fetch,
    });
    return { client, calls };
  }

  it("exchanges the code with the PKCE verifier and returns the verified profile", async () => {
    const { client, calls } = await setup({
      sub: "g-1",
      email: "Ann@Example.com",
      email_verified: true,
      name: "Ann",
    });
    expect(await client.profile("code-1", "verifier-1")).toEqual({
      sub: "g-1",
      email: "ann@example.com",
      name: "Ann",
    });
    expect(Object.fromEntries(calls[0]!)).toMatchObject({
      code: "code-1",
      code_verifier: "verifier-1",
      grant_type: "authorization_code",
      redirect_uri: `${WEB}/api/v1/auth/google/callback`,
    });
    const url = new URL(client.authUrl("st", "ch"));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      scope: "openid email profile",
      code_challenge_method: "S256",
      state: "st",
    });
  });

  it("rejects tokens for another app and unverified emails", async () => {
    const other = await setup(
      { sub: "g-1", email: "a@b.co", email_verified: true },
      "someone-else",
    );
    await expect(other.client.profile("c", "v")).rejects.toThrow(/verified/);
    const unverified = await setup({ sub: "g-1", email: "a@b.co", email_verified: false });
    await expect(unverified.client.profile("c", "v")).rejects.toThrow(/isn't verified/);
  });
});
