import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

export const POST: APIRoute = async ({ request }) => {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const DATABASE_URL = import.meta.env.DATABASE_URL;
    const STRIPE_SECRET_KEY = import.meta.env.STRIPE_SECRET_KEY;

    if (!DATABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'Database not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sql = neon(DATABASE_URL);

    // Get user's subscription
    const subscription = await sql`
      SELECT * FROM user_subscriptions
      WHERE clerk_user_id = ${userId}
    `;

    if (subscription.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userSub = subscription[0];

    // Cancel in Stripe if configured
    if (STRIPE_SECRET_KEY && userSub.stripe_subscription_id) {
      // TODO: Implement Stripe cancellation
      /*
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
      await stripe.subscriptions.update(userSub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      */
    }

    // Update database
    await sql`
      UPDATE user_subscriptions
      SET 
        cancel_at_period_end = true,
        updated_at = NOW()
      WHERE clerk_user_id = ${userId}
    `;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription will be canceled at the end of the billing period',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cancel subscription' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
