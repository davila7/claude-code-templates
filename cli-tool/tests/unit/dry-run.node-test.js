'use strict';

// --dry-run must report the plan and write nothing. Documented in
// docs-site/installation.mdx ("lists every file the install would write and
// changes nothing") and implemented in cli-rust's print_dry_run(); the Node CLI
// wrote every file anyway for component installs, and installed template agents
// before its own dry-run check.
// Needs the CLI's dependencies: npm ci, then
//   node --test cli-tool/tests/unit/dry-run.node-test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The template path only carries agents when the interactive prompts return
// them, and installing them is what the base code did before its own dry-run
// check. Both seams are stubbed before index.js loads them.
const promptsPath = require.resolve('../../src/prompts');
const agentsPath = require.resolve('../../src/agents');
const installedTemplateAgents = [];
require.cache[promptsPath] = {
  id: promptsPath,
  filename: promptsPath,
  loaded: true,
  exports: {
    createPrompts: () => [],
    interactivePrompts: async () => ({
      language: 'python',
      framework: 'none',
      commands: [],
      hooks: [],
      mcps: [],
      agents: ['frontend-developer'],
      confirm: true
    })
  }
};
const realAgents = require('../../src/agents');
require.cache[agentsPath] = {
  id: agentsPath,
  filename: agentsPath,
  loaded: true,
  exports: {
    ...realAgents,
    installAgents: async (names) => { installedTemplateAgents.push(...names); return true; }
  }
};

const { createClaudeConfig, dryRunDestinations } = require('../../src/index');
const { trackingService } = require('../../src/tracking-service');

const AGENT_MD = '---\nname: demo-agent\ndescription: demo agent for the dry-run test\n---\n# Demo\n';

// A scratch directory the target guard accepts: on Windows os.tmpdir() is under
// the system folder, which the CLI refuses to install into by design.
function scratchDir(t) {
  const base = process.platform === 'win32' ? process.cwd() : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(base, 'cct-dry-run-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Catalog lookups are best effort and allowed; any component download during a
// dry run is the bug, so it is recorded.
const CATALOG_RE = /\/(api\/v1|catalog-v1)\/|dashboard\/public\/api\/v1/;

function stubNetwork() {
  const componentTraffic = [];
  const fetchImpl = async (url) => {
    const u = String(url);
    if (CATALOG_RE.test(u)) {
      if (u.endsWith('version.json')) return Response.json({ schemaVersion: '1.1.0', sha256: 'x', count: 0, counts: {} });
      return Response.json({ components: [] });
    }
    componentTraffic.push(u);
    return new Response('a dry run must not download ' + u, { status: 500 });
  };
  return { fetchImpl, componentTraffic };
}

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(trackingService, 'trackDownload', () => {});
  t.mock.method(trackingService, 'trackInstallationOutcome', () => {});
  t.mock.method(trackingService, 'trackCommandExecution', () => {});
  t.mock.method(trackingService, 'trackTemplateInstallation', () => {});
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    out.push(full);
    if (entry.isDirectory()) out.push(...listFiles(full));
  }
  return out.map(f => path.relative(dir, f).split(path.sep).join('/')).sort();
}

function withFetch(t, fetchImpl) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  t.after(() => { globalThis.fetch = realFetch; });
}

test('--dry-run writes nothing and downloads no component', async (t) => {
  const dir = scratchDir(t);
  quiet(t);
  const { fetchImpl, componentTraffic } = stubNetwork();
  withFetch(t, fetchImpl);

  await createClaudeConfig({
    agent: 'development-team/frontend-developer',
    command: 'security/security-audit',
    skill: 'development/demo-skill',
    directory: dir,
    dryRun: true,
    yes: true
  });

  assert.deepEqual(componentTraffic, [], 'a dry run must not download a component');
  assert.deepEqual(listFiles(dir), [], 'a dry run must not create anything');
});

test('--dry-run with a template installs no agent and writes no CLAUDE.md', async (t) => {
  const dir = scratchDir(t);
  quiet(t);
  const { fetchImpl, componentTraffic } = stubNetwork();
  withFetch(t, fetchImpl);
  installedTemplateAgents.length = 0;

  await createClaudeConfig({ directory: dir, dryRun: true });

  assert.deepEqual(installedTemplateAgents, [], 'a dry run must not install the agents the template selected');
  assert.deepEqual(componentTraffic, [], 'a dry run must not download an agent');
  assert.deepEqual(listFiles(dir), [], 'a dry run must not create anything');
});

test('without --dry-run the same component install still writes the agent', async (t) => {
  const dir = scratchDir(t);
  quiet(t);
  const { fetchImpl } = stubNetwork();
  withFetch(t, async (url) => {
    if (String(url).includes('components/agents/development-team/frontend-developer.md')) return new Response(AGENT_MD);
    return fetchImpl(url);
  });

  await createClaudeConfig({ agent: 'development-team/frontend-developer', directory: dir, yes: true });

  assert.equal(
    fs.readFileSync(path.join(dir, '.claude/agents/frontend-developer.md'), 'utf8'),
    AGENT_MD,
    'the guard must apply to --dry-run only'
  );
});

test('--dry-run with a workflow installs no component and writes no YAML', async (t) => {
  const dir = scratchDir(t);
  quiet(t);
  const { fetchImpl, componentTraffic } = stubNetwork();
  withFetch(t, fetchImpl);

  await createClaudeConfig({ workflow: '#demo123', directory: dir, dryRun: true });

  assert.deepEqual(componentTraffic, [], 'a dry run must not download a workflow component');
  assert.deepEqual(listFiles(dir), [], 'a dry run must not create anything');
});

test('dryRunDestinations names the path each installer writes to', () => {  assert.deepEqual(
    dryRunDestinations([
      { type: 'agent', name: 'development-team/frontend-developer' },
      { type: 'command', name: 'security/security-audit' },
      { type: 'mcp', name: 'database/supabase' },
      { type: 'skill', name: 'development/demo-skill' },
      { type: 'loop', name: 'engineering/docs-sweep-loop' },
      { type: 'mod', name: 'ui/stack-viewer' }
    ]),
    [
      'agents/development-team/frontend-developer.md → .claude/agents/frontend-developer.md',
      'commands/security/security-audit.md → .claude/commands/security-audit.md',
      'mcps/database/supabase.json → .mcp.json',
      'skills/development/demo-skill/ → .claude/skills/demo-skill/',
      'loops/engineering/docs-sweep-loop.md → .claude/loops/docs-sweep-loop.md (+ referenced components)',
      'mods/ui/stack-viewer/ → .claude/skills/stack-viewer/'
    ]
  );
  assert.match(dryRunDestinations([{ type: 'plugin', name: 'productivity/champion-kit' }])[0], /plugins\/cache\/aitmpl/);
});
