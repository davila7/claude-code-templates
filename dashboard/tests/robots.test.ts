import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isNoindexPath } from '../src/lib/robots.ts';

test('private pages and the API are noindex', () => {
  for (const p of ['/api/ads/active', '/api/collections', '/api', '/my-components', '/my-components/', '/github-callback']) {
    assert.equal(isNoindexPath(p), true, p);
  }
});

test('public pages are indexable', () => {
  for (const p of ['/', '/agents', '/component/agents/api-graphql/api-architect', '/developers/catalog-api', '/apis', '/my-components-x']) {
    assert.equal(isNoindexPath(p), false, p);
  }
});

test('robots.txt does not Disallow a noindex path (Google could never see the header)', () => {
  const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  const blocks = robots.split(/\n\s*\n/);
  const star = blocks.find((b) => /^User-agent:\s*\*\s*$/m.test(b));
  assert.ok(star, 'no User-agent: * group');
  const disallowed = [...star.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
  for (const d of disallowed) {
    assert.equal(isNoindexPath(d) || isNoindexPath(d.replace(/\/$/, '')), false, `Disallow: ${d}`);
  }
});
