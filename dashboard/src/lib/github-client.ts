// GitHub API Client with Caching

import type {
  GitHubRepo,
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  GitHubRelease,
  RateLimitInfo,
} from '../types/github';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || '';
const REPO_OWNER = import.meta.env.PUBLIC_GITHUB_REPO_OWNER || 'anthropics';
const REPO_NAME = import.meta.env.PUBLIC_GITHUB_REPO_NAME || 'claude-code-templates';

export class GitHubClient {
  private headers: HeadersInit;

  constructor() {
    this.headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Claude-Code-Templates-Dashboard',
    };

    if (GITHUB_TOKEN) {
      this.headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
  }

  private async fetch<T>(endpoint: string): Promise<{ data: T; rateLimit: RateLimitInfo }> {
    const url = `${GITHUB_API_BASE}${endpoint}`;
    
    try {
      const response = await fetch(url, { headers: this.headers });

      // Extract rate limit info from headers
      const rateLimit: RateLimitInfo = {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '60'),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '60'),
        reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
        used: parseInt(response.headers.get('X-RateLimit-Used') || '0'),
      };

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data, rateLimit };
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      throw error;
    }
  }

  async getRepository(): Promise<{ data: GitHubRepo; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubRepo>(`/repos/${REPO_OWNER}/${REPO_NAME}`);
  }

  async getContributors(perPage: number = 100): Promise<{ data: GitHubContributor[]; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubContributor[]>(`/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=${perPage}`);
  }

  async getIssues(state: 'open' | 'closed' | 'all' = 'all', perPage: number = 100): Promise<{ data: GitHubIssue[]; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubIssue[]>(`/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=${state}&per_page=${perPage}`);
  }

  async getPullRequests(state: 'open' | 'closed' | 'all' = 'all', perPage: number = 100): Promise<{ data: GitHubPullRequest[]; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubPullRequest[]>(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=${state}&per_page=${perPage}`);
  }

  async getCommits(perPage: number = 100): Promise<{ data: GitHubCommit[]; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubCommit[]>(`/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=${perPage}`);
  }

  async getReleases(perPage: number = 10): Promise<{ data: GitHubRelease[]; rateLimit: RateLimitInfo }> {
    return this.fetch<GitHubRelease[]>(`/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=${perPage}`);
  }

  async getAllStats() {
    // Fetch all data in parallel for efficiency
    const [repo, contributors, issues, pulls, commits, releases] = await Promise.all([
      this.getRepository(),
      this.getContributors(100),
      this.getIssues('all', 100),
      this.getPullRequests('all', 100),
      this.getCommits(100),
      this.getReleases(10),
    ]);

    return {
      repo: repo.data,
      contributors: contributors.data,
      issues: issues.data,
      pulls: pulls.data,
      commits: commits.data,
      releases: releases.data,
      rateLimit: repo.rateLimit, // Use the first rate limit info
    };
  }
}

export const githubClient = new GitHubClient();
