'use strict';

/**
 * Mods from aitmpl.com's per-component content files instead of the GitHub
 * contents API, whose 60 requests/hour limit for anonymous callers caused 85%
 * of failed mod installs (a mod is 4 to 15 requests).
 *
 * https://www.aitmpl.com/component-content/mods/{category}/{name}.json is
 * written by scripts/generate_components_json.py:
 *   content     the README.md text
 *   files       { "<relative path>": "<text>" } for every other file
 *   meta.files  [{ path, bytes, lines }] for every file in the directory (README.md included)
 *
 * The CLI relies on that shape, so it is a contract: a file is accepted only
 * when it has exactly the files meta.files lists, each with the listed size in
 * bytes. Anything else (a binary file the generator left out, a stale copy,
 * an odd path) returns an error and the caller falls back to GitHub.
 */

const CONTENT_URL = 'https://www.aitmpl.com/component-content';
// A test run can point at a branch's copy, still https and still component-content.
const OVERRIDE_URL_RE = /^https:\/\/[^\s?#]+\/component-content$/;
const FETCH_TIMEOUT_MS = 15000;

function contentBaseUrl(env = process.env) {
  const override = env.CCT_CONTENT_URL && env.CCT_CONTENT_URL.replace(/\/+$/, '');
  return override && OVERRIDE_URL_RE.test(override) ? override : CONTENT_URL;
}

/** A relative path that stays inside the plugin directory and is not hidden (except .claude-plugin). */
function isSafeRelativePath(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\\') || rel.includes('\0') || rel.startsWith('/')) return false;
  return rel.split('/').every(seg => seg && seg !== '.' && seg !== '..' && (!seg.startsWith('.') || seg === '.claude-plugin'));
}

/**
 * The plugin files described by one content file, checked against meta.files.
 * Returns { files } or { error } (never throws).
 */
function filesFromContent(data) {
  if (!data || typeof data !== 'object' || !data.meta || !Array.isArray(data.meta.files)) return { error: 'no meta.files' };
  const shipped = data.files && typeof data.files === 'object' ? data.files : {};
  const listed = data.meta.files;
  if (listed.length === 0) return { error: 'meta.files is empty' };

  const files = {};
  for (const entry of listed) {
    const rel = entry && entry.path;
    if (!isSafeRelativePath(rel)) return { error: `unexpected path ${JSON.stringify(rel)}` };
    let text;
    if (Object.prototype.hasOwnProperty.call(shipped, rel)) text = shipped[rel];
    else if (rel === 'README.md' && typeof data.content === 'string') text = data.content;
    else return { error: `${rel} is listed in meta.files but not shipped` };
    if (typeof text !== 'string') return { error: `${rel} is not text` };
    if (Buffer.byteLength(text, 'utf8') !== entry.bytes) return { error: `${rel} is ${Buffer.byteLength(text, 'utf8')} bytes, meta.files says ${entry.bytes}` };
    files[rel] = text;
  }
  const extra = Object.keys(shipped).filter(rel => !Object.prototype.hasOwnProperty.call(files, rel));
  if (extra.length > 0) return { error: `${extra[0]} is shipped but not in meta.files` };
  return { files };
}

/**
 * Download one mod's content file. Returns { files }, { notFound: true } or
 * { error } (never throws), so the caller can fall back to GitHub.
 */
async function fetchModFiles(modName, { fetchImpl = fetch, env = process.env, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const url = `${contentBaseUrl(env)}/mods/${modName}.json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { 'User-Agent': 'claude-code-templates' } });
    if (res.status === 404) return { notFound: true, url };
    if (!res.ok) return { error: `HTTP ${res.status}`, url };
    const result = filesFromContent(await res.json());
    return { ...result, url };
  } catch (error) {
    return { error: error.name === 'AbortError' ? 'timed out' : error.message, url };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { CONTENT_URL, contentBaseUrl, isSafeRelativePath, filesFromContent, fetchModFiles };
