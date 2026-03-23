// Releases Timeline

import type { Release } from '../../types/github';

interface ReleasesTimelineProps {
  releases: Release[];
}

export default function ReleasesTimeline({ releases }: ReleasesTimelineProps) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-[15px] font-semibold text-[#ededed] mb-3">
        Recent Releases
      </h2>
      
      {releases.length === 0 ? (
        <p className="text-[12px] text-[#666] text-center py-8">
          No releases found
        </p>
      ) : (
        <div className="space-y-3">
          {releases.map((release, index) => (
            <a
              key={index}
              href={release.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-l-2 border-green-500 pl-3 py-2 bg-[#111] hover:bg-[#1a1a1a] hover:border-green-400 transition-all rounded-r"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-bold text-[#ededed]">
                  {release.tag}
                </span>
                <span className="text-[11px] text-[#666]">
                  {new Date(release.date).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-[#666]">
                  by {release.author}
                </span>
              </div>
              {release.name && release.name !== release.tag && (
                <p className="text-[12px] font-medium text-[#999] mb-1">
                  {release.name}
                </p>
              )}
              {release.description && (
                <p className="text-[12px] text-[#666] line-clamp-2">
                  {release.description}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
