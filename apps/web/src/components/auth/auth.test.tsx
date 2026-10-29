import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { WatchlistButton } from "@/components/coin/watchlist-button";
import { ChatView } from "@/components/chat/chat-view";
import { Navbar } from "@/components/layout/navbar";
import { WatchlistView } from "@/components/market/watchlist-view";
import { queryKeys } from "@/lib/api/keys";
import { useChat } from "@/stores/chat";
import { useWatchlist } from "@/stores/watchlist";
import { navigation, router } from "@/test/setup";
import { server } from "@/test/server";
import { renderWithClient } from "@/test/utils";
import { AuthForm } from "./auth-form";

const fill = async (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
};

beforeEach(() => {
  router.push.mockClear();
  navigation.searchParams = new URLSearchParams();
  useWatchlist.setState({ ids: [] });
  useChat.setState({ quota: { day: "2000-01-01", used: 0 } });
});

/** Ends the mock session (as if the cookies expired) while keeping registered users. */
function signOutMock() {
  const state = JSON.parse(localStorage.getItem("triyu:mock-auth")!);
  localStorage.setItem("triyu:mock-auth", JSON.stringify({ ...state, session: null }));
  document.cookie = "triyu_session=; path=/; max-age=0";
}

/** Registers through the mock API so later renders start signed in. */
async function signUp(email = "rekha@example.com") {
  const { client, unmount } = renderWithClient(<AuthForm mode="register" />);
  await fill("Name", "Rekha");
  await fill("Email", email);
  await fill("Password", "Sup3rsecret");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  unmount();
  return client;
}

describe("AuthForm", () => {
  it("validates fields before calling the API", async () => {
    renderWithClient(<AuthForm mode="register" />);
    await fill("Password", "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("registers, merges the device watchlist and redirects to ?next", async () => {
    useWatchlist.setState({ ids: ["solana", "bitcoin"] });
    navigation.searchParams = new URLSearchParams("next=/coins/solana");
    const client = await signUp();
    expect(router.push).toHaveBeenCalledWith("/coins/solana");
    expect(client.getQueryData(queryKeys.watchlist)).toEqual(["solana", "bitcoin"]);
    expect(useWatchlist.getState().ids).toEqual([]);
    expect(client.getQueryData(queryKeys.me)).toMatchObject({ name: "Rekha", isDemo: false });
    expect(document.cookie).toContain("triyu_session=1");
  });

  it("shows server errors: duplicate email and wrong password", async () => {
    await signUp("taken@example.com");
    signOutMock();
    renderWithClient(<AuthForm mode="register" />);
    await fill("Name", "Again");
    await fill("Email", "taken@example.com");
    await fill("Password", "Sup3rsecret");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email is already registered");
  });

  it("rejects a wrong password with one generic message", async () => {
    renderWithClient(<AuthForm mode="login" />);
    await fill("Email", "nobody@example.com");
    await fill("Password", "Whatever1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it("signs in to the demo account without merging the device watchlist", async () => {
    useWatchlist.setState({ ids: ["tron"] });
    const { client } = renderWithClient(<AuthForm mode="login" />);
    await userEvent.click(screen.getByRole("button", { name: "Try the demo account" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/watchlist"));
    expect(client.getQueryData(queryKeys.me)).toMatchObject({ isDemo: true });
    expect(client.getQueryData<string[]>(queryKeys.watchlist)).not.toContain("tron");
    expect(useWatchlist.getState().ids).toEqual(["tron"]);
  });

  it("offers to continue when already signed in", async () => {
    await signUp();
    renderWithClient(<AuthForm mode="login" />);
    expect(await screen.findByText(/signed in as Rekha/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/watchlist");
  });
});

describe("account watchlist", () => {
  it("adds optimistically and keeps the server result", async () => {
    await signUp();
    const { client } = renderWithClient(<WatchlistButton id="cardano" name="Cardano" />);
    await userEvent.click(await screen.findByRole("button", { name: "Add Cardano to watchlist" }));
    expect(
      await screen.findByRole("button", { name: "Remove Cardano from watchlist" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(queryKeys.watchlist)).toEqual(["cardano"]));
    expect(useWatchlist.getState().ids).toEqual([]); // the device list is untouched
  });

  it("rolls back when the API call fails", async () => {
    await signUp();
    server.use(
      http.post("*/api/v1/watchlist", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL", message: "Database is down" } },
          { status: 500 },
        ),
      ),
    );
    renderWithClient(<WatchlistButton id="cardano" name="Cardano" />);
    await userEvent.click(await screen.findByRole("button", { name: "Add Cardano to watchlist" }));
    expect(await screen.findByRole("button", { name: "Add Cardano to watchlist" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the account watchlist on /watchlist", async () => {
    useWatchlist.setState({ ids: ["ethereum"] });
    await signUp();
    renderWithClient(<WatchlistView />);
    expect(await screen.findByRole("row", { name: /Ethereum ETH/ })).toBeInTheDocument();
  });
});

describe("account UI", () => {
  const navbar = () =>
    renderWithClient(
      <ThemeProvider attribute="class">
        <Navbar />
      </ThemeProvider>,
    );

  it("shows Log in for guests and the account menu with sign out when signed in", async () => {
    const guest = navbar();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    guest.unmount();

    await signUp();
    navbar();
    await userEvent.click(await screen.findByRole("button", { name: "Account: Rekha" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("rekha@example.com")).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(document.cookie).not.toContain("triyu_session=1");
  });

  it("raises the chat quota to 30 when signed in", async () => {
    renderWithClient(<ChatView />);
    expect(screen.getByText(/10\/10 guest messages left today/)).toBeInTheDocument();
    await signUp();
    renderWithClient(<ChatView />);
    expect(await screen.findByText(/30\/30 messages left today/)).toBeInTheDocument();
  });
});
