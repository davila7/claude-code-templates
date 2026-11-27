'use strict';

/**
 * --plugin: install a catalog plugin through Claude Code's own plugin system.
 *
 * A catalog plugin is a whole Claude Code plugin (skills, agents, commands,
 * hooks, MCP servers...) that lives in its author's repository. The catalog
 * pins it to the commit that was reviewed (cli-tool/components/plugins/
 * {category}/{name}/source.json), and scripts/external_skills.py publishes all
 * of them as the "aitmpl" marketplace at MARKETPLACE_URL. Installing one is what
 * a person would type:
 *
 *   claude plugin marketplace add https://www.aitmpl.com/marketplace.json --scope <scope>
 *   claude plugin install <name>@aitmpl --scope <scope>
 *
 * so Claude Code downloads it into ~/.claude/plugins/cache/aitmpl/<name>/<version>/,
 * records it in the scope's settings file, and /plugin, `claude plugin update`
 * and uninstall treat it like any marketplace plugin. Nothing is copied into
 * .claude/skills/.
 *
 * Without the `claude` command, the same two settings keys
 * (extraKnownMarketplaces.aitmpl and enabledPlugins["<name>@aitmpl"]) are
 * written directly; Claude Code adds the marketplace and fetches the plugin the
 * next time it starts (for a project, once the folder is trusted).
 *
 * The claude command must be MIN_CLAUDE_VERSION or later (checked first, before
 * anything is written). Tested against each release: 2.1.68 rejects the whole
 * marketplace (git-subdir sources came in 2.1.69), --json came to `plugin
 * install` in 2.1.268 and to `plugin marketplace add|update` in 2.1.287, and
 * 2.1.288 fixed git-subdir installs that failed or cached an incomplete plugin
 * on git older than 2.39.
 */

const path = require('path');
// Built-ins only: the root test job (version-sync.yml) runs without npm install.
const fs = require('fs/promises');
const { spawnClaude } = require('./claude-launcher');
const { claudeConfigDir } = require('./claude-paths');

// Same values as scripts/external_skills.py and dashboard/src/lib/constants.ts.
const MARKETPLACE_NAME = 'aitmpl';
const MARKETPLACE_URL = 'https://www.aitmpl.com/marketplace.json';
const SCOPES = ['project', 'user', 'local'];
const DEFAULT_SCOPE = 'project';
const MIN_CLAUDE_VERSION = '2.1.288';
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
const VERSION_TIMEOUT_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;

// "name" or "category/name", as on the site; the marketplace itself is flat.
const PLUGIN_REF_RE = /^(?:([a-z0-9][a-z0-9-]*)\/)?([a-z0-9][a-z0-9.-]{0,63})$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
// Every argument passed to claude is built from validated values; this is the
// last check before one reaches a process (and cmd.exe on Windows).
const SAFE_ARG_RE = /^[A-Za-z0-9@:/._=-]+$/;
const OVERRIDE_URL_RE = /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9@:/._=-]*marketplace\.json$/;

/**
 * The marketplace to install from. CCT_MARKETPLACE_URL points a test run at
 * another copy of the same file (e.g. a branch's raw.githubusercontent URL);
 * it must still be an https URL of a marketplace.json named "aitmpl".
 */
function marketplaceUrl(env = process.env) {
  const override = env.CCT_MARKETPLACE_URL;
  return override && OVERRIDE_URL_RE.test(override) ? override : MARKETPLACE_URL;
}

/** Parse --plugin input. Returns { category, name } or null. */
function parsePluginRef(input) {
  const match = PLUGIN_REF_RE.exec(String(input || '').trim());
  if (!match || match[2].includes('..')) return null;
  return { category: match[1] || null, name: match[2] };
}

/** The scope to install into, or null when it is not one Claude Code accepts. */
function normalizeScope(scope) {
  if (scope === undefined || scope === null || scope === '' || scope === true) return DEFAULT_SCOPE;
  const value = String(scope).trim().toLowerCase();
  return SCOPES.includes(value) ? value : null;
}

/** The --scope flag this CLI needs to repeat an install ('' for the default or an invalid scope). */
function cliScopeFlag(scope) {
  const value = normalizeScope(scope);
  return value && value !== DEFAULT_SCOPE ? `--scope ${value}` : '';
}

