// Form-mode elicitation for search_components: when a search matches more
// components than it returns and they span several types or categories, the
// server asks the user to narrow it (protocol revision 2026-07-28,
// multi-round-trip `input_required`). The answer only filters the pool; the
// order is still text match, then id (see catalog.ts).
//
// The worker is stateless, so the 2025 push-style `elicitation/create` is not
// available (the legacy lane of createMcpHandler refuses server-to-client
// requests). The 2026-07-28 flow needs no state: the client retries the same
// tools/call with `inputResponses`, and the presence of our key there is how a
// retry is told apart from a first call. Clients on older revisions, or that
// do not declare form elicitation, never get asked.

import { CLIENT_CAPABILITIES_META_KEY, acceptedContent, inputRequired, inputResponse } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { TYPES, search, type Catalog, type ComponentType } from './catalog';

export const NARROW_KEY = 'narrow_search';
const MAX_CATEGORY_OPTIONS = 15;

/** The slice of the tool handler context this module reads. */
export interface NarrowContext {
  mcpReq: { envelope?: Record<string, unknown>; inputResponses?: Record<string, unknown> };
}

export interface SearchArgs { query: string; type?: ComponentType; category?: string; limit: number }

/** Form mode is allowed when the request declares `elicitation.form`, or a bare `elicitation: {}` (form only). */
export function canElicitForm(ctx: NarrowContext): boolean {
  const caps = ctx.mcpReq.envelope?.[CLIENT_CAPABILITIES_META_KEY] as { elicitation?: Record<string, unknown> } | undefined;
  const e = caps?.elicitation;
  if (!e || typeof e !== 'object') return false;
  return e.form !== undefined || e.url === undefined;
}

interface Facet { value: string; count: number }

function countBy(values: string[]): Facet[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  // Options are sorted by how many matches they hold, then by name; the components themselves are never reordered.
  return [...counts].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Types and categories of every match (not only the returned page), for the form's options. */
export function facets(catalog: Catalog, args: SearchArgs) {
  const all = search(catalog, { ...args, limit: catalog.components.length });
  return {
    total: all.total,
    types: countBy(all.results.map((c) => c.type)),
    categories: countBy(all.results.map((c) => c.category)),
  };
}

const answerSchema = z.object({
  type: z.enum(TYPES).optional(),
  category: z.string().trim().min(1).max(80).optional(),
});

export type NarrowOutcome =
  | { kind: 'ask'; result: ReturnType<typeof inputRequired> }
  | { kind: 'search'; args: SearchArgs; note: string | null };

/**
 * Decide whether to ask, and fold the user's answer into the search arguments.
 * Never throws for a client answer: anything unusable means "search as asked".
 */
export function narrowSearch(catalog: Catalog, args: SearchArgs, ctx: NarrowContext): NarrowOutcome {
  const view = inputResponse(ctx.mcpReq.inputResponses, NARROW_KEY);
  if (view.kind !== 'missing') {
    const picked = acceptedContent(ctx.mcpReq.inputResponses, NARROW_KEY, answerSchema);
    // Only fields the caller left open are taken from the answer.
    const type = !args.type ? picked?.type : undefined;
    const category = !args.category ? picked?.category : undefined;
    if (!type && !category) {
      return { kind: 'search', args, note: 'The user was asked to narrow the search and left it as is.' };
    }
    const parts = [type ? `type "${type}"` : '', category ? `category "${category}"` : ''].filter(Boolean).join(' and ');
    return { kind: 'search', args: { ...args, type: args.type ?? type, category: args.category ?? category }, note: `Narrowed by the user to ${parts}.` };
  }

  if ((args.type && args.category) || !canElicitForm(ctx)) return { kind: 'search', args, note: null };

  const f = facets(catalog, args);
  if (f.total <= args.limit) return { kind: 'search', args, note: null };
  const askType = !args.type && f.types.length > 1;
  const askCategory = !args.category && f.categories.length > 1;
  if (!askType && !askCategory) return { kind: 'search', args, note: null };

  const properties: Record<string, unknown> = {};
  if (askType) {
    properties.type = {
      type: 'string',
      title: 'Component type',
      description: 'Leave empty for every type.',
      oneOf: f.types.map((t) => ({ const: t.value, title: `${t.value} (${t.count})` })),
    };
  }
  if (askCategory) {
    const shown = f.categories.slice(0, MAX_CATEGORY_OPTIONS);
    properties.category = {
      type: 'string',
      title: 'Category',
      description: f.categories.length > shown.length
        ? `The ${shown.length} categories with the most matches, of ${f.categories.length}. Leave empty for every category.`
        : 'Leave empty for every category.',
      oneOf: shown.map((c) => ({ const: c.value, title: `${c.value} (${c.count})` })),
    };
  }
  const what = askType && askCategory ? 'a type or a category' : askType ? 'a type' : 'a category';
  return {
    kind: 'ask',
    result: inputRequired({
      inputRequests: {
        [NARROW_KEY]: inputRequired.elicit({
          message: `"${args.query}" matches ${f.total} components on aitmpl.com. Pick ${what} to narrow the search, or submit empty to see the best text matches of all of them.`,
          requestedSchema: { type: 'object', properties } as never,
        }),
      },
    }),
  };
}
