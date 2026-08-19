/**
 * Agent Plugins (open standard) bundle packer.
 *
 * Builds a spec-conformant plugin directory (agent-plugins.org v1.0.0) from
 * components in cli-tool/components/. Skills and MCP servers are emitted as
 * first-class spec components; agents, commands, hooks, settings and loops —
 * which the standard does not define — are carried byte-exact under the
 * `com.aitmpl.claude-code` extensions namespace. A dual `.claude-plugin/
 * plugin.json` manifest points Claude Code's native plugin loader at the
 * same files so one directory serves both worlds.
 *
 * The single source of truth stays in cli-tool/components/ — every
 * normalization (skill names, metadata folding, MCP description stripping)
 * happens only on the emitted copies.
 */

const path = require('path');
const fs = require('fs-extra');

const {
  normalizePluginName,
  normalizeSkillName,
  parseFrontmatter,
  normalizeSkillFrontmatter,
  serializeFrontmatter,
} = require('./normalize');

const SPEC_VERSION = '1.0.0';
const PLUGIN_SCHEMA = `https://agent-plugins.org/schemas/${SPEC_VERSION}/plugin.schema.json`;
const MCP_SCHEMA = `https://agent-plugins.org/schemas/${SPEC_VERSION}/mcp.schema.json`;
const EXTENSION_NAMESPACE = 'com.aitmpl.claude-code';

const TYPE_DIRS = {
  agent: 'agents',
  command: 'commands',
  mcp: 'mcps',
  setting: 'settings',
  hook: 'hooks',
  skill: 'skills',
  loop: 'loops',
};

function parseComponentToken(token) {
  const raw = String(token).trim();
  const idx = raw.indexOf(':');
  if (idx === -1) {
    throw new Error(`Component token "${raw}" is not "type:path"`);
  }
  const type = raw.slice(0, idx).trim();
  const relPath = raw.slice(idx + 1).trim();
  if (!TYPE_DIRS[type]) {
    throw new Error(`Unknown component type "${type}" in token "${raw}"`);
  }
  if (relPath.split(/[\\/]/).some((seg) => seg === '..' || seg === '')) {
    throw new Error(`Component path "${relPath}" must be a clean relative path`);
  }
  return { type, path: relPath };
}

function componentSourcePath(componentsDir, ref) {
  const base = path.join(componentsDir, TYPE_DIRS[ref.type], ref.path);
  switch (ref.type) {
    case 'skill':
      return base; // directory containing SKILL.md
    case 'mcp':
    case 'setting':
    case 'hook':
      return `${base}.json`;
    default:
      return `${base}.md`; // agent, command, loop
  }
}

/** Expand loop components: a loop's frontmatter `components:` list is a
 * ready-made bundle manifest, and spec plugins must be self-contained. */
