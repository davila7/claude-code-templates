/**
 * Cloudflare Worker: Pulse — Weekly KPI Report
 *
 * Collects metrics from GitHub, Supabase, npm, and Google Analytics,
 * then sends a consolidated report via Telegram every Sunday at 14:00 UTC.
 *
 * All source collectors are in this single file (no npm dependencies).
 *
 * Error tracking: set SENTRY_DSN (wrangler secret put SENTRY_DSN) to report
 * failed collectors to the "aitmpl-workers" Sentry project. Optional — the
 * worker degrades gracefully (console.error only) if it's not configured.
 */

import { reportError, checkIn } from './sentry.js';

const REPO = 'davila7/claude-code-templates';
const NPM_PACKAGE = 'claude-code-templates';
const GITHUB_API = 'https://api.github.com';
const NPM_API = 'https://api.npmjs.org';
const GA4_API = 'https://analyticsdata.googleapis.com/v1beta';
const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;

// ─── Entry Points ────────────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    console.log('📊 Pulse: Starting weekly report (cron)...');
    await runReport(env);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Manual trigger
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!env.TRIGGER_SECRET || authHeader !== `Bearer ${env.TRIGGER_SECRET}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const onlySource = url.searchParams.get('source');
      const sendTelegram = url.searchParams.get('send') !== 'false';

      const result = await runReport(env, { onlySource, sendTelegram });
      return jsonResponse(result);
    }

    // Status endpoint
    if (url.pathname === '/status') {
      return jsonResponse({
        status: 'running',
        worker: 'pulse-weekly-report',
        schedule: 'Sundays 14:00 UTC',
        sources: ['github', 'downloads', 'returning', 'npm', 'analytics']
      });
    }

    return new Response(
      'Pulse — Weekly KPI Report Worker\n\nEndpoints:\n- POST /trigger (requires auth)\n- GET /status',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  }
};

// ─── Report Runner ───────────────────────────────────────────────────────────

async function runReport(env, opts = {}) {
  const { onlySource, sendTelegram = true } = opts;

  const checkInId = await checkIn(env, 'pulse-weekly-report', 'in_progress');

  let results = {};

  if (onlySource) {
    const collectors = {
      github: collectGitHub,
      downloads: collectDownloads,
      returning: collectReturning,
      npm: collectNpm,
      analytics: collectAnalytics
    };
    const collector = collectors[onlySource];
    if (!collector) {
      return { error: `Unknown source: ${onlySource}`, available: Object.keys(collectors) };
    }
    results[onlySource] = await collector(env);
  } else {
    const [github, downloads, returning, npm] = await Promise.all([
      collectGitHub(env),
      collectDownloads(env),
      collectReturning(env),
      collectNpm(env)
    ]);
    results = { github, downloads, returning, npm };
  }

  // Report any failed collectors to Sentry (they still degrade gracefully
  // into "Unavailable" in the rendered report — this just makes failures visible).
  const failedSources = Object.entries(results).filter(([, v]) => v && v.error);
  for (const [source, value] of failedSources) {
    await reportError(env, `pulse collector "${source}" failed: ${value.error}`, {
      worker: 'pulse-weekly-report',
      source
    });
  }

  const reportText = formatReport(results);

  let telegramResult = null;
  if (sendTelegram) {
    telegramResult = await sendToTelegram(env, reportText);
  }

  await checkIn(env, 'pulse-weekly-report', failedSources.length > 0 ? 'error' : 'ok', checkInId);

  return {
    success: true,
    sources: Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, v.error ? 'error' : 'ok'])
    ),
    report: reportText,
    telegram: sendTelegram ? telegramResult : 'skipped'
  };
}

// ─── Source: GitHub ──────────────────────────────────────────────────────────

async function collectGitHub(env) {
  try {
    if (!env.GITHUB_TOKEN) return { error: 'GITHUB_TOKEN not configured' };

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'Pulse-Weekly-Report/1.0'
    };

    const since = weekAgo();
    const sinceISO = since.toISOString();

    const [repoRes, issuesRes, prsRes] = await Promise.all([
      fetchJSON(`${GITHUB_API}/repos/${REPO}`, { headers }),
      fetchJSON(`${GITHUB_API}/repos/${REPO}/issues?state=all&since=${sinceISO}&per_page=100`, { headers }),
      fetchJSON(`${GITHUB_API}/repos/${REPO}/pulls?state=all&sort=updated&direction=desc&per_page=100`, { headers })
    ]);

    const repo = repoRes;

    // Filter issues (exclude PRs) created this week
    const weekIssues = issuesRes.filter(
      i => !i.pull_request && new Date(i.created_at) >= since
    );
    const closedThisWeek = issuesRes.filter(
      i => !i.pull_request && i.state === 'closed' && i.closed_at && new Date(i.closed_at) >= since
    );

    // Filter PRs from this week
    const weekPRs = prsRes.filter(pr => new Date(pr.created_at) >= since);
    const mergedPRs = prsRes.filter(pr => pr.merged_at && new Date(pr.merged_at) >= since);

    // Count new stars this week — paginate to the last page to get most recent
    let starsWeek = null;
    try {
      const starHeaders = { ...headers, Accept: 'application/vnd.github.v3.star+json' };
      // HEAD request to get total pages from Link header
      const headRes = await fetch(`${GITHUB_API}/repos/${REPO}/stargazers?per_page=100`, {
        method: 'HEAD',
        headers: starHeaders
      });
      const linkHeader = headRes.headers.get('Link') || '';
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      const lastPage = lastMatch ? parseInt(lastMatch[1]) : 1;

      // Fetch last few pages to find stars from this week
      let recentStars = [];
      for (let page = lastPage; page >= Math.max(1, lastPage - 2); page--) {
        const pageRes = await fetchJSON(
          `${GITHUB_API}/repos/${REPO}/stargazers?per_page=100&page=${page}`,
          { headers: starHeaders }
        );
        recentStars = recentStars.concat(pageRes);
      }
      starsWeek = recentStars.filter(s => new Date(s.starred_at) >= since).length;
    } catch { /* stargazers with timestamps may not always work */ }

    // Estimate new forks this week
    let forksWeek = null;
    try {
      const forkRes = await fetchJSON(
        `${GITHUB_API}/repos/${REPO}/forks?sort=newest&per_page=100`,
        { headers }
      );
      forksWeek = forkRes.filter(f => new Date(f.created_at) >= since).length;
    } catch { /* ignore */ }

    return {
      stars: repo.stargazers_count,
      starsWeek,
      forks: repo.forks_count,
      forksWeek,
      openIssues: repo.open_issues_count - weekPRs.filter(pr => pr.state === 'open').length,
      issuesOpenedWeek: weekIssues.length,
      issuesClosedWeek: closedThisWeek.length,
      prsOpenedWeek: weekPRs.length,
      prsMergedWeek: mergedPRs.length
    };
  } catch (error) {
    console.error('GitHub source error:', error.message);
    return { error: error.message };
  }
}

// ─── Source: Supabase Downloads (PostgREST) ──────────────────────────────────

async function collectDownloads(env) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' };
    }

    const baseUrl = `${env.SUPABASE_URL}/rest/v1`;
    const headers = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact'
    };

    const since = weekAgo();
    const sinceISO = since.toISOString();

    // Total downloads all-time (HEAD request with count)
    const totalRes = await fetch(`${baseUrl}/component_downloads?select=*`, {
      method: 'HEAD',
      headers
    });
    const totalAllTime = parseInt(totalRes.headers.get('content-range')?.split('/')[1]) || 0;

    // Downloads this week (HEAD request with count + filter)
    const weekRes = await fetch(
      `${baseUrl}/component_downloads?select=*&download_timestamp=gte.${sinceISO}`,
      { method: 'HEAD', headers }
    );
    const totalWeek = parseInt(weekRes.headers.get('content-range')?.split('/')[1]) || 0;

    // Get weekly downloads with component info for top components + type breakdown
    const weekDownloads = await fetchJSON(
      `${baseUrl}/component_downloads?select=component_name,component_type&download_timestamp=gte.${sinceISO}&limit=10000`,
      { headers: { ...headers, Prefer: '' } }
    );

    let topComponents = [];
    let byType = {};
    if (weekDownloads && weekDownloads.length > 0) {
      const componentCounts = {};
      const typeCounts = {};

      for (const row of weekDownloads) {
        componentCounts[row.component_name] = (componentCounts[row.component_name] || 0) + 1;
        const t = row.component_type || 'unknown';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }

      topComponents = Object.entries(componentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      const total = weekDownloads.length || 1;
      for (const [type, count] of Object.entries(typeCounts)) {
        byType[type] = (count / total) * 100;
      }
    }

    // Top 5 countries this week
    let topCountries = [];
    const countryData = await fetchJSON(
      `${baseUrl}/component_downloads?select=country&download_timestamp=gte.${sinceISO}&country=not.is.null&limit=10000`,
      { headers: { ...headers, Prefer: '' } }
    );

    if (countryData && countryData.length > 0) {
      const countryCounts = {};
      for (const row of countryData) {
        countryCounts[row.country] = (countryCounts[row.country] || 0) + 1;
      }
      const total = countryData.length || 1;
      topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([country, count]) => ({ country, pct: (count / total) * 100 }));
    }

    return { totalAllTime, totalWeek, topComponents, byType, topCountries };
  } catch (error) {
    console.error('Supabase downloads source error:', error.message);
    return { error: error.message };
  }
}

// ─── Source: Returning installers (Supabase RPC) ─────────────────────────────

// The north star of the traction plan: installers active in an ISO week (UTC)
// who had installed in any of the 8 previous weeks. Postgres computes it in
// public.weekly_returning_installers() (database/migrations/005_...sql), one
// row per week, oldest first, with new installers, the agent/person/script
// split (CLI >= 1.32) and how many of each week's new installers came back.
const RETURNING_WEEKS = 10;

async function collectReturning(env) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' };
    }

    const rows = await fetchJSON(`${env.SUPABASE_URL}/rest/v1/rpc/weekly_returning_installers`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_weeks: RETURNING_WEEKS })
    });

    return summarizeReturning(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Returning installers source error:', error.message);
    return { error: error.message };
  }
}

// The cron runs on Sunday, before the current week ends, so the headline is the
// last complete week and the current one is shown apart as "so far".
function summarizeReturning(rows) {
  const complete = rows.filter((r) => r.week_complete);
  if (complete.length === 0) {
    return { error: 'weekly_returning_installers returned no complete week' };
  }

  const num = (v) => (v == null ? null : Number(v));
  const sum = (list, key) => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);
  const latestWith = (key) => [...complete].reverse().find((r) => r[key] != null) || null;

  const last = complete[complete.length - 1];
  const prev = complete.length > 1 ? complete[complete.length - 2] : null;
  const last4 = complete.slice(-4);
  const w1 = latestWith('new_back_w1_pct');
  const w4 = latestWith('new_back_w4_pct');
  const current = rows.find((r) => !r.week_complete) || null;

  return {
    week: last.week_start,
    active: num(last.active_installers),
    returning: num(last.returning_installers),
    returningPct: num(last.returning_pct),
    returningDelta: prev ? num(last.returning_installers) - num(prev.returning_installers) : null,
    newInstallers: num(last.new_installers),
    avgWeeks: last4.length,
    avgReturning: sum(last4, 'returning_installers') / last4.length,
    avgPct: (100 * sum(last4, 'returning_installers')) / Math.max(sum(last4, 'active_installers'), 1),
    classes: ['agent', 'person', 'script', 'unknown'].map((cls) => ({
      cls,
      active: num(last[`${cls}_active`]) || 0,
      returning: num(last[`${cls}_returning`]) || 0
    })),
    newBackW1: w1 ? { week: w1.week_start, pct: num(w1.new_back_w1_pct) } : null,
    newBackW4: w4 ? { week: w4.week_start, pct: num(w4.new_back_w4_pct) } : null,
    current: current
      ? {
          week: current.week_start,
          active: num(current.active_installers),
          returning: num(current.returning_installers),
          returningPct: num(current.returning_pct)
        }
      : null
  };
}

// ─── Source: npm Downloads ───────────────────────────────────────────────────

async function collectNpm(env) {
  try {
    const headers = { 'User-Agent': 'Pulse-Weekly-Report/1.0' };

    // Weekly downloads (last 7 days)
    const weekData = await fetchJSON(
      `${NPM_API}/downloads/point/last-week/${NPM_PACKAGE}`,
      { headers }
    );

    // Monthly downloads (last 30 days) for context
    const monthData = await fetchJSON(
      `${NPM_API}/downloads/point/last-month/${NPM_PACKAGE}`,
      { headers }
    );

    // Daily breakdown for the last week (to show trend)
    const end = new Date();
    const start = weekAgo();
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const rangeData = await fetchJSON(
      `${NPM_API}/downloads/range/${startStr}:${endStr}/${NPM_PACKAGE}`,
      { headers }
    );

    // Find peak day
    let peakDay = null;
    let peakDownloads = 0;
    if (rangeData.downloads) {
      for (const day of rangeData.downloads) {
        if (day.downloads > peakDownloads) {
          peakDownloads = day.downloads;
          peakDay = day.day;
        }
      }
    }

    // Calculate daily average
    const dailyAvg = weekData.downloads > 0
      ? Math.round(weekData.downloads / 7)
      : 0;

    return {
      weeklyDownloads: weekData.downloads || 0,
      monthlyDownloads: monthData.downloads || 0,
      dailyAvg,
      peakDay,
      peakDownloads
    };
  } catch (error) {
    console.error('npm source error:', error.message);
    return { error: error.message };
  }
}

// ─── Source: Google Analytics (GA4) ──────────────────────────────────────────

async function collectAnalytics(env) {
  try {
    if (!env.GA_PROPERTY_ID || !env.GA_SERVICE_ACCOUNT_JSON) {
      return { error: 'GA_PROPERTY_ID or GA_SERVICE_ACCOUNT_JSON not configured' };
    }

    const accessToken = await getGAAccessToken(env);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    const since = weekAgo();
    const startDate = since.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    const propertyId = env.GA_PROPERTY_ID;

    const [summaryRes, pagesRes, referrersRes] = await Promise.all([
      fetchJSON(`${GA4_API}/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }]
        })
      }),
      fetchJSON(`${GA4_API}/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10
        })
      }),
      fetchJSON(`${GA4_API}/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionSource' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10
        })
      })
    ]);

    const summaryRow = summaryRes.rows?.[0];
    const visitors = summaryRow ? parseInt(summaryRow.metricValues[0].value) : 0;
    const pageviews = summaryRow ? parseInt(summaryRow.metricValues[1].value) : 0;

    const topPages = (pagesRes.rows || []).map(row => ({
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value)
    }));

    const referrerRows = referrersRes.rows || [];
    const totalSessions = referrerRows.reduce((sum, r) => sum + parseInt(r.metricValues[0].value), 0) || 1;
    const topReferrers = referrerRows.map(row => ({
      source: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value),
      pct: (parseInt(row.metricValues[0].value) / totalSessions) * 100
    }));

    return { visitors, pageviews, topPages, topReferrers };
  } catch (error) {
    console.error('Google Analytics source error:', error.message);
    return { error: error.message };
  }
}

