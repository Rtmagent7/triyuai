/**
 * Minimal allowlist sanitiser for CoinGecko descriptions (PRD §15).
 * Only plain text, paragraphs and https links survive; every other tag is
 * stripped and all text is HTML-escaped.
 */
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ""));

// The closing quote must match the opening one, so `href="…'…"` is captured whole.
const LINK = /<a\s[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

function inline(html: string) {
  let out = "";
  let last = 0;
  for (const m of html.matchAll(LINK)) {
    out += escape(stripTags(html.slice(last, m.index)));
    const href = m[2]!;
    const text = escape(stripTags(m[3]!));
    out += /^https?:\/\//i.test(href)
      ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`
      : text;
    last = m.index! + m[0].length;
  }
  return out + escape(stripTags(html.slice(last)));
}

export function sanitizeDescription(html: string) {
  return html
    .split(/(?:\r?\n){2,}|<br\s*\/?>\s*<br\s*\/?>/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(p.replace(/\r?\n/g, " "))}</p>`)
    .join("");
}

export function plainText(html: string, max = 160) {
  const t = stripTags(html).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
