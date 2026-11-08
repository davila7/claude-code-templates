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

test('robots.txt allows /api/v1/ for every crawler and keeps the rest of /api/ blocked', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const robots = fs.readFileSync(path.join(import.meta.dirname, '..', 'public', 'robots.txt'), 'utf-8');
  const star = robots.split(/\n(?=User-agent:)/).find((g) => g.startsWith('User-agent: *'));
  assert.ok(star, 'User-agent: * group');
  assert.match(star, /^Allow: \/api\/v1\/$/m);
  assert.match(star, /^Disallow: \/api\/$/m);
});

test('llms.txt links llms-full.txt', () => {
  assert.match(buildLlmsTxt({ skills: 1 }), /\/llms-full\.txt/);
});

test('llms-full.txt lists every component by type in id order, with its command', async () => {
  const { buildLlmsFullTxt, shortDescription } = await import('../src/lib/agent-readiness.ts');
  const txt = buildLlmsFullTxt({ skills: 2, hooks: 1 }, [
    { id: 'skills/z/zeta', type: 'skills', description: 'Zeta skill. More text.', install: { command: 'npx claude-code-templates@latest --skill z/zeta' }, urls: { page: 'https://www.aitmpl.com/component/skills/z/zeta' } },
    { id: 'skills/a/alpha', type: 'skills', description: 'Use this when you need alpha things.\n\n<example>user: hi</example>', install: { command: 'npx claude-code-templates@latest --skill a/alpha' } },
    { id: 'hooks/git/h', type: 'hooks', description: null },
  ]);
  assert.ok(txt.startsWith(buildLlmsTxt({ skills: 2, hooks: 1 })));
  assert.match(txt, /### Skills \(2\)/);
  assert.match(txt, /### Hooks \(1\)/);
  assert.ok(txt.indexOf('skills/a/alpha') < txt.indexOf('skills/z/zeta'));
  assert.match(txt, /- \[skills\/a\/alpha\]\(https:\/\/www\.aitmpl\.com\/component\/skills\/a\/alpha\): Use this when you need alpha things\. Install: `npx claude-code-templates@latest --skill a\/alpha`/);
  assert.match(txt, /- \[hooks\/git\/h\]\(https:\/\/www\.aitmpl\.com\/component\/hooks\/git\/h\)$/m);
  assert.doesNotMatch(txt, /<example>/);
  assert.ok(shortDescription('x'.repeat(500)).length <= 200);
});
