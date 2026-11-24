import { describe, expect, it } from 'vitest';
import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { buildCatalog, search } from '../src/catalog';
import { NARROW_KEY, canElicitForm, narrowSearch } from '../src/narrow';

const v1 = (type: string, category: string, name: string) => ({
  id: `${type}/${category}/${name}`, type, name, category, path: `${category}/${name}`,
  description: `${name} review helper`, author: null, license: null, keywords: [], downloads: 0,
  install: { command: '', args: [] }, urls: { page: '', source: null, content: '' }, scan: null, source: null,
});

const catalog = buildCatalog('sha', null, [
  v1('agents', 'dev', 'a-review'), v1('agents', 'dev', 'b-review'), v1('agents', 'security', 'c-review'),
  v1('commands', 'utilities', 'd-review'), v1('hooks', 'git', 'e-review'),
] as never, []);

const ctx = (elicitation?: Record<string, unknown>, inputResponses?: Record<string, unknown>) => ({
  mcpReq: { envelope: elicitation ? { [CLIENT_CAPABILITIES_META_KEY]: { elicitation } } : undefined, inputResponses },
});
const args = { query: 'review', limit: 2 };

describe('canElicitForm', () => {
  it('accepts form or a bare declaration, refuses url-only, missing or legacy', () => {
    expect(canElicitForm(ctx({ form: {}, url: {} }))).toBe(true);
    expect(canElicitForm(ctx({}))).toBe(true);
    expect(canElicitForm(ctx({ url: {} }))).toBe(false);
    expect(canElicitForm(ctx())).toBe(false);
    expect(canElicitForm({ mcpReq: {} })).toBe(false);
  });
});

describe('narrowSearch', () => {
  it('asks only when the search is broad and spans several types or categories', () => {
    const asked = narrowSearch(catalog, args, ctx({}));
    expect(asked.kind).toBe('ask');
    const req = (asked as { result: { inputRequests: Record<string, { params: { requestedSchema: { properties: Record<string, { oneOf: Array<{ const: string }> }> } } }> } }).result.inputRequests[NARROW_KEY];
    expect(req.params.requestedSchema.properties.type.oneOf.map((o) => o.const)).toEqual(['agents', 'commands', 'hooks']);
    expect(req.params.requestedSchema.properties.category.oneOf[0].const).toBe('dev');
    expect(narrowSearch(catalog, { ...args, limit: 10 }, ctx({})).kind).toBe('search');
    expect(narrowSearch(catalog, { ...args, type: 'agents', category: 'dev' }, ctx({})).kind).toBe('search');
    expect(narrowSearch(catalog, args, ctx())).toEqual({ kind: 'search', args, note: null });
  });

  it('filters by the accepted answer without changing the order', () => {
    const out = narrowSearch(catalog, args, ctx({}, { [NARROW_KEY]: { action: 'accept', content: { type: 'agents' } } }));
    expect(out).toMatchObject({ kind: 'search', args: { type: 'agents' }, note: 'Narrowed by the user to type "agents".' });
    const ids = search(catalog, (out as { args: typeof args }).args).results.map((c) => c.id);
    expect(ids).toEqual(search(catalog, { ...args, type: 'agents' }).results.map((c) => c.id));
  });

  it('never asks twice and ignores declined, invalid or redundant answers', () => {
    for (const response of [{ action: 'decline' }, { action: 'cancel' }, { action: 'accept', content: { type: 'nope' } }, { action: 'accept', content: {} }]) {
      const out = narrowSearch(catalog, args, ctx({}, { [NARROW_KEY]: response }));
      expect(out).toEqual({ kind: 'search', args, note: 'The user was asked to narrow the search and left it as is.' });
    }
    const redundant = narrowSearch(catalog, { ...args, type: 'agents' as const }, ctx({}, { [NARROW_KEY]: { action: 'accept', content: { type: 'hooks' } } }));
    expect(redundant).toMatchObject({ kind: 'search', args: { type: 'agents' } });
  });
});
