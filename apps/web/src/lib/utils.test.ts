import { describe, expect, it } from "vitest";
import { clamp, cn, hashString, seededRandom } from "./utils";

describe("utils", () => {
  it("merges tailwind classes, last one wins", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4")).toBe("text-sm px-4");
  });

  it("clamps numbers", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("produces a stable hash and deterministic random sequence", () => {
    expect(hashString("bitcoin")).toBe(hashString("bitcoin"));
    expect(hashString("bitcoin")).not.toBe(hashString("ethereum"));
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
