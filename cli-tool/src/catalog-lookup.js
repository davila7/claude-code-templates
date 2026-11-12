'use strict';

/**
 * Catalog lookups for installs and --search, on the public Catalog API v1
 * (the same cached files the catalog browser reads):
 *
 * - resolveItems(): "--agent frontend-developer" becomes
 *   "--agent development-team/frontend-developer" when exactly one component
 *   of that type has that name; otherwise the item keeps what was typed and
 *   gets "did you mean" suggestions for the summary.
 * - searchCatalog(): text --search, ranked by how well the words match.
 *   Never by downloads, so sponsorship or popularity cannot reorder it.
 * - pageUrl(): the component's aitmpl.com page with utm tags.
 *
 * Every lookup is best effort: when the catalog cannot be loaded, installs go
 * ahead with the names as typed, exactly as before.
 */

const SITE = 'https://www.aitmpl.com';
const CLI_COMMAND = 'npx claude-code-templates@latest';
const LOOKUP_TIMEOUT_MS = 6000;

// CLI flag (singular) <-> Catalog API v1 type (plural). Plugins are not in v1.
const CATALOG_TYPES = {
  agent: 'agents',
  command: 'commands',
  mcp: 'mcps',
  setting: 'settings',
  hook: 'hooks',
  skill: 'skills',
  loop: 'loops',
  mod: 'mods'
};
const FLAG_BY_CATALOG_TYPE = Object.fromEntries(Object.entries(CATALOG_TYPES).map(([flag, type]) => [type, flag]));

function catalogApi() {
  return require('./catalog-browser');
}

