import type { APIRoute } from 'astro';
import { getNeonClient, isDatabaseConfigured } from '../../../lib/api/neon';

export const POST: APIRoute = async ({ request }) => {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { jobId, action } = await request.json();

    if (!jobId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database connection failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let updateQuery;
    switch (action) {
      case 'view':
        updateQuery = sql`
          INSERT INTO job_analytics (job_id, views)
          VALUES (${jobId}, 1)
          ON CONFLICT (job_id) 
          DO UPDATE SET views = job_analytics.views + 1, last_updated = NOW()
        `;
        break;
      case 'click':
        updateQuery = sql`
          INSERT INTO job_analytics (job_id, clicks)
          VALUES (${jobId}, 1)
          ON CONFLICT (job_id) 
          DO UPDATE SET clicks = job_analytics.clicks + 1, last_updated = NOW()
        `;
        break;
      case 'save':
        updateQuery = sql`
          INSERT INTO job_analytics (job_id, saves)
          VALUES (${jobId}, 1)
          ON CONFLICT (job_id) 
          DO UPDATE SET saves = job_analytics.saves + 1, last_updated = NOW()
        `;
        break;
      case 'apply':
        updateQuery = sql`
          INSERT INTO job_analytics (job_id, applications)
          VALUES (${jobId}, 1)
          ON CONFLICT (job_id) 
          DO UPDATE SET applications = job_analytics.applications + 1, last_updated = NOW()
        `;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    await updateQuery;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return new Response(JSON.stringify({ error: 'Failed to track analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  if (!isDatabaseConfigured()) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'summary';

    const sql = getNeonClient();
    if (!sql) {
      return new Response(JSON.stringify({ error: 'Database connection failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let result;
    if (type === 'summary') {
      result = await sql`
        SELECT 
          SUM(views) as total_views,
          SUM(clicks) as total_clicks,
          SUM(applications) as total_applications,
          SUM(saves) as total_saves
        FROM job_analytics
      `;
    } else if (type === 'top') {
      result = await sql`
        SELECT * FROM job_analytics
        ORDER BY views DESC
        LIMIT 10
      `;
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch analytics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
