import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get user ID from auth header (implement your auth logic)
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

    // Get user subscription
    const subscription = await sql`
      SELECT 
        us.*,
        sl.ai_generations_per_month,
        sl.private_collections,
        sl.team_members,
        sl.custom_training,
        sl.priority_support,
        sl.api_access
      FROM user_subscriptions us
      LEFT JOIN subscription_limits sl ON us.tier = sl.tier
      WHERE us.clerk_user_id = ${userId}
    `;

    if (subscription.length === 0) {
      // Return free tier defaults
      const freeLimits = await sql`
        SELECT * FROM subscription_limits WHERE tier = 'free'
      `;

      return new Response(
        JSON.stringify({
          tier: 'free',
          status: 'active',
          aiGenerationsUsed: 0,
          limits: freeLimits[0],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(subscription[0]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Subscription status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch subscription status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
