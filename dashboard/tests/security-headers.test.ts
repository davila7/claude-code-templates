import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CSP_POLICY, SECURITY_HEADERS, isHtml, parseCspReports } from '../src/lib/security-headers.ts';

test('public/_headers /* sends the same headers as the middleware', () => {
  const file = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const block = file.split(/\n(?=\S)/).find((b) => b.startsWith('/*\n'));
  assert.ok(block, 'no /* rule in public/_headers');
  const sent = Object.fromEntries(
    block.split('\n').slice(1).filter((l) => l.trim()).map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test('policy blocks plugins, framing and base tag hijack, and reports', () => {
  assert.match(CSP_POLICY, /object-src 'none'/);
  assert.match(CSP_POLICY, /frame-ancestors 'none'/);
  assert.match(CSP_POLICY, /base-uri 'self'/);
  assert.match(CSP_POLICY, /report-uri \/api\/csp-report$/);
});

test('isHtml', () => {
  assert.equal(isHtml('text/html; charset=utf-8'), true);
  assert.equal(isHtml('application/json'), false);
  assert.equal(isHtml(null), false);
});

test('parseCspReports reads report-uri bodies and reduces URLs to origins', () => {
  const v = parseCspReports({
    'csp-report': {
      'document-uri': 'https://www.aitmpl.com/blog/context7-mcp/?utm=x',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://evil.example/x.js?token=secret',
      'source-file': 'https://www.aitmpl.com/_astro/a.js',
    },
  });
  assert.deepEqual(v, [
    { directive: 'script-src-elem', blocked: 'https://evil.example', page: '/blog/context7-mcp/', source: 'https://www.aitmpl.com' },
  ]);
});

test('parseCspReports reads Reporting API batches and keywords', () => {
  const v = parseCspReports([
    { type: 'csp-violation', body: { documentURL: 'https://www.aitmpl.com/', effectiveDirective: 'script-src', blockedURL: 'inline' } },
    { type: 'deprecation', body: {} },
  ]);
  assert.deepEqual(v, [{ directive: 'script-src', blocked: 'inline', page: '/', source: '' }]);
});

test('parseCspReports drops browser-extension noise and junk', () => {
  assert.deepEqual(parseCspReports({ 'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'chrome-extension://abc' } }), []);
  assert.deepEqual(parseCspReports({ 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'https://x.com', 'source-file': 'moz-extension://y' } }), []);
  assert.deepEqual(parseCspReports({}), []);
  assert.deepEqual(parseCspReports('nope'), []);
  assert.deepEqual(parseCspReports(null), []);
});
