/**
 * Cloudflare Worker: Newsletter — Weekly Community Components Email
 *
 * Picks trending components (Skills, Agents, MCPs, Hooks, Settings) with
 * weighted randomness, composes a simple email whose wording rotates on
 * every send, and delivers it as a Resend Broadcast to the segment in
 * RESEND_SEGMENT_ID. Resend injects the per-recipient unsubscribe link
 * ({{{RESEND_UNSUBSCRIBE_URL}}} in the body) and manages the suppression
 * list automatically. Replies go to NEWSLETTER_REPLY_TO.
 *
 * The segment is the safety gate: point RESEND_SEGMENT_ID at a test segment
 * (single recipient) while iterating, and at the full-audience segment when
 * going community-wide.
 *
 * Zero npm dependencies, matching the other workers in this directory.
 *
 * Error tracking: set SENTRY_DSN (wrangler secret put SENTRY_DSN) to report
 * failures to the "aitmpl-workers" Sentry project. Optional — the worker
 * degrades gracefully (console.error only) if it's not configured.
 */

import { reportError, checkIn } from './sentry.js';

const RESEND_API = 'https://api.resend.com';
const MONITOR_SLUG = 'newsletter-weekly';

// Component categories featured in every email (one pick per category).
// urlType matches the dashboard detail route: /component/<urlType>/<cleanPath>
const CATEGORIES = [
  { key: 'skills', label: 'Skill', flag: '--skill', urlType: 'skill' },
  { key: 'agents', label: 'Agent', flag: '--agent', urlType: 'agent' },
  { key: 'mcps', label: 'MCP', flag: '--mcp', urlType: 'mcp' },
  { key: 'hooks', label: 'Hook', flag: '--hook', urlType: 'hook' },
  { key: 'settings', label: 'Setting', flag: '--setting', urlType: 'setting' },
];

