import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SAMPLE_RATE,
  PRIVATE_SELECTOR,
  isExcludedPath,
  isSampled,
  parseSampleRate,
  posthogOptions,
  stripQuery,
} from '../src/lib/session-replay.ts';

function fakeSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  return store;
}

test('pages with account data are never recorded', () => {
  for (const p of ['/my-components', '/my-components/', '/certifications', '/github-callback', '/c/abc123']) {
    assert.equal(isExcludedPath(p), true, p);
  }
  for (const p of ['/', '/component/agents/x/y', '/trending', '/s/abc', '/collections', '/certificationsfoo/x']) {
    assert.equal(isExcludedPath(p), false, p);
  }
});

test('sample rate: default, clamped, junk falls back', () => {
  assert.equal(parseSampleRate(undefined), DEFAULT_SAMPLE_RATE);
  assert.equal(parseSampleRate(''), DEFAULT_SAMPLE_RATE);
  assert.equal(parseSampleRate('abc'), DEFAULT_SAMPLE_RATE);
  assert.equal(parseSampleRate('0.2'), 0.2);
  assert.equal(parseSampleRate('5'), 1);
  assert.equal(parseSampleRate('-1'), 0);
});

test('the draw happens once per tab and sticks', () => {
  fakeSessionStorage();
  assert.equal(isSampled(0.05, () => 0.01), true);
  assert.equal(isSampled(0.05, () => 0.99), true, 'second page of a sampled tab stays sampled');
  fakeSessionStorage();
  assert.equal(isSampled(0.05, () => 0.5), false);
  assert.equal(isSampled(0.05, () => 0.0), false, 'an unsampled tab stays unsampled');
});

test('blocked storage means no recording', () => {
  (globalThis as any).sessionStorage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(isSampled(1, () => 0), false);
});

test('query strings are dropped from URLs', () => {
  assert.equal(stripQuery('https://www.aitmpl.com/?q=secret#x'), 'https://www.aitmpl.com/');
  assert.equal(stripQuery('https://www.aitmpl.com/component/agents/a/b?ref=x'), 'https://www.aitmpl.com/component/agents/a/b');
  assert.equal(stripQuery('$direct'), '$direct');
  assert.equal(stripQuery(undefined), undefined);
});

test('options: no cookies, no profiles, no autocapture, inputs masked, private blocks out', () => {
  const o = posthogOptions('https://us.i.posthog.com');
  assert.equal(o.persistence, 'sessionStorage');
  assert.equal(o.person_profiles, 'never');
  assert.equal(o.autocapture, false);
  assert.equal(o.disable_external_dependency_loading, true);
  assert.equal(o.disable_surveys, true);
  assert.equal(o.session_recording.maskAllInputs, true);
  assert.equal(o.session_recording.blockSelector, PRIVATE_SELECTOR);
  assert.ok(PRIVATE_SELECTOR.includes('[data-private]'));
  const event = { properties: { $current_url: 'https://www.aitmpl.com/?q=x', $referrer: 'https://google.com/search?q=y', other: 1 } };
  o.before_send(event);
  assert.deepEqual(event.properties, { $current_url: 'https://www.aitmpl.com/', $referrer: 'https://google.com/search', other: 1 });
  assert.equal(o.before_send(null), null);
});
