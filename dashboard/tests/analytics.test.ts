import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanParams,
  componentPath,
  componentRef,
  rememberSignInOrigin,
  takeSignInOrigin,
  track,
  typeKey,
} from '../src/lib/analytics.ts';

function fakeSessionStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    map,
  };
}

test('cleanParams keeps slugs, numbers and booleans and drops free text', () => {
  assert.deepEqual(
    cleanParams({
      component_type: 'agents',
      component_path: 'development-team/frontend-developer',
      results_count: 12,
      signed_in: false,
      query: 'how do I deploy my app?',
      email: 'someone@example.com',
      spaced: 'two words',
      empty: '',
      nan: Number.NaN,
      nested: { a: 1 },
      long: 'a'.repeat(101),
    }),
    { component_type: 'agents', component_path: 'development-team/frontend-developer', results_count: 12, signed_in: false },
  );
});

test('typeKey and componentPath match the site URLs', () => {
  assert.equal(typeKey('agent'), 'agents');
  assert.equal(typeKey('mcps'), 'mcps');
  assert.equal(componentPath('development-team/frontend-developer.md'), 'development-team/frontend-developer');
  assert.equal(componentPath('audio/elevenlabs.json'), 'audio/elevenlabs');
  assert.equal(componentPath('ai-maestro/agent-management'), 'ai-maestro/agent-management');
  assert.deepEqual(componentRef('hook', 'automation/agents-md-loader.json'), {
    component_type: 'hooks',
    component_path: 'automation/agents-md-loader',
  });
});

test('track pushes a gtag Arguments object and does nothing without dataLayer', () => {
  const g = globalThis as any;
  const saved = g.window;
  try {
    g.window = {};
    track('search', { results_count: 3, scope: 'modal' }); // no dataLayer: no throw, nothing sent

    g.window = { dataLayer: [] };
    track('copy_install_command', { ...componentRef('agent', 'a/b.md'), source: 'component_page' });
    const [entry] = g.window.dataLayer;
    assert.equal(Object.prototype.toString.call(entry), '[object Arguments]');
    assert.deepEqual(Array.from(entry), [
      'event',
      'copy_install_command',
      { component_type: 'agents', component_path: 'a/b', source: 'component_page' },
    ]);
  } finally {
    g.window = saved;
  }
});

test('the sign-in origin is read once and expires after 30 minutes', () => {
  const g = globalThis as any;
  const saved = g.sessionStorage;
  try {
    g.sessionStorage = fakeSessionStorage();
    const t0 = 1_800_000_000_000;

    rememberSignInOrigin('save', t0);
    assert.equal(takeSignInOrigin(t0 + 60_000), 'save');
    assert.equal(takeSignInOrigin(t0 + 60_000), null, 'read once');

    rememberSignInOrigin('job', t0);
    assert.equal(takeSignInOrigin(t0 + 31 * 60_000), null, 'expired');
    assert.equal(g.sessionStorage.map.size, 0, 'an expired origin is removed too');

    g.sessionStorage.setItem('aitmpl-sign-in-origin', JSON.stringify({ origin: 'admin', at: t0 }));
    assert.equal(takeSignInOrigin(t0), null, 'unknown origin');
    g.sessionStorage.setItem('aitmpl-sign-in-origin', '{not json');
    assert.equal(takeSignInOrigin(t0), null, 'bad JSON');

    g.sessionStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
    rememberSignInOrigin('course', t0); // must not throw
    assert.equal(takeSignInOrigin(t0), null);
  } finally {
    g.sessionStorage = saved;
  }
});