async function expandLoopRefs(componentsDir, refs, warnings) {
  const seen = new Set();
  const out = [];
  const queue = [...refs];
  while (queue.length > 0) {
    const ref = queue.shift();
    const key = `${ref.type}:${ref.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (ref.type !== 'loop') continue;
    const loopFile = componentSourcePath(componentsDir, ref);
    if (!(await fs.pathExists(loopFile))) continue;
    const { frontmatter } = parseFrontmatter(await fs.readFile(loopFile, 'utf8'));
    let loopRefs = (frontmatter && frontmatter.components) || [];
    if (typeof loopRefs === 'string') {
      loopRefs = loopRefs.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    for (const token of loopRefs) {
      try {
        queue.push(parseComponentToken(token));
      } catch (err) {
        warnings.push(`loop ${ref.path}: skipped unparseable ref "${token}" (${err.message})`);
      }
    }
  }
  return out;
}

async function copySkill(skillSrcDir, bundleDir, usedNames, warnings) {
  const skillMd = path.join(skillSrcDir, 'SKILL.md');
  if (!(await fs.pathExists(skillMd))) {
    throw new Error(`No SKILL.md in ${skillSrcDir}`);
  }
  let destName = normalizeSkillName(path.basename(skillSrcDir));
  if (usedNames.has(destName)) {
    destName = normalizeSkillName(`${path.basename(path.dirname(skillSrcDir))}-${destName}`);
  }
  if (usedNames.has(destName)) {
    throw new Error(`Skill name collision for "${destName}"`);
  }
  usedNames.add(destName);

  const destDir = path.join(bundleDir, 'skills', destName);
  await fs.copy(skillSrcDir, destDir);

  const raw = await fs.readFile(skillMd, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  if (!frontmatter) {
    throw new Error(`SKILL.md in ${skillSrcDir} has no parseable frontmatter`);
  }
  if (!frontmatter.description) {
    warnings.push(`skill ${destName}: source frontmatter has no description`);
  }
  const normalized = normalizeSkillFrontmatter(frontmatter, destName);
  await fs.writeFile(path.join(destDir, 'SKILL.md'), serializeFrontmatter(normalized, body));
  return destName;
}

async function mergeMcp(mcpFile, servers, descriptions, warnings) {
  const config = await fs.readJson(mcpFile);
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    throw new Error(`${mcpFile} has no mcpServers object`);
  }
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    if (servers[serverName]) {
      warnings.push(`mcp server "${serverName}" defined more than once; keeping the first definition`);
      continue;
    }
    const copy = { ...serverConfig };
    if (copy.description !== undefined) {
      descriptions[serverName] = String(copy.description);
      delete copy.description; // non-standard per mcp.schema.json
    }
    if (copy.command && !copy.type) copy.type = 'stdio';
    else if (copy.url && !copy.type) copy.type = 'streamable-http';
    servers[serverName] = copy;
  }
}

async function copyExtensionComponent(componentsDir, ref, bundleDir, warnings) {
  const srcFile = componentSourcePath(componentsDir, ref);
  if (!(await fs.pathExists(srcFile))) {
    throw new Error(`Component not found: ${ref.type}:${ref.path} (${srcFile})`);
  }
  const relDest = path.join(EXTENSION_NAMESPACE, TYPE_DIRS[ref.type], `${ref.path}${path.extname(srcFile)}`);
  await fs.copy(srcFile, path.join(bundleDir, relDest));
  const copied = [relDest];

  // Hooks and statusline settings ship sibling .py/.sh scripts that the
  // existing installers auto-download; carry them inside the bundle.
  if (ref.type === 'hook' || ref.type === 'setting') {
    for (const ext of ['.py', '.sh']) {
      const sibling = srcFile.replace(/\.json$/, ext);
      if (await fs.pathExists(sibling)) {
        const siblingDest = relDest.replace(/\.json$/, ext);
        await fs.copy(sibling, path.join(bundleDir, siblingDest));
        copied.push(siblingDest);
      }
    }
  }
  if (ref.type === 'hook') {
    const config = await fs.readJson(srcFile).catch(() => null);
    for (const sf of (config && config.supportingFiles) || []) {
      if (sf && typeof sf.source === 'string') {
        const sfSrc = path.join(path.dirname(srcFile), sf.source);
        if (path.relative(path.dirname(srcFile), sfSrc).startsWith('..')) {
          warnings.push(`hook ${ref.path}: supporting file "${sf.source}" escapes the component dir; skipped`);
          continue;
        }
        if (await fs.pathExists(sfSrc)) {
          const sfDest = path.join(path.dirname(relDest), sf.source);
          await fs.copy(sfSrc, path.join(bundleDir, sfDest));
          copied.push(sfDest);
        }
      }
      if (sf && typeof sf.destination === 'string' && /^([~/]|[A-Za-z]:\\)/.test(sf.destination)) {
        warnings.push(`hook ${ref.path}: supportingFiles destination "${sf.destination}" is outside a plugin root; the Claude Code activation step must rewrite it`);
      }
    }
  }
  return copied;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function buildReadme(spec, summary) {
  const lines = [
    `# ${spec.name}`,
    '',
    spec.description || '',
    '',
    'This is an [Agent Plugins](https://agent-plugins.org) v1.0.0 bundle generated from',
    '[claude-code-templates](https://github.com/davila7/claude-code-templates) (aitmpl.com).',
    '',
    '## Contents',
    '',
  ];
  if (summary.skills.length) lines.push(`- Skills: ${summary.skills.join(', ')}`);
  if (summary.mcpServers.length) lines.push(`- MCP servers: ${summary.mcpServers.join(', ')}`);
  for (const [type, items] of Object.entries(summary.extensions)) {
    if (items.length) lines.push(`- ${type} (Claude Code, via \`${EXTENSION_NAMESPACE}\`): ${items.join(', ')}`);
  }
  lines.push(
    '',
    '## Install',
    '',
    '- Any Agent Plugins client: point it at this directory (skills and `mcp.json` load per the spec).',
    '- Claude Code: the bundled `.claude-plugin/plugin.json` makes this directory a native Claude Code plugin.',
    '',
    'MCP env values like `<personal-access-token>` are placeholders — replace them with your own',
    'credentials before starting the servers. Never commit real secrets.',
    ''
  );
  return lines.join('\n');
}

