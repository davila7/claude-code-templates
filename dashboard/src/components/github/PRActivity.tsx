// Pull Request Activity Feed

import type { PRStats } from '../../types/github';

interface PRActivityProps {
  prs: PRStats;
}

export default function PRActivity({ prs }: PRActivityProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-[15px] font-semibold text-[#ededed] mb-3">
        Pull Request Activity
      </h2>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Open</p>
          <p className="text-2xl font-bold text-green-400">{prs.open}</p>
        </div>
        <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Merged</p>
          <p className="text-2xl font-bold text-purple-400">{prs.merged}</p>
        </div>
        <div className="text-center p-3 bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Closed</p>
          <p className="text-2xl font-bold text-[#999]">{prs.closed}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Merge Rate</p>
          <p className="text-2xl font-bold text-blue-400">{prs.mergeRate}%</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
          <p className="text-[11px] text-[#666] mb-1 uppercase tracking-wider">Avg. Merge Time</p>
          <p className="text-2xl font-bold text-indigo-400">{prs.avgMergeTime} <span className="text-[13px] font-normal">days</span></p>
        </div>
      </div>
      
      {prs.recentPRs.length > 0 && (
        <div className="pt-3 border-t border-[#1f1f1f]">
          <h3 className="text-[13px] font-semibold text-[#ededed] mb-2">Recent Pull Requests</h3>
          <div className="space-y-2">
            {prs.recentPRs.map((pr) => (
              <a
                key={pr.number}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 border border-[#1f1f1f] rounded bg-[#111] hover:bg-[#1a1a1a] hover:border-[#2a2a2a] transition-all"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  pr.state === 'open' ? 'bg-green-500' : pr.merged_at ? 'bg-purple-500' : 'bg-[#666]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#ededed] truncate">
                    #{pr.number} {pr.title}
                  </p>
                  <p className="text-[11px] text-[#666]">
                    by {pr.author} • {new Date(pr.created_at).toLocaleDateString()}
                  </p>
                </div>
                <svg className="w-3.5 h-3.5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
