'use strict';

// node --test cli-tool/tests/unit/plugin-install.node-test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  MARKETPLACE_URL,
  parsePluginRef,
  normalizeScope,
  fetchMarketplace,
  findEntry,
  settingsFile,
  runClaude,
  lastJsonLine,
  installWithClaude,
  installWithSettings,
  sameNameElsewhere,
  installedPath,
  manualCommands
} = require('../../src/plugin-install');

const SHA = '0412be76f50ab4f4f8abff3753efa9269fbbca5b';
const MARKETPLACE = {
  name: 'aitmpl',
  owner: { name: 'aitmpl.com' },
  plugins: [{
    name: 'champion-kit',
    category: 'productivity',
    source: { source: 'git-subdir', url: 'https://github.com/anthropics/claude-plugins-official.git', path: 'plugins/champion-kit', sha: SHA }
  }]
};

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cct-plugin-'));
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('CCT_MARKETPLACE_URL only swaps in another https marketplace.json', () => {
  const { marketplaceUrl } = require('../../src/plugin-install');
  const raw = 'https://raw.githubusercontent.com/davila7/claude-code-templates/some-branch/dashboard/public/marketplace.json';
  assert.equal(marketplaceUrl({}), MARKETPLACE_URL);
  assert.equal(marketplaceUrl({ CCT_MARKETPLACE_URL: raw }), raw);
  for (const bad of ['http://example.com/marketplace.json', 'https://example.com/x.json', 'https://e.com/a b/marketplace.json', 'file:///tmp/marketplace.json']) {
    assert.equal(marketplaceUrl({ CCT_MARKETPLACE_URL: bad }), MARKETPLACE_URL, bad);
  }
});

test('plugin refs: name or category/name, nothing else', () => {
  assert.deepEqual(parsePluginRef('champion-kit'), { category: null, name: 'champion-kit' });
  assert.deepEqual(parsePluginRef(' productivity/champion-kit '), { category: 'productivity', name: 'champion-kit' });
  for (const bad of ['', '../x', 'a/b/c', 'Champion', 'x;rm -rf', 'a/..b', '-x', 'kit@aitmpl']) {
    assert.equal(parsePluginRef(bad), null, bad);
  }
});

test('scopes: project by default, only the three Claude Code accepts', () => {
  assert.equal(normalizeScope(undefined), 'project');
  assert.equal(normalizeScope('User'), 'user');
  assert.equal(normalizeScope('local'), 'local');
  assert.equal(normalizeScope('managed'), null);
  assert.equal(normalizeScope('project;x'), null);
});

test('a retry repeats a non-default scope, and only a valid one', () => {
  const { cliScopeFlag } = require('../../src/plugin-install');
  assert.equal(cliScopeFlag(undefined), '');
  assert.equal(cliScopeFlag('project'), '');
  assert.equal(cliScopeFlag('User'), '--scope user');
  assert.equal(cliScopeFlag('local'), '--scope local');
  assert.equal(cliScopeFlag('managed; rm -rf ~'), '');
});

test('fetchMarketplace reads the published file and rejects anything else', async () => {
  const seen = [];
  const data = await fetchMarketplace(async url => { seen.push(url); return jsonResponse(MARKETPLACE); });
  assert.deepEqual(seen, [MARKETPLACE_URL]);
  assert.equal(data.plugins.length, 1);
  await assert.rejects(fetchMarketplace(async () => jsonResponse({}, 503)), /HTTP 503/);
  await assert.rejects(fetchMarketplace(async () => jsonResponse({ name: 'other', plugins: [] })), /unexpected format/);
});

test('findEntry: by name, category must match, entry must be pinned', () => {
  assert.equal(findEntry(MARKETPLACE, { category: null, name: 'champion-kit' }).entry.name, 'champion-kit');
  assert.equal(findEntry(MARKETPLACE, { category: 'productivity', name: 'champion-kit' }).entry.category, 'productivity');
  assert.equal(findEntry(MARKETPLACE, { category: 'security', name: 'champion-kit' }).error, 'wrong_category');
  assert.equal(findEntry(MARKETPLACE, { category: null, name: 'nope' }).error, 'not_found');
  const unpinned = { ...MARKETPLACE, plugins: [{ ...MARKETPLACE.plugins[0], source: { source: 'github', repo: 'a/b' } }] };
  assert.equal(findEntry(unpinned, { category: null, name: 'champion-kit' }).error, 'not_pinned');
});

test('settings file per scope', () => {
  const env = { CLAUDE_CONFIG_DIR: '/cfg' };
  assert.equal(settingsFile('project', '/repo', env), path.join('/repo', '.claude', 'settings.json'));
  assert.equal(settingsFile('local', '/repo', env), path.join('/repo', '.claude', 'settings.local.json'));
  assert.equal(settingsFile('user', '/repo', env), path.join('/cfg', 'settings.json'));
});

test('lastJsonLine picks the result line', () => {
  assert.deepEqual(lastJsonLine('Cloning...\n{"outcome":"ok"}\n'), { outcome: 'ok' });
  assert.equal(lastJsonLine('no json here'), null);
});

test('runClaude refuses arguments that are not plain tokens', () => {
  assert.throws(() => runClaude(['plugin', 'install', 'x; rm -rf /']), /unexpected argument/);
  assert.throws(() => runClaude(['plugin', 'install', '$(id)']), /unexpected argument/);
});

test('runClaude reports a missing claude', async () => {
  const { EventEmitter } = require('events');
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })));
    return child;
  };
  const result = await runClaude(['--version'], { spawnImpl });
  assert.equal(result.missing, true);
});

