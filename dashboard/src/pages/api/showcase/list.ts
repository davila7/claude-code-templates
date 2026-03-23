import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../lib/api/neon';

export const GET: APIRoute = async ({ url }) => {
  try {
    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const type = url.searchParams.get('type');
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status') || 'approved';
    const featured = url.searchParams.get('featured') === 'true';
    const difficulty = url.searchParams.get('difficulty');
    const sort = url.searchParams.get('sort') || 'recent';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build WHERE clause dynamically
    let whereConditions = [`status = '${status}'`];
    
    if (type) whereConditions.push(`submission_type = '${type}'`);
    if (category) whereConditions.push(`category = '${category}'`);
    if (featured) whereConditions.push(`is_featured = true`);
    if (difficulty) whereConditions.push(`difficulty_level = '${difficulty}'`);

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'views':
        orderBy = 'view_count DESC';
        break;
      case 'likes':
        orderBy = 'like_count DESC';
        break;
      case 'trending':
        orderBy = '(view_count + like_count * 3 + try_count * 5) DESC';
        break;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM showcase_submissions WHERE ${whereClause}`;
    const countResult = await sql(countQuery);
    const total = parseInt(countResult[0].total);

    // Get paginated results
    const query = `
      SELECT 
        id, clerk_user_id, title, description, content, submission_type,
        code_before, code_after, code_language, tags, category, difficulty_level,
        status, is_featured, featured_at, view_count, like_count, bookmark_count,
        try_count, created_at, updated_at, approved_at, author_name, author_avatar
      FROM showcase_submissions 
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const results = await sql(query);

    // Transform to camelCase
    const showcases = results.map((item: any) => ({
      id: item.id,
      clerkUserId: item.clerk_user_id,
      title: item.title,
      description: item.description,
      content: item.content,
      submissionType: item.submission_type,
      codeBefore: item.code_before,
      codeAfter: item.code_after,
      codeLanguage: item.code_language,
      tags: item.tags,
      category: item.category,
      difficultyLevel: item.difficulty_level,
      status: item.status,
      isFeatured: item.is_featured,
      featuredAt: item.featured_at,
      viewCount: item.view_count,
      likeCount: item.like_count,
      bookmarkCount: item.bookmark_count,
      tryCount: item.try_count,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      approvedAt: item.approved_at,
      authorName: item.author_name,
      authorAvatar: item.author_avatar,
    }));

    return new Response(
      JSON.stringify({
        showcases,
        total,
        hasMore: total > offset + limit,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in showcase list API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
