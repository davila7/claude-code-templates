import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

export const GET: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const DATABASE_URL = import.meta.env.DATABASE_URL;
    if (!DATABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'Database not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sql = neon(DATABASE_URL);

    // Get current usage
    const usage = await sql`
      SELECT 
        us.tier,
        us.ai_generations_used,
        sl.ai_generations_per_month as limit,
        us.current_period_end,
        COUNT(agu.id) as total_generations,
        SUM(agu.tokens_used) as total_tokens
      FROM user_subscriptions us
      LEFT JOIN subscription_limits sl ON us.tier = sl.tier
      LEFT JOIN ai_generation_usage agu ON agu.clerk_user_id = us.clerk_user_id
        AND agu.created_at >= us.current_period_start
      WHERE us.clerk_user_id = ${userId}
      GROUP BY us.tier, us.ai_generations_used, sl.ai_generations_per_month, us.current_period_end
    `;

    if (usage.length === 0) {
      return new Response(
        JSON.stringify({
          tier: 'free',
          used: 0,
          limit: 5,
          remaining: 5,
          totalGenerations: 0,
          totalTokens: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = usage[0];
    const limit = data.limit === -1 ? Infinity : data.limit;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - data.ai_generations_used);

    return new Response(
      JSON.stringify({
        tier: data.tier,
        used: data.ai_generations_used,
        limit: data.limit,
        remaining,
        periodEnd: data.current_period_end,
        totalGenerations: data.total_generations || 0,
        totalTokens: data.total_tokens || 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Usage fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch usage data' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
