// README badges, one per catalog component: public/badge/{type}/{path}.svg,
// "aitmpl installs | 12.9k". Authors paste the Markdown from the share menu on
// /trending ("Copy README badge"); GitHub proxies the image through camo.
//
// Runs before `astro build` (see package.json). Output is gitignored build
// output, regenerated on every deploy from public/components.json, so the
// count is the catalog's all-time install count as of that deploy.
//
// Usage: node scripts/generate-badges.mjs [--out dir]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = outIndex === -1 ? join(ROOT, 'public', 'badge') : args[outIndex + 1];

const TYPES = ['skills', 'agents', 'commands', 'settings', 'hooks', 'mcps', 'loops', 'mods', 'plugins'];
const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

export function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// Verdana 11px advance widths are what shields.io sizes with; an average per
// character is close enough for these short, known strings.
const width = (text) => Math.round(text.length * 6.6 + 12);

export function badgeSvg(value, label = 'aitmpl installs') {
  const lw = width(label);
  const vw = width(value);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}">
<title>${label}: ${value}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3a3936"/><rect x="${lw}" width="${vw}" height="20" fill="#d57455"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${value}</text>
</g>
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'public', 'components.json'), 'utf8'));
  let written = 0;
  for (const type of TYPES) {
    for (const c of catalog[type] ?? []) {
      const path = (c.path ?? '').replace(/\.(md|json)$/, '').replace(/^\/+|\/+$/g, '');
      const parts = path.split('/');
      if (!path || parts.length > 4 || !parts.every((p) => SEGMENT.test(p))) continue;
      const file = join(outDir, type, `${path}.svg`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, badgeSvg(compact(Number(c.downloads) || 0)));
      written++;
    }
  }
  console.log(`badges: ${written} written`);
}
