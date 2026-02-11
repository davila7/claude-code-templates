// API Health Check Endpoint - Neon Database
// Monitors critical API endpoints and logs results
// Called by Vercel Cron every 15 minutes

import { neon } from '@neondatabase/serverless';

function getNeonClient() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEON_DATABASE_URL not configured');
  }
  return neon(connectionString);
}

const ENDPOINTS_TO_CHECK = [
  { url: 'https://www.aitmpl.com/api/track-download-supabase', method: 'OPTIONS' },
  { url: 'https://www.aitmpl.com/api/track-command-usage', method: 'OPTIONS' },
  { url: 'https://www.aitmpl.com/api/track-website-events', method: 'OPTIONS' }
];

const TIMEOUT_MS = 10000;

async function checkEndpoint(endpoint) {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    return {
      endpoint: endpoint.url,
      method: endpoint.method,
      statusCode: response.status,
      responseTimeMs,
      errorMessage: null
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    return {
      endpoint: endpoint.url,
      method: endpoint.method,
      statusCode: 0,
      responseTimeMs,
      errorMessage: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

async function sendDiscordAlert(failures) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL_CHANGELOG;
  if (!webhookUrl || failures.length === 0) return;

  const failureList = failures.map(f =>
    `- \`${f.endpoint}\`: ${f.errorMessage || `HTTP ${f.statusCode}`} (${f.responseTimeMs}ms)`
  ).join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'API Health Alert',
          description: `The following endpoints are experiencing issues:\n${failureList}`,
          color: 0xff4444,
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (error) {
    console.error('Failed to send Discord alert:', error.message);
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['GET'] });
  }

  try {
    // Check all endpoints in parallel
    const results = await Promise.all(ENDPOINTS_TO_CHECK.map(checkEndpoint));

    const sql = getNeonClient();

    // Log each result
    for (const result of results) {
      await sql`
        INSERT INTO api_health_logs (
          endpoint, method, status_code, response_time_ms, error_message
        ) VALUES (
          ${result.endpoint},
          ${result.method},
          ${result.statusCode},
          ${result.responseTimeMs},
          ${result.errorMessage}
        )
      `;
    }

    // Identify failures (status >= 500, status 0 for network errors, or timeout > 10s)
    const failures = results.filter(r =>
      r.statusCode === 0 || r.statusCode >= 500 || r.responseTimeMs >= TIMEOUT_MS
    );

    // Send Discord alert if there are failures
    if (failures.length > 0) {
      await sendDiscordAlert(failures);
    }

    const allHealthy = failures.length === 0;

    res.status(200).json({
      success: true,
      healthy: allHealthy,
      results: results.map(r => ({
        endpoint: r.endpoint,
        status: r.statusCode,
        responseTime: r.responseTimeMs,
        error: r.errorMessage
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
