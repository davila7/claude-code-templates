import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { component_path } = body;

    if (!component_path) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: component_path' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate health metrics from usage events and improvements
    const metrics = await sql`
      WITH usage_stats AS (
        SELECT 
          COUNT(*) FILTER (WHERE event_type = 'success') as success_count,
          COUNT(*) FILTER (WHERE event_type = 'error') as error_count,
          COUNT(*) as total_count,
          AVG(execution_time_ms) as avg_execution_time,
          AVG(tokens_used) as avg_tokens
        FROM component_usage_events
        WHERE component_path = ${component_path}
          AND event_timestamp >= NOW() - INTERVAL '30 days'
      ),
      improvement_stats AS (
        SELECT 
          COUNT(*) as improvement_count,
          AVG(impact_score) as avg_impact_score
        FROM component_improvements
        WHERE component_path = ${component_path}
          AND status = 'merged'
      )
      SELECT 
        u.success_count,
        u.error_count,
        u.total_count,
        u.avg_execution_time,
        u.avg_tokens,
        i.improvement_count,
        i.avg_impact_score
      FROM usage_stats u
      CROSS JOIN improvement_stats i
    `;

    const stats = metrics[0] || {
      success_count: 0,
      error_count: 0,
      total_count: 0,
      avg_execution_time: 0,
      avg_tokens: 0,
      improvement_count: 0,
      avg_impact_score: 0
    };

    // Calculate scores (0-10 scale)
    const success_rate = stats.total_count > 0 
      ? (stats.success_count / stats.total_count) * 100 
      : 0;
    
    const error_rate = stats.total_count > 0 
      ? (stats.error_count / stats.total_count) * 100 
      : 0;

    const reliability_score = Math.min(10, success_rate / 10);
    const quality_score = Math.min(10, (stats.avg_impact_score || 5));
    const performance_score = stats.avg_execution_time > 0
      ? Math.max(0, 10 - (stats.avg_execution_time / 1000))
      : 7;
    
    const overall_health_score = (
      reliability_score * 0.4 +
      quality_score * 0.3 +
      performance_score * 0.3
    );

    const needs_attention = overall_health_score < 6 || error_rate > 10;
    const attention_reason = needs_attention
      ? error_rate > 10 
        ? `High error rate: ${error_rate.toFixed(1)}%`
        : `Low health score: ${overall_health_score.toFixed(1)}/10`
      : null;

    // Update or insert health score
    await sql`
      INSERT INTO component_health_scores (
        component_path,
        component_name,
        component_type,
        overall_health_score,
        quality_score,
        reliability_score,
        performance_score,
        total_invocations_30d,
        success_rate_30d,
        error_rate_30d,
        needs_attention,
        attention_reason
      ) VALUES (
        ${component_path},
        ${component_path.split('/').pop()?.replace(/\.[^.]+$/, '')},
        ${component_path.includes('/agents/') ? 'agent' : 
          component_path.includes('/commands/') ? 'command' :
          component_path.includes('/hooks/') ? 'hook' : 'unknown'},
        ${overall_health_score},
        ${quality_score},
        ${reliability_score},
        ${performance_score},
        ${stats.total_count},
        ${success_rate},
        ${error_rate},
        ${needs_attention},
        ${attention_reason}
      )
      ON CONFLICT (component_path) DO UPDATE SET
        overall_health_score = ${overall_health_score},
        quality_score = ${quality_score},
        reliability_score = ${reliability_score},
        performance_score = ${performance_score},
        total_invocations_30d = ${stats.total_count},
        success_rate_30d = ${success_rate},
        error_rate_30d = ${error_rate},
        needs_attention = ${needs_attention},
        attention_reason = ${attention_reason},
        calculated_at = NOW()
    `;

    return new Response(JSON.stringify({ 
      success: true,
      health_score: {
        component_path,
        overall_health_score,
        quality_score,
        reliability_score,
        performance_score,
        success_rate,
        error_rate,
        needs_attention,
        attention_reason
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error recalculating health score:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to recalculate health score',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
