import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLlmsTxt, notFoundMarkdown, prefersMarkdown, totalComponents } from '../src/lib/agent-readiness.ts';

test('prefersMarkdown: browsers and missing headers get HTML', () => {
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown(''), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(
    prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'),
    false,
  );
  assert.equal(prefersMarkdown('text/html'), false);
});

test('prefersMarkdown: agents asking for Markdown get it', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.9'), true);
  assert.equal(prefersMarkdown('text/markdown;q=0.9, text/html;q=0.9'), true);
  assert.equal(prefersMarkdown('TEXT/MARKDOWN; charset=utf-8'), true);
  assert.equal(prefersMarkdown('text/x-markdown'), true);
});

test('prefersMarkdown: HTML preferred or Markdown refused', () => {
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.5'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
  assert.equal(prefersMarkdown('text/markdown;q=abc'), false);
});

test('notFoundMarkdown names the path, points to llms.txt and sitemap, and is over 20 chars', () => {
  const md = notFoundMarkdown('/does-not-exist');
  assert.match(md, /^# 404 Not Found/);
  assert.match(md, /`\/does-not-exist`/);
  assert.match(md, /https:\/\/www\.aitmpl\.com\/llms\.txt/);
  assert.match(md, /https:\/\/www\.aitmpl\.com\/sitemap\.xml/);
  assert.ok(md.length > 20);
});

test('notFoundMarkdown strips newlines and backticks from the echoed path', () => {
  const md = notFoundMarkdown('/a`b\n# injected');
  assert.ok(!md.includes('\n# injected'));
  assert.match(md, /`\/ab# injected`/);
});

test('totalComponents sums only installable types', () => {
  assert.equal(totalComponents({ agents: 2, skills: 3, sandbox: 100, plugins: 7 }), 5);
  assert.equal(totalComponents({}), 0);
});

test('buildLlmsTxt follows llmstxt.org structure', () => {
  const txt = buildLlmsTxt({ agents: 10, skills: 5, hooks: 0 });
  const lines = txt.split('\n');
  assert.equal(lines[0], '# Claude Code Templates (aitmpl.com)');
  assert.ok(lines.some((l) => l.startsWith('> ')), 'has a blockquote summary');
  assert.match(txt, /15\+ ready-to-use components/);
  assert.match(txt, /^## When to use this$/m);
  assert.match(txt, /\[Agents\]\(https:\/\/www\.aitmpl\.com\/agents\): 10 components, install with `--agent`/);
  assert.ok(!txt.includes('[Hooks]'), 'types with zero components are omitted');
  assert.match(txt, /https:\/\/www\.aitmpl\.com\/openapi\.json/);
  assert.match(txt, /^## Optional$/m);
  // Every list item in a section is a Markdown link or plain bullet, never an empty link.
  assert.ok(!/\]\(\)/.test(txt));
});
