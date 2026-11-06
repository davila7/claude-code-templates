import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMPTY_SELECTION,
  facetOptions,
  formatPrice,
  isUsefulFacet,
  matchesQuery,
  matchesSelection,
  sortItems,
  validateItem,
  validateProvider,
  type CertificationsData,
  type LearningItem,
} from '../src/lib/certifications.ts';

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

test('sortItems keeps Foundations before Professional inside a category', () => {
  const titles = sortItems(data.items).map((i) => `${i.categories[0]}/${i.level}`);
  assert.ok(titles.indexOf('Architecture/Foundations') < titles.indexOf('Architecture/Professional'));
});

test('validateItem rejects topics that are not strings', () => {
  const bad = { ...data.items[0], topics: [{}] as unknown as string[] };
  assert.ok(validateItem(bad).includes('topics must be an array of strings'));
});

test('certifications.json: category names do not differ only by case', () => {
  const names = new Set(data.items.flatMap((i) => i.categories));
  assert.equal(new Set([...names].map((n) => n.toLowerCase())).size, names.size);
});

test('validateItem requires at least one category', () => {
  assert.ok(validateItem({ ...data.items[0], categories: [] }).includes('categories must be a non-empty array of strings'));
});

const entry = (id: string, provider: string, categories: string[], level: string): LearningItem => ({
  ...data.items[0],
  id,
  title: id,
  description: '',
  audience: '',
  topics: [],
  provider,
  categories,
  level,
});
const catalog = [
  entry('a', 'Acme', ['Security', 'CI/CD'], 'Foundations'),
  entry('b', 'Acme', ['Frontend'], 'Professional'),
  entry('c', 'Globex', ['Security'], 'Professional'),
];

test('matchesSelection: OR inside a facet, AND between facets', () => {
  const ids = (selection: typeof EMPTY_SELECTION) => catalog.filter((i) => matchesSelection(i, selection)).map((i) => i.id);
  assert.deepEqual(ids({ ...EMPTY_SELECTION, categories: ['Frontend', 'CI/CD'] }), ['a', 'b']);
  assert.deepEqual(ids({ ...EMPTY_SELECTION, categories: ['Security'], provider: ['Globex'] }), ['c']);
});

test('facetOptions: counts ignore the own facet and drop empty options', () => {
  const selection = { ...EMPTY_SELECTION, categories: ['Frontend'], provider: ['Acme'] };
  assert.deepEqual(facetOptions(catalog, 'categories', selection), [
    { value: 'CI/CD', count: 1 },
    { value: 'Frontend', count: 1 },
    { value: 'Security', count: 1 },
  ]);
  assert.deepEqual(facetOptions(catalog, 'provider', { ...EMPTY_SELECTION, categories: ['Frontend'] }), [{ value: 'Acme', count: 1 }]);
});

test('facetOptions: a selected option stays listed with no results', () => {
  const selection = { ...EMPTY_SELECTION, provider: ['Globex'], categories: ['Frontend'] };
  assert.deepEqual(facetOptions(catalog, 'categories', selection), [
    { value: 'Security', count: 1 },
    { value: 'Frontend', count: 0 },
  ]);
});

test('matchesQuery needs every word, in any field', () => {
  assert.ok(matchesQuery(catalog[0], 'acme ci/cd'));
  assert.ok(!matchesQuery(catalog[0], 'globex security'));
  assert.ok(matchesQuery(catalog[0], '  '));
});

test('isUsefulFacet hides a facet with one value', () => {
  assert.ok(isUsefulFacet(catalog, 'provider'));
  assert.ok(!isUsefulFacet(catalog.slice(0, 2), 'provider'));
});
