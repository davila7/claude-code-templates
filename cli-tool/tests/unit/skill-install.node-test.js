'use strict';

// --skill end to end against a stubbed GitHub: 1.33.0 wrote every file and
// then threw "source is not defined" before tracking, so each skill install
// was reported as failed and never counted.
// Needs the CLI's dependencies: npm ci, then
//   node --test cli-tool/tests/unit/skill-install.node-test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installIndividualSkill } = require('../../src/index');
const { trackingService } = require('../../src/tracking-service');

const SKILL_MD = '---\nname: demo-skill\ndescription: demo\n---\n# Demo\n';

function stubGitHub() {
  return async (url) => {
    const u = String(url);
    if (u.endsWith('/source.json')) return new Response('Not Found', { status: 404 });
    if (u.startsWith('https://api.github.com/repos/davila7/claude-code-templates/contents/cli-tool/components/skills/development/demo-skill')) {
      return Response.json([
        { type: 'file', name: 'SKILL.md', download_url: 'https://raw.example/SKILL.md' },
        { type: 'file', name: 'run.sh', download_url: 'https://raw.example/run.sh' }
      ]);
    }
    if (u === 'https://raw.example/SKILL.md') return new Response(SKILL_MD);
    if (u === 'https://raw.example/run.sh') return new Response('#!/bin/sh\necho hi\n');
    return new Response('unexpected ' + u, { status: 500 });
  };
}

test('a catalog skill installs, returns true and is tracked as a download', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-skill-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const realFetch = globalThis.fetch;
  globalThis.fetch = stubGitHub();
  t.after(() => { globalThis.fetch = realFetch; });

  const downloads = [];
  const outcomes = [];
  t.mock.method(trackingService, 'trackDownload', (...args) => { downloads.push(args); });
  t.mock.method(trackingService, 'trackInstallationOutcome', (...args) => { outcomes.push(args); });
  t.mock.method(console, 'log', () => {});

  const ok = await installIndividualSkill('development/demo-skill', dir, { silent: true });

  assert.equal(ok, true, `install failed, outcomes: ${JSON.stringify(outcomes)}`);
  assert.equal(fs.readFileSync(path.join(dir, '.claude/skills/demo-skill/SKILL.md'), 'utf8'), SKILL_MD);
  assert.ok(fs.statSync(path.join(dir, '.claude/skills/demo-skill/run.sh')).mode & 0o100, 'run.sh is executable');

  assert.equal(downloads.length, 1);
  assert.equal(downloads[0][0], 'skill');
  assert.equal(downloads[0][1], 'development/demo-skill');
  assert.equal(downloads[0][2].source, 'github_main');
  assert.equal(downloads[0][2].total_files, 2);

  assert.deepEqual(outcomes.map((o) => o[2]), ['success']);
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
