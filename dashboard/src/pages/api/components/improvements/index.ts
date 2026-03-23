import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const GET: APIRoute = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const status = url.searchParams.get('status');
    const component_type = url.searchParams.get('type');

    let query = sql`
      SELECT 
        id,
        component_path,
        component_name,
        component_type,
        improvement_type,
        priority,
        status,
        improvements_applied,
        pr_number,
        pr_url,
        impact_score,
        effort_estimate_hours,
        token_savings,
        cost_savings_per_invocation,
        created_at,
        updated_at,
        completed_at
      FROM component_improvements
      WHERE 1=1
    `;

    if (status) {
      query = sql`${query} AND status = ${status}`;
    }

    if (component_type) {
      query = sql`${query} AND component_type = ${component_type}`;
    }

    query = sql`${query}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const improvements = await query;

    return new Response(JSON.stringify({ 
      improvements,
      count: improvements.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching improvements:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch improvements' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
