"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useWatchlist } from "@/stores/watchlist";
import { sessionQuery, useSession } from "./use-session";

/** Watchlist ids from the account when signed in, otherwise from this device (FR-30/32). */
export function useWatchlistIds() {
  const session = useSession();
  const signedIn = !!session.data;
  const local = useWatchlist((s) => s.ids);
  const [localReady, setLocalReady] = useState(false);
  useEffect(() => {
    setLocalReady(useWatchlist.persist.hasHydrated());
    return useWatchlist.persist.onFinishHydration(() => setLocalReady(true));
  }, []);

  const remote = useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: async () => (await api.watchlist.list()).data,
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });

  const ids = signedIn ? (remote.data ?? []) : local;
  const ready = !session.isPending && (signedIn ? remote.data !== undefined : localReady);
  return { ids, ready, signedIn, isError: remote.isError, refetch: remote.refetch };
}

type Vars = { id: string; name: string; add: boolean };

/** Optimistic add/remove with rollback when the API call fails. */
export function useToggleWatchlist() {
  const qc = useQueryClient();
  const local = useWatchlist((s) => s.toggle);

  const mutation = useMutation({
    mutationFn: ({ id, add }: Vars) => (add ? api.watchlist.add(id) : api.watchlist.remove(id)),
    onMutate: async ({ id, add }) => {
      await qc.cancelQueries({ queryKey: queryKeys.watchlist });
      const prev = qc.getQueryData<string[]>(queryKeys.watchlist) ?? [];
      qc.setQueryData(queryKeys.watchlist, add ? [...prev, id] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (err, { name, add }, ctx) => {
      qc.setQueryData(queryKeys.watchlist, ctx?.prev);
      toast.error(`Couldn't ${add ? "add" : "remove"} ${name}`, { description: err.message });
    },
    onSuccess: (res) => qc.setQueryData(queryKeys.watchlist, res.data),
  });

  return async (id: string, name: string, active: boolean) => {
    const add = !active;
    // A click before /auth/me resolves must still go to the account, not the device.
    const user = await qc.ensureQueryData(sessionQuery(qc));
    if (user) mutation.mutate({ id, name, add });
    else local(id);
    toast(add ? `${name} added to your watchlist` : `${name} removed from your watchlist`);
  };
}
