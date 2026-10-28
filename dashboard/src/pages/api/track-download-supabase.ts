import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { corsResponse, jsonResponse } from '../../lib/api/cors';
import { captureApiError } from '../../lib/api/error-tracking';
import { getCountry } from '../../lib/api/geo';

function getSupabaseClient() {
  const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

function validateComponentData(data: { type?: string; name?: string; path?: string; category?: string }) {
  const { type, name } = data;

  if (!type || !name) {
    return { valid: false, error: 'Component type and name are required' };
  }

  const validTypes = ['agent', 'command', 'setting', 'hook', 'mcp', 'skill', 'loop', 'mod', 'template'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Invalid component type' };
  }

  if (name.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }

  return { valid: true, error: null };
}

// Agent names the CLI reports (cli-tool/src/agent-detection.js). Anything else is stored as 'other'.
const KNOWN_AGENTS = new Set([
  'claude', 'cowork', 'cursor', 'cursor-cli', 'codex', 'gemini', 'github-copilot',
  'opencode', 'augment-cli', 'antigravity', 'devin', 'replit', 'v0', 'other',
]);

// Who ran the CLI, self-reported. Older CLI versions send none of these, so all three stay null.
function clientSignals(body: { agent?: unknown; entrypoint?: unknown; isTty?: unknown }) {
  const agent = typeof body.agent === 'string' ? (KNOWN_AGENTS.has(body.agent) ? body.agent : 'other') : null;
  const entrypoint =
    typeof body.entrypoint === 'string' && /^[a-z0-9_-]{1,32}$/.test(body.entrypoint) ? body.entrypoint : null;
  const isTty = typeof body.isTty === 'boolean' ? body.isTty : null;
  return { client_agent: agent, client_entrypoint: entrypoint, client_is_tty: isTty };
}

// PostgREST / Postgres codes for a column that does not exist yet (migration 004 not run).
const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, name, path, category, cliVersion } = body;
    const validation = validateComponentData({ type, name, path, category });

    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const country = getCountry(request);
    const userAgent = request.headers.get('user-agent');

    const supabase = getSupabaseClient();

    const row = {
      component_type: type,
      component_name: name,
      component_path: path,
      category: category,
      user_agent: userAgent,
      ip_address: ipAddress,
      country: country,
      cli_version: cliVersion,
      download_timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    let { error: insertError } = await supabase
      .from('component_downloads')
      .insert({ ...row, ...clientSignals(body) });

    // Until database/migrations/004 runs, keep counting downloads without the new columns.
    if (insertError && MISSING_COLUMN_CODES.has(insertError.code)) {
      ({ error: insertError } = await supabase.from('component_downloads').insert(row));
    }

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    const { error: upsertError } = await supabase
      .from('download_stats')
      .upsert(
        {
          component_type: type,
          component_name: name,
          total_downloads: 1,
          last_download: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'component_type,component_name',
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
    }

    return jsonResponse({
      success: true,
      message: 'Download tracked successfully',
      data: { type, name, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Download tracking error:', error);
    await captureApiError(error, { route: '/api/track-download-supabase' });
    return jsonResponse(
      {
        error: 'Internal server error',
        message: 'Failed to track download',
      },
      500
    );
  }
};

export const OPTIONS: APIRoute = async () => corsResponse();
