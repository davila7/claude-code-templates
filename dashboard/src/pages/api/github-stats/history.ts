// GitHub Stats Historical Data Endpoint

import type { APIRoute } from 'astro';
import { githubCache } from '../../../lib/github-cache';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    
    // Validate days parameter
    if (days < 1 || days > 365) {
      return new Response(
        JSON.stringify({
          error: 'Invalid days parameter',
          message: 'Days must be between 1 and 365',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const REPO_OWNER = import.meta.env.PUBLIC_GITHUB_REPO_OWNER || 'anthropics';
    const REPO_NAME = import.meta.env.PUBLIC_GITHUB_REPO_NAME || 'claude-code-templates';
    
    const history = await githubCache.getHistoricalStats(REPO_OWNER, REPO_NAME, days);
    
    return new Response(
      JSON.stringify({
        history,
        days,
        count: history.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // 1 hour
        },
      }
    );
  } catch (error) {
    console.error('Historical stats API error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch historical statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
