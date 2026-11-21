import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactList, rankList, topByCategory, typeStats, bucketCounts, matchesQuery } from '../src/lib/leaderboard.ts';

test('compactList strips extensions, drops duplicates and bad counts, sorts by installs then path', () => {
  const list = compactList([
    { path: 'b/two.md', downloads: 5 },
    { path: 'a/one.json', downloads: 10 },
    { path: 'a/three.md', downloads: 5 },
    { path: 'a/one.json', downloads: 99 },
    { path: 'c/zero.md', downloads: null },
    { path: 'c/neg.md', downloads: -3 },
    { path: '', downloads: 50 },
  ]);
  assert.deepEqual(list, [
    ['a/one', 10],
    ['a/three', 5],
    ['b/two', 5],
    ['c/neg', 0],
    ['c/zero', 0],
  ]);
});

test('rankList uses competition ranking for ties and splits category and name', () => {
  const ranked = rankList([['a/x', 10], ['b/y', 5], ['a/z', 5], ['c/w', 1]]);
  assert.deepEqual(ranked.map((e) => e.rank), [1, 2, 2, 4]);
  assert.deepEqual(ranked[1], { rank: 2, category: 'b', name: 'y', path: 'b/y', installs: 5 });
});

test('topByCategory orders categories by total installs and skips zero-install entries', () => {
  const ranked = rankList([['a/1', 10], ['b/1', 8], ['b/2', 7], ['a/2', 1], ['c/1', 0]]);
  const blocks = topByCategory(ranked, 1);
  assert.deepEqual(blocks.map((b) => b.category), ['b', 'a']);
  assert.equal(blocks[0].components, 2);
  assert.equal(blocks[0].installs, 15);
  assert.deepEqual(blocks[0].top.map((e) => e.path), ['b/1']);
});

test('typeStats computes total, median and the top 10% share', () => {
  assert.deepEqual(typeStats([['a', 90], ['b', 5], ['c', 3], ['d', 2]]), { components: 4, installs: 100, median: 4, top10Share: 0.9 });
  assert.equal(typeStats([['a', 5], ['b', 4]]).median, 4.5);
  assert.deepEqual(typeStats([]), { components: 0, installs: 0, median: 0, top10Share: 0 });
});

test('bucketCounts puts every component in one bucket', () => {
  assert.deepEqual(bucketCounts([[['a', 0], ['b', 1], ['c', 99]], [['d', 100], ['e', 1000], ['f', 10000]]]), [1, 2, 1, 1, 1]);
});

test('matchesQuery matches path or spaced name, case-insensitive', () => {
  const [e] = rankList([['creative-design/frontend-design', 1]]);
  assert.equal(matchesQuery(e, 'Frontend Design'), true);
  assert.equal(matchesQuery(e, 'creative'), true);
  assert.equal(matchesQuery(e, 'backend'), false);
  assert.equal(matchesQuery(e, '  '), true);
});
