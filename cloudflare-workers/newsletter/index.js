/**
 * Cloudflare Worker: Newsletter — Biweekly Community Components Email
 *
 * Picks trending components (Skills, Agents, MCPs, Hooks, Settings) with
 * weighted randomness, composes a simple email whose wording rotates on
 * every send, and delivers it via Resend's TRANSACTIONAL batch API
 * (POST /emails/batch) — no Resend marketing-contacts quota involved.
 *
 * Subscribers live in Neon (`email_subscribers`, migration 003), synced from
 * Clerk. Unsubscribe is owned here too: every email carries a per-recipient
 * token link to this worker's public GET/POST /unsubscribe endpoint, plus
 * RFC 8058 List-Unsubscribe headers for one-click unsubscribe in Gmail etc.
 *
 * Send cadence and chunking:
 * - The cron fires every 10 minutes on Sunday 16:00–17:50 UTC, but only
 *   sends on EVEN ISO weeks (biweekly; Cloudflare cron can't express
 *   "every 2 weeks").
 * - Each invocation processes up to CHUNK_SIZE pending subscribers (the
 *   Workers free plan allows 50 subrequests per invocation), marks them
 *   `last_sent_at`, and lets the next cron firing pick up the rest. When
 *   nothing is pending the firing is a cheap no-op. This also makes cron
 *   double-fires harmless: a duplicate invocation just grabs the next chunk.
 *
 * Zero npm dependencies: Neon is queried over its HTTP SQL API with fetch().
 *
 * Error tracking: set SENTRY_DSN (wrangler secret put SENTRY_DSN) to report
 * failures to the "aitmpl-workers" Sentry project. Optional — the worker
 * degrades gracefully (console.error only) if it's not configured.
 */

import { reportError, checkIn } from './sentry.js';

const RESEND_API = 'https://api.resend.com';
const MONITOR_SLUG = 'newsletter-weekly';
const BATCH_SIZE = 100; // Resend /emails/batch max
const CHUNK_SIZE = 1000; // subscribers per invocation (10 batches + updates ≈ 25 subrequests)

// Component categories featured in every email, in this fixed order.
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
    // Biweekly cadence: only send on EVEN ISO weeks. Keeps ~10.8K subscribers
    // × 2 sends/month ≈ 22K emails, within the Resend Pro 50K/month quota.
    const week = isoWeek(new Date());
    if (week % 2 !== 0) {
      console.log(`📬 Newsletter: skipping odd ISO week ${week} (biweekly cadence)`);
      return;
    }
    console.log(`📬 Newsletter: cron firing (ISO week ${week})...`);
    // Pick up signups since the last campaign before sending. Incremental and
    // cheap: walks Clerk newest-first and stops at the first fully-known page.
    try {
      const synced = await syncNewSubscribers(env);
      if (synced > 0) console.log(`Newsletter: synced ${synced} new subscribers from Clerk`);
    } catch (e) {
      // A sync failure must not block the send — existing subscribers still get it.
      console.error('Newsletter: Clerk sync failed, sending to existing subscribers:', e.message);
      await reportError(env, e, { worker: 'aitmpl-newsletter', step: 'clerk-sync' });
    }
    await runNewsletter(env, { send: true });
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const authorized = () => {
      const authHeader = request.headers.get('Authorization');
      return env.TRIGGER_SECRET && authHeader === `Bearer ${env.TRIGGER_SECRET}`;
    };

    // Public unsubscribe: GET for humans clicking the email link, POST for
    // RFC 8058 one-click unsubscribe from mail clients. The token IS the
    // credential, so no other auth applies.
    if (url.pathname === '/unsubscribe' && (request.method === 'GET' || request.method === 'POST')) {
      return handleUnsubscribe(env, url.searchParams.get('token'));
    }

    // Resend engagement webhook (opens, clicks, bounces, complaints).
    // Authenticated by svix signature, not the bearer token.
    if (url.pathname === '/webhooks/resend' && request.method === 'POST') {
      return handleResendWebhook(env, request);
    }

    // Manual incremental Clerk sync.
    if (url.pathname === '/sync' && request.method === 'POST') {
      if (!authorized()) return jsonResponse({ error: 'Unauthorized' }, 401);
      try {
        const synced = await syncNewSubscribers(env);
        return jsonResponse({ success: true, synced });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // Campaign stats aggregated from webhook events.
    // GET /stats            -> all campaigns
    // GET /stats?campaign=newsletter-2026-07-12 -> one campaign
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (!authorized()) return jsonResponse({ error: 'Unauthorized' }, 401);
      try {
        return jsonResponse(await campaignStats(env, url.searchParams.get('campaign')));
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // Manual trigger: processes ONE chunk per call (repeat until remaining=0).
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

    // Content preview — composes the email without sending or touching Neon.
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
        schedule: 'biweekly (even ISO weeks), Sundays 16:00-17:50 UTC in chunks',
        categories: CATEGORIES.map((c) => c.key),
      });
    }

    return new Response(
      'Newsletter — Biweekly Community Components Email\n\nEndpoints:\n- POST /trigger (requires auth, ?send=false for dry run, one chunk per call)\n- GET /preview (requires auth, ?format=text for plain text)\n- GET/POST /unsubscribe?token=... (public)\n- GET /status',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};

