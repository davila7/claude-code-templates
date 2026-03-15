import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../lib/api/neon';
import { authenticateAndGetEmail } from '../../../lib/api/auth';

export const prerender = false;

const ALLOWED_EMAIL = 'dan.avila7@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

// GET /api/live-task/control
export const GET: APIRoute = async () => {
  try {
    const sql = getNeonClient();
    const result = await sql`SELECT * FROM cycle_control WHERE id = 1`;

    if (result.length === 0) {
      return new Response(JSON.stringify({ control: { id: 1, is_paused: false, paused_by: null, reason: null } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ control: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch control status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST /api/live-task/control - Update pause state (restricted to ALLOWED_EMAIL)
export const POST: APIRoute = async ({ request }) => {
  try {
    // Authenticate and verify email
    const auth = await authenticateAndGetEmail(request);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (auth.email !== ALLOWED_EMAIL) {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const sql = getNeonClient();
    const body = await request.json();
    const { is_paused, reason } = body;

    if (typeof is_paused !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Missing required field: is_paused (boolean)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const result = await sql`
      UPDATE cycle_control SET
        is_paused = ${is_paused},
        paused_by = ${auth.email},
        reason = ${reason || (is_paused ? 'Paused by admin' : 'Resumed by admin')},
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `;

    return new Response(JSON.stringify({ control: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update control' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
