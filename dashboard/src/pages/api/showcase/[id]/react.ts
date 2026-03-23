import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../../lib/api/neon';

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { id } = params;
    const userId = locals.auth?.userId;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: 'Showcase ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { reactionType } = body;

    if (!['like', 'bookmark', 'try'].includes(reactionType)) {
      return new Response(JSON.stringify({ error: 'Invalid reaction type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if reaction already exists
    const existing = await sql`
      SELECT id FROM showcase_reactions
      WHERE showcase_id = ${id} AND clerk_user_id = ${userId} AND reaction_type = ${reactionType}
    `;

    let action = 'added';

    if (existing.length > 0) {
      // Remove reaction
      await sql`
        DELETE FROM showcase_reactions
        WHERE showcase_id = ${id} AND clerk_user_id = ${userId} AND reaction_type = ${reactionType}
      `;
      action = 'removed';
    } else {
      // Add reaction
      await sql`
        INSERT INTO showcase_reactions (showcase_id, clerk_user_id, reaction_type)
        VALUES (${id}, ${userId}, ${reactionType})
      `;
    }

    // Get updated counts
    const showcase = await sql`
      SELECT like_count, bookmark_count, try_count
      FROM showcase_submissions
      WHERE id = ${id}
    `;

    return new Response(
      JSON.stringify({
        success: true,
        action,
        counts: {
          likes: showcase[0]?.like_count || 0,
          bookmarks: showcase[0]?.bookmark_count || 0,
          tries: showcase[0]?.try_count || 0,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in react API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
