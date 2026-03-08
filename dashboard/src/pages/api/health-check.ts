import type { APIRoute } from 'astro';
import { getNeonClient } from '../../lib/api/neon';
import { corsResponse, jsonResponse } from '../../lib/api/cors';

const ENDPOINTS_TO_CHECK = [
  { url: 'https://www.aitmpl.com/api/track-download-supabase', method: 'OPTIONS' },
  { url: 'https://www.aitmpl.com/api/track-command-usage', method: 'OPTIONS' },
  { url: 'https://www.aitmpl.com/api/track-website-events', method: 'OPTIONS' },
];

const TIMEOUT_MS = 10000;

interface EndpointResult {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  errorMessage: string | null;
}

async function checkEndpoint(endpoint: { url: string; method: string }): Promise<EndpointResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;

    return {
      endpoint: endpoint.url,
      method: endpoint.method,
      statusCode: response.status,
      responseTimeMs,
      errorMessage: null,
    };
  } catch (error: unknown) {
    const responseTimeMs = Date.now() - startTime;
    const err = error as Error;
    return {
      endpoint: endpoint.url,
      method: endpoint.method,
      statusCode: 0,
      responseTimeMs,
      errorMessage: err.name === 'AbortError' ? 'Timeout' : err.message,
    };
  }
}

async function sendDiscordAlert(failures: EndpointResult[]) {
  const webhookUrl = import.meta.env.DISCORD_WEBHOOK_URL_CHANGELOG;
  if (!webhookUrl || failures.length === 0) return;

  const failureList = failures
    .map((f) => `- \`${f.endpoint}\`: ${f.errorMessage || `HTTP ${f.statusCode}`} (${f.responseTimeMs}ms)`)
    .join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: 'API Health Alert',
            description: `The following endpoints are experiencing issues:\n${failureList}`,
            color: 0xff4444,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to send Discord alert:', err.message);
  }
}

export const OPTIONS: APIRoute = async () => {
  return corsResponse();
};

export const GET: APIRoute = async () => {
  try {
    const results = await Promise.all(ENDPOINTS_TO_CHECK.map(checkEndpoint));

    const sql = getNeonClient();

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

    const failures = results.filter(
      (r) => r.statusCode === 0 || r.statusCode >= 500 || r.responseTimeMs >= TIMEOUT_MS,
    );

    if (failures.length > 0) {
      await sendDiscordAlert(failures);
    }

    const allHealthy = failures.length === 0;

    return jsonResponse({
      success: true,
      healthy: allHealthy,
      results: results.map((r) => ({
        endpoint: r.endpoint,
        status: r.statusCode,
        responseTime: r.responseTimeMs,
        error: r.errorMessage,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Health check error:', err);
    return jsonResponse(
      {
        error: 'Internal server error',
        message: 'Health check failed',
      },
      500,
    );
  }
};