// ─── Runner ──────────────────────────────────────────────────────────────────

async function runNewsletter(env, opts = {}) {
  const { send = true } = opts;
  const checkInId = await checkIn(env, MONITOR_SLUG, 'in_progress');

  try {
    const recipients = await getPendingSubscribers(env, CHUNK_SIZE);
    if (send && recipients.length === 0) {
      console.log('Newsletter: no pending subscribers, nothing to do');
      await checkIn(env, MONITOR_SLUG, 'ok', checkInId);
      return { success: true, skipped: 'no pending subscribers' };
    }

    const { subject, text, html, picks } = await buildEmail(env);

    let delivery = { sent: 0 };
    if (send) {
      delivery = await sendBatches(env, recipients, { subject, text, html });
    }

    const remaining = send ? await countPendingSubscribers(env) : recipients.length;
    await checkIn(env, MONITOR_SLUG, 'ok', checkInId);
    return {
      success: true,
      subject,
      picks: picks.map((p) => `${p.type}: ${p.name}`),
      delivery,
      remaining,
    };
  } catch (error) {
    console.error('Newsletter failed:', error);
    await reportError(env, error, { worker: 'aitmpl-newsletter' });
    await checkIn(env, MONITOR_SLUG, 'error', checkInId);
    throw error;
  }
}

// ─── Neon (HTTP SQL API, no driver) ──────────────────────────────────────────

async function neonSql(env, query, params = []) {
  if (!env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL is not configured');
  const host = new URL(env.NEON_DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'https://')).hostname;
  const res = await fetch(`https://${host}/sql`, {
    method: 'POST',
    headers: {
      'Neon-Connection-String': env.NEON_DATABASE_URL,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Neon query failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  return data.rows || [];
}

// Active subscribers not yet reached by the current campaign. The 7-day
// window means a send marks a subscriber for the whole biweekly cycle while
// still allowing the multi-invocation chunking within the same Sunday.
const PENDING_WHERE = `unsubscribed_at IS NULL AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '7 days')`;

async function getPendingSubscribers(env, limit) {
  return neonSql(
    env,
    `SELECT id, email, unsubscribe_token FROM email_subscribers WHERE ${PENDING_WHERE} ORDER BY id LIMIT $1`,
    [limit]
  );
}

async function countPendingSubscribers(env) {
  const [row] = await neonSql(env, `SELECT COUNT(*)::int AS n FROM email_subscribers WHERE ${PENDING_WHERE}`);
  return row?.n ?? 0;
}

async function markSent(env, ids) {
  if (ids.length === 0) return;
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  await neonSql(env, `UPDATE email_subscribers SET last_sent_at = NOW(), updated_at = NOW() WHERE id IN (${ph})`, ids);
}

// Incremental Clerk → Neon sync: walks Clerk users newest-first and upserts
// until it hits a page where every user is already known (then one more page
// costs nothing and it stops). Cheap enough to run before every send.
async function syncNewSubscribers(env) {
  if (!env.CLERK_SECRET_KEY) throw new Error('CLERK_SECRET_KEY is not configured');
  let inserted = 0;
  let offset = 0;
  const MAX_PAGES = 20; // safety bound: 2,000 newest users per run

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=100&offset=${offset}&order_by=-created_at`,
      { headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` } }
    );
    if (!res.ok) throw new Error(`Clerk API failed (${res.status})`);
    const users = await res.json();
    if (users.length === 0) break;

    const candidates = [];
    for (const u of users) {
      const p = u.email_addresses?.find((e) => e.id === u.primary_email_address_id) || u.email_addresses?.[0];
      const email = p?.email_address?.toLowerCase();
      if (email && p.verification?.status === 'verified') candidates.push({ id: u.id, email });
    }
    if (candidates.length === 0) {
      offset += 100;
      continue;
    }

    // Which of these are genuinely new? (clerk_user_id is the identity; a
    // known email under a new account is skipped so nobody gets duplicates.)
    const ids = candidates.map((c) => c.id);
    const emails = candidates.map((c) => c.email);
    const known = await neonSql(
      env,
      `SELECT clerk_user_id, email FROM email_subscribers
       WHERE clerk_user_id = ANY($1::text[]) OR email = ANY($2::text[])`,
      [ids, emails]
    );
    const knownIds = new Set(known.map((r) => r.clerk_user_id));
    const knownEmails = new Set(known.map((r) => r.email));
    const fresh = candidates.filter((c) => !knownIds.has(c.id) && !knownEmails.has(c.email));

    if (fresh.length > 0) {
      const values = fresh.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(',');
      await neonSql(
        env,
        `INSERT INTO email_subscribers (clerk_user_id, email) VALUES ${values}
         ON CONFLICT (clerk_user_id) DO NOTHING`,
        fresh.flatMap((c) => [c.id, c.email])
      );
      inserted += fresh.length;
    }

    // Entire page already known → everything older is known too.
    if (fresh.length === 0 && knownIds.size > 0) break;
    offset += 100;
  }
  return inserted;
}

