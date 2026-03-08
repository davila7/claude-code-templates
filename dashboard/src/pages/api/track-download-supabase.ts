import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { corsResponse, jsonResponse } from '../../lib/api/cors';

function getSupabaseClient() {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const validTypes = ['agent', 'command', 'setting', 'hook', 'mcp', 'skill', 'template'];
  if (!validTypes.includes(type)) {
    return { valid: false, error: 'Invalid component type' };
  }

  if (name.length > 255) {
    return { valid: false, error: 'Component name too long' };
  }

  return { valid: true, error: null };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { type, name, path, category, cliVersion } = await request.json();
    const validation = validateComponentData({ type, name, path, category });

    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const country = request.headers.get('x-vercel-ip-country') || null;
    const userAgent = request.headers.get('user-agent');

    const supabase = getSupabaseClient();

    const { error: insertError } = await supabase
      .from('component_downloads')
      .insert({
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
      });

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
