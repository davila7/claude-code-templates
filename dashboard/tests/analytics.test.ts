import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanParams,
  componentRef,
  componentRefFromUrl,
  isRelatedBlock,
  rememberSignInOrigin,
  takeSignInOrigin,
  track,
} from '../src/lib/analytics.ts';
import { componentPath } from '../src/lib/component-url.ts';

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

test('componentRef gives the type and path of the component URL', () => {
  const cases: Array<[string, string]> = [
    ['agent', 'development-team/frontend-developer.md'],
    ['mcps', 'audio/elevenlabs.json'],
    ['skill', 'ai-maestro/agent-management'],
    ['hook', 'automation/agents-md-loader.json'],
  ];
  for (const [type, path] of cases) {
    const ref = componentRef(type, path);
    assert.equal(`/component/${ref.component_type}/${ref.component_path}`, componentPath(type, path));
  }
  assert.deepEqual(componentRef('hook', 'automation/agents-md-loader.json'), {
    component_type: 'hooks',
    component_path: 'automation/agents-md-loader',
  });
});

test('componentRefFromUrl reads a component URL and nothing else', () => {
  const ref = { component_type: 'hooks', component_path: 'automation/agents-md-loader' };
  assert.deepEqual(componentRefFromUrl('/component/hooks/automation/agents-md-loader'), ref);
  assert.deepEqual(componentRefFromUrl('/component/hooks/automation/agents-md-loader/'), ref);
  assert.deepEqual(componentRefFromUrl('https://www.aitmpl.com/component/hooks/automation/agents-md-loader?x=1#files'), ref);
  assert.deepEqual(componentRefFromUrl(`https://www.aitmpl.com${componentPath('hook', 'automation/agents-md-loader.json')}`), ref);
  assert.equal(componentRefFromUrl('/skills'), null);
  assert.equal(componentRefFromUrl('/component/hooks'), null);
  assert.equal(componentRefFromUrl('https://github.com/davila7/claude-code-templates'), null);
  assert.equal(componentRefFromUrl('/component/hooks/%E0%A4%A'), null);
});

test('isRelatedBlock accepts the declared blocks only', () => {
  for (const b of ['same_category', 'loop', 'pair', 'referenced']) assert.equal(isRelatedBlock(b), true);
  for (const b of ['', 'grid', 'Same_category', undefined, 3]) assert.equal(isRelatedBlock(b), false);
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
