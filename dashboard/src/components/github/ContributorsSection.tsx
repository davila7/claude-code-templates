// Top Contributors Section

import type { Contributor } from '../../types/github';

interface ContributorsSectionProps {
  contributors: Contributor[];
}

export default function ContributorsSection({ contributors }: ContributorsSectionProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-[15px] font-semibold text-[#ededed] mb-3">
        Top Contributors
      </h2>
      
      {contributors.length === 0 ? (
        <p className="text-[12px] text-[#666] text-center py-8">
          No contributors found
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {contributors.map((contributor, index) => (
            <a
              key={index}
              href={contributor.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] border border-[#1f1f1f] hover:border-[#2a2a2a] transition-all group"
            >
              <div className="relative mb-2">
                <img
                  src={contributor.avatar_url}
                  alt={contributor.login}
                  className="w-12 h-12 rounded-full border-2 border-[#1f1f1f] group-hover:border-[#3b82f6] transition-colors"
                />
                {index < 3 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                    {index + 1}
                  </div>
                )}
              </div>
              
              <p className="text-[12px] font-medium text-[#ededed] text-center truncate w-full">
                {contributor.login}
              </p>
              
              <p className="text-[11px] text-[#666] mt-0.5">
                {contributor.contributions.toLocaleString()} commits
              </p>
            </a>
          ))}
        </div>
      )}
      
      <div className="mt-4 pt-3 border-t border-[#1f1f1f]">
        <a
          href="https://github.com/anthropics/claude-code-templates/graphs/contributors"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b82f6] hover:text-[#60a5fa] text-[12px] font-medium flex items-center justify-center gap-2 transition-colors"
        >
          View all contributors
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
