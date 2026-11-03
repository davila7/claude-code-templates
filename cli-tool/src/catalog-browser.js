'use strict';

/**
 * What `npx claude-code-templates` does with no arguments.
 *
 * In a terminal it opens the catalog: pick a type, search, select, repeat, then
 * hand the selection to the regular multi-component installer (plan table,
 * location prompt, result rows). Without a terminal (agents, CI, pipes) it
 * prints a short usage text and exits, so nothing ever waits for input.
 *
 * Data comes from the public Catalog API v1 (www.aitmpl.com/api/v1), with the
 * same files on raw.githubusercontent.com as a fallback, cached on disk and
 * revalidated with version.json.
 */

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

const ORANGE = chalk.hex('#F97316');

const SOURCES = [
  process.env.CCT_CATALOG_URL,
  'https://www.aitmpl.com/api/v1',
  'https://raw.githubusercontent.com/davila7/claude-code-templates/main/dashboard/public/api/v1'
].filter(Boolean);

const TYPE_ORDER = [
  { type: 'skills', label: 'Skills', hint: 'reusable know-how Claude loads on demand' },
  { type: 'agents', label: 'Agents', hint: 'subagents for specific jobs' },
  { type: 'commands', label: 'Commands', hint: 'slash commands' },
  { type: 'mcps', label: 'MCPs', hint: 'connect external tools and services' },
  { type: 'hooks', label: 'Hooks', hint: 'run scripts on Claude Code events' },
  { type: 'settings', label: 'Settings', hint: 'permissions, models, status lines' },
  { type: 'mods', label: 'Mods', hint: 'plugins that change Claude Code itself' },
  { type: 'loops', label: 'Loops', hint: 'autonomous workflows' }
];

const FETCH_TIMEOUT_MS = 15000;

function cacheDir() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'claude-code-templates', 'catalog-v1');
}

