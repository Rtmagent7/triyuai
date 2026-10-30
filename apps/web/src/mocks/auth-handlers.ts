/**
 * Mock accounts for prototype mode (no backend): same endpoints and errors as
 * apps/api, with state kept in localStorage so a reload stays signed in.
 * Passwords are stored in plain text here because nothing leaves the browser.
 */
import { http, HttpResponse, delay } from "msw";
import { coinIdSchema, loginSchema, registerSchema, watchlistMergeSchema } from "@triyuai/shared";
import { WATCHLIST_MAX } from "@triyuai/shared/constants";
import type { ChatThread } from "@triyuai/shared";
import {
  PORTFOLIO_MAX_TRANSACTIONS,
  heldQuantity,
  transactionInputSchema,
  type Transaction,
} from "@triyuai/shared/portfolio";

type MockUser = { id: string; email: string; name: string; password: string; isDemo: boolean };
type State = {
  users: MockUser[];
  session: string | null;
  watchlists: Record<string, string[]>;
  /** Saved Ask TRIYU conversations per user, newest first (FR-24). */
  chats?: Record<string, ChatThread[]>;
  /** Portfolio tracker transactions per user (P2). */
  portfolios?: Record<string, Transaction[]>;
};

const KEY = "triyu:mock-auth";
const DEMO: MockUser = {
  id: "demo",
  email: "demo@triyuai.app",
  name: "Demo Recruiter",
  password: "",
  isDemo: true,
};
const DEMO_WATCHLIST = ["bitcoin", "ethereum", "solana", "chainlink", "render-token"];

const load = (): State => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* storage unavailable */
  }
  return { users: [], session: null, watchlists: {} };
};
const save = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
};

const BASE = "*/api/v1";
const meta = () => ({ fetchedAt: new Date().toISOString(), source: "mock" as const, stale: false });
const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });
const publicUser = ({ id, email, name, isDemo }: MockUser) => ({ id, email, name, isDemo });

function signIn(state: State, user: MockUser, status = 200) {
  state.session = user.id;
  save(state);
  document.cookie = "triyu_session=1; path=/; max-age=604800; samesite=lax";
  return HttpResponse.json({ data: publicUser(user), meta: meta() }, { status });
}

function current(state: State) {
  const user =
    state.users.find((u) => u.id === state.session) ?? (state.session === DEMO.id ? DEMO : null);
  return user;
}

const withUser =
  (fn: (state: State, user: MockUser) => Response | Promise<Response>) => async () => {
    await delay(120);
    const state = load();
    const user = current(state);
    if (!user) return error(401, "UNAUTHORIZED", "Please sign in");
    return fn(state, user);
  };

const list = (state: State, user: MockUser) => state.watchlists[user.id] ?? [];

/** Newest first, like apps/api. */
const sendTransactions = (list: Transaction[], status = 200) =>
  HttpResponse.json(
    {
      data: [...list].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
      ),
      meta: meta(),
    },
    { status },
  );

const titleFrom = (text: string) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line || "New chat";
};

/**
 * Saves one chat exchange for the signed-in mock user, like apps/api does. Returns the
 * conversation id, or null for guests (their chats aren't saved).
 */
export function saveMockExchange(opts: {
  conversationId?: string;
  question: string;
  regenerate?: boolean;
}) {
  const state = load();
  const user = current(state);
  if (!user) return null;
  const threads = ((state.chats ??= {})[user.id] ??= []);
  const now = () => new Date().toISOString();
  let thread = threads.find((t) => t.id === opts.conversationId);
  if (!thread) {
    thread = {
      id: crypto.randomUUID(),
      title: titleFrom(opts.question),
      updatedAt: now(),
      messages: [],
    };
    threads.unshift(thread);
    threads.splice(50);
  }
  const t = thread;
  if (opts.regenerate) {
    if (t.messages.at(-1)?.role === "assistant") t.messages.pop();
  } else {
    t.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: opts.question,
      tools: [],
      createdAt: now(),
    });
  }
  t.updatedAt = now();
  save(state);
  return {
    id: t.id,
    /** Stores the finished answer. */
    answer(content: string, tools: string[]) {
      if (!content.trim()) return;
      const s = load();
      const saved = s.chats?.[user.id]?.find((x) => x.id === t.id);
      if (!saved) return;
      saved.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        tools,
        createdAt: now(),
      });
      saved.updatedAt = now();
      s.chats![user.id]!.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      save(s);
    },
  };
}
const sendList = (state: State, user: MockUser, ids: string[], status = 200) => {
  state.watchlists[user.id] = ids;
  save(state);
  return HttpResponse.json({ data: ids, meta: meta() }, { status });
};

