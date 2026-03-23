// Recent Component Additions Timeline

import type { ComponentAddition } from '../../types/github';

interface RecentComponentsProps {
  components: ComponentAddition[];
}

export default function RecentComponents({ components }: RecentComponentsProps) {
  const typeColors: Record<string, string> = {
    agent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    command: 'bg-green-500/10 text-green-400 border-green-500/20',
    hook: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    mcp: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    skill: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  };

  const typeIcons: Record<string, string> = {
    agent: '🤖',
    command: '⚡',
    hook: '🪝',
    mcp: '🔌',
    skill: '🎯',
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4">
      <h2 className="text-[15px] font-semibold text-[#ededed] mb-3">
        Recent Component Additions
      </h2>
      
      {components.length === 0 ? (
        <p className="text-[12px] text-[#666] text-center py-8">
          No recent component additions found
        </p>
      ) : (
        <div className="space-y-2">
          {components.map((component, index) => (
            <a
              key={index}
              href={component.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 border-l-2 border-[#3b82f6] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#60a5fa] transition-all rounded-r"
            >
              <span className="text-lg">
                {typeIcons[component.type] || '📦'}
              </span>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-medium text-[#ededed] truncate">
                    {component.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${typeColors[component.type] || 'bg-[#1f1f1f] text-[#666]'}`}>
                    {component.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#666]">
                  <span>{new Date(component.date).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{component.author}</span>
                  <span>•</span>
                  <span className="font-mono">{component.sha}</span>
                </div>
              </div>
              
              <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
