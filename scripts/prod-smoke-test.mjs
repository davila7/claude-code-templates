#!/usr/bin/env node
// Production smoke test for aitmpl.com: web pages, API routes and the published CLI.
//
// Read-only by design: it never calls a route that writes (download tracking is
// probed with an invalid body that the route rejects before inserting, the
// cron-only /api/health-check and /api/claude-code-check are skipped because a
// GET runs them), and the CLI runs with tracking off in a temp directory.
//
// Usage:
//   node scripts/prod-smoke-test.mjs [--base https://www.aitmpl.com] [--only web,api,cli] [--cli-version latest]
// Exit code 1 when any check fails. Node 22+ (global fetch).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = opt('base', 'https://www.aitmpl.com').replace(/\/$/, '');
const only = new Set(opt('only', 'web,api,cli').split(','));
const cliVersion = opt('cli-version', 'latest');

const TYPES = [
  // [catalog file, singular used in /component/{singular}/...]
  ['agents', 'agent'],
  ['commands', 'command'],
  ['mcps', 'mcp'],
  ['hooks', 'hook'],
  ['settings', 'setting'],
  ['skills', 'skill'],
  ['mods', 'mod'],
  ['loops', 'loop'],
];

const results = [];
async function check(section, name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ section, name, ok: true, detail, ms: Date.now() - started });
  } catch (err) {
    results.push({ section, name, ok: false, detail: err.message, ms: Date.now() - started });
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function get(path, init = {}) {
  const res = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...init });
  const body = await res.text();
  return { res, body, type: res.headers.get('content-type') || '' };
}
async function getJson(path) {
  const { res, body, type } = await get(path);
  assert(res.status === 200, `${path} -> HTTP ${res.status}`);
  assert(/json/.test(type), `${path} -> content-type ${type}`);
  return JSON.parse(body);
}

// A component page must render: right title, markdown headings from SSR, parseable
// JSON-LD, and none of the markup the sanitizer is there to strip.
function assertComponentPage(path, body) {
  assert(!/Component Not Found/.test(body), `${path} rendered "Component Not Found"`);
  assert(/<h1[\s>]/.test(body), `${path} has no <h1>`);
  const ld = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert(ld.length > 0, `${path} has no JSON-LD`);
  for (const [, json] of ld) JSON.parse(json);
  assert(!/<script>\s*alert|\sonerror=/i.test(body), `${path} contains unsanitized script markup`);
}

