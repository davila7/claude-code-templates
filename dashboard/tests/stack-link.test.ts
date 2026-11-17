import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STACK_ITEMS,
  cartToItems,
  decodeStack,
  encodeStack,
  normalizeItems,
  stackCommand,
} from '../src/lib/stack-link.ts';
import { resolveStackItems, saveStackAsCollection, stackCollectionName } from '../src/lib/save-stack.ts';
import { parsePendingAction } from '../src/lib/pending-action.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const b64 = (s: string) => Buffer.from(s, 'binary').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ITEMS = [
  { type: 'agents', path: 'development-team/frontend-developer.md' },
  { type: 'agents', path: 'development-team/backend-developer.md' },
  { type: 'skills', path: 'ai-maestro/agent-management' },
  { type: 'agents', path: 'expert-advisors/WinFormsExpert.md' },
  { type: 'mods', path: 'security/secret-redactor' },
  { type: 'settings', path: 'statusline/context-monitor.json' },
];

test('round trip keeps types, paths, order and the UTC day', () => {
  const code = encodeStack(ITEMS, NOW)!;
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'URL-safe, no padding');
  const stack = decodeStack(code, NOW)!;
  assert.equal(stack.created, '2026-11-09');
  assert.deepEqual(stack.items, [
    { type: 'agents', path: 'development-team/frontend-developer' },
    { type: 'agents', path: 'development-team/backend-developer' },
    { type: 'agents', path: 'expert-advisors/WinFormsExpert' },
    { type: 'skills', path: 'ai-maestro/agent-management' },
    { type: 'mods', path: 'security/secret-redactor' },
    { type: 'settings', path: 'statusline/context-monitor' },
  ]);
});

test('v1 text format is the documented one (shared categories are shortened)', () => {
  const code = encodeStack(ITEMS.slice(0, 2), NOW)!;
  assert.equal(Buffer.from(code, 'base64url').toString(), '1.g0u~adevelopment-team/frontend-developer,/backend-developer');
});

test('a v1 link written by hand (or by the CLI) decodes', () => {
  const stack = decodeStack(b64('1.g0u~adevelopment-team/frontend-developer,/backend-developer~kai-maestro/agent-management'), NOW)!;
  assert.equal(stack.items.length, 3);
  assert.deepEqual(stack.items[2], { type: 'skills', path: 'ai-maestro/agent-management' });
});

test('templates, unknown types, bad paths and duplicates are dropped', () => {
  assert.deepEqual(normalizeItems([
    { type: 'templates', path: 'frameworks/angular-app' },
    { type: 'sandbox', path: 'cloudflare/x' },
    { type: 'agents', path: '../etc/passwd' },
    { type: 'agents', path: 'a/b c' },
    { type: 'agents', path: 'a/b.md' },
    { type: 'agents', path: 'a/b' },
  ]), [{ type: 'agents', path: 'a/b' }]);
  assert.equal(encodeStack([{ type: 'templates', path: 'x/y' }], NOW), null, 'nothing left: no link');
});

test('broken, forged or oversized codes decode to null', () => {
  const bad = [
    '',
    'not base64!',
    b64('2.g0t~aa/b'), // unknown version
    b64('1.g0u'), // no items
    b64('1.g0u~za/b'), // unknown type letter
    b64('1.g0u~a/b'), // shortened path with nothing before it
    b64('1.g0u~aa/../b'),
    b64('1.zzzz~aa/b'), // from the future
    b64('1.a~aa/b'), // before the feature existed
    'A'.repeat(7000),
  ];
  for (const code of bad) assert.equal(decodeStack(code, NOW), null, code.slice(0, 40));
  const many = Array.from({ length: MAX_STACK_ITEMS + 1 }, (_, i) => `x/c${i}`).join(',');
  assert.equal(decodeStack(b64(`1.g0u~a${many}`), NOW), null, 'too many items');
});

