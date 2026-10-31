"use client";

import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LoginInput, RegisterInput, User } from "@triyuai/shared";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useWatchlist } from "@/stores/watchlist";

export const sessionQuery = (qc: QueryClient) =>
  queryOptions({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const me = await api.auth.me();
      if (me) qc.setQueryData(queryKeys.watchlist, me.watchlist);
      return me;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

/** The signed-in user (null for guests). /auth/me also seeds the watchlist query. */
export function useSession() {
  return useQuery(sessionQuery(useQueryClient()));
}

export function useAuthActions() {
  const qc = useQueryClient();

  /** FR-32: the device's watchlist moves into the account on sign-in (not for the shared demo). */
  async function signedIn(user: User) {
    const local = useWatchlist.getState().ids;
    const merge = !user.isDemo && local.length > 0;
    const ids = (merge ? await api.watchlist.merge(local) : await api.watchlist.list()).data;
    if (merge) useWatchlist.setState({ ids: [] });
    qc.setQueryData(queryKeys.watchlist, ids);
    qc.setQueryData(queryKeys.me, { ...user, watchlist: ids });
    toast(`Signed in as ${user.name}`, {
      description: merge
        ? `${local.length} coin(s) from this device were added to your watchlist.`
        : undefined,
    });
    return user;
  }

  return {
    login: async (input: LoginInput) => signedIn((await api.auth.login(input)).data),
    register: async (input: RegisterInput) => signedIn((await api.auth.register(input)).data),
    demo: async () => signedIn((await api.auth.demo()).data),
    /** After the Google redirect the cookies are already set; finish like any other sign-in. */
    google: async () => {
      const me = await api.auth.me();
      return me ? signedIn(me) : null;
    },
    logout: async () => {
      await api.auth.logout().catch(() => undefined);
      qc.setQueryData(queryKeys.me, null);
      qc.removeQueries({ queryKey: queryKeys.watchlist });
      toast("Signed out");
    },
  };
}
