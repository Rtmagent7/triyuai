import { describe, expect, it } from "vitest";
import { plainText, sanitizeDescription } from "./sanitize";

describe("sanitizeDescription", () => {
  it("wraps paragraphs split by blank lines", () => {
    expect(sanitizeDescription("First.\r\n\r\nSecond.")).toBe("<p>First.</p><p>Second.</p>");
  });

  it("keeps https links and hardens them", () => {
    const html = sanitizeDescription('See <a href="https://bitcoin.org">the site</a> now');
    expect(html).toBe(
      '<p>See <a href="https://bitcoin.org" target="_blank" rel="noopener noreferrer nofollow">the site</a> now</p>',
    );
  });

  it("drops non-http links but keeps their text", () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">click</a>')).toBe("<p>click</p>");
  });

  it("strips every other tag and escapes text", () => {
    const html = sanitizeDescription(
      '<script>alert("x")</script><b>bold</b><img src=x onerror=alert(1)>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("bold");
  });

  it("escapes stray angle brackets and ampersands in text", () => {
    expect(sanitizeDescription("Fees &amp; rewards: 1 &lt; 2")).toBe(
      "<p>Fees &amp; rewards: 1 &amp;lt; 2</p>",
    );
    expect(sanitizeDescription("Tom & Jerry > cats")).toBe("<p>Tom &amp; Jerry &gt; cats</p>");
  });

  it("escapes attributes inside kept links", () => {
    const html = sanitizeDescription(`<a href="https://x.io/?a=1&b='2'">x"y</a>`);
    expect(html).toContain("href=\"https://x.io/?a=1&amp;b='2'\"");
    expect(html).toContain(">x&quot;y</a>");
  });

  it("splits paragraphs on double <br>", () => {
    expect(sanitizeDescription("a<br><br>b")).toBe("<p>a</p><p>b</p>");
  });
});

describe("plainText", () => {
  it("strips tags and decodes entities", () => {
    expect(plainText('<a href="https://x">Bitcoin</a>&nbsp;is &amp; was')).toBe("Bitcoin is & was");
  });

  it("truncates with an ellipsis", () => {
    expect(plainText("a".repeat(200), 10)).toBe(`${"a".repeat(9)}…`);
  });
});