test('encoding caps the list at MAX_STACK_ITEMS', () => {
  const items = Array.from({ length: MAX_STACK_ITEMS + 20 }, (_, i) => ({ type: 'skills', path: `cat/s${i}` }));
  assert.equal(decodeStack(encodeStack(items, NOW)!, NOW)!.items.length, MAX_STACK_ITEMS);
});

test('one install command, grouped by type in the order types first appear', () => {
  const stack = decodeStack(encodeStack(ITEMS, NOW)!, NOW)!;
  assert.equal(
    stackCommand(stack.items),
    'npx claude-code-templates@latest --agent development-team/frontend-developer,development-team/backend-developer,expert-advisors/WinFormsExpert --skill ai-maestro/agent-management --mod security/secret-redactor --setting statusline/context-monitor',
  );
});

test('cartToItems reads the localStorage cart and skips retired templates', () => {
  const cart = {
    agents: [{ path: 'development-team/frontend-developer.md', name: 'frontend-developer' }],
    templates: [{ path: 'frameworks/angular-app' }],
    mcps: [],
    'function-hooks': [{ path: 'security/secret-redactor' }],
  };
  assert.deepEqual(cartToItems(cart), [{ type: 'agents', path: 'development-team/frontend-developer' }]);
});

test('save-stack is a valid pending action; garbage is not', () => {
  const code = encodeStack(ITEMS, NOW)!;
  assert.deepEqual(parsePendingAction({ kind: 'save-stack', code }), { kind: 'save-stack', code });
  assert.equal(parsePendingAction({ kind: 'save-stack', code: 'a b' }), null);
  assert.equal(parsePendingAction({ kind: 'save-stack', code: 'A'.repeat(6001) }), null);
});

const CATALOG: Record<string, Array<{ type: string; name: string; path: string; category: string }>> = {
  agents: [
    { type: 'agent', name: 'frontend-developer', path: 'development-team/frontend-developer.md', category: 'development-team' },
  ],
  skills: [{ type: 'skill', name: 'agent-management', path: 'ai-maestro/agent-management', category: 'ai-maestro' }],
};
const fetchByType = async (t: string) => CATALOG[t] ?? [];

test('resolveStackItems marks components that left the catalog', async () => {
  const stack = decodeStack(encodeStack(ITEMS, NOW)!, NOW)!;
  const resolved = await resolveStackItems(stack.items, fetchByType);
  assert.deepEqual(resolved.map((r) => !!r.entry), [true, false, false, true, false, false]);
});

test('saveStackAsCollection creates one collection and adds catalog entries one by one', async () => {
  const calls: string[] = [];
  const api = {
    create: async (_t: string, name: string) => { calls.push(`create ${name}`); return { id: 'c1', name } as any; },
    addItem: async (_t: string, id: string, item: { type: string; path: string; name: string }) => {
      calls.push(`add ${id} ${item.type} ${item.path}`);
      if (item.name === 'agent-management') throw new Error('boom');
      return { id: `i-${item.name}` } as any;
    },
  };
  const stack = decodeStack(encodeStack(ITEMS, NOW)!, NOW)!;
  const result = await saveStackAsCollection(api, 'tok', stack, fetchByType);
  assert.deepEqual(calls, [
    `create ${stackCollectionName('2026-11-09')}`,
    'add c1 agent development-team/frontend-developer.md',
    'add c1 skill ai-maestro/agent-management',
  ]);
  assert.deepEqual({ saved: result.saved, missing: result.missing, failed: result.failed }, { saved: 1, missing: 4, failed: 1 });
});

test('saveStackAsCollection creates nothing when no component is left', async () => {
  let created = false;
  const api = { create: async () => { created = true; return {} as any; }, addItem: async () => ({}) as any };
  const stack = decodeStack(encodeStack([{ type: 'hooks', path: 'x/gone' }], NOW)!, NOW)!;
  await assert.rejects(saveStackAsCollection(api, 'tok', stack, fetchByType));
  assert.equal(created, false);
});