export const authHandlers = [
  http.post(`${BASE}/auth/register`, async ({ request }) => {
    await delay(250);
    const body = registerSchema.safeParse(await request.json());
    if (!body.success) return error(400, "BAD_REQUEST", body.error.issues[0]!.message);
    const state = load();
    if (body.data.email === DEMO.email || state.users.some((u) => u.email === body.data.email))
      return error(409, "EMAIL_TAKEN", "Email is already registered");
    const user: MockUser = { id: crypto.randomUUID(), isDemo: false, ...body.data };
    state.users.push(user);
    return signIn(state, user, 201);
  }),

  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(250);
    const body = loginSchema.safeParse(await request.json());
    if (!body.success) return error(400, "BAD_REQUEST", body.error.issues[0]!.message);
    const state = load();
    const user = state.users.find((u) => u.email === body.data.email);
    if (!user || user.password !== body.data.password)
      return error(401, "UNAUTHORIZED", "Email or password is incorrect");
    return signIn(state, user);
  }),

  http.post(`${BASE}/auth/demo`, async () => {
    await delay(250);
    const state = load();
    state.watchlists[DEMO.id] ??= [...DEMO_WATCHLIST];
    return signIn(state, DEMO);
  }),

  http.post(`${BASE}/auth/refresh`, async () => {
    const state = load();
    const user = current(state);
    return user
      ? HttpResponse.json({ data: publicUser(user), meta: meta() })
      : error(401, "UNAUTHORIZED", "Session expired");
  }),

  http.post(`${BASE}/auth/logout`, async () => {
    const state = load();
    state.session = null;
    save(state);
    document.cookie = "triyu_session=; path=/; max-age=0";
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(
    `${BASE}/auth/me`,
    withUser((state, user) =>
      HttpResponse.json({
        data: { ...publicUser(user), watchlist: list(state, user) },
        meta: meta(),
      }),
    ),
  ),

  http.get(
    `${BASE}/watchlist`,
    withUser((state, user) => sendList(state, user, list(state, user))),
  ),

  http.post(`${BASE}/watchlist/merge`, async ({ request }) => {
    const body = watchlistMergeSchema.safeParse(await request.json());
    if (!body.success) return error(400, "BAD_REQUEST", "Invalid coin ids");
    return withUser((state, user) => {
      const ids = [...new Set([...list(state, user), ...body.data.coinIds])].slice(
        0,
        WATCHLIST_MAX,
      );
      return sendList(state, user, ids);
    })();
  }),

  http.post(`${BASE}/watchlist`, async ({ request }) => {
    const { coinId } = (await request.json()) as { coinId?: unknown };
    if (!coinIdSchema.safeParse(coinId).success)
      return error(400, "BAD_REQUEST", "Invalid coin id");
    return withUser((state, user) => {
      const ids = list(state, user);
      if (ids.includes(coinId as string)) return sendList(state, user, ids, 201);
      if (ids.length >= WATCHLIST_MAX)
        return error(422, "WATCHLIST_FULL", `A watchlist holds up to ${WATCHLIST_MAX} coins`);
      return sendList(state, user, [...ids, coinId as string], 201);
    })();
  }),

  http.get(
    `${BASE}/portfolio/transactions`,
    withUser((state, user) => sendTransactions(state.portfolios?.[user.id] ?? [])),
  ),

  http.post(`${BASE}/portfolio/transactions`, async ({ request }) => {
    const body = transactionInputSchema.safeParse(await request.json());
    if (!body.success) return error(400, "BAD_REQUEST", body.error.issues[0]!.message);
    return withUser((state, user) => {
      const list = ((state.portfolios ??= {})[user.id] ??= []);
      if (list.length >= PORTFOLIO_MAX_TRANSACTIONS)
        return error(
          422,
          "PORTFOLIO_FULL",
          `A portfolio holds up to ${PORTFOLIO_MAX_TRANSACTIONS} transactions`,
        );
      const t = body.data;
      if (t.type === "sell") {
        const when = new Date(t.date).toISOString();
        const held = heldQuantity(
          list.filter((x) => x.date <= when),
          t.coinId,
        );
        if (t.quantity > held + 1e-12)
          return error(
            422,
            "INSUFFICIENT_HOLDINGS",
            held > 0
              ? `You held ${held} of this coin on that date, so you can't sell ${t.quantity}.`
              : "You didn't hold this coin on that date.",
          );
      }
      list.push({
        ...t,
        date: new Date(t.date).toISOString(),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
      save(state);
      return sendTransactions(list, 201);
    })();
  }),

  http.delete(`${BASE}/portfolio/transactions/:id`, ({ params }) =>
    withUser((state, user) => {
      const list = state.portfolios?.[user.id] ?? [];
      if (!list.some((t) => t.id === params.id))
        return error(404, "NOT_FOUND", "Transaction not found");
      state.portfolios![user.id] = list.filter((t) => t.id !== params.id);
      save(state);
      return sendTransactions(state.portfolios![user.id]!);
    })(),
  ),

  http.get(
    `${BASE}/chats`,
    withUser((state, user) =>
      HttpResponse.json({
        data: (state.chats?.[user.id] ?? []).map(({ id, title, updatedAt }) => ({
          id,
          title,
          updatedAt,
        })),
        meta: meta(),
      }),
    ),
  ),

  http.get(`${BASE}/chats/:id`, ({ params }) =>
    withUser((state, user) => {
      const t = state.chats?.[user.id]?.find((x) => x.id === params.id);
      return t
        ? HttpResponse.json({ data: t, meta: meta() })
        : error(404, "NOT_FOUND", "Conversation not found");
    })(),
  ),

  http.delete(`${BASE}/chats/:id`, ({ params }) =>
    withUser((state, user) => {
      const threads = state.chats?.[user.id] ?? [];
      if (!threads.some((x) => x.id === params.id))
        return error(404, "NOT_FOUND", "Conversation not found");
      state.chats![user.id] = threads.filter((x) => x.id !== params.id);
      save(state);
      return new HttpResponse(null, { status: 204 });
    })(),
  ),

  http.delete(`${BASE}/watchlist/:coinId`, ({ params }) =>
    withUser((state, user) =>
      sendList(
        state,
        user,
        list(state, user).filter((id) => id !== params.coinId),
      ),
    )(),
  ),
];
