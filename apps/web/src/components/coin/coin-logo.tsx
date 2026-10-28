import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = { src: string; name: string; size?: number; className?: string; priority?: boolean };

/**
 * Logos load straight from the CoinGecko CDN in the small (64 px) variant: they are
 * already tiny, and proxying 250+ remote images would burn the image-optimisation quota.
 */
export function CoinLogo({ src, name, size = 24, className, priority }: Props) {
  return (
    <Image
      src={src.replace("/large/", "/small/")}
      unoptimized
      alt={`${name} logo`}
      width={size}
      height={size}
      priority={priority}
      className={cn("bg-surface-2 shrink-0 rounded-full", className)}
    />
  );
}
