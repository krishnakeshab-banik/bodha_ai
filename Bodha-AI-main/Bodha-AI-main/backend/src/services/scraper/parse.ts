/**
 * Parse rupee amounts and abbreviated review counts from marketplace DOM text.
 */

export function parseInr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹Rs.\s]/gi, '').replace(/,/g, '');
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * "6K" → 6000, "(33,705)" → 33705, "3.3k" → 3300, "75" → 75.
 */
export function parseCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.replace(/[(),]/g, '').trim().toLowerCase();
  const match = text.match(/^([\d.]+)\s*([kmb])?$/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2];
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  return Math.round(base * multiplier);
}

export function parseRating(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d(?:\.\d)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 5) return null;
  return value;
}

export function absoluteUrl(href: string, origin: string): string {
  if (!href) return origin;
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}
