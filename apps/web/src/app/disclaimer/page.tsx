import type { Metadata } from "next";

export const metadata: Metadata = { title: "Disclaimer & privacy" };

export default function DisclaimerPage() {
  return (
    <article className="prose-triyu mx-auto max-w-2xl space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight">Disclaimer</h1>
      <p>
        <strong>TRIYUAI is a portfolio project and not financial advice.</strong> Everything on this
        site — prices, charts, statistics and answers from Ask TRIYU — is provided for information
        and demonstration purposes only. Nothing here is a recommendation to buy, sell or hold any
        asset.
      </p>
      <p>
        Cryptocurrencies are highly volatile. Data may be delayed, incomplete or inaccurate. Always
        do your own research and consider speaking to a licensed financial adviser before making
        investment decisions.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Data sources</h2>
      <p>
        Market data provided by <a href="https://www.coingecko.com/">CoinGecko</a>. Live prices for
        the top coins stream from the Binance public WebSocket. The current version runs on a
        snapshot of CoinGecko data while the backend is being built.
      </p>
      <h2 className="pt-2 text-lg font-semibold">AI assistant</h2>
      <p>
        Ask TRIYU can make mistakes. It is designed to refuse buy/sell advice and to state when its
        data was fetched. Guests can send up to 10 messages per day.
      </p>
      <h2 className="pt-2 text-lg font-semibold">Privacy</h2>
      <p>
        Without an account, your preferences, watchlist and chat quota are stored only in your
        browser&apos;s local storage. When accounts launch, only your email address and watchlist
        will be stored on the server.
      </p>
    </article>
  );
}
