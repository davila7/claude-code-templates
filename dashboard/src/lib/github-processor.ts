// GitHub Data Processing and Aggregation

import type {
  GitHubStats,
  OverviewStats,
  ComponentAddition,
  IssueStats,
  PRStats,
  GitHubRepo,
  GitHubContributor,
  GitHubIssue,
  GitHubPullRequest,
  GitHubCommit,
  GitHubRelease,
} from '../types/github';

export class GitHubProcessor {
  processOverview(repo: GitHubRepo, contributors: GitHubContributor[], commits: GitHubCommit[]): OverviewStats {
    const commits30d = this.countRecentCommits(commits, 30);

    return {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      openPRs: 0, // Will be calculated from PRs
      contributors: contributors.length,
      commits30d,
      watchers: repo.watchers_count,
      size: repo.size,
      defaultBranch: repo.default_branch,
      lastUpdated: repo.updated_at,
    };
  }

  processComponents(commits: GitHubCommit[]): ComponentAddition[] {
    const components: ComponentAddition[] = [];
    const componentPatterns = [
      { regex: /add\s+(agent|new\s+agent)[:\s]+([^\n]+)/i, type: 'agent' as const },
      { regex: /add\s+(command|new\s+command)[:\s]+([^\n]+)/i, type: 'command' as const },
      { regex: /add\s+(hook|new\s+hook)[:\s]+([^\n]+)/i, type: 'hook' as const },
      { regex: /add\s+(mcp|new\s+mcp)[:\s]+([^\n]+)/i, type: 'mcp' as const },
      { regex: /add\s+(skill|new\s+skill)[:\s]+([^\n]+)/i, type: 'skill' as const },
    ];

    for (const commit of commits) {
      const message = commit.commit.message;
      
      for (const pattern of componentPatterns) {
        const match = message.match(pattern.regex);
        if (match) {
          components.push({
            name: match[2]?.trim() || 'Unknown',
            type: pattern.type,
            date: new Date(commit.commit.author.date).toISOString().split('T')[0],
            author: commit.author?.login || commit.commit.author.name,
            sha: commit.sha.substring(0, 7),
            url: commit.html_url,
          });
          break; // Only match one pattern per commit
        }
      }
    }

    return components.slice(0, 10); // Return last 10
  }

  processIssues(issues: GitHubIssue[]): IssueStats {
    // Filter out pull requests (they appear in issues endpoint)
    const actualIssues = issues.filter(issue => !issue.pull_request);
    
    const openIssues = actualIssues.filter(i => i.state === 'open');
    const closedIssues = actualIssues.filter(i => i.state === 'closed');

    const avgCloseTime = this.calculateAvgCloseTime(closedIssues);

    const recentIssues = actualIssues.slice(0, 5).map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      created_at: issue.created_at,
      labels: issue.labels.map(l => l.name),
      url: issue.html_url,
      author: issue.user.login,
    }));

    return {
      open: openIssues.length,
      closed: closedIssues.length,
      avgCloseTime,
      recentIssues,
    };
  }

  processPullRequests(pulls: GitHubPullRequest[]): PRStats {
    const openPRs = pulls.filter(pr => pr.state === 'open');
    const closedPRs = pulls.filter(pr => pr.state === 'closed');
    const mergedPRs = closedPRs.filter(pr => pr.merged_at !== null);

    const mergeRate = closedPRs.length > 0 
      ? Math.round((mergedPRs.length / closedPRs.length) * 100) 
      : 0;

    const avgMergeTime = this.calculateAvgMergeTime(mergedPRs);

    const recentPRs = pulls.slice(0, 5).map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user.login,
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      url: pr.html_url,
    }));

    return {
      open: openPRs.length,
      merged: mergedPRs.length,
      closed: closedPRs.length - mergedPRs.length,
      mergeRate,
      avgMergeTime,
      recentPRs,
    };
  }

  processReleases(releases: GitHubRelease[]) {
    return releases.slice(0, 5).map(release => ({
      tag: release.tag_name,
      name: release.name || release.tag_name,
      date: release.published_at,
      description: this.truncateDescription(release.body, 150),
      url: release.html_url,
      author: release.author.login,
    }));
  }

  private countRecentCommits(commits: GitHubCommit[], days: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return commits.filter(commit => {
      const commitDate = new Date(commit.commit.author.date);
      return commitDate >= cutoffDate;
    }).length;
  }

  private calculateAvgCloseTime(closedIssues: GitHubIssue[]): number {
    if (closedIssues.length === 0) return 0;

    const totalTime = closedIssues.reduce((sum, issue) => {
      if (!issue.closed_at) return sum;
      const opened = new Date(issue.created_at).getTime();
      const closed = new Date(issue.closed_at).getTime();
      return sum + (closed - opened);
    }, 0);

    const avgMilliseconds = totalTime / closedIssues.length;
    const avgDays = avgMilliseconds / (1000 * 60 * 60 * 24);
    return Math.round(avgDays * 10) / 10; // Round to 1 decimal
  }

  private calculateAvgMergeTime(mergedPRs: GitHubPullRequest[]): number {
    if (mergedPRs.length === 0) return 0;

    const totalTime = mergedPRs.reduce((sum, pr) => {
      if (!pr.merged_at) return sum;
      const opened = new Date(pr.created_at).getTime();
      const merged = new Date(pr.merged_at).getTime();
      return sum + (merged - opened);
    }, 0);

    const avgMilliseconds = totalTime / mergedPRs.length;
    const avgDays = avgMilliseconds / (1000 * 60 * 60 * 24);
    return Math.round(avgDays * 10) / 10; // Round to 1 decimal
  }

  private truncateDescription(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }
}

export const githubProcessor = new GitHubProcessor();