// ─── Entry Points ────────────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    console.log('📬 Newsletter: starting weekly send (cron)...');
    // dedupe guards against Cloudflare's documented occasional cron double-fire;
    // manual /trigger sends skip it so pilots/tests can send multiple times a day.
    await runNewsletter(env, { send: true, dedupe: true });
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const authorized = () => {
      const authHeader = request.headers.get('Authorization');
      return env.TRIGGER_SECRET && authHeader === `Bearer ${env.TRIGGER_SECRET}`;
    };

    // Manual trigger (real send unless ?send=false)
    if (url.pathname === '/trigger' && request.method === 'POST') {
      if (!authorized()) return jsonResponse({ error: 'Unauthorized' }, 401);
      const send = url.searchParams.get('send') !== 'false';
      try {
        const result = await runNewsletter(env, { send });
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // Content preview — composes the email without ever calling Resend.
    // Hit it repeatedly to see the wording/selection rotate.
    if (url.pathname === '/preview' && request.method === 'GET') {
      if (!authorized()) return jsonResponse({ error: 'Unauthorized' }, 401);
      try {
        const { subject, text, html } = await buildEmail(env);
        if (url.searchParams.get('format') === 'text') {
          return new Response(`Subject: ${subject}\n\n${text}`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
        return jsonResponse({ subject, text, html });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    if (url.pathname === '/status') {
      return jsonResponse({
        status: 'running',
        worker: 'aitmpl-newsletter',
        schedule: 'Sundays 16:00 UTC (Resend Broadcast to RESEND_SEGMENT_ID)',
        categories: CATEGORIES.map((c) => c.key),
      });
    }

    return new Response(
      'Newsletter — Weekly Community Components Email\n\nEndpoints:\n- POST /trigger (requires auth, ?send=false for dry run)\n- GET /preview (requires auth, ?format=text for plain text)\n- GET /status',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};

// ─── Runner ──────────────────────────────────────────────────────────────────

async function runNewsletter(env, opts = {}) {
  const { send = true, dedupe = false } = opts;
  const checkInId = await checkIn(env, MONITOR_SLUG, 'in_progress');

  try {
    if (send && dedupe && (await broadcastAlreadySentToday(env))) {
      console.log('Newsletter: broadcast for today already exists, skipping (cron double-fire guard)');
      await checkIn(env, MONITOR_SLUG, 'ok', checkInId);
      return { success: true, skipped: 'broadcast for today already sent' };
    }

    const { subject, text, html, picks } = await buildEmail(env);

    let delivery = { sent: false };
    if (send) {
      delivery = await sendBroadcast(env, { subject, text, html });
    }

    await checkIn(env, MONITOR_SLUG, 'ok', checkInId);
    return {
      success: true,
      subject,
      text,
      picks: picks.map((p) => `${p.type}: ${p.name}`),
      delivery,
    };
  } catch (error) {
    console.error('Newsletter failed:', error);
    await reportError(env, error, { worker: 'aitmpl-newsletter' });
    await checkIn(env, MONITOR_SLUG, 'error', checkInId);
    throw error;
  }
}

// ─── Data ────────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'aitmpl-newsletter/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function buildEmail(env) {
  const base = (env.DASHBOARD_URL || 'https://www.aitmpl.com').replace(/\/$/, '');
  const [trendingData, catalog] = await Promise.all([
    fetchJson(`${base}/trending-data.json`),
    fetchJson(`${base}/components.json`),
  ]);

  const picks = selectComponents(trendingData.trending, catalog, base);
  if (picks.length === 0) throw new Error('No components could be selected from trending data');

  const { subject, text, html } = composeEmail(picks);
  return { subject, text, html, picks };
}

/**
 * For each category, pick ONE component with probability proportional to its
 * recent downloads — popular components show up more often, but every send
 * can surface something different.
 */
function selectComponents(trending, catalog, base) {
  const picks = [];
  for (const cat of CATEGORIES) {
    const pool = (trending?.[cat.key] || []).filter((i) => i && i.name);
    if (pool.length === 0) continue;

    // Occasionally weight by monthly downloads instead of weekly, so the mix
    // between "spiking now" and "steady favorite" also rotates.
    const statKey = Math.random() < 0.7 ? 'downloadsWeek' : 'downloadsMonth';
    const item = pickWeighted(pool, statKey);

    const record = findInCatalog(catalog, cat.key, item);
    const path = installPath(record, item);
    picks.push({
      type: cat.label,
      flag: cat.flag,
      name: item.name,
      category: item.category,
      description: cleanDescription(record?.description),
      installPath: path,
      url: `${base}/component/${cat.urlType}/${path}`,
      downloadsToday: item.downloadsToday || 0,
      downloadsWeek: item.downloadsWeek || 0,
      downloadsMonth: item.downloadsMonth || 0,
      downloadsTotal: item.downloadsTotal || 0,
    });
  }
  return picks;
}

function pickWeighted(items, statKey) {
  const weights = items.map((i) => Math.max(1, Number(i[statKey]) || 0));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function findInCatalog(catalog, typeKey, item) {
  const list = catalog?.[typeKey] || [];
  return (
    list.find((c) => c.name === item.name && c.category === item.category) ||
    list.find((c) => c.name === item.name) ||
    null
  );
}

// Mirrors getInstallCommand in dashboard/src/lib/data.ts — the install path is
// the catalog `path` without its extension (e.g. "git-workflow/smart-commit").
function installPath(record, item) {
  if (record?.path) return record.path.replace(/\.(md|json)$/, '');
  if (item.category) return `${item.category}/${item.name}`;
  return item.name;
}

function cleanDescription(desc) {
  if (!desc) return '';
  let d = String(desc).trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ');
  // Keep it to one sentence-ish line.
  const firstStop = d.indexOf('. ');
  if (firstStop > 40) d = d.slice(0, firstStop + 1);
  if (d.length > 160) d = d.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '...';
  if (!/[.!?]$/.test(d)) d += '.';
  return d;
}

// ─── Composition (rotating copy) ─────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function formatCount(n) {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`;
  }
  return String(n);
}

const SUBJECTS = [
  (p) => `Claude Code Templates: this week on aitmpl.com`,
  (p) => `Claude Code Templates: ${p.length} components people are installing right now`,
  (p) => `Claude Code Templates: what people are installing this week`,
  (p) => `Claude Code Templates: ${p[0].name} and ${p.length - 1} more trending components`,
  (p) => `Claude Code Templates: fresh picks from aitmpl.com`,
  (p) => `Claude Code Templates: ${p.length} components worth a look`,
  (p) => `Claude Code Templates: the components people kept installing this week`,
];

const GREETINGS = ['Hey!', 'Hi there,', 'Hello!', 'Hey,', 'Hi!'];

// The intro is two short paragraphs: Daniel introduces himself, then frames
// the growing component catalog. The catalog line rotates.
const INTRO_PRESENTATIONS = [
  'Daniel from aitmpl.com here (on X: https://x.com/dani_avila7). You signed up on the site a while back, and I figured you would like to see what people are up to.',
];

const INTRO_CATALOGS = [
  "aitmpl.com keeps growing: over 2,000 Claude Code components and counting. Here's a quick pick of what people have been installing lately:",
  'New components land on aitmpl.com every week. These are the ones people have been installing the most lately:',
  'The catalog on aitmpl.com keeps getting bigger, so here goes a short list of what has been popular these days:',
];

// Per-component sentence builders: (description, statPhrase) => line
const ITEM_TEMPLATES = [
  (d, s) => (d ? `${d} It picked up ${s}.` : `Picked up ${s}.`),
  (d, s) => (d ? `${ucFirst(s)} and counting. ${d}` : `${ucFirst(s)} and counting.`),
  (d, s) => (d ? `${d} (${s})` : `(${s})`),
  (d, s) => (d ? `A community favorite right now with ${s}. ${d}` : `A community favorite right now with ${s}.`),
  (d, s) => (d ? `${d} Devs gave it ${s}.` : `Devs gave it ${s}.`),
  (d, s) => (d ? `${ucFirst(s)} for this one. ${d}` : `${ucFirst(s)} for this one.`),
];

function ucFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statPhrase(p) {
  const options = [];
  if (p.downloadsWeek > 0) options.push(`${formatCount(p.downloadsWeek)} downloads this week`);
  if (p.downloadsMonth > 0) options.push(`${formatCount(p.downloadsMonth)} installs this month`);
  if (p.downloadsTotal > 0) options.push(`over ${formatCount(p.downloadsTotal)} installs all-time`);
  if (options.length === 0) options.push('a steady stream of installs');
  return pick(options);
}

const CLOSERS = [
  "That's it for this week. Try one, break nothing, ship faster.",
  'See you next week with a fresh batch.',
  "That's the roundup. Happy building with Claude Code.",
  'More next week. Keep building.',
  "That's all for now. Until next week!",
];

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Turn bare URLs into anchors (skips trailing punctuation like the ")" in
// "(https://x.com/dani_avila7),"). Input must already be HTML-escaped.
function autolink(s) {
  return s.replace(/https?:\/\/[^\s<]*[^\s<.,)!?]/g, (url) => `<a href="${url}">${url}</a>`);
}

function composeEmail(picks) {
  // Category order is fixed (Skill, Agent, MCP, Hook, Setting) — picks arrive
  // already in CATEGORIES order.
  const subject = pick(SUBJECTS)(picks);
  const greeting = pick(GREETINGS);
  const presentation = pick(INTRO_PRESENTATIONS);
  const catalogLine = pick(INTRO_CATALOGS);
  const closer = pick(CLOSERS);
  const footerNote = 'You are receiving this because you have an account on aitmpl.com.';
  // Resend replaces this placeholder with a per-recipient unsubscribe link
  // when the email is sent as a Broadcast.
  const unsubscribe = 'Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}';

  const blocks = picks.map((p) => ({
    title: `${p.type}: ${p.name}`,
    line: pick(ITEM_TEMPLATES)(p.description, statPhrase(p)),
    url: p.url,
    install: `npx claude-code-templates@latest ${p.flag} ${p.installPath}`,
  }));

  // Plain-text version: blank lines between every element for phone readability.
  const text = [
    greeting,
    '',
    presentation,
    '',
    catalogLine,
    '',
    ...blocks.flatMap((b) => [b.title, b.line, '', `Check it out: ${b.url}`, '', `Install: ${b.install}`, '']),
    closer,
    '',
    footerNote,
    unsubscribe,
  ].join('\n');

  // HTML version: same content, minimal markup — bold + underlined component
  // titles, real links, no styling beyond that.
  const para = (s) => `<p>${autolink(escapeHtml(s)).replace(/\n/g, '<br>\n')}</p>`;
  const html = [
    para(greeting),
    para(presentation),
    para(catalogLine),
    ...blocks.map(
      (b) =>
        `<p><strong><u>${escapeHtml(b.title)}</u></strong><br>\n${autolink(escapeHtml(b.line))}</p>\n` +
        `<p>Check it out: <a href="${escapeHtml(b.url)}">${escapeHtml(b.url)}</a></p>\n` +
        `<p>Install: <code>${escapeHtml(b.install)}</code></p>`
    ),
    para(closer),
    `<p>${escapeHtml(footerNote)}<br>\n<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`,
  ].join('\n');

  return { subject, text, html };
}

// ─── Delivery (Resend) ───────────────────────────────────────────────────────

// True if a non-draft broadcast named "newsletter <today>" already exists.
// Resend accepts duplicate names, so this pre-flight check is what protects
// the audience from a double-send if the cron fires twice. Fails open: a
// listing error must not block the legitimate weekly send.
async function broadcastAlreadySentToday(env) {
  try {
    const res = await fetch(`${RESEND_API}/broadcasts`, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    const todayName = `newsletter ${new Date().toISOString().slice(0, 10)}`;
    return (data || []).some((b) => b.name === todayName && b.status !== 'draft');
  } catch {
    return false;
  }
}

// Creates a Broadcast targeting env.RESEND_SEGMENT_ID and sends it. Resend
// injects the per-recipient unsubscribe link and skips unsubscribed contacts.
async function sendBroadcast(env, { subject, text, html }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  if (!env.RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL is not configured');
  if (!env.RESEND_SEGMENT_ID) throw new Error('RESEND_SEGMENT_ID is not configured');

  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const createRes = await fetch(`${RESEND_API}/broadcasts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      segment_id: env.RESEND_SEGMENT_ID,
      from: env.RESEND_FROM_EMAIL,
      reply_to: env.NEWSLETTER_REPLY_TO || undefined,
      subject,
      text,
      html,
      name: `newsletter ${new Date().toISOString().slice(0, 10)}`,
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Resend broadcast create failed (${createRes.status}): ${body}`);
  }
  const { id } = await createRes.json();

  const sendRes = await fetch(`${RESEND_API}/broadcasts/${id}/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!sendRes.ok) {
    const body = await sendRes.text();
    throw new Error(`Resend broadcast send failed for created broadcast ${id} (${sendRes.status}): ${body}`);
  }

  return { sent: true, broadcastId: id };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
