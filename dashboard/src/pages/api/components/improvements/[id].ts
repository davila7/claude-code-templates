import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing improvement ID' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await sql`
      SELECT * FROM component_improvements
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Improvement not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      improvement: result[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching improvement:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch improvement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing improvement ID' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const {
      status,
      improvements_applied,
      test_results,
      review_results,
      pr_number,
      pr_url,
      pr_status,
      branch_name,
      impact_score,
      token_savings,
      cost_savings_per_invocation,
      performance_improvement_percent,
      error_message
    } = body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      
      if (status === 'merged') {
        updates.push(`completed_at = NOW()`);
      }
    }

    if (improvements_applied !== undefined) {
      updates.push(`improvements_applied = $${paramIndex++}`);
      values.push(JSON.stringify(improvements_applied));
      updates.push(`improvement_timestamp = NOW()`);
    }

    if (test_results !== undefined) {
      updates.push(`test_results = $${paramIndex++}`);
      values.push(JSON.stringify(test_results));
      updates.push(`test_timestamp = NOW()`);
    }

    if (review_results !== undefined) {
      updates.push(`review_results = $${paramIndex++}`);
      values.push(JSON.stringify(review_results));
      updates.push(`review_timestamp = NOW()`);
    }

    if (pr_number !== undefined) {
      updates.push(`pr_number = $${paramIndex++}`);
      values.push(pr_number);
    }

    if (pr_url !== undefined) {
      updates.push(`pr_url = $${paramIndex++}`);
      values.push(pr_url);
    }

    if (pr_status !== undefined) {
      updates.push(`pr_status = $${paramIndex++}`);
      values.push(pr_status);
    }

    if (branch_name !== undefined) {
      updates.push(`branch_name = $${paramIndex++}`);
      values.push(branch_name);
    }

    if (impact_score !== undefined) {
      updates.push(`impact_score = $${paramIndex++}`);
      values.push(impact_score);
    }

    if (token_savings !== undefined) {
      updates.push(`token_savings = $${paramIndex++}`);
      values.push(token_savings);
    }

    if (cost_savings_per_invocation !== undefined) {
      updates.push(`cost_savings_per_invocation = $${paramIndex++}`);
      values.push(cost_savings_per_invocation);
    }

    if (performance_improvement_percent !== undefined) {
      updates.push(`performance_improvement_percent = $${paramIndex++}`);
      values.push(performance_improvement_percent);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No fields to update' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    values.push(id);
    const query = `
      UPDATE component_improvements
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Improvement not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      improvement: result[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating improvement:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update improvement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Missing improvement ID' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await sql`
      DELETE FROM component_improvements
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Improvement not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Improvement deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting improvement:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete improvement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
