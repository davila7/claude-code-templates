// node --test cli-tool/tests/unit/external-skill.node-test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateManifest,
  isSafeRelativePath,
  gitBlobSha,
  fetchExternalManifest,
  downloadExternalSkill
} = require('../../src/external-skill');

const COMMIT = '7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd';
const manifest = { repo: 't3dotgg/tstack', path: 'skills/babysit-pr', commit: COMMIT, license: 'MIT' };

function reply(status, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => buf.toString('utf8'),
    json: async () => JSON.parse(buf.toString('utf8')),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)
  };
}

// A fake GitHub serving one tree and its raw files.
function fakeGitHub(files, { tamper } = {}) {
  const tree = Object.entries(files).map(([p, f]) => ({
    path: p, type: 'blob', mode: f.mode || '100644', sha: gitBlobSha(Buffer.from(f.content)), size: f.content.length
  }));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('https://api.github.com/')) return reply(200, { tree, truncated: false });
    const prefix = `https://raw.githubusercontent.com/t3dotgg/tstack/${COMMIT}/skills/babysit-pr/`;
    const rel = decodeURIComponent(url.slice(prefix.length));
    if (!(rel in files)) return reply(404, 'not found');
    return reply(200, tamper === rel ? 'tampered' : files[rel].content);
  };
  return { fetchImpl, calls };
}

test('validateManifest accepts a pinned commit and rejects branches', () => {
  assert.equal(validateManifest(manifest).path, 'skills/babysit-pr');
  assert.deepEqual(validateManifest(manifest).requires, []);
  assert.throws(() => validateManifest({ ...manifest, commit: 'main' }), /40-character/);
  assert.throws(() => validateManifest({ ...manifest, commit: COMMIT.slice(0, 7) }), /40-character/);
  assert.throws(() => validateManifest({ ...manifest, repo: 'not-a-repo' }), /repo/);
  assert.throws(() => validateManifest({ ...manifest, path: '../etc' }), /path/);
  assert.throws(() => validateManifest({ ...manifest, license: '' }), /license/);
  assert.throws(() => validateManifest({ ...manifest, requires: ['../x'] }), /requires/);
});

test('isSafeRelativePath', () => {
  assert.ok(isSafeRelativePath('scripts/pr-wait'));
  assert.ok(!isSafeRelativePath('../x'));
  assert.ok(!isSafeRelativePath('a/../../x'));
  assert.ok(!isSafeRelativePath('/etc/passwd'));
  assert.ok(!isSafeRelativePath('a\\b'));
  assert.ok(!isSafeRelativePath(''));
});

test('gitBlobSha matches git hash-object', () => {
  // printf 'hello\n' | git hash-object --stdin
  assert.equal(gitBlobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('downloadExternalSkill returns verified files with the executable bit from git', async () => {
  const { fetchImpl, calls } = fakeGitHub({
    'SKILL.md': { content: '---\nname: babysit-pr\n---\nbody\n' },
    'scripts/pr-wait': { content: '#!/usr/bin/env python3\n', mode: '100755' }
  });
  const files = await downloadExternalSkill(manifest, fetchImpl);
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'scripts/pr-wait']);
  assert.equal(files['scripts/pr-wait'].executable, true);
  assert.equal(files['SKILL.md'].executable, false);
  assert.ok(calls[0].includes(`/git/trees/${encodeURIComponent(COMMIT + ':skills/babysit-pr')}`));
  assert.ok(calls.slice(1).every((u) => u.includes(`/${COMMIT}/`)), 'files come from the pinned commit');
});

test('downloadExternalSkill rejects content that does not match the tree', async () => {
  const { fetchImpl } = fakeGitHub({ 'SKILL.md': { content: 'real' } }, { tamper: 'SKILL.md' });
  await assert.rejects(downloadExternalSkill(manifest, fetchImpl), /blob sha mismatch/);
});

test('downloadExternalSkill rejects unsafe paths and skips symlinks', async () => {
  const evil = fakeGitHub({ 'SKILL.md': { content: 'x' }, '../../.bashrc': { content: 'y' } });
  await assert.rejects(downloadExternalSkill(manifest, evil.fetchImpl), /Unsafe path/);
  const link = fakeGitHub({ 'SKILL.md': { content: 'x' }, 'link': { content: '/etc/passwd', mode: '120000' } });
  assert.deepEqual(Object.keys(await downloadExternalSkill(manifest, link.fetchImpl)), ['SKILL.md']);
});

test('downloadExternalSkill requires SKILL.md', async () => {
  const { fetchImpl } = fakeGitHub({ 'README.md': { content: 'x' } });
  await assert.rejects(downloadExternalSkill(manifest, fetchImpl), /No SKILL.md/);
});

test('fetchExternalManifest: 404 means a regular skill', async () => {
  assert.equal(await fetchExternalManifest('git/create-pr', async () => reply(404, '')), null);
  const m = await fetchExternalManifest('git/babysit-pr', async () => reply(200, manifest));
  assert.equal(m.repo, 't3dotgg/tstack');
  assert.equal(await fetchExternalManifest('../x', async () => reply(200, manifest)), null);
});

test('include keeps only the listed files and folders', async () => {
  assert.throws(() => validateManifest({ ...manifest, include: [] }), /include/);
  assert.throws(() => validateManifest({ ...manifest, include: ['scripts'] }), /SKILL.md/);
  assert.throws(() => validateManifest({ ...manifest, include: ['SKILL.md', '../x'] }), /include/);
  assert.deepEqual(validateManifest({ ...manifest, include: ['SKILL.md', 'scripts/'] }).include, ['SKILL.md', 'scripts']);
  assert.equal(validateManifest(manifest).include, null);

  const { fetchImpl, calls } = fakeGitHub({
    'SKILL.md': { content: 'x' },
    'scripts/pr-wait': { content: 'y', mode: '100755' },
    'scripts-old/a': { content: 'z' },
    'demo/big.gif': { content: 'gif' }
  });
  const files = await downloadExternalSkill(validateManifest({ ...manifest, include: ['SKILL.md', 'scripts'] }), fetchImpl);
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'scripts/pr-wait']);
  assert.ok(!calls.some((u) => u.includes('demo/') || u.includes('scripts-old')), 'excluded files are never downloaded');
});
