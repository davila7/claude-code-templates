/**
 * External skills: catalog entries whose code lives in another public GitHub
 * repository. The catalog folder holds only a source.json manifest
 * (cli-tool/components/skills/{category}/{name}/source.json):
 *
 *   {
 *     "repo": "owner/name",           GitHub repository
 *     "path": "skills/babysit-pr",    folder of the skill inside that repo ("" = root)
 *     "commit": "<40-hex sha>",       the reviewed commit; never a branch or tag
 *     "license": "MIT",               SPDX id, checked in CI against the repo
 *     "author": "...",
 *     "requires": ["git/file-pr"],    other catalog skills it calls (optional)
 *     "include": ["SKILL.md", "scripts"]  only these files/folders under path (optional;
 *                                       for repos whose skill folder also holds demos, tests...)
 *   }
 *
 * The files are downloaded from that exact commit and each one is checked
 * against the git blob sha of the tree, so what gets written is byte for byte
 * what SkillSpector scanned when the manifest was merged.
 *
 * The upstream LICENSE (and NOTICE, for Apache-2.0) is written next to the
 * skill even when it lives outside the skill folder: the folder's own copy
 * first, else the repo root's. Same rule as local_dir() in
 * scripts/external_skills.py, so the site shows what the CLI installs.
 */
const crypto = require('crypto');

const CATALOG_SKILLS_RAW = 'https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills';
const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SKILL_REF_RE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i;

// Checked in this order; the first name found in a group wins. Mirrors
// LICENSE_NAMES / NOTICE_NAMES in scripts/external_skills.py.
const LEGAL_FILE_GROUPS = [
  ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING', 'license', 'License.md'],
  ['NOTICE', 'NOTICE.md', 'NOTICE.txt']
];

const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'claude-code-templates'
};

/** Validate a parsed source.json. Returns the normalized manifest or throws. */
function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('source.json must be a JSON object');
  }
  const { repo, commit, license } = manifest;
  const skillPath = manifest.path ?? '';
  if (typeof repo !== 'string' || !REPO_RE.test(repo) || repo.includes('..')) {
    throw new Error(`source.json: invalid "repo" (expected "owner/name"): ${repo}`);
  }
  if (typeof commit !== 'string' || !COMMIT_RE.test(commit)) {
    throw new Error('source.json: "commit" must be a full 40-character commit sha (branches and tags are not allowed)');
  }
  if (typeof skillPath !== 'string' || !isSafeRelativePath(skillPath, true)) {
    throw new Error(`source.json: invalid "path": ${skillPath}`);
  }
  if (typeof license !== 'string' || !license) {
    throw new Error('source.json: "license" is required');
  }
  const requires = manifest.requires ?? [];
  if (!Array.isArray(requires) || requires.some((r) => typeof r !== 'string' || !SKILL_REF_RE.test(r))) {
    throw new Error('source.json: "requires" must be a list of "category/name" skills');
  }
  let include = null;
  if (manifest.include !== undefined) {
    if (!Array.isArray(manifest.include) || manifest.include.length === 0 ||
        manifest.include.some((p) => typeof p !== 'string' || !isSafeRelativePath(p.replace(/\/+$/, '')))) {
      throw new Error('source.json: "include" must be a non-empty list of relative paths');
    }
    include = manifest.include.map((p) => p.replace(/\/+$/, ''));
    if (!include.includes('SKILL.md')) throw new Error('source.json: "include" must list SKILL.md');
  }
  return { ...manifest, path: skillPath.replace(/^\/+|\/+$/g, ''), requires, include };
}

/** True when rel is one of the include entries or sits under one (no include = everything). */
function isIncluded(rel, include) {
  return !include || include.some((inc) => rel === inc || rel.startsWith(inc + '/'));
}

/** A relative path with no "..", no absolute root and no backslashes. */
function isSafeRelativePath(p, allowEmpty = false) {
  if (p === '') return allowEmpty;
  if (p.startsWith('/') || p.includes('\\') || p.includes('\0') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg !== '..' && seg !== '.');
}

/** git's blob id: sha1("blob <len>\0" + bytes). */
function gitBlobSha(buffer) {
  return crypto.createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex');
}

const ERROR_MESSAGE_MAX = 200;

function header(response, name) {
  const h = response.headers;
  if (!h) return null;
  return typeof h.get === 'function' ? h.get(name) : (h[name] ?? null);
}

