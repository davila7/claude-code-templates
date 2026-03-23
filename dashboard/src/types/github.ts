// GitHub Integration Dashboard Types

export interface GitHubStats {
  overview: OverviewStats;
  recentComponents: ComponentAddition[];
  contributors: Contributor[];
  issues: IssueStats;
  pullRequests: PRStats;
  releases: Release[];
  cache: CacheInfo;
}

export interface OverviewStats {
  stars: number;
  forks: number;
  openIssues: number;
  openPRs: number;
  contributors: number;
  commits30d: number;
  watchers: number;
  size: number;
  defaultBranch: string;
  lastUpdated: string;
}

export interface ComponentAddition {
  name: string;
  type: 'agent' | 'command' | 'hook' | 'mcp' | 'skill';
  date: string;
  author: string;
  sha: string;
  url: string;
}

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  profile_url: string;
  type: string;
}

export interface IssueStats {
  open: number;
  closed: number;
  avgCloseTime: number; // in days
  recentIssues: IssueItem[];
}

export interface IssueItem {
  number: number;
  title: string;
  state: string;
  created_at: string;
  labels: string[];
  url: string;
  author: string;
}

export interface PRStats {
  open: number;
  merged: number;
  closed: number;
  mergeRate: number; // percentage
  avgMergeTime: number; // in days
  recentPRs: PRItem[];
}

export interface PRItem {
  number: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  merged_at: string | null;
  url: string;
}

export interface Release {
  tag: string;
  name: string;
  date: string;
  description: string;
  url: string;
  author: string;
}

export interface CacheInfo {
  hit: boolean;
  age: number; // seconds
  expiresIn: number; // seconds
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  github: {
    accessible: boolean;
    rateLimit: RateLimitInfo;
  };
  database: {
    accessible: boolean;
    cacheSize: number;
  };
  lastUpdate: string;
}

export interface HistoricalStats {
  date: string;
  stars: number;
  forks: number;
  openIssues: number;
  openPRs: number;
  contributors: number;
  commits30d: number;
}

// GitHub API Response Types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  size: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  labels: Array<{ name: string; color: string }>;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  pull_request?: {
    url: string;
  };
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  created_at: string;
  published_at: string;
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  };
}

// Database Types
export interface CachedData {
  id: number;
  cache_key: string;
  data: any;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
  access_count: number;
}

export interface RateLimitRecord {
  id: number;
  endpoint: string;
  limit_total: number;
  limit_remaining: number;
  limit_reset: string;
  checked_at: string;
}

export interface StatsHistoryRecord {
  id: number;
  repo_owner: string;
  repo_name: string;
  snapshot_date: string;
  stars: number;
  forks: number;
  open_issues: number;
  open_prs: number;
  contributors: number;
  commits_30d: number;
  created_at: string;
}

export interface ComponentTimelineRecord {
  id: number;
  component_name: string;
  component_type: 'agent' | 'command' | 'hook' | 'mcp' | 'skill';
  added_date: string;
  commit_sha: string;
  author: string;
  created_at: string;
}