// ─── Web ──────────────────────────────────────────────────────────────
async function web() {
  await check('web', 'home is HTML with an <h1>', async () => {
    const { res, body, type } = await get('/');
    assert(res.status === 200 && /text\/html/.test(type) && /<h1[\s>]/.test(body), `HTTP ${res.status} ${type}`);
    return `HTTP 200, ${body.length} bytes`;
  });

  for (const [plural] of TYPES) {
    await check('web', `/${plural} listing page`, async () => {
      const { res } = await get(`/${plural}/`);
      assert(res.status === 200, `HTTP ${res.status}`);
      return 'HTTP 200';
    });
  }

  for (const path of ['/trending/', '/about/', '/privacy/', '/developers/catalog-api/', '/blog/blog-articles.json', '/llms.txt', '/sitemap.xml', '/robots.txt']) {
    await check('web', path, async () => {
      const { res } = await get(path);
      assert(res.status === 200, `HTTP ${res.status}`);
      return 'HTTP 200';
    });
  }

  await check('web', 'unknown path is a real 404', async () => {
    const { res } = await get(`/smoke-missing-${Date.now()}`, { headers: { Accept: 'text/html' } });
    assert(res.status === 404, `HTTP ${res.status}`);
    return 'HTTP 404';
  });

  // Catalog data the islands load, then one component page per type taken from it
  const counts = await getJson('/counts.json').catch(() => null);
  await check('web', 'counts.json', async () => {
    assert(counts && counts.agents > 0 && counts.skills > 0, `counts ${JSON.stringify(counts)}`);
    return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ');
  });

  for (const [plural, singular] of TYPES) {
    let list = [];
    await check('web', `components/${plural}.json matches counts.json`, async () => {
      list = await getJson(`/components/${plural}.json`);
      assert(Array.isArray(list) && list.length > 0, 'empty or not an array');
      if (counts?.[plural] !== undefined) assert(list.length === counts[plural], `${list.length} entries vs counts ${counts[plural]}`);
      return `${list.length} entries`;
    });
    if (!list.length) continue;

    // The most downloaded component is the one people actually open
    const top = [...list].sort((a, b) => (b.downloads || 0) - (a.downloads || 0))[0];
    const slug = top.path.replace(/\.(md|json)$/, '');
    await check('web', `component page /component/${singular}/${slug}`, async () => {
      const path = `/component/${singular}/${slug}`;
      const { res, body } = await get(path);
      assert(res.status === 200, `HTTP ${res.status}`);
      assertComponentPage(path, body);
      return `HTTP 200, ${body.length} bytes`;
    });
    await check('web', `component-content for ${plural}/${top.name}`, async () => {
      const data = await getJson(`/component-content/${plural}/${slug}.json`);
      assert(data && (data.content || data.files), 'no content/files field');
      return 'ok';
    });
  }

  await check('web', 'search-index.json', async () => {
    const idx = await getJson('/search-index.json');
    assert(Array.isArray(idx) && idx.length > 1000, `${idx.length} entries`);
    return `${idx.length} entries`;
  });

  await check('web', 'trending-data.json', async () => {
    const t = await getJson('/trending-data.json');
    assert(t && typeof t === 'object', 'not an object');
    return 'ok';
  });

  // Pages that exercise the markdown sanitizer on content known to carry HTML
  for (const path of ['/component/agent/data-ai/prompt-builder', '/component/skill/creative-design/marp-slide', '/component/skill/creative-design/remotion-best-practices']) {
    await check('web', `sanitized markdown renders ${path}`, async () => {
      const { res, body } = await get(path);
      assert(res.status === 200, `HTTP ${res.status}`);
      assertComponentPage(path, body);
      return 'ok';
    });
  }
}

