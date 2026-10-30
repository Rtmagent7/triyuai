import { cn } from "@/lib/utils";
import mono from "@/assets/brand/logo-mark-mono.png";

/**
 * The TRIYU emblem without the wordmark, as Ask TRIYU's mark. Drawn as a mask so it takes
 * the current text colour: white on the blue Ask buttons, brand blue elsewhere.
 */
export function AskMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 bg-current", className)}
      style={{
        maskImage: `url(${mono.src})`,
        WebkitMaskImage: `url(${mono.src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
