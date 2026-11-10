import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// FLOSS/Fund crawls https://www.aitmpl.com/funding.json (served from dashboard/public/).
// The repo-root copy is the one GitHub visitors see; both must stay identical, and every
// well-known file must list the served manifest URL or the listing shows as unverified.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const MANIFEST_URL = 'https://www.aitmpl.com/funding.json';

test('funding.json: dashboard copy matches the repo root', () => {
  assert.equal(read('../public/funding.json'), read('../../funding.json'));
});

test('funding.json: webpage URLs sit on the host that serves the manifest', () => {
  const m = JSON.parse(read('../public/funding.json'));
  for (const o of [m.entity, ...m.projects]) {
    assert.equal(new URL(o.webpageUrl.url).host, new URL(MANIFEST_URL).host);
  }
});

test('well-known files list the served manifest URL', () => {
  for (const p of ['../public/.well-known/funding-manifest-urls', '../../.well-known/funding-manifest-urls']) {
    assert.ok(read(p).split('\n').includes(MANIFEST_URL), p);
  }
});
