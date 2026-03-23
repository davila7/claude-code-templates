// Issues Statistics Chart

import type { IssueStats } from '../../types/github';

interface IssuesChartProps {
  issues: IssueStats;
}

export default function IssuesChart({ issues }: IssuesChartProps) {
  const total = issues.open + issues.closed;
  const openPercentage = total > 0 ? (issues.open / total) * 100 : 0;
  const closedPercentage = total > 0 ? (issues.closed / total) * 100 : 0;

  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-[15px] font-semibold text-[#ededed] mb-3">
        Issue Trends
      </h2>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Open Issues</p>
          <p className="text-2xl font-bold text-red-400">
            {issues.open}
          </p>
          <p className="text-[10px] text-[#666] mt-1">
            {openPercentage.toFixed(1)}% of total
          </p>
        </div>
        
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Closed Issues</p>
          <p className="text-2xl font-bold text-green-400">
            {issues.closed}
          </p>
          <p className="text-[10px] text-[#666] mt-1">
            {closedPercentage.toFixed(1)}% of total
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex h-2 rounded-full overflow-hidden bg-[#1f1f1f]">
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${openPercentage}%` }}
            title={`${issues.open} open`}
          />
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${closedPercentage}%` }}
            title={`${issues.closed} closed`}
          />
        </div>
      </div>
      
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Average Time to Close</p>
        <p className="text-2xl font-bold text-blue-400">
          {issues.avgCloseTime} <span className="text-[13px] font-normal">days</span>
        </p>
      </div>
      
      {/* Recent issues */}
      {issues.recentIssues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1f1f1f]">
          <h3 className="text-[13px] font-semibold text-[#ededed] mb-2">
            Recent Issues
          </h3>
          <div className="space-y-2">
            {issues.recentIssues.map((issue) => (
              <a
                key={issue.number}
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded bg-[#111] hover:bg-[#1a1a1a] transition-colors"
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  issue.state === 'open' ? 'bg-red-500' : 'bg-green-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#ededed] truncate">
                    #{issue.number} {issue.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {issue.labels.slice(0, 3).map((label, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 bg-[#1f1f1f] text-[#666] rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
