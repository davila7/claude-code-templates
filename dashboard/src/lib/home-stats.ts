/**
 * Seed data for the home hero counters.
 *
 * Each counter is a pure function of UTC wall-clock time:
 *
 *     value(t) = base + floor((t - baseAt) / msPerUnit)
 *
 * so every visitor, on every device and in every session, sees the same
 * number for the same instant, it never goes backwards across reloads, and
 * no storage or API call is involved.
 *
 * ---------------------------------------------------------------------------
 * How the seeds below were measured (2026-09-18) — refresh them the same way:
 *
 *   components   sum of dashboard/public/counts.json.
 *                Rate: 1848 -> 1891 over the previous 30 days of catalog
 *                history (`git show <rev>:dashboard/public/counts.json`).
 *
 *   componentPrs merged PRs touching cli-tool/components/, counted over the
 *                full git history (270 since 2025-08-01).
 *                Rate: 56 merged in the previous 30 days.
 *
 *   npmInstalls  https://api.npmjs.org/downloads/point/<18mo range>/claude-code-templates
 *                -> 239282 total as of 2026-09-18.
 *                Rate: last-month point = 13995 downloads / 30 days.
 *
 *   downloads    component installs tracked in Supabase, as published by
 *                scripts/generate_trending_data.py in trending-data.json:
 *                globalStats.totalDownloads = 1340064 (all time, at its
 *                lastUpdated of 2026-07-05). That is the same figure the
 *                /trending page shows, so the two stay in agreement.
 *                Rate: globalStats.monthlyDownloads (227654) minus the
 *                132189-download spike that landed on 2026-07-05 itself,
 *                over the remaining 29 days -> ~3292/day, rounded to 3300.
 *                Do NOT take the rate from the per-component `downloads`
 *                field in components.json: that generator's Supabase
 *                pagination returns a partial set, so its totals move both
 *                up and down between runs.
 * ---------------------------------------------------------------------------
 */

export interface HomeStat {
  /** Stable id, also used as the React key. */
  key: string;
  /** Short label under the number. */
  label: string;
  /** Value at `baseAt`. */
  base: number;
  /** UTC epoch (ms) the `base` value was measured at. */
  baseAt: number;
  /** Measured growth, in units per day. */
  perDay: number;
  /** Optional destination when the cell is clicked. */
  href?: string;
  /** Screen-reader / tooltip description. */
  title: string;
}

/** 2026-09-18T00:00:00Z — the instant most seeds below were measured at. */
const MEASURED_AT = Date.UTC(2026, 8, 18);

/** 2026-07-05T00:00:00Z — `lastUpdated` of the trending data the downloads seed comes from. */
const TRENDING_MEASURED_AT = Date.UTC(2026, 6, 5);

const DAY_MS = 86_400_000;

export const HOME_STATS: HomeStat[] = [
  {
    key: 'components',
    label: 'Components',
    base: 1891,
    baseAt: MEASURED_AT,
    perDay: 1.4,
    title: 'Agents, commands, skills, MCPs, hooks, settings and more in the catalog',
  },
  {
    key: 'downloads',
    label: 'Downloads',
    base: 1340064,
    baseAt: TRENDING_MEASURED_AT,
    perDay: 3300,
    href: '/trending',
    title: 'Components installed through the CLI, all time',
  },
  {
    key: 'componentPrs',
    label: 'Component PRs',
    base: 270,
    baseAt: MEASURED_AT,
    perDay: 1.8,
    href: 'https://github.com/davila7/claude-code-templates/pulls?q=is%3Apr+is%3Amerged',
    title: 'Merged pull requests that added or improved a component',
  },
  {
    key: 'npmInstalls',
    label: 'npm Installs',
    base: 239282,
    baseAt: MEASURED_AT,
    perDay: 466,
    href: 'https://www.npmjs.com/package/claude-code-templates',
    title: 'Installs of the claude-code-templates package on npm',
  },
];

/**
 * Value of `stat` at instant `now` (ms since epoch).
 *
 * `floor` keeps it monotonic, and clamping at `base` means a visitor whose
 * clock is behind the measurement date still sees the seeded number rather
 * than a smaller one.
 */
export function statValueAt(stat: HomeStat, now: number): number {
  const msPerUnit = DAY_MS / stat.perDay;
  const elapsed = now - stat.baseAt;
  if (elapsed <= 0) return stat.base;
  return stat.base + Math.floor(elapsed / msPerUnit);
}

/** Milliseconds between two consecutive increments of `stat`. */
export function msPerUnit(stat: HomeStat): number {
  return DAY_MS / stat.perDay;
}
