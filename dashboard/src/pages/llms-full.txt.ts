import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { buildLlmsFullTxt, type CatalogEntry, type Counts } from '../lib/agent-readiness';

export const prerender = true;

// https://llmstxt.org — /llms.txt plus the whole catalog, built at deploy time
// from the committed Catalog API v1 file.
export const GET: APIRoute = () => {
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', file), 'utf-8'));
  let counts: Counts = {};
  try {
    counts = read('counts.json');
  } catch {
    // Counts are cosmetic here.
  }
  // The catalog is the point of this file: let the build fail if it is missing.
  const components: CatalogEntry[] = read(path.join('api', 'v1', 'catalog.json')).components;
  return new Response(buildLlmsFullTxt(counts, components), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
