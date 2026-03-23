import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.NEON_DATABASE_URL);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { improvement_id, component_path, research_report } = body;

    if (!improvement_id || !component_path || !research_report) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract component details
    const component_name = component_path.split('/').pop()?.replace(/\.(md|json)$/, '') || '';
    const component_type = component_path.includes('/agents/') ? 'agent' :
                          component_path.includes('/commands/') ? 'command' :
                          component_path.includes('/hooks/') ? 'hook' :
                          component_path.includes('/mcps/') ? 'mcp' :
                          component_path.includes('/settings/') ? 'setting' :
                          component_path.includes('/skills/') ? 'skill' : 'unknown';

    // Insert or update improvement record
    await sql`
      INSERT INTO component_improvements (
        id,
        component_path,
        component_name,
        component_type,
        improvement_type,
        priority,
        status,
        research_report,
        research_agent,
        research_timestamp,
        impact_score,
        effort_estimate_hours
      ) VALUES (
        ${improvement_id},
        ${component_path},
        ${component_name},
        ${component_type},
        ${research_report.improvement_type || 'quality'},
        ${research_report.priority || 'medium'},
        'researched',
        ${JSON.stringify(research_report)},
        'component-researcher',
        NOW(),
        ${research_report.impact_score || 5.0},
        ${research_report.effort_estimate_hours || 2}
      )
      ON CONFLICT (id) DO UPDATE SET
        research_report = ${JSON.stringify(research_report)},
        research_timestamp = NOW(),
        updated_at = NOW()
    `;

    return new Response(JSON.stringify({ 
      success: true,
      improvement_id 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error storing research results:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to store research results' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
