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
    const userName = locals.auth?.user?.firstName || 'Anonymous';
    const userAvatar = locals.auth?.user?.imageUrl || null;

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
    const { content, parentCommentId } = body;

    // Validate content
    if (!content || content.length < 1 || content.length > 1000) {
      return new Response(JSON.stringify({ error: 'Comment must be 1-1000 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert comment
    const result = await sql`
      INSERT INTO showcase_comments (
        showcase_id, clerk_user_id, content, parent_comment_id,
        author_name, author_avatar
      ) VALUES (
        ${id}, ${userId}, ${content}, ${parentCommentId || null},
        ${userName}, ${userAvatar}
      )
      RETURNING id, showcase_id, clerk_user_id, content, parent_comment_id,
                like_count, is_edited, created_at, updated_at, author_name, author_avatar
    `;

    const comment = result[0];

    return new Response(
      JSON.stringify({
        comment: {
          id: comment.id,
          showcaseId: comment.showcase_id,
          clerkUserId: comment.clerk_user_id,
          content: comment.content,
          parentCommentId: comment.parent_comment_id,
          likeCount: comment.like_count,
          isEdited: comment.is_edited,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
          authorName: comment.author_name,
          authorAvatar: comment.author_avatar,
          replies: [],
        },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in comment API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
