// Main GitHub Dashboard Component

import { useEffect, useState } from 'react';
import type { GitHubStats } from '../../types/github';
import OverviewCards from './OverviewCards';
import RecentComponents from './RecentComponents';
import ContributorsSection from './ContributorsSection';
import IssuesChart from './IssuesChart';
import PRActivity from './PRActivity';
import ReleasesTimeline from './ReleasesTimeline';

export default function GitHubDashboard() {
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = forceRefresh ? '/api/github-stats?refresh=true' : '/api/github-stats';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub statistics');
      }
      
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      fetchStats();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#1f1f1f] border-t-[#3b82f6] mb-3"></div>
          <p className="text-[12px] text-[#666]">Loading GitHub statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-[15px] font-semibold text-[#ededed] mb-2">Error Loading Data</h2>
          <p className="text-[12px] text-[#666] mb-4">{error}</p>
          <button
            onClick={() => fetchStats()}
            className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg text-[13px] font-medium transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[#ededed]">
            GitHub Activity
          </h1>
          <p className="text-[12px] text-[#666] mt-0.5">
            Real-time statistics for anthropics/claude-code-templates
          </p>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] rounded-lg text-[12px] font-medium text-[#999] transition-all disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-[11px] text-[#666] mb-3">
          Last updated: {lastUpdated.toLocaleTimeString()}
          {stats.cache.hit && ` • Cached (expires in ${Math.floor(stats.cache.expiresIn / 60)}m)`}
        </div>
      )}

      {/* Overview Cards */}
      <OverviewCards stats={stats.overview} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RecentComponents components={stats.recentComponents} />
        <ContributorsSection contributors={stats.contributors} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <IssuesChart issues={stats.issues} />
        <PRActivity prs={stats.pullRequests} />
      </div>

      {/* Releases Timeline */}
      <ReleasesTimeline releases={stats.releases} />
    </div>
  );
}
