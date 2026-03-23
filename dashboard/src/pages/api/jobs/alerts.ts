import type { APIRoute } from 'astro';
import { getNeonClient, isDatabaseConfigured } from '../../../lib/api/neon';

export const POST: APIRoute = async ({ request }) => {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { userId, name, filters, frequency } = await request.json();

    if (!userId || !name || !filters) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database connection failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await sql`
      INSERT INTO job_alerts (user_id, name, filters, frequency)
      VALUES (${userId}, ${name}, ${JSON.stringify(filters)}, ${frequency || 'daily'})
      RETURNING *
    `;

    return new Response(JSON.stringify({ success: true, data: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating job alert:', error);
    return new Response(JSON.stringify({ error: 'Failed to create job alert' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database connection failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await sql`
      SELECT * FROM job_alerts 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching job alerts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch job alerts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { userId, alertId } = await request.json();

    if (!userId || !alertId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database connection failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await sql`
      DELETE FROM job_alerts 
      WHERE id = ${alertId} AND user_id = ${userId}
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting job alert:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete job alert' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
