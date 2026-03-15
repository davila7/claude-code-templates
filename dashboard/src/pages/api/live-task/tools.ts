import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../lib/api/neon';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: corsHeaders });
};

// GET /api/live-task/tools?cycle_id=X&limit=200
export const GET: APIRoute = async ({ url }) => {
  try {
    const sql = getNeonClient();
    const cycleId = url.searchParams.get('cycle_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

    if (!cycleId) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: cycle_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const tools = await sql`
      SELECT * FROM tool_executions
      WHERE cycle_id = ${parseInt(cycleId, 10)}
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    return new Response(JSON.stringify({ tools }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch tool executions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

// POST /api/live-task/tools - Log a tool execution
export const POST: APIRoute = async ({ request }) => {
  try {
    const sql = getNeonClient();
    const body = await request.json();
    const { cycle_id, session_id, tool_name, tool_args_summary, phase, result_status, result_summary } = body;

    if (!cycle_id || !session_id || !tool_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: cycle_id, session_id, tool_name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Truncate server-side
    const truncatedArgs = tool_args_summary ? String(tool_args_summary).slice(0, 500) : null;
    const truncatedResult = result_summary ? String(result_summary).slice(0, 200) : null;

    const result = await sql`
      INSERT INTO tool_executions (cycle_id, session_id, tool_name, tool_args_summary, phase, result_status, result_summary)
      VALUES (${cycle_id}, ${session_id}, ${tool_name}, ${truncatedArgs}, ${phase || null}, ${result_status || 'success'}, ${truncatedResult})
      RETURNING id
    `;

    return new Response(JSON.stringify({ id: result[0].id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to log tool execution' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
