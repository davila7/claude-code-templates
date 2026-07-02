import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { FEATURED_ITEMS } from '../lib/constants';

export const prerender = true;

const SITE = 'https://www.aitmpl.com';

interface UrlOpts {
  priority?: string;
  changefreq?: string;
  lastmod?: string;
}

function buildUrl(loc: string, opts: UrlOpts = {}): string {
  const today = new Date().toISOString().split('T')[0];
  const {
    priority = '0.5',
    changefreq = 'weekly',
    lastmod = today,
  } = opts;
  return `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function safeReadJson<T>(relPath: string, fallback: T): T {
  try {
    const full = path.join(process.cwd(), 'public', relPath);
    return JSON.parse(fs.readFileSync(full, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export const GET: APIRoute = () => {
  const components = safeReadJson<Record<string, Array<{ path: string }>>>(
    'components.json',
    {}
  );
  const plugins = safeReadJson<Array<{ slug: string }>>('plugins.json', []);

  const urls: string[] = [];

  urls.push(buildUrl('/', { priority: '1.0', changefreq: 'daily' }));
  urls.push(buildUrl('/plugins', { priority: '0.9', changefreq: 'weekly' }));
  urls.push(buildUrl('/trending', { priority: '0.8', changefreq: 'daily' }));
  urls.push(buildUrl('/jobs', { priority: '0.6', changefreq: 'weekly' }));

  for (const type of ['agents', 'commands', 'skills', 'mcps', 'hooks', 'settings']) {
    urls.push(buildUrl(`/${type}`, { priority: '0.9', changefreq: 'daily' }));
  }

  for (const item of FEATURED_ITEMS) {
    urls.push(buildUrl(item.url, { priority: '0.7', changefreq: 'monthly' }));
  }

  for (const plugin of plugins) {
    if (plugin.slug) {
      urls.push(buildUrl(`/plugins/${plugin.slug}`, { priority: '0.7', changefreq: 'weekly' }));
    }
  }

  const COMPONENT_TYPES = ['agents', 'commands', 'skills', 'mcps', 'hooks', 'settings'];
  for (const type of COMPONENT_TYPES) {
    const items = components[type];
    if (!Array.isArray(items)) continue;
    for (const c of items) {
      if (!c.path) continue;
      const slug = c.path.replace(/\.(md|json)$/, '');
      urls.push(buildUrl(`/component/${type}/${slug}`, { priority: '0.6', changefreq: 'monthly' }));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
};
