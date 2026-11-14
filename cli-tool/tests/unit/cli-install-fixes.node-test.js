'use strict';

// CLI 1.33 install fixes: mods from component-content, the system-folder
// guard, short names / "did you mean", --search and the follow-up lines.
// Run: node --test cli-tool/tests/unit/cli-install-fixes.node-test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { filesFromContent, fetchModFiles, isSafeRelativePath, contentBaseUrl, CONTENT_URL } = require('../../src/component-content');
const { unsafeTarget, unsafeTargetMessage } = require('../../src/target-guard');
const { resolveName, resolveItems, searchCatalog, pageUrl, stackCommand, installPath, suggest } = require('../../src/catalog-lookup');

const REPO = path.join(__dirname, '..', '..', '..');
const CONTENT_DIR = path.join(REPO, 'dashboard', 'public', 'component-content', 'mods');

function modContentFiles() {
  const out = [];
  for (const category of fs.readdirSync(CONTENT_DIR)) {
    for (const file of fs.readdirSync(path.join(CONTENT_DIR, category))) {
      if (file.endsWith('.json')) out.push(path.join(CONTENT_DIR, category, file));
    }
  }
  return out;
}

const sample = () => ({
  content: '# demo\n',
  files: {
    '.claude-plugin/plugin.json': '{"name":"demo"}\n',
    'hooks/hooks.json': '{"modules":["./demo.ts"]}\n',
    'hooks/demo.ts': 'export const register = () => {}\n'
  },
  meta: {
    files: [
      { path: '.claude-plugin/plugin.json', bytes: 16 },
      { path: 'README.md', bytes: 7 },
      { path: 'hooks/demo.ts', bytes: 33 },
      { path: 'hooks/hooks.json', bytes: 26 }
    ]
  }
});

// --- component-content --------------------------------------------------

test('every mod content file in the catalog passes the meta.files check', () => {
  const files = modContentFiles();
  assert.ok(files.length >= 10, `expected the mod content files, found ${files.length}`);
  for (const file of files) {
    const result = filesFromContent(JSON.parse(fs.readFileSync(file, 'utf8')));
    assert.ok(result.files, `${path.relative(REPO, file)}: ${result.error}`);
    assert.ok(result.files['.claude-plugin/plugin.json'] && result.files['hooks/hooks.json'], `${file}: not a plugin`);
  }
});

test('filesFromContent returns README.md from content and every listed file', () => {
  const { files, error } = filesFromContent(sample());
  assert.equal(error, undefined);
  assert.deepEqual(Object.keys(files).sort(), ['.claude-plugin/plugin.json', 'README.md', 'hooks/demo.ts', 'hooks/hooks.json']);
  assert.equal(files['README.md'], '# demo\n');
});

test('filesFromContent rejects a size mismatch, a missing or extra file and unsafe paths', () => {
  const wrongSize = sample(); wrongSize.files['hooks/demo.ts'] += '//';
  assert.match(filesFromContent(wrongSize).error, /bytes/);

  const missing = sample(); delete missing.files['hooks/demo.ts'];
  assert.match(filesFromContent(missing).error, /not shipped/);

  const extra = sample(); extra.files['hooks/other.ts'] = 'x';
  assert.match(filesFromContent(extra).error, /not in meta.files/);

  const traversal = sample(); traversal.meta.files.push({ path: '../evil.js', bytes: 1 }); traversal.files['../evil.js'] = 'x';
  assert.match(filesFromContent(traversal).error, /unexpected path/);

  assert.match(filesFromContent({ content: 'x' }).error, /meta.files/);
  assert.match(filesFromContent(null).error, /meta.files/);
});

test('isSafeRelativePath keeps files inside the plugin and allows only .claude-plugin as a hidden dir', () => {
  for (const ok of ['README.md', 'hooks/a.ts', '.claude-plugin/plugin.json', 'types/claude-code.d.ts']) assert.equal(isSafeRelativePath(ok), true, ok);
  for (const bad of ['', '/etc/passwd', '../x', 'a/../../x', 'a\\b', '.env', 'hooks/.secret', 'a//b', './a']) assert.equal(isSafeRelativePath(bad), false, bad);
});

test('fetchModFiles: content file, 404 and network errors (never throws)', async () => {
  const body = sample();
  const ok = await fetchModFiles('ui/demo', { fetchImpl: async url => ({ ok: true, status: 200, json: async () => body, url }) });
  assert.ok(ok.files);
  assert.equal(ok.url, `${CONTENT_URL}/mods/ui/demo.json`);

  const notFound = await fetchModFiles('ui/demo', { fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(notFound.notFound, true);

  const down = await fetchModFiles('ui/demo', { fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(down.error, 'ECONNRESET');

  const bad = await fetchModFiles('ui/demo', { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(bad.error, 'HTTP 503');
});

test('CCT_CONTENT_URL only accepts an https .../component-content URL', () => {
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'https://example.com/x/component-content/' }), 'https://example.com/x/component-content');
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'http://example.com/component-content' }), CONTENT_URL);
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'https://example.com/other' }), CONTENT_URL);
  assert.equal(contentBaseUrl({}), CONTENT_URL);
});