// ─── API ──────────────────────────────────────────────────────────────
async function api() {
  await check('api', '/openapi.json is OpenAPI 3.1', async () => {
    const spec = await getJson('/openapi.json');
    assert(spec.openapi?.startsWith('3.1'), `openapi ${spec.openapi}`);
    return `${Object.keys(spec.paths).length} paths`;
  });

  await check('api', '/api/v1/version.json', async () => {
    const v = await getJson('/api/v1/version.json');
    assert(/^1\./.test(v.schemaVersion ?? ''), `schemaVersion ${v.schemaVersion}`);
    return `schema ${v.schemaVersion}`;
  });

  await check('api', '/api/v1/catalog.json lists components', async () => {
    const c = await getJson('/api/v1/catalog.json');
    const n = Array.isArray(c.components) ? c.components.length : 0;
    assert(n > 1000, `${n} components`);
    return `${n} components`;
  });

  await check('api', '/api/ads/active returns an ads array', async () => {
    const a = await getJson('/api/ads/active');
    assert(Array.isArray(a.ads), 'no ads array');
    return `${a.ads.length} active`;
  });

  await check('api', '/api/collections requires auth', async () => {
    const { res } = await get('/api/collections');
    assert(res.status === 401, `HTTP ${res.status}`);
    return 'HTTP 401';
  });

  // Validation runs before the insert, so an empty body writes nothing
  await check('api', '/api/track-download-supabase validates input', async () => {
    const { res } = await get('/api/track-download-supabase', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert(res.status === 400, `HTTP ${res.status}`);
    return 'HTTP 400 on empty body';
  });

  await check('api', 'unknown /api route is a JSON 404', async () => {
    const { res, body, type } = await get('/api/smoke-missing');
    assert(res.status === 404 && /json/.test(type), `HTTP ${res.status} ${type}`);
    JSON.parse(body);
    return 'HTTP 404 JSON';
  });
}

// ─── CLI ──────────────────────────────────────────────────────────────
function runCli(dir, cliArgs) {
  const r = spawnSync('npx', ['-y', `claude-code-templates@${cliVersion}`, ...cliArgs], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 240000,
    env: { ...process.env, CCT_NO_TRACKING: 'true', CCT_NO_ANALYTICS: 'true', CI: 'true' },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

async function cli() {
  await check('cli', `claude-code-templates@${cliVersion} --version`, async () => {
    const { code, out } = runCli(tmpdir(), ['--version']);
    assert(code === 0 && /\d+\.\d+\.\d+/.test(out), `exit ${code}: ${out.slice(-200)}`);
    return out.trim().split('\n').pop();
  });

  const dir = mkdtempSync(join(tmpdir(), 'cct-smoke-'));
  try {
    const install = [
      '--agent', 'development-team/frontend-developer',
      '--command', 'testing/generate-test-cases',
      '--mcp', 'devtools/context7',
      '--hook', 'automation/simple-notifications',
      '--setting', 'model/use-sonnet',
      '--skill', 'development/skill-creator',
      '--mod', 'security/secret-redactor',
      '--directory', dir,
      '--yes',
    ];
    await check('cli', 'batch install of agent, command, mcp, hook, setting, skill, mod', async () => {
      const { code, out } = runCli(dir, install);
      assert(code === 0, `exit ${code}: ${out.slice(-400)}`);
      assert(!/\b[1-9]\d* failed\b/.test(out), out.slice(-400));
      return out.match(/Installed .*/)?.[0] ?? 'exit 0';
    });

    const expected = {
      agent: '.claude/agents/frontend-developer.md',
      command: '.claude/commands/generate-test-cases.md',
      mcp: '.mcp.json',
      'setting + hook': '.claude/settings.local.json',
      skill: '.claude/skills/skill-creator/SKILL.md',
      mod: '.claude/skills/secret-redactor/.claude-plugin/plugin.json',
    };
    for (const [what, rel] of Object.entries(expected)) {
      await check('cli', `${what} written to ${rel}`, async () => {
        const p = join(dir, rel);
        assert(existsSync(p), 'missing');
        const text = readFileSync(p, 'utf8');
        assert(text.length > 20, 'empty file');
        if (rel.endsWith('.json')) JSON.parse(text);
        return `${text.length} bytes`;
      });
    }

    await check('cli', '.mcp.json has the context7 server', async () => {
      const mcp = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
      assert(mcp.mcpServers && Object.keys(mcp.mcpServers).some((k) => /context7/i.test(k)), Object.keys(mcp.mcpServers || {}).join(','));
      return 'ok';
    });

    await check('cli', 'settings.local.json has the hook and the model', async () => {
      const s = JSON.parse(readFileSync(join(dir, '.claude/settings.local.json'), 'utf8'));
      assert(s.hooks && Object.keys(s.hooks).length > 0, 'no hooks');
      assert(s.model, 'no model');
      return `model=${s.model}, hook events=${Object.keys(s.hooks).join(',')}`;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (only.has('web')) await web();
if (only.has('api')) await api();
if (only.has('cli')) await cli();

const failed = results.filter((r) => !r.ok);
let section = '';
for (const r of results) {
  if (r.section !== section) {
    section = r.section;
    console.log(`\n${section.toUpperCase()}`);
  }
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail}, ${r.ms} ms)`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  const rows = results.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.section} | ${r.name} | ${String(r.detail).replace(/\|/g, '\\|').slice(0, 160)} |`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Production smoke test\n\n${results.length - failed.length}/${results.length} passed against ${base}\n\n| | Area | Check | Detail |\n|---|---|---|---|\n${rows.join('\n')}\n`,
  );
}
process.exit(failed.length ? 1 : 0);
