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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, workerData } from 'node:worker_threads';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { ICONS, TYPE_CONFIG } from '../src/lib/icons.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1200;
const HEIGHT = 630;
// Bump when the design changes so cached images are re-rendered.
const DESIGN_VERSION = '1';

// Pill label per type: "Subagent" is Claude Code's own name for agents.
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

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? [a] : []));
const outDir = argValue('--out') ?? join(ROOT, 'public', 'og');

const fontDir = join(ROOT, 'node_modules', 'geist', 'dist', 'fonts');
const fonts = [
  { name: 'Geist', weight: 700, data: readFileSync(join(fontDir, 'geist-sans', 'Geist-Bold.ttf')) },
  { name: 'Geist', weight: 500, data: readFileSync(join(fontDir, 'geist-sans', 'Geist-Medium.ttf')) },
  { name: 'Geist Mono', weight: 400, data: readFileSync(join(fontDir, 'geist-mono', 'GeistMono-Regular.ttf')) },
];

const h = (type, style, children) => ({ type, props: { style, children } });

function formatName(name) {
  return name.replace(/\.(md|json)$/, '').replace(/[-_]/g, ' ')
    .split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// The site's type icons (src/lib/icons.ts) as satori elements: an <img> of
// the SVG string does not survive the resvg pass, inline elements do.
function iconElement(typeKey, color, size) {
  const svg = ICONS[typeKey];
  const attrs = (str) => Object.fromEntries([...str.matchAll(/([\w-]+)="([^"]*)"/g)]
    .map(([, k, v]) => [k.replace(/-(\w)/g, (_, c) => c.toUpperCase()), v === 'currentColor' ? color : v]));
  const root = attrs(svg.slice(0, svg.indexOf('>')));
  const children = [...svg.matchAll(/<(path|circle|rect|line|polyline|polygon)\b([^>]*?)\/>/g)]
    .map(([, tag, a]) => ({ type: tag, props: attrs(a) }));
  return { type: 'svg', props: { ...root, width: size, height: size, children } };
}

// Long titles step down in size so they fit in three lines.
function titleSize(title) {
  if (title.length <= 20) return 96;
  if (title.length <= 32) return 84;
  return 70;
}

function card({ typeKey, title, category, command }) {
  const color = TYPE_CONFIG[typeKey].color;
  const size = titleSize(title);

  return h('div', {
    width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', fontFamily: 'Geist',
    backgroundColor: '#161616',
    // Faint glow in the type's color behind the icon.
    backgroundImage: `radial-gradient(circle at 140px 170px, ${color}30 0%, ${color}00 420px)`,
  }, [
    h('div', { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '96px 96px 0 96px', flexGrow: 1 }, [
      h('div', {
        width: 92, height: 92, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#1d1d1d', border: `1.5px solid ${color}66`, marginRight: 40, flexShrink: 0,
      }, [iconElement(typeKey, color, 50)]),
      h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, maxWidth: 880 }, [
        h('div', { display: 'flex', marginTop: 2 }, [
          h('div', {
            display: 'flex', alignItems: 'center', fontFamily: 'Geist Mono', fontSize: 24, color: '#b5b5b5',
            border: '1.5px solid #353535', borderRadius: 999, padding: '7px 20px', backgroundColor: '#1c1c1c',
          }, [
            h('span', { color }, TYPE_LABEL[typeKey]),
            h('span', { color: '#555555', margin: '0 12px' }, '/'),
            h('span', {}, category),
          ]),
        ]),
        h('div', {
          display: 'block', marginTop: 36, fontSize: size, fontWeight: 700, color: '#ffffff',
          lineHeight: 1.04, letterSpacing: -size * 0.035, lineClamp: 3,
        }, title),
      ]),
    ]),

    h('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      margin: '0 96px', padding: '30px 0 44px 0', borderTop: '1.5px solid #282828',
    }, [
      h('div', {
        display: 'block', fontFamily: 'Geist Mono', fontSize: 21, color: '#7a7a7a',
        width: 760, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }, `$ ${command}`),
      h('div', { display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 500, color: '#ededed' }, [
        h('div', { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d97757', marginRight: 12, display: 'flex' }),
        'aitmpl.com',
      ]),
    ]),
  ]);
}

function entries() {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'public', 'components.json'), 'utf8'));
  const out = [];
  for (const typeKey of Object.keys(TYPE_LABEL)) {
    for (const c of catalog[typeKey] ?? []) {
      const path = c.path?.replace(/\.(md|json)$/, '') ?? c.name;
      if (!path || path.includes('..')) continue;
      out.push({
        typeKey,
        path,
        title: formatName(c.name),
        category: c.category || 'general',
        command: `npx claude-code-templates@latest ${TYPE_CONFIG[typeKey].flag} ${path}`,
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
