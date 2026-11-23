import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightLines, MAX_HIGHLIGHT_CHARS } from '../src/lib/code-highlight.ts';
import { languageForFile } from '../src/lib/code-language.ts';

test('maps the catalog file types to a language', () => {
  assert.equal(languageForFile('assets/eval_review.html'), 'xml');
  assert.equal(languageForFile('scripts/run.py'), 'python');
  assert.equal(languageForFile('hooks/mod.tsx'), 'typescript');
  assert.equal(languageForFile('a/b/fix.patch'), 'diff');
  assert.equal(languageForFile('schema.xsd'), 'xml');
  assert.equal(languageForFile('SKILL.md'), 'markdown');
  assert.equal(languageForFile('config.yml'), 'yaml');
  assert.equal(languageForFile('install.sh'), 'bash');
  assert.equal(languageForFile('Dockerfile'), 'dockerfile');
  assert.equal(languageForFile('data.csv'), null);
  assert.equal(languageForFile('LICENSE'), null);
});

test('returns one token list per source line, text preserved', () => {
  const code = '<div class="a">\n  <script>const x = 1;</script>\n\n</div>';
  const lines = highlightLines(code, 'xml');
  assert.ok(lines);
  assert.equal(lines.length, code.split('\n').length);
  assert.deepEqual(lines.map((l) => l.map((t) => t.text).join('')), code.split('\n'));
  const scopes = lines.flat().map((t) => t.cls);
  assert.ok(scopes.some((c) => c.includes('hljs-name')), 'tag names are scoped');
  assert.ok(scopes.some((c) => c.includes('hljs-attr')), 'attributes are scoped');
  assert.ok(scopes.some((c) => c.includes('hljs-keyword')), 'embedded <script> is highlighted');
});

test('multi-line tokens keep their scope on every line', () => {
  const code = 'x = """doc\nstring"""\nprint(x)';
  const lines = highlightLines(code, 'python');
  assert.ok(lines);
  assert.equal(lines.length, 3);
  assert.equal(lines[1][0].cls, 'hljs-string');
});

test('stays plain for unknown languages and oversized files', () => {
  assert.equal(highlightLines('a,b', null), null);
  assert.equal(highlightLines('a', 'cobol'), null);
  assert.equal(highlightLines('a'.repeat(MAX_HIGHLIGHT_CHARS + 1), 'python'), null);
});
