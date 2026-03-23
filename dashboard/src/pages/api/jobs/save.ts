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
    const { userId, jobId, notes, status } = await request.json();

    if (!userId || !jobId) {
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
      INSERT INTO saved_jobs (user_id, job_id, notes, status)
      VALUES (${userId}, ${jobId}, ${notes || null}, ${status || 'saved'})
      ON CONFLICT (user_id, job_id) 
      DO UPDATE SET notes = ${notes || null}, status = ${status || 'saved'}
      RETURNING *
    `;

    return new Response(JSON.stringify({ success: true, data: result[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving job:', error);
    return new Response(JSON.stringify({ error: 'Failed to save job' }), {
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
    const { userId, jobId } = await request.json();

    if (!userId || !jobId) {
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
      DELETE FROM saved_jobs 
      WHERE user_id = ${userId} AND job_id = ${jobId}
    `;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting saved job:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete saved job' }), {
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
      SELECT * FROM saved_jobs 
      WHERE user_id = ${userId}
      ORDER BY saved_at DESC
    `;

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch saved jobs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