async function fetchJson(relPath) {
  let lastError;
  for (const base of SOURCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/${relPath}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${base}`);
      return await res.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('no catalog source');
}

async function readCache(name) {
  try {
    return await fs.readJson(path.join(cacheDir(), name));
  } catch {
    return null;
  }
}

async function writeCache(name, data) {
  try {
    await fs.ensureDir(cacheDir());
    await fs.writeJson(path.join(cacheDir(), name), data);
  } catch {
    // A read-only home only costs a re-download next time.
  }
}

/** version.json from the network, or the cached copy when offline. */
async function loadVersion() {
  try {
    const version = await fetchJson('version.json');
    await writeCache('version.json', version);
    return { version, offline: false };
  } catch (error) {
    const cached = await readCache('version.json');
    if (cached) return { version: cached, offline: true };
    throw error;
  }
}

/** One type's components, from cache when its sha matches version.json. */
async function loadType(type, version) {
  const cached = await readCache(`${type}.json`);
  if (cached && cached.sha256 === version.sha256) return cached.components;
  try {
    const data = await fetchJson(`catalog/${type}.json`);
    await writeCache(`${type}.json`, { sha256: version.sha256, components: data.components });
    return data.components;
  } catch (error) {
    if (cached) return cached.components;
    throw error;
  }
}

/**
 * Words that describe the current project, read from its manifest files.
 * Used only to list matching components first; never hides anything.
 */
function detectProjectTags(targetDir) {
  const tags = new Set();
  const has = f => fs.existsSync(path.join(targetDir, f));
  try {
    if (has('package.json')) {
      const pkg = fs.readJsonSync(path.join(targetDir, 'package.json'));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      const known = ['react', 'next', 'vue', 'nuxt', 'svelte', 'angular', 'astro', 'express', 'nestjs', 'typescript', 'tailwindcss', 'prisma', 'supabase', 'stripe', 'playwright', 'vitest', 'jest'];
      for (const dep of deps) {
        const name = dep.replace(/^@[^/]+\//, '').replace(/^@/, '');
        if (known.includes(name)) tags.add(name === 'tailwindcss' ? 'tailwind' : name);
        if (dep.startsWith('@nestjs/')) tags.add('nestjs');
        if (dep.startsWith('@supabase/')) tags.add('supabase');
      }
      tags.add('javascript');
    }
    if (has('pyproject.toml') || has('requirements.txt')) tags.add('python');
    if (has('Cargo.toml')) tags.add('rust');
    if (has('go.mod')) tags.add('go');
    if (has('Gemfile')) tags.add('ruby');
    if (has('Dockerfile') || has('docker-compose.yml')) tags.add('docker');
  } catch {
    // Unreadable manifest: no tags, plain download order.
  }
  return [...tags];
}

function matchTag(component, tags) {
  if (tags.length === 0) return null;
  const words = new Set(
    [component.name, component.category, ...(component.keywords || [])]
      .join(' ').toLowerCase().split(/[^a-z0-9]+/)
  );
  return tags.find(t => words.has(t)) || null;
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function oneLine(text, max) {
  const flat = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function componentOptions(components, tags) {
  const ranked = components.map(c => ({ c, tag: matchTag(c, tags) }));
  ranked.sort((a, b) => (Boolean(b.tag) - Boolean(a.tag)) || (b.c.downloads || 0) - (a.c.downloads || 0) || a.c.id.localeCompare(b.c.id));
  const nameWidth = Math.min(30, Math.max(...ranked.map(r => r.c.name.length)));
  const catWidth = Math.min(20, Math.max(...ranked.map(r => r.c.category.length)));
  const cut = (text, width) => (text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width));
  // "│  ◻ " + name + " " + category + " (" + hint + ")" must fit on one row.
  const columns = process.stdout.columns || 100;
  const room = columns - 5 - nameWidth - 1 - catWidth - 3 - 1;
  return ranked.map(({ c, tag }) => {
    const meta = [`${formatCount(c.downloads)} installs`, tag ? `matches ${tag}` : null].filter(Boolean).join(' · ');
    const descRoom = room - meta.length - 3;
    return {
      value: c.id,
      label: `${cut(c.name, nameWidth)} ${chalk.gray(cut(c.category, catWidth))}`,
      hint: descRoom >= 12 ? `${meta} · ${oneLine(c.description, descRoom)}` : meta,
      name: c.name.toLowerCase(),
      search: [c.name, c.category, c.description, ...(c.keywords || [])].join(' ').toLowerCase()
    };
  });
}

function queryWords(query) {
  return String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesQuery(option, query) {
  return queryWords(query).every(w => option.search.includes(w));
}

/**
 * Options ranked for a query: name matches first, then the base order
 * (project matches, then installs). Filtering is left to matchesQuery.
 */
function searchOptions(options, query) {
  const words = queryWords(query);
  if (words.length === 0) return options;
  const score = o => {
    const inName = words.filter(w => o.name.includes(w)).length;
    return inName === words.length ? 2 : inName > 0 ? 1 : 0;
  };
  return options
    .map((o, index) => ({ o, index, score: score(o) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(s => s.o);
}

/**
 * Interactive catalog browser. Resolves to CLI options for
 * installMultipleComponents (e.g. { agent: 'a/b,c/d', skill: 'x/y' }),
 * or null when the user cancels or picks nothing.
 */
async function browseCatalog({ version: cliVersion, targetDir }) {
  const { select, autocompleteMultiselect, spinner, isCancel, log } = require('@clack/prompts');
  const { S_STEP_ACTIVE } = require('@clack/prompts');

  console.log('');
  console.log(`${ORANGE.bold(`${S_STEP_ACTIVE} Claude Code Templates`)} ${chalk.gray(`v${cliVersion} · aitmpl.com`)}`);

  const s = spinner();
  s.start('Loading the catalog');
  let version;
  let offline;
  try {
    ({ version, offline } = await loadVersion());
  } catch (error) {
    s.stop(chalk.red('Could not load the catalog'), 1);
    log.message(chalk.gray(`${error.message}. Browse it at https://www.aitmpl.com and install with --agent, --skill, ...`));
    return null;
  }
  s.stop(`Catalog · ${version.count.toLocaleString('en-US')} components${offline ? chalk.gray(' (offline copy)') : ''}`);

  const tags = detectProjectTags(targetDir);
  if (tags.length > 0) {
    log.message(chalk.gray(`This project uses ${tags.join(', ')}: matching components are listed first.`));
  }

  const picked = new Map(); // id -> { type, args }
  const typeOf = new Map(TYPE_ORDER.map(t => [t.type, t]));

  while (true) {
    const countFor = type => picked.size && [...picked.values()].filter(p => p.type === type).length;
    const type = await select({
      message: picked.size ? 'Add from another type?' : 'What do you want to add?',
      options: TYPE_ORDER
        .filter(t => version.counts && version.counts[t.type])
        .map(t => {
          const n = countFor(t.type);
          return {
            value: t.type,
            label: `${t.label.padEnd(9)} ${chalk.gray(String(version.counts[t.type]).padStart(4))}${n ? chalk.green(`  ${n} selected`) : ''}`,
            hint: t.hint
          };
        })
    });
    if (isCancel(type)) return null;

    let components;
    const ls = spinner();
    ls.start(`Loading ${typeOf.get(type).label.toLowerCase()}`);
    try {
      components = await loadType(type, version);
      ls.stop(`${typeOf.get(type).label} · ${components.length}`);
    } catch (error) {
      ls.stop(chalk.red(`Could not load ${type}: ${error.message}`), 1);
      continue;
    }

    const byId = new Map(components.map(c => [c.id, c]));
    const all = componentOptions(components, tags);
    const chosen = await autocompleteMultiselect({
      message: `Search ${typeOf.get(type).label.toLowerCase()}`,
      placeholder: 'type to filter',
      maxItems: 8,
      initialValues: [...picked.keys()].filter(id => byId.has(id)),
      // A function receives the prompt as `this`: re-rank per keystroke so a
      // name match beats a project match; `filter` then hides non-matches
      // (and keeps clack's "N matches" count).
      options() {
        return searchOptions(all, this.userInput);
      },
      filter: (query, option) => matchesQuery(option, query)
    });
    if (isCancel(chosen)) return null;

    for (const id of [...picked.keys()]) if (byId.has(id)) picked.delete(id);
    for (const id of chosen) picked.set(id, { type, args: byId.get(id).install.args });

    const next = await select({
      message: `${picked.size} selected`,
      options: [
        ...(picked.size ? [{ value: 'install', label: 'Install selected' }] : []),
        { value: 'more', label: 'Add from another type' },
        { value: 'quit', label: 'Quit' }
      ]
    });
    if (isCancel(next) || next === 'quit') return null;
    if (next === 'install') break;
  }

  // install.args is ['--agent', 'category/name']; join values per flag.
  const options = {};
  for (const { args } of picked.values()) {
    const flag = args[0].replace(/^--/, '');
    options[flag] = options[flag] ? `${options[flag]},${args[1]}` : args[1];
  }
  return options;
}

