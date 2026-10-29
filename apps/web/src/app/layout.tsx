import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Footer } from "@/components/layout/footer";
import { GlobalStatsBar } from "@/components/layout/global-stats-bar";
import { Navbar } from "@/components/layout/navbar";
import { Providers } from "@/components/providers";
import { CommandPaletteLoader } from "@/components/search/command-palette-loader";
import { serverApi } from "@/lib/api/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TRIYUAI — Real-time crypto dashboard with an AI market assistant",
    template: "%s · TRIYUAI",
  },
  description:
    "Live crypto prices, interactive charts and Ask TRIYU, an AI assistant that answers with real market data.",
  openGraph: { siteName: "TRIYUAI", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0e14" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [rates, global] = await Promise.all([serverApi.rates(), serverApi.global()]);
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers initial={{ rates, global }}>
          <a
            href="#main"
            className="focus:bg-brand focus:text-brand-fg sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:px-3 focus:py-2"
          >
            Skip to content
          </a>
          <GlobalStatsBar />
          <Navbar />
          <main id="main" className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6">
            {children}
          </main>
          <Footer />
          <CommandPaletteLoader />
          <ChatPanel />
        </Providers>
      </body>
    </html>
  );
}
