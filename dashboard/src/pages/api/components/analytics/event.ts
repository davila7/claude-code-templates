import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      event_type,
      component_path,
      component_name,
      component_type,
      execution_time_ms,
      tokens_used,
      cost,
      error_type,
      error_message,
      user_id_hash,
      session_id,
      metadata,
      improvement_id
    } = body;

    if (!event_type || !component_path) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: event_type, component_path' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert usage event
    const result = await sql`
      INSERT INTO component_usage_events (
        component_path,
        component_name,
        component_type,
        event_type,
        execution_time_ms,
        tokens_used,
        cost,
        error_type,
        error_message,
        user_id_hash,
        session_id,
        metadata
      ) VALUES (
        ${component_path},
        ${component_name || component_path.split('/').pop()?.replace(/\.[^.]+$/, '')},
        ${component_type || 'unknown'},
        ${event_type},
        ${execution_time_ms || null},
        ${tokens_used || null},
        ${cost || null},
        ${error_type || null},
        ${error_message || null},
        ${user_id_hash || null},
        ${session_id || null},
        ${metadata ? JSON.stringify(metadata) : null}
      )
      RETURNING *
    `;

    // If this is related to an improvement, update the improvement record
    if (improvement_id) {
      await sql`
        UPDATE component_improvements
        SET updated_at = NOW()
        WHERE id = ${improvement_id}
      `;
    }

    return new Response(JSON.stringify({ 
      success: true,
      event: result[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error recording analytics event:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to record analytics event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const component_path = url.searchParams.get('component_path');
    const event_type = url.searchParams.get('event_type');
    const start_date = url.searchParams.get('start_date');
    const end_date = url.searchParams.get('end_date');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    let query = sql`
      SELECT * FROM component_usage_events
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const values: any[] = [];

    if (component_path) {
      conditions.push(`component_path = $${values.length + 1}`);
      values.push(component_path);
    }

    if (event_type) {
      conditions.push(`event_type = $${values.length + 1}`);
      values.push(event_type);
    }

    if (start_date) {
      conditions.push(`event_timestamp >= $${values.length + 1}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`event_timestamp <= $${values.length + 1}`);
      values.push(end_date);
    }

    let queryStr = 'SELECT * FROM component_usage_events';
    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }
    queryStr += ` ORDER BY event_timestamp DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const results = await sql(queryStr, values);

    return new Response(JSON.stringify({ 
      success: true,
      events: results,
      count: results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching analytics events:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch analytics events',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