/**
 * Build one plugin bundle.
 *
 * @param {object} spec  {name, version, description, keywords, license, components: ["type:category/name", ...]}
 * @param {object} opts  {componentsDir, outDir}
 * @returns {Promise<{name, dir, warnings, summary}>}
 */
async function buildPlugin(spec, opts) {
  const componentsDir = path.resolve(opts.componentsDir);
  const warnings = [];

  const name = normalizePluginName(spec.name);
  const bundleDir = path.join(path.resolve(opts.outDir), name);
  await fs.remove(bundleDir);
  await fs.ensureDir(bundleDir);

  const initialRefs = (spec.components || []).map(parseComponentToken);
  const refs = await expandLoopRefs(componentsDir, initialRefs, warnings);

  const summary = {
    skills: [],
    mcpServers: [],
    extensions: { agents: [], commands: [], hooks: [], settings: [], loops: [] },
  };
  const extensionPaths = { agents: [], commands: [], hooks: [], settings: [], loops: [] };
  const usedSkillNames = new Set();
  const mcpServers = {};
  const mcpDescriptions = {};

  for (const ref of refs) {
    if (ref.type === 'skill') {
      const skillDir = componentSourcePath(componentsDir, ref);
      summary.skills.push(await copySkill(skillDir, bundleDir, usedSkillNames, warnings));
    } else if (ref.type === 'mcp') {
      await mergeMcp(componentSourcePath(componentsDir, ref), mcpServers, mcpDescriptions, warnings);
    } else {
      const copied = await copyExtensionComponent(componentsDir, ref, bundleDir, warnings);
      const bucket = TYPE_DIRS[ref.type];
      extensionPaths[bucket].push(`./${toPosix(copied[0])}`);
      summary.extensions[bucket].push(ref.path);
    }
  }
  summary.mcpServers = Object.keys(mcpServers);

  if (summary.mcpServers.length > 0) {
    await fs.writeJson(
      path.join(bundleDir, 'mcp.json'),
      { $schema: MCP_SCHEMA, mcpServers },
      { spaces: 2 }
    );
  }

  const extensionData = {};
  for (const [bucket, paths_] of Object.entries(extensionPaths)) {
    if (paths_.length) extensionData[bucket] = paths_;
  }
  if (Object.keys(mcpDescriptions).length) extensionData.mcpDescriptions = mcpDescriptions;

  const manifest = {
    $schema: PLUGIN_SCHEMA,
    name,
    version: spec.version || '1.0.0',
    description: spec.description || '',
    author: { name: 'aitmpl.com (claude-code-templates community)', url: 'https://www.aitmpl.com' },
    homepage: 'https://www.aitmpl.com',
    repository: 'https://github.com/davila7/claude-code-templates',
    license: spec.license || 'MIT',
  };
  if (spec.keywords && spec.keywords.length) manifest.keywords = spec.keywords.map(String);
  if (Object.keys(extensionData).length) {
    manifest.extensions = { [EXTENSION_NAMESPACE]: extensionData };
  }
  await fs.writeJson(path.join(bundleDir, 'plugin.json'), manifest, { spaces: 2 });

  // Dual manifest: the same directory installs as a native Claude Code plugin.
  const claudeManifest = {
    name,
    version: manifest.version,
    description: manifest.description,
    author: { name: manifest.author.name },
  };
  if (summary.skills.length) claudeManifest.skills = summary.skills.map((s) => `./skills/${s}`);
  if (extensionPaths.agents.length) claudeManifest.agents = extensionPaths.agents;
  if (extensionPaths.commands.length) claudeManifest.commands = extensionPaths.commands;
  if (summary.mcpServers.length) claudeManifest.mcpServers = mcpServers;
  await fs.outputJson(path.join(bundleDir, '.claude-plugin', 'plugin.json'), claudeManifest, { spaces: 2 });

  await fs.writeFile(path.join(bundleDir, 'README.md'), buildReadme({ ...spec, name }, summary));

  return { name, dir: bundleDir, warnings, summary };
}

module.exports = {
  buildPlugin,
  parseComponentToken,
  expandLoopRefs,
  EXTENSION_NAMESPACE,
  PLUGIN_SCHEMA,
  MCP_SCHEMA,
  SPEC_VERSION,
};
