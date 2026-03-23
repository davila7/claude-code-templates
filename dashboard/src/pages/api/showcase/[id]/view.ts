import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../../lib/api/neon';

export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = params;
    const viewerId = locals.auth?.userId || 'anonymous';

    if (!id) {
      return new Response(JSON.stringify({ error: 'Showcase ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert view record
    await sql`
      INSERT INTO showcase_views (showcase_id, viewer_id)
      VALUES (${id}, ${viewerId})
    `;

    // Get updated view count
    const result = await sql`
      SELECT view_count FROM showcase_submissions WHERE id = ${id}
    `;

    return new Response(
      JSON.stringify({
        success: true,
        viewCount: result[0]?.view_count || 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in view API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
