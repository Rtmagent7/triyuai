"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { LogOut, Menu, Monitor, Moon, Search, Star, Sun, UserRound } from "lucide-react";
import type { Currency } from "@triyuai/shared";
import { currencies } from "@triyuai/shared/constants";
import { Sparkle } from "@/components/chat/sparkle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthActions, useSession } from "@/hooks/use-session";
import { currencyLabel, currencySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { Logo } from "./logo";

const links = [
  { href: "/", label: "Markets" },
  { href: "/highlights", label: "Highlights" },
  { href: "/chart/bitcoin", label: "Chart" },
  { href: "/converter", label: "Converter" },
  { href: "/watchlist", label: "Watchlist" },
];

export function Navbar() {
  const pathname = usePathname();
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const openChat = useChat((s) => s.openWith);
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname.startsWith(href.startsWith("/chart") ? "/chart" : href);

  return (
    <header className="border-border bg-bg/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <MobileMenu isActive={isActive} />
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                // Underline grows in under the active (and hovered) link.
                "text-muted hover:text-text after:bg-brand relative rounded-lg px-2.5 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:transition-transform after:duration-300 hover:after:scale-x-50 xl:px-3 xl:after:inset-x-3",
                isActive(l.href) && "text-text after:scale-x-100 hover:after:scale-x-100",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="border-border bg-surface text-muted hover:text-text flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors md:w-56 lg:w-40 xl:w-56"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search className="size-4" aria-hidden />
            {/* Visible text doubles as the accessible name (WCAG 2.5.3 label-in-name). */}
            <span className="sr-only whitespace-nowrap md:not-sr-only">Search coins…</span>
            <kbd
              aria-hidden
              className="border-border bg-bg ml-auto hidden rounded border px-1.5 font-sans text-[11px] md:inline lg:hidden xl:inline"
            >
              ⌘K
            </kbd>
          </button>
          <CurrencySwitch />
          <ThemeToggle />
          {/* Icon-only between lg and xl, where the nav links take the room. */}
          <Button
            variant="ai"
            onClick={() => openChat()}
            aria-label="Ask TRIYU"
            className="hidden sm:inline-flex lg:px-2.5 xl:px-3.5"
          >
            <Sparkle className="text-white" />
            <span className="lg:hidden xl:inline">Ask TRIYU</span>
          </Button>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

function AccountMenu() {
  const { data: user } = useSession();
  const { logout } = useAuthActions();
  if (!user) {
    return (
      <Button asChild variant="outline" className="hidden lg:inline-flex" aria-label="Log in">
        <Link href="/login">
          <UserRound /> <span className="hidden xl:inline">Log in</span>
        </Link>
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Account: ${user.name}`}
          className="hidden lg:inline-flex"
        >
          <span className="bg-brand text-brand-fg flex size-7 items-center justify-center rounded-full text-xs font-semibold">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>
          <span className="text-text block text-sm font-medium">{user.name}</span>
          <span className="text-muted block truncate text-xs font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/watchlist">
            <Star className="size-4" /> Watchlist
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CurrencySwitch() {
  const currency = usePreferences((s) => s.currency);
  const setCurrency = usePreferences((s) => s.setCurrency);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`Currency: ${currencyLabel[currency]}`}
          className="px-2"
        >
          {currencyLabel[currency]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Currency</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
          {currencies.map((c) => (
            <DropdownMenuRadioItem key={c} value={c}>
              <span className="text-muted w-6">{currencySymbol[c]}</span>
              {currencyLabel[c]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({ isActive }: { isActive: (href: string) => boolean }) {
  // Controlled so the sheet closes when a link navigates (client navigation keeps it mounted).
  const [open, setOpen] = useState(false);
  const { data: user } = useSession();
  const { logout } = useAuthActions();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="max-w-xs p-5" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Logo />
        <nav aria-label="Mobile" className="mt-8 flex flex-col gap-1">
          {[...links, { href: "/ask", label: "Ask TRIYU" }, { href: "/about", label: "About" }].map(
            (l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "text-muted hover:bg-surface-2 hover:text-text rounded-lg px-3 py-2.5 font-medium",
                  isActive(l.href) && "bg-surface-2 text-text",
                )}
              >
                {l.href === "/ask" ? <span className="ai-text">{l.label}</span> : l.label}
              </Link>
            ),
          )}
        </nav>
        {user ? (
          <div className="border-border mt-6 border-t pt-4">
            <p className="text-muted text-xs">Signed in as</p>
            <p className="truncate font-medium">{user.name}</p>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        ) : (
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link href="/login" onClick={() => setOpen(false)}>
              <UserRound /> Log in
            </Link>
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
