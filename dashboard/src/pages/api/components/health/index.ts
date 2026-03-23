import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const GET: APIRoute = async ({ url }) => {
  try {
    const component_path = url.searchParams.get('component_path');
    const needs_attention = url.searchParams.get('needs_attention');
    const min_score = parseFloat(url.searchParams.get('min_score') || '0');
    const max_score = parseFloat(url.searchParams.get('max_score') || '10');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let queryStr = 'SELECT * FROM component_health_scores WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (component_path) {
      queryStr += ` AND component_path = $${paramIndex++}`;
      values.push(component_path);
    }

    if (needs_attention === 'true') {
      queryStr += ` AND needs_attention = true`;
    }

    queryStr += ` AND overall_health_score >= $${paramIndex++}`;
    values.push(min_score);

    queryStr += ` AND overall_health_score <= $${paramIndex++}`;
    values.push(max_score);

    queryStr += ` ORDER BY overall_health_score DESC LIMIT $${paramIndex}`;
    values.push(limit);

    const results = await sql(queryStr, values);

    return new Response(JSON.stringify({ 
      success: true,
      health_scores: results,
      count: results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching health scores:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch health scores',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      component_path,
      component_name,
      component_type,
      overall_health_score,
      quality_score,
      reliability_score,
      performance_score,
      usability_score,
      maintainability_score,
      usage_rank,
      usage_percentile,
      total_invocations_30d,
      success_rate_30d,
      error_rate_30d,
      usage_trend,
      quality_trend,
      performance_trend,
      needs_attention,
      attention_reason
    } = body;

    if (!component_path || overall_health_score === undefined) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: component_path, overall_health_score' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await sql`
      INSERT INTO component_health_scores (
        component_path,
        component_name,
        component_type,
        overall_health_score,
        quality_score,
        reliability_score,
        performance_score,
        usability_score,
        maintainability_score,
        usage_rank,
        usage_percentile,
        total_invocations_30d,
        success_rate_30d,
        error_rate_30d,
        usage_trend,
        quality_trend,
        performance_trend,
        needs_attention,
        attention_reason
      ) VALUES (
        ${component_path},
        ${component_name || component_path.split('/').pop()?.replace(/\.[^.]+$/, '')},
        ${component_type || 'unknown'},
        ${overall_health_score},
        ${quality_score || null},
        ${reliability_score || null},
        ${performance_score || null},
        ${usability_score || null},
        ${maintainability_score || null},
        ${usage_rank || null},
        ${usage_percentile || null},
        ${total_invocations_30d || 0},
        ${success_rate_30d || null},
        ${error_rate_30d || null},
        ${usage_trend || 'unknown'},
        ${quality_trend || 'unknown'},
        ${performance_trend || 'unknown'},
        ${needs_attention || false},
        ${attention_reason || null}
      )
      ON CONFLICT (component_path) DO UPDATE SET
        overall_health_score = ${overall_health_score},
        quality_score = ${quality_score || null},
        reliability_score = ${reliability_score || null},
        performance_score = ${performance_score || null},
        usability_score = ${usability_score || null},
        maintainability_score = ${maintainability_score || null},
        usage_rank = ${usage_rank || null},
        usage_percentile = ${usage_percentile || null},
        total_invocations_30d = ${total_invocations_30d || 0},
        success_rate_30d = ${success_rate_30d || null},
        error_rate_30d = ${error_rate_30d || null},
        usage_trend = ${usage_trend || 'unknown'},
        quality_trend = ${quality_trend || 'unknown'},
        performance_trend = ${performance_trend || 'unknown'},
        needs_attention = ${needs_attention || false},
        attention_reason = ${attention_reason || null},
        calculated_at = NOW()
      RETURNING *
    `;

    return new Response(JSON.stringify({ 
      success: true,
      health_score: result[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating health score:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update health score',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
