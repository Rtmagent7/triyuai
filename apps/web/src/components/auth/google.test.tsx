import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/keys";
import { useWatchlist } from "@/stores/watchlist";
import { navigation, router } from "@/test/setup";
import { renderWithClient } from "@/test/utils";
import { AuthForm } from "./auth-form";
import { GoogleReturn } from "./google";

// Production sets NEXT_PUBLIC_GOOGLE_LOGIN=enabled once the API has credentials.
vi.mock("./google", async (original) => ({
  ...(await original<typeof import("./google")>()),
  googleLoginEnabled: true,
}));

beforeEach(() => {
  router.push.mockClear();
  navigation.searchParams = new URLSearchParams();
  useWatchlist.setState({ ids: [] });
  window.history.replaceState(null, "", "/");
});

describe("Continue with Google", () => {
  it("links to the API's Google flow with the page to return to", () => {
    navigation.searchParams = new URLSearchParams({ next: "/portfolio" });
    renderWithClient(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      `${API_URL}/auth/google?next=%2Fportfolio`,
    );
  });

  it("explains why a Google sign-in came back without a session", () => {
    navigation.searchParams = new URLSearchParams({ error: "google_cancelled" });
    renderWithClient(<AuthForm mode="login" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Google sign-in was cancelled.");
  });

  it("ignores unknown error codes", () => {
    navigation.searchParams = new URLSearchParams({ error: "<script>" });
    renderWithClient(<AuthForm mode="login" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("returning from Google", () => {
  it("merges the device watchlist, greets the user and cleans the address", async () => {
    // A session exists already (the API set the cookies before redirecting back).
    const signup = renderWithClient(<AuthForm mode="register" />);
    await userEvent.type(screen.getByLabelText("Name"), "Rekha");
    await userEvent.type(screen.getByLabelText("Email"), "rekha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Sup3rsecret");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    signup.unmount();

    useWatchlist.setState({ ids: ["solana"] });
    window.history.replaceState(null, "", "/portfolio?signin=google&tab=open");
    const { client } = renderWithClient(<GoogleReturn />);

    await waitFor(() => expect(client.getQueryData(queryKeys.watchlist)).toContain("solana"));
    expect(useWatchlist.getState().ids).toEqual([]);
    expect(window.location.pathname + window.location.search).toBe("/portfolio?tab=open");
  });

  it("does nothing on a normal visit", async () => {
    useWatchlist.setState({ ids: ["solana"] });
    window.history.replaceState(null, "", "/portfolio");
    const { client } = renderWithClient(<GoogleReturn />);
    await new Promise((r) => setTimeout(r, 50));
    expect(client.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useWatchlist.getState().ids).toEqual(["solana"]);
  });
});
