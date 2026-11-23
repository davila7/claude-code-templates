import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoName, pickFiles, readRepo, splitPicks, treeListing } from '../src/lib/claude-stack.ts';

describe('parseRepoName', () => {
  it('accepts owner/name and github URLs', () => {
    assert.equal(parseRepoName('davila7/claude-code-templates'), 'davila7/claude-code-templates');
    assert.equal(parseRepoName('https://github.com/a/b.git/'), 'a/b');
    assert.equal(parseRepoName('a'), null);
    assert.equal(parseRepoName('a/b/c'), null);
  });
});

describe('pickFiles', () => {
  it('keeps manifests, configs and a few workflows, in priority order', () => {
    const paths = ['src/x.ts', 'README.md', 'package.json', 'astro.config.mjs', 'apps/web/package.json',
      ...Array.from({ length: 8 }, (_, i) => `.github/workflows/w${i}.yml`)];
    const picked = pickFiles(paths);
    assert.deepEqual(picked.slice(0, 2), ['package.json', 'README.md']);
    assert.ok(picked.includes('astro.config.mjs'));
    assert.ok(!picked.includes('apps/web/package.json'));
    assert.equal(picked.filter((p) => p.startsWith('.github/')).length, 5);
  });
});

describe('treeListing', () => {
  it('skips vendored folders', () => {
    assert.equal(treeListing(['node_modules/a/b.js', 'src/a.ts']), 'src/a.ts');
  });
});

describe('splitPicks', () => {
  it('separates plugins from stack-link items', () => {
    const { items, plugins } = splitPicks([
      { id: 'agents/dev/react-expert', reason: '' },
      { id: 'plugins/productivity/champion-kit', reason: '' },
      { id: 'templates/old', reason: '' },
    ]);
    assert.deepEqual(items, [{ type: 'agents', path: 'dev/react-expert' }]);
    assert.deepEqual(plugins, ['productivity/champion-kit']);
  });
});

describe('readRepo', () => {
  it('reads the tree and the picked files only', async () => {
    const fetcher = mock.fn(async (url: string) => {
      if (url.endsWith('/repos/a/b')) return new Response(JSON.stringify({ default_branch: 'main' }));
      if (url.includes('/git/trees/')) return new Response(JSON.stringify({ tree: [
        { path: 'package.json', type: 'blob' }, { path: 'src/index.ts', type: 'blob' }, { path: 'src', type: 'tree' },
      ] }));
      if (url.includes('/contents/package.json')) return new Response('{"name":"b"}');
      return new Response('nope', { status: 404 });
    });
    const snap = await readRepo('a/b', null, fetcher as never);
    assert.deepEqual(snap.files.map((f) => f.path), ['(file tree)', 'package.json']);
    assert.equal(snap.files[0].content, 'package.json\nsrc/index.ts');
    assert.equal(fetcher.mock.calls.some((c) => String(c.arguments[0]).includes('src/index.ts')), false);
  });
});
