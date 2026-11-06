import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { facetCounts, sortBy, filterItems, formatPrice, sortItems, validateItem, validateProvider, type CertificationsData } from '../src/lib/certifications.ts';

const data: CertificationsData = JSON.parse(
  readFileSync(new URL('../public/certifications.json', import.meta.url), 'utf8'),
);

test('certifications.json: every entry follows the contract', () => {
  assert.equal(data.schemaVersion, 1);
  assert.ok(data.items.length > 0);
  for (const item of data.items) assert.deepEqual(validateItem(item), [], item.id);
});

test('certifications.json: ids are unique', () => {
  const ids = data.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('certifications.json: every provider is described and its icon is https', () => {
  for (const item of data.items) assert.ok(data.providers[item.provider], item.provider);
  for (const [name, info] of Object.entries(data.providers)) assert.deepEqual(validateProvider(info), [], name);
});

test('validateItem rejects non-https links', () => {
  const bad = { ...data.items[0], url: 'javascript:alert(1)', prepUrl: 'http://x.test' };
  const errors = validateItem(bad);
  assert.ok(errors.includes('url must be https'));
  assert.ok(errors.includes('prepUrl must be https'));
});

test('formatPrice', () => {
  assert.equal(formatPrice({ amount: 99, currency: 'USD' }), '$99');
  assert.equal(formatPrice(null), 'Free');
  assert.equal(formatPrice({ amount: 0, currency: 'USD' }), 'Free');
  assert.equal(formatPrice({ amount: 50, currency: 'EUR' }), 'EUR 50');
});

test('sortItems puts Entry before Advanced for the same provider', () => {
  const levels = sortItems(data.items.filter((i) => i.provider === 'Anthropic' && i.kind === 'certification')).map((i) => i.level);
  assert.ok(levels.lastIndexOf('Entry') < levels.indexOf('Advanced'));
});

test('validateItem rejects values outside the controlled vocabularies', () => {
  const bad = { ...data.items[0], categories: ['CI/CD'] as never, level: 'Foundations' as never, role: 'Ninja' as never };
  const errors = validateItem(bad);
  assert.ok(errors.includes('categories must be a non-empty list of CATEGORIES'));
  assert.ok(errors.includes('level must be one of LEVELS'));
  assert.ok(errors.includes('role must be one of ROLES'));
});

test('filterItems combines facets with AND and values inside a facet with OR', () => {
  assert.equal(filterItems(data.items, '', { role: ['Architect', 'Developer'] }).length, 3);
  assert.equal(filterItems(data.items, '', { role: ['Architect'], level: ['Advanced'] }).length, 1);
  assert.equal(filterItems(data.items, 'mcp', {}).length, 2);
});

test('facetCounts ignores the facet being counted', () => {
  const roles = facetCounts(data.items, '', { role: ['Architect'] }, 'role');
  assert.deepEqual(roles.find((r) => r.value === 'Developer'), { value: 'Developer', count: 1 });
  const levels = facetCounts(data.items, '', { role: ['Architect'] }, 'level');
  assert.deepEqual(levels.find((l) => l.value === 'Entry'), { value: 'Entry', count: 1 });
});

test('validateItem rejects topics that are not strings', () => {
  const bad = { ...data.items[0], topics: [{}] as unknown as string[] };
  assert.ok(validateItem(bad).includes('topics must be an array of strings'));
});

test('facetCounts counts an item once per value, and lists levels in their natural order', () => {
  const item = { ...data.items[0], categories: ['Security', 'Security'] as never };
  assert.deepEqual(facetCounts([item], '', {}, 'category'), [{ value: 'Security', count: 1 }]);
  assert.ok(validateItem(item).includes('categories must not repeat'));
  const adv = { ...data.items[0], id: 'adv', level: 'Advanced' as const };
  const levels = facetCounts([adv, adv, { ...data.items[0], level: 'Entry' }], '', {}, 'level').map((l) => l.value);
  assert.deepEqual(levels, ['Entry', 'Advanced']);
});

test('price sort keeps currencies apart', () => {
  const p = (id: string, amount: number, currency: string) => ({ ...data.items[0], id, price: { amount, currency } });
  const order = sortBy([p('jpy', 1000, 'JPY'), p('usd-hi', 200, 'USD'), p('usd-lo', 100, 'USD')], 'price-asc').map((i) => i.id);
  assert.deepEqual(order, ['usd-lo', 'usd-hi', 'jpy']);
});
