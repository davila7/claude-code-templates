import type { APIRoute } from 'astro';
import { getNeonClient } from '../../../lib/api/neon';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user from Clerk (if available)
    const userId = locals.auth?.userId || 'anonymous';
    
    const body = await request.json();

    // Basic validation
    if (!body.title || body.title.length < 5 || body.title.length > 100) {
      return new Response(JSON.stringify({ error: 'Title must be 5-100 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.description || body.description.length < 20 || body.description.length > 500) {
      return new Response(JSON.stringify({ error: 'Description must be 20-500 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.content || body.content.length < 100) {
      return new Response(JSON.stringify({ error: 'Content must be at least 100 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.tags || body.tags.length < 1) {
      return new Response(JSON.stringify({ error: 'At least one tag is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert into database
    const query = `
      INSERT INTO showcase_submissions (
        clerk_user_id, title, description, content, submission_type,
        code_before, code_after, code_language, tags, category, difficulty_level,
        thumbnail_url, demo_url, github_url, video_url,
        author_name, author_avatar, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id, status
    `;

    const result = await sql(query, [
      userId,
      body.title,
      body.description,
      body.content,
      body.submissionType || 'workflow',
      body.codeBefore || null,
      body.codeAfter || null,
      body.codeLanguage || 'typescript',
      body.tags,
      body.category,
      body.difficultyLevel || 'intermediate',
      body.thumbnailUrl || null,
      body.demoUrl || null,
      body.githubUrl || null,
      body.videoUrl || null,
      body.authorName || 'Anonymous',
      body.authorAvatar || null,
      'pending',
    ]);

    return new Response(
      JSON.stringify({
        id: result[0].id,
        status: result[0].status,
        message: 'Submission received and pending approval',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in showcase submit API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
