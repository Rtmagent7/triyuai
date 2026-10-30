import Link from "next/link";
import { Logo } from "./logo";

const GITHUB_URL = "https://github.com/";

export function Footer() {
  return (
    <footer className="border-border bg-surface mt-16 border-t">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="text-muted max-w-sm text-sm">
            A real-time crypto market dashboard with an AI market assistant. Built as a portfolio
            project.
          </p>
          <p className="text-muted text-sm">
            Data provided by{" "}
            <a
              href="https://www.coingecko.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text font-medium underline-offset-2 hover:underline"
            >
              CoinGecko
            </a>
            . Live prices via Binance.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-2 text-sm md:col-span-2 md:grid-cols-3"
        >
          <FooterLink href="/">Markets</FooterLink>
          <FooterLink href="/categories">Sectors</FooterLink>
          <FooterLink href="/insights">Insights</FooterLink>
          <FooterLink href="/derivatives">Derivatives</FooterLink>
          <FooterLink href="/compare">Compare</FooterLink>
          <FooterLink href="/exchanges">Exchanges</FooterLink>
          <FooterLink href="/portfolio">Portfolio</FooterLink>
          <FooterLink href="/highlights">Highlights</FooterLink>
          <FooterLink href="/converter">Converter</FooterLink>
          <FooterLink href="/watchlist">Watchlist</FooterLink>
          <FooterLink href="/ask">Ask TRIYU</FooterLink>
          <FooterLink href="/about">How I built this</FooterLink>
          <FooterLink href="/disclaimer">Disclaimer</FooterLink>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-text"
          >
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-border border-t">
        <div className="text-muted mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-4 text-xs sm:flex-row sm:justify-between sm:px-6">
          <p>
            <strong className="text-text font-semibold">Not financial advice.</strong> Prices may be
            delayed. For information only.
          </p>
          <p>Built by Rekha · © {new Date().getFullYear()} TRIYUAI</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted hover:text-text">
      {children}
    </Link>
  );
}
