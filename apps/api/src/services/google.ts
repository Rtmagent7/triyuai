import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AppError } from "../lib/errors";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export type GoogleProfile = { sub: string; email: string; name: string };

export type GoogleClient = {
  /** Consent-screen URL for a fresh state and PKCE challenge. */
  authUrl(state: string, codeChallenge: string): string;
  /** Exchanges the callback's code and returns the verified profile. */
  profile(code: string, codeVerifier: string): Promise<GoogleProfile>;
};

const base64url = (b: Buffer) => b.toString("base64url");
export const randomToken = () => base64url(randomBytes(32));
/** PKCE S256: the challenge is the SHA-256 of the verifier. */
export const pkceChallenge = (verifier: string) =>
  base64url(createHash("sha256").update(verifier).digest());

/**
 * "Sign in with Google" (OAuth 2.0 authorization code + PKCE, scopes openid email profile).
 * The ID token is verified against Google's published keys, audience and issuer.
 */
export function createGoogleClient(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetch?: typeof fetch;
  keys?: JWTVerifyGetKey;
}): GoogleClient {
  const get = opts.fetch ?? fetch;
  const keys = opts.keys ?? createRemoteJWKSet(new URL(JWKS_URL));
  return {
    authUrl(state, codeChallenge) {
      const q = new URLSearchParams({
        client_id: opts.clientId,
        redirect_uri: opts.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      });
      return `${AUTH_URL}?${q}`;
    },

    async profile(code, codeVerifier) {
      const res = await get(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
          redirect_uri: opts.redirectUri,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => null)) as { id_token?: string } | null;
      if (!res.ok || !body?.id_token)
        throw new AppError(401, "GOOGLE_FAILED", "Google sign-in could not be completed");
      const { payload } = await jwtVerify(body.id_token, keys, {
        audience: opts.clientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      }).catch(() => {
        throw new AppError(401, "GOOGLE_FAILED", "Google sign-in could not be verified");
      });
      if (typeof payload.sub !== "string" || typeof payload.email !== "string")
        throw new AppError(401, "GOOGLE_FAILED", "Google did not share an email address");
      if (payload.email_verified !== true)
        throw new AppError(401, "GOOGLE_UNVERIFIED", "Your Google email address isn't verified");
      const name =
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim().slice(0, 60)
          : payload.email.split("@")[0]!;
      return { sub: payload.sub, email: payload.email.toLowerCase(), name };
    },
  };
}
