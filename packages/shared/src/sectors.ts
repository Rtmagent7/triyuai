import coinSectors from "./coin-sectors.json" with { type: "json" };

/**
 * Market sectors, each backed by a CoinGecko category. A coin can sit in several
 * (NEAR is a Layer 1 and an AI coin); its primary sector is the first one it matches
 * in this order, which runs from the most defining trait to the broadest.
 */
export const SECTORS = [
  {
    id: "stablecoin",
    label: "Stablecoins",
    source: "stablecoins",
    blurb: "Tokens pegged to a fiat currency, mostly the US dollar.",
  },
  {
    id: "gold",
    label: "Tokenized gold",
    source: "tokenized-gold",
    blurb: "Tokens redeemable for physical gold.",
  },
  {
    id: "wrapped",
    label: "Wrapped",
    source: "wrapped-tokens",
    blurb: "Another chain's asset, held 1:1 by a custodian or bridge.",
  },
  {
    id: "liquid-staking",
    label: "Liquid staking",
    source: "liquid-staking-tokens",
    blurb: "Receipts for staked coins that keep earning while they trade.",
  },
  {
    id: "liquid-restaking",
    label: "Liquid restaking",
    source: "liquid-restaking-tokens",
    blurb: "Staked coins restaked to secure other networks.",
  },
  {
    id: "meme",
    label: "Meme",
    source: "meme-token",
    blurb: "Coins driven by community and culture rather than a product.",
  },
  {
    id: "oracle",
    label: "Oracles",
    source: "oracle",
    blurb: "Networks that bring off-chain data on-chain.",
  },
  {
    id: "privacy",
    label: "Privacy",
    source: "privacy-coins",
    blurb: "Coins that hide amounts, senders or receivers.",
  },
  {
    id: "dex",
    label: "DEX",
    source: "decentralized-exchange",
    blurb: "Exchanges that trade from users' own wallets.",
  },
  {
    id: "exchange",
    label: "Exchange tokens",
    source: "exchange-based-tokens",
    blurb: "Tokens issued by exchanges, often for fee discounts.",
  },
  {
    id: "layer-2",
    label: "Layer 2",
    source: "layer-2",
    blurb: "Networks that settle to another chain, usually Ethereum, for cheaper transactions.",
  },
  {
    id: "layer-1",
    label: "Layer 1",
    source: "layer-1",
    blurb: "Base blockchains with their own consensus and security.",
  },
  {
    id: "interop",
    label: "Interoperability",
    source: "interoperability",
    blurb: "Bridges and messaging between blockchains.",
  },
  {
    id: "rwa",
    label: "RWA",
    source: "real-world-assets-rwa",
    blurb: "Real-world assets such as treasuries, credit and property, on-chain.",
  },
  {
    id: "ai",
    label: "AI",
    source: "artificial-intelligence",
    blurb: "Compute, data and agent networks for artificial intelligence.",
  },
  {
    id: "depin",
    label: "DePIN",
    source: "depin",
    blurb: "Physical infrastructure (storage, wireless, GPUs) run by token-paid operators.",
  },
  {
    id: "gaming",
    label: "Gaming",
    source: "gaming",
    blurb: "Game economies and gaming platforms.",
  },
  {
    id: "nft",
    label: "NFT",
    source: "non-fungible-tokens-nft",
    blurb: "NFT collections, marketplaces and their communities.",
  },
  { id: "wallet", label: "Wallets", source: "wallets", blurb: "Tokens of crypto wallet apps." },
  {
    id: "lending",
    label: "Lending",
    source: "lending-borrowing",
    blurb: "Protocols that lend and borrow against crypto collateral.",
  },
  {
    id: "infra",
    label: "Infrastructure",
    source: "infrastructure",
    blurb: "Naming, identity, indexing and other services other apps build on.",
  },
  {
    id: "defi",
    label: "DeFi",
    source: "decentralized-finance-defi",
    blurb: "Financial apps that run on smart contracts.",
  },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];
export type Sector = (typeof SECTORS)[number];

const BY_ID = new Map<string, Sector>(SECTORS.map((s) => [s.id, s]));
const MAP = coinSectors as Record<string, SectorId[]>;

export const sectorById = (id: string): Sector | undefined => BY_ID.get(id);

/** All sectors of a coin, primary first; empty when CoinGecko lists it in none of ours. */
export const sectorsOf = (coinId: string): SectorId[] => MAP[coinId] ?? [];

export const primarySector = (coinId: string): Sector | undefined => {
  const first = sectorsOf(coinId)[0];
  return first ? BY_ID.get(first) : undefined;
};
