"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@/hooks/use-session";
import { API_URL } from "@/lib/api/client";
import { useWatchlist } from "@/stores/watchlist";

/** Shown only once the API has Google credentials (and never in mock mode). */
export const googleLoginEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "enabled";

export const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_expired: "That Google sign-in took too long or was started elsewhere. Please try again.",
  google_failed: "Google sign-in didn't work. Please try again or use email.",
  google_unavailable: "Google sign-in isn't available right now. Please use email instead.",
};

/** A full-page link: the API sets the state cookie and sends the browser to Google. */
export function GoogleButton({ next }: { next: string }) {
  return (
    <Button asChild variant="outline" size="lg" className="w-full">
      <a href={`${API_URL}/auth/google?next=${encodeURIComponent(next)}`}>
        <GoogleMark /> Continue with Google
      </a>
    </Button>
  );
}

/**
 * Back from Google (`?signin=google`): merge this device's watchlist and greet the user
 * the same way as an email sign-in, then drop the parameter from the address.
 */
export function GoogleReturn() {
  const { google } = useAuthActions();
  const done = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (done.current || url.searchParams.get("signin") !== "google") return;
    done.current = true;
    url.searchParams.delete("signin");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    // The persisted watchlist may not be loaded yet; the merge needs it.
    void Promise.resolve(useWatchlist.persist.rehydrate()).then(() => google().catch(() => null));
  }, [google]);
  return null;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