/** The one-line command that repeats an install, for sharing or scripts. */
function equivalentCommand(options) {
  const flags = ['agent', 'command', 'mcp', 'setting', 'hook', 'skill', 'loop', 'mod']
    .filter(f => options[f])
    .map(f => `--${f} ${options[f]}`);
  return `npx claude-code-templates@latest ${flags.join(' ')}`;
}

/** Printed instead of the browser when nobody can answer a prompt. */
function printNonInteractiveHelp(cliVersion) {
  const lines = [
    `Claude Code Templates v${cliVersion}`,
    '',
    'No terminal to browse in, so nothing was installed.',
    '',
    'Install components by path (category/name), comma-separated, combinable:',
    '  npx claude-code-templates@latest --skill <category/name> --agent <category/name> --yes',
    '  Flags: --skill --agent --command --mcp --hook --setting --mod --loop',
    '',
    'Find paths:',
    '  https://www.aitmpl.com                        catalog',
    '  https://www.aitmpl.com/api/v1/catalog.json    every component with its install command (JSON)',
    '  https://www.aitmpl.com/llms.txt               summary for agents',
    '',
    'Run it in a terminal with no arguments to search the catalog interactively.',
    'All options: npx claude-code-templates@latest --help'
  ];
  console.log(lines.join('\n'));
}

module.exports = {
  browseCatalog,
  equivalentCommand,
  printNonInteractiveHelp,
  detectProjectTags,
  componentOptions,
  searchOptions,
  matchesQuery,
  loadVersion,
  loadType
};
