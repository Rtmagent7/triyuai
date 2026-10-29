/**
 * Mock accounts for prototype mode (no backend): same endpoints and errors as
 * apps/api, with state kept in localStorage so a reload stays signed in.
 * Passwords are stored in plain text here because nothing leaves the browser.
 */
import { http, HttpResponse, delay } from "msw";
import { coinIdSchema, loginSchema, registerSchema, watchlistMergeSchema } from "@triyuai/shared";
import { WATCHLIST_MAX } from "@triyuai/shared/constants";

type MockUser = { id: string; email: string; name: string; password: string; isDemo: boolean };
type State = { users: MockUser[]; session: string | null; watchlists: Record<string, string[]> };

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