// Verify a svix-signed Resend webhook (no SDK: HMAC-SHA256 over
// "<id>.<timestamp>.<body>" with the base64 secret after "whsec_").
async function verifySvixSignature(env, request, body) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatures = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;
  // Reject stale timestamps (>5 min) to prevent replay.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return signatures.split(' ').some((s) => s.split(',')[1] === expected);
}

const TRACKED_EVENTS = {
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

async function handleResendWebhook(env, request) {
  try {
    const body = await request.text();
    if (!(await verifySvixSignature(env, request, body))) {
      return jsonResponse({ error: 'invalid signature' }, 401);
    }

    const payload = JSON.parse(body);
    const eventType = TRACKED_EVENTS[payload.type];
    if (!eventType) return jsonResponse({ ok: true, ignored: payload.type });

    const d = payload.data || {};
    const campaign = (d.tags && (d.tags.campaign || d.tags.find?.((t) => t.name === 'campaign')?.value)) || null;
    await neonSql(
      env,
      `INSERT INTO email_events (resend_email_id, recipient, event_type, url, campaign, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        d.email_id || null,
        (Array.isArray(d.to) ? d.to[0] : d.to) || null,
        eventType,
        d.click?.link || null,
        campaign,
        payload.created_at || new Date().toISOString(),
      ]
    );
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Webhook handling failed:', error);
    await reportError(env, error, { worker: 'aitmpl-newsletter', endpoint: '/webhooks/resend' });
    // 500 so svix retries the delivery.
    return jsonResponse({ error: 'internal' }, 500);
  }
}

async function campaignStats(env, campaign) {
  const where = campaign ? `WHERE campaign = $1` : '';
  const params = campaign ? [campaign] : [];
  const rows = await neonSql(
    env,
    `SELECT campaign,
            COUNT(DISTINCT recipient) FILTER (WHERE event_type = 'opened')::int AS unique_opens,
            COUNT(*) FILTER (WHERE event_type = 'opened')::int AS total_opens,
            COUNT(DISTINCT recipient) FILTER (WHERE event_type = 'clicked')::int AS unique_clickers,
            COUNT(*) FILTER (WHERE event_type = 'clicked')::int AS total_clicks,
            COUNT(*) FILTER (WHERE event_type = 'bounced')::int AS bounces,
            COUNT(*) FILTER (WHERE event_type = 'complained')::int AS complaints
     FROM email_events ${where} GROUP BY campaign ORDER BY campaign DESC`,
    params
  );
  const links = await neonSql(
    env,
    `SELECT campaign, url, COUNT(*)::int AS clicks, COUNT(DISTINCT recipient)::int AS unique_clickers
     FROM email_events ${where ? where + ' AND' : 'WHERE'} event_type = 'clicked' AND url IS NOT NULL
     GROUP BY campaign, url ORDER BY clicks DESC LIMIT 25`,
    params
  );
  const [subs] = await neonSql(
    env,
    `SELECT COUNT(*)::int AS active, COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed
     FROM email_subscribers`
  );
  return { campaigns: rows, topLinks: links, subscribers: subs };
}

async function handleUnsubscribe(env, token) {
  const htmlPage = (title, body) =>
    new Response(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px;"><h2>${title}</h2><p>${body}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return htmlPage('Invalid link', 'This unsubscribe link is not valid.');
  }
  try {
    const rows = await neonSql(
      env,
      `UPDATE email_subscribers SET unsubscribed_at = NOW(), updated_at = NOW()
       WHERE unsubscribe_token = $1::uuid AND unsubscribed_at IS NULL RETURNING id`,
      [token]
    );
    if (rows.length === 0) {
      // Unknown token or already unsubscribed — same friendly answer either way.
      return htmlPage('You are unsubscribed', 'This address will not receive the newsletter anymore.');
    }
    return htmlPage('Unsubscribed', 'Done — you will not receive the newsletter anymore. Sorry to see you go!');
  } catch (error) {
    await reportError(env, error, { worker: 'aitmpl-newsletter', endpoint: '/unsubscribe' });
    return htmlPage('Something went wrong', 'Please try again in a few minutes.');
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

// ISO 8601 week number (weeks start Monday; week 1 contains the first
// Thursday of the year). Used to gate the biweekly cadence.
function isoWeek(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

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
  'See you next time with a fresh batch.',
  "That's the roundup. Happy building with Claude Code.",
  'More in the next one. Keep building.',
  "That's all for now. Until next time!",
];

// Per-recipient unsubscribe URL replaces this placeholder at send time.
const UNSUB_PLACEHOLDER = '{{{UNSUBSCRIBE_URL}}}';

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
    `Unsubscribe: ${UNSUB_PLACEHOLDER}`,
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
    `<p>${escapeHtml(footerNote)}<br>\n<a href="${UNSUB_PLACEHOLDER}">Unsubscribe</a></p>`,
  ].join('\n');

  return { subject, text, html };
}

// ─── Delivery (Resend transactional batch API) ───────────────────────────────

async function sendBatches(env, recipients, { subject, text, html }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  if (!env.RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL is not configured');
  const unsubBase = (env.UNSUBSCRIBE_BASE_URL || '').replace(/\/$/, '');
  if (!unsubBase) throw new Error('UNSUBSCRIBE_BASE_URL is not configured');

  let sent = 0;
  const failedBatches = [];
  // Campaign tag flows into webhook events so /stats can group by send.
  const campaign = `newsletter-${new Date().toISOString().slice(0, 10)}`;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const body = batch.map((r) => {
      const unsubUrl = `${unsubBase}/unsubscribe?token=${r.unsubscribe_token}`;
      return {
        from: env.RESEND_FROM_EMAIL,
        to: [r.email],
        reply_to: env.NEWSLETTER_REPLY_TO || undefined,
        subject,
        text: text.replaceAll(UNSUB_PLACEHOLDER, unsubUrl),
        html: html.replaceAll(UNSUB_PLACEHOLDER, unsubUrl),
        tags: [{ name: 'campaign', value: campaign }],
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });

    const res = await fetch(`${RESEND_API}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      failedBatches.push(`batch@${i} (${res.status}): ${errBody.slice(0, 150)}`);
      // Do NOT mark this batch as sent — a later invocation retries it.
      continue;
    }

    await markSent(env, batch.map((r) => r.id));
    sent += batch.length;
  }

  if (failedBatches.length > 0) {
    await reportError(env, new Error(`Newsletter: ${failedBatches.length} batch(es) failed: ${failedBatches.join(' | ')}`), {
      worker: 'aitmpl-newsletter',
    });
  }

  return { sent, failedBatches: failedBatches.length };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
