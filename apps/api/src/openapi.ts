import { z } from "zod";
import { transactionInputSchema, transactionSchema } from "@triyuai/shared/portfolio";
import {
  apiErrorSchema,
  apiResponse,
  chartDataSchema,
  chatConversationSchema,
  chatRequestSchema,
  chatStreamEventSchema,
  chatThreadSchema,
  coinDetailSchema,
  coinSchema,
  coinSummarySchema,
  coinsPageSchema,
  exchangeSchema,
  globalStatsSchema,
  highlightsSchema,
  loginSchema,
  ratesSchema,
  registerSchema,
  userSchema,
  watchlistMergeSchema,
  watchlistSchema,
} from "@triyuai/shared";

/** OpenAPI 3.1 document generated from the same Zod schemas the API validates with. */
export function buildOpenApi(version: string) {
  const json = (schema: z.ZodType, io: "input" | "output" = "output") =>
    z.toJSONSchema(schema, { io, unrepresentable: "any", target: "draft-2020-12" });

  const ok = (schema: z.ZodType, description = "OK") => ({
    description,
    content: { "application/json": { schema: json(apiResponse(schema)) } },
  });
  const err = (description: string) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });
  const body = (schema: z.ZodType) => ({
    required: true,
    content: { "application/json": { schema: json(schema, "input") } },
  });
  const coinId = {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
    example: "solana",
  };
  const auth = [{ cookieAuth: [] }];

  return {
    openapi: "3.1.0",
    info: {
      title: "TRIYUAI API",
      version,
      description:
        "Crypto market data (proxied and cached from CoinGecko), accounts, watchlists and the Ask TRIYU chatbot. " +
        "Success responses are `{ data, meta }`; errors are `{ error: { code, message } }`. " +
        "Rate limit: 120 requests/min per IP. Data provided by CoinGecko.",
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Market" },
      { name: "Auth" },
      { name: "Watchlist" },
      { name: "AI" },
      { name: "System" },
    ],
    components: {
      schemas: { Error: json(apiErrorSchema) },
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "triyu_at" },
      },
    },
    paths: {
      "/api/v1/global": {
        get: {
          tags: ["Market"],
          summary: "Global market stats",
          responses: { 200: ok(globalStatsSchema) },
        },
      },
      "/api/v1/coins": {
        get: {
          tags: ["Market"],
          summary: "Market table (top 250), or specific coins with ?ids=",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 3, default: 1 },
            },
            {
              name: "perPage",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 250, default: 100 },
            },
            { name: "ids", in: "query", schema: { type: "string" }, example: "bitcoin,solana" },
          ],
          responses: {
            200: {
              description: "A page of coins, or an array when `ids` is given",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      json(apiResponse(coinsPageSchema)),
                      json(apiResponse(z.array(coinSchema))),
                    ],
                  },
                },
              },
            },
            400: err("Invalid query"),
          },
        },
      },
      "/api/v1/coins/{id}": {
        get: {
          tags: ["Market"],
          summary: "Coin detail",
          parameters: [coinId],
          responses: { 200: ok(coinDetailSchema), 404: err("Unknown coin") },
        },
      },
      "/api/v1/coins/{id}/chart": {
        get: {
          tags: ["Market"],
          summary: "Price history (line + derived OHLC candles)",
          parameters: [
            coinId,
            {
              name: "range",
              in: "query",
              schema: { type: "string", enum: ["24h", "7d", "1m", "3m", "1y", "max"] },
            },
          ],
          responses: { 200: ok(chartDataSchema), 404: err("Unknown coin") },
        },
      },
      "/api/v1/highlights": {
        get: {
          tags: ["Market"],
          summary: "Trending, top gainers/losers, highest volume",
          responses: { 200: ok(highlightsSchema) },
        },
      },
      "/api/v1/search": {
        get: {
          tags: ["Market"],
          summary: "Search coins by name or ticker",
          parameters: [{ name: "q", in: "query", schema: { type: "string" }, example: "sol" }],
          responses: { 200: ok(z.array(coinSummarySchema)) },
        },
      },
      "/api/v1/rates": {
        get: {
          tags: ["Market"],
          summary: "USD → IDR/EUR exchange rates",
          responses: { 200: ok(ratesSchema) },
        },
      },
      "/api/v1/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Create an account (sets session cookies)",
          requestBody: body(registerSchema),
          responses: {
            201: ok(userSchema, "Created"),
            400: err("Invalid input"),
            409: err("Email taken"),
          },
        },
      },
      "/api/v1/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Sign in (sets session cookies)",
          requestBody: body(loginSchema),
          responses: {
            200: ok(userSchema),
            401: err("Wrong email or password"),
            429: err("Too many attempts"),
          },
        },
      },
      "/api/v1/auth/demo": {
        post: {
          tags: ["Auth"],
          summary: "Sign in to the shared demo account",
          responses: { 200: ok(userSchema) },
        },
      },
      "/api/v1/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Rotate the refresh token and issue a new access token",
          responses: { 200: ok(userSchema), 401: err("Session expired") },
        },
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Revoke the session",
          responses: { 204: { description: "Signed out" } },
        },
      },
      "/api/v1/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current user and watchlist",
          security: auth,
          responses: {
            200: ok(userSchema.extend({ watchlist: watchlistSchema })),
            401: err("Not signed in"),
          },
        },
      },
      "/api/v1/watchlist": {
        get: {
          tags: ["Watchlist"],
          summary: "Coin ids on the watchlist",
          security: auth,
          responses: { 200: ok(watchlistSchema), 401: err("Not signed in") },
        },
        post: {
          tags: ["Watchlist"],
          summary: "Add a coin",
          security: auth,
          requestBody: body(z.object({ coinId: z.string() })),
          responses: {
            201: ok(watchlistSchema, "Added"),
            401: err("Not signed in"),
            422: err("Watchlist full"),
          },
        },
      },
      "/api/v1/watchlist/merge": {
        post: {
          tags: ["Watchlist"],
          summary: "Merge the browser's local watchlist into the account",
          security: auth,
          requestBody: body(watchlistMergeSchema),
          responses: { 200: ok(watchlistSchema), 401: err("Not signed in") },
        },
      },
      "/api/v1/watchlist/{coinId}": {
        delete: {
          tags: ["Watchlist"],
          summary: "Remove a coin",
          security: auth,
          parameters: [{ ...coinId, name: "coinId" }],
          responses: { 200: ok(watchlistSchema), 401: err("Not signed in") },
        },
      },
      "/api/v1/ai/chat": {
        post: {
          tags: ["AI"],
          summary: "Ask TRIYU (Server-Sent Events)",
          description:
            "Streams `data: <event>` lines: `tool-call` → `tool-result` → `text-delta`… → `finish`. " +
            "Guests get 10 messages a day, signed-in users 30. Signed-in users get a `conversation` event first: " +
            "the exchange is saved there (pass it back as `conversationId` to continue).",
          requestBody: body(chatRequestSchema),
          responses: {
            200: {
              description: "Event stream",
              content: { "text/event-stream": { schema: json(chatStreamEventSchema) } },
            },
            429: err("Daily quota used up"),
            503: err("AI provider not configured"),
          },
        },
      },
      "/api/v1/chats": {
        get: {
          tags: ["AI"],
          summary: "Saved Ask TRIYU conversations, newest first (50 at most)",
          security: auth,
          responses: { 200: ok(z.array(chatConversationSchema)), 401: err("Not signed in") },
        },
      },
      "/api/v1/chats/{id}": {
        get: {
          tags: ["AI"],
          summary: "One conversation with its messages",
          security: auth,
          parameters: [{ ...coinId, name: "id", description: "Conversation id" }],
          responses: {
            200: ok(chatThreadSchema),
            401: err("Not signed in"),
            404: err("Not found (or not yours)"),
          },
        },
        delete: {
          tags: ["AI"],
          summary: "Delete a conversation",
          security: auth,
          parameters: [{ ...coinId, name: "id", description: "Conversation id" }],
          responses: {
            204: { description: "Deleted" },
            401: err("Not signed in"),
            404: err("Not found"),
          },
        },
      },
      "/api/v1/exchanges": {
        get: {
          tags: ["Market"],
          summary: "Top 100 exchanges by CoinGecko Trust Score, with 24h volume in BTC and USD",
          responses: { 200: ok(z.array(exchangeSchema)) },
        },
      },
      "/api/v1/portfolio/transactions": {
        get: {
          tags: ["Portfolio"],
          summary: "The signed-in user's buys and sells, newest first",
          security: auth,
          responses: { 200: ok(z.array(transactionSchema)), 401: err("Not signed in") },
        },
        post: {
          tags: ["Portfolio"],
          summary: "Record a buy or sell (prices in USD); returns the updated list",
          security: auth,
          requestBody: body(transactionInputSchema),
          responses: {
            201: ok(z.array(transactionSchema), "Recorded"),
            401: err("Not signed in"),
            422: err("Sell larger than the holding on that date, or portfolio full"),
          },
        },
      },
      "/api/v1/portfolio/transactions/{id}": {
        delete: {
          tags: ["Portfolio"],
          summary: "Delete a transaction",
          security: auth,
          parameters: [{ ...coinId, name: "id", description: "Transaction id" }],
          responses: {
            200: ok(z.array(transactionSchema)),
            401: err("Not signed in"),
            404: err("Not found (or not yours)"),
          },
        },
      },
      "/api/v1/health": {
        get: {
          tags: ["System"],
          summary: "Health check (does not touch the database)",
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
}

export const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TRIYUAI API docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
</head>
<body>
  <div id="swagger"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script src="/docs/init.js"></script>
</body>
</html>`;

export const swaggerInit = `window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger", deepLinking: true });`;
