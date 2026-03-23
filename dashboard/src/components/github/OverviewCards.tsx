// GitHub Overview Stats Cards

import type { OverviewStats } from '../../types/github';

interface OverviewCardsProps {
  stats: OverviewStats;
}

export default function OverviewCards({ stats }: OverviewCardsProps) {
  const cards = [
    {
      icon: '⭐',
      label: 'Stars',
      value: stats.stars.toLocaleString(),
      color: 'text-yellow-400',
    },
    {
      icon: '🍴',
      label: 'Forks',
      value: stats.forks.toLocaleString(),
      color: 'text-blue-400',
    },
    {
      icon: '🐛',
      label: 'Open Issues',
      value: stats.openIssues.toLocaleString(),
      color: 'text-red-400',
    },
    {
      icon: '🔀',
      label: 'Open PRs',
      value: stats.openPRs.toLocaleString(),
      color: 'text-green-400',
    },
    {
      icon: '👥',
      label: 'Contributors',
      value: stats.contributors.toLocaleString(),
      color: 'text-purple-400',
    },
    {
      icon: '📝',
      label: 'Commits (30d)',
      value: stats.commits30d.toLocaleString(),
      color: 'text-gray-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 hover:bg-[#111] hover:border-[#2a2a2a] transition-all"
        >
          <div className={`text-2xl mb-2 ${card.color}`}>
            {card.icon}
          </div>
          <div className="text-2xl font-bold text-[#ededed] mb-1">
            {card.value}
          </div>
          <div className="text-[11px] text-[#666] uppercase tracking-wider">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