/**
 * The `message` field of a GitHub JSON error body, flattened and trimmed.
 * Only that field is ever shown: never headers or the raw body.
 */
async function githubErrorMessage(response) {
  try {
    const data = JSON.parse(await response.text());
    if (!data || typeof data.message !== 'string') return '';
    const msg = data.message.replace(/\s+/g, ' ').trim();
    return msg.length > ERROR_MESSAGE_MAX ? `${msg.slice(0, ERROR_MESSAGE_MAX - 1)}…` : msg;
  } catch {
    return '';
  }
}

/**
 * Turn a failed GitHub response into an Error. Only 429, or 403 with
 * x-ratelimit-remaining "0" (primary limit) or a "rate limit" message /
 * retry-after (secondary limit), is reported as a rate limit; any other 403 is
 * an access refusal (private repo, blocked by a proxy or an org policy...).
 * Returns null for statuses the caller handles itself.
 */
async function githubError(response, target) {
  const { status } = response;
  if (status !== 403 && status !== 429) return null;
  const message = await githubErrorMessage(response);
  const remaining = header(response, 'x-ratelimit-remaining');
  const retryAfter = header(response, 'retry-after');
  if (status === 429 || remaining === '0' || retryAfter || /rate limit/i.test(message)) {
    let when = 'Try again later.';
    const reset = Number(header(response, 'x-ratelimit-reset'));
    const retry = Number(retryAfter);
    if (remaining === '0' && Number.isFinite(reset) && reset > 0) {
      when = `It resets at ${new Date(reset * 1000).toLocaleTimeString()}.`;
    } else if (Number.isFinite(retry) && retry > 0) {
      when = `Try again in ${Math.ceil(retry)} seconds.`;
    }
    return new Error(`GitHub API rate limit reached. ${when}`);
  }
  return new Error(`GitHub refused access to ${target} (HTTP 403)${message ? `: ${message}` : ''}`);
}

/**
 * Fetch the catalog's source.json for a skill. Returns the validated manifest,
 * or null when the skill is a regular (in-repo) skill.
 */
async function fetchExternalManifest(skillName, fetchImpl = fetch) {
  if (!SKILL_REF_RE.test(skillName)) return null;
  const response = await fetchImpl(`${CATALOG_SKILLS_RAW}/${skillName}/source.json`, {
    headers: { 'User-Agent': 'claude-code-templates' }
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw (await githubError(response, 'the catalog')) || new Error(`Could not read source.json (HTTP ${response.status})`);
  }
  let parsed;
  try {
    parsed = JSON.parse(await response.text());
  } catch {
    throw new Error('source.json is not valid JSON');
  }
  return validateManifest(parsed);
}

/**
 * List the files of the skill folder at the pinned commit:
 * [{ path (relative to the skill folder), sha, mode, size }].
 */
async function listSkillTree(manifest, fetchImpl = fetch) {
  const { repo, commit, path: skillPath } = manifest;
  const treeish = skillPath ? `${commit}:${skillPath}` : commit;
  let response = await fetchImpl(
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(treeish)}?recursive=1`,
    { headers: GITHUB_HEADERS }
  );
  let prefix = '';
  if (!response.ok && skillPath && (response.status === 404 || response.status === 422)) {
    // Fall back to the whole commit tree and keep the skill's folder.
    response = await fetchImpl(`https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`, { headers: GITHUB_HEADERS });
    prefix = `${skillPath}/`;
  }
  if (!response.ok) {
    const err = await githubError(response, repo);
    if (err) throw err;
    throw new Error(`Could not read ${repo}@${commit.slice(0, 7)} (HTTP ${response.status}). The commit or repository may no longer exist.`);
  }
  const data = await response.json();
  if (data.truncated) throw new Error(`The tree of ${repo} is too large to list`);

  const files = [];
  const legal = { folder: {}, root: prefix ? {} : null };
  for (const entry of data.tree || []) {
    if (entry.type !== 'blob') continue; // directories and submodules
    if (entry.mode === '120000') continue; // symlinks are never written
    const file = { sha: entry.sha, mode: entry.mode, size: entry.size ?? 0 };
    if (prefix && !entry.path.includes('/')) legal.root[entry.path] = { path: entry.path, ...file };
    if (prefix && !entry.path.startsWith(prefix)) continue;
    const rel = entry.path.slice(prefix.length);
    if (!rel.includes('/')) legal.folder[rel] = { path: rel, ...file };
    if (!isIncluded(rel, manifest.include)) continue;
    if (!isSafeRelativePath(rel)) throw new Error(`Unsafe path in ${repo}: ${entry.path}`);
    files.push({ path: rel, ...file });
  }
  files.legal = legal;
  return files;
}

/**
 * The LICENSE/NOTICE files to add to a skill that does not ship its own:
 * [{ path, sha | null, mode, rootPath }]. `sha` is null for a repo-root file
 * found by probing raw.githubusercontent (no extra GitHub API call, which is
 * rate limited); that URL names the full commit sha, so its content is fixed.
 */
async function findLegalFiles(manifest, files, fetchImpl = fetch) {
  const have = new Set(files.map((f) => f.path));
  const { folder, root } = files.legal || { folder: {}, root: null };
  const out = [];
  for (const names of LEGAL_FILE_GROUPS) {
    if (names.some((n) => have.has(n))) continue;
    const own = names.find((n) => folder[n]);
    if (own) { out.push({ ...folder[own], rootPath: null }); continue; }
    if (!manifest.path) continue; // the skill is the repo root: nothing above it
    if (root) {
      const hit = names.find((n) => root[n]);
      if (hit) out.push({ ...root[hit], rootPath: hit });
      continue;
    }
    // Probe every name at once and keep the first one, in order, that exists.
    const base = `https://raw.githubusercontent.com/${manifest.repo}/${manifest.commit}/`;
    const probes = await Promise.all(names.map(async (n) => {
      try {
        const r = await fetchImpl(base + encodeURIComponent(n), { headers: { 'User-Agent': 'claude-code-templates' } });
        return r.ok ? { name: n, content: Buffer.from(await r.arrayBuffer()) } : null;
      } catch {
        return null;
      }
    }));
    const found = probes.find(Boolean);
    if (found) out.push({ path: found.name, sha: null, mode: '100644', rootPath: found.name, content: found.content });
  }
  return out;
}

