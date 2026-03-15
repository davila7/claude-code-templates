import type { ReviewCycle } from '../../lib/live-task/types';

const statusColors: Record<string, string> = {
  active: '#22c55e',
  completed: '#6b7280',
  merged: '#3b82f6',
  failed: '#ef4444',
};

const phaseLabels: Record<string, string> = {
  selection: 'Selecting',
  research: 'Researching',
  improve: 'Improving',
  pr_created: 'PR Created',
  reporting: 'Reporting',
  merging: 'Merging',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function duration(start: string, end: string | null): string {
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diff = endTime - new Date(start).getTime();
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function shortPath(path: string): string {
  const parts = path.split('/');
  return parts.slice(-2).join('/');
}

interface Props {
  cycles: ReviewCycle[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function CycleTable({ cycles, selectedId, onSelect }: Props) {
  if (cycles.length === 0) {
    return (
      <div style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
        fontFamily: 'monospace',
      }}>
        No review cycles yet. The daily scheduled task will create the first one.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
            {['Status', 'Component', 'Type', 'Phase', 'PR', 'Started', 'Duration'].map(h => (
              <th key={h} style={{
                padding: '8px 12px',
                textAlign: 'left',
                color: '#6b7280',
                fontWeight: 500,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cycles.map(cycle => {
            const isSelected = cycle.id === selectedId;
            const isActive = cycle.status === 'active';
            return (
              <tr
                key={cycle.id}
                onClick={() => onSelect(cycle.id)}
                style={{
                  borderBottom: '1px solid #1a1a1a',
                  cursor: 'pointer',
                  background: isSelected ? '#1a1a2e' : 'transparent',
                  borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#111'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColors[cycle.status] || '#6b7280',
                    animation: isActive ? 'pulse-dot 2s infinite' : 'none',
                  }} />
                  <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
                </td>
                <td style={{ padding: '10px 12px', color: '#e5e7eb' }} title={cycle.component_path}>
                  {shortPath(cycle.component_path)}
                </td>
                <td style={{ padding: '10px 12px', color: '#9ca3af' }}>
                  {cycle.component_type}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    background: isActive ? '#1e3a5f' : '#1a1a1a',
                    color: isActive ? '#60a5fa' : '#6b7280',
                  }}>
                    {phaseLabels[cycle.phase] || cycle.phase}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {cycle.pr_url ? (
                    <a
                      href={cycle.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 12 }}
                    >
                      #{cycle.pr_number}
                    </a>
                  ) : (
                    <span style={{ color: '#4b5563' }}>-</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>
                  {timeAgo(cycle.started_at)}
                </td>
                <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>
                  {duration(cycle.started_at, cycle.completed_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
