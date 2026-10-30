# Demo video (75–90 s)

Recorded: [`triyu-demo.mp4`](https://github.com/Rtmagent7/triyuai/releases/download/v1.0.0/triyu-demo.mp4) on the v1.0.0 release (93 s, 1920×1080, the live site driven by a script with idle waits cut).

The PRD's 60-second demo script, extended with what was built since: sectors, insights,
the TA chart, compare and saved chats. Record it on the live site, not localhost.

## Setup

- Browser at 1440×900, 100% zoom, dark mode, a clean profile (no extensions, no bookmarks bar).
- Signed out, currency USD, an empty watchlist.
- Screen recorder at 60 fps; record the browser window only. No music needed, but if you
  add any keep it quiet.
- Rehearse once: Ask TRIYU answers vary a little, so time the clip to the real answer.

## Shots

| #   | Time      | On screen                                | Action                                                                                                                  | Caption (optional)                          |
| --- | --------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | 0:00–0:06 | Homepage                                 | Hold on the market table while the top prices flash; move the pointer over the stats bar (USDT dominance, Fear & Greed) | Real-time crypto dashboard                  |
| 2   | 0:06–0:14 | ⌘K palette → `/coins/solana`             | Press ⌘K, type "sol", Enter                                                                                             | Search any of 250 coins                     |
| 3   | 0:14–0:22 | Coin chart                               | Switch 7D → 1Y, then line → candles; point at the sector tags (Layer 1)                                                 |                                             |
| 4   | 0:22–0:36 | Ask TRIYU panel                          | Click "Ask TRIYU about Solana"; let the "Fetched: Solana price" chip and the streamed answer play                       | AI answers from live data, never price tips |
| 5   | 0:36–0:44 | `/chart/solana`                          | Click "Full chart", add RSI from Indicators, draw a trend line                                                          | TradingView-style analysis                  |
| 6   | 0:44–0:52 | `/insights` → `/categories/meme`         | Show the Fear & Greed gauge, then click the Meme sector                                                                 | Sentiment and sectors                       |
| 7   | 0:52–0:60 | `/derivatives`                           | Hold on the liquidation heatmap; switch the pair to ETH                                                                 |                                             |
| 8   | 0:60–0:68 | `/compare?coins=bitcoin,ethereum,solana` | Switch the range to 1Y                                                                                                  |                                             |
| 9   | 0:68–0:80 | Watchlist + demo login                   | Star Solana, open `/login`, "Try the demo account", land on the synced watchlist                                        | Accounts and synced watchlists              |
| 10  | 0:80–0:88 | `/ask`                                   | Show the History sidebar, open a saved conversation; toggle light mode and switch to IDR                                | Chats saved per account                     |
| 11  | 0:88–0:90 | End card                                 | Logo + `triyuai.vercel.app` + GitHub link                                                                               |                                             |

## After recording

- Trim dead time (waiting for answers) with a cut, not a speed-up.
- Export 1080p MP4 (H.264), under 50 MB so GitHub can host it.
- Upload it to the repo's README (drag into the GitHub editor) or YouTube (unlisted), and
  add a "Demo video" link next to "Live demo" at the top of the README.