// GA4 JWT auth — build and sign JWT for service account
async function getGAAccessToken(env) {
  const saJson = atob(env.GA_SERVICE_ACCOUNT_JSON);
  const sa = JSON.parse(saJson);

  const now = Math.floor(Date.now() / 1000);

  const headerB64 = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payloadB64 = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const signingInput = `${headerB64}.${payloadB64}`;

  // Import RSA private key and sign
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const keyData = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const signatureB64 = base64url(signatureBuffer);

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetchJSON('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  return tokenRes.access_token;
}

// ─── Report Formatter ────────────────────────────────────────────────────────

function formatReport(results) {
  const sections = [];

  sections.push(`📊 Claude Code Templates - Weekly Report\n📅 ${getWeekRange()}`);

  // Downloads
  if (results.downloads?.error) {
    sections.push(`DOWNLOADS\n└ Unavailable: ${results.downloads.error}`);
  } else if (results.downloads) {
    const dl = results.downloads;
    const lines = [
      `DOWNLOADS (aitmpl.com)`,
      `├ Total: ${fmt(dl.totalAllTime)}${fmtDelta(dl.totalWeek)}`
    ];
    if (dl.topComponents?.length > 0) {
      lines.push(`├ Top: ${dl.topComponents[0].name} (${fmt(dl.topComponents[0].count)})`);
    }
    if (dl.byType && Object.keys(dl.byType).length > 0) {
      const types = Object.entries(dl.byType).sort((a, b) => b[1] - a[1]).filter(([, pct]) => pct >= 1);
      for (let i = 0; i < types.length; i++) {
        const prefix = (i === types.length - 1 && dl.topComponents?.length === 0) ? '└' : '├';
        lines.push(`${prefix} ${types[i][0]}: ${fmtPct(types[i][1])}`);
      }
    }
    // fix last item to └
    if (lines.length > 1) {
      lines[lines.length - 1] = lines[lines.length - 1].replace('├', '└');
    }
    sections.push(lines.join('\n'));
  }

  // Returning installers (north star) and new installers
  if (results.returning?.error) {
    sections.push(`RETURNING INSTALLERS\n└ Unavailable: ${results.returning.error}`);
  } else if (results.returning) {
    const r = results.returning;
    const lines = [
      `RETURNING INSTALLERS (week of ${fmtWeek(r.week)})`,
      `├ Returning: ${fmt(r.returning)} of ${fmt(r.active)} active (${fmtPct1(r.returningPct)})${fmtDelta(r.returningDelta)}`,
      `├ ${r.avgWeeks}-week avg: ${fmt(Math.round(r.avgReturning))} (${fmtPct1(r.avgPct)})`,
      `├ New installers: ${fmt(r.newInstallers)}`
    ];
    // The split exists only for rows sent by CLI >= 1.32 (since 2026-11-03).
    if (r.classes.some((c) => c.cls !== 'unknown' && c.active > 0)) {
      const split = r.classes
        .filter((c) => c.active > 0)
        .map((c) => `${c.cls} ${fmt(c.returning)} of ${fmt(c.active)}`)
        .join(', ');
      lines.push(`├ Returning by class: ${split}`);
    }
    const back = [];
    if (r.newBackW1) back.push(`next week ${fmtPct1(r.newBackW1.pct)} (week of ${fmtWeek(r.newBackW1.week)})`);
    if (r.newBackW4) back.push(`within 4 weeks ${fmtPct1(r.newBackW4.pct)} (week of ${fmtWeek(r.newBackW4.week)})`);
    if (back.length > 0) {
      lines.push(`├ New installers back: ${back.join(', ')}`);
    }
    if (r.current) {
      lines.push(`├ This week so far: ${fmt(r.current.returning)} of ${fmt(r.current.active)} (${fmtPct1(r.current.returningPct)})`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace('├', '└');
    sections.push(lines.join('\n'));
  }

  // npm
  if (results.npm?.error) {
    sections.push(`NPM (npmjs.com)\n└ ⚠️ Unavailable: ${results.npm.error}`);
  } else if (results.npm) {
    const n = results.npm;
    const lines = [
      `NPM (npmjs.com)`,
      `├ Weekly: ${fmt(n.weeklyDownloads)}`,
      `├ Monthly: ${fmt(n.monthlyDownloads)}`,
      `├ Daily avg: ${fmt(n.dailyAvg)}`
    ];
    if (n.peakDay) {
      const peakDate = new Date(n.peakDay);
      const dayName = peakDate.toLocaleDateString('en-US', { weekday: 'short' });
      lines.push(`└ Peak: ${dayName} (${fmt(n.peakDownloads)})`);
    } else {
      lines[lines.length - 1] = lines[lines.length - 1].replace('├', '└');
    }
    sections.push(lines.join('\n'));
  }

  // GitHub
  if (results.github?.error) {
    sections.push(`GITHUB\n└ Unavailable: ${results.github.error}`);
  } else if (results.github) {
    const g = results.github;
    sections.push([
      `GITHUB`,
      `├ Stars: ${fmt(g.stars)}${fmtDelta(g.starsWeek)}`,
      `├ Forks: ${fmt(g.forks)}${fmtDelta(g.forksWeek)}`,
      `├ Issues: ${fmt(g.openIssues)} open (${fmt(g.issuesOpenedWeek)} new, ${fmt(g.issuesClosedWeek)} closed)`,
      `└ PRs: ${fmt(g.prsOpenedWeek)} opened, ${fmt(g.prsMergedWeek)} merged`
    ].join('\n'));
  }

  return sections.join('\n\n');
}

// ─── Telegram Sender ─────────────────────────────────────────────────────────

async function sendToTelegram(env, text) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  }

  const messages = splitMessage(text);
  let sent = 0;

  for (const msg of messages) {
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', JSON.stringify(result));
      return { success: false, error: result.description };
    }
    sent++;
  }

  console.log(`✅ Telegram: sent ${sent} message(s)`);
  return { success: true, messagesSent: sent };
}

function splitMessage(text) {
  if (text.length <= MAX_MESSAGE_LENGTH) return [text];

  const messages = [];
  const sections = text.split('\n\n');
  let current = '';

  for (const section of sections) {
    if ((current + '\n\n' + section).length > MAX_MESSAGE_LENGTH) {
      if (current) messages.push(current.trim());
      current = section;
    } else {
      current = current ? current + '\n\n' + section : section;
    }
  }
  if (current) messages.push(current.trim());
  return messages;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJSON(url, opts = {}) {
  const response = await fetch(url, opts);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.substring(0, 200)}`);
  }
  return response.json();
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

function getWeekRange() {
  const end = new Date();
  const start = weekAgo();
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

function fmtDelta(n) {
  if (n == null) return '';
  const sign = n >= 0 ? '+' : '';
  return ` (${sign}${fmt(n)})`;
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

function fmtPct1(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Number(n).toFixed(1)}%`;
}

// 'YYYY-MM-DD' (a Monday, UTC) -> 'Oct 26'
function fmtWeek(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function base64url(input) {
  let str;
  if (input instanceof ArrayBuffer) {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  } else {
    str = btoa(input);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
