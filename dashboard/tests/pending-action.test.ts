import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_ACTION_KEY,
  PENDING_ACTION_TTL_MS,
  clearPendingAction,
  parsePendingAction,
  setPendingAction,
  takePendingAction,
} from '../src/lib/pending-action.ts';
import { FIRST_COLLECTION_NAME, myComponentsUrl, saveComponent, type CollectionsClient } from '../src/lib/save-component.ts';

function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

const save = { kind: 'save', type: 'agents', path: 'development-team/frontend-developer', name: 'frontend-developer', category: 'development-team' } as const;
const job = { kind: 'open-link', source: 'job', title: 'Engineer at Acme', url: 'https://jobs.example.com/1' } as const;

test('take returns the action once, then nothing', () => {
  const s = memoryStore();
  setPendingAction(save, s, 1000);
  assert.deepEqual(takePendingAction(s, 2000), save);
  assert.equal(takePendingAction(s, 2001), null);
  assert.equal(s.raw.size, 0);
});

test('an expired action is dropped', () => {
  const s = memoryStore();
  setPendingAction(job, s, 0);
  assert.equal(takePendingAction(s, PENDING_ACTION_TTL_MS + 1), null);
  assert.equal(s.raw.size, 0);
});

test('a new action replaces the old one and clear drops it', () => {
  const s = memoryStore();
  setPendingAction(save, s, 0);
  setPendingAction(job, s, 0);
  assert.deepEqual(takePendingAction(s, 1), job);
  setPendingAction(save, s, 0);
  clearPendingAction(s);
  assert.equal(takePendingAction(s, 1), null);
});

test('tampered or malformed entries are refused', () => {
  const s = memoryStore();
  for (const bad of [
    'not json',
    JSON.stringify({ ...job, url: 'javascript:alert(1)', at: 0 }),
    JSON.stringify({ ...job, url: 'http://insecure.example.com', at: 0 }),
    JSON.stringify({ ...job, source: 'ad', at: 0 }),
    JSON.stringify({ ...save, path: '', at: 0 }),
    JSON.stringify({ kind: 'delete-account', at: 0 }),
    JSON.stringify({ ...save }), // no timestamp
  ]) {
    s.setItem(PENDING_ACTION_KEY, bad);
    assert.equal(takePendingAction(s, 1), null, bad);
  }
  assert.equal(parsePendingAction({ ...save, extra: 'x' })?.kind, 'save');
  assert.equal('extra' in (parsePendingAction({ ...save, extra: 'x' }) as object), false);
});

test('blocked storage never throws', () => {
  const broken = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => setPendingAction(save, broken));
  assert.equal(takePendingAction(broken), null);
  assert.equal(takePendingAction(null), null);
});

function fakeApi(initial: any[]) {
  const calls: string[] = [];
  const cols = initial.map((c) => ({ ...c, collection_items: [...c.collection_items] }));
  const api: CollectionsClient = {
    async list() { calls.push('list'); return cols; },
    async create(_t, name) { calls.push(`create:${name}`); const c: any = { id: 'new', name, collection_items: [] }; cols.push(c); return c; },
    async addItem(_t, id, item) { calls.push(`add:${id}:${item.path}`); return { id: 'i', collection_id: id, component_type: item.type, component_path: item.path } as any; },
  };
  return { api, calls };
}

const item = { type: 'agents', path: 'development-team/frontend-developer', name: 'frontend-developer' };

test('first save creates "My components" with the item', async () => {
  const { api, calls } = fakeApi([]);
  const r = await saveComponent(api, 't', item);
  assert.equal(r.status, 'first');
  assert.equal(r.collection.name, FIRST_COLLECTION_NAME);
  assert.deepEqual(calls, ['list', `create:${FIRST_COLLECTION_NAME}`, `add:new:${item.path}`]);
  assert.equal(myComponentsUrl(r.collection.id), '/my-components?collection=new');
});

test('later saves add to the first collection, never twice', async () => {
  const saved = { id: 'b', name: 'B', collection_items: [{ component_type: item.type, component_path: item.path }] };
  const a = { id: 'a', name: 'A', collection_items: [] };

  const one = fakeApi([a]);
  assert.equal((await saveComponent(one.api, 't', item)).status, 'added');
  assert.deepEqual(one.calls, ['list', `add:a:${item.path}`]);

  const two = fakeApi([a, saved]);
  const r = await saveComponent(two.api, 't', item);
  assert.equal(r.status, 'already');
  assert.equal(r.collection.id, 'b');
  assert.deepEqual(two.calls, ['list']);
});

test('dropExpiredPendingAction keeps a live entry and deletes an old one', async () => {
  const { dropExpiredPendingAction } = await import('../src/lib/pending-action.ts');
  const s = memoryStore();
  setPendingAction(save, s, 0);
  dropExpiredPendingAction(s, 1000);
  assert.equal(s.raw.size, 1);
  dropExpiredPendingAction(s, PENDING_ACTION_TTL_MS + 1);
  assert.equal(s.raw.size, 0);
  s.setItem(PENDING_ACTION_KEY, 'garbage');
  dropExpiredPendingAction(s, 0);
  assert.equal(s.raw.size, 0);
});

test('concurrent first saves create one collection', async () => {
  const { api, calls } = fakeApi([]);
  const other = { type: 'agents', path: 'x/other', name: 'other' };
  const [a, b] = await Promise.all([saveComponent(api, 't', item, []), saveComponent(api, 't', other, [])]);
  assert.equal(a.status, 'first');
  assert.equal(b.status, 'added');
  assert.equal(calls.filter((c) => c.startsWith('create:')).length, 1);
});
