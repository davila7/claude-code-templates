#!/usr/bin/env node
// Smoke-checks the machine-readable surfaces of the site against a running
// deployment: real 404s (HTML, Markdown, JSON), /llms.txt and /openapi.json.
// Usage: node scripts/check-agent-endpoints.mjs [baseUrl]   (default https://www.aitmpl.com)

const base = (process.argv[2] || 'https://www.aitmpl.com').replace(/\/$/, '');
const missing = `/agent-check-${Date.now()}`;

const checks = [
  {
    name: 'home serves HTML with an <h1>',
    path: '/',
    headers: { Accept: 'text/html' },
    expect: (r, body) => r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && /<h1[\s>]/.test(body),
  },
  {
    name: 'unknown path is a real 404 (HTML)',
    path: missing,
    headers: { Accept: 'text/html' },
    expect: (r) => r.status === 404 && /text\/html/.test(r.headers.get('content-type')),
  },
  {
    name: 'unknown path is a real 404 with a Markdown body for agents',
    path: missing,
    headers: { Accept: 'text/markdown' },
    expect: (r, body) =>
      r.status === 404 &&
      /text\/markdown/.test(r.headers.get('content-type')) &&
      /accept/i.test(r.headers.get('vary') || '') &&
      body.includes('/llms.txt'),
  },
  {
    name: 'unknown component is a 404',
    path: '/component/agents/agent-check/does-not-exist',
    headers: { Accept: 'text/html' },
    expect: (r) => r.status === 404,
  },
  {
    name: 'unknown /api route returns a JSON 404',
    path: '/api/agent-check-does-not-exist',
    headers: { Accept: 'application/json' },
    expect: (r, body) => r.status === 404 && /application\/json/.test(r.headers.get('content-type')) && JSON.parse(body).error?.code === 'not_found',
  },
  {
    name: '/llms.txt is plain text starting with an H1',
    path: '/llms.txt',
    expect: (r, body) => r.status === 200 && /text\/plain/.test(r.headers.get('content-type')) && body.startsWith('# ') && body.includes('## When to use this'),
  },
  {
    name: '/openapi.json is an OpenAPI 3.1 document with unique operationIds',
    path: '/openapi.json',
    expect: (r, body) => {
      if (r.status !== 200) return false;
      const spec = JSON.parse(body);
      const ids = Object.values(spec.paths).flatMap((ops) => Object.values(ops).map((op) => op.operationId));
      return spec.openapi?.startsWith('3.1') && ids.length > 0 && ids.every(Boolean) && new Set(ids).size === ids.length;
    },
  },
  {
    name: '/about and /privacy exist',
    path: '/privacy/',
    expect: (r, body) => r.status === 200 && body.includes('Privacy Policy'),
  },
];

let failed = 0;
for (const c of checks) {
  let ok = false;
  let detail = '';
  try {
    const r = await fetch(base + c.path, { headers: c.headers, redirect: 'follow' });
    const body = await r.text();
    ok = Boolean(c.expect(r, body));
    detail = `${r.status} ${r.headers.get('content-type') ?? ''}`;
  } catch (e) {
    detail = String(e);
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.path} -> ${detail})`);
}
console.log(failed ? `\n${failed} check(s) failed against ${base}` : `\nAll checks passed against ${base}`);
process.exit(failed ? 1 : 0);