function isTimeout(error) {
  return Boolean(error) && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Fetch and sanity-check the aitmpl marketplace (FETCH_TIMEOUT_MS for the whole read). */
async function fetchMarketplace(fetchImpl = fetch, env = process.env) {
  const url = marketplaceUrl(env);
  const timedOut = () => new Error(`The aitmpl marketplace did not answer within ${FETCH_TIMEOUT_MS / 1000} seconds (${url})`);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': 'claude-code-templates' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    throw isTimeout(error) ? timedOut() : error;
  }
  if (!response.ok) throw new Error(`Could not read the aitmpl marketplace (HTTP ${response.status})`);
  let data;
  try {
    data = await response.json();
  } catch (error) {
    // The signal also covers the body, so a stalled download ends here.
    if (isTimeout(error)) throw timedOut();
    throw new Error('The aitmpl marketplace is not valid JSON');
  }
  if (!data || data.name !== MARKETPLACE_NAME || !Array.isArray(data.plugins)) {
    throw new Error('The aitmpl marketplace has an unexpected format');
  }
  return data;
}

/**
 * The marketplace entry for a parsed ref. A category that does not match the
 * entry's is an error rather than a silent install of another plugin.
 */
function findEntry(marketplace, ref) {
  const entry = marketplace.plugins.find(p => p && p.name === ref.name);
  if (!entry) return { error: 'not_found' };
  if (ref.category && entry.category && entry.category !== ref.category) {
    return { error: 'wrong_category', entry };
  }
  const sha = entry.source && entry.source.sha;
  if (!COMMIT_RE.test(String(sha || ''))) return { error: 'not_pinned', entry };
  return { entry };
}

/** The settings file Claude Code records a plugin in for each scope. */
function settingsFile(scope, targetDir, env = process.env) {
  if (scope === 'user') return path.join(claudeConfigDir(env), 'settings.json');
  return path.join(targetDir, '.claude', scope === 'local' ? 'settings.local.json' : 'settings.json');
}

/** Run `claude <args>` without a shell on POSIX; resolves { code, stdout, stderr, missing }. */
function runClaude(args, { cwd, timeoutMs = INSTALL_TIMEOUT_MS, spawnImpl = spawnClaude } = {}) {
  for (const arg of args) {
    if (!SAFE_ARG_RE.test(arg)) throw new Error(`refusing to pass an unexpected argument to claude: ${arg}`);
  }
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;
    const done = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, ...result });
    };
    let child;
    try {
      child = spawnImpl(args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    } catch (error) {
      done({ code: null, missing: error.code === 'ENOENT', error });
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      done({ code: null, timedOut: true });
    }, timeoutMs);
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('error', error => done({ code: null, missing: error.code === 'ENOENT', error }));
    // Through cmd.exe (Windows) a missing claude is exit code 9009, not ENOENT.
    child.on('close', code => done({
      code,
      missing: process.platform === 'win32' && (code === 9009 || /is not recognized as an internal or external command/i.test(stderr))
    }));
  });
}

/** The last line of stdout that parses as a JSON object (claude --json prints one). */
function lastJsonLine(stdout) {
  const lines = String(stdout || '').trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // not the result line
    }
  }
  return null;
}

function failureText(result, fallback) {
  const json = lastJsonLine(result.stdout);
  if (json && json.message) return json.message;
  if (result.timedOut) return `claude did not finish within ${Math.round(INSTALL_TIMEOUT_MS / 60000)} minutes`;
  const text = `${result.stderr || ''}\n${result.stdout || ''}`.trim().split(/\r?\n/).filter(Boolean).pop();
  return text || fallback;
}

/** [major, minor, patch] from `claude --version` output ("2.1.319 (Claude Code)"), or null. */
function parseClaudeVersion(text) {
  const match = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''));
  return match ? match.slice(1, 4).map(Number) : null;
}

function isOlderVersion(version, minimum) {
  for (let i = 0; i < 3; i += 1) {
    if (version[i] !== minimum[i]) return version[i] < minimum[i];
  }
  return false;
}

/**
 * Install with the claude CLI. Returns { method: 'claude', result } on success,
 * { missing: true } when claude is not installed, or throws with Claude Code's
 * own message (code 'claude_too_old' when it is older than MIN_CLAUDE_VERSION).
 */
