import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import mark from "@/assets/brand/logo-mark.png";
import wordDark from "@/assets/brand/logo-wordmark-dark.png";
import wordLight from "@/assets/brand/logo-wordmark-light.png";

/** Brand logo: emblem + TRIYU wordmark (white letters in dark mode, ink in light mode). */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="TRIYUAI home"
      className={cn("flex shrink-0 items-center gap-2.5", className)}
    >
      <Image src={mark} alt="" width={34} height={34} priority className="size-[34px]" />
      <Image
        src={wordLight}
        alt=""
        width={85}
        height={18}
        priority
        className="h-[18px] w-auto dark:hidden"
      />
      <Image
        src={wordDark}
        alt=""
        width={85}
        height={18}
        priority
        className="hidden h-[18px] w-auto dark:block"
      />
    </Link>
  );
}
