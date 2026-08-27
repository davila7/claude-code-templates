/**
 * Structural validation of an emitted Agent Plugins bundle against the
 * v1.0.0 spec (agent-plugins.org). Mirrors the spec's failure model:
 * plugin.json problems are fatal for the bundle; individual skill or MCP
 * server problems are reported but leave the rest valid.
 */

const path = require('path');
const fs = require('fs-extra');

const { PLUGIN_NAME_RE, SKILL_NAME_RE, parseFrontmatter } = require('./normalize');
const { PLUGIN_SCHEMA, MCP_SCHEMA } = require('./packer');

const KNOWN_MANIFEST_FIELDS = new Set([
  '$schema', 'name', 'version', 'description', 'author',
  'homepage', 'repository', 'license', 'keywords', 'extensions',
]);

async function validateBundle(bundleDir) {
  const errors = [];
  const warnings = [];
  const dir = path.resolve(bundleDir);

  // --- plugin.json (fatal on violation) ---
  const manifestPath = path.join(dir, 'plugin.json');
  let manifest = null;
  if (!(await fs.pathExists(manifestPath))) {
    errors.push('plugin.json missing at bundle root');
  } else {
    try {
      manifest = await fs.readJson(manifestPath);
    } catch (err) {
      errors.push(`plugin.json is not valid JSON: ${err.message}`);
    }
  }
  if (manifest) {
    if (manifest.$schema !== PLUGIN_SCHEMA) {
      errors.push(`plugin.json $schema must be "${PLUGIN_SCHEMA}"`);
    }
    const name = manifest.name;
    if (typeof name !== 'string' || name.length < 1 || name.length > 64 ||
        !PLUGIN_NAME_RE.test(name) || name.includes('--') || name.includes('..')) {
      errors.push(`plugin.json name "${name}" violates the spec name rules`);
    }
    for (const key of Object.keys(manifest)) {
      if (!KNOWN_MANIFEST_FIELDS.has(key)) {
        warnings.push(`plugin.json unknown top-level field "${key}" (reported and ignored per spec)`);
      }
    }
    if (manifest.extensions !== undefined &&
        (typeof manifest.extensions !== 'object' || Array.isArray(manifest.extensions))) {
      warnings.push('plugin.json extensions is not an object (reported and ignored per spec)');
    }
  }

  // --- skills/ (per-skill failures are non-fatal) ---
  const skillsDir = path.join(dir, 'skills');
  if (await fs.pathExists(skillsDir)) {
    if (!(await fs.stat(skillsDir)).isDirectory()) {
      errors.push('skills exists but is not a directory — skills component type invalid');
    } else {
      for (const entry of await fs.readdir(skillsDir)) {
        const skillDir = path.join(skillsDir, entry);
        if (!(await fs.stat(skillDir)).isDirectory()) {
          warnings.push(`skills/${entry} is not a directory; ignored by clients`);
          continue;
        }
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!(await fs.pathExists(skillMd))) {
          warnings.push(`skills/${entry} has no SKILL.md — skill skipped by clients`);
          continue;
        }
        try {
          const { frontmatter } = parseFrontmatter(await fs.readFile(skillMd, 'utf8'));
          if (!frontmatter) {
            warnings.push(`skills/${entry}/SKILL.md has no frontmatter — skill skipped`);
            continue;
          }
          if (frontmatter.name !== entry || !SKILL_NAME_RE.test(entry)) {
            warnings.push(`skills/${entry}: frontmatter name "${frontmatter.name}" must equal the directory name`);
          }
          const desc = frontmatter.description ? String(frontmatter.description) : '';
          if (desc.length < 1 || desc.length > 1024) {
            warnings.push(`skills/${entry}: description length ${desc.length} outside 1..1024`);
          }
        } catch (err) {
          warnings.push(`skills/${entry}/SKILL.md: ${err.message}`);
        }
      }
    }
  }

  // --- mcp.json (per-server failures are non-fatal) ---
  const mcpPath = path.join(dir, 'mcp.json');
  if (await fs.pathExists(mcpPath)) {
    let mcp = null;
    try {
      mcp = await fs.readJson(mcpPath);
    } catch (err) {
      warnings.push(`mcp.json invalid JSON (MCP config disabled per spec): ${err.message}`);
    }
    if (mcp) {
      if (mcp.$schema !== MCP_SCHEMA) {
        warnings.push(`mcp.json $schema must be "${MCP_SCHEMA}" (MCP config disabled per spec)`);
      }
      if (!mcp.mcpServers || typeof mcp.mcpServers !== 'object') {
        warnings.push('mcp.json missing mcpServers object (MCP config disabled per spec)');
      } else {
        for (const [serverName, server] of Object.entries(mcp.mcpServers)) {
          if (!server || typeof server !== 'object') {
            warnings.push(`mcp server "${serverName}" is not an object — server skipped`);
            continue;
          }
          if (server.description !== undefined) {
            warnings.push(`mcp server "${serverName}" carries non-standard "description" — bundler should strip it`);
          }
          if (server.type === 'stdio' || (!server.type && server.command)) {
            if (typeof server.command !== 'string' || /\s/.test(server.command)) {
              warnings.push(`mcp server "${serverName}" command must be a single executable token — server skipped by clients`);
            }
          } else if (server.type === 'streamable-http' || server.type === 'sse') {
            const url = String(server.url || '');
            if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.)/.test(url)) {
              warnings.push(`mcp server "${serverName}" url must be HTTPS or loopback HTTP — server skipped by clients`);
            }
          } else {
            warnings.push(`mcp server "${serverName}" has no recognizable transport — server skipped by clients`);
          }
          for (const envKey of Object.keys(server.env || {})) {
            if (envKey === 'PLUGIN_ROOT' || envKey === 'PLUGIN_DATA') {
              warnings.push(`mcp server "${serverName}" env defines reserved "${envKey}" (forbidden by spec)`);
            }
          }
        }
      }
    }
  }

  // --- package boundary: no symlinks escaping the bundle root ---
  async function walk(current) {
    for (const entry of await fs.readdir(current)) {
      const p = path.join(current, entry);
      const stat = await fs.lstat(p);
      if (stat.isSymbolicLink()) {
        const target = await fs.realpath(p).catch(() => null);
        if (!target || path.relative(dir, target).startsWith('..')) {
          errors.push(`symlink ${path.relative(dir, p)} escapes the plugin root`);
        }
      } else if (stat.isDirectory()) {
        await walk(p);
      }
    }
  }
  await walk(dir);

  return { errors, warnings, valid: errors.length === 0 };
}

module.exports = { validateBundle };
