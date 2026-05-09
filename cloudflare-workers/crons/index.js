/**
 * aitmpl-crons — Cloudflare Worker
 *
 * Replaces Vercel cron jobs by calling the dashboard API endpoints
 * on a schedule. Cron: */30 * * * * (claude-code-check) and 0 * * * * (health-check).
 *
 * Secrets (wrangler secret put):
 *   DASHBOARD_URL    — e.g. https://www.aitmpl.com
 *   TRIGGER_SECRET   — shared secret sent as Authorization header
 */

export default {
  async scheduled(event, env, ctx) {
    const base = env.DASHBOARD_URL || 'https://www.aitmpl.com';
    const headers = {
      'Authorization': `Bearer ${env.TRIGGER_SECRET || ''}`,
      'User-Agent': 'aitmpl-crons/1.0',
    };

    const cron = event.cron;

    if (cron === '*/30 * * * *') {
      // Every 30 minutes: check for new Claude Code releases
      const res = await fetch(`${base}/api/claude-code-check`, { headers });
      console.log(`claude-code-check: ${res.status}`);
    } else if (cron === '0 * * * *') {
      // Every hour: health check (was every 15 min on Vercel)
      const res = await fetch(`${base}/api/health-check`, { headers });
      console.log(`health-check: ${res.status}`);
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
