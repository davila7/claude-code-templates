import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatPrice, sortItems, validateItem, validateProvider, type CertificationsData } from '../src/lib/certifications.ts';

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
  const titles = sortItems(data.items).map((i) => `${i.category}/${i.level}`);
  assert.ok(titles.indexOf('Architecture/Foundations') < titles.indexOf('Architecture/Professional'));
});

test('validateItem rejects topics that are not strings', () => {
  const bad = { ...data.items[0], topics: [{}] as unknown as string[] };
  assert.ok(validateItem(bad).includes('topics must be an array of strings'));
});