// --- target guard ------------------------------------------------------

test('unsafeTarget refuses the Windows folder, anything under it and drive roots', () => {
  const win = { platform: 'win32', env: { SystemRoot: 'C:\\Windows' } };
  assert.equal(unsafeTarget('C:\\Windows\\System32', win).reason, 'system_dir');
  assert.equal(unsafeTarget('c:\\windows\\system32\\', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\Windows\\SysWOW64', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\Windows', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\', win).reason, 'drive_root');
  assert.equal(unsafeTarget('D:\\', win).reason, 'drive_root');
  assert.equal(unsafeTarget('C:\\Users\\dev\\project', win), null);
  assert.equal(unsafeTarget('C:\\WindowsApps\\project', win), null);
  assert.equal(unsafeTarget('D:\\Windows\\System32', { platform: 'win32', env: { SystemRoot: 'D:\\Windows' } }).reason, 'system_dir');

  const posix = { platform: 'linux', env: {} };
  assert.equal(unsafeTarget('/', posix).reason, 'drive_root');
  assert.equal(unsafeTarget('/home/dev/project', posix), null);
});

test('the refusal says nothing was written and where to go', () => {
  const lines = unsafeTargetMessage({ reason: 'system_dir', dir: 'C:\\Windows\\System32' }, { platform: 'win32', env: { USERPROFILE: 'C:\\Users\\dev' } }).join('\n');
  assert.match(lines, /Nothing was written/);
  assert.match(lines, /C:\\Users\\dev/);
  assert.match(lines, /--directory/);
});

// --- names, suggestions, search ---------------------------------------

const component = (type, path, extra = {}) => {
  const name = path.split('/').pop().replace(/\.(md|json)$/, '');
  const arg = path.replace(/\.(md|json)$/, '');
  const flag = { agents: 'agent', skills: 'skill', commands: 'command', mods: 'mod' }[type];
  return { id: `${type}/${arg}`, type, name, category: arg.split('/')[0], path, description: '', keywords: [], downloads: 0, install: { args: [`--${flag}`, arg] }, urls: { page: `https://www.aitmpl.com/component/${type}/${arg}` }, ...extra };
};

const AGENTS = [
  component('agents', 'development-team/frontend-developer.md'),
  component('agents', 'development-tools/code-reviewer.md'),
  component('agents', 'security/code-reviewer.md'),
  component('agents', 'database/postgres-pro.md')
];

test('installPath uses install.args, never the .md catalog path', () => {
  assert.equal(installPath(AGENTS[0]), 'development-team/frontend-developer');
  assert.equal(installPath({ path: 'a/b.json' }), 'a/b');
});

test('resolveName: exact path, unique short name, ambiguous and missing', () => {
  assert.equal(resolveName('development-team/frontend-developer', AGENTS).status, 'exact');
  const short = resolveName('frontend-developer', AGENTS);
  assert.equal(short.status, 'resolved');
  assert.equal(installPath(short.component), 'development-team/frontend-developer');
  assert.equal(resolveName('wrong-category/frontend-developer', AGENTS).status, 'resolved');
  assert.equal(resolveName('development-team/frontend-developer.md', AGENTS).status, 'resolved');

  const ambiguous = resolveName('code-reviewer', AGENTS);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.suggestions.length, 2);

  const typo = resolveName('frontend-develper', AGENTS);
  assert.equal(typo.status, 'missing');
  assert.equal(installPath(typo.suggestions[0]), 'development-team/frontend-developer');

  assert.deepEqual(suggest('completely-unrelated-thing', AGENTS), []);
});

test('resolveItems rewrites unique names, tags pages and leaves the rest with suggestions', async () => {
  const items = [
    { type: 'agent', name: 'frontend-developer' },
    { type: 'agent', name: 'code-reviewer' },
    { type: 'agent', name: 'frontend-develper' },
    { type: 'plugin', name: 'productivity/champion-kit' }
  ];
  const rewritten = await resolveItems(items, { loadCatalogTypes: async () => ({ agents: AGENTS }) });
  assert.equal(rewritten, 1);
  assert.equal(items[0].name, 'development-team/frontend-developer');
  assert.equal(items[0].requested, 'frontend-developer');
  assert.equal(items[0].page, 'https://www.aitmpl.com/component/agents/development-team/frontend-developer?utm_source=cli&utm_medium=install');
  assert.equal(items[1].name, 'code-reviewer');
  assert.deepEqual(items[1].suggestions.map(s => s.path), ['development-tools/code-reviewer', 'security/code-reviewer']);
  assert.equal(items[1].suggestions[0].command, 'npx claude-code-templates@latest --agent development-tools/code-reviewer');
  assert.equal(items[2].notInCatalog, true);
  assert.equal(items[3].page, 'https://www.aitmpl.com/component/plugins/productivity/champion-kit?utm_source=cli&utm_medium=install');
});

test('resolveItems keeps names as typed when the catalog cannot be loaded', async () => {
  const items = [{ type: 'agent', name: 'frontend-developer' }];
  assert.equal(await resolveItems(items, { loadCatalogTypes: async () => { throw new Error('offline'); } }), -1);
  assert.deepEqual(items, [{ type: 'agent', name: 'frontend-developer' }]);
});

test('searchCatalog ranks by text match, never by downloads, and returns at most 5', () => {
  const catalog = {
    agents: [
      component('agents', 'database/postgres-pro.md', { description: 'PostgreSQL tuning' }),
      component('agents', 'misc/popular-thing.md', { description: 'mentions postgres once', downloads: 999999 })
    ],
    skills: Array.from({ length: 8 }, (_, i) => component('skills', `db/postgres-skill-${i}`))
  };
  const { results, total } = searchCatalog('postgres', catalog);
  assert.equal(total, 10);
  assert.equal(results.length, 5);
  assert.equal(results[0].path, 'database/postgres-pro');
  assert.ok(!results.some(r => r.path === 'misc/popular-thing'), 'a description-only match must not beat name matches because of downloads');
  assert.equal(results[0].command, 'npx claude-code-templates@latest --agent database/postgres-pro');
  assert.match(results[0].page, /utm_source=cli&utm_medium=search$/);
  assert.deepEqual(searchCatalog('   ', catalog), { results: [], total: 0 });
  assert.equal(searchCatalog('postgres nothing-matches-this', catalog).total, 0);
});

test('pageUrl and stackCommand', () => {
  assert.equal(pageUrl({ type: 'skills', path: 'a/b' }), 'https://www.aitmpl.com/component/skills/a/b?utm_source=cli&utm_medium=install');
  assert.equal(
    stackCommand([{ type: 'agent', name: 'a/b' }, { type: 'skill', name: 'c/d' }, { type: 'agent', name: 'e/f' }, { type: 'plugin', name: 'p/q', retryFlags: '--scope user' }]),
    'npx claude-code-templates@latest --agent a/b,e/f --skill c/d --plugin p/q --scope user'
  );
});

// --- --setting into a settings file that already has hooks -------------

test('--setting keeps the hooks already configured for the same event', async () => {
  process.env.CCT_NO_TRACKING = 'true';
  const { createClaudeConfig } = require('../../src/index');
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cct-setting-hooks-'));
  const settingsFile = path.join(dir, '.claude', 'settings.local.json');
  const mine = { matcher: 'Bash', hooks: [{ type: 'command', command: './my-guard.sh' }] };
  const theirs = { matcher: 'Bash', hooks: [{ type: 'command', command: './setting-guard.sh' }] };
  fs.mkdirSync(path.dirname(settingsFile));
  fs.writeFileSync(settingsFile, JSON.stringify({ hooks: { PreToolUse: [mine] } }));

  const realFetch = global.fetch;
  const realLog = console.log;
  global.fetch = async url => String(url).endsWith('/settings/demo/guard.json')
    ? new Response(JSON.stringify({ description: 'demo', hooks: { PreToolUse: [theirs] } }))
    : new Response('not found', { status: 404 });
  console.log = () => {};
  try {
    await createClaudeConfig({ setting: 'demo/guard', directory: dir, yes: true });
    await createClaudeConfig({ setting: 'demo/guard', directory: dir, yes: true });
  } finally {
    global.fetch = realFetch;
    console.log = realLog;
  }

  const { hooks } = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  assert.deepEqual(hooks.PreToolUse, [mine, theirs], 'the existing hook stays and installing twice adds the setting\'s hook once');

  // Same entry with its keys in another order (hand edit, formatter) is not added again.
  fs.writeFileSync(settingsFile, JSON.stringify({ hooks: { PreToolUse: [mine, { hooks: theirs.hooks, matcher: theirs.matcher }] } }));
  global.fetch = async url => String(url).endsWith('/settings/demo/guard.json')
    ? new Response(JSON.stringify({ description: 'demo', hooks: { PreToolUse: [theirs] } }))
    : new Response('not found', { status: 404 });
  console.log = () => {};
  try {
    await createClaudeConfig({ setting: 'demo/guard', directory: dir, yes: true });
  } finally {
    global.fetch = realFetch;
    console.log = realLog;
  }
  assert.equal(JSON.parse(fs.readFileSync(settingsFile, 'utf8')).hooks.PreToolUse.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});
