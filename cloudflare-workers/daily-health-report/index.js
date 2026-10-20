/**
 * Cloudflare Worker: Daily Health Report
 *
 * Sends a single daily Telegram digest covering:
 *  1. Dashboard site health (reuses GET /api/health-check)
 *  2. Sentry error summary (last 24h) across the 3 Sentry projects,
 *     auto-resolving known test/verification noise first (see
 *     NOISE_TITLE_PATTERNS below) so only real errors are reported.
 *
 * Auto-resolve policy (deliberately conservative): an issue is ONLY
 * auto-resolved if its title matches one of NOISE_TITLE_PATTERNS below —
 * literal substrings identifying our own manual verification events, never
 * a catch-all. Everything else (any real production error) is left
 * untouched and always listed in the Telegram digest for a human to review.
 * Never widen this to "resolve everything" — that would silently hide real
 * bugs instead of surfacing them, defeating the point of error tracking.
 *
 * Note: this worker does NOT poll the other 3 Cloudflare Workers' /status
 * endpoints. Cloudflare blocks Worker-to-Worker fetches over the public
 * *.workers.dev hostname within the same account (error 1042) — the fix
 * would be Service Bindings, not attempted here. Those workers' own health
 * is instead covered by their Sentry Cron Monitor check-ins (see
 * cloudflare-workers/{crons,pulse,docs-monitor}/sentry.js) surfaced in the
 * Sentry summary below.
 *
 * Complements, not replaces, the existing per-event notifications
 * (docs-monitor change/error alerts, pulse's weekly KPI report). This is a
 * proactive "everything's fine" / "here's what's broken" heartbeat, since
 * none of the other flows report positively when things are healthy.
 *
 * No npm dependencies — matches the zero-dependency style of the other
 * workers in this repo.
 */

const TELEGRAM_API = 'https://api.telegram.org';
const SENTRY_API = 'https://sentry.io/api/0';

const SENTRY_PROJECTS = ['aitmpl-workers', 'aitmpl-dashboard', 'aitmpl-cli'];

// Case-insensitive substrings identifying known noise (our own manual
// verification test events). An issue is auto-resolved ONLY if its title
// contains one of these — see the policy note above before adding more.
const NOISE_TITLE_PATTERNS = [
  'manual verification test',
  'manual verification',
];

