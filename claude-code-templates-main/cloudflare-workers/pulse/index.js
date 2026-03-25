/**
 * Cloudflare Worker: Pulse — Weekly KPI Report
 *
 * Collects metrics from GitHub, Discord, Supabase, npm, Vercel, and Google Analytics,
 * then sends a consolidated report via Telegram every Sunday at 14:00 UTC.
 *
 * All source collectors are in this single file (no npm dependencies).
 */

const REPO = 'davila7/claude-code-templates';
const NPM_PACKAGE = 'claude-code-templates';
const GITHUB_API = 'https://api.github.com';
const DISCORD_API = 'https://discord.com/api/v10';
const VERCEL_API = 'https://api.vercel.com';
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
        sources: ['github', 'discord', 'downloads', 'npm', 'vercel', 'analytics']
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

  let results = {};

  if (onlySource) {
    const collectors = {
      github: collectGitHub,
      discord: collectDiscord,
      downloads: collectDownloads,
      npm: collectNpm,
      vercel: collectVercel,
      analytics: collectAnalytics
    };
    const collector = collectors[onlySource];
    if (!collector) {
      return { error: `Unknown source: ${onlySource}`, available: Object.keys(collectors) };
    }
    results[onlySource] = await collector(env);
  } else {
    const [github, discord, downloads, npm, vercel] = await Promise.all([
      collectGitHub(env),
      collectDiscord(env),
      collectDownloads(env),
      collectNpm(env),
      collectVercel(env)
    ]);
    results = { github, discord, downloads, npm, vercel };
  }

  const reportText = formatReport(results);

  let telegramResult = null;
  if (sendTelegram) {
    telegramResult = await sendToTelegram(env, reportText);
  }

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

// ─── Source: Discord ─────────────────────────────────────────────────────────

async function collectDiscord(env) {
  try {
    if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) {
      return { error: 'DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not configured' };
    }

    const headers = {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    };
    const guildId = env.DISCORD_GUILD_ID;

    // Fetch guild info with approximate counts
    const guild = await fetchJSON(
      `${DISCORD_API}/guilds/${guildId}?with_counts=true`,
      { headers }
    );

    const totalMembers = guild.approximate_member_count || 0;
    const activeMembers = guild.approximate_presence_count || 0;

    // Estimate new members this week from audit log
    let newMembersWeek = null;
    try {
      const since = weekAgo();
      const auditRes = await fetchJSON(
        `${DISCORD_API}/guilds/${guildId}/audit-logs?action_type=1&limit=100`,
        { headers }
      );
      const entries = auditRes.audit_log_entries || [];
      newMembersWeek = entries.filter(e => {
        const timestamp = Number(BigInt(e.id) >> 22n) + 1420070400000;
        return timestamp >= since.getTime();
      }).length;
    } catch { /* Audit log access may not be available */ }

    // Count messages in last 7 days across text channels
    let messagesWeek = null;
    try {
      const channels = await fetchJSON(
        `${DISCORD_API}/guilds/${guildId}/channels`,
        { headers }
      );
      const textChannels = channels.filter(c => c.type === 0);

      const since = weekAgo();
      const sinceSnowflake = String((BigInt(since.getTime()) - 1420070400000n) << 22n);

      let total = 0;
      // Sample up to 10 channels to avoid rate limits
      for (const ch of textChannels.slice(0, 10)) {
        try {
          const msgs = await fetchJSON(
            `${DISCORD_API}/channels/${ch.id}/messages?after=${sinceSnowflake}&limit=100`,
            { headers }
          );
          total += msgs.length;
        } catch { /* Channel may not be accessible */ }
      }
      messagesWeek = total;
    } catch { /* ignore */ }

    return { totalMembers, activeMembers, newMembersWeek, messagesWeek };
  } catch (error) {
    console.error('Discord source error:', error.message);
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

// ─── Source: Vercel ──────────────────────────────────────────────────────────

async function collectVercel(env) {
  try {
    if (!env.VERCEL_TOKEN || !env.VERCEL_PROJECT_ID) {
      return { error: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not configured' };
    }

    const headers = { Authorization: `Bearer ${env.VERCEL_TOKEN}` };
    const since = weekAgo();

    const data = await fetchJSON(
      `${VERCEL_API}/v6/deployments?projectId=${env.VERCEL_PROJECT_ID}&since=${since.getTime()}&limit=100`,
      { headers }
    );

    const deployments = data.deployments || [];
    const successCount = deployments.filter(d => d.state === 'READY').length;
    const errorCount = deployments.filter(d => d.state === 'ERROR').length;

    let latestStatus = null;
    let latestAge = null;
    if (deployments.length > 0) {
      const latest = deployments[0];
      latestStatus = latest.state;

      const age = Date.now() - latest.created;
      const hours = Math.floor(age / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      if (days > 0) {
        latestAge = `${days}d ago`;
      } else if (hours > 0) {
        latestAge = `${hours}h ago`;
      } else {
        latestAge = `${Math.floor(age / (1000 * 60))}m ago`;
      }
    }

    // Average build time
    let avgBuildTime = null;
    const buildTimes = deployments
      .filter(d => d.ready && d.buildingAt)
      .map(d => (d.ready - d.buildingAt) / 1000);
    if (buildTimes.length > 0) {
      avgBuildTime = Math.round(buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length);
    }

    // Last commit message
    let lastCommit = null;
    if (deployments.length > 0 && deployments[0].meta?.githubCommitMessage) {
      lastCommit = deployments[0].meta.githubCommitMessage;
      if (lastCommit.length > 60) lastCommit = lastCommit.substring(0, 57) + '...';
    }

    return { totalWeek: deployments.length, successCount, errorCount, latestStatus, latestAge, avgBuildTime, lastCommit };
  } catch (error) {
    console.error('Vercel source error:', error.message);
    return { error: error.message };
  }
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

  // Discord
  if (results.discord?.error) {
    sections.push(`DISCORD\n└ Unavailable: ${results.discord.error}`);
  } else if (results.discord) {
    const d = results.discord;
    sections.push([
      `DISCORD`,
      `├ Members: ${fmt(d.totalMembers)}${fmtDelta(d.newMembersWeek)}`,
      `├ Active: ~${fmt(d.activeMembers)}`,
      `└ Messages: ${fmt(d.messagesWeek)}`
    ].join('\n'));
  }

  // Vercel
  if (results.vercel?.error) {
    sections.push(`VERCEL\n└ Unavailable: ${results.vercel.error}`);
  } else if (results.vercel) {
    const v = results.vercel;
    const status = v.latestStatus === 'READY' ? 'OK' : 'ERROR';
    const lines = [
      `VERCEL`,
      `├ Deploys: ${fmt(v.totalWeek)} (${fmt(v.successCount)} ok, ${fmt(v.errorCount)} failed)`,
      `├ Latest: ${v.latestAge} [${status}]`
    ];
    if (v.avgBuildTime != null) {
      lines.push(`└ Avg build: ${v.avgBuildTime}s`);
    } else {
      lines[lines.length - 1] = lines[lines.length - 1].replace('├', '└');
    }
    sections.push(lines.join('\n'));
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

function base64url(input) {
  let str;
  if (input instanceof ArrayBuffer) {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  } else {
    str = btoa(input);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
