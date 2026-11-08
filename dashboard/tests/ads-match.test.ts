import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSponsored, matchesAd } from '../src/lib/ads-match.ts';

const ad = (component_type: string, component_path: string) => ({
  component_type, component_path, component_name: component_path, ends_at: '2099-01-01T00:00:00Z',
});

const organic = [
  { type: 'skill', path: 'dev/first' },
  { type: 'skill', path: 'dev/second' },
  { type: 'skill', path: 'dev/promoted' },
  { type: 'skill', path: 'dev/fourth' },
];

test('matchesAd: plural ad type matches singular or plural component type', () => {
  assert.equal(matchesAd(ad('skills', 'dev/promoted'), 'skill', 'dev/promoted'), true);
  assert.equal(matchesAd(ad('skills', 'dev/promoted'), 'skills', 'dev/promoted'), true);
  assert.equal(matchesAd(ad('agents', 'dev/promoted'), 'skill', 'dev/promoted'), false);
  assert.equal(matchesAd(ad('skills', 'dev/other'), 'skill', 'dev/promoted'), false);
});

test('findSponsored: returns the matching item and leaves the organic list untouched', () => {
  const before = organic.map((c) => c.path);
  const match = findSponsored([ad('skills', 'dev/promoted')], organic);
  assert.equal(match?.path, 'dev/promoted');
  assert.deepEqual(organic.map((c) => c.path), before);
});

test('findSponsored: no match when the component is filtered out, or no ads', () => {
  assert.equal(findSponsored([ad('skills', 'dev/elsewhere')], organic), null);
  assert.equal(findSponsored([], organic), null);
});

test('findSponsored: earliest ad (endpoint order) wins', () => {
  const match = findSponsored([ad('skills', 'dev/fourth'), ad('skills', 'dev/first')], organic);
  assert.equal(match?.path, 'dev/fourth');
});

test('sponsored slot composition keeps every organic position (the invariant the grid and Cmd+K rely on)', () => {
  const match = findSponsored([ad('skills', 'dev/promoted')], organic);
  const shown = match ? [{ ...match, sponsored: true }, ...organic] : organic;
  assert.equal(shown.length, organic.length + 1);
  assert.deepEqual(shown.slice(1), organic);
  assert.equal(shown[0].sponsored, true);
});
