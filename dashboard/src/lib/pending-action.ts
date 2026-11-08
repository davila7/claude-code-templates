// The action a signed-out visitor started before the sign-in modal opened:
// saving a component, opening a job or opening a course. It is kept in this
// tab's sessionStorage (never sent anywhere) and completed once the visitor is
// signed in, after an OAuth round trip or in place after email sign-in.
//
// take() removes the entry before it is acted on, so a reload, a second
// listener or a second tab can never run it twice.

export type PendingAction =
  | { kind: 'save'; type: string; path: string; name: string; category?: string }
  | { kind: 'open-link'; source: 'job' | 'course'; title: string; url: string };

export const PENDING_ACTION_KEY = 'aitmpl:pending-action';
// Long enough for a GitHub/Google round trip or creating an account by email.
export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null; // blocked storage (some private modes, sandboxed frames)
  }
}

const str = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

function isHttpsUrl(v: unknown): v is string {
  if (!str(v, 2048)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

// Validates what comes back from storage: anything else in the tab can write it.
export function parsePendingAction(v: unknown): PendingAction | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (a.kind === 'save') {
    if (!str(a.type, 40) || !str(a.path, 300) || !str(a.name, 200)) return null;
    if (a.category !== undefined && !str(a.category, 100)) return null;
    return { kind: 'save', type: a.type, path: a.path, name: a.name, ...(a.category ? { category: a.category as string } : {}) };
  }
  if (a.kind === 'open-link') {
    if ((a.source !== 'job' && a.source !== 'course') || !str(a.title, 300) || !isHttpsUrl(a.url)) return null;
    return { kind: 'open-link', source: a.source, title: a.title, url: a.url };
  }
  return null;
}

export function setPendingAction(action: PendingAction, store = sessionStore(), now = Date.now()): void {
  try {
    store?.setItem(PENDING_ACTION_KEY, JSON.stringify({ ...action, at: now }));
  } catch {
    /* quota or blocked: the visitor just repeats the click after signing in */
  }
}

export function clearPendingAction(store = sessionStore()): void {
  try {
    store?.removeItem(PENDING_ACTION_KEY);
  } catch {
    /* ignore */
  }
}

export function takePendingAction(store = sessionStore(), now = Date.now()): PendingAction | null {
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(PENDING_ACTION_KEY);
    if (raw !== null) store.removeItem(PENDING_ACTION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const at = typeof parsed?.at === 'number' ? parsed.at : NaN;
    if (!(now - at >= 0 && now - at <= PENDING_ACTION_TTL_MS)) return null;
    return parsePendingAction(parsed);
  } catch {
    return null;
  }
}