async function installWithClaude({ name, scope, targetDir, run = runClaude, env = process.env }) {
  const pluginId = `${name}@${MARKETPLACE_NAME}`;
  const probe = await run(['--version'], { cwd: targetDir, timeoutMs: VERSION_TIMEOUT_MS });
  if (probe.missing) return { missing: true };
  if (probe.timedOut) throw new Error(`claude --version did not answer within ${VERSION_TIMEOUT_MS / 1000} seconds`);
  // Output this CLI cannot read is not a reason to refuse: newer builds may print more.
  const version = parseClaudeVersion(probe.stdout);
  if (version && isOlderVersion(version, parseClaudeVersion(MIN_CLAUDE_VERSION))) {
    throw Object.assign(new Error(
      `Claude Code ${version.join('.')} is too old to install plugins from the aitmpl marketplace: ` +
      `it needs ${MIN_CLAUDE_VERSION} or later. Update it with "claude update", then run this again.`
    ), { code: 'claude_too_old' });
  }

  const add = await run(['plugin', 'marketplace', 'add', marketplaceUrl(env), '--scope', scope, '--json'], { cwd: targetDir });
  if (add.missing) return { missing: true };
  if (add.code !== 0) throw new Error(failureText(add, 'claude plugin marketplace add failed'));

  const installArgs = ['plugin', 'install', pluginId, '--scope', scope, '--json'];
  let install = await run(installArgs, { cwd: targetDir });
  if (install.code !== 0 && (lastJsonLine(install.stdout) || {}).failureCode === 'not_found') {
    // A copy of the marketplace from before this plugin was listed: refresh it once.
    await run(['plugin', 'marketplace', 'update', MARKETPLACE_NAME, '--json'], { cwd: targetDir });
    install = await run(installArgs, { cwd: targetDir });
  }
  if (install.code !== 0) throw new Error(failureText(install, 'claude plugin install failed'));
  return { method: 'claude', result: lastJsonLine(install.stdout) || {} };
}

/** Read a settings file; a missing file is {}, an unreadable one throws (never overwritten). */
async function readSettings(file) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  if (!text.trim()) return {};
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON (${error.message}); fix it and run the install again`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file} must hold a JSON object`);
  return data;
}

/**
 * Declare the marketplace and enable the plugin in the scope's settings file,
 * as `claude plugin marketplace add` and `claude plugin install` would.
 */
async function installWithSettings({ name, scope, targetDir, env = process.env }) {
  const file = settingsFile(scope, targetDir, env);
  const settings = await readSettings(file);
  const known = settings.extraKnownMarketplaces && typeof settings.extraKnownMarketplaces === 'object'
    ? settings.extraKnownMarketplaces : {};
  const enabled = settings.enabledPlugins && typeof settings.enabledPlugins === 'object'
    ? settings.enabledPlugins : {};
  settings.extraKnownMarketplaces = {
    ...known,
    // An existing declaration (e.g. with autoUpdate) is kept as it is.
    [MARKETPLACE_NAME]: known[MARKETPLACE_NAME] || { source: { source: 'url', url: marketplaceUrl(env) } }
  };
  settings.enabledPlugins = { ...enabled, [`${name}@${MARKETPLACE_NAME}`]: true };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(settings, null, 2) + '\n');
  return { method: 'settings', file };
}

/**
 * Other enabled plugins with the same name from another marketplace. Claude Code
 * loads both, but only one copy's hooks run.
 */
async function sameNameElsewhere(name, scope, targetDir, env = process.env) {
  try {
    const settings = await readSettings(settingsFile(scope, targetDir, env));
    return Object.entries(settings.enabledPlugins || {})
      .filter(([id, on]) => on && id.startsWith(`${name}@`) && id !== `${name}@${MARKETPLACE_NAME}`)
      .map(([id]) => id);
  } catch {
    return [];
  }
}

/** Where Claude Code put the plugin's files, from installed_plugins.json (best effort). */
async function installedPath(name, scope, targetDir, env = process.env) {
  try {
    const record = JSON.parse(await fs.readFile(path.join(claudeConfigDir(env), 'plugins', 'installed_plugins.json'), 'utf8'));
    const installs = (record.plugins || {})[`${name}@${MARKETPLACE_NAME}`] || [];
    const project = path.resolve(targetDir);
    const match = installs.find(i => i.scope === scope && (scope === 'user' || path.resolve(i.projectPath || '') === project))
      || installs.find(i => i.scope === scope);
    return match && match.installPath ? match.installPath : null;
  } catch {
    return null;
  }
}

/** The two commands that do the same install by hand, inside Claude Code. */
function manualCommands(name, scope, env = process.env) {
  const flag = scope === 'user' ? '' : ` --scope ${scope}`;
  return [
    `claude plugin marketplace add ${marketplaceUrl(env)}${flag}`,
    `claude plugin install ${name}@${MARKETPLACE_NAME}${flag}`
  ];
}

module.exports = {
  MARKETPLACE_NAME,
  MARKETPLACE_URL,
  SCOPES,
  DEFAULT_SCOPE,
  MIN_CLAUDE_VERSION,
  FETCH_TIMEOUT_MS,
  marketplaceUrl,
  parsePluginRef,
  normalizeScope,
  cliScopeFlag,
  fetchMarketplace,
  findEntry,
  settingsFile,
  runClaude,
  lastJsonLine,
  parseClaudeVersion,
  installWithClaude,
  installWithSettings,
  sameNameElsewhere,
  installedPath,
  manualCommands
};