/** Components of the given catalog types, keyed by type; a type that fails to load is left out. */
async function loadCatalogTypes(types, { timeoutMs = LOOKUP_TIMEOUT_MS } = {}) {
  const { loadVersion, loadType } = catalogApi();
  const { version } = await loadVersion({ timeoutMs });
  const entries = await Promise.all([...new Set(types)].map(async type => {
    try {
      return [type, await loadType(type, version, { timeoutMs })];
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter(Boolean));
}

/** The aitmpl.com page of a component, tagged so site analytics can count CLI visits. */
function pageUrl({ type, path, page }, medium = 'install') {
  const base = page || `${SITE}/component/${type}/${path}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}utm_source=cli&utm_medium=${medium}`;
}

/** What --type takes for a component: install.args[1] (catalog paths of agents, hooks... keep their .md/.json). */
function installPath(component) {
  const args = component.install && component.install.args;
  return (Array.isArray(args) && typeof args[1] === 'string') ? args[1] : String(component.path).replace(/\.(md|json)$/, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** What was typed, without a file extension, a leading slash or upper case. */
function normalizeInput(input) {
  return String(input || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '').replace(/\.(md|json)$/, '');
}

/** Up to `limit` close names, nearest first: names that contain each other, then small edit distance. */
function suggest(input, components, limit = 3) {
  const wanted = normalizeInput(input);
  const wantedName = wanted.split('/').pop();
  if (!wantedName) return [];
  const maxDistance = Math.max(2, Math.floor(wantedName.length / 3));
  return components
    .map(c => {
      const name = c.name.toLowerCase();
      let score;
      if (name.includes(wantedName) || (name.length >= 4 && wantedName.includes(name))) score = Math.abs(name.length - wantedName.length) / 100;
      else {
        const d = levenshtein(wantedName, name);
        if (d > maxDistance) return null;
        score = d;
      }
      return { c, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map(s => s.c);
}

/**
 * Match one typed name against one type's components.
 * Returns { status: 'exact' | 'resolved' | 'ambiguous' | 'missing', component?, suggestions }.
 */
function resolveName(input, components) {
  const wanted = normalizeInput(input);
  const exact = components.find(c => installPath(c).toLowerCase() === wanted);
  if (exact) return { status: installPath(exact) === input ? 'exact' : 'resolved', component: exact, suggestions: [] };
  const name = wanted.split('/').pop();
  const byName = components.filter(c => c.name.toLowerCase() === name);
  if (byName.length === 1) return { status: 'resolved', component: byName[0], suggestions: [] };
  if (byName.length > 1) return { status: 'ambiguous', suggestions: byName.sort((a, b) => a.id.localeCompare(b.id)).slice(0, 5) };
  return { status: 'missing', suggestions: suggest(input, components) };
}

/**
 * Resolve the planned install items in place. Sets on each item:
 *   requested    what was typed, when it was rewritten to a catalog path
 *   page         the component page (utm-tagged) when the catalog knows it
 *   suggestions  [{ path, command }] when the name is missing or ambiguous
 * Returns the number of rewritten items, or -1 when the catalog was unavailable.
 */
async function resolveItems(items, options = {}) {
  // Plugins are not in Catalog API v1; a category/name one still has a page.
  for (const item of items) {
    if (item.type === 'plugin' && /^[a-z0-9-]+\/[a-z0-9-]+$/i.test(item.name)) item.page = pageUrl({ type: 'plugins', path: item.name });
  }
  const types = items.map(i => CATALOG_TYPES[i.type]).filter(Boolean);
  if (types.length === 0) return 0;
  let catalog;
  try {
    catalog = await (options.loadCatalogTypes || loadCatalogTypes)(types, options);
  } catch {
    return -1;
  }
  let rewritten = 0;
  for (const item of items) {
    const type = CATALOG_TYPES[item.type];
    const components = type && catalog[type];
    if (!components || components.length === 0) continue;
    const match = resolveName(item.name, components);
    if (match.component) {
      if (match.status === 'resolved') {
        item.requested = item.name;
        item.name = installPath(match.component);
        rewritten++;
      }
      item.page = pageUrl({ type, path: installPath(match.component), page: match.component.urls && match.component.urls.page });
    } else {
      item.notInCatalog = true;
      item.suggestions = match.suggestions.map(c => ({ path: installPath(c), command: `${CLI_COMMAND} --${item.type} ${installPath(c)}` }));
    }
  }
  return rewritten;
}

function queryWords(query) {
  return String(query || '').toLowerCase().split(/[^a-z0-9.+#-]+/).filter(Boolean);
}

/**
 * Score one component for the query words. Every word must appear somewhere
 * (name, path, keywords or description); a name hit counts more than a
 * description hit. Returns 0 for no match.
 */
function scoreComponent(component, words) {
  const name = component.name.toLowerCase();
  const nameWords = name.split('-');
  const path = installPath(component).toLowerCase();
  const keywords = (component.keywords || []).map(k => String(k).toLowerCase());
  const description = String(component.description || '').toLowerCase();
  let score = 0;
  for (const word of words) {
    let best = 0;
    if (nameWords.includes(word)) best = 10;
    else if (name.includes(word)) best = 7;
    else if (path.includes(word)) best = 5;
    else if (keywords.includes(word)) best = 4;
    else if (keywords.some(k => k.includes(word))) best = 3;
    else if (description.includes(word)) best = 1;
    if (best === 0) return 0;
    score += best;
  }
  if (name === words.join('-')) score += 20;
  return score;
}

/** Top `limit` components for a text query, best text match first, then by id. */
function searchCatalog(query, catalog, limit = 5) {
  const words = queryWords(query);
  if (words.length === 0) return { results: [], total: 0 };
  const scored = [];
  for (const [type, components] of Object.entries(catalog)) {
    for (const c of components) {
      const score = scoreComponent(c, words);
      if (score > 0) scored.push({ c, type, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  return {
    total: scored.length,
    results: scored.slice(0, limit).map(({ c, type }) => ({
      type,
      flag: FLAG_BY_CATALOG_TYPE[type],
      path: installPath(c),
      description: c.description,
      page: pageUrl({ type, path: installPath(c), page: c.urls && c.urls.page }, 'search'),
      command: `${CLI_COMMAND} --${FLAG_BY_CATALOG_TYPE[type]} ${installPath(c)}`
    }))
  };
}

function oneLine(text, max = 110) {
  const flat = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * `--search "<words>"`. Plain lines in a fixed order, so a person and an agent
 * read the same thing. Returns the number of results.
 */
async function runSearch(query, { log = console.log, load = loadCatalogTypes } = {}) {
  const words = queryWords(query);
  if (words.length === 0) {
    log('Usage: npx claude-code-templates@latest --search "<words>"   e.g. --search "code review"');
    return 0;
  }
  let catalog;
  try {
    catalog = await load(Object.values(CATALOG_TYPES), { timeoutMs: 15000 });
  } catch (error) {
    log(`Could not load the catalog (${error.message}). Search it at ${SITE}`);
    process.exitCode = 1;
    return 0;
  }
  const { results, total } = searchCatalog(query, catalog);
  const shown = String(query).trim();
  if (results.length === 0) {
    log(`No components match "${shown}". Try fewer or other words, or browse ${SITE}`);
    return 0;
  }
  const count = total === results.length ? `${total} result${total === 1 ? '' : 's'}` : `Top ${results.length} of ${total} results`;
  log(`${count} for "${shown}" (ranked by text match):`);
  results.forEach((r, i) => {
    log('');
    log(`${i + 1}. ${r.flag} ${r.path}`);
    if (r.description) log(`   ${oneLine(r.description)}`);
    log(`   Page:    ${r.page}`);
    log(`   Install: ${r.command}`);
  });
  if (total > results.length) {
    log('');
    log('Add words to narrow it down.');
  }
  return results.length;
}

/** The one command that installs the same components again, e.g. on a teammate's machine. */
function stackCommand(items) {
  const byFlag = new Map();
  const extra = new Set();
  for (const item of items) {
    if (!byFlag.has(item.type)) byFlag.set(item.type, []);
    byFlag.get(item.type).push(item.name);
    if (item.retryFlags) extra.add(item.retryFlags);
  }
  const flags = [...byFlag].map(([flag, names]) => `--${flag} ${names.join(',')}`);
  return [CLI_COMMAND, ...flags, ...extra].join(' ');
}

module.exports = {
  CATALOG_TYPES,
  CLI_COMMAND,
  loadCatalogTypes,
  pageUrl,
  installPath,
  levenshtein,
  suggest,
  resolveName,
  resolveItems,
  searchCatalog,
  scoreComponent,
  runSearch,
  stackCommand
};
