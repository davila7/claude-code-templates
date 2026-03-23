import type { TutorialCardData } from '../../types/tutorial';

interface TutorialCardProps {
  tutorial: TutorialCardData;
}

export default function TutorialCard({ tutorial }: TutorialCardProps) {
  const typeIcons: Record<string, string> = {
    agent: '🤖',
    command: '⚡',
    hook: '🪝',
    mcp: '🔌',
    skill: '🎯'
  };

  const difficultyColors = {
    beginner: 'bg-emerald-500/10 text-emerald-400',
    intermediate: 'bg-yellow-500/10 text-yellow-400',
    advanced: 'bg-red-500/10 text-red-400'
  };

  return (
    <a
      href={`/tutorials/${tutorial.component}`}
      className="group block bg-[#0a0a0a] border border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#111] rounded-xl p-4 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center text-xl shrink-0">
          {typeIcons[tutorial.type] || '📄'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-[13px] font-semibold text-[#ededed] group-hover:text-[#fff] transition-colors line-clamp-1">
              {tutorial.title}
            </h3>
            {tutorial.popular && (
              <span className="flex-shrink-0 px-2 py-0.5 text-[10px] rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                🔥 Popular
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#666] line-clamp-2 leading-relaxed">
            {tutorial.description}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tutorial.tags.slice(0, 3).map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 text-[10px] rounded-full bg-[#0a0a0a] text-[#666]"
          >
            {tag}
          </span>
        ))}
        {tutorial.tags.length > 3 && (
          <span className="px-2 py-0.5 text-[10px] text-[#666]">
            +{tutorial.tags.length - 3}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] rounded-full ${difficultyColors[tutorial.difficulty]}`}>
            {tutorial.difficulty}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#666]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tutorial.duration}
          </span>
        </div>
        {tutorial.completionRate !== undefined && tutorial.completionRate > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tutorial.completionRate}% complete
          </div>
        )}
      </div>
    </a>
  );
}
