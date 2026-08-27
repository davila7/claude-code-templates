/**
 * Agent Plugins (open standard) bundle installer.
 *
 * Installs plugin bundles published at www.aitmpl.com/agent-plugins/ (built
 * by scripts/build_agent_plugins.js from cli-tool/components/). A bundle is
 * downloaded file-by-file from its files.json manifest with sha256
 * verification, unpacked into {targetDir}/.agent-plugins/{name}/ (the pure
 * spec layout), and then activated into the familiar .claude/ destinations:
 *
 *   skills/*                    -> .claude/skills/{skill}/
 *   mcp.json mcpServers         -> merged into {targetDir}/.mcp.json
 *   com.aitmpl.claude-code/agents|commands|loops -> .claude/{type}/ (flat)
 *
 * Hooks and settings inside a bundle are unpacked but NOT auto-activated —
 * their interactive multi-location merge belongs to the existing --hook /
 * --setting flows, which the installer points the user to.
 *
 * Failure model follows the spec: an invalid plugin.json rejects the whole
 * plugin; an invalid individual skill is skipped with a warning while the
 * rest activates.
 */

const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');
const fs = require('fs-extra');

const { trackingService } = require('./tracking-service');

const DEFAULT_REGISTRY_URL = 'https://www.aitmpl.com/agent-plugins';
const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const PLUGIN_NAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const EXTENSION_NAMESPACE = 'com.aitmpl.claude-code';

function registryBaseUrl() {
  return (process.env.CCT_PLUGIN_REGISTRY_URL || DEFAULT_REGISTRY_URL).replace(/\/+$/, '');
}

/** Fetch with the same 3-retry exponential backoff used for template
 * downloads (file-operations.js). 404 is returned, not retried. */