/**
 * Download the skill at its pinned commit. Returns
 * { [relativePath]: { content: Buffer, executable: boolean } }.
 */
async function downloadExternalSkill(manifest, fetchImpl = fetch) {
  const files = await listSkillTree(manifest, fetchImpl);
  if (!files.some((f) => f.path === 'SKILL.md')) {
    throw new Error(`No SKILL.md in ${manifest.repo}/${manifest.path} at ${manifest.commit.slice(0, 7)}`);
  }
  if (files.length > MAX_FILES) throw new Error(`Skill has ${files.length} files (limit ${MAX_FILES})`);
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error(`Skill is ${total} bytes (limit ${MAX_TOTAL_BYTES})`);

  const base = `https://raw.githubusercontent.com/${manifest.repo}/${manifest.commit}/${manifest.path ? manifest.path + '/' : ''}`;
  const out = {};
  for (const file of files) {
    const url = base + file.path.split('/').map(encodeURIComponent).join('/');
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'claude-code-templates' } });
    if (!response.ok) {
      throw (await githubError(response, manifest.repo)) || new Error(`Could not download ${file.path} (HTTP ${response.status})`);
    }
    const content = Buffer.from(await response.arrayBuffer());
    if (gitBlobSha(content) !== file.sha) {
      throw new Error(`${file.path} does not match the pinned commit (blob sha mismatch)`);
    }
    out[file.path] = { content, executable: file.mode === '100755' };
  }

  for (const file of await findLegalFiles(manifest, files, fetchImpl)) {
    let content = file.content;
    if (!content) {
      const url = file.rootPath
        ? `https://raw.githubusercontent.com/${manifest.repo}/${manifest.commit}/${encodeURIComponent(file.rootPath)}`
        : base + encodeURIComponent(file.path);
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'claude-code-templates' } });
      if (!response.ok) {
        throw (await githubError(response, manifest.repo)) || new Error(`Could not download ${file.path} (HTTP ${response.status})`);
      }
      content = Buffer.from(await response.arrayBuffer());
    }
    if (file.sha && gitBlobSha(content) !== file.sha) {
      throw new Error(`${file.path} does not match the pinned commit (blob sha mismatch)`);
    }
    out[file.path] = { content, executable: false };
  }
  return out;
}

module.exports = {
  CATALOG_SKILLS_RAW,
  validateManifest,
  isSafeRelativePath,
  isIncluded,
  gitBlobSha,
  fetchExternalManifest,
  listSkillTree,
  findLegalFiles,
  downloadExternalSkill
};
