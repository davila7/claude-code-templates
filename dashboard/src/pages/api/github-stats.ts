// GitHub Stats API Endpoint

import type { APIRoute } from 'astro';
import { mockGitHubStats } from '../../lib/mock-github-data';
import type { GitHubStats } from '../../types/github';
import { isDatabaseConfigured } from '../../lib/api/neon';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check if database is configured
    if (!isDatabaseConfigured()) {
      // Return mock data if database not configured (local development)
      return new Response(JSON.stringify(mockGitHubStats), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=900',
          'X-Cache-Status': 'MOCK',
        },
      });
    }

    // Production code (requires database and GitHub API)
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Import production dependencies only when needed
    const { githubClient } = await import('../../lib/github-client');
    const { githubCache } = await import('../../lib/github-cache');
    const { githubProcessor } = await import('../../lib/github-processor');

    // Try to get from cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = await githubCache.get<GitHubStats>('stats', 'anthropics/claude-code-templates');
      if (cachedData) {
        const cacheInfo = await githubCache.getCacheInfo('stats', 'anthropics/claude-code-templates');
        return new Response(JSON.stringify({
          ...cachedData,
          cache: cacheInfo,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=900', // 15 minutes
            'X-Cache-Status': 'HIT',
          },
        });
      }
    }

    // Fetch fresh data from GitHub
    const { repo, contributors, issues, pulls, commits, releases, rateLimit } = await githubClient.getAllStats();

    // Process the data
    const overview = githubProcessor.processOverview(repo, contributors, commits);
    overview.openPRs = pulls.filter(pr => pr.state === 'open').length;

    const recentComponents = githubProcessor.processComponents(commits);
    const issueStats = githubProcessor.processIssues(issues);
    const prStats = githubProcessor.processPullRequests(pulls);
    const releaseData = githubProcessor.processReleases(releases);

    const stats: GitHubStats = {
      overview,
      recentComponents,
      contributors: contributors.slice(0, 10).map(c => ({
        login: c.login,
        avatar_url: c.avatar_url,
        contributions: c.contributions,
        profile_url: c.html_url,
        type: c.type,
      })),
      issues: issueStats,
      pullRequests: prStats,
      releases: releaseData,
      cache: {
        hit: false,
        age: 0,
        expiresIn: 900, // 15 minutes
      },
    };

    // Save to cache
    await githubCache.set('stats', 'anthropics/claude-code-templates', stats);

    // Save historical snapshot
    await githubCache.saveHistoricalSnapshot('anthropics', 'claude-code-templates', {
      stars: overview.stars,
      forks: overview.forks,
      openIssues: overview.openIssues,
      openPRs: overview.openPRs,
      contributors: overview.contributors,
      commits30d: overview.commits30d,
    });

    // Save components to timeline
    for (const component of recentComponents) {
      await githubCache.saveComponent(
        component.name,
        component.type,
        component.date,
        component.sha,
        component.author
      );
    }

    // Save rate limit info
    await githubCache.saveRateLimit('all', rateLimit.limit, rateLimit.remaining, rateLimit.reset);

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900',
        'X-Cache-Status': 'MISS',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error) {
    console.error('GitHub stats API error:', error);

    // Try to return cached data even if expired
    const cachedData = await githubCache.get<GitHubStats>('stats', 'anthropics/claude-code-templates');
    if (cachedData) {
      return new Response(JSON.stringify({
        ...cachedData,
        error: 'Using cached data due to API error',
        cache: { hit: true, age: 0, expiresIn: 0 },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Status': 'STALE',
        },
      });
    }

    return new Response(JSON.stringify({
      error: 'Failed to fetch GitHub statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
