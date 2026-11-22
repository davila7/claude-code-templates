// Session replay for aitmpl.com (PostHog Cloud), to see where visitors get
// stuck: what they click before leaving a component page, rage clicks, a
// search that leads nowhere. GA4 (lib/analytics.ts) stays the source of the
// numbers; this only answers "why".
//
// Off unless PUBLIC_POSTHOG_KEY is set at build time. When it is set:
// - Only a sample of tabs loads anything (PUBLIC_POSTHOG_SAMPLE_RATE, default
//   5%). The other tabs download no SDK and send nothing. The draw is kept in
//   sessionStorage so a sampled tab stays sampled across page loads.
// - Pages with account data (REPLAY_EXCLUDED_PATHS) are never recorded.
// - Every input is masked, and [data-private] elements (the account menu, the
//   Send to repo modal, Clerk's sign-in and profile windows) are left out of
//   the recording, replaced by an empty box.
// - No cookies, no person profiles, no identify(), no autocapture, no
//   surveys, no external scripts (the no-external bundle plus the recorder are
//   ours, served from this origin).
// Described on /privacy, which shows its paragraph only when the key is set.

export const DEFAULT_SAMPLE_RATE = 0.05;
export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

// Signed-in pages and pages that show account data.
export const REPLAY_EXCLUDED_PATHS: RegExp[] = [
  /^\/my-components(\/|$)/,
  /^\/certifications(\/|$)/,
  /^\/github-callback(\/|$)/,
  /^\/c\//, // shared collections show their owner's name
];

// Left out of recordings entirely (rrweb blockSelector). .cl-* are Clerk's
// sign-in, user button and profile windows.
export const PRIVATE_SELECTOR =
  '[data-private], .cl-rootBox, .cl-modalBackdrop, .cl-userButtonPopoverCard, .cl-userProfile-root';

const SAMPLE_KEY = 'aitmpl-replay-sampled';

export function isExcludedPath(pathname: string): boolean {
  return REPLAY_EXCLUDED_PATHS.some((re) => re.test(pathname));
}

export function parseSampleRate(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_SAMPLE_RATE;
  return Math.min(1, Math.max(0, n));
}

// Draws once per tab. Storage blocked => not sampled (record nothing).
export function isSampled(rate: number, random: () => number = Math.random): boolean {
  try {
    const stored = sessionStorage.getItem(SAMPLE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    const sampled = random() < rate;
    sessionStorage.setItem(SAMPLE_KEY, sampled ? '1' : '0');
    return sampled;
  } catch {
    return false;
  }
}

// Only the URL path is kept: query strings can carry a search term.
export function stripQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

export function posthogOptions(apiHost: string) {
  return {
    api_host: apiHost,
    persistence: 'sessionStorage' as const,
    person_profiles: 'never' as const,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: false,
    rageclick: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    capture_performance: false,
    session_recording: {
      maskAllInputs: true,
      blockSelector: PRIVATE_SELECTOR,
      maskTextSelector: PRIVATE_SELECTOR,
    },
    before_send: (event: { properties?: Record<string, unknown> } | null) => {
      if (event?.properties) {
        for (const key of ['$current_url', '$referrer', '$initial_current_url']) {
          if (key in event.properties) event.properties[key] = stripQuery(event.properties[key]);
        }
      }
      return event;
    },
  };
}

export async function initSessionReplay(env: {
  key?: string;
  host?: string;
  sampleRate?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || !env.key) return;
  if (isExcludedPath(window.location.pathname)) return;
  if (!isSampled(parseSampleRate(env.sampleRate))) return;

  const [{ default: posthog }] = await Promise.all([
    import('posthog-js/no-external'),
    import('posthog-js/dist/recorder'),
  ]);
  posthog.init(env.key, posthogOptions(env.host || DEFAULT_POSTHOG_HOST));
}
