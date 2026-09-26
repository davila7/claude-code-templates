'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const scriptSource = path.join(__dirname, 'sync-package-versions.js');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'version-sync-'));
  const scriptsDirectory = path.join(root, 'scripts');
  fs.mkdirSync(scriptsDirectory);
  fs.copyFileSync(scriptSource, path.join(scriptsDirectory, 'sync-package-versions.js'));

  writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '1.2.3',
  });
  writeJson(path.join(root, 'package-lock.json'), {
    name: 'fixture',
    version: '1.2.3',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name: 'fixture', version: '1.2.3' } },
  });
  writeJson(path.join(root, 'cli-tool/package.json'), {
    name: 'fixture-cli',
    version: '1.2.3',
  });
  writeJson(path.join(root, 'cli-tool/package-lock.json'), {
    name: 'fixture-cli',
    version: '1.2.3',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name: 'fixture-cli', version: '1.2.3' } },
  });

  return root;
}

function runScript(root, ...arguments_) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts/sync-package-versions.js'), ...arguments_],
    { cwd: root, encoding: 'utf8' }
  );
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('check succeeds when every version is synchronized', (t) => {
  const root = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = runScript(root, '--check');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Package versions are synchronized at 1\.2\.3\./);
});

test('check reports every mismatch without changing any file', (t) => {
  const root = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const cliPackagePath = path.join(root, 'cli-tool/package.json');
  const cliLockPath = path.join(root, 'cli-tool/package-lock.json');
  const cliPackage = readJson(root, 'cli-tool/package.json');
  const cliLock = readJson(root, 'cli-tool/package-lock.json');
  cliPackage.version = '1.2.2';
  cliLock.version = '1.2.1';
  cliLock.packages[''].version = '1.2.0';
  writeJson(cliPackagePath, cliPackage);
  writeJson(cliLockPath, cliLock);
  const packageBefore = fs.readFileSync(cliPackagePath, 'utf8');
  const lockBefore = fs.readFileSync(cliLockPath, 'utf8');

  const result = runScript(root, '--check');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /cli-tool\/package\.json version: 1\.2\.2/);
  assert.match(result.stderr, /cli-tool\/package-lock\.json version: 1\.2\.1/);
  assert.match(result.stderr, /cli-tool\/package-lock\.json packages\[""\]\.version: 1\.2\.0/);
  assert.equal(fs.readFileSync(cliPackagePath, 'utf8'), packageBefore);
  assert.equal(fs.readFileSync(cliLockPath, 'utf8'), lockBefore);
});

test('an explicit version rewrites both manifests and lockfile roots', (t) => {
  const root = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const targetVersion = '2.0.0-beta.1+build.5';
  const result = runScript(root, targetVersion);

  assert.equal(result.status, 0);
  for (const relativePath of [
    'package.json',
    'package-lock.json',
    'cli-tool/package.json',
    'cli-tool/package-lock.json',
  ]) {
    const data = readJson(root, relativePath);
    assert.equal(data.version, targetVersion);
    if (relativePath.endsWith('package-lock.json')) {
      assert.equal(data.packages[''].version, targetVersion);
    }
  }
});

test('invalid semantic versions produce a concise user error', (t) => {
  const root = createFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = runScript(root, '1.2.3-01');

  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'Invalid semantic version: 1.2.3-01\n');
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});
