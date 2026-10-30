/**
 * Writes packages/shared/src/coin-sectors.json: the real CoinGecko categories of every
 * coin in the markets fixture, mapped onto our sectors (primary first).
 *
 *   pnpm sectors
 *
 * One keyless request per sector (the top 250 coins of that category), with backoff on 429.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { SECTORS, type SectorId } from "../packages/shared/src/sectors.ts";
import { SECTOR_OVERRIDES } from "./sector-overrides.ts";

const API = "https://api.coingecko.com/api/v3";
const ROOT = path.resolve(import.meta.dirname, "..");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function members(category: string, attempt = 1): Promise<string[]> {
  await sleep(2500);
  const res = await fetch(
    `${API}/coins/markets?vs_currency=usd&category=${category}&order=market_cap_desc&per_page=250&page=1`,
  );
  if (res.status === 429 && attempt <= 6) {
    console.warn(`  429 on ${category}, waiting ${30 * attempt}s…`);
    await sleep(30_000 * attempt);
    return members(category, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} on ${category}`);
  return ((await res.json()) as { id: string }[]).map((c) => c.id);
}

async function main() {
  const markets = JSON.parse(
    await readFile(path.join(ROOT, "apps/web/src/mocks/fixtures/markets.json"), "utf8"),
  ) as { id: string }[];
  const ours = new Set(markets.map((m) => m.id));
  const out: Record<string, SectorId[]> = {};
  for (const s of SECTORS) {
    console.log(`Fetching ${s.label}…`);
    for (const id of await members(s.source)) if (ours.has(id)) (out[id] ??= []).push(s.id);
  }
  // SECTORS is in priority order, so each list already starts with the primary sector.
  for (const [id, sectors] of Object.entries(SECTOR_OVERRIDES)) out[id] = sectors;
  const sorted = Object.fromEntries(
    markets.filter((m) => out[m.id]).map((m) => [m.id, out[m.id]!]),
  );
  await writeFile(
    path.join(ROOT, "packages/shared/src/coin-sectors.json"),
    JSON.stringify(sorted, null, 0),
    "utf8",
  );
  console.log(`${Object.keys(sorted).length}/${markets.length} coins have a sector`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
