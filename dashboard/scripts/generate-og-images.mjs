// Generates the social preview image (og:image / twitter:image) of every
// component page: public/og/{type}/{path}.png, 1200x630.
//
// Runs before `astro build` (see package.json). The output is a build
// artifact (gitignored): CI regenerates it on every deploy from the catalog
// in public/components.json. Rendering happens here and not in an on-demand
// endpoint because the site runs on Cloudflare Pages Functions, whose CPU
// limit is far below what satori + resvg need per image.
//
// Usage: node scripts/generate-og-images.mjs [--only type/path ...] [--out dir]

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_DIR = join(ROOT, '..', 'cli-tool', 'components');
const WIDTH = 1200;
const HEIGHT = 630;
// Bump when the design changes so cached images are re-rendered.
const DESIGN_VERSION = '2';

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
  const svg = await satori(card(e), { width: WIDTH, height: HEIGHT, fonts });
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
  console.log(`og images: ${jobs.length} rendered, ${skipped} unchanged, ${threads} threads (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}