async function fetchWithRetry(url, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return response;
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

/** Reject anything that could escape the install directory (zip-slip):
 * absolute paths, drive letters, backslashes, `..` or empty segments. */
function isSafeRelativePath(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return false;
  if (relPath.includes('\\') || relPath.startsWith('/') || /^[A-Za-z]:/.test(relPath)) return false;
  return relPath.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Merge an MCP configuration into {targetDir}/.mcp.json.
 *
 * Extracted from installIndividualMCP (src/index.js) so the bundle
 * activation path shares the exact same semantics: per-server `description`
 * keys are stripped, existing servers are preserved, same-name servers are
 * overwritten by the incoming config, output written with 2-space indent.
 */
async function mergeMcpServers(targetDir, incomingConfig) {
  const mcpConfig = { ...incomingConfig };
  delete mcpConfig.$schema; // bundle mcp.json carries the spec $schema; user config should not

  if (mcpConfig.mcpServers) {
    mcpConfig.mcpServers = { ...mcpConfig.mcpServers };
    for (const serverName in mcpConfig.mcpServers) {
      if (mcpConfig.mcpServers[serverName] && typeof mcpConfig.mcpServers[serverName] === 'object') {
        const server = { ...mcpConfig.mcpServers[serverName] };
        delete server.description;
        mcpConfig.mcpServers[serverName] = server;
      }
    }
  }

  const targetMcpFile = path.join(targetDir, '.mcp.json');
  let existingConfig = {};
  if (await fs.pathExists(targetMcpFile)) {
    existingConfig = await fs.readJson(targetMcpFile);
    console.log(chalk.yellow('📝 Existing .mcp.json found, merging configurations...'));
  }

  const mergedConfig = {
    ...existingConfig,
    ...mcpConfig,
  };
  if (existingConfig.mcpServers && mcpConfig.mcpServers) {
    mergedConfig.mcpServers = {
      ...existingConfig.mcpServers,
      ...mcpConfig.mcpServers,
    };
  }

  await fs.writeJson(targetMcpFile, mergedConfig, { spaces: 2 });
  return mergedConfig;
}

async function activateBundle(bundleDir, targetDir, warnings) {
  const activated = { skills: 0, mcpServers: 0, agents: 0, commands: 0, loops: 0 };

  const skillsDir = path.join(bundleDir, 'skills');
  if (await fs.pathExists(skillsDir)) {
    for (const entry of await fs.readdir(skillsDir)) {
      const skillDir = path.join(skillsDir, entry);
      if (!(await fs.stat(skillDir)).isDirectory()) continue;
      if (!(await fs.pathExists(path.join(skillDir, 'SKILL.md')))) {
        warnings.push(`skill "${entry}" has no SKILL.md — skipped (rest of the plugin still loads)`);
        continue;
      }
      await fs.copy(skillDir, path.join(targetDir, '.claude', 'skills', entry));
      activated.skills++;
    }
  }

  const mcpFile = path.join(bundleDir, 'mcp.json');
  if (await fs.pathExists(mcpFile)) {
    const mcpConfig = await fs.readJson(mcpFile).catch(() => null);
    if (mcpConfig && mcpConfig.mcpServers) {
      const merged = await mergeMcpServers(targetDir, { mcpServers: mcpConfig.mcpServers });
      activated.mcpServers = Object.keys(mcpConfig.mcpServers).length;
      void merged;
    } else {
      warnings.push('mcp.json is invalid — MCP configuration disabled, other components still load');
    }
  }

  for (const [bucket, destDir] of [['agents', 'agents'], ['commands', 'commands'], ['loops', 'loops']]) {
    const srcDir = path.join(bundleDir, EXTENSION_NAMESPACE, bucket);
    if (!(await fs.pathExists(srcDir))) continue;
    const stack = [srcDir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of await fs.readdir(current)) {
        const p = path.join(current, entry);
        if ((await fs.stat(p)).isDirectory()) stack.push(p);
        else if (entry.endsWith('.md')) {
          // Flat install, category stripped — same layout the individual
          // --agent/--command/--loop installers produce.
          await fs.copy(p, path.join(targetDir, '.claude', destDir, entry));
          activated[bucket]++;
        }
      }
    }
  }

  for (const bucket of ['hooks', 'settings']) {
    if (await fs.pathExists(path.join(bundleDir, EXTENSION_NAMESPACE, bucket))) {
      warnings.push(
        `bundle includes ${bucket} — not auto-activated; install them with the --${bucket.slice(0, -1)} flag to choose settings locations interactively`
      );
    }
  }

  return activated;
}

/**
 * Install one Agent Plugins bundle by name from the aitmpl.com registry.
 * Mirrors the installIndividual* contract: returns true on success, false
 * on failure, and never throws for expected error paths.
 */
async function installIndividualPlugin(pluginName, targetDir, options = {}) {
  console.log(chalk.blue(`🔌 Installing Agent Plugin: ${pluginName}`));
  const startTime = Date.now();
  const base = registryBaseUrl();

  const fail = (errorType, message) => {
    console.log(chalk.red(`❌ ${message}`));
    trackingService.trackInstallationOutcome('plugin', pluginName, 'failure', {
      errorType,
      errorMessage: message,
      durationMs: Date.now() - startTime,
      batchId: options.batchId,
    });
    return false;
  };

  try {
    if (!PLUGIN_NAME_RE.test(pluginName) || pluginName.includes('--') || pluginName.includes('..')) {
      return fail('validation_error', `"${pluginName}" is not a valid plugin name`);
    }

    const registryResponse = await fetchWithRetry(`${base}/index.json`);
    if (!registryResponse.ok) {
      return fail('network_error', `Registry unavailable (HTTP ${registryResponse.status})`);
    }
    const registry = await registryResponse.json();
    const entry = (registry.bundles || []).find((b) => b.name === pluginName);
    if (!entry) {
      const available = (registry.bundles || []).map((b) => b.name).join(', ') || 'none';
      console.log(chalk.yellow(`Available Agent Plugins: ${available}`));
      return fail('not_found', `Agent Plugin "${pluginName}" not found in the registry`);
    }

    // Spec failure model: an invalid plugin.json rejects the entire plugin.
    const manifestResponse = await fetchWithRetry(`${base}/${pluginName}/plugin.json`);
    if (!manifestResponse.ok) {
      return fail('network_error', `plugin.json unavailable (HTTP ${manifestResponse.status})`);
    }
    let manifest;
    try {
      manifest = await manifestResponse.json();
    } catch {
      return fail('validation_error', 'plugin.json is not valid JSON — plugin rejected per spec');
    }
    if (manifest.$schema !== PLUGIN_SCHEMA || manifest.name !== pluginName) {
      return fail('validation_error', 'plugin.json fails spec validation — plugin rejected per spec');
    }

    const filesResponse = await fetchWithRetry(`${base}/${pluginName}/files.json`);
    if (!filesResponse.ok) {
      return fail('network_error', `files.json unavailable (HTTP ${filesResponse.status})`);
    }
    const filesManifest = await filesResponse.json();
    const files = Array.isArray(filesManifest.files) ? filesManifest.files : [];
    if (files.length === 0) {
      return fail('validation_error', 'files.json lists no files');
    }
    for (const file of files) {
      if (!isSafeRelativePath(file.path)) {
        return fail('validation_error', `Unsafe file path in manifest: "${file.path}" — plugin rejected`);
      }
    }

    if (options.dryRun) {
      console.log(chalk.cyan(`📋 Dry run — ${files.length} files would be installed to .agent-plugins/${pluginName}/:`));
      for (const file of files) console.log(chalk.gray(`   ${file.path} (${file.size} bytes)`));
      return true;
    }

    const bundleDir = path.join(targetDir, '.agent-plugins', pluginName);
    await fs.remove(bundleDir);
    console.log(chalk.gray(`📥 Downloading ${files.length} files from ${base}/${pluginName}/ ...`));
    for (const file of files) {
      const response = await fetchWithRetry(`${base}/${pluginName}/${file.path}`);
      if (!response.ok) {
        await fs.remove(bundleDir);
        return fail('network_error', `Failed to download ${file.path} (HTTP ${response.status})`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (file.sha256 && sha256(buffer) !== file.sha256) {
        await fs.remove(bundleDir);
        return fail('validation_error', `Integrity check failed for ${file.path} — plugin rejected`);
      }
      const destFile = path.join(bundleDir, file.path);
      await fs.outputFile(destFile, buffer);
      if (/\.(py|sh)$/.test(file.path)) await fs.chmod(destFile, 0o755);
    }

    const warnings = [];
    let activated = null;
    if (!options.pluginRaw) {
      activated = await activateBundle(bundleDir, targetDir, warnings);
    }

    for (const warning of warnings) {
      console.log(chalk.yellow(`⚠️  ${warning}`));
    }
    if (!options.silent) {
      console.log(chalk.green(`✅ Agent Plugin "${pluginName}" installed!`));
      console.log(chalk.cyan(`📁 Bundle: ${path.relative(targetDir, bundleDir) || bundleDir}`));
      if (activated) {
        const parts = Object.entries(activated).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
        if (parts.length) console.log(chalk.cyan(`⚡ Activated into .claude/: ${parts.join(', ')}`));
      }
    }

    trackingService.trackDownload('plugin', pluginName, {
      installation_type: 'agent_plugin',
      source: 'aitmpl_registry',
      file_count: files.length,
      activated: !options.pluginRaw,
    });
    trackingService.trackInstallationOutcome('plugin', pluginName, 'success', {
      durationMs: Date.now() - startTime,
      batchId: options.batchId,
    });
    return true;
  } catch (error) {
    return fail('network_error', `Error installing Agent Plugin: ${error.message}`);
  }
}

module.exports = {
  installIndividualPlugin,
  mergeMcpServers,
  fetchWithRetry,
  isSafeRelativePath,
  DEFAULT_REGISTRY_URL,
};
