import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHeadings } from '../src/lib/markdown-headings.ts';

test('skips heading-shaped lines inside fenced code blocks', () => {
  const md = [
    '---', 'name: x', '---',
    '# Title',
    '## Report',
    '```',
    '### [Severity] Short title  (OWASP id)',
    '# a shell comment',
    '```',
    '~~~md',
    '## Inside tilde fence',
    '~~~',
    '## After',
  ].join('\n');
  assert.deepEqual(extractHeadings(md).map((h) => h.text), ['Title', 'Report', 'After']);
});

test('a longer fence is closed only by a fence at least as long', () => {
  const md = ['````md', '```', '# not a heading', '```', '````', '# Real'].join('\n');
  assert.deepEqual(extractHeadings(md).map((h) => h.text), ['Real']);
});

test('builds ids and levels like the renderer', () => {
  assert.deepEqual(extractHeadings('#### `Fix` *now*'), [{ level: 4, text: 'Fix now', id: 'fix-now' }]);
});

test('an inline code span with triple backticks does not open a fence', () => {
  const md = ['# Title', '```inline``` span in a paragraph', '## Later', '```bash', '# comment', '```', '## Last'].join('\n');
  assert.deepEqual(extractHeadings(md).map((h) => h.text), ['Title', 'Later', 'Last']);
});
