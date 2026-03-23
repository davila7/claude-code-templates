import { useState, useEffect } from 'react';
import type { ComponentHealthScore, ComponentImprovement } from '../lib/types';

export default function ComponentHealthDashboard() {
  const [healthScores, setHealthScores] = useState<ComponentHealthScore[]>([]);
  const [improvements, setImprovements] = useState<ComponentImprovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'needs-attention' | 'top-performers'>('all');
  const [sortBy, setSortBy] = useState<'health' | 'usage' | 'quality'>('health');

  useEffect(() => {
    loadData();
  }, [filter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load health scores
      const healthRes = await fetch(`/api/components/health?filter=${filter}&sort=${sortBy}`);
      const healthData = await healthRes.json();
      setHealthScores(healthData.scores || []);

      // Load recent improvements
      const improvementsRes = await fetch('/api/components/improvements?limit=10');
      const improvementsData = await improvementsRes.json();
      setImprovements(improvementsData.improvements || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'increasing') return '📈';
    if (trend === 'decreasing') return '📉';
    return '➡️';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'researched': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-purple-100 text-purple-800',
      'testing': 'bg-yellow-100 text-yellow-800',
      'review': 'bg-orange-100 text-orange-800',
      'merged': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Component Health Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor and improve component quality across the system</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Components</option>
          <option value="needs-attention">Needs Attention</option>
          <option value="top-performers">Top Performers</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="health">Sort by Health Score</option>
          <option value="usage">Sort by Usage</option>
          <option value="quality">Sort by Quality</option>
        </select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Total Components</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{healthScores.length}</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Needs Attention</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {healthScores.filter(s => s.needs_attention).length}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Average Health</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {(healthScores.reduce((sum, s) => sum + s.overall_health_score, 0) / healthScores.length || 0).toFixed(1)}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Active Improvements</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {improvements.filter(i => ['in_progress', 'testing', 'review'].includes(i.status)).length}
          </div>
        </div>
      </div>

      {/* Component Health Scores */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Component Health Scores</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Component
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage (30d)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {healthScores.map((score) => (
                <tr key={score.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{score.component_name}</div>
                    <div className="text-xs text-gray-500">{score.component_path}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      {score.component_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${getHealthColor(score.overall_health_score)}`}>
                        {score.overall_health_score.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-500">/ 10</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {score.total_invocations_30d?.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${score.success_rate_30d >= 95 ? 'text-green-600' : score.success_rate_30d >= 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {score.success_rate_30d?.toFixed(1) || 0}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span title={score.usage_trend}>
                      {getTrendIcon(score.usage_trend)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {score.needs_attention ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        ⚠️ Needs Attention
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✓ Healthy
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Improvements */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Improvements</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {improvements.map((improvement) => (
            <div key={improvement.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-medium text-gray-900">{improvement.component_name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(improvement.status)}`}>
                      {improvement.status.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {improvement.priority}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">{improvement.component_path}</p>
                  
                  {improvement.improvements_applied && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700">Improvements Applied:</div>
                      <ul className="mt-1 space-y-1">
                        {(improvement.improvements_applied as any[]).map((imp, idx) => (
                          <li key={idx} className="text-sm text-gray-600">
                            • {imp.title || imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {improvement.pr_url && (
                    <a
                      href={improvement.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      View PR #{improvement.pr_number} →
                    </a>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {new Date(improvement.created_at).toLocaleDateString()}
                  </div>
                  {improvement.impact_score && (
                    <div className="mt-1">
                      <span className="text-sm font-medium text-gray-700">Impact: </span>
                      <span className={`text-sm font-bold ${getHealthColor(improvement.impact_score)}`}>
                        {improvement.impact_score.toFixed(1)}/10
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
