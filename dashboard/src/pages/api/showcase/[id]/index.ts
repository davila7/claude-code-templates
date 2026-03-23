import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../../lib/api/neon';

export const GET: APIRoute = async ({ params, locals }) => {
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

    if (!id) {
      return new Response(JSON.stringify({ error: 'Showcase ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get showcase
    const showcaseQuery = `
      SELECT 
        id, clerk_user_id, title, description, content, submission_type,
        code_before, code_after, code_language, tags, category, difficulty_level,
        status, is_featured, featured_at, view_count, like_count, bookmark_count,
        try_count, created_at, updated_at, approved_at, author_name, author_avatar,
        thumbnail_url, demo_url, github_url, video_url
      FROM showcase_submissions
      WHERE id = $1
    `;
    
    const showcaseResult = await sql(showcaseQuery, [id]);

    if (showcaseResult.length === 0) {
      return new Response(JSON.stringify({ error: 'Showcase not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const showcase = showcaseResult[0];

    // Get comments
    const commentsQuery = `
      SELECT 
        id, showcase_id, clerk_user_id, content, parent_comment_id,
        like_count, is_edited, created_at, updated_at, author_name, author_avatar
      FROM showcase_comments
      WHERE showcase_id = $1 AND is_deleted = false
      ORDER BY created_at ASC
    `;
    
    const comments = await sql(commentsQuery, [id]);

    // Get user reactions if logged in
    let userReactions: string[] = [];
    if (userId) {
      const reactionsQuery = `
        SELECT reaction_type
        FROM showcase_reactions
        WHERE showcase_id = $1 AND clerk_user_id = $2
      `;
      const reactions = await sql(reactionsQuery, [id, userId]);
      userReactions = reactions.map((r: any) => r.reaction_type);
    }

    // Transform showcase to camelCase
    const transformedShowcase = {
      id: showcase.id,
      clerkUserId: showcase.clerk_user_id,
      title: showcase.title,
      description: showcase.description,
      content: showcase.content,
      submissionType: showcase.submission_type,
      codeBefore: showcase.code_before,
      codeAfter: showcase.code_after,
      codeLanguage: showcase.code_language,
      tags: showcase.tags,
      category: showcase.category,
      difficultyLevel: showcase.difficulty_level,
      status: showcase.status,
      isFeatured: showcase.is_featured,
      featuredAt: showcase.featured_at,
      viewCount: showcase.view_count,
      likeCount: showcase.like_count,
      bookmarkCount: showcase.bookmark_count,
      tryCount: showcase.try_count,
      createdAt: showcase.created_at,
      updatedAt: showcase.updated_at,
      approvedAt: showcase.approved_at,
      authorName: showcase.author_name,
      authorAvatar: showcase.author_avatar,
      thumbnailUrl: showcase.thumbnail_url,
      demoUrl: showcase.demo_url,
      githubUrl: showcase.github_url,
      videoUrl: showcase.video_url,
    };

    // Transform comments
    const transformedComments = comments.map((comment: any) => ({
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
    }));

    return new Response(
      JSON.stringify({
        showcase: transformedShowcase,
        author: {
          id: showcase.clerk_user_id,
          name: showcase.author_name,
          avatar: showcase.author_avatar,
        },
        reactions: {
          likes: showcase.like_count,
          bookmarks: showcase.bookmark_count,
          tries: showcase.try_count,
          userReactions,
        },
        comments: transformedComments,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in showcase detail API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
