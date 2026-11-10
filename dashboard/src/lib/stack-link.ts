// "My stack" links: /s/<code> (traction plan, initiative 9).
//
// No account and no database: the code itself carries the list of components
// and the day the link was made. Anyone can decode it, so it holds nothing but
// component types and paths that are public in the catalog anyway.
//
// Format v1 (keep it stable: links live forever in chats, READMEs and the CLI):
//
//   code  = base64url(text), no padding
//   text  = "1." + <UTC day number since 1970-01-01, base 36> + ("~" + group)*
//   group = <type letter> + <path> ("," <path>)*
//   path  = component path without .md/.json; a path that starts with "/"
//           reuses the category (first segment) of the path before it
//
// Type letters: a agents, c commands, s settings, h hooks, m mcps, k skills,
// l loops, o mods. Groups and items keep the order they were added in; the
// page never reorders them (never by downloads).
//
// Example: ["agents", "development-team/frontend-developer"] and
// ["agents", "development-team/backend-developer"] created on 2026-11-09 ->
// "1.g0u~adevelopment-team/frontend-developer,/backend-developer".
//
// Retired templates and anything that is not one of the eight types are left
// out. A future format gets a new leading version ("2."); v1 links must keep
// decoding.

export const STACK_TYPES = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'skills', 'loops', 'mods'] as const;
export type StackType = (typeof STACK_TYPES)[number];

const TYPE_LETTER: Record<StackType, string> = {
  agents: 'a', commands: 'c', settings: 's', hooks: 'h', mcps: 'm', skills: 'k', loops: 'l', mods: 'o',
};
const LETTER_TYPE: Record<string, StackType> = Object.fromEntries(
  Object.entries(TYPE_LETTER).map(([t, l]) => [l, t as StackType]),
);

export const STACK_FLAGS: Record<StackType, string> = {
  agents: '--agent', commands: '--command', settings: '--setting', hooks: '--hook',
  mcps: '--mcp', skills: '--skill', loops: '--loop', mods: '--mod',
};

export interface StackItem { type: StackType; path: string }
export interface Stack { items: StackItem[]; created: string /* YYYY-MM-DD, UTC */ }

// Bounds for what a link may hold. A cart rarely has more than a dozen items;
// the limits only stop a crafted link from making the page do silly work.
export const MAX_STACK_ITEMS = 100;
export const MAX_CODE_LENGTH = 6000;
const MAX_PATH_LENGTH = 200;
const PATH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const DAY_MS = 24 * 60 * 60 * 1000;
// Links made before the feature existed cannot be real.
const FIRST_DAY = Date.UTC(2026, 10, 1) / DAY_MS;

export function isStackType(v: unknown): v is StackType {
  return typeof v === 'string' && (STACK_TYPES as readonly string[]).includes(v);
}

export function cleanStackPath(path: string): string {
  return String(path ?? '').replace(/\.(md|json)$/, '').replace(/^\/+|\/+$/g, '');
}

export function isValidStackPath(path: string): boolean {
  return path.length > 0 && path.length <= MAX_PATH_LENGTH && PATH_RE.test(path) && !path.split('/').includes('..');
}

// Valid, de-duplicated items in their original order, at most MAX_STACK_ITEMS.
export function normalizeItems(items: Array<{ type: string; path: string }>): StackItem[] {
  const seen = new Set<string>();
  const out: StackItem[] = [];
  for (const raw of items) {
    if (!isStackType(raw?.type)) continue;
    const path = cleanStackPath(raw.path);
    if (!isValidStackPath(path)) continue;
    const key = `${raw.type}:${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: raw.type, path });
    if (out.length >= MAX_STACK_ITEMS) break;
  }
  return out;
}

// Items grouped by type in the order each type first appears, items in their own order.
export function groupItems(items: StackItem[]): Array<{ type: StackType; paths: string[] }> {
  const groups = new Map<StackType, string[]>();
  for (const { type, path } of items) {
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(path);
  }
  return [...groups].map(([type, paths]) => ({ type, paths }));
}

function category(path: string): string {
  const i = path.indexOf('/');
  return i > 0 ? path.slice(0, i) : '';
}

function toBase64Url(text: string): string {
  const b64 = typeof btoa === 'function' ? btoa(text) : Buffer.from(text, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    return typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  } catch {
    return null;
  }
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function encodeStack(items: Array<{ type: string; path: string }>, now: Date = new Date()): string | null {
  const clean = normalizeItems(items);
  if (clean.length === 0) return null;
  const day = Math.floor(now.getTime() / DAY_MS);
  let text = `1.${day.toString(36)}`;
  for (const { type, paths } of groupItems(clean)) {
    let prev = '';
    const parts = paths.map((p) => {
      const cat = category(p);
      const short = cat && cat === category(prev) ? p.slice(cat.length) : p;
      prev = p;
      return short;
    });
    text += `~${TYPE_LETTER[type]}${parts.join(',')}`;
  }
  return toBase64Url(text);
}

export function decodeStack(code: string, now: Date = new Date()): Stack | null {
  if (typeof code !== 'string' || code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
  const text = fromBase64Url(code);
  if (!text) return null;
  const [head, ...groups] = text.split('~');
  const m = /^1\.([0-9a-z]{1,6})$/.exec(head ?? '');
  if (!m) return null;
  const day = parseInt(m[1], 36);
  // A day from the future (allowing for clock skew) or before the feature: not a real link.
  if (!(day >= FIRST_DAY && day <= Math.floor(now.getTime() / DAY_MS) + 2)) return null;

  const items: StackItem[] = [];
  for (const group of groups) {
    const type = LETTER_TYPE[group.charAt(0)];
    if (!type) return null;
    let prev = '';
    for (const part of group.slice(1).split(',')) {
      let path = part;
      if (part.startsWith('/')) {
        const cat = category(prev);
        if (!cat) return null;
        path = cat + part;
      }
      if (!isValidStackPath(path)) return null;
      items.push({ type, path });
      prev = path;
      if (items.length > MAX_STACK_ITEMS) return null;
    }
  }
  const clean = normalizeItems(items);
  if (clean.length === 0) return null;
  return { items: clean, created: utcDay(new Date(day * DAY_MS)) };
}

export function stackPath(code: string): string {
  return `/s/${code}`;
}

// One command that installs every item, in the stack's order.
export function stackCommand(items: StackItem[]): string {
  let cmd = 'npx claude-code-templates@latest';
  for (const { type, paths } of groupItems(items)) cmd += ` ${STACK_FLAGS[type]} ${paths.join(',')}`;
  return cmd;
}

// The site's cart (localStorage 'claudeCodeCart': { agents: [{ path, ... }], ... }) as stack items.
export function cartToItems(cart: Record<string, Array<{ path?: string }> | undefined>): StackItem[] {
  const items: Array<{ type: string; path: string }> = [];
  for (const [type, list] of Object.entries(cart ?? {})) {
    if (!Array.isArray(list)) continue;
    for (const item of list) if (item?.path) items.push({ type, path: item.path });
  }
  return normalizeItems(items);
}

// 'agents' -> 'agent': the collections API stores the catalog's singular type.
export function singularType(type: StackType): string {
  return type.replace(/s$/, '');
}

