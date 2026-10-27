import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marked } from 'marked';
import { sanitizeHtml, codeLang, jsonForScript } from '../src/lib/sanitize-html.ts';

// Same shape as the renderers in MarkdownViewer / SkillExplorer / SkillSlideView
function render(md: string): string {
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
    const id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    return `<h${depth} id="${id}" class="md-heading">${text}</h${depth}>`;
  };
  renderer.code = ({ text, lang }: { text: string; lang?: string }) =>
    `<div class="md-code-block"><div class="md-code-lang">${codeLang(lang)}</div><pre><code class="language-${codeLang(lang)}">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>`;
  return sanitizeHtml(marked.parse(md, { renderer }) as string);
}

test('strips event handlers, scripts and javascript: URLs', () => {
  const html = render([
    'hola <img src=x onerror=alert(1)>',
    '<script>alert(2)</script>',
    '[link](javascript:alert(3))',
    '<a href="javascript:alert(4)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '# Title <svg onload=alert(5)>',
  ].join('\n\n'));
  assert.doesNotMatch(html, /\son\w+=|<script|alert\(2\)|javascript:|<iframe|<svg/i);
});

test('a code fence info string cannot break out of the class attribute', () => {
  const html = render('```x"><img src=x onerror=alert(1)>\nok\n```');
  assert.doesNotMatch(html, /<img|onerror/);
  assert.match(html, /class="language-x&quot;&gt;&lt;img"/);
});

test('fence info strings keep only the language', () => {
  assert.equal(codeLang('ts title="Going from 0 to 1"'), 'ts');
  assert.equal(codeLang(undefined), '');
  assert.match(render('```ts title="x"\nconst a = 1;\n```'), /<code class="language-ts">const a = 1;/);
});

test('keeps the formatting components use', () => {
  const html = render([
    '## Setup',
    '| a | b |\n|---|---|\n| 1 | 2 |',
    '<details><summary>More</summary>\n\nHidden text\n\n</details>',
    '<img src="https://example.com/a.png" alt="diagram" width="300">',
    '- [x] done\n- [ ] todo',
    '[docs](https://docs.aitmpl.com)',
  ].join('\n\n'));
  assert.match(html, /<h2 id="setup" class="md-heading">Setup<\/h2>/);
  assert.match(html, /<table>[\s\S]*<td>1<\/td>/);
  assert.match(html, /<details><summary>More<\/summary>/);
  assert.match(html, /<img src="https:\/\/example.com\/a.png" alt="diagram" width="300">/);
  assert.match(html, /<input checked disabled type="checkbox">/);
  assert.match(html, /<a href="https:\/\/docs.aitmpl.com">docs<\/a>/);
});

test("agent <example>/<commentary> tags are dropped but their text stays", () => {
  const html = render('<example>\nuser: hi\n<commentary>use the agent</commentary>\n</example>');
  assert.doesNotMatch(html, /<example|<commentary/);
  assert.match(html, /user: hi/);
  assert.match(html, /use the agent/);
});

test('jsonForScript cannot close the script tag', () => {
  const out = jsonForScript({ description: '</script><img src=x onerror=alert(1)>' });
  assert.doesNotMatch(out, /<\/script|<img/i);
  assert.deepEqual(JSON.parse(out), { description: '</script><img src=x onerror=alert(1)>' });
});