export default {
  async scheduled(event, env, ctx) {
    await runReport(env);
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      return jsonResponse({
        status: 'running',
        worker: 'daily-health-report',
        schedule: 'Daily 14:00 UTC (10:00 AM EDT)',
      });
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!env.TRIGGER_SECRET || authHeader !== `Bearer ${env.TRIGGER_SECRET}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      const sendTelegram = url.searchParams.get('send') !== 'false';
      const result = await runReport(env, { sendTelegram });
      return jsonResponse(result);
    }

    return new Response(
      'Daily Health Report Worker\n\nEndpoints:\n- POST /trigger (requires auth)\n- GET /status',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};

// ─── Report Runner ───────────────────────────────────────────────────────────

async function runReport(env, opts = {}) {
  const { sendTelegram = true } = opts;

  const [siteHealth, sentry] = await Promise.all([
    checkSiteHealth(env),
    checkSentryErrors(env),
  ]);

  const reportText = formatReport({ siteHealth, sentry });

  let telegramResult = null;
  if (sendTelegram) {
    telegramResult = await sendToTelegram(env, reportText);
  }

  return {
    success: true,
    healthy: siteHealth.healthy !== false && !sentry.error,
    report: reportText,
    telegram: sendTelegram ? telegramResult : 'skipped',
  };
}

// ─── Section 1: Dashboard site health ────────────────────────────────────────

async function checkSiteHealth(env) {
  const base = env.DASHBOARD_URL || 'https://www.aitmpl.com';
  try {
    const res = await fetchJSON(`${base}/api/health-check`);
    return {
      healthy: res.healthy,
      results: res.results || [],
    };
  } catch (error) {
    return { healthy: false, error: error.message, results: [] };
  }
}

// ─── Section 2: Sentry error summary (last 24h) ──────────────────────────────

function isKnownNoise(title) {
  const lower = (title || '').toLowerCase();
  return NOISE_TITLE_PATTERNS.some(pattern => lower.includes(pattern));
}

async function resolveIssue(env, issueId) {
  const headers = {
    Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };
  try {
    const res = await fetch(`${SENTRY_API}/issues/${issueId}/`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'resolved' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkSentryErrors(env) {
  if (!env.SENTRY_AUTH_TOKEN || !env.SENTRY_ORG_SLUG) {
    return { error: 'SENTRY_AUTH_TOKEN or SENTRY_ORG_SLUG not configured', projects: [] };
  }

  const headers = { Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}` };

  const projects = await Promise.all(SENTRY_PROJECTS.map(async (slug) => {
    try {
      const url = `${SENTRY_API}/organizations/${env.SENTRY_ORG_SLUG}/issues/` +
        `?project=${slug}&query=is:unresolved age:-24h&statsPeriod=24h`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { slug, error: `HTTP ${res.status}` };
      }
      const issues = await res.json();
      const allIssues = Array.isArray(issues) ? issues : [];

      const noiseIssues = allIssues.filter(i => isKnownNoise(i.title));
      const realIssues = allIssues.filter(i => !isKnownNoise(i.title));

      const autoResolved = [];
      for (const issue of noiseIssues) {
        const ok = await resolveIssue(env, issue.id);
        if (ok) autoResolved.push(issue.title);
      }

      return {
        slug,
        newIssueCount: realIssues.length,
        autoResolvedCount: autoResolved.length,
        autoResolvedTitles: autoResolved,
        topIssues: realIssues.slice(0, 3).map(i => ({
          title: i.title,
          count: i.count,
          permalink: i.permalink,
        })),
      };
    } catch (error) {
      return { slug, error: error.message };
    }
  }));

  return { projects };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatReport({ siteHealth, sentry }) {
  const now = new Date().toUTCString();
  const lines = [`<b>📋 Daily Health Report</b>`, `${now}`, ''];

  // Site health
  lines.push(`<b>🌐 Site (aitmpl.com)</b>`);
  if (siteHealth.healthy === true) {
    lines.push(`✅ All endpoints healthy`);
  } else if (siteHealth.error) {
    lines.push(`❌ Could not reach health-check: ${siteHealth.error}`);
  } else {
    const failing = siteHealth.results.filter(r => r.error || r.status >= 500 || r.status === 0);
    lines.push(`⚠️ Unhealthy — ${failing.length} endpoint(s) failing:`);
    for (const f of failing) {
      lines.push(`  • ${f.endpoint}: ${f.error || `HTTP ${f.status}`}`);
    }
  }
  lines.push('');

  // Sentry
  lines.push(`<b>🐛 Sentry (last 24h)</b>`);
  if (sentry.error) {
    lines.push(`⚠️ ${sentry.error}`);
  } else {
    for (const p of sentry.projects) {
      if (p.error) {
        lines.push(`⚠️ ${p.slug}: ${p.error}`);
        continue;
      }
      const noiseNote = p.autoResolvedCount > 0 ? ` (auto-resolved ${p.autoResolvedCount} test event(s))` : '';
      if (p.newIssueCount === 0) {
        lines.push(`✅ ${p.slug}: no new issues${noiseNote}`);
      } else {
        lines.push(`🔴 ${p.slug}: ${p.newIssueCount} unresolved issue(s)${noiseNote} — needs review`);
        for (const issue of p.topIssues) {
          lines.push(`  • ${issue.title} (${issue.count}x)`);
        }
      }
    }
  }

  return lines.join('\n');
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendToTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { sent: false, error: 'missing_credentials' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const result = await res.json();
    return { sent: result.ok === true, result };
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
    return { sent: false, error: error.message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
