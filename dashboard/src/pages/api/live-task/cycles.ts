import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../lib/api/neon';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

// GET /api/live-task/cycles?status=active&limit=20
export const GET: APIRoute = async ({ url }) => {
  try {
    const sql = getNeonClient();
    const status = url.searchParams.get('status');
    const parsedLimit = parseInt(url.searchParams.get('limit') || '20', 10);
    const limit = Math.min(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 100);

    let cycles;
    if (status) {
      cycles = await sql`
        SELECT * FROM review_cycles
        WHERE status = ${status}
        ORDER BY started_at DESC
        LIMIT ${limit}
      `;
    } else {
      cycles = await sql`
        SELECT * FROM review_cycles
        ORDER BY started_at DESC
        LIMIT ${limit}
      `;
    }

    return new Response(JSON.stringify({ cycles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch cycles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST /api/live-task/cycles - Create a new cycle
export const POST: APIRoute = async ({ request }) => {
  try {
    const sql = getNeonClient();
    const body = await request.json();
    const { session_id, component_path, component_type } = body;

    if (!session_id || !component_path || !component_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields: session_id, component_path, component_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if cycle is paused
    const control = await sql`SELECT is_paused FROM cycle_control WHERE id = 1`;
    if (control.length > 0 && control[0].is_paused) {
      return new Response(JSON.stringify({ error: 'Review cycle is paused' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const result = await sql`
      INSERT INTO review_cycles (session_id, component_path, component_type)
      VALUES (${session_id}, ${component_path}, ${component_type})
      RETURNING *
    `;

    return new Response(JSON.stringify({ cycle: result[0] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to create cycle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// PATCH /api/live-task/cycles - Update a cycle
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const sql = getNeonClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const allowedFields = ['status', 'phase', 'pr_url', 'pr_number', 'branch_name', 'linear_issue_id', 'improvements_summary', 'error_message'];
    const setters: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setters.push(field);
        values.push(updates[field]);
      }
    }

    if (setters.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Set completed_at if status is terminal
    const isTerminal = ['completed', 'failed', 'merged'].includes(updates.status);

    // Build dynamic update — Neon tagged templates don't support dynamic columns,
    // so we update all fields, using COALESCE to keep existing values
    const result = await sql`
      UPDATE review_cycles SET
        status = COALESCE(${updates.status ?? null}, status),
        phase = COALESCE(${updates.phase ?? null}, phase),
        pr_url = COALESCE(${updates.pr_url ?? null}, pr_url),
        pr_number = COALESCE(${updates.pr_number ?? null}, pr_number),
        branch_name = COALESCE(${updates.branch_name ?? null}, branch_name),
        linear_issue_id = COALESCE(${updates.linear_issue_id ?? null}, linear_issue_id),
        improvements_summary = COALESCE(${updates.improvements_summary ?? null}, improvements_summary),
        error_message = COALESCE(${updates.error_message ?? null}, error_message),
        updated_at = NOW(),
        completed_at = CASE WHEN ${isTerminal} THEN NOW() ELSE completed_at END
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ error: 'Cycle not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ cycle: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to update cycle' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
