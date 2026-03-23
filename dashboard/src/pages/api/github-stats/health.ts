// GitHub Stats Health Check Endpoint

import type { APIRoute } from 'astro';
import { githubClient } from '../../../lib/github-client';
import { githubCache } from '../../../lib/github-cache';
import type { HealthStatus } from '../../../types/github';

export const GET: APIRoute = async () => {
  const health: HealthStatus = {
    status: 'healthy',
    github: {
      accessible: false,
      rateLimit: {
        limit: 0,
        remaining: 0,
        reset: 0,
        used: 0,
      },
    },
    database: {
      accessible: false,
      cacheSize: 0,
    },
    lastUpdate: new Date().toISOString(),
  };

  // Check GitHub API accessibility
  try {
    const { rateLimit } = await githubClient.getRepository();
    health.github.accessible = true;
    health.github.rateLimit = rateLimit;
  } catch (error) {
    health.status = 'degraded';
    console.error('GitHub API health check failed:', error);
  }

  // Check database accessibility
  try {
    const REPO_OWNER = import.meta.env.PUBLIC_GITHUB_REPO_OWNER || 'anthropics';
    const REPO_NAME = import.meta.env.PUBLIC_GITHUB_REPO_NAME || 'claude-code-templates';
    const repo = `${REPO_OWNER}/${REPO_NAME}`;
    
    const cacheInfo = await githubCache.getCacheInfo('stats', repo);
    health.database.accessible = true;
    health.database.cacheSize = cacheInfo.hit ? 1 : 0;
  } catch (error) {
    health.status = 'degraded';
    console.error('Database health check failed:', error);
  }

  // Determine overall status
  if (!health.github.accessible && !health.database.accessible) {
    health.status = 'unhealthy';
  }

  return new Response(JSON.stringify(health), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
