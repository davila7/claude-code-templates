// GitHub Data Caching Layer using Neon PostgreSQL

import type { CachedData } from '../types/github';

const DATABASE_URL = import.meta.env.DATABASE_URL || '';
const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

export class GitHubCache {
  private sql: any;

  constructor() {
    if (!DATABASE_URL) {
      console.warn('DATABASE_URL not set, caching will be disabled');
      this.sql = null;
      return;
    }
    
    // Only import neon when DATABASE_URL is available
    import('@neondatabase/serverless').then(({ neon }) => {
      this.sql = neon(DATABASE_URL);
    }).catch(err => {
      console.warn('Failed to initialize Neon client:', err);
      this.sql = null;
    });
  }

  private generateCacheKey(type: string, repo: string): string {
    return `${type}:${repo}`;
  }

  async get<T>(type: string, repo: string): Promise<T | null> {
    if (!DATABASE_URL || !this.sql) return null;

    try {
      const cacheKey = this.generateCacheKey(type, repo);
      
      const result = await this.sql`
        SELECT data, expires_at, access_count
        FROM github_stats_cache
        WHERE cache_key = ${cacheKey}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      // Update access stats
      await this.sql`
        UPDATE github_stats_cache
        SET last_accessed_at = NOW(),
            access_count = access_count + 1
        WHERE cache_key = ${cacheKey}
      `;

      return result[0].data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(type: string, repo: string, data: T): Promise<void> {
    if (!DATABASE_URL || !this.sql) return;

    try {
      const cacheKey = this.generateCacheKey(type, repo);
      const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

      await this.sql`
        INSERT INTO github_stats_cache (cache_key, data, expires_at)
        VALUES (${cacheKey}, ${JSON.stringify(data)}, ${expiresAt.toISOString()})
        ON CONFLICT (cache_key)
        DO UPDATE SET
          data = ${JSON.stringify(data)},
          expires_at = ${expiresAt.toISOString()},
          created_at = NOW(),
          access_count = 0
      `;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async getCacheInfo(type: string, repo: string): Promise<{ hit: boolean; age: number; expiresIn: number }> {
    if (!DATABASE_URL || !this.sql) {
      return { hit: false, age: 0, expiresIn: 0 };
    }

    try {
      const cacheKey = this.generateCacheKey(type, repo);
      
      const result = await this.sql`
        SELECT 
          created_at,
          expires_at,
          EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER as age,
          EXTRACT(EPOCH FROM (expires_at - NOW()))::INTEGER as expires_in
        FROM github_stats_cache
        WHERE cache_key = ${cacheKey}
        AND expires_at > NOW()
        LIMIT 1
      `;

      if (result.length === 0) {
        return { hit: false, age: 0, expiresIn: 0 };
      }

      return {
        hit: true,
        age: result[0].age,
        expiresIn: Math.max(0, result[0].expires_in),
      };
    } catch (error) {
      console.error('Cache info error:', error);
      return { hit: false, age: 0, expiresIn: 0 };
    }
  }

  async cleanExpired(): Promise<number> {
    if (!DATABASE_URL || !this.sql) return 0;

    try {
      const result = await this.sql`
        DELETE FROM github_stats_cache
        WHERE expires_at < NOW()
      `;
      return result.length;
    } catch (error) {
      console.error('Cache clean error:', error);
      return 0;
    }
  }

  async saveRateLimit(endpoint: string, limit: number, remaining: number, reset: number): Promise<void> {
    if (!DATABASE_URL || !this.sql) return;

    try {
      const resetDate = new Date(reset * 1000);
      
      await this.sql`
        INSERT INTO github_rate_limits (endpoint, limit_total, limit_remaining, limit_reset)
        VALUES (${endpoint}, ${limit}, ${remaining}, ${resetDate.toISOString()})
      `;
    } catch (error) {
      console.error('Rate limit save error:', error);
    }
  }

  async saveHistoricalSnapshot(
    repoOwner: string,
    repoName: string,
    stats: {
      stars: number;
      forks: number;
      openIssues: number;
      openPRs: number;
      contributors: number;
      commits30d: number;
    }
  ): Promise<void> {
    if (!DATABASE_URL || !this.sql) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.sql`
        INSERT INTO github_stats_history (
          repo_owner, repo_name, snapshot_date,
          stars, forks, open_issues, open_prs, contributors, commits_30d
        )
        VALUES (
          ${repoOwner}, ${repoName}, ${today},
          ${stats.stars}, ${stats.forks}, ${stats.openIssues},
          ${stats.openPRs}, ${stats.contributors}, ${stats.commits30d}
        )
        ON CONFLICT (repo_owner, repo_name, snapshot_date)
        DO UPDATE SET
          stars = ${stats.stars},
          forks = ${stats.forks},
          open_issues = ${stats.openIssues},
          open_prs = ${stats.openPRs},
          contributors = ${stats.contributors},
          commits_30d = ${stats.commits30d}
      `;
    } catch (error) {
      console.error('Historical snapshot save error:', error);
    }
  }

  async getHistoricalStats(repoOwner: string, repoName: string, days: number = 30) {
    if (!DATABASE_URL || !this.sql) return [];

    try {
      const result = await this.sql`
        SELECT 
          snapshot_date as date,
          stars, forks, open_issues, open_prs, contributors, commits_30d
        FROM github_stats_history
        WHERE repo_owner = ${repoOwner}
        AND repo_name = ${repoName}
        AND snapshot_date >= NOW() - INTERVAL '${days} days'
        ORDER BY snapshot_date DESC
      `;

      return result;
    } catch (error) {
      console.error('Historical stats get error:', error);
      return [];
    }
  }

  async saveComponent(
    name: string,
    type: 'agent' | 'command' | 'hook' | 'mcp' | 'skill',
    date: string,
    commitSha: string,
    author: string
  ): Promise<void> {
    if (!DATABASE_URL || !this.sql) return;

    try {
      await this.sql`
        INSERT INTO github_components_timeline (
          component_name, component_type, added_date, commit_sha, author
        )
        VALUES (${name}, ${type}, ${date}, ${commitSha}, ${author})
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      console.error('Component save error:', error);
    }
  }

  async getRecentComponents(limit: number = 10) {
    if (!DATABASE_URL || !this.sql) return [];

    try {
      const result = await this.sql`
        SELECT 
          component_name as name,
          component_type as type,
          added_date as date,
          commit_sha as sha,
          author
        FROM github_components_timeline
        ORDER BY added_date DESC, created_at DESC
        LIMIT ${limit}
      `;

      return result;
    } catch (error) {
      console.error('Recent components get error:', error);
      return [];
    }
  }
}

export const githubCache = new GitHubCache();
