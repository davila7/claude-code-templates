import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { buildLlmsTxt, type Counts } from '../lib/agent-readiness';

export const prerender = true;

// https://llmstxt.org — built at deploy time from the committed catalog counts.
export const GET: APIRoute = () => {
  let counts: Counts = {};
  try {
    counts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'counts.json'), 'utf-8'));
  } catch {
    // Counts are cosmetic here; the file stays useful without them.
  }
  return new Response(buildLlmsTxt(counts), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
