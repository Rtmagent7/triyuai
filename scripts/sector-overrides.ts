import type { SectorId } from "../packages/shared/src/sectors.ts";

/**
 * Corrections where CoinGecko's tags, read in our priority order, would give a coin the
 * wrong primary sector, or where a coin carries none of our tags. Reviewed by hand against
 * each project's own description; the first entry is the primary sector.
 */
export const SECTOR_OVERRIDES: Record<string, SectorId[]> = {
  // Base chains CoinGecko leaves untagged or files elsewhere.
  polkadot: ["layer-1", "interop"],
  cosmos: ["layer-1", "interop"],
  "bitcoin-cash-sv": ["layer-1"],
  "conflux-token": ["layer-1"],
  neo: ["layer-1"],
  "terra-luna": ["layer-1"],
  gnosis: ["layer-1", "defi"],
  dash: ["layer-1", "privacy"],
  // AI networks whose L1 tag would otherwise come first.
  bittensor: ["ai", "layer-1", "depin"],
  // Physical infrastructure (storage, compute, video) rather than AI or a plain L1.
  filecoin: ["depin", "layer-1"],
  arweave: ["depin", "layer-1", "ai"],
  "akash-network": ["depin", "ai"],
  "theta-token": ["depin", "layer-1"],
  "aioz-network": ["depin", "layer-1", "ai"],
  // Interoperability and infrastructure.
  "quant-network": ["interop", "rwa"],
  layerzero: ["interop"],
  "the-graph": ["infra", "ai"],
  "ethereum-name-service": ["infra"],
  "worldcoin-wld": ["infra", "ai"],
  humanity: ["infra"],
  doublezero: ["infra"],
  eigenlayer: ["infra", "defi"],
  "basic-attention-token": ["infra"],
  // DeFi protocols filed under exchange tokens by CoinGecko.
  pendle: ["defi"],
  "falcon-finance-ff": ["defi"],
  derive: ["dex", "defi"],
  olympus: ["defi"],
  "world-liberty-financial": ["defi"],
  "bnb48-club-token": ["defi"],
  // Stablecoins and RWA funds missing their tag.
  usdai: ["stablecoin"],
  apyusd: ["stablecoin"],
  "midas-fasanara-global-open": ["rwa"],
  // Privacy tech, wallets, gaming.
  zama: ["privacy", "infra"],
  railgun: ["privacy", "defi"],
  "trust-wallet-token": ["wallet"],
  safepal: ["wallet"],
  swissborg: ["exchange"],
  "shuffle-2": ["gaming"],
  "bc-token": ["gaming"],
  apenft: ["nft"],
};
