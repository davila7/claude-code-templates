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

// lastmod only where a real date exists (the component's last commit):
// Google ignores lastmod altogether when every URL claims to change daily.
function buildUrl(loc: string, opts: UrlOpts = {}): string {
  const { priority = '0.5', changefreq = 'weekly', lastmod } = opts;
  return `  <url>
    <loc>${SITE}${loc}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Date of the component's last commit, from its content file (written by
// scripts/generate_components_json.py).
function lastCommitDate(type: string, slug: string): string | undefined {
  const meta = safeReadJson<{ meta?: { lastCommit?: { date?: string } } }>(
    path.join('component-content', type, `${slug}.json`),
    {}
  );
  const date = meta.meta?.lastCommit?.date;
  return date ? date.slice(0, 10) : undefined;
}

// Blog articles are static files under public/blog/: one directory with an
// index.html per article (served at /blog/{slug}/), or a {slug}.html file
// (served at /blog/{slug}). Listed from disk, so an article missing from
// blog-articles.json is still in the sitemap.
function blogPaths(): string[] {
  const dir = path.join(process.cwd(), 'public', 'blog');
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths: string[] = [];
  for (const e of entries) {
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.html'))) {
      paths.push(`/blog/${e.name}/`);
    } else if (e.isFile() && e.name.endsWith('.html') && e.name !== 'index.html') {
      paths.push(`/blog/${e.name.slice(0, -'.html'.length)}`);
    }
  }
  return paths.sort();
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
  urls.push(buildUrl('/plugins/', { priority: '0.9', changefreq: 'weekly' }));
  urls.push(buildUrl('/trending/', { priority: '0.8', changefreq: 'daily' }));
  urls.push(buildUrl('/jobs/', { priority: '0.6', changefreq: 'weekly' }));
  urls.push(buildUrl('/certifications/', { priority: '0.6', changefreq: 'weekly' }));
  urls.push(buildUrl('/about/', { priority: '0.5', changefreq: 'monthly' }));
  urls.push(buildUrl('/supporters/', { priority: '0.4', changefreq: 'monthly' }));
  urls.push(buildUrl('/privacy/', { priority: '0.3', changefreq: 'yearly' }));
  urls.push(buildUrl('/developers/catalog-api/', { priority: '0.4', changefreq: 'monthly' }));

  for (const type of ['agents', 'commands', 'skills', 'mcps', 'hooks', 'settings', 'mods', 'loops']) {
    urls.push(buildUrl(`/${type}/`, { priority: '0.9', changefreq: 'daily' }));
  }

  urls.push(buildUrl('/blog/', { priority: '0.7', changefreq: 'weekly' }));
  for (const blogPath of blogPaths()) {
    urls.push(buildUrl(blogPath, { priority: '0.6', changefreq: 'monthly' }));
  }

  for (const item of FEATURED_ITEMS) {
    urls.push(buildUrl(item.url, { priority: '0.7', changefreq: 'monthly' }));
  }

  for (const plugin of plugins) {
    if (plugin.slug) {
      urls.push(buildUrl(`/plugins/${plugin.slug}/`, { priority: '0.7', changefreq: 'weekly' }));
    }
  }

  const COMPONENT_TYPES = ['agents', 'commands', 'skills', 'mcps', 'hooks', 'settings', 'mods', 'loops', 'plugins'];
  for (const type of COMPONENT_TYPES) {
    const items = components[type];
    if (!Array.isArray(items)) continue;
    for (const c of items) {
      if (!c.path) continue;
      const slug = c.path.replace(/\.(md|json)$/, '');
      urls.push(buildUrl(`/component/${type}/${slug}`, { priority: '0.6', changefreq: 'monthly', lastmod: lastCommitDate(type, slug) }));
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
