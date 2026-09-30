/**
 * Star count for the repo, shown on the header's GitHub button.
 *
 * There is no server-side source for this number (the catalog generators only
 * record stars for the *other* repos listed in plugins.json), and proxying
 * api.github.com from the Cloudflare Worker would spend one shared 60 req/h
 * budget for the whole site. So the count is fetched in the browser, where the
 * rate limit is per visitor, cached in localStorage for an hour, and falls back
 * to the value below so the button is never blank.
 */

export const GITHUB_REPO = 'davila7/claude-code-templates';
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;

/**
 * Last known count, baked in at build time. Refresh it whenever it drifts far
 * enough to look wrong on first paint (checked 2026-09-19: 30,809).
 */
export const FALLBACK_STARS = 30809;

export const STARS_CACHE_KEY = 'cct:github-stars';
export const STARS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** `30809` → `"30.8k"`, `999` → `"999"`, `1_200_000` → `"1.2M"`. */
export function formatStars(count: number): string {
  if (!Number.isFinite(count) || count < 0) return '';
  if (count < 1000) return String(Math.round(count));
  if (count < 1_000_000) {
    const k = count / 1000;
    // Keep one decimal below 100k ("30.8k"), drop it above ("120k").
    return k < 100 ? `${trimZero(k.toFixed(1))}k` : `${Math.round(k)}k`;
  }
  return `${trimZero((count / 1_000_000).toFixed(1))}M`;
}

function trimZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}
