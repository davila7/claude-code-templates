/**
 * Normalization helpers for Agent Plugins (open standard) packaging.
 *
 * Source components in cli-tool/components/ stay untouched; every rewrite
 * here happens only on the copies emitted into a plugin bundle.
 */

const yaml = require('js-yaml');

// agent-plugins.org plugin.json name: a-z 0-9 . - , alphanumeric edges,
// no consecutive -- or .. , 1-64 chars.
const PLUGIN_NAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

// agentskills.io skill name: lowercase alphanumerics and single hyphens.
const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Frontmatter keys defined by the agentskills.io spec. Everything else is
// folded into the spec's `metadata` string map at bundle time.
const SKILL_STANDARD_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

function normalizePluginName(raw) {
  let name = String(raw)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');
  name = name.replace(/-{2,}/g, '-').replace(/\.{2,}/g, '.');
  name = name.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
  name = name.slice(0, 64).replace(/[^a-z0-9]+$/, '');
  if (!PLUGIN_NAME_RE.test(name)) {
    throw new Error(`Cannot derive a spec-conformant plugin name from "${raw}"`);
  }
  return name;
}

function normalizeSkillName(raw) {
  let name = String(raw)
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`Cannot derive a spec-conformant skill name from "${raw}"`);
  }
  return name;
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return { frontmatter: null, body: markdown };
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: markdown };
  const rawFm = markdown.slice(3, end + 1);
  const body = markdown.slice(markdown.indexOf('\n', end + 1) + 1);
  let data;
  try {
    data = yaml.load(rawFm);
  } catch (err) {
    const e = new Error(`Invalid YAML frontmatter: ${err.message}`);
    e.code = 'EFRONTMATTER';
    throw e;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { frontmatter: null, body: markdown };
  }
  return { frontmatter: data, body };
}

function stringifyMetadataValue(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Rewrite a skill's frontmatter so the bundle copy conforms to the
 * agentskills.io spec: name matches the containing directory, and every
 * non-standard key moves under `metadata` as a string value.
 */
function normalizeSkillFrontmatter(frontmatter, dirName) {
  const out = { name: dirName };
  if (frontmatter.description !== undefined) out.description = String(frontmatter.description);
  if (frontmatter.license !== undefined) out.license = String(frontmatter.license);
  if (frontmatter.compatibility !== undefined) out.compatibility = String(frontmatter.compatibility);
  if (frontmatter['allowed-tools'] !== undefined) out['allowed-tools'] = frontmatter['allowed-tools'];

  const metadata = {};
  if (frontmatter.metadata && typeof frontmatter.metadata === 'object') {
    for (const [k, v] of Object.entries(frontmatter.metadata)) {
      metadata[String(k)] = stringifyMetadataValue(v);
    }
  }
  for (const [key, value] of Object.entries(frontmatter)) {
    if (SKILL_STANDARD_KEYS.has(key)) continue;
    metadata[key] = stringifyMetadataValue(value);
  }
  if (frontmatter.name !== undefined && String(frontmatter.name) !== dirName) {
    metadata['original-name'] = String(frontmatter.name);
  }
  if (Object.keys(metadata).length > 0) out.metadata = metadata;
  return out;
}

function serializeFrontmatter(frontmatter, body) {
  const fm = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${fm}\n---\n\n${body.replace(/^\n+/, '')}`;
}

module.exports = {
  PLUGIN_NAME_RE,
  SKILL_NAME_RE,
  SKILL_STANDARD_KEYS,
  normalizePluginName,
  normalizeSkillName,
  parseFrontmatter,
  normalizeSkillFrontmatter,
  serializeFrontmatter,
  stringifyMetadataValue,
};
