import Link from "next/link";
import { sectorById, sectorsOf, type SectorId } from "@triyuai/shared/sectors";
import { cn } from "@/lib/utils";

/** A coin's sectors as small links, primary first. */
export function SectorTags({ coinId, className }: { coinId: string; className?: string }) {
  const ids = sectorsOf(coinId);
  if (!ids.length) return null;
  return (
    <ul aria-label="Sectors" className={cn("flex flex-wrap gap-1.5", className)}>
      {ids.map((id, i) => (
        <li key={id}>
          <Link
            href={`/categories/${id}`}
            className={cn(
              "border-border hover:border-text/40 inline-flex h-6 items-center rounded-md border px-2 text-xs transition-colors",
              i === 0 ? "text-text font-medium" : "text-muted hover:text-text",
            )}
          >
            {sectorById(id)?.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Tab order: the sectors people browse most first, pegged and wrapped assets last. */
const NAV_ORDER: SectorId[] = [
  "layer-1",
  "layer-2",
  "meme",
  "ai",
  "rwa",
  "defi",
  "dex",
  "lending",
  "depin",
  "gaming",
  "oracle",
  "interop",
  "infra",
  "privacy",
  "exchange",
  "nft",
  "wallet",
  "stablecoin",
  "liquid-staking",
  "liquid-restaking",
  "wrapped",
  "gold",
];

/** The main sectors as a scrollable row of links; `current` marks the open one. */
export function SectorNav({ current, className }: { current?: SectorId; className?: string }) {
  const items: { id: SectorId | "all"; label: string; href: string }[] = [
    { id: "all", label: "All sectors", href: "/categories" },
    ...NAV_ORDER.map((id) => ({ id, label: sectorById(id)!.label, href: `/categories/${id}` })),
  ];
  return (
    <nav aria-label="Sectors" className={cn("border-border border-b", className)}>
      <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {items.map((s) => {
          const active = s.id === (current ?? "all");
          return (
            <li key={s.id} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center px-2.5 text-sm transition-colors",
                  active
                    ? "text-text after:bg-brand font-medium after:absolute after:inset-x-2.5 after:bottom-0 after:h-px"
                    : "text-muted hover:text-text",
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
