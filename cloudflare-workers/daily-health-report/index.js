/**
 * Cloudflare Worker: Daily Health Report
 *
 * Sends a single daily Telegram digest covering:
 *  1. Dashboard site health (reuses GET /api/health-check)
 *  2. Sentry error summary (last 24h) across the 3 Sentry projects
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
      return {
        slug,
        newIssueCount: Array.isArray(issues) ? issues.length : 0,
        topIssues: (issues || []).slice(0, 3).map(i => ({
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
      if (p.newIssueCount === 0) {
        lines.push(`✅ ${p.slug}: no new issues`);
      } else {
        lines.push(`🔴 ${p.slug}: ${p.newIssueCount} unresolved issue(s)`);
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
