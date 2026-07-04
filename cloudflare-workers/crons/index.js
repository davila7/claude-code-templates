/**
 * aitmpl-crons — Cloudflare Worker
 *
 * Replaces Vercel cron jobs by calling the dashboard API endpoints
 * on a schedule. Cron: every 30 minutes (claude-code-check) and hourly (health-check).
 *
 * Secrets (wrangler secret put):
 *   DASHBOARD_URL    — e.g. https://www.aitmpl.com
 *   TRIGGER_SECRET   — shared secret sent as Authorization header
 *   SENTRY_DSN       — DSN from the "aitmpl-workers" Sentry project (error tracking)
 */

import { reportError, checkIn } from './sentry.js';

const MONITORS = {
  '*/30 * * * *': 'claude-code-check',
  '0 * * * *': 'health-check',
};

export default {
  async scheduled(event, env, ctx) {
    const base = env.DASHBOARD_URL || 'https://www.aitmpl.com';
    const headers = {
      'Authorization': `Bearer ${env.TRIGGER_SECRET || ''}`,
      'User-Agent': 'aitmpl-crons/1.0',
    };

    const cron = event.cron;
    const endpoint = cron === '*/30 * * * *' ? '/api/claude-code-check'
      : cron === '0 * * * *' ? '/api/health-check'
      : null;

    if (!endpoint) {
      console.log(`Unknown cron schedule: ${cron}`);
      return;
    }

    const monitorSlug = MONITORS[cron];
    const checkInId = await checkIn(env, monitorSlug, 'in_progress');

    try {
      const res = await fetch(`${base}${endpoint}`, { headers });
      console.log(`${endpoint}: ${res.status}`);

      if (!res.ok) {
        await reportError(env, `${endpoint} returned ${res.status}`, {
          worker: 'aitmpl-crons',
          cron,
          endpoint,
          status: res.status,
        });
        await checkIn(env, monitorSlug, 'error', checkInId);
      } else {
        await checkIn(env, monitorSlug, 'ok', checkInId);
      }
    } catch (error) {
      console.error(`${endpoint} failed:`, error.message);
      await reportError(env, error, { worker: 'aitmpl-crons', cron, endpoint });
      await checkIn(env, monitorSlug, 'error', checkInId);
    }
  },

  // Manual trigger for testing: GET /trigger?cron=*/30+*+*+*+*
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== '/trigger') {
      return new Response('aitmpl-crons worker', { status: 200 });
    }

    const auth = request.headers.get('Authorization');
    if (!env.TRIGGER_SECRET || auth !== `Bearer ${env.TRIGGER_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const cron = url.searchParams.get('cron') || '*/30 * * * *';
    await this.scheduled({ cron }, env, {});
    return new Response(`Triggered: ${cron}`, { status: 200 });
  },
};