test('installWithClaude adds the marketplace, then installs name@aitmpl in that scope', async () => {
  const calls = [];
  const run = async (args, opts) => {
    calls.push({ args, cwd: opts.cwd });
    if (args[1] === 'marketplace') return { code: 0, stdout: '{"command":"marketplace-add","outcome":"ok"}' };
    return { code: 0, stdout: '{"command":"install","outcome":"ok","pluginId":"champion-kit@aitmpl","scope":"user"}' };
  };
  const out = await installWithClaude({ name: 'champion-kit', scope: 'user', targetDir: '/repo', run });
  assert.equal(out.method, 'claude');
  assert.deepEqual(calls.map(c => c.args), [
    ['plugin', 'marketplace', 'add', MARKETPLACE_URL, '--scope', 'user', '--json'],
    ['plugin', 'install', 'champion-kit@aitmpl', '--scope', 'user', '--json']
  ]);
  assert.ok(calls.every(c => c.cwd === '/repo'), 'runs in the target folder, where project scope is written');
});

test('installWithClaude refreshes a stale marketplace once on not_found', async () => {
  const calls = [];
  let installs = 0;
  const run = async args => {
    calls.push(args.slice(0, 3).join(' '));
    if (args[1] === 'marketplace') return { code: 0, stdout: '{"outcome":"ok"}' };
    installs += 1;
    return installs === 1
      ? { code: 1, stdout: '{"outcome":"failed","failureCode":"not_found","message":"Plugin \\"champion-kit\\" not found"}' }
      : { code: 0, stdout: '{"outcome":"ok"}' };
  };
  await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run });
  assert.deepEqual(calls, ['plugin marketplace add', 'plugin install champion-kit@aitmpl', 'plugin marketplace update', 'plugin install champion-kit@aitmpl']);
});

test('installWithClaude surfaces Claude Code\'s own message', async () => {
  const run = async args => (args[1] === 'marketplace'
    ? { code: 0, stdout: '{"outcome":"ok"}' }
    : { code: 1, stdout: '{"outcome":"failed","failureCode":"network","message":"Failed to clone repository"}' });
  await assert.rejects(installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run }), /Failed to clone repository/);
  const missing = await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run: async () => ({ missing: true }) });
  assert.deepEqual(missing, { missing: true });
});

test('installWithSettings declares the marketplace and enables the plugin, keeping the rest', async () => {
  const dir = tmpdir();
  const file = path.join(dir, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    permissions: { allow: ['Bash(ls)'] },
    enabledPlugins: { 'other@x': true },
    extraKnownMarketplaces: { aitmpl: { source: { source: 'url', url: MARKETPLACE_URL }, autoUpdate: true } }
  }));
  const out = await installWithSettings({ name: 'champion-kit', scope: 'project', targetDir: dir });
  assert.equal(out.file, file);
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(settings.permissions, { allow: ['Bash(ls)'] });
  assert.deepEqual(settings.enabledPlugins, { 'other@x': true, 'champion-kit@aitmpl': true });
  assert.equal(settings.extraKnownMarketplaces.aitmpl.autoUpdate, true, 'an existing declaration is kept');

  // A new file gets the url source.
  const fresh = tmpdir();
  await installWithSettings({ name: 'champion-kit', scope: 'local', targetDir: fresh });
  const local = JSON.parse(fs.readFileSync(path.join(fresh, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(local.extraKnownMarketplaces, { aitmpl: { source: { source: 'url', url: MARKETPLACE_URL } } });
});

test('installWithSettings never overwrites a settings file it cannot parse', async () => {
  const dir = tmpdir();
  const file = path.join(dir, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ "permissions": ');
  await assert.rejects(installWithSettings({ name: 'champion-kit', scope: 'project', targetDir: dir }), /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "permissions": ');
});

test('same-named plugins from another marketplace are reported', async () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
    enabledPlugins: { 'champion-kit@claude-plugins-official': true, 'champion-kit@aitmpl': true, 'champion-kit@off': false }
  }));
  assert.deepEqual(await sameNameElsewhere('champion-kit', 'project', dir), ['champion-kit@claude-plugins-official']);
});

test('installedPath reads installed_plugins.json for the scope and project', async () => {
  const cfg = tmpdir();
  const repo = tmpdir();
  fs.mkdirSync(path.join(cfg, 'plugins'));
  fs.writeFileSync(path.join(cfg, 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: {
      'champion-kit@aitmpl': [
        { scope: 'project', projectPath: '/elsewhere', installPath: '/cache/other' },
        { scope: 'project', projectPath: repo, installPath: '/cache/aitmpl/champion-kit/0.5.0' }
      ]
    }
  }));
  const env = { CLAUDE_CONFIG_DIR: cfg };
  assert.equal(await installedPath('champion-kit', 'project', repo, env), '/cache/aitmpl/champion-kit/0.5.0');
  assert.equal(await installedPath('champion-kit', 'user', repo, env), null);
});

test('manual commands name the marketplace URL and scope', () => {
  assert.deepEqual(manualCommands('champion-kit', 'project'), [
    `claude plugin marketplace add ${MARKETPLACE_URL} --scope project`,
    'claude plugin install champion-kit@aitmpl --scope project'
  ]);
  assert.deepEqual(manualCommands('champion-kit', 'user'), [
    `claude plugin marketplace add ${MARKETPLACE_URL}`,
    'claude plugin install champion-kit@aitmpl'
  ]);
});
