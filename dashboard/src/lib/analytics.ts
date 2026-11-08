// GA4 custom events for aitmpl.com.
//
// Every event and parameter is declared here and described on /privacy. Values
// are limited to component types and paths, fixed sources and origins, counts
// and booleans. Never free text (search terms, collection names), never account
// data. cleanParams() drops anything else, so a wrong call cannot leak it.
// The names are a contract with the GA4 reports: do not rename them.
//
// DashboardLayout.astro defines gtag() inside an IIFE (Astro wraps define:vars
// scripts), so there is no window.gtag. track() pushes the same Arguments object
// gtag() pushes. Without PUBLIC_GA_MEASUREMENT_ID the snippet is not rendered,
// there is no dataLayer, and track() does nothing.

import { pluralType } from './component-url.ts';

export const SIGN_IN_ORIGINS = ['save', 'job', 'course', 'sidebar', 'collection'] as const;
export type SignInOrigin = (typeof SIGN_IN_ORIGINS)[number];

// Blocks of links to other components on a component page (initiative 4 of the
// traction plan). A link opts in with data-related="<block>" and its canonical
// href; see the analytics script at the end of pages/component/[type]/[...slug].astro.
export const RELATED_BLOCKS = ['same_category', 'loop', 'pair', 'referenced'] as const;
export type RelatedBlock = (typeof RELATED_BLOCKS)[number];

type ComponentRef = { component_type: string; component_path: string };

export interface EventParams {
  view_component: ComponentRef;
  copy_install_command: ComponentRef & { source: 'component_page' | 'featured' | 'related' };
  add_to_stack: ComponentRef & { source: 'component_page' | 'grid' | 'related' };
  copy_stack_command: { item_count: number; source: 'stack' | 'collection' };
  save_click: ComponentRef & { signed_in: boolean };
  sign_in_open: { origin: SignInOrigin };
  sign_in_complete: { origin: SignInOrigin };
  outbound_github: ComponentRef & { link: 'source' | 'commit' | 'pull_request' };
  related_click: ComponentRef & { block: RelatedBlock; target_type: string; target_path: string };
  search: { results_count: number; scope: 'modal' | 'grid'; component_type?: string };
}

export type EventName = keyof EventParams;

type Clean = Record<string, string | number | boolean>;

// A slug or path made of letters, digits, '.', '_', '/' and '-', up to GA4's
// 100-character limit for a parameter value.
const SAFE_STRING = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

export function cleanParams(params: Record<string, unknown>): Clean {
  const out: Clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' && SAFE_STRING.test(value)) out[key] = value;
  }
  return out;
}

// ('agent', 'development-team/frontend-developer.md') ->
// { component_type: 'agents', component_path: 'development-team/frontend-developer' },
// the same type and path as the component's URL (lib/component-url.ts).
export function componentRef(type: string, path: string): ComponentRef {
  const clean = String(path || '').replace(/\.(md|json)$/, '').replace(/^\/+|\/+$/g, '');
  return { component_type: pluralType(String(type || '')), component_path: clean };
}

export function isRelatedBlock(value: unknown): value is RelatedBlock {
  return typeof value === 'string' && (RELATED_BLOCKS as readonly string[]).includes(value);
}

// '/component/agents/development-team/frontend-developer' (relative or absolute)
// -> its type and path. Any other URL -> null.
export function componentRefFromUrl(href: string): ComponentRef | null {
  let pathname: string;
  try {
    pathname = new URL(href, 'https://www.aitmpl.com').pathname;
  } catch {
    return null;
  }
  const match = pathname.match(/^\/component\/([^/]+)\/(.+?)\/?$/);
  if (!match) return null;
  try {
    return componentRef(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
  } catch {
    return null; // malformed percent-encoding
  }
}

export function track<E extends EventName>(name: E, params: EventParams[E]): void {
  if (typeof window === 'undefined') return;
  const dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  if (!Array.isArray(dataLayer)) return;
  const clean = cleanParams(params as unknown as Record<string, unknown>);
  // gtag.js reads Arguments objects from dataLayer, not arrays.
  (function gtag(..._args: unknown[]) {
    dataLayer.push(arguments);
  })('event', name, clean);
}

// sign_in_complete needs to know where the sign-in started, across the OAuth
// redirect. The origin waits in sessionStorage (this tab only) for 30 minutes
// and is read once.
const PENDING_KEY = 'aitmpl-sign-in-origin';
const PENDING_TTL_MS = 30 * 60 * 1000;

function isOrigin(value: unknown): value is SignInOrigin {
  return typeof value === 'string' && (SIGN_IN_ORIGINS as readonly string[]).includes(value);
}

export function rememberSignInOrigin(origin: SignInOrigin, now = Date.now()): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ origin, at: now }));
  } catch { /* storage blocked: sign_in_complete is just not sent */ }
}

export function takeSignInOrigin(now = Date.now()): SignInOrigin | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
    if (raw !== null) sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const { origin, at } = JSON.parse(raw);
    if (!isOrigin(origin) || typeof at !== 'number') return null;
    if (now - at < 0 || now - at > PENDING_TTL_MS) return null;
    return origin;
  } catch {
    return null;
  }
}
